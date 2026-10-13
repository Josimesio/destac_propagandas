-- DESTAC PROPAGANDAS — DIAGNOSTICO PRE-INSTALACAO
-- APENAS LEITURA (SELECT): nao cria tabelas, nao muda contratos e nao gera parcelas.
-- Execute no SQL Editor do projeto Supabase da DESTAC PROPAGANDAS.
-- Na aba Results, copie todas as linhas e envie ao ChatGPT.

WITH itens AS (
  SELECT 'TABELA'::text AS categoria, 'contratos'::text AS objeto,
         to_regclass('public.contratos') IS NOT NULL AS instalado
  UNION ALL SELECT 'TABELA', 'financeiro_contas_receber', to_regclass('public.financeiro_contas_receber') IS NOT NULL
  UNION ALL SELECT 'TABELA', 'financeiro_recebimentos', to_regclass('public.financeiro_recebimentos') IS NOT NULL
  UNION ALL SELECT 'TABELA', 'financeiro_conciliacao_legado', to_regclass('public.financeiro_conciliacao_legado') IS NOT NULL
  UNION ALL SELECT 'FUNCAO', 'destac_sincronizar_financeiro_contrato',
    to_regprocedure('public.destac_sincronizar_financeiro_contrato()') IS NOT NULL
  UNION ALL SELECT 'TRIGGER', 'destac_financeiro_apos_insert_contrato',
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname='contratos'
              AND t.tgname='destac_financeiro_apos_insert_contrato'
              AND t.tgenabled <> 'D' AND NOT t.tgisinternal)
  UNION ALL SELECT 'TRIGGER', 'destac_financeiro_apos_update_contrato',
    EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
             JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname='public' AND c.relname='contratos'
              AND t.tgname='destac_financeiro_apos_update_contrato'
              AND t.tgenabled <> 'D' AND NOT t.tgisinternal)
  UNION ALL
  SELECT 'COLUNA' AS categoria, ('contratos.' || col.nome) AS objeto,
      EXISTS (SELECT 1 FROM information_schema.columns x
              WHERE x.table_schema='public' AND x.table_name='contratos'
                AND x.column_name=col.nome) AS instalado
  FROM (VALUES
    ('assinante_empresa'),
    ('condicao_pagamento'),
    ('data_vencimento_entrada'),
    ('periodicidade_parcelas'),
    ('modalidade_contrato'),
    ('valor_financeiro'),
    ('valor_permuta'),
    ('descricao_permuta'),
    ('percentual_desconto_vista'),
    ('percentual_desconto_parcelado'),
    ('percentual_permuta'),
    ('valor_unitario_insercao'),
    ('insercoes_mensais')
  ) AS col(nome)
)
SELECT categoria, objeto,
       CASE WHEN instalado THEN 'INSTALADO' ELSE 'FALTANDO' END AS situacao
FROM itens
ORDER BY CASE categoria WHEN 'TABELA' THEN 1 WHEN 'FUNCAO' THEN 2
                         WHEN 'TRIGGER' THEN 3 ELSE 4 END, objeto;
