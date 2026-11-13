-- Apply ONLY to a separate staging project after its base schema and capacity-link-lifecycle.sql.
-- Administrators are provisioned manually in Supabase Auth; there is no public signup.
begin;
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
revoke all on public.admin_users from public, anon, authenticated;
grant select on public.admin_users to service_role;
grant all on public.admin_users to postgres;

create table if not exists public.capacity_token_events (
  id bigint generated always as identity primary key,
  ambulance_id uuid not null references public.ambulances(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('issued','rotated','revoked')),
  created_at timestamptz not null default now()
);
alter table public.capacity_token_events enable row level security;
revoke all on public.capacity_token_events from public, anon, authenticated;
grant all on public.capacity_token_events to service_role;

create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace function app_private.audit_ambulance_token()
returns trigger language plpgsql security definer set search_path=pg_catalog
as $$
declare
  actor uuid;
  header_actor text;
  action_kind text;
begin
  if old.update_token_hash is not distinct from new.update_token_hash then return new; end if;
  header_actor := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb->>'x-admin-user-id';
  if header_actor is not null and header_actor ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    actor := header_actor::uuid;
  end if;
  action_kind := case
    when new.update_token_hash is null then 'revoked'
    when old.update_token_hash is null then 'issued'
    else 'rotated'
  end;
  insert into public.capacity_token_events(ambulance_id,actor_id,action)
  values(new.id,actor,action_kind);
  return new;
end;
$$;
revoke all on function app_private.audit_ambulance_token() from public, anon, authenticated;
drop trigger if exists audit_ambulance_token_changes on public.ambulances;
create trigger audit_ambulance_token_changes
  after update of update_token_hash on public.ambulances
  for each row execute function app_private.audit_ambulance_token();
commit;

-- Provision an admin AFTER creating/inviting their Supabase Auth account:
-- insert into public.admin_users(user_id,active)
-- values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID',true)
-- on conflict (user_id) do update set active=excluded.active;
