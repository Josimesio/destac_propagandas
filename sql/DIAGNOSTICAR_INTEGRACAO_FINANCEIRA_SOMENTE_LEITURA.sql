-- DESTAC PROPAGANDAS — diagnóstico não destrutivo
-- Apenas SELECT: não cria, altera nem gera parcelas.
-- Execute no SQL Editor do projeto Supabase da DESTAC.

-- 1) Infraestrutura mínima e triggers que deveriam executar quando
-- um contrato é salvo ou alterado.
SELECT
  to_regclass('public.contratos') IS NOT NULL AS tabela_contratos_existe,
  to_regclass('public.financeiro_contas_receber') IS NOT NULL AS tabela_contas_receber_existe,
  to_regclass('public.financeiro_conciliacao_legado') IS NOT NULL AS conciliacao_legado_instalada,
  to_regprocedure('public.destac_sincronizar_financeiro_contrato()') IS NOT NULL AS funcao_integracao_existe;

-- 2) Para geração automática é necessário haver os dois triggers
-- habilitados na tabela contratos.
SELECT t.tgname AS gatilho,
       CASE t.tgenabled WHEN 'O' THEN 'HABILITADO'
                        WHEN 'D' THEN 'DESABILITADO'
                        ELSE t.tgenabled::text END AS situacao,
       pg_get_triggerdef(t.oid) AS definicao
FROM pg_trigger t
WHERE t.tgrelid = 'public.contratos'::regclass
  AND NOT t.tgisinternal
  AND t.tgname IN ('destac_financeiro_apos_insert_contrato',
                   'destac_financeiro_apos_update_contrato')
ORDER BY t.tgname;

-- 3) Panorama dos contratos por situação, sem criar movimentações.
SELECT upper(coalesce(status,'SEM STATUS')) AS status,
       count(*) AS quantidade
FROM public.contratos
GROUP BY 1
ORDER BY 1;

-- 4) Quantidade de parcelas já gravadas por origem.
SELECT coalesce(origem, 'NÃO INFORMADA') AS origem,
       count(*) AS parcelas,
       count(DISTINCT contrato_id) AS contratos_vinculados,
       coalesce(sum(valor_original), 0) AS valor_total
FROM public.financeiro_contas_receber
GROUP BY 1
ORDER BY 1;

-- 5) Exemplos de contratos ativos ainda SEM parcelas vinculadas.
-- Contratos antigos não devem ser automaticamente cobrados antes da conciliação.
SELECT c.id, c.numero_contrato, c.empresa_id, c.cliente_id, c.status
FROM public.contratos c
WHERE upper(trim(coalesce(c.status,''))) = 'ATIVO'
  AND NOT EXISTS (
    SELECT 1
    FROM public.financeiro_contas_receber r
    WHERE r.contrato_id = c.id AND r.origem = 'CONTRATO'
  )
ORDER BY c.id DESC
LIMIT 30;
