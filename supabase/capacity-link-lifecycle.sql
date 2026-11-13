-- REVIEW BEFORE APPLYING. Shared Supabase is used by production and preview.
-- A token is valid for up to 90 days; a capacity report stays current for 14 days.
-- This migration preserves existing issued links for 30 days from migration.
-- It must be executed once as a database administrator, not by browser clients.

begin;

alter table public.ambulances
  add column if not exists capacity_token_issued_at timestamptz,
  add column if not exists capacity_token_expires_at timestamptz;

alter table public.ambulances
  add constraint capacity_token_lifecycle_check
  check (
    (update_token_hash is null and capacity_token_expires_at is null and capacity_token_issued_at is null)
    or
    (update_token_hash is not null and capacity_token_issued_at is not null
      and capacity_token_expires_at > capacity_token_issued_at)
  ) not valid;

-- Allow a limited migration period for already-distributed links.
update public.ambulances
set capacity_token_issued_at = now(),
    capacity_token_expires_at = now() + interval '30 days'
where update_token_hash is not null
  and (capacity_token_issued_at is null or capacity_token_expires_at is null);

alter table public.ambulances
  validate constraint capacity_token_lifecycle_check;

-- The anonymous capability may change capacity only while the token is active.
-- Hash is supplied by the server-side API, never through a public list endpoint.
drop policy if exists "Magic link can update ambulance capacity" on public.ambulances;
create policy "Magic link can update ambulance capacity"
  on public.ambulances for update to anon
  using (
    active = true
    and update_token_hash is not null
    and capacity_token_expires_at > now()
    and update_token_hash = (
      select coalesce(current_setting('request.headers', true), '{}')::jsonb
        ->> 'x-capacity-token-hash'
    )
  )
  with check (
    active = true
    and update_token_hash is not null
    and capacity_token_expires_at > now()
    and update_token_hash = (
      select coalesce(current_setting('request.headers', true), '{}')::jsonb
        ->> 'x-capacity-token-hash'
    )
  );

-- The public application does not need token lifecycle columns.
revoke select (capacity_token_issued_at, capacity_token_expires_at, update_token_hash)
  on public.ambulances from anon, authenticated;
revoke update (capacity_token_issued_at, capacity_token_expires_at, update_token_hash)
  on public.ambulances from anon, authenticated;

-- All capacity changes get one immutable history record, transactionally.
-- Definer permissions are restricted to this trigger; function is not a public RPC.
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

create or replace function app_private.audit_ambulance_capacity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  request_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  from_magic_link boolean;
begin
  if not (
    old.capacity_status is distinct from new.capacity_status
    or old.accepts_new is distinct from new.accepts_new
    or old.earliest_date is distinct from new.earliest_date
    or old.slots_30d is distinct from new.slots_30d
    or old.note_public is distinct from new.note_public
    or old.capacity_valid_until is distinct from new.capacity_valid_until
    or old.capacity_updated_at is distinct from new.capacity_updated_at
  ) then
    return new;
  end if;

  from_magic_link := old.update_token_hash is not null
    and old.capacity_token_expires_at > now()
    and old.update_token_hash = request_headers ->> 'x-capacity-token-hash';

  insert into public.capacity_updates (
    id, ambulance_id, accepts_new, earliest_date, slots_30d, source,
    capacity_status, note_public, valid_until
  ) values (
    nextval('public.capacity_updates_id_seq'::regclass),
    new.id, coalesce(new.accepts_new, false), new.earliest_date, new.slots_30d,
    case when from_magic_link then 'secure_link' else 'admin' end,
    new.capacity_status, new.note_public, new.capacity_valid_until
  );
  return new;
end;
$$;

revoke all on function app_private.audit_ambulance_capacity() from public, anon, authenticated;
drop trigger if exists audit_ambulance_capacity_changes on public.ambulances;
create trigger audit_ambulance_capacity_changes
  after update of capacity_status, accepts_new, earliest_date, slots_30d,
    note_public, capacity_valid_until, capacity_updated_at
  on public.ambulances
  for each row execute function app_private.audit_ambulance_capacity();

-- Anonymous users can never change token metadata or read the audit log.
comment on column public.ambulances.capacity_token_expires_at is
  'Expiration of the bearer capability. Not the same as capacity_valid_until.';
comment on column public.ambulances.capacity_token_issued_at is
  'Administrative token issuance timestamp. Raw token is never stored.';
comment on function app_private.audit_ambulance_capacity() is
  'Internal trigger only. Creates transactionally consistent audit history.';

commit;
