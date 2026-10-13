-- =====================================================================
-- DESTAC PROPAGANDAS | Estrutura do módulo Financeiro (Supabase / PostgreSQL)
-- Banco esperado: projeto DESTAC (kvmayirfbdnexlzqnjvr.supabase.co)
-- Compatível com financeiro.js / financeiro_integracao_contratos.js
-- Execute no SQL Editor do Supabase, preferencialmente após um backup.
-- Script aditivo: não exclui dados existentes. Pode ser executado novamente.
-- =====================================================================

BEGIN;

-- Categorias comuns aos usuários habilitados no sistema.
CREATE TABLE IF NOT EXISTS public.financeiro_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('RECEITA', 'DESPESA', 'AMBOS')),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_categorias_nome_tipo_uniq UNIQUE (nome, tipo)
);

CREATE TABLE IF NOT EXISTS public.financeiro_contas_receber (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  cliente_id bigint NOT NULL REFERENCES public.clientes(id),
  contrato_id bigint REFERENCES public.contratos(id) ON DELETE SET NULL,
  numero_documento text,
  descricao text NOT NULL,
  parcela integer NOT NULL DEFAULT 1 CHECK (parcela >= 1),
  total_parcelas integer NOT NULL DEFAULT 1 CHECK (total_parcelas >= 1),
  competencia date,
  vencimento date NOT NULL,
  valor_original numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_original >= 0),
  desconto numeric(14,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  juros numeric(14,2) NOT NULL DEFAULT 0 CHECK (juros >= 0),
  multa numeric(14,2) NOT NULL DEFAULT 0 CHECK (multa >= 0),
  valor_recebido numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_recebido >= 0),
  forma_prevista text,
  observacao text,
  origem text NOT NULL DEFAULT 'MANUAL' CHECK (origem IN ('MANUAL', 'CONTRATO')),
  status text NOT NULL DEFAULT 'ABERTO'
    CHECK (status IN ('ABERTO', 'VENCIDO', 'PARCIAL', 'PAGO', 'CANCELADO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT financeiro_receber_parcela_limite CHECK (parcela <= total_parcelas)
);

CREATE TABLE IF NOT EXISTS public.financeiro_recebimentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_receber_id uuid NOT NULL REFERENCES public.financeiro_contas_receber(id) ON DELETE RESTRICT,
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  cliente_id bigint NOT NULL REFERENCES public.clientes(id),
  data_recebimento date NOT NULL DEFAULT CURRENT_DATE,
  valor numeric(14,2) NOT NULL CHECK (valor > 0),
  forma_pagamento text,
  referencia text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.financeiro_contas_pagar (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id bigint NOT NULL REFERENCES public.empresas(id),
  categoria_id uuid REFERENCES public.financeiro_categorias(id) ON DELETE SET NULL,
  fornecedor_nome text NOT NULL,
  fornecedor_cpf_cnpj text,
  numero_documento text,
  descricao text NOT NULL,
  competencia date,
  vencimento date NOT NULL,
  valor_original numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_original >= 0),
  valor_pago numeric(14,2) NOT NULL DEFAULT 0 CHECK (valor_pago >= 0),
  data_pagamento date,
  forma_prevista text,
  forma_pagamento text,
  referencia_pagamento text,
  observacao text,
  status text NOT NULL DEFAULT 'ABERTO'
    CHECK (status IN ('ABERTO', 'VENCIDO', 'PARCIAL', 'PAGO', 'CANCELADO')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS financeiro_receber_empresa_vencimento_idx
  ON public.financeiro_contas_receber (empresa_id, vencimento);
CREATE INDEX IF NOT EXISTS financeiro_receber_cliente_idx
  ON public.financeiro_contas_receber (cliente_id);
CREATE INDEX IF NOT EXISTS financeiro_receber_contrato_idx
  ON public.financeiro_contas_receber (contrato_id);
-- Impede gerar a mesma parcela contratual mais de uma vez.
CREATE UNIQUE INDEX IF NOT EXISTS financeiro_receber_contrato_parcela_uniq
  ON public.financeiro_contas_receber (contrato_id, parcela)
  WHERE contrato_id IS NOT NULL AND origem = 'CONTRATO';
CREATE INDEX IF NOT EXISTS financeiro_recebimentos_conta_idx
  ON public.financeiro_recebimentos (conta_receber_id);
CREATE INDEX IF NOT EXISTS financeiro_recebimentos_empresa_data_idx
  ON public.financeiro_recebimentos (empresa_id, data_recebimento);
CREATE INDEX IF NOT EXISTS financeiro_pagar_empresa_vencimento_idx
  ON public.financeiro_contas_pagar (empresa_id, vencimento);

-- Controle de acesso por empresa, conforme perfis_usuario utilizado pela DESTAC.
-- SUPER_USUARIO: todas as empresas.
-- ADMINISTRADOR com empresa_id nulo: todas; com empresa_id informado: sua empresa.
-- USUARIO: apenas sua empresa.
CREATE OR REPLACE FUNCTION public.financeiro_pode_acessar_empresa(p_empresa_id bigint)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.perfis_usuario p
   WHERE p.user_id = auth.uid()
     AND p.ativo IS TRUE
     AND (
       p.perfil = 'SUPER_USUARIO'
       OR (p.perfil = 'ADMINISTRADOR' AND p.empresa_id IS NULL)
       OR (p.empresa_id = p_empresa_id AND p.perfil IN ('ADMINISTRADOR', 'USUARIO'))
     )
 );
$$;

CREATE OR REPLACE FUNCTION public.financeiro_usuario_ativo()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.perfis_usuario p
   WHERE p.user_id = auth.uid() AND p.ativo IS TRUE
 );
