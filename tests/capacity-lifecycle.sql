\set ON_ERROR_STOP on
-- Isolated, disposable CI database. NEVER run this file against Supabase production.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create extension if not exists pgcrypto;

create table public.ambulances (
  id uuid primary key default gen_random_uuid(),
  external_id text unique,
  name text not null, city text,
  active boolean not null default true,
  update_token_hash text,
  capacity_status text not null default 'unknown',
  accepts_new boolean,
  earliest_date date,
  slots_30d smallint,
  note_public text,
  capacity_updated_at timestamptz,
  capacity_valid_until timestamptz,
  updated_at timestamptz not null default now()
);
create sequence public.capacity_updates_id_seq;
create table public.capacity_updates (
  id bigint primary key,
  ambulance_id uuid not null references public.ambulances(id),
  accepts_new boolean not null,
  earliest_date date,
  slots_30d smallint,
  source text not null check (source in ('secure_link','admin','import')),
  created_at timestamptz not null default now(),
  capacity_status text not null,
  note_public text,
  valid_until timestamptz
);
alter table public.ambulances enable row level security;
alter table public.capacity_updates enable row level security;
create policy "public can read active ambulances" on public.ambulances for select to anon using (active=true);
grant usage on schema public to anon;
grant select (id,external_id,name,city,active,capacity_status,accepts_new,earliest_date,slots_30d,note_public,capacity_updated_at,capacity_valid_until) on public.ambulances to anon;
grant update (capacity_status,accepts_new,earliest_date,slots_30d,note_public,capacity_updated_at,capacity_valid_until,updated_at) on public.ambulances to anon;

insert into public.ambulances (external_id,name,city,update_token_hash)
values ('test-1','CI test ambulance','Bratislava', encode(digest(repeat('a',64),'sha256'),'hex'));
\i supabase/capacity-link-lifecycle.sql

-- Existing link survives the migration for a 30-day transition.
do $$begin
  if not exists (select 1 from public.ambulances where external_id='test-1'
      and capacity_token_expires_at > now() + interval '29 days') then
    raise exception 'existing link not given transition grace period';
  end if;
end$$;

-- Authorized anonymous capability update.
select set_config('request.headers', json_build_object('x-capacity-token-hash', encode(digest(repeat('a',64),'sha256'),'hex'))::text, false);
set role anon;
update public.ambulances
  set capacity_status='accepting', accepts_new=true,
      capacity_updated_at=now(),capacity_valid_until=now()+interval '14 days'
  where external_id='test-1';
reset role;
do $$begin
  if (select count(*) from public.capacity_updates where source='secure_link') <> 1 then
    raise exception 'successful magic link update did not write exactly one audit row';
  end if;
end$$;

-- Expired link must not authorize any update.
update public.ambulances set capacity_token_issued_at=now()-interval '31 days', capacity_token_expires_at=now()-interval '1 hour' where external_id='test-1';
set role anon;
update public.ambulances set capacity_status='full', accepts_new=false where external_id='test-1';
reset role;
do $$begin
  if (select capacity_status from public.ambulances where external_id='test-1') <> 'accepting'
    or (select count(*) from public.capacity_updates) <> 1 then
    raise exception 'expired link authorized a write';
  end if;
end$$;

-- Revocation prevents further updates.
update public.ambulances
  set update_token_hash=null,capacity_token_issued_at=null,capacity_token_expires_at=null
  where external_id='test-1';
set role anon;
update public.ambulances set capacity_status='full', accepts_new=false where external_id='test-1';
reset role;
do $$begin
  if (select capacity_status from public.ambulances where external_id='test-1') <> 'accepting'
    or (select count(*) from public.capacity_updates) <> 1 then
    raise exception 'revoked link authorized a write';
  end if;
end$$;

-- Rotation replaces the revoked token with a new one.
update public.ambulances
set update_token_hash=encode(digest(repeat('b',64),'sha256'),'hex'),
    capacity_token_issued_at=now(),
    capacity_token_expires_at=now()+interval '90 days'
where external_id='test-1';
-- Old bearer token still must not work.
set role anon;
update public.ambulances set capacity_status='limited', accepts_new=true where external_id='test-1';
reset role;
do $begin
  if (select capacity_status from public.ambulances where external_id='test-1') <> 'accepting' then
    raise exception 'old token authorized a write after rotation';
  end if;
end$;
-- The new bearer token works and creates a second audit event.
select set_config('request.headers',
  json_build_object('x-capacity-token-hash',encode(digest(repeat('b',64),'sha256'),'hex'))::text, false);
set role anon;
update public.ambulances
  set capacity_status='limited',accepts_new=true,capacity_updated_at=now()
  where external_id='test-1';
reset role;
do $begin
  if (select capacity_status from public.ambulances where external_id='test-1') <> 'limited'
    or (select count(*) from public.capacity_updates where source='secure_link') <> 2 then
    raise exception 'rotated link failed update or audit';
  end if;
end$;

-- No-op updates must not append duplicate history.
update public.ambulances set capacity_status=capacity_status where external_id='test-1';
do $$begin
  if (select count(*) from public.capacity_updates) <> 2 then
    raise exception 'no-op change incorrectly appended audit';
  end if;
end$$;
select 'capacity lifecycle SQL integration tests passed' as result;
