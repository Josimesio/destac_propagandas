-- DESTAC PROPAGANDAS | Etapa 1: completar os cinco campos ausentes
-- Gerado a partir do diagnostico enviado em 13/10/2026.
-- Seguro para repetir: nao exclui dados, nao atualiza contratos,
-- nao cria parcelas e NAO substitui funcoes ou triggers.
-- FACA BACKUP do projeto Supabase DESTAC antes de executar.

BEGIN;

DO $pre$
BEGIN
  IF to_regclass('public.contratos') IS NULL THEN
    RAISE EXCEPTION 'A tabela public.contratos nao existe. Instalacao interrompida.';
  END IF;
END;
$pre$;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS insercoes_mensais integer,
  ADD COLUMN IF NOT EXISTS valor_unitario_insercao numeric(14,2),
  ADD COLUMN IF NOT EXISTS percentual_desconto_vista numeric(5,2),
  ADD COLUMN IF NOT EXISTS percentual_desconto_parcelado numeric(5,2),
  ADD COLUMN IF NOT EXISTS percentual_permuta numeric(5,2);

-- As verificacoes abaixo aceitam NULL para preservar contratos antigos.
DO $checks$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contratos'::regclass
      AND conname = 'contratos_precificacao_insercoes_check'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_precificacao_insercoes_check CHECK (
        (valor_unitario_insercao IS NULL AND insercoes_mensais IS NULL)
        OR (
          valor_unitario_insercao > 0
          AND insercoes_mensais BETWEEN 1 AND 100000
          AND valor_mensal = ROUND(valor_unitario_insercao * insercoes_mensais, 2)
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contratos'::regclass
      AND conname = 'contratos_percentual_desconto_vista_check'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_percentual_desconto_vista_check CHECK (
        percentual_desconto_vista IS NULL
        OR percentual_desconto_vista BETWEEN 0 AND 99.99
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contratos'::regclass
      AND conname = 'contratos_percentual_desconto_parcelado_check'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_percentual_desconto_parcelado_check CHECK (
        percentual_desconto_parcelado IS NULL
        OR (
          condicao_pagamento = 'PARCELADO'
          AND percentual_desconto_parcelado > 0
          AND percentual_desconto_parcelado < 100
        )
      );
  END IF;

  -- Contratos mistos podem ter QUALQUER percentual de permuta entre 0 e 100.
  -- O valor financeiro e a permuta permanecem separados.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.contratos'::regclass
      AND conname = 'contratos_percentual_permuta_regras_check'
  ) THEN
    ALTER TABLE public.contratos
      ADD CONSTRAINT contratos_percentual_permuta_regras_check CHECK (
        percentual_permuta IS NULL
        OR (percentual_permuta = 0 AND modalidade_contrato = 'FINANCEIRO'
            AND COALESCE(valor_permuta,0) = 0)
        OR (percentual_permuta = 100 AND modalidade_contrato = 'PERMUTA'
            AND COALESCE(valor_financeiro,0) = 0)
        OR (percentual_permuta > 0 AND percentual_permuta < 100
            AND modalidade_contrato = 'MISTO'
            AND valor_permuta > 0 AND valor_financeiro > 0
            AND valor_total_contrato = valor_permuta + valor_financeiro)
      );
  END IF;
END;
$checks$;

COMMENT ON COLUMN public.contratos.insercoes_mensais IS
  'Quantidade total de insercoes por mes, usada para precificacao comercial.';
COMMENT ON COLUMN public.contratos.valor_unitario_insercao IS
  'Valor unitario de uma insercao em reais.';
COMMENT ON COLUMN public.contratos.percentual_desconto_vista IS
  'Percentual de desconto negociado para pagamento a vista.';
COMMENT ON COLUMN public.contratos.percentual_desconto_parcelado IS
  'Desconto percentual da parte financeira no pagamento parcelado.';
COMMENT ON COLUMN public.contratos.percentual_permuta IS
  'Percentual do valor comercial atendido por permuta; a cobranca considera somente a parte financeira.';

COMMIT;

-- Comprovacao da estrutura criada (apenas leitura).
SELECT v.coluna,
       CASE WHEN EXISTS (
         SELECT 1 FROM information_schema.columns c
         WHERE c.table_schema = 'public' AND c.table_name = 'contratos'
           AND c.column_name = v.coluna
       ) THEN 'INSTALADO' ELSE 'FALTANDO' END AS situacao
FROM (VALUES
  ('insercoes_mensais'),
  ('valor_unitario_insercao'),
  ('percentual_desconto_vista'),
  ('percentual_desconto_parcelado'),
  ('percentual_permuta')
) v(coluna)
ORDER BY v.coluna;
