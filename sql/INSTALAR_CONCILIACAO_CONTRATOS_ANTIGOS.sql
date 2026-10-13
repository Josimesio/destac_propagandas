-- DESTAC PROPAGANDAS - CONCILIACAO CONTROLADA DE CONTRATOS ANTIGOS
-- Instale UMA VEZ, preferencialmente apos backup e em horario de menor uso.
-- Antes de publicar a tela. Nao remove dados, nao gera parcelas ao instalar.
-- Contratos criados DEPOIS da instalacao continuam seguindo a rotina automatica.
-- IMPORTANTE: nao execute os scripts antigos de integracao APOS esta migracao.
BEGIN;

CREATE TABLE IF NOT EXISTS public.financeiro_conciliacao_legado (
  contrato_id bigint PRIMARY KEY REFERENCES public.contratos(id) ON DELETE CASCADE,
  estado text NOT NULL DEFAULT 'PENDENTE'
    CHECK (estado IN ('PENDENTE','AUTORIZADO','INTEGRADO','IGNORADO','REVISAR')),
  conferido_por uuid,
  conferido_em timestamptz,
  integrado_em timestamptz,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

-- Esta marca impede que um segundo RUN classifique contratos novos como antigos.
CREATE TABLE IF NOT EXISTS public.financeiro_conciliacao_instalacao (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  instalado_em timestamptz NOT NULL DEFAULT now(),
  quantidade_inicial integer NOT NULL DEFAULT 0
);
REVOKE ALL ON public.financeiro_conciliacao_instalacao FROM PUBLIC, anon, authenticated;

DO $bloco$
DECLARE v_total integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.financeiro_conciliacao_instalacao WHERE singleton) THEN
    INSERT INTO public.financeiro_conciliacao_legado(contrato_id)
    SELECT c.id FROM public.contratos c WHERE true
    ON CONFLICT (contrato_id) DO NOTHING;
    GET DIAGNOSTICS v_total = ROW_COUNT;
    INSERT INTO public.financeiro_conciliacao_instalacao(singleton,quantidade_inicial)
    VALUES (true, v_total);
  END IF;
END;
$bloco$;

ALTER TABLE public.financeiro_conciliacao_legado ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS conciliacao_legado_admin_select ON public.financeiro_conciliacao_legado;
CREATE POLICY conciliacao_legado_admin_select
ON public.financeiro_conciliacao_legado FOR SELECT TO authenticated
USING (
 public.financeiro_pode_administrar() AND EXISTS (
  SELECT 1 FROM public.contratos c
  WHERE c.id=contrato_id AND public.financeiro_pode_acessar_empresa(c.empresa_id)
 )
);
REVOKE ALL ON public.financeiro_conciliacao_legado FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.financeiro_conciliacao_legado TO authenticated;

