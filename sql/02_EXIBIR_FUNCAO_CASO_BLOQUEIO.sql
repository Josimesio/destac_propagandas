-- SOMENTE LEITURA. Execute APENAS se o patch 01 abortar com
-- 'Versao da funcao diferente da base esperada' ou 'referencias parciais'.
-- Copie e encaminhe o retorno (coluna definicao_funcao) para adaptar a migracao
-- a funcao efetivamente instalada. Nao modifica a base.
SELECT pg_get_functiondef(
  to_regprocedure('public.destac_sincronizar_financeiro_contrato()')
) AS definicao_funcao;
