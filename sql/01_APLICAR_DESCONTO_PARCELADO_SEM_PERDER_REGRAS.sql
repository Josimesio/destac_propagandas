-- DESTAC PROPAGANDAS | Ajuste cirurgico da funcao financeira | 13/10/2026
-- Problema detectado: desconto_parcelado = NAO LOCALIZADO na funcao instalada.
-- Esta migracao altera SOMENTE A DEFINICAO DA FUNCAO, sem modificar contratos,
-- parcelas, recebimentos, conciliações, triggers ou permissões existentes.
-- Os campos novos devem ter sido instalados antes (Etapa 1: cinco colunas).
-- IMPORTANTE: faca backup da base antes de executar.
-- Em caso de versao desconhecida da funcao, o script PARA COM ERRO e faz ROLLBACK.

BEGIN;

DO $destac_patch$
DECLARE
  v_ddl text;
  v_novo text;
  v_antigo_novo text :=
    'NEW.modalidade_contrato, NEW.valor_financeiro, NEW.valor_permuta, NEW.descricao_permuta)';
  v_novo_novo text :=
    'NEW.modalidade_contrato, NEW.valor_financeiro, NEW.valor_permuta, NEW.descricao_permuta, NEW.percentual_desconto_parcelado)';
  v_antigo_old text :=
    'OLD.modalidade_contrato, OLD.valor_financeiro, OLD.valor_permuta, OLD.descricao_permuta)';
  v_novo_old text :=
    'OLD.modalidade_contrato, OLD.valor_financeiro, OLD.valor_permuta, OLD.descricao_permuta, OLD.percentual_desconto_parcelado)';
  v_padrao_calculo text := $regex$
    v_total[[:space:]]*:=[[:space:]]*\(CASE[[:space:]]+WHEN[[:space:]]+NEW\.condicao_pagamento[[:space:]]*=[[:space:]]*'AVISTA'[[:space:]]+THEN[[:space:]]+NEW\.valor_vista[[:space:]]+ELSE[[:space:]]+v_financeiro[[:space:]]+END\)::numeric\(14,2\);
  $regex$;
  v_novo_calculo text := $calculo$
  -- Desconto no parcelamento reduz SOMENTE o valor financeiro.
  -- Nao altera o valor comercial nem o valor da permuta.
  IF COALESCE(NEW.percentual_desconto_parcelado, 0) > 0
     AND NEW.condicao_pagamento <> 'PARCELADO' THEN
    RAISE EXCEPTION 'Desconto parcelado exige condicao PARCELADO.' USING ERRCODE = '22023';
  END IF;
  v_total := (CASE
    WHEN NEW.condicao_pagamento = 'AVISTA' THEN NEW.valor_vista
    WHEN NEW.condicao_pagamento = 'PARCELADO'
         AND COALESCE(NEW.percentual_desconto_parcelado, 0) > 0
      THEN ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)
    ELSE v_financeiro END)::numeric(14,2);
  IF v_financeiro > 0 AND v_total <= 0 THEN
    RAISE EXCEPTION 'Desconto invalido: valor financeiro nao pode ser zerado.' USING ERRCODE = '22023';
  END IF;
  $calculo$;
