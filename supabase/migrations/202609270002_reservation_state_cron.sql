-- Mantiene los estados sincronizados aunque ningún usuario tenga la app abierta.
-- Supabase Cron ejecuta esta función cada minuto dentro de PostgreSQL.
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'nexo-salas-reservation-state',
  '* * * * *',
  'select private.cleanup_reservation_state();'
);
