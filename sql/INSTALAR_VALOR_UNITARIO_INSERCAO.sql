-- DESTAC PROPAGANDAS — preço unitário e quantidade mensal de inserções
-- Executar no Supabase SQL Editor ANTES de publicar os novos fontes.
-- Não recalcula contratos antigos e não altera parcelas existentes.
BEGIN;
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS valor_unitario_insercao numeric(14,2),
  ADD COLUMN IF NOT EXISTS insercoes_mensais integer;
DO $do$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.contratos'::regclass
    AND conname='contratos_precificacao_insercoes_check') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_precificacao_insercoes_check CHECK (
      (valor_unitario_insercao IS NULL AND insercoes_mensais IS NULL)
      OR (valor_unitario_insercao > 0 AND insercoes_mensais BETWEEN 1 AND 100000
          AND valor_mensal = ROUND(valor_unitario_insercao * insercoes_mensais, 2))
    );
  END IF;
END;
$do$;
COMMENT ON COLUMN public.contratos.valor_unitario_insercao IS
  'Valor unitário de uma inserção; não disponível nos contratos legados.';
COMMENT ON COLUMN public.contratos.insercoes_mensais IS
  'Quantidade mensal contratada, sugerida pela tela para 4 semanas e ajustável pelo usuário.';
COMMIT;
