-- Execute UMA VEZ no SQL Editor do Supabase do sistema DESTAC_PROPAGANDAS.
-- Alteração aditiva: não modifica valores existentes, contratos ou políticas RLS.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS assinante_empresa TEXT;

COMMENT ON COLUMN public.contratos.assinante_empresa
  IS 'Nome do representante que assina pela empresa contratante. Se nulo, a aplicação usa Celso Dondoni para a DESTAC.';