BEGIN
  IF to_regclass('public.contratos') IS NULL
     OR to_regclass('public.financeiro_contas_receber') IS NULL
     OR to_regclass('public.financeiro_recebimentos') IS NULL
     OR to_regclass('public.financeiro_conciliacao_legado') IS NULL THEN
    RAISE EXCEPTION 'Faltam tabelas obrigatorias. Nenhuma alteracao realizada.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'contratos'
       AND column_name = 'percentual_desconto_parcelado'
  ) THEN
    RAISE EXCEPTION 'Falta coluna percentual_desconto_parcelado. Execute primeiro a instalacao das cinco colunas.';
  END IF;

  IF to_regprocedure('public.destac_sincronizar_financeiro_contrato()') IS NULL THEN
    RAISE EXCEPTION 'Funcao de sincronizacao nao encontrada. Nenhuma alteracao realizada.';
  END IF;

  SELECT pg_get_functiondef(to_regprocedure('public.destac_sincronizar_financeiro_contrato()'))
    INTO v_ddl;

  -- Se os tres pontos ja estiverem atualizados, pode executar novamente sem efeito.
  IF position('NEW.percentual_desconto_parcelado' IN v_ddl) > 0
     AND position('OLD.percentual_desconto_parcelado' IN v_ddl) > 0
     AND position('ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)' IN v_ddl) > 0 THEN
    RAISE NOTICE 'Regra de desconto parcelado ja localizada. Nenhuma alteracao realizada.';
    RETURN;
  END IF;

  -- Nao reescrever versoes desconhecidas ou instalacoes parciais.
  IF position('percentual_desconto_parcelado' IN v_ddl) > 0 THEN
    RAISE EXCEPTION 'Funcao contem referencias parciais ao desconto. Envie sua definicao para ajuste manual.';
  END IF;

  IF ((length(v_ddl) - length(replace(v_ddl, v_antigo_novo, ''))) / length(v_antigo_novo)) <> 1
     OR ((length(v_ddl) - length(replace(v_ddl, v_antigo_old, ''))) / length(v_antigo_old)) <> 1
     OR regexp_count(v_ddl, trim(v_padrao_calculo)) <> 1 THEN
    RAISE EXCEPTION 'Versao da funcao diferente da base esperada. Instalacao cancelada SEM ALTERAR DADOS. Envie pg_get_functiondef para adaptar.';
  END IF;

  -- Preserva TODA a versao efetivamente instalada: modifica apenas 3 trechos.
  -- pg_get_functiondef conserva os atributos originais (SECURITY DEFINER,
  -- search_path etc.). CREATE OR REPLACE preserva a identidade/GRANTs e triggers.
  v_novo := replace(v_ddl, v_antigo_novo, v_novo_novo);
  v_novo := replace(v_novo, v_antigo_old, v_novo_old);
  v_novo := regexp_replace(v_novo, trim(v_padrao_calculo), v_novo_calculo);

  IF position('NEW.percentual_desconto_parcelado' IN v_novo) = 0
     OR position('OLD.percentual_desconto_parcelado' IN v_novo) = 0
     OR position('ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)' IN v_novo) = 0 THEN
    RAISE EXCEPTION 'Falha ao construir patch; nenhuma alteracao realizada.';
  END IF;

  EXECUTE v_novo;
  RAISE NOTICE 'Funcao atualizada: desconto parcelado, mantendo a logica financeira existente.';
END;
$destac_patch$;

COMMIT;

-- Auditoria apos instalacao (somente leitura).
WITH codigo AS (
  SELECT lower(coalesce(pg_get_functiondef(
    to_regprocedure('public.destac_sincronizar_financeiro_contrato()')), '')) AS fonte
)
SELECT
  CASE WHEN fonte LIKE '%new.percentual_desconto_parcelado%'
             AND fonte LIKE '%old.percentual_desconto_parcelado%'
             AND fonte LIKE '%round(v_financeiro * (100 - new.percentual_desconto_parcelado) / 100, 2)%'
       THEN 'ATUALIZADO' ELSE 'CONFERIR' END AS desconto_parcelado,
  CASE WHEN fonte LIKE '%valor_vista%' THEN 'PRESERVADO' ELSE 'CONFERIR' END AS desconto_vista,
  CASE WHEN fonte LIKE '%valor_permuta%' AND fonte LIKE '%valor_financeiro%' THEN 'PRESERVADO' ELSE 'CONFERIR' END AS permuta_financeiro,
  CASE WHEN fonte LIKE '%financeiro_conciliacao_legado%' THEN 'PRESERVADO' ELSE 'CONFERIR' END AS conciliacao_legado,
  CASE WHEN fonte LIKE '%financeiro_recebimentos%' THEN 'PRESERVADO' ELSE 'CONFERIR' END AS protecao_recebimentos
FROM codigo;
