-- DESTAC PROPAGANDAS: grade de 6 minutos com 4 anuncios de 30 segundos.
-- Somente cria funcoes/triggers. Nao altera cadastros, contratos ou recebimentos.
-- Usar apos backup e em uma unica transacao.
BEGIN;

CREATE OR REPLACE FUNCTION public.destac_grade_segundos(p_horario text)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT CASE WHEN p_horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$'
 THEN split_part(p_horario, ':', 1)::integer*3600 +
      split_part(p_horario, ':', 2)::integer*60 +
      COALESCE(NULLIF(split_part(p_horario, ':', 3), ''), '0')::integer
 ELSE NULL END
$$;

CREATE OR REPLACE FUNCTION public.destac_grade_dia_na_intersecao(p_ini date, p_fim date, p_dia integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT p_ini <= p_fim AND EXISTS (
   SELECT 1 FROM generate_series(0,6) g(n)
   WHERE (p_ini + g.n) <= p_fim AND EXTRACT(DOW FROM (p_ini + g.n))::integer = p_dia
 )
$$;

-- Horarios antigos fora da grade ocupam conservadoramente o bloco de 6 minutos.
-- Os novos horarios competem somente pela mesma posicao de 30 segundos.
CREATE OR REPLACE FUNCTION public.destac_grade_conflita(p_novo integer, p_existente integer, p_inicio integer)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
 SELECT CASE WHEN p_novo IS NULL OR p_existente IS NULL THEN false
 WHEN p_existente < p_inicio OR mod(p_existente - p_inicio, 360) NOT IN (0,30,60,90)
   THEN floor((p_novo - p_inicio)::numeric/360) = floor((p_existente - p_inicio)::numeric/360)
 ELSE p_novo < p_existente + 30 AND p_existente < p_novo + 30 END
$$;

-- Leitura de slots disponiveis para o usuario autenticado, sem revelar dados de clientes.
CREATE OR REPLACE FUNCTION public.destac_grade_disponibilidade(
 p_inicio date, p_fim date, p_veiculo text, p_ignorar_id bigint DEFAULT NULL)
RETURNS TABLE(grupo text, horario text, disponivel boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $func$
BEGIN
 IF auth.uid() IS NULL THEN
   RAISE EXCEPTION 'Entre no sistema para consultar a grade.' USING ERRCODE='42501';
 END IF;
 IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio OR p_fim > p_inicio + 3660
    OR NULLIF(btrim(p_veiculo), '') IS NULL THEN
   RAISE EXCEPTION 'Informe veiculo e datas validas antes de consultar a grade.' USING ERRCODE='22023';
 END IF;
 RETURN QUERY
 WITH posicoes AS (
   SELECT 'TERCA_QUINTA'::text AS g, to_char(
     (time '13:30:00' + (b.n*interval '6 minutes') + (s.n*interval '30 seconds')), 'HH24:MI:SS') AS h,
     (13*3600+30*60+b.n*360+s.n*30)::integer AS seg, (13*3600+30*60)::integer AS base,
     ARRAY[2,4]::integer[] AS dias
   FROM generate_series(0,74) b(n) CROSS JOIN generate_series(0,3) s(n)
   UNION ALL
   SELECT 'SABADO_DOMINGO', to_char(
     (time '08:00:00' + (b.n*interval '6 minutes') + (s.n*interval '30 seconds')), 'HH24:MI:SS'),
     (8*3600+b.n*360+s.n*30)::integer, (8*3600)::integer, ARRAY[6,0]::integer[]
   FROM generate_series(0,39) b(n) CROSS JOIN generate_series(0,3) s(n)
 ), ocupacoes AS (
   SELECT c.id, c.data_inicio, c.data_termino,
          pos.g, pos.h, pos.seg, pos.base, pos.dias,
          CASE WHEN pos.g='TERCA_QUINTA' THEN c.horarios_terca_quinta ELSE c.horarios_sabado_domingo END AS lista
   FROM posicoes pos
   JOIN public.contratos c
     ON c.id IS DISTINCT FROM p_ignorar_id
    AND upper(btrim(coalesce(c.status,''))) IN ('ATIVO','PENDENTE')
    AND lower(btrim(c.veiculo_executor)) = lower(btrim(p_veiculo))
    AND c.data_inicio <= p_fim AND c.data_termino >= p_inicio
 )
 SELECT pos.g, pos.h,
     NOT EXISTS (
       SELECT 1 FROM ocupacoes o
       CROSS JOIN LATERAL jsonb_array_elements(coalesce(o.lista,'[]'::jsonb)) item(valor)
       WHERE o.g=pos.g AND o.h=pos.h
         AND EXISTS (
           SELECT 1 FROM unnest(pos.dias) dia(n)
           WHERE public.destac_grade_dia_na_intersecao(
             greatest(o.data_inicio,p_inicio), least(o.data_termino,p_fim),dia.n)
         )
         AND public.destac_grade_conflita(
           pos.seg,
           public.destac_grade_segundos(CASE WHEN jsonb_typeof(item.valor)='string'
             THEN item.valor #>> '{}' ELSE item.valor->>'horario' END),
           pos.base)
     ) AS livre
 FROM posicoes pos ORDER BY pos.g, pos.seg;
END
$func$;

REVOKE ALL ON FUNCTION public.destac_grade_disponibilidade(date,date,text,bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.destac_grade_disponibilidade(date,date,text,bigint) TO authenticated;

-- Validacao atomica, inclusive quando dois usuarios salvam simultaneamente.
-- Bloqueio transacional por veiculo; status pendente tambem reserva a posicao.
CREATE OR REPLACE FUNCTION public.destac_grade_proteger_contrato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $func$
DECLARE
 v_grupo text;
 v_lista jsonb;
 v_quantidade integer;
 v_inicio integer;
 v_fim integer;
 v_dias integer[];
 v_hora text;
 v_seg integer;
 v_pos integer;
 v_conflito boolean;
 v_qtd integer;
 v_outro record;
BEGIN
 IF upper(btrim(coalesce(NEW.status,''))) NOT IN ('ATIVO','PENDENTE') THEN RETURN NEW; END IF;
 -- Contratos legados nao sao alterados em edicoes administrativas sem alteracao de grade.
 IF TG_OP = 'UPDATE' THEN
   IF NEW.data_inicio IS NOT DISTINCT FROM OLD.data_inicio
      AND NEW.data_termino IS NOT DISTINCT FROM OLD.data_termino
      AND NEW.veiculo_executor IS NOT DISTINCT FROM OLD.veiculo_executor
      AND NEW.horarios_terca_quinta IS NOT DISTINCT FROM OLD.horarios_terca_quinta
      AND NEW.horarios_sabado_domingo IS NOT DISTINCT FROM OLD.horarios_sabado_domingo
      AND NEW.insercoes_terca_quinta IS NOT DISTINCT FROM OLD.insercoes_terca_quinta
      AND NEW.insercoes_sabado_domingo IS NOT DISTINCT FROM OLD.insercoes_sabado_domingo
      AND upper(btrim(coalesce(OLD.status,''))) IN ('ATIVO','PENDENTE') THEN
     RETURN NEW;
   END IF;
 END IF;
 IF NEW.data_inicio IS NULL OR NEW.data_termino IS NULL OR NEW.data_termino<NEW.data_inicio
    OR NEW.data_termino > NEW.data_inicio + 3660 THEN
   RAISE EXCEPTION 'Informe datas validas (ate 120 meses) antes de reservar horarios.' USING ERRCODE='22023';
 END IF;
 IF nullif(btrim(coalesce(NEW.veiculo_executor,'')),'') IS NULL THEN
   RAISE EXCEPTION 'Informe o veiculo executor para reservar a grade.' USING ERRCODE='22023';
 END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(lower(btrim(NEW.veiculo_executor)), 274891));
 FOR v_grupo IN SELECT unnest(ARRAY['TERCA_QUINTA','SABADO_DOMINGO']) LOOP
   IF v_grupo='TERCA_QUINTA' THEN
     v_lista:=NEW.horarios_terca_quinta; v_quantidade:=NEW.insercoes_terca_quinta;
     v_inicio:=48600; v_fim:=75600; v_dias:=ARRAY[2,4];
   ELSE
     v_lista:=NEW.horarios_sabado_domingo; v_quantidade:=NEW.insercoes_sabado_domingo;
     v_inicio:=28800; v_fim:=43200; v_dias:=ARRAY[6,0];
   END IF;
   IF v_quantidade IS NULL OR v_quantidade<0 OR v_quantidade > (v_fim-v_inicio)/360*4 THEN
     RAISE EXCEPTION 'Quantidade de insercoes fora da capacidade da grade (%).',v_grupo USING ERRCODE='22023';
   END IF;
   IF coalesce(jsonb_typeof(v_lista),'null') <> 'array'
       OR jsonb_array_length(v_lista)<>v_quantidade THEN
     RAISE EXCEPTION 'Quantidade de horarios diferente das insercoes informadas (%).',v_grupo USING ERRCODE='22023';
   END IF;
   v_pos:=0;
   FOR v_hora IN SELECT CASE WHEN jsonb_typeof(e.v)='string' THEN e.v #>> '{}' ELSE e.v->>'horario' END
                 FROM jsonb_array_elements(v_lista) e(v) LOOP
     v_pos:=v_pos+1;
     v_seg:=public.destac_grade_segundos(v_hora);
     IF v_seg IS NULL OR v_seg < v_inicio OR v_seg + 30 > v_fim
       OR mod(v_seg-v_inicio,360) NOT IN (0,30,60,90) THEN
       RAISE EXCEPTION 'Horario % invalido para %. Escolha uma posicao de 30s na grade de 6 minutos.',v_hora,v_grupo USING ERRCODE='22023';
     END IF;
     IF EXISTS (
       SELECT 1 FROM jsonb_array_elements(v_lista) t(v)
       WHERE public.destac_grade_segundos(CASE WHEN jsonb_typeof(t.v)='string' THEN t.v #>> '{}' ELSE t.v->>'horario' END) = v_seg
       GROUP BY public.destac_grade_segundos(CASE WHEN jsonb_typeof(t.v)='string' THEN t.v #>> '{}' ELSE t.v->>'horario' END)
       HAVING count(*)>1
     ) THEN RAISE EXCEPTION 'Horarios repetidos dentro do mesmo contrato (%).',v_grupo USING ERRCODE='23505'; END IF;
     SELECT EXISTS (
       SELECT 1 FROM public.contratos c
       CROSS JOIN LATERAL jsonb_array_elements(coalesce(
         CASE WHEN v_grupo='TERCA_QUINTA' THEN c.horarios_terca_quinta ELSE c.horarios_sabado_domingo END,
         '[]'::jsonb)) h(v)
       WHERE c.id IS DISTINCT FROM NEW.id
         AND upper(btrim(coalesce(c.status,''))) IN ('ATIVO','PENDENTE')
         AND lower(btrim(c.veiculo_executor))=lower(btrim(NEW.veiculo_executor))
         AND c.data_inicio <= NEW.data_termino AND c.data_termino >= NEW.data_inicio
         AND EXISTS (SELECT 1 FROM unnest(v_dias) d(dia)
                     WHERE public.destac_grade_dia_na_intersecao(
                        greatest(c.data_inicio,NEW.data_inicio),least(c.data_termino,NEW.data_termino),d.dia))
         AND public.destac_grade_conflita(v_seg,
           public.destac_grade_segundos(CASE WHEN jsonb_typeof(h.v)='string' THEN h.v #>> '{}' ELSE h.v->>'horario' END),v_inicio)
     ) INTO v_conflito;
     IF v_conflito THEN
       RAISE EXCEPTION 'Horario % ocupado na grade de %. Atualize a disponibilidade e selecione outro horario.',v_hora,v_grupo USING ERRCODE='23505';
     END IF;
   END LOOP;
 END LOOP;
 RETURN NEW;
END
$func$;

DROP TRIGGER IF EXISTS destac_grade_validar_contrato ON public.contratos;
CREATE TRIGGER destac_grade_validar_contrato
BEFORE INSERT OR UPDATE ON public.contratos
FOR EACH ROW EXECUTE FUNCTION public.destac_grade_proteger_contrato();

COMMIT;
