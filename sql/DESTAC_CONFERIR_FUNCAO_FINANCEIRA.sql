-- DESTAC PROPAGANDAS | Etapa 2: auditar funcao instalada (SOMENTE LEITURA)
-- Nao substitui funcao, nao modifica contratos, nao gera parcelas.
-- Marcadores de codigo sao indicios, nao teste funcional da integracao.
WITH fonte AS (
  SELECT lower(COALESCE(pg_get_functiondef(
    to_regprocedure('public.destac_sincronizar_financeiro_contrato()')
  ), '')) AS codigo
)
SELECT
  CASE WHEN codigo <> '' THEN 'INSTALADA' ELSE 'AUSENTE' END AS funcao,
  CASE WHEN codigo LIKE '%percentual_desconto_parcelado%' THEN 'LOCALIZADO' ELSE 'NAO LOCALIZADO' END AS desconto_parcelado,
  CASE WHEN codigo LIKE '%valor_vista%' THEN 'LOCALIZADO' ELSE 'NAO LOCALIZADO' END AS desconto_vista,
  CASE WHEN codigo LIKE '%valor_permuta%' AND codigo LIKE '%valor_financeiro%' THEN 'LOCALIZADO' ELSE 'NAO LOCALIZADO' END AS permuta_financeiro,
  CASE WHEN codigo LIKE '%financeiro_conciliacao_legado%' THEN 'LOCALIZADO' ELSE 'NAO LOCALIZADO' END AS conciliacao_legado,
  CASE WHEN codigo LIKE '%ativo%' THEN 'LOCALIZADO' ELSE 'NAO LOCALIZADO' END AS status_ativo,
  CASE WHEN codigo LIKE '%financeiro_recebimentos%' THEN 'LOCALIZADO' ELSE 'NAO LOCALIZADO' END AS protecao_recebimentos
FROM fonte;
