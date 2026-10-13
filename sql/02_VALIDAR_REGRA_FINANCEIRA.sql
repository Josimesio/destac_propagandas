-- DESTAC PROPAGANDAS - Validacao SOMENTE LEITURA.
-- Nenhum INSERT, UPDATE, DELETE ou alteracao de dados.
SELECT
  CASE WHEN position('NEW.percentual_desconto_parcelado' IN ddl) > 0
       AND position('OLD.percentual_desconto_parcelado' IN ddl) > 0
       AND position('ROUND(v_financeiro * (100 - NEW.percentual_desconto_parcelado) / 100, 2)' IN ddl) > 0
       THEN 'ATUALIZADO' ELSE 'NAO LOCALIZADO' END AS desconto_parcelado,
  CASE WHEN position('NEW.valor_vista' IN ddl) > 0 THEN 'PRESERVADO' ELSE 'VERIFICAR' END AS avista,
  CASE WHEN position('NEW.valor_permuta' IN ddl) > 0 THEN 'PRESERVADO' ELSE 'VERIFICAR' END AS permuta,
  CASE WHEN position('financeiro_conciliacao_legado' IN ddl) > 0 THEN 'PRESERVADO' ELSE 'VERIFICAR' END AS conciliacao_legado,
  CASE WHEN position('NEW.status' IN ddl) > 0 AND position('ATIVO' IN ddl) > 0
       THEN 'PRESERVADO' ELSE 'VERIFICAR' END AS somente_ativo,
  CASE WHEN position('v_qtd_travadas' IN ddl) > 0
       AND position('financeiro_recebimentos' IN ddl) > 0 THEN 'PRESERVADO' ELSE 'VERIFICAR' END AS protecao_recebimentos
FROM (
  SELECT pg_get_functiondef(to_regprocedure('public.destac_sincronizar_financeiro_contrato()')) AS ddl
) f;

-- Exemplos MATEMATICOS (nao geram parcelas no banco).
SELECT
  11520.00::numeric(14,2) AS valor_financeiro_original,
  10.00::numeric(5,2) AS percentual_desconto,
  ROUND(11520.00::numeric * (100 - 10.00::numeric)/100, 2) AS total_com_desconto,
  6 AS quantidade_parcelas,
  ROUND((11520.00::numeric * (100 - 10.00::numeric)/100) / 6, 2) AS valor_parcela;
