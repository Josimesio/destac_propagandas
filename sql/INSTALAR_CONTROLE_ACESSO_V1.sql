-- DESTAC | Controle de acesso hierárquico V1
-- Execute com a conta administrativa no SQL Editor. Não altera dados existentes.
-- Pré-requisitos: public.perfis_usuario (user_id uuid, perfil text, ativo boolean).
BEGIN;
CREATE TABLE IF NOT EXISTS public.destac_permissoes (
 user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
 modulo text NOT NULL CHECK (modulo IN ('admin','empresas','clientes','contratos','financeiro','conciliacao_contratos','consultar_cnpj','buscar_cep','usuarios')),
 acao text NOT NULL CHECK (acao IN ('visualizar','criar','editar','excluir','exportar')),
 permitido boolean NOT NULL DEFAULT false,
 atualizado_por uuid REFERENCES auth.users(id),
 atualizado_em timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(user_id,modulo,acao)
);
ALTER TABLE public.destac_permissoes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.destac_permissoes FROM anon, authenticated;
GRANT SELECT ON public.destac_permissoes TO authenticated;
DROP POLICY IF EXISTS destac_permissoes_ler_proprias ON public.destac_permissoes;
CREATE POLICY destac_permissoes_ler_proprias ON public.destac_permissoes FOR SELECT TO authenticated
USING (user_id = (select auth.uid()));

-- Retorna false se não houver concessão; superusuário ativo possui acesso total.
CREATE OR REPLACE FUNCTION public.destac_tem_permissao(p_modulo text,p_acao text DEFAULT 'visualizar')
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil text; v_ativo boolean;
BEGIN
 SELECT perfil, ativo INTO v_perfil,v_ativo FROM public.perfis_usuario WHERE user_id=auth.uid() LIMIT 1;
 IF NOT FOUND OR v_ativo IS DISTINCT FROM true THEN RETURN false; END IF;
 IF v_perfil='SUPER_USUARIO' THEN RETURN true; END IF;
 RETURN EXISTS(SELECT 1 FROM public.destac_permissoes WHERE user_id=auth.uid() AND modulo=p_modulo AND acao=p_acao AND permitido=true);
END $$;
REVOKE ALL ON FUNCTION public.destac_tem_permissao(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destac_tem_permissao(text,text) TO authenticated;

-- Lista usuários que um gestor tem permissão para administrar.
-- Admin só enxerga usuários comuns; super vê todos.
CREATE OR REPLACE FUNCTION public.destac_usuarios_gerenciaveis()
RETURNS TABLE(user_id uuid,nome text,email text,perfil text,ativo boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_perfil text;
BEGIN
 SELECT p.perfil INTO v_perfil FROM public.perfis_usuario p WHERE p.user_id=auth.uid() AND p.ativo=true;
 IF v_perfil='SUPER_USUARIO' THEN
  RETURN QUERY SELECT p.user_id,p.nome::text,p.email::text,p.perfil::text,p.ativo FROM public.perfis_usuario p ORDER BY p.nome;
 ELSIF v_perfil='ADMINISTRADOR' AND public.destac_tem_permissao('usuarios','visualizar') THEN
  RETURN QUERY SELECT p.user_id,p.nome::text,p.email::text,p.perfil::text,p.ativo FROM public.perfis_usuario p WHERE p.perfil='USUARIO' ORDER BY p.nome;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.destac_usuarios_gerenciaveis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destac_usuarios_gerenciaveis() TO authenticated;

-- Visualização da matriz por usuário. Não permite ver permissões de superior.
CREATE OR REPLACE FUNCTION public.destac_consultar_permissoes(p_user_id uuid)
RETURNS TABLE(modulo text,acao text,permitido boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_gestor text; v_alvo text;
BEGIN
 SELECT perfil INTO v_gestor FROM public.perfis_usuario WHERE user_id=auth.uid() AND ativo=true;
 SELECT perfil INTO v_alvo FROM public.perfis_usuario WHERE user_id=p_user_id AND ativo=true;
 IF v_gestor='SUPER_USUARIO' OR (v_gestor='ADMINISTRADOR' AND v_alvo='USUARIO' AND public.destac_tem_permissao('usuarios','visualizar')) THEN
  RETURN QUERY SELECT d.modulo,d.acao,d.permitido FROM public.destac_permissoes d WHERE d.user_id=p_user_id;
 ELSE
  RAISE EXCEPTION 'Acesso negado';
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.destac_consultar_permissoes(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destac_consultar_permissoes(uuid) TO authenticated;

-- Salva cada permissão, sempre respeitando a hierarquia.
CREATE OR REPLACE FUNCTION public.destac_definir_permissao(p_user_id uuid,p_modulo text,p_acao text,p_permitido boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_gestor text; v_alvo text; v_ativo boolean;
BEGIN
 SELECT perfil,ativo INTO v_gestor,v_ativo FROM public.perfis_usuario WHERE user_id=auth.uid();
 IF v_ativo IS DISTINCT FROM true THEN RAISE EXCEPTION 'Gestor inativo'; END IF;
 SELECT perfil INTO v_alvo FROM public.perfis_usuario WHERE user_id=p_user_id;
 IF v_alvo IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
 IF p_modulo NOT IN ('admin','empresas','clientes','contratos','financeiro','conciliacao_contratos','consultar_cnpj','buscar_cep','usuarios') OR p_acao NOT IN ('visualizar','criar','editar','excluir','exportar') THEN RAISE EXCEPTION 'Permissão inválida'; END IF;
 IF p_user_id=auth.uid() OR v_alvo='SUPER_USUARIO' THEN RAISE EXCEPTION 'Não é permitido alterar as próprias permissões ou as do superusuário'; END IF;
 IF NOT (v_gestor='SUPER_USUARIO' AND v_alvo IN ('ADMINISTRADOR','USUARIO') OR v_gestor='ADMINISTRADOR' AND v_alvo='USUARIO' AND public.destac_tem_permissao('usuarios','editar')) THEN RAISE EXCEPTION 'Hierarquia não permite esta alteração'; END IF;
 IF p_permitido=true AND v_gestor='ADMINISTRADOR' AND NOT public.destac_tem_permissao(p_modulo,p_acao) THEN RAISE EXCEPTION 'Não pode conceder uma permissão que não possui'; END IF;
 IF p_permitido=true AND p_acao <> 'visualizar' AND v_gestor='ADMINISTRADOR' AND NOT public.destac_tem_permissao(p_modulo,'visualizar') THEN RAISE EXCEPTION 'A visualização do módulo deve ser autorizada'; END IF;
 INSERT INTO public.destac_permissoes(user_id,modulo,acao,permitido,atualizado_por,atualizado_em)
 VALUES(p_user_id,p_modulo,p_acao,p_permitido,auth.uid(),now())
 ON CONFLICT(user_id,modulo,acao) DO UPDATE SET permitido=EXCLUDED.permitido,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now();
END $$;
REVOKE ALL ON FUNCTION public.destac_definir_permissao(uuid,text,text,boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destac_definir_permissao(uuid,text,text,boolean) TO authenticated;
COMMIT;
