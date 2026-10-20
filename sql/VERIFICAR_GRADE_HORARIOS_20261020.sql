-- Diagnostico SOMENTE LEITURA. Rodar depois de instalar o arquivo 01.
SELECT 'FUNCAO' AS tipo, 'destac_grade_disponibilidade' AS nome,
  CASE WHEN to_regprocedure('public.destac_grade_disponibilidade(date,date,text,bigint)') IS NOT NULL THEN 'INSTALADO' ELSE 'FALTANDO' END AS situacao
UNION ALL
SELECT 'FUNCAO','destac_grade_proteger_contrato',
  CASE WHEN to_regprocedure('public.destac_grade_proteger_contrato()') IS NOT NULL THEN 'INSTALADO' ELSE 'FALTANDO' END
UNION ALL
SELECT 'TRIGGER','destac_grade_validar_contrato',
  CASE WHEN EXISTS (SELECT 1 FROM pg_trigger t WHERE t.tgname='destac_grade_validar_contrato' AND t.tgrelid='public.contratos'::regclass AND NOT t.tgisinternal AND t.tgenabled <> 'D') THEN 'INSTALADO' ELSE 'FALTANDO' END;

-- Estatisticas das regras, sem modificar contratos.
SELECT 'Terças/Quintas' AS periodo, 75 AS blocos_por_dia, 300 AS anuncios_30s_por_dia
UNION ALL SELECT 'Sábados/Domingos', 40, 160;
