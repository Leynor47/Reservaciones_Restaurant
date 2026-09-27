-- Nexo Salas: esquema inicial, reglas de negocio, RLS y Realtime.
-- Zona horaria del dominio: America/Costa_Rica.

create extension if not exists btree_gist with schema extensions;

create type public.app_role as enum ('miembro', 'admin');
create type public.reservation_status as enum ('held', 'active', 'cancelled', 'completed', 'expired');
create type public.booking_session_status as enum ('open', 'confirmed', 'expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) between 2 and 100),
  role public.app_role not null default 'miembro',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(trim(name)) between 1 and 80),
  capacity integer not null check (capacity in (4, 8, 12)),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.booking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  status public.booking_session_status not null default 'open',
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  created_at timestamptz not null default now()
);

create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id),
  user_id uuid not null references public.profiles(id) on delete cascade,
  booking_session_id uuid references public.booking_sessions(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status public.reservation_status not null default 'held',
  hold_expires_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references public.profiles(id),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservations_time_order check (ends_at > starts_at),
  constraint reservations_duration check (ends_at - starts_at between interval '1 hour' and interval '3 hours'),
  constraint reservations_hold_shape check (
    (status = 'held' and hold_expires_at is not null)
    or (status <> 'held')
  ),
  constraint reservations_cancellation_shape check (
    (status = 'cancelled' and cancelled_at is not null and cancelled_by is not null and cancellation_reason is not null)
    or status <> 'cancelled'
  )
);

alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    room_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('held', 'active'));

