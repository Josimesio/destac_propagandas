-- DESTAC PROPAGANDAS | 13/10/2026
-- Correcao adaptada a definicao enviada da funcao
-- public.destac_sincronizar_financeiro_contrato().
--
-- EFEITO: altera EXCLUSIVAMENTE a definicao dessa funcao, sem UPDATE,
-- DELETE ou INSERT em contratos, parcelas, recebimentos ou conciliacoes.
-- Preserva permissões, triggers, SECURITY DEFINER e search_path existentes.
-- Transacao atomica: em caso de erro, nada desta instalacao e aplicado.
-- PREREQUISITO: cinco colunas previamente instaladas, incluindo
-- public.contratos.percentual_desconto_parcelado.
-- RECOMENDADO: fazer backup antes da execucao.
-- NAO execute outros scripts antigos de recriacao da funcao depois deste.

BEGIN;

DO $destac_ajuste$
DECLARE
  v_atual text;
  v_nova text;
  v_antigo_new text :=
    'NEW.modalidade_contrato, NEW.valor_financeiro, NEW.valor_permuta, NEW.descricao_permuta)';
  v_novo_new text :=
    'NEW.modalidade_contrato, NEW.valor_financeiro, NEW.valor_permuta, NEW.descricao_permuta, NEW.percentual_desconto_parcelado)';
  v_antigo_old text :=
    'OLD.modalidade_contrato, OLD.valor_financeiro, OLD.valor_permuta, OLD.descricao_permuta)';
  v_novo_old text :=
    'OLD.modalidade_contrato, OLD.valor_financeiro, OLD.valor_permuta, OLD.descricao_permuta, OLD.percentual_desconto_parcelado)';
  -- Trecho exato da funcao encaminhada em 13/10/2026:
  v_calculo_anterior text :=
    '  v_total := (CASE WHEN NEW.condicao_pagamento = ''AVISTA'' THEN NEW.valor_vista'
    || E'\n' || '                   ELSE v_financeiro END)::numeric(14,2);';
  v_calculo_corrigido text := $novo_calculo$
  -- Desconto parcelado: aplicado apenas ao total financeiro, nunca a permuta.
  -- O valor comercial do contrato continua integral; somente a cobranca e reduzida.
  IF NEW.percentual_desconto_parcelado IS NOT NULL AND
     (NEW.condicao_pagamento IS DISTINCT FROM 'PARCELADO'
      OR NEW.percentual_desconto_parcelado <= 0
      OR NEW.percentual_desconto_parcelado >= 100) THEN
    RAISE EXCEPTION 'Desconto parcelado exige condicao PARCELADO e percentual maior que 0 e menor que 100.' USING ERRCODE='22023';
  END IF;
  v_total := (CASE
    WHEN NEW.condicao_pagamento = 'AVISTA' THEN NEW.valor_vista
    WHEN NEW.condicao_pagamento = 'PARCELADO'
         AND NEW.percentual_desconto_parcelado IS NOT NULL
      THEN ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)
    ELSE v_financeiro END)::numeric(14,2);
  IF v_financeiro > 0 AND v_total <= 0 THEN
    RAISE EXCEPTION 'Desconto invalido: o valor financeiro resultante deve ser positivo.' USING ERRCODE='22023';
  END IF;$novo_calculo$;