$$;

CREATE OR REPLACE FUNCTION public.financeiro_pode_administrar()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT EXISTS (
   SELECT 1 FROM public.perfis_usuario p
   WHERE p.user_id = auth.uid()
     AND p.ativo IS TRUE
     AND p.perfil IN ('SUPER_USUARIO', 'ADMINISTRADOR')
 );
$$;

-- Atualização da data de modificação.
CREATE OR REPLACE FUNCTION public.financeiro_marcar_atualizacao()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 NEW.updated_at := now();
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financeiro_categorias_atualizacao ON public.financeiro_categorias;
CREATE TRIGGER financeiro_categorias_atualizacao
BEFORE UPDATE ON public.financeiro_categorias
FOR EACH ROW EXECUTE FUNCTION public.financeiro_marcar_atualizacao();

DROP TRIGGER IF EXISTS financeiro_receber_atualizacao ON public.financeiro_contas_receber;
CREATE TRIGGER financeiro_receber_atualizacao
BEFORE UPDATE ON public.financeiro_contas_receber
FOR EACH ROW EXECUTE FUNCTION public.financeiro_marcar_atualizacao();

DROP TRIGGER IF EXISTS financeiro_recebimentos_atualizacao ON public.financeiro_recebimentos;
CREATE TRIGGER financeiro_recebimentos_atualizacao
BEFORE UPDATE ON public.financeiro_recebimentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_marcar_atualizacao();

DROP TRIGGER IF EXISTS financeiro_pagar_atualizacao ON public.financeiro_contas_pagar;
CREATE TRIGGER financeiro_pagar_atualizacao
BEFORE UPDATE ON public.financeiro_contas_pagar
FOR EACH ROW EXECUTE FUNCTION public.financeiro_marcar_atualizacao();

-- Evita recebimento aplicado em conta de outra empresa ou acima do saldo.
CREATE OR REPLACE FUNCTION public.financeiro_validar_recebimento()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
DECLARE
 conta record;
 recebido numeric(14,2);
 total numeric(14,2);
BEGIN
 SELECT c.empresa_id, c.cliente_id, c.status,
        (c.valor_original - c.desconto + c.juros + c.multa) AS total
 INTO conta
 FROM public.financeiro_contas_receber c
 WHERE c.id = NEW.conta_receber_id
 FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Conta a receber não encontrada ou indisponível.'; END IF;
 IF conta.status = 'CANCELADO' THEN RAISE EXCEPTION 'Conta a receber cancelada.'; END IF;
 NEW.empresa_id := conta.empresa_id;
 NEW.cliente_id := conta.cliente_id;
 total := conta.total;
 SELECT COALESCE(SUM(r.valor), 0) INTO recebido
 FROM public.financeiro_recebimentos r
 WHERE r.conta_receber_id = NEW.conta_receber_id
   AND r.id IS DISTINCT FROM NEW.id;
 IF (recebido + NEW.valor) > total + 0.01 THEN
   RAISE EXCEPTION 'Recebimento excede o saldo da conta.';
 END IF;
 RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS financeiro_validar_recebimento_trg ON public.financeiro_recebimentos;