-- Consultas consolidadas: agregado por contrato, sem extrapolar acesso a empresas.
CREATE OR REPLACE FUNCTION public.destac_listar_conciliacao_legado()
RETURNS TABLE (
 contrato_id bigint, numero_contrato text, empresa_id bigint, empresa_nome text,
 cliente_id bigint, cliente_nome text, situacao_contrato text,
 data_inicio date, data_termino date, valor_total numeric, valor_total_informado boolean, valor_entrada numeric,
 quantidade_parcelas integer, primeiro_vencimento date, forma_pagamento text,
 valor_mensal numeric, estado_conciliacao text, conferido_em timestamptz,
 qtd_cobrancas bigint, total_cobrancas numeric, total_recebido numeric,
 qtd_lancamentos_manuais bigint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT c.id, c.numero_contrato, c.empresa_id,
        coalesce(e.nome_fantasia,e.razao_social,''),
        c.cliente_id, coalesce(k.nome_fantasia,k.razao_social,''),
        c.status, c.data_inicio, c.data_termino,
        coalesce(nullif(c.valor_total_contrato,0),coalesce(c.valor_mensal,0)*coalesce(c.quantidade_parcelas,1)),
        (c.valor_total_contrato IS NOT NULL AND c.valor_total_contrato>0),
        coalesce(c.valor_entrada,0), c.quantidade_parcelas,
        c.data_primeiro_vencimento, c.forma_pagamento, c.valor_mensal,
        r.estado, r.conferido_em,
        coalesce(v.qtd,0),coalesce(v.total,0),coalesce(v.recebido,0),
        coalesce(m.qtd,0)
   FROM public.financeiro_conciliacao_legado r
   JOIN public.contratos c ON c.id=r.contrato_id
   JOIN public.empresas e ON e.id=c.empresa_id
   JOIN public.clientes k ON k.id=c.cliente_id
   LEFT JOIN LATERAL (
     SELECT count(*) qtd, sum(fr.valor_original) total, sum(fr.valor_recebido) recebido
     FROM public.financeiro_contas_receber fr
     WHERE fr.contrato_id=c.id AND fr.origem='CONTRATO'
   ) v ON true
   LEFT JOIN LATERAL (
     SELECT count(*) qtd FROM public.financeiro_contas_receber fr
      WHERE fr.empresa_id=c.empresa_id AND fr.cliente_id=c.cliente_id
        AND fr.origem='MANUAL'
        AND (fr.contrato_id IS NULL OR fr.contrato_id=c.id)
        AND fr.vencimento BETWEEN (c.data_inicio - INTERVAL '1 month')::date
                            AND (c.data_termino + INTERVAL '2 months')::date
   ) m ON true
  WHERE public.financeiro_pode_administrar()
    AND public.financeiro_pode_acessar_empresa(c.empresa_id)
 ORDER BY c.id DESC;
$$;
REVOKE ALL ON FUNCTION public.destac_listar_conciliacao_legado() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.destac_listar_conciliacao_legado() TO authenticated;

-- Guarda contra cobranças duplicadas (índice já previsto no Financeiro original).
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_receber_contrato_parcela_uniq
  ON public.financeiro_contas_receber(contrato_id, parcela)
  WHERE contrato_id IS NOT NULL AND origem = 'CONTRATO';

CREATE OR REPLACE FUNCTION public.destac_sincronizar_financeiro_contrato()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_meses integer;
  v_regular integer;
  v_entrada numeric(14,2);
  v_total numeric(14,2);
  v_restante numeric(14,2);
  v_primeiro date;
  v_primeiro_mes date;
  v_dia integer;
  v_qtd_total integer;
  v_qtd_entrada integer;
  v_qtd_travadas integer := 0;
  v_qtd_abertas integer;
  v_soma_travadas numeric(14,2) := 0;
  v_entrada_travada boolean := false;
  v_entrada_aberta numeric(14,2) := 0;
  v_qtd_reg_abertas integer;
  v_total_reg_abertas numeric(14,2);
  v_parcela_regular numeric(14,2);
  v_resto_centavos integer;
  v_pos_reg_abertas integer := 0;
  v_num integer;
  v_indice_regular integer;
  v_mes date;
  v_vencimento date;
  v_valor numeric(14,2);
  v_id uuid;
  v_recebido numeric(14,2);
  v_tem_pagamento boolean;
  v_nome text;
  v_status text;
  v_qtd_antiga integer;
  v_identidade_mudou boolean;
  v_entrada_antiga numeric(14,2);
BEGIN
  -- Evita processamento ao editar áudio, assinatura, observações etc.
  IF TG_OP = 'UPDATE' THEN
    IF ROW(NEW.empresa_id, NEW.cliente_id, NEW.data_inicio, NEW.data_termino,
           NEW.valor_mensal, NEW.valor_total_contrato, NEW.valor_entrada,
           NEW.dia_vencimento, NEW.quantidade_parcelas,
           NEW.data_primeiro_vencimento, NEW.forma_pagamento, NEW.status)
       IS NOT DISTINCT FROM
       ROW(OLD.empresa_id, OLD.cliente_id, OLD.data_inicio, OLD.data_termino,
           OLD.valor_mensal, OLD.valor_total_contrato, OLD.valor_entrada,
           OLD.dia_vencimento, OLD.quantidade_parcelas,
           OLD.data_primeiro_vencimento, OLD.forma_pagamento, OLD.status)
       AND NOT EXISTS (
         SELECT 1 FROM public.financeiro_conciliacao_legado r
          WHERE r.contrato_id=NEW.id AND r.estado='AUTORIZADO' AND r.integrado_em IS NULL
       ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Um contrato que já recebeu pagamentos não pode trocar de empresa ou
  -- cliente, inclusive quando for cancelado na mesma operação.
  IF TG_OP = 'UPDATE' AND
     (NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
      OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id) AND
     EXISTS (
       SELECT 1 FROM public.financeiro_contas_receber c
       WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO'
         AND (c.valor_recebido > 0 OR EXISTS (
           SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id))
     ) THEN
    RAISE EXCEPTION 'Há parcelas recebidas. Não é possível alterar empresa ou cliente deste contrato.' USING ERRCODE = '22023';
  END IF;

  -- Contrato cancelado: mantém parcelas quitadas e seus recebimentos;
  -- as demais são marcadas como canceladas (sem DELETE e sem estorno).
  IF UPPER(BTRIM(COALESCE(NEW.status, ''))) = 'CANCELADO' THEN
    UPDATE public.financeiro_contas_receber c
       SET status = 'CANCELADO'
     WHERE c.contrato_id = NEW.id
       AND c.origem = 'CONTRATO'
       AND c.status <> 'PAGO';
    RETURN NEW;
  END IF;

  -- Contratos capturados na instalação da conciliação NÃO geram ou
  -- recalculam parcelas sem autorização expressa do administrador.
  -- CANCELADO mantém a rotina de cancelamento anterior acima.
  IF EXISTS (
    SELECT 1 FROM public.financeiro_conciliacao_legado r
     WHERE r.contrato_id=NEW.id AND r.estado IN ('PENDENTE', 'IGNORADO', 'REVISAR')
  ) THEN
    RETURN NEW;
  END IF;

  -- REGRA DESTAC: parcelas só podem ser GERADAS ou RECALCULADAS
  -- por contratos ATIVOS. PENDENTE, SUSPENSO, ENCERRADO e outros
  -- status não criam nem modificam cobranças.
  -- NÃO cancela cobranças já existentes nesses status: isso exigiria
  -- decisão de negócio explícita e poderia atingir valores recebidos.
  IF UPPER(BTRIM(COALESCE(NEW.status, ''))) <> 'ATIVO' THEN
    RETURN NEW;
  END IF;

  v_meses := ((EXTRACT(YEAR FROM NEW.data_termino)::integer - EXTRACT(YEAR FROM NEW.data_inicio)::integer) * 12)
           + (EXTRACT(MONTH FROM NEW.data_termino)::integer - EXTRACT(MONTH FROM NEW.data_inicio)::integer) + 1;
  v_regular := COALESCE(NEW.quantidade_parcelas, GREATEST(1, v_meses));
  IF v_regular NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Quantidade de parcelas deve estar entre 1 e 120.' USING ERRCODE = '22023';
  END IF;

  -- Total explícito prevalece; caso contrário, o mensal é multiplicado
  -- pelo número de parcelas mensais. Nunca utiliza valor_vista automaticamente.
  v_total := COALESCE(NULLIF(NEW.valor_total_contrato, 0),
                      COALESCE(NEW.valor_mensal, 0) * v_regular)::numeric(14,2);
  v_entrada := COALESCE(NEW.valor_entrada, 0)::numeric(14,2);
  IF v_total < 0 OR v_entrada < 0 OR v_entrada > v_total THEN
    RAISE EXCEPTION 'Valores inválidos: a entrada não pode exceder o valor total do contrato.' USING ERRCODE = '22023';
  END IF;

  -- Contrato sem valor não gera cobrança. Cancelamento de linhas anteriores
  -- só é permitido quando não existe pagamento.
  IF v_total = 0 THEN
    IF EXISTS (
      SELECT 1 FROM public.financeiro_contas_receber c
      WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO'
        AND (c.valor_recebido > 0 OR EXISTS (
          SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id))
    ) THEN
      RAISE EXCEPTION 'Há recebimentos neste contrato. Não é possível zerar o valor financeiro.' USING ERRCODE = '22023';
    END IF;
    UPDATE public.financeiro_contas_receber c
       SET status = 'CANCELADO'
     WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO' AND c.status <> 'CANCELADO';
    RETURN NEW;
  END IF;

  v_restante := (v_total - v_entrada)::numeric(14,2);
  -- Entrada quitando o total: somente uma parcela.
  IF v_entrada > 0 AND v_restante = 0 THEN
    v_regular := 0;
  END IF;
  v_qtd_entrada := CASE WHEN v_entrada > 0 THEN 1 ELSE 0 END;
  v_qtd_total := v_regular + v_qtd_entrada;

  v_dia := COALESCE(NEW.dia_vencimento, EXTRACT(DAY FROM NEW.data_primeiro_vencimento)::integer,
                    EXTRACT(DAY FROM NEW.data_inicio)::integer);
  IF v_dia NOT BETWEEN 1 AND 31 THEN
    RAISE EXCEPTION 'Dia de vencimento deve estar entre 1 e 31.' USING ERRCODE = '22023';
  END IF;

  -- O primeiro vencimento explícito é respeitado, sem cálculo retroativo.
  -- Sem data explícita, usa o dia informado no mês de início; se anterior
  -- ao início da vigência, transfere para o próximo mês.
  IF NEW.data_primeiro_vencimento IS NOT NULL THEN
    v_primeiro := NEW.data_primeiro_vencimento;
  ELSE
    v_primeiro_mes := date_trunc('month', NEW.data_inicio)::date;
    v_primeiro := (v_primeiro_mes +
      (LEAST(v_dia, EXTRACT(DAY FROM (v_primeiro_mes + INTERVAL '1 month - 1 day'))::integer) - 1) * INTERVAL '1 day')::date;
    IF v_primeiro < NEW.data_inicio THEN
      v_primeiro_mes := (v_primeiro_mes + INTERVAL '1 month')::date;
      v_primeiro := (v_primeiro_mes +
        (LEAST(v_dia, EXTRACT(DAY FROM (v_primeiro_mes + INTERVAL '1 month - 1 day'))::integer) - 1) * INTERVAL '1 day')::date;
    END IF;
  END IF;

  -- Recolhe parcelas que já tiveram recebimento, inclusive parcial.
  SELECT COUNT(*)::integer,
         COALESCE(SUM(c.valor_original), 0)::numeric(14,2),
         COALESCE(MAX(c.total_parcelas), 0)::integer
    INTO v_qtd_travadas, v_soma_travadas, v_qtd_antiga
    FROM public.financeiro_contas_receber c
   WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO'
     AND (c.valor_recebido > 0 OR EXISTS (
       SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id));

  IF v_qtd_travadas > 0 THEN
    -- Uma entrada não pode ser criada, retirada ou ter seu valor alterado
    -- depois de iniciado o recebimento de qualquer parcela.
    IF TG_OP = 'UPDATE' AND NEW.valor_entrada IS DISTINCT FROM OLD.valor_entrada THEN
      RAISE EXCEPTION 'Há recebimentos neste contrato. O valor da entrada não pode ser alterado.' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' AND NEW.quantidade_parcelas IS DISTINCT FROM OLD.quantidade_parcelas THEN
      RAISE EXCEPTION 'Há recebimentos neste contrato. A quantidade de parcelas não pode ser alterada.' USING ERRCODE = '22023';
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.empresa_id IS DISTINCT FROM OLD.empresa_id
                            OR NEW.cliente_id IS DISTINCT FROM OLD.cliente_id) THEN
      RAISE EXCEPTION 'Há parcelas recebidas. Não é possível alterar empresa ou cliente deste contrato.' USING ERRCODE = '22023';
    END IF;
    IF v_qtd_antiga <> v_qtd_total THEN
      RAISE EXCEPTION 'Há parcelas recebidas. Mantenha a quantidade de parcelas e a entrada do contrato.' USING ERRCODE = '22023';
    END IF;
    IF v_total < v_soma_travadas THEN
      RAISE EXCEPTION 'O novo valor total é menor que o valor das parcelas já movimentadas.' USING ERRCODE = '22023';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.financeiro_contas_receber c
       WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO' AND c.parcela > v_qtd_total
         AND (c.valor_recebido > 0 OR EXISTS (
             SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id))
    ) THEN
      RAISE EXCEPTION 'Existem pagamentos vinculados a parcelas além da nova quantidade.' USING ERRCODE = '22023';
    END IF;
    IF v_qtd_entrada > 0 THEN
      SELECT c.valor_original INTO v_entrada_antiga
        FROM public.financeiro_contas_receber c
       WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO' AND c.parcela = 1
         AND (c.valor_recebido > 0 OR EXISTS (
             SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id));
      IF FOUND AND v_entrada_antiga <> v_entrada THEN
        RAISE EXCEPTION 'A entrada já recebeu pagamentos e não pode ter seu valor modificado.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.financeiro_contas_receber c
     WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO' AND c.parcela = 1
       AND (c.valor_recebido > 0 OR EXISTS (
         SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id))
  ) INTO v_entrada_travada;
  IF v_qtd_entrada = 0 THEN v_entrada_travada := false; END IF;

  v_entrada_aberta := CASE WHEN v_qtd_entrada > 0 AND NOT v_entrada_travada THEN v_entrada ELSE 0 END;
  v_qtd_abertas := v_qtd_total - v_qtd_travadas;
  v_qtd_reg_abertas := v_qtd_abertas - CASE WHEN v_entrada_aberta > 0 THEN 1 ELSE 0 END;
  v_total_reg_abertas := (v_total - v_soma_travadas - v_entrada_aberta)::numeric(14,2);

  IF v_total_reg_abertas < 0 THEN
    RAISE EXCEPTION 'O valor restante do contrato não cobre as parcelas já recebidas.' USING ERRCODE = '22023';
  END IF;
  IF v_qtd_reg_abertas = 0 AND v_total_reg_abertas <> 0 THEN
    RAISE EXCEPTION 'Todas as parcelas já possuem recebimentos. Não é possível alterar o valor total.' USING ERRCODE = '22023';
  END IF;
  IF v_qtd_reg_abertas > 0 THEN
    IF ROUND(v_total_reg_abertas * 100) < v_qtd_reg_abertas THEN
      RAISE EXCEPTION 'Valor restante insuficiente para distribuir em todas as parcelas.' USING ERRCODE = '22023';
    END IF;
    v_parcela_regular := (TRUNC(v_total_reg_abertas * 100 / v_qtd_reg_abertas) / 100)::numeric(14,2);
    v_resto_centavos := ROUND((v_total_reg_abertas - v_parcela_regular * v_qtd_reg_abertas) * 100)::integer;
  ELSE
    v_parcela_regular := 0;
    v_resto_centavos := 0;
  END IF;

  -- A edição só pode remover parcelas ainda sem recebimento.
  DELETE FROM public.financeiro_contas_receber c
   WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO' AND c.parcela > v_qtd_total
     AND c.valor_recebido = 0
     AND NOT EXISTS (SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id);

  FOR v_num IN 1..v_qtd_total LOOP
    v_indice_regular := v_num - v_qtd_entrada - 1;
    IF v_qtd_entrada = 1 AND v_num = 1 THEN
      v_vencimento := NEW.data_inicio;
      v_nome := 'Entrada - Contrato ' || COALESCE(NEW.numero_contrato, NEW.id::text);
      v_valor := v_entrada;
    ELSE
      v_mes := (date_trunc('month', v_primeiro)::date + (v_indice_regular * INTERVAL '1 month'))::date;
      v_vencimento := (v_mes +
        (LEAST(v_dia, EXTRACT(DAY FROM (v_mes + INTERVAL '1 month - 1 day'))::integer) - 1) * INTERVAL '1 day')::date;
      -- Se a data do primeiro vencimento foi explicitamente informada, ela é mantida.
      IF v_indice_regular = 0 AND NEW.data_primeiro_vencimento IS NOT NULL THEN
        v_vencimento := NEW.data_primeiro_vencimento;
      END IF;
      v_nome := 'Contrato ' || COALESCE(NEW.numero_contrato, NEW.id::text);
    END IF;

    v_id := NULL;
    v_recebido := 0;
    v_tem_pagamento := false;
    SELECT c.id, c.valor_recebido,
           (c.valor_recebido > 0 OR EXISTS (
             SELECT 1 FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = c.id))
      INTO v_id, v_recebido, v_tem_pagamento
      FROM public.financeiro_contas_receber c
     WHERE c.contrato_id = NEW.id AND c.origem = 'CONTRATO' AND c.parcela = v_num
     FOR UPDATE;

    IF v_tem_pagamento THEN
      -- Valor, vencimento e identidade de parcela recebida ficam intactos.
      -- Permite reativar parcelas parcialmente recebidas e antes canceladas.
      IF EXISTS (SELECT 1 FROM public.financeiro_contas_receber
                 WHERE id = v_id AND status = 'CANCELADO') THEN
        UPDATE public.financeiro_contas_receber
           SET status = CASE WHEN v_recebido > 0 THEN 'PARCIAL'
                             WHEN v_vencimento < CURRENT_DATE THEN 'VENCIDO'
                             ELSE 'ABERTO' END
         WHERE id = v_id;
      END IF;
      CONTINUE;
    END IF;

    IF NOT (v_qtd_entrada = 1 AND v_num = 1) THEN
      v_pos_reg_abertas := v_pos_reg_abertas + 1;
      v_valor := v_parcela_regular +
        CASE WHEN v_pos_reg_abertas <= v_resto_centavos THEN 0.01 ELSE 0 END;
    END IF;
    v_status := CASE WHEN v_vencimento < CURRENT_DATE THEN 'VENCIDO' ELSE 'ABERTO' END;

    IF v_id IS NOT NULL THEN
      UPDATE public.financeiro_contas_receber c
         SET empresa_id = NEW.empresa_id,
             cliente_id = NEW.cliente_id,
             numero_documento = NEW.numero_contrato,
             descricao = v_nome,
             total_parcelas = v_qtd_total,
             competencia = date_trunc('month', v_vencimento)::date,
             vencimento = v_vencimento,
             valor_original = v_valor,
             forma_prevista = NEW.forma_pagamento,
             status = v_status
       WHERE c.id = v_id;
    ELSE
      INSERT INTO public.financeiro_contas_receber
        (empresa_id, cliente_id, contrato_id, numero_documento, descricao,
         parcela, total_parcelas, competencia, vencimento, valor_original,
         forma_prevista, status, origem)
      VALUES
        (NEW.empresa_id, NEW.cliente_id, NEW.id, NEW.numero_contrato, v_nome,
         v_num, v_qtd_total, date_trunc('month', v_vencimento)::date,
         v_vencimento, v_valor, NEW.forma_pagamento, v_status, 'CONTRATO');
    END IF;
  END LOOP;

  -- A autorização é atômica: se falhar a geração, o registro de autorização
  -- é revertido e não ficará falsamente integrado.
  UPDATE public.financeiro_conciliacao_legado
     SET estado='INTEGRADO', integrado_em=clock_timestamp()
   WHERE contrato_id=NEW.id AND estado='AUTORIZADO';

  RETURN NEW;
