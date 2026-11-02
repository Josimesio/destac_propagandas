-- DESTAC Analytics V2: executar APÓS INSTALAR_LOGS_PRINCIPAIS_V1.sql
-- Transação única. Não altera dados dos contratos/clientes/financeiro.
BEGIN;
ALTER TABLE public.destac_permissoes DROP CONSTRAINT IF EXISTS destac_permissoes_modulo_check;
ALTER TABLE public.destac_permissoes ADD CONSTRAINT destac_permissoes_modulo_check
CHECK (modulo IN ('admin','empresas','clientes','contratos','dashboard_contratos','analytics','financeiro','conciliacao_contratos','consultar_cnpj','buscar_cep','usuarios'));

-- Somente informações comerciais pré-selecionadas entram no log; não registrar áudio, texto de propaganda, documentos, tokens etc.
CREATE OR REPLACE FUNCTION public.destac_resumo_comercial(p_tabela text, p_dado jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $fn$
BEGIN
 IF p_dado IS NULL THEN RETURN NULL; END IF;
 IF p_tabela='contratos' THEN
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'numero_contrato',p_dado->>'numero_contrato',
    'cliente_id',p_dado->>'cliente_id',
    'empresa_id',p_dado->>'empresa_id',
    'status',p_dado->>'status',
    'data_inicio',p_dado->>'data_inicio',
    'data_termino',coalesce(p_dado->>'data_termino',p_dado->>'data_fim'),
    'prazo_indeterminado',p_dado->>'prazo_indeterminado',
    'meses',coalesce(p_dado->>'meses',p_dado->>'duracao_meses'),
    'insercoes_terca_quinta',p_dado->>'insercoes_terca_quinta',
    'insercoes_sabado_domingo',p_dado->>'insercoes_sabado_domingo',
    'insercoes_mensais',p_dado->>'insercoes_mensais',
    'valor_unitario_insercao',p_dado->>'valor_unitario_insercao',
    'valor_mensal',p_dado->>'valor_mensal',
    'valor_total_contrato',p_dado->>'valor_total_contrato',
    'valor_vista',p_dado->>'valor_vista',
    'valor_financeiro',p_dado->>'valor_financeiro',
    'valor_permuta',p_dado->>'valor_permuta',
    'percentual_permuta',p_dado->>'percentual_permuta',
    'modalidade_contrato',p_dado->>'modalidade_contrato',
    'condicao_pagamento',p_dado->>'condicao_pagamento',
    'percentual_desconto_vista',p_dado->>'percentual_desconto_vista',
    'percentual_desconto_parcelado',p_dado->>'percentual_desconto_parcelado',
    'valor_entrada',p_dado->>'valor_entrada',
    'quantidade_parcelas',coalesce(p_dado->>'quantidade_parcelas',p_dado->>'numero_parcelas'),
    'periodicidade_parcelas',p_dado->>'periodicidade_parcelas',
    'data_vencimento_entrada',p_dado->>'data_vencimento_entrada'
  ));
 ELSIF p_tabela='clientes' THEN
  RETURN jsonb_strip_nulls(jsonb_build_object(
    'codigo',coalesce(p_dado->>'codigo',p_dado->>'codigo_cliente'),
    'nome',coalesce(p_dado->>'nome',p_dado->>'razao_social',p_dado->>'nome_razao_social')
  ));
 ELSIF p_tabela='empresas' THEN
  RETURN jsonb_strip_nulls(jsonb_build_object('nome',coalesce(p_dado->>'nome',p_dado->>'razao_social')));
 ELSE RETURN '{}'::jsonb; END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.destac_resumo_comercial(text,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.destac_registrar_alteracao()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $fn$
DECLARE antes jsonb; depois jsonb; chave text; modulo_nome text; alteracoes jsonb;
BEGIN
 antes := CASE WHEN TG_OP='INSERT' THEN NULL ELSE public.destac_resumo_comercial(TG_TABLE_NAME,to_jsonb(OLD)) END;
 depois := CASE WHEN TG_OP='DELETE' THEN NULL ELSE public.destac_resumo_comercial(TG_TABLE_NAME,to_jsonb(NEW)) END;
 -- UPDATE só gera evento relevante quando os campos comerciais selecionados realmente mudaram.
 IF TG_OP='UPDATE' AND TG_TABLE_NAME IN ('contratos','clientes','empresas') AND antes IS NOT DISTINCT FROM depois THEN
  RETURN NEW;
 END IF;
 chave := coalesce((CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END)->>'id','[sem id]');
 -- O identificador do contrato é armazenado separadamente do id técnico.
 modulo_nome := CASE WHEN TG_TABLE_NAME LIKE 'financeiro_%' THEN 'financeiro'
 WHEN TG_TABLE_NAME='destac_permissoes' THEN 'permissoes'
 WHEN TG_TABLE_NAME='perfis_usuario' THEN 'usuarios' ELSE TG_TABLE_NAME END;
 alteracoes:=jsonb_build_object('antes',antes,'depois',depois);
 IF TG_OP='UPDATE' AND antes IS NOT NULL AND depois IS NOT NULL THEN
  SELECT coalesce(jsonb_object_agg(k,jsonb_build_object('de',antes->k,'para',depois->k)),'{}'::jsonb)
    INTO alteracoes FROM jsonb_object_keys(antes || depois) k
    WHERE (antes->k) IS DISTINCT FROM (depois->k);
  alteracoes:=jsonb_build_object('antes',antes,'depois',depois,'campos_alterados',alteracoes);
 END IF;
 INSERT INTO public.destac_logs(usuario_id,evento,modulo,tabela,registro_id,origem,detalhes)
 VALUES(auth.uid(),TG_OP,modulo_nome,TG_TABLE_NAME,left(chave,200),'banco',alteracoes);
 RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
END $fn$;
REVOKE ALL ON FUNCTION public.destac_registrar_alteracao() FROM PUBLIC,anon,authenticated;
-- A tabela de logs permanece consultável exclusivamente pelo SUPER_USUARIO, conforme RLS V1.
COMMIT;

-- Validação de instalação:
-- SELECT tgrelid::regclass,tgname FROM pg_trigger WHERE tgname='destac_log_principal';
-- SELECT evento,modulo,detalhes FROM public.destac_logs ORDER BY id DESC LIMIT 10;

-- Atualiza validação de módulos da função de permissões, preservando a hierarquia atual.
CREATE OR REPLACE FUNCTION public.destac_definir_permissao(p_user_id uuid,p_modulo text,p_acao text,p_permitido boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_gestor text; v_alvo text; v_ativo boolean;
BEGIN
 SELECT perfil,ativo INTO v_gestor,v_ativo FROM public.perfis_usuario WHERE user_id=auth.uid();
 IF v_ativo IS DISTINCT FROM true THEN RAISE EXCEPTION 'Gestor inativo'; END IF;
 SELECT perfil INTO v_alvo FROM public.perfis_usuario WHERE user_id=p_user_id;
 IF v_alvo IS NULL THEN RAISE EXCEPTION 'Usuário não encontrado'; END IF;
 IF p_modulo NOT IN ('admin','empresas','clientes','contratos','dashboard_contratos','analytics','financeiro','conciliacao_contratos','consultar_cnpj','buscar_cep','usuarios') OR p_acao NOT IN ('visualizar','criar','editar','excluir','exportar') THEN RAISE EXCEPTION 'Permissão inválida'; END IF;
 IF p_user_id=auth.uid() OR v_alvo='SUPER_USUARIO' THEN RAISE EXCEPTION 'Não é permitido alterar as próprias permissões ou as do superusuário'; END IF;
 IF NOT (v_gestor='SUPER_USUARIO' AND v_alvo IN ('ADMINISTRADOR','USUARIO') OR v_gestor='ADMINISTRADOR' AND v_alvo='USUARIO' AND public.destac_tem_permissao('usuarios','editar')) THEN RAISE EXCEPTION 'Hierarquia não permite esta alteração'; END IF;
 IF p_permitido=true AND v_gestor='ADMINISTRADOR' AND NOT public.destac_tem_permissao(p_modulo,p_acao) THEN RAISE EXCEPTION 'Não pode conceder uma permissão que não possui'; END IF;
 IF p_permitido=true AND p_acao <> 'visualizar' AND v_gestor='ADMINISTRADOR' AND NOT public.destac_tem_permissao(p_modulo,'visualizar') THEN RAISE EXCEPTION 'A visualização do módulo deve ser autorizada'; END IF;
 INSERT INTO public.destac_permissoes(user_id,modulo,acao,permitido,atualizado_por,atualizado_em)
 VALUES(p_user_id,p_modulo,p_acao,p_permitido,auth.uid(),now())
 ON CONFLICT(user_id,modulo,acao) DO UPDATE SET permitido=EXCLUDED.permitido,atualizado_por=EXCLUDED.atualizado_por,atualizado_em=now();
END $$;