-- Tabla sanitizada para disponibilidad en tiempo real. No contiene identidades.
create table public.room_blocks (
  reservation_id uuid primary key references public.reservations(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  updated_at timestamptz not null default now()
);
alter table public.room_blocks replica identity full;

create index reservations_user_starts_idx on public.reservations(user_id, starts_at);
create index reservations_room_starts_idx on public.reservations(room_id, starts_at);
create index booking_sessions_user_status_idx on public.booking_sessions(user_id, status);
create index room_blocks_room_starts_idx on public.room_blocks(room_id, starts_at);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

create or replace function private.cleanup_reservation_state()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.booking_sessions
  set status = 'expired'
  where status = 'open' and expires_at <= now();

  update public.reservations
  set status = 'expired', updated_at = now()
  where status = 'held' and hold_expires_at <= now();

  update public.reservations
  set status = 'completed', updated_at = now()
  where status = 'active' and ends_at <= now();
end;
$$;

create or replace function private.sync_room_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    delete from public.room_blocks where reservation_id = old.id;
    return old;
  end if;

  if new.status in ('held', 'active') then
    insert into public.room_blocks (reservation_id, room_id, starts_at, ends_at, updated_at)
    values (new.id, new.room_id, new.starts_at, new.ends_at, now())
    on conflict (reservation_id) do update
      set room_id = excluded.room_id,
          starts_at = excluded.starts_at,
          ends_at = excluded.ends_at,
          updated_at = now();
  else
    delete from public.room_blocks where reservation_id = new.id;
  end if;
  return new;
end;
$$;

create trigger reservations_sync_room_block
after insert or update or delete
on public.reservations
for each row execute function private.sync_room_block();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Miembro'));
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function public.start_booking_session(p_room_id uuid)
returns table(session_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  perform private.cleanup_reservation_state();

  if not exists (select 1 from public.rooms where id = p_room_id and is_active) then
    raise exception 'La sala no está disponible.' using errcode = 'P0001';
  end if;

  update public.reservations set status = 'expired', updated_at = now()
  where user_id = v_user_id and status = 'held';

  update public.booking_sessions set status = 'expired'
  where user_id = v_user_id and status = 'open';

  return query
  insert into public.booking_sessions (user_id, room_id)
  values (v_user_id, p_room_id)
  returning booking_sessions.id, booking_sessions.expires_at;
end;
$$;

create or replace function public.hold_reservation(
  p_session_id uuid,
  p_starts_at timestamptz,
  p_duration_minutes integer
)
returns table(reservation_id uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_session public.booking_sessions%rowtype;
  v_ends_at timestamptz;
  v_local_start timestamp;
  v_local_end timestamp;
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  perform private.cleanup_reservation_state();

  select * into v_session from public.booking_sessions
  where id = p_session_id and user_id = v_user_id and status = 'open' and booking_sessions.expires_at > now()
  for update;
  if not found then raise exception 'La sesión de reserva venció.' using errcode = 'P0001'; end if;

  if p_duration_minutes not in (60, 90, 120, 150, 180) then
    raise exception 'La duración debe estar entre 1 y 3 horas, en bloques de 30 minutos.' using errcode = '22023';
  end if;
  if extract(second from p_starts_at) <> 0 or mod(extract(minute from p_starts_at)::integer, 30) <> 0 then
    raise exception 'La reserva debe iniciar en un bloque de 30 minutos.' using errcode = '22023';
  end if;
  if p_starts_at < now() + interval '30 minutes' then
    raise exception 'Debes reservar con al menos 30 minutos de anticipación.' using errcode = '22023';
  end if;

  v_ends_at := p_starts_at + make_interval(mins => p_duration_minutes);
  v_local_start := timezone('America/Costa_Rica', p_starts_at);
  v_local_end := timezone('America/Costa_Rica', v_ends_at);
  if v_local_start::time < time '07:00'
     or v_local_end > date_trunc('day', v_local_start) + interval '1 day' then
    raise exception 'El horario permitido es de 07:00 a 00:00.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.rooms where id = v_session.room_id and is_active) then
    raise exception 'La sala no está disponible.' using errcode = 'P0001';
  end if;

  update public.reservations
  set status = 'expired', updated_at = now()
  where booking_session_id = p_session_id and status = 'held';

  begin
    return query
    insert into public.reservations (
      room_id, user_id, booking_session_id, starts_at, ends_at, status, hold_expires_at
    ) values (
      v_session.room_id, v_user_id, p_session_id, p_starts_at, v_ends_at, 'held', v_session.expires_at
    ) returning reservations.id, reservations.hold_expires_at;
  exception when exclusion_violation then
    raise exception 'Ese horario acaba de ser ocupado. Elige otro bloque.' using errcode = '23P01';
  end;
end;
$$;

create or replace function public.confirm_reservation(p_reservation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_reservation public.reservations%rowtype;
  v_week_start timestamp;
  v_count integer;
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  perform private.cleanup_reservation_state();

  select * into v_reservation from public.reservations
  where id = p_reservation_id and user_id = v_user_id and status = 'held' and hold_expires_at > now()
  for update;
  if not found then raise exception 'La retención venció. Elige nuevamente el horario.' using errcode = 'P0001'; end if;

  v_week_start := date_trunc('week', timezone('America/Costa_Rica', v_reservation.starts_at));
  select count(*) into v_count from public.reservations
  where user_id = v_user_id
    and status = 'active'
    and timezone('America/Costa_Rica', starts_at) >= v_week_start
    and timezone('America/Costa_Rica', starts_at) < v_week_start + interval '7 days';
  if v_count >= 3 then
    raise exception 'Ya alcanzaste el límite de 3 reservas activas para esa semana.' using errcode = 'P0001';
  end if;

  update public.reservations
  set status = 'active', hold_expires_at = null, updated_at = now()
  where id = p_reservation_id;
  update public.booking_sessions set status = 'confirmed' where id = v_reservation.booking_session_id;
  return p_reservation_id;
end;
$$;

create or replace function public.release_booking_session(p_session_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then return; end if;
  update public.reservations set status = 'expired', updated_at = now()
  where booking_session_id = p_session_id and user_id = v_user_id and status = 'held';
  update public.booking_sessions set status = 'expired'
  where id = p_session_id and user_id = v_user_id and status = 'open';
end;
$$;

create or replace function public.cancel_my_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  perform private.cleanup_reservation_state();
  update public.reservations
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id,
      cancellation_reason = 'Cancelada por el miembro', updated_at = now()
  where id = p_reservation_id and user_id = v_user_id and status = 'active'
    and starts_at >= now() + interval '2 hours';
  if not found then raise exception 'La reserva ya no puede cancelarse.' using errcode = 'P0001'; end if;
end;
$$;

create or replace function public.cancel_reservation_as_admin(p_reservation_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if not private.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if char_length(trim(p_reason)) < 3 then raise exception 'Debes indicar un motivo.' using errcode = '22023'; end if;
  perform private.cleanup_reservation_state();
  update public.reservations
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user_id,
      cancellation_reason = trim(p_reason), updated_at = now()
  where id = p_reservation_id and status = 'active';
  if not found then raise exception 'La reserva no está activa.' using errcode = 'P0001'; end if;
end;
$$;

-- Limpia vencimientos antes de devolver disponibilidad.
create or replace function public.get_room_blocks(p_from timestamptz, p_to timestamptz)
returns table(reservation_id uuid, room_id uuid, starts_at timestamptz, ends_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  perform private.cleanup_reservation_state();
  return query select b.reservation_id, b.room_id, b.starts_at, b.ends_at
  from public.room_blocks b
  where b.starts_at < p_to and b.ends_at > p_from;
end;
$$;

create or replace function public.get_weekly_remaining()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_week_start timestamp := date_trunc('week', timezone('America/Costa_Rica', now()));
  v_count integer;
begin
  if v_user_id is null then raise exception 'Debes iniciar sesión.' using errcode = '42501'; end if;
  perform private.cleanup_reservation_state();
  select count(*) into v_count from public.reservations
  where user_id = v_user_id and status = 'active'
    and timezone('America/Costa_Rica', starts_at) >= v_week_start
    and timezone('America/Costa_Rica', starts_at) < v_week_start + interval '7 days';
  return greatest(0, 3 - v_count);
end;
$$;

-- RLS y privilegios mínimos.
alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.booking_sessions enable row level security;
alter table public.reservations enable row level security;
alter table public.room_blocks enable row level security;

revoke all on public.profiles, public.rooms, public.booking_sessions, public.reservations, public.room_blocks from anon, authenticated;
grant select on public.profiles, public.rooms, public.booking_sessions, public.reservations, public.room_blocks to authenticated;
grant insert, update on public.rooms to authenticated;

create policy profiles_select_own_or_admin on public.profiles for select to authenticated
using ((select auth.uid()) = id or private.is_admin());

create policy rooms_select_authenticated on public.rooms for select to authenticated
using (is_active or private.is_admin());
create policy rooms_insert_admin on public.rooms for insert to authenticated
with check (private.is_admin());
create policy rooms_update_admin on public.rooms for update to authenticated
using (private.is_admin()) with check (private.is_admin());

create policy booking_sessions_select_own on public.booking_sessions for select to authenticated
using ((select auth.uid()) = user_id);

create policy reservations_select_own_or_admin on public.reservations for select to authenticated
using ((select auth.uid()) = user_id or private.is_admin());

create policy room_blocks_select_authenticated on public.room_blocks for select to authenticated
using (true);

revoke all on function public.start_booking_session(uuid) from public;
revoke all on function public.hold_reservation(uuid, timestamptz, integer) from public;
revoke all on function public.confirm_reservation(uuid) from public;
revoke all on function public.release_booking_session(uuid) from public;
revoke all on function public.cancel_my_reservation(uuid) from public;
revoke all on function public.cancel_reservation_as_admin(uuid, text) from public;
revoke all on function public.get_room_blocks(timestamptz, timestamptz) from public;
revoke all on function public.get_weekly_remaining() from public;
grant execute on function public.start_booking_session(uuid) to authenticated;
grant execute on function public.hold_reservation(uuid, timestamptz, integer) to authenticated;
grant execute on function public.confirm_reservation(uuid) to authenticated;
grant execute on function public.release_booking_session(uuid) to authenticated;
grant execute on function public.cancel_my_reservation(uuid) to authenticated;
grant execute on function public.cancel_reservation_as_admin(uuid, text) to authenticated;
grant execute on function public.get_room_blocks(timestamptz, timestamptz) to authenticated;
grant execute on function public.get_weekly_remaining() to authenticated;

-- Ocho salas aprobadas.
insert into public.rooms (id, name, capacity) values
  ('00000000-0000-4000-8000-000000000001', 'Sala 1', 4),
  ('00000000-0000-4000-8000-000000000002', 'Sala 2', 4),
  ('00000000-0000-4000-8000-000000000003', 'Sala 3', 4),
  ('00000000-0000-4000-8000-000000000004', 'Sala 4', 8),
  ('00000000-0000-4000-8000-000000000005', 'Sala 5', 8),
  ('00000000-0000-4000-8000-000000000006', 'Sala 6', 8),
  ('00000000-0000-4000-8000-000000000007', 'Sala 7', 12),
  ('00000000-0000-4000-8000-000000000008', 'Sala 8', 12);

-- Postgres Changes para refrescar disponibilidad y administración en vivo.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'room_blocks') then
    alter publication supabase_realtime add table public.room_blocks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table public.rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reservations') then
    alter publication supabase_realtime add table public.reservations;
  end if;
end $$;
