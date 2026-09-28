-- Acceso administrativo desde la app con secreto compartido, hash y bloqueo por intentos.
create extension if not exists pgcrypto with schema extensions;

create table if not exists private.admin_access_attempts (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table private.admin_access_attempts enable row level security;
revoke all on table private.admin_access_attempts from public, anon, authenticated;

create or replace function public.claim_admin(p_secret text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_attempts integer;
  v_locked_until timestamptz;
  v_expected_hash constant text := '926c9abb1e7da177ab4e3c50bb5aa4424ea63a2e3f342ec0fe870c1daa3804b4';
  v_received_hash text;
begin
  if v_user_id is null then
    return 'unauthorized';
  end if;

  insert into private.admin_access_attempts (user_id)
  values (v_user_id)
  on conflict (user_id) do nothing;

  select failed_attempts, locked_until
  into v_attempts, v_locked_until
  from private.admin_access_attempts
  where user_id = v_user_id
  for update;

  if v_locked_until is not null and v_locked_until > now() then
    return 'locked';
  end if;

  v_received_hash := encode(extensions.digest(convert_to(p_secret, 'UTF8'), 'sha256'), 'hex');
  if v_received_hash <> v_expected_hash then
    v_attempts := case when v_locked_until is not null and v_locked_until <= now() then 1 else v_attempts + 1 end;
    update private.admin_access_attempts
    set failed_attempts = v_attempts,
        locked_until = case when v_attempts >= 5 then now() + interval '15 minutes' else null end,
        updated_at = now()
    where user_id = v_user_id;
    return case when v_attempts >= 5 then 'locked' else 'invalid' end;
  end if;

  update public.profiles
  set role = 'admin', updated_at = now()
  where id = v_user_id;

  update private.admin_access_attempts
  set failed_attempts = 0, locked_until = null, updated_at = now()
  where user_id = v_user_id;

  return 'granted';
end;
$$;

revoke all on function public.claim_admin(text) from public;
grant execute on function public.claim_admin(text) to authenticated;
