-- DESTAC | Auditoria principal V1. Execute no SQL Editor do Supabase.
-- Eventos de banco: autoria confirmada pelo contexto de autenticação da transação.
-- Valores antigos/novos NÃO são salvos, apenas identificadores técnicos de registros.
BEGIN;
CREATE TABLE IF NOT EXISTS public.destac_logs (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 criado_em timestamptz NOT NULL DEFAULT clock_timestamp(),
 usuario_id uuid,
 evento text NOT NULL,
 modulo text NOT NULL,
 tabela text,
 registro_id text,
 origem text NOT NULL DEFAULT 'banco',
 detalhes jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS destac_logs_data_idx ON public.destac_logs(criado_em DESC);
CREATE INDEX IF NOT EXISTS destac_logs_usuario_idx ON public.destac_logs(usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS destac_logs_modulo_idx ON public.destac_logs(modulo, criado_em DESC);
ALTER TABLE public.destac_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.destac_logs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.destac_logs TO authenticated;
-- Somente superusuário ativo consulta logs (independe de permissões editáveis).
DROP POLICY IF EXISTS destac_logs_super_ler ON public.destac_logs;
CREATE POLICY destac_logs_super_ler ON public.destac_logs FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.perfis_usuario p WHERE p.user_id=(select auth.uid()) AND p.ativo=true AND p.perfil='SUPER_USUARIO'));
-- O trigger deve funcionar ainda quando não existe política de insert na tabela de logs.
CREATE OR REPLACE FUNCTION public.destac_registrar_alteracao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
DECLARE chave text; dado jsonb; modulo_nome text;
BEGIN
 dado := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 chave := coalesce(dado->>'id',dado->>'user_id',dado->>'contrato_id',dado->>'cliente_id',dado->>'numero_contrato',dado->>'codigo','[sem identificador]');
 modulo_nome := CASE WHEN TG_TABLE_NAME LIKE 'financeiro_%' THEN 'financeiro'
  WHEN TG_TABLE_NAME='destac_permissoes' THEN 'permissoes'
  WHEN TG_TABLE_NAME='perfis_usuario' THEN 'usuarios'
  ELSE TG_TABLE_NAME END;
 INSERT INTO public.destac_logs(usuario_id,evento,modulo,tabela,registro_id,origem,detalhes)
 VALUES(auth.uid(),TG_OP,modulo_nome,TG_TABLE_NAME,left(chave,200),'banco',
 jsonb_build_object('acao',TG_OP));
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $fn$;
REVOKE ALL ON FUNCTION public.destac_registrar_alteracao() FROM PUBLIC,anon,authenticated;
-- Cria gatilhos apenas nas tabelas já existentes, sem exigir alterações em suas estruturas.
DO $block$
DECLARE nome text;
BEGIN
 FOREACH nome IN ARRAY ARRAY['clientes','empresas','contratos','perfis_usuario','destac_permissoes',
 'financeiro_contas_receber','financeiro_recebimentos','financeiro_contas_pagar','financeiro_conciliacao_legado'] LOOP
  IF to_regclass('public.'||nome) IS NOT NULL THEN
   EXECUTE format('DROP TRIGGER IF EXISTS destac_log_principal ON public.%I',nome);
   EXECUTE format('CREATE TRIGGER destac_log_principal AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.destac_registrar_alteracao()',nome);
  END IF;
 END LOOP;
END $block$;
-- Eventos de interface não devem permitir que um usuário finja ser outro usuário.
CREATE OR REPLACE FUNCTION public.destac_registrar_evento(p_evento text,p_modulo text,p_detalhes jsonb DEFAULT '{}'::jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $fn$
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
 IF p_evento NOT IN ('LOGIN','LOGOUT','ACESSO_NEGADO') THEN RAISE EXCEPTION 'Evento inválido'; END IF;
 IF length(coalesce(p_modulo,'')) NOT BETWEEN 1 AND 60 THEN RAISE EXCEPTION 'Módulo inválido'; END IF;
 INSERT INTO public.destac_logs(usuario_id,evento,modulo,origem,detalhes)
 VALUES(auth.uid(),p_evento,p_modulo,'interface',
 jsonb_build_object('pagina',left(coalesce(p_detalhes->>'pagina',''),150)));
END $fn$;
REVOKE ALL ON FUNCTION public.destac_registrar_evento(text,text,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.destac_registrar_evento(text,text,jsonb) TO authenticated;
COMMIT;
-- TESTES APÓS EXECUTAR:
-- SELECT tabela, COUNT(*) FROM public.destac_logs GROUP BY tabela ORDER BY tabela;
-- SELECT tgrelid::regclass, tgname FROM pg_trigger WHERE tgname='destac_log_principal';
