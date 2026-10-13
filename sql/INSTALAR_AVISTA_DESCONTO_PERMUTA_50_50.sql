-- DESTAC PROPAGANDAS — À VISTA (%) / PERMUTA 100% / MISTO 50-50
-- Executar depois de INSTALAR_MODALIDADE_MISTA_PERMUTA_FINANCEIRO.sql.
-- Não gera parcelas retroativas, não altera cobranças antigas.
-- CONTRATOS LEGADOS: percentuais NULL, sem recálculo automático.
BEGIN;
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS percentual_desconto_vista numeric(5,2),
  ADD COLUMN IF NOT EXISTS percentual_permuta numeric(5,2);
DO $checks$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.contratos'::regclass
    AND conname='contratos_percentual_desconto_vista_check') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_percentual_desconto_vista_check CHECK
      (percentual_desconto_vista IS NULL OR percentual_desconto_vista BETWEEN 0 AND 99.99);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.contratos'::regclass
    AND conname='contratos_percentual_permuta_regras_check') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_percentual_permuta_regras_check CHECK
      (percentual_permuta IS NULL OR
       (percentual_permuta=0 AND modalidade_contrato='FINANCEIRO' AND coalesce(valor_permuta,0)=0) OR
       (percentual_permuta=100 AND modalidade_contrato='PERMUTA' AND coalesce(valor_financeiro,0)=0) OR
       (percentual_permuta=50 AND modalidade_contrato='MISTO'
        AND valor_total_contrato IS NOT NULL
        AND valor_permuta = floor(round(valor_total_contrato * 100, 0)/2)/100
        AND valor_financeiro = valor_total_contrato - valor_permuta));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='public.contratos'::regclass
    AND conname='contratos_desconto_valor_vista_check') THEN
    ALTER TABLE public.contratos ADD CONSTRAINT contratos_desconto_valor_vista_check CHECK
      (percentual_desconto_vista IS NULL OR
       (condicao_pagamento='AVISTA' AND valor_financeiro IS NOT NULL
        AND valor_vista IS NOT NULL
        AND valor_vista = round(round(valor_financeiro*100,0) * (100-percentual_desconto_vista)/100,0)/100));
  END IF;
END;
$checks$;
COMMENT ON COLUMN public.contratos.percentual_desconto_vista IS
 'Percentual digitado para desconto financeiro à vista. NULL em contratos legados.';
COMMENT ON COLUMN public.contratos.percentual_permuta IS
 '0 financeiro, 100 permuta ou 50 para contratos mistos com divisão automática. NULL em contratos antigos.';
COMMIT;
