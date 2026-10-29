-- EXECUTAR APÓS instalar a migração e habilitar pg_cron nas extensões do Supabase.
-- Agenda diária às 06:15 UTC; rodar diariamente evita atrasos se o dia mudar.
SELECT cron.schedule('destac-mensalidades-recorrentes', '15 6 * * *',
  $$SELECT public.destac_gerar_mensalidades_indeterminadas();$$);