CREATE TRIGGER financeiro_validar_recebimento_trg
BEFORE INSERT OR UPDATE ON public.financeiro_recebimentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_validar_recebimento();

CREATE OR REPLACE FUNCTION public.financeiro_recalcular_conta(p_conta_id uuid)
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 UPDATE public.financeiro_contas_receber c
 SET valor_recebido = v.soma,
     status = CASE
       WHEN c.status = 'CANCELADO' THEN 'CANCELADO'
       WHEN v.soma > 0 AND v.soma >= (c.valor_original - c.desconto + c.juros + c.multa) - 0.01 THEN 'PAGO'
       WHEN v.soma > 0 THEN 'PARCIAL'
       WHEN c.vencimento < CURRENT_DATE THEN 'VENCIDO'
       ELSE 'ABERTO'
     END
 FROM (
   SELECT COALESCE(SUM(r.valor), 0)::numeric(14,2) AS soma
   FROM public.financeiro_recebimentos r WHERE r.conta_receber_id = p_conta_id
 ) v
 WHERE c.id = p_conta_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.financeiro_apos_recebimento()
RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'DELETE' THEN
   PERFORM public.financeiro_recalcular_conta(OLD.conta_receber_id);
   RETURN OLD;
 ELSIF TG_OP = 'UPDATE' THEN
   IF OLD.conta_receber_id IS DISTINCT FROM NEW.conta_receber_id THEN
     PERFORM public.financeiro_recalcular_conta(OLD.conta_receber_id);
   END IF;
   PERFORM public.financeiro_recalcular_conta(NEW.conta_receber_id);
   RETURN NEW;
 ELSE
   PERFORM public.financeiro_recalcular_conta(NEW.conta_receber_id);
   RETURN NEW;
 END IF;
END;
$$;

DROP TRIGGER IF EXISTS financeiro_apos_recebimento_trg ON public.financeiro_recebimentos;
CREATE TRIGGER financeiro_apos_recebimento_trg
AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_recebimentos
FOR EACH ROW EXECUTE FUNCTION public.financeiro_apos_recebimento();

-- O app chama essa função a cada recarregamento do Financeiro.
CREATE OR REPLACE FUNCTION public.financeiro_atualizar_vencidos()
RETURNS void LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 UPDATE public.financeiro_contas_receber
 SET status = 'VENCIDO'
 WHERE status = 'ABERTO' AND vencimento < CURRENT_DATE;
 UPDATE public.financeiro_contas_receber
 SET status = 'ABERTO'
 WHERE status = 'VENCIDO' AND vencimento >= CURRENT_DATE;
 UPDATE public.financeiro_contas_pagar
 SET status = 'VENCIDO'
 WHERE status = 'ABERTO' AND vencimento < CURRENT_DATE;
 UPDATE public.financeiro_contas_pagar
 SET status = 'ABERTO'
 WHERE status = 'VENCIDO' AND vencimento >= CURRENT_DATE;
END;
$$;

-- Row Level Security (RLS): acesso apenas a usuários autenticados autorizados.
ALTER TABLE public.financeiro_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_contas_receber ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_recebimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financeiro_contas_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS financ_cat_select ON public.financeiro_categorias;
CREATE POLICY financ_cat_select ON public.financeiro_categorias FOR SELECT TO authenticated
USING (public.financeiro_usuario_ativo());
DROP POLICY IF EXISTS financ_cat_insert ON public.financeiro_categorias;
CREATE POLICY financ_cat_insert ON public.financeiro_categorias FOR INSERT TO authenticated
WITH CHECK (public.financeiro_pode_administrar());
DROP POLICY IF EXISTS financ_cat_update ON public.financeiro_categorias;
CREATE POLICY financ_cat_update ON public.financeiro_categorias FOR UPDATE TO authenticated
USING (public.financeiro_pode_administrar()) WITH CHECK (public.financeiro_pode_administrar());
DROP POLICY IF EXISTS financ_cat_delete ON public.financeiro_categorias;
CREATE POLICY financ_cat_delete ON public.financeiro_categorias FOR DELETE TO authenticated
USING (public.financeiro_pode_administrar());