BEGIN
  -- Nao cria colunas e nao toca dados existentes.
  IF to_regclass('public.contratos') IS NULL
     OR to_regclass('public.financeiro_contas_receber') IS NULL
     OR to_regclass('public.financeiro_recebimentos') IS NULL
     OR to_regclass('public.financeiro_conciliacao_legado') IS NULL THEN
    RAISE EXCEPTION 'Tabelas financeiras ausentes. Instalacao cancelada.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contratos'
      AND column_name = 'percentual_desconto_parcelado'
  ) THEN
    RAISE EXCEPTION 'Coluna percentual_desconto_parcelado ausente. Instale as cinco colunas antes.';
  END IF;
  IF to_regprocedure('public.destac_sincronizar_financeiro_contrato()') IS NULL THEN
    RAISE EXCEPTION 'Funcao financeira nao localizada. Instalacao cancelada.';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.destac_sincronizar_financeiro_contrato()'))
    INTO v_atual;
  -- Compatibilidade com resultados copiados do SQL Editor no Windows.
  v_atual := replace(v_atual, E'\r\n', E'\n');

  -- Se a migracao ja tiver sido aplicada integralmente, nao faz nada.
  IF position('NEW.percentual_desconto_parcelado' IN v_atual) > 0
     AND position('OLD.percentual_desconto_parcelado' IN v_atual) > 0
     AND position('ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)' IN v_atual) > 0 THEN
    RAISE NOTICE 'JA ATUALIZADA: funcao possui desconto parcelado e controle de alteracoes.';
    RETURN;
  END IF;

  -- Falha segura se algum outro script alterou a funcao desde o diagnostico.
  IF position('percentual_desconto_parcelado' IN v_atual) > 0 THEN
    RAISE EXCEPTION 'Funcao possui implementacao parcial/divergente; nenhuma alteracao realizada.';
  END IF;

  IF ((length(v_atual) - length(replace(v_atual, v_antigo_new, ''))) / length(v_antigo_new)) <> 1
     OR ((length(v_atual) - length(replace(v_atual, v_antigo_old, ''))) / length(v_antigo_old)) <> 1
     OR ((length(v_atual) - length(replace(v_atual, v_calculo_anterior, ''))) / length(v_calculo_anterior)) <> 1 THEN
    RAISE EXCEPTION 'Trechos da funcao nao correspondem ao codigo recebido. Nenhuma alteracao realizada.';
  END IF;

  -- Nao remove as protecoes ja instaladas.
  IF position('financeiro_conciliacao_legado' IN v_atual) = 0
     OR position('financeiro_recebimentos' IN v_atual) = 0
     OR position('v_qtd_travadas' IN v_atual) = 0
     OR position('SECURITY DEFINER' IN v_atual) = 0
     OR position('NEW.modalidade_contrato' IN v_atual) = 0 THEN
    RAISE EXCEPTION 'Funcao sem protecoes financeiras esperadas. Nenhuma alteracao realizada.';
  END IF;

  v_nova := replace(v_atual, v_antigo_new, v_novo_new);
  v_nova := replace(v_nova, v_antigo_old, v_novo_old);
  v_nova := replace(v_nova, v_calculo_anterior, v_calculo_corrigido);

  IF position('NEW.percentual_desconto_parcelado' IN v_nova) = 0
     OR position('OLD.percentual_desconto_parcelado' IN v_nova) = 0
     OR position('ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)' IN v_nova) = 0 THEN
    RAISE EXCEPTION 'Erro na composicao da migracao. Nenhuma alteracao realizada.';
  END IF;

  -- CREATE OR REPLACE preserva a identidade da funcao e seus triggers.
  -- A funcao nao e executada por este script; apenas sua definicao muda.
  EXECUTE v_nova;
  RAISE NOTICE 'ATUALIZADA: desconto parcelado incluído sem alterar dados.';
END;
$destac_ajuste$;

COMMIT;

-- Confirmacao apos a instalacao. Esperado: ATUALIZADO.
SELECT
  CASE
    WHEN position('NEW.percentual_desconto_parcelado' IN definicao) > 0
     AND position('OLD.percentual_desconto_parcelado' IN definicao) > 0
     AND position('ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)' IN definicao) > 0
    THEN 'ATUALIZADO'
    ELSE 'VERIFICAR'
  END AS desconto_parcelado,
  CASE WHEN position('financeiro_conciliacao_legado' IN definicao) > 0
         AND position('financeiro_recebimentos' IN definicao) > 0
         AND position('v_qtd_travadas' IN definicao) > 0
    THEN 'PRESERVADO' ELSE 'VERIFICAR' END AS protecoes_recebimentos_e_conciliacao
FROM (
  SELECT pg_get_functiondef(
    to_regprocedure('public.destac_sincronizar_financeiro_contrato()')
  ) AS definicao
) f;
