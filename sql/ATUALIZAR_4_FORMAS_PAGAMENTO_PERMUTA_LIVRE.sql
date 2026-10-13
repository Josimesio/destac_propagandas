-- DESTAC PROPAGANDAS | quatro formas de pagamento e permuta em valor livre
-- PRÉ-REQUISITO: instalar INSTALAR_MODALIDADE_MISTA_PERMUTA_FINANCEIRO.sql
-- e INSTALAR_AVISTA_DESCONTO_PERMUTA_50_50.sql da versão anterior.
-- NÃO executa geração retroativa nem altera contratos cadastrados.
BEGIN;
DO $regras$
BEGIN
  IF to_regclass('public.contratos') IS NULL THEN
    RAISE EXCEPTION 'Tabela public.contratos não encontrada';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema='public' AND table_name='contratos' AND column_name='valor_financeiro') THEN
    RAISE EXCEPTION 'Instale primeiro a migração de contrato misto';
  END IF;
END $regras$;
ALTER TABLE public.contratos
  DROP CONSTRAINT IF EXISTS contratos_percentual_permuta_regras_check;
-- Permite qualquer valor de permuta em contrato misto. Percentual de permuta
-- permanece apenas informativo (arredondado a duas casas), nunca limita a divisão.
ALTER TABLE public.contratos
  ADD CONSTRAINT contratos_percentual_permuta_regras_check CHECK (
    percentual_permuta IS NULL OR
    (percentual_permuta = 0 AND modalidade_contrato = 'FINANCEIRO' AND COALESCE(valor_permuta,0)=0) OR
    (percentual_permuta = 100 AND modalidade_contrato = 'PERMUTA' AND COALESCE(valor_financeiro,0)=0) OR
    (modalidade_contrato = 'MISTO' AND percentual_permuta > 0 AND percentual_permuta < 100
      AND valor_permuta > 0 AND valor_financeiro > 0
      AND valor_total_contrato = valor_permuta + valor_financeiro)
  );
COMMENT ON COLUMN public.contratos.percentual_permuta IS
  'Percentual informativo: contrato misto aceita valor combinado livre de permuta. O Financeiro cobra apenas valor_financeiro.';
COMMIT;
