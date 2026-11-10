-- Cesta k pomoci: additive schema for the existing "volna-ambulancia" project.
-- The project already contains ambulances, capacity_updates and demands.
-- This script adds verified staff access and the educational content hub.
-- Never store a child's name, diagnosis, medical record, email or phone number here.

alter table public.capacity_updates
  add column if not exists submitted_by uuid references auth.users(id) on delete set null;

create table if not exists public.ambulance_members (
  ambulance_id uuid not null references public.ambulances(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'reporter'
    check (member_role in ('reporter', 'ambulance_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (ambulance_id, user_id)
);

create table if not exists public.content_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  owner_name text not null,
  source_url text not null,
  audience text[] not null default '{}',
  age_groups text[] not null default '{}',
  topics text[] not null default '{}',
  resource_format text,
  access_type text,
  evidence_level text check (evidence_level is null or evidence_level in ('E1', 'E2', 'E3', 'E4')),
  language_code text not null default 'sk',
  is_published boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_paths (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text not null,
  audience text[] not null default '{}',
  topic text not null,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.learning_path_steps (
  id uuid primary key default gen_random_uuid(),
  learning_path_id uuid not null references public.learning_paths(id) on delete cascade,
  step_order smallint not null check (step_order > 0),
  title text not null,
  guidance text not null,
  resource_id uuid references public.content_resources(id) on delete set null,
  escalation_level text not null default 'self_help'
    check (escalation_level in ('self_help', 'school_support', 'professional', 'urgent')),
  created_at timestamptz not null default now(),
  unique (learning_path_id, step_order)
);

create index if not exists ambulance_members_user_idx
  on public.ambulance_members (user_id, ambulance_id)
  where is_active = true;
create index if not exists content_resources_topics_idx
  on public.content_resources using gin (topics);
create index if not exists content_resources_audience_idx
  on public.content_resources using gin (audience);
create index if not exists learning_path_steps_path_order_idx
  on public.learning_path_steps (learning_path_id, step_order);
create index if not exists capacity_updates_submitted_by_idx
  on public.capacity_updates (submitted_by)
  where submitted_by is not null;
create index if not exists learning_path_steps_resource_idx
  on public.learning_path_steps (resource_id)
  where resource_id is not null;

alter table public.ambulance_members enable row level security;
alter table public.content_resources enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_path_steps enable row level security;

-- The old restrictive policy also covered authenticated staff. Limit it to anonymous users.
alter policy "no public capacity history access"
  on public.capacity_updates
  to anon;

create policy "Authenticated users can read active ambulances"
  on public.ambulances for select
  to authenticated
  using (
    active = true
    or exists (
      select 1 from public.ambulance_members membership
      where membership.ambulance_id = ambulances.id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "Members can read their ambulance"
  on public.ambulances for select
  to service_role
  using (
    exists (
      select 1 from public.ambulance_members membership
      where membership.ambulance_id = ambulances.id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "Members can update their ambulance capacity"
  on public.ambulances for update
  to authenticated
  using (
    exists (
      select 1 from public.ambulance_members membership
      where membership.ambulance_id = ambulances.id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.ambulance_members membership
      where membership.ambulance_id = ambulances.id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "Members can read their own memberships"
  on public.ambulance_members for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Members can read their capacity history"
  on public.capacity_updates for select
  to authenticated
  using (
    exists (
      select 1 from public.ambulance_members membership
      where membership.ambulance_id = capacity_updates.ambulance_id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "Members can append capacity updates"
  on public.capacity_updates for insert
  to authenticated
  with check (
    submitted_by = (select auth.uid())
    and exists (
      select 1 from public.ambulance_members membership
      where membership.ambulance_id = capacity_updates.ambulance_id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "Published resources are public"
  on public.content_resources for select
  to anon, authenticated
  using (is_published = true);

create policy "Published learning paths are public"
  on public.learning_paths for select
  to anon, authenticated
  using (is_published = true);

create policy "Published learning path steps are public"
  on public.learning_path_steps for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.learning_paths path
      where path.id = learning_path_steps.learning_path_id
        and path.is_published = true
    )
  );

revoke all on public.ambulance_members from anon, authenticated;
revoke all on public.content_resources from anon, authenticated;
revoke all on public.learning_paths from anon, authenticated;
revoke all on public.learning_path_steps from anon, authenticated;

grant select on public.ambulances to authenticated;
grant update (
  accepts_new,
  earliest_date,
  slots_30d,
  note_public,
  capacity_updated_at,
  capacity_valid_until,
  updated_at
) on public.ambulances to authenticated;
grant select on public.ambulance_members to authenticated;
grant select, insert on public.capacity_updates to authenticated;
grant usage, select on sequence public.capacity_updates_id_seq to authenticated;
grant select on public.content_resources to anon, authenticated;
grant select on public.learning_paths to anon, authenticated;
grant select on public.learning_path_steps to anon, authenticated;

grant all on public.ambulance_members to service_role;
grant all on public.content_resources to service_role;
grant all on public.learning_paths to service_role;
grant all on public.learning_path_steps to service_role;

comment on table public.ambulance_members is
  'Verified staff accounts allowed to report capacity for an ambulance.';
comment on column public.capacity_updates.submitted_by is
  'Authenticated reporter. Never use this table for patient or child data.';
comment on table public.content_resources is
  'Curated public resources. Publication is controlled by the service role.';

-- Public directory fields imported from the curated research workbook.
alter table public.content_resources
  add column if not exists external_id text unique,
  add column if not exists owner_type text,
  add column if not exists origin text,
  add column if not exists audience_raw text,
  add column if not exists age_raw text,
  add column if not exists age_min smallint check (age_min is null or age_min between 0 and 25),
  add column if not exists age_max smallint check (age_max is null or age_max between 0 and 25),
  add column if not exists topics_raw text,
  add column if not exists support_level text,
  add column if not exists registration_type text,
  add column if not exists price_type text,
  add column if not exists evidence_summary text,
  add column if not exists public_results text,
  add column if not exists hub_priority text,
  add column if not exists learning_phase text,
  add column if not exists url_status text,
  add column if not exists checked_at date,
  add column if not exists note text;

alter table public.ambulances
  alter column address drop not null,
  add column if not exists physicians text[] not null default '{}',
  add column if not exists insurers text[] not null default '{}',
  add column if not exists opening_hours jsonb not null default '{}'::jsonb,
  add column if not exists source_url text,
  add column if not exists data_status text not null default 'candidate'
    check (data_status in ('verified_e_vuc', 'verified_provider', 'candidate', 'needs_review')),
  add column if not exists last_verified_at date,
  add column if not exists contact_note text;

create index if not exists content_resources_published_title_idx
  on public.content_resources (is_published, title);
create index if not exists ambulances_active_region_city_idx
  on public.ambulances (active, region, city);

comment on column public.content_resources.topics is
  'Normalized public filter categories; source wording remains in topics_raw.';
comment on column public.content_resources.audience is
  'Normalized public audience categories; source wording remains in audience_raw.';
comment on column public.ambulances.address is
  'Public practice address. Null means that the source did not publish a verified address.';
comment on column public.ambulances.data_status is
  'Verification level for public directory data. Missing contact fields are left null, never inferred.';

grant select (
  external_id,
  name,
  provider,
  region,
  district,
  city,
  address,
  phone,
  email,
  website,
  physicians,
  insurers,
  opening_hours,
  source_url,
  data_status,
  last_verified_at,
  contact_note,
  accepts_new,
  earliest_date,
  capacity_updated_at,
  active,
  is_demo
) on public.ambulances to anon;

-- Guided journey, anonymous demand signals and passwordless clinic capacity updates.
-- The demand table contains coarse categories only: never names, contact details,
-- diagnoses, free text or device identifiers.
alter table public.ambulances
  add column if not exists capacity_status text not null default 'unknown'
    check (capacity_status in ('accepting', 'limited', 'full', 'call', 'unknown'));

alter table public.capacity_updates
  add column if not exists capacity_status text not null default 'unknown'
    check (capacity_status in ('accepting', 'limited', 'full', 'call', 'unknown')),
  add column if not exists note_public text check (note_public is null or char_length(note_public) <= 240),
  add column if not exists valid_until timestamptz;

alter table public.demands
  add column if not exists topic text not null default 'general'
    check (topic in ('anxiety', 'mood', 'self_harm', 'adhd', 'behaviour', 'bullying', 'eating', 'relationships', 'stress', 'school', 'trauma', 'general')),
  add column if not exists audience text not null default 'parent'
    check (audience in ('child', 'parent', 'teacher', 'professional')),
  add column if not exists support_type text not null default 'either'
    check (support_type in ('materials', 'ambulance', 'either')),
  add column if not exists urgency text not null default 'soon'
    check (urgency in ('information', 'soon', 'urgent_non_emergency')),
  add column if not exists source text not null default 'guided_journey'
    check (source in ('guided_journey', 'availability_search'));

create index if not exists ambulances_current_capacity_idx
  on public.ambulances (region, capacity_status, capacity_valid_until)
  where active = true and is_demo = false;
create index if not exists demands_anonymous_aggregate_idx
  on public.demands (region, age_band, topic, support_type, created_at desc);

-- A clinic magic link carries its public external_id and a random 256-bit token.
-- The Vercel function hashes the token before forwarding it. RLS compares the
-- hash with the row and the raw secret never reaches Postgres.
drop policy if exists "Magic link can update ambulance capacity" on public.ambulances;
create policy "Magic link can update ambulance capacity"
  on public.ambulances for update
  to anon
  using (
    active = true
    and update_token_hash is not null
    and update_token_hash = (
      coalesce(current_setting('request.headers', true), '{}')::jsonb
        ->> 'x-capacity-token-hash'
    )
  )
  with check (
    active = true
    and update_token_hash is not null
    and update_token_hash = (
      coalesce(current_setting('request.headers', true), '{}')::jsonb
        ->> 'x-capacity-token-hash'
    )
  );

-- Direct public reads expose only directory-safe columns. The token hash stays hidden.
grant select (
  id,
  age_min,
  age_max,
  slots_30d,
  note_public,
  capacity_valid_until,
  capacity_status
) on public.ambulances to anon;

grant update (
  accepts_new,
  earliest_date,
  slots_30d,
  note_public,
  capacity_updated_at,
  capacity_valid_until,
  capacity_status,
  last_verified_at,
  data_status,
  updated_at
) on public.ambulances to anon;

revoke insert on public.capacity_updates from anon;

revoke select on public.demands from anon, authenticated;
grant insert (
  region,
  age_band,
  radius_km,
  result_count,
  topic,
  audience,
  support_type,
  urgency,
  source
) on public.demands to anon;

comment on column public.ambulances.update_token_hash is
  'SHA-256 hash of a clinic capability token. Never expose through the public directory API.';
comment on table public.demands is
  'Anonymous aggregate demand only. No names, diagnoses, free text, emails, phone numbers or device identifiers.';