END;
$$;

-- Evita execução manual fora de um INSERT/UPDATE de contrato.
REVOKE ALL ON FUNCTION public.destac_sincronizar_financeiro_contrato() FROM PUBLIC;

DROP TRIGGER IF EXISTS destac_financeiro_apos_insert_contrato ON public.contratos;
CREATE TRIGGER destac_financeiro_apos_insert_contrato
AFTER INSERT ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.destac_sincronizar_financeiro_contrato();

DROP TRIGGER IF EXISTS destac_financeiro_apos_update_contrato ON public.contratos;
CREATE TRIGGER destac_financeiro_apos_update_contrato
AFTER UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.destac_sincronizar_financeiro_contrato();


-- Aprovação individual: a geração acontece no mesmo COMMIT da autorização.
CREATE OR REPLACE FUNCTION public.destac_aprovar_conciliacao_legado(
 p_contrato_id bigint, p_conferiu_pagamentos boolean
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_c public.contratos%ROWTYPE;
        v_r public.financeiro_conciliacao_legado%ROWTYPE;
        v_total numeric(14,2);
BEGIN
 IF NOT public.financeiro_pode_administrar() THEN
   RAISE EXCEPTION 'Somente administrador ou super usuario pode conciliar.';
 END IF;
 IF p_conferiu_pagamentos IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Confirme a conferencia dos pagamentos e cobrancas anteriores.';
 END IF;
 SELECT * INTO v_c FROM public.contratos WHERE id=p_contrato_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao encontrado.'; END IF;
 IF NOT public.financeiro_pode_acessar_empresa(v_c.empresa_id) THEN
   RAISE EXCEPTION 'Sem permissao para a empresa deste contrato.';
 END IF;
 SELECT * INTO v_r FROM public.financeiro_conciliacao_legado
 WHERE contrato_id=p_contrato_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Contrato nao pertence ao lote antigo.'; END IF;
 IF v_r.estado='INTEGRADO' THEN RETURN 'Contrato ja integrado'; END IF;
 IF v_r.estado='IGNORADO' THEN RAISE EXCEPTION 'Contrato ignorado. Reabra a revisao antes de autorizar.'; END IF;
 IF upper(trim(coalesce(v_c.status,''))) <> 'ATIVO' THEN
   RAISE EXCEPTION 'Somente contratos ATIVOS podem gerar parcelas.';
 END IF;
 IF v_c.data_termino < v_c.data_inicio THEN
   RAISE EXCEPTION 'Periodo contratual invalido.';
 END IF;
 IF v_c.valor_total_contrato IS NULL OR v_c.valor_total_contrato <= 0 THEN
   RAISE EXCEPTION 'Preencha o VALOR TOTAL do contrato antes de conciliar.';
 END IF;
 IF v_c.quantidade_parcelas IS NULL OR v_c.quantidade_parcelas NOT BETWEEN 1 AND 120 THEN
   RAISE EXCEPTION 'Preencha a quantidade de parcelas (1 a 120).';
 END IF;
 IF v_c.data_primeiro_vencimento IS NULL THEN
   RAISE EXCEPTION 'Preencha o primeiro vencimento no contrato.';
 END IF;
 IF nullif(trim(coalesce(v_c.forma_pagamento,'')),'') IS NULL THEN
   RAISE EXCEPTION 'Preencha a forma de pagamento no contrato.';
 END IF;
 v_total:=coalesce(v_c.valor_total_contrato,0);
 IF coalesce(v_c.valor_entrada,0)<0 OR coalesce(v_c.valor_entrada,0)>v_total THEN
   RAISE EXCEPTION 'Entrada invalida: nao pode exceder o valor total.';
 END IF;
 -- Ja possui contas vinculadas: revisao manual, nunca cria novamente.
 IF EXISTS (SELECT 1 FROM public.financeiro_contas_receber
             WHERE contrato_id=p_contrato_id) THEN
   RAISE EXCEPTION 'Ja existem contas vinculadas ao contrato. Use Conferir existente.';
 END IF;
 UPDATE public.financeiro_conciliacao_legado
 SET estado='AUTORIZADO', conferido_por=auth.uid(), conferido_em=clock_timestamp(),
     observacao='Pagamentos anteriores conferidos antes da integracao.'
 WHERE contrato_id=p_contrato_id;
 -- Update sem alterar dados: o gatilho so processa a autorizacao pendente.
 UPDATE public.contratos SET numero_contrato=numero_contrato WHERE id=p_contrato_id;
 IF NOT EXISTS (SELECT 1 FROM public.financeiro_conciliacao_legado
                 WHERE contrato_id=p_contrato_id AND estado='INTEGRADO') THEN
   RAISE EXCEPTION 'As parcelas nao foram geradas: autorizacao revertida.';
 END IF;
 RETURN 'Integracao concluida';
END;
$$;
REVOKE ALL ON FUNCTION public.destac_aprovar_conciliacao_legado(bigint,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.destac_aprovar_conciliacao_legado(bigint,boolean) TO authenticated;

-- Contratos que JA POSSUEM contas vinculadas podem ser marcados como
-- conferidos SEM GERAR OU ALTERAR qualquer parcela.
CREATE OR REPLACE FUNCTION public.destac_conferir_conciliacao_existente(
 p_contrato_id bigint, p_conferiu_pagamentos boolean
) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_empresa bigint;
BEGIN
 IF NOT public.financeiro_pode_administrar() OR p_conferiu_pagamentos IS DISTINCT FROM true THEN
   RAISE EXCEPTION 'Conferencia e permissao administrativa obrigatorias.';
 END IF;
 SELECT empresa_id INTO v_empresa FROM public.contratos WHERE id=p_contrato_id FOR UPDATE;
 IF NOT FOUND OR NOT public.financeiro_pode_acessar_empresa(v_empresa) THEN
   RAISE EXCEPTION 'Contrato inexistente ou sem permissao.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.financeiro_conciliacao_legado WHERE contrato_id=p_contrato_id) THEN
   RAISE EXCEPTION 'Este contrato nao consta da conciliacao antiga.';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.financeiro_contas_receber
                WHERE contrato_id=p_contrato_id AND origem='CONTRATO') THEN
   RAISE EXCEPTION 'Nao ha cobrancas de contrato vinculadas para conferir.';
 END IF;
 UPDATE public.financeiro_conciliacao_legado
 SET estado='INTEGRADO',conferido_por=auth.uid(),conferido_em=clock_timestamp(),
     integrado_em=clock_timestamp(), observacao='Cobrancas existentes verificadas sem gerar novas.'
 WHERE contrato_id=p_contrato_id;
 RETURN 'Financeiro ja existente conferido (sem gerar parcelas)';
END;
$$;
REVOKE ALL ON FUNCTION public.destac_conferir_conciliacao_existente(bigint,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.destac_conferir_conciliacao_existente(bigint,boolean) TO authenticated;

-- Permite marcar um contrato antigo como revisado, mas NAO autorizado a gerar.
CREATE OR REPLACE FUNCTION public.destac_ignorar_conciliacao_legado(p_contrato_id bigint,p_motivo text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_empresa bigint;
BEGIN
 IF NOT public.financeiro_pode_administrar() THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
 IF nullif(trim(coalesce(p_motivo,'')),'') IS NULL THEN RAISE EXCEPTION 'Informe o motivo.'; END IF;
 SELECT empresa_id INTO v_empresa FROM public.contratos WHERE id=p_contrato_id FOR UPDATE;
 IF NOT FOUND OR NOT public.financeiro_pode_acessar_empresa(v_empresa) THEN
  RAISE EXCEPTION 'Contrato nao encontrado ou sem permissao.';
 END IF;
 UPDATE public.financeiro_conciliacao_legado
 SET estado='IGNORADO',conferido_por=auth.uid(),conferido_em=clock_timestamp(),
     observacao=left(trim(p_motivo),1000)
 WHERE contrato_id=p_contrato_id AND estado IN ('PENDENTE','REVISAR','IGNORADO');
 IF NOT FOUND THEN RAISE EXCEPTION 'Registro nao elegivel para ignorar.'; END IF;
 RETURN 'Contrato marcado para nao gerar cobrancas';
END;
$$;
REVOKE ALL ON FUNCTION public.destac_ignorar_conciliacao_legado(bigint,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.destac_ignorar_conciliacao_legado(bigint,text) TO authenticated;

-- Voltar ao estado pendente, sem gerar cobrancas.
CREATE OR REPLACE FUNCTION public.destac_reabrir_conciliacao_legado(p_contrato_id bigint)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_empresa bigint;
BEGIN
 IF NOT public.financeiro_pode_administrar() THEN RAISE EXCEPTION 'Acesso restrito.'; END IF;
 SELECT empresa_id INTO v_empresa FROM public.contratos WHERE id=p_contrato_id FOR UPDATE;
 IF NOT FOUND OR NOT public.financeiro_pode_acessar_empresa(v_empresa) THEN
  RAISE EXCEPTION 'Contrato nao encontrado ou sem permissao.';
 END IF;
 UPDATE public.financeiro_conciliacao_legado SET estado='PENDENTE',
     conferido_por=NULL,conferido_em=NULL,observacao=NULL
 WHERE contrato_id=p_contrato_id AND estado='IGNORADO';
 IF NOT FOUND THEN RAISE EXCEPTION 'So registros IGNORADOS podem ser reabertos.'; END IF;
 RETURN 'Conferencia reaberta';
END;
$$;
REVOKE ALL ON FUNCTION public.destac_reabrir_conciliacao_legado(bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.destac_reabrir_conciliacao_legado(bigint) TO authenticated;

COMMIT;
