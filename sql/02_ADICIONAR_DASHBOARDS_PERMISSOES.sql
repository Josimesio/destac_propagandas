-- Execute uma única vez no SQL Editor do Supabase.
-- Mantém os registros e permissões já existentes.
BEGIN;
ALTER TABLE public.destac_permissoes DROP CONSTRAINT IF EXISTS destac_permissoes_modulo_check;
ALTER TABLE public.destac_permissoes ADD CONSTRAINT destac_permissoes_modulo_check
 CHECK (modulo IN ('admin','empresas','clientes','contratos','dashboard_contratos','financeiro','conciliacao_contratos','consultar_cnpj','buscar_cep','usuarios'));
COMMIT;