DROP POLICY IF EXISTS financ_cr_select ON public.financeiro_contas_receber;
CREATE POLICY financ_cr_select ON public.financeiro_contas_receber FOR SELECT TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_cr_insert ON public.financeiro_contas_receber;
CREATE POLICY financ_cr_insert ON public.financeiro_contas_receber FOR INSERT TO authenticated
WITH CHECK (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_cr_update ON public.financeiro_contas_receber;
CREATE POLICY financ_cr_update ON public.financeiro_contas_receber FOR UPDATE TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id))
WITH CHECK (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_cr_delete ON public.financeiro_contas_receber;
CREATE POLICY financ_cr_delete ON public.financeiro_contas_receber FOR DELETE TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id));

DROP POLICY IF EXISTS financ_receb_select ON public.financeiro_recebimentos;
CREATE POLICY financ_receb_select ON public.financeiro_recebimentos FOR SELECT TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_receb_insert ON public.financeiro_recebimentos;
CREATE POLICY financ_receb_insert ON public.financeiro_recebimentos FOR INSERT TO authenticated
WITH CHECK (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_receb_update ON public.financeiro_recebimentos;
CREATE POLICY financ_receb_update ON public.financeiro_recebimentos FOR UPDATE TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id))
WITH CHECK (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_receb_delete ON public.financeiro_recebimentos;
CREATE POLICY financ_receb_delete ON public.financeiro_recebimentos FOR DELETE TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id));

DROP POLICY IF EXISTS financ_cp_select ON public.financeiro_contas_pagar;
CREATE POLICY financ_cp_select ON public.financeiro_contas_pagar FOR SELECT TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_cp_insert ON public.financeiro_contas_pagar;
CREATE POLICY financ_cp_insert ON public.financeiro_contas_pagar FOR INSERT TO authenticated
WITH CHECK (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_cp_update ON public.financeiro_contas_pagar;
CREATE POLICY financ_cp_update ON public.financeiro_contas_pagar FOR UPDATE TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id))
WITH CHECK (public.financeiro_pode_acessar_empresa(empresa_id));
DROP POLICY IF EXISTS financ_cp_delete ON public.financeiro_contas_pagar;
CREATE POLICY financ_cp_delete ON public.financeiro_contas_pagar FOR DELETE TO authenticated
USING (public.financeiro_pode_acessar_empresa(empresa_id));

-- Sem exposição de dados financeiros a usuários anônimos.
REVOKE ALL ON TABLE public.financeiro_categorias, public.financeiro_contas_receber,
  public.financeiro_recebimentos, public.financeiro_contas_pagar FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.financeiro_categorias,
  public.financeiro_contas_receber, public.financeiro_recebimentos,
  public.financeiro_contas_pagar TO authenticated;
REVOKE ALL ON FUNCTION public.financeiro_pode_acessar_empresa(bigint),
  public.financeiro_usuario_ativo(), public.financeiro_pode_administrar(),
  public.financeiro_atualizar_vencidos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.financeiro_pode_acessar_empresa(bigint),
  public.financeiro_usuario_ativo(), public.financeiro_pode_administrar(),
  public.financeiro_atualizar_vencidos() TO authenticated;

-- Categorias iniciais (não duplica ao executar novamente).
INSERT INTO public.financeiro_categorias (nome, tipo)
VALUES
 ('Publicidade e mídia', 'RECEITA'), ('Serviços', 'RECEITA'),
 ('Combustível', 'DESPESA'), ('Manutenção', 'DESPESA'),
 ('Impostos e taxas', 'DESPESA'), ('Energia e utilidades', 'DESPESA'),
 ('Equipe e terceiros', 'DESPESA'), ('Eventos', 'DESPESA'),
 ('Material gráfico', 'DESPESA'), ('Outras despesas', 'DESPESA')
ON CONFLICT (nome, tipo) DO NOTHING;

COMMIT;

-- Validação após executar:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'public' AND table_name LIKE 'financeiro_%';
-- SELECT COUNT(*) FROM public.financeiro_categorias;
-- Não apague o armazenamento local do navegador: dados criados antes deste SQL
-- NÃO são migrados automaticamente para as novas tabelas.
