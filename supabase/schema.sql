-- Cesta k pomoci: initial database schema.
-- This script is intentionally idempotent only for a fresh project.
-- It stores service and capacity information, never a child's diagnosis or medical record.

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  provider_code text unique,
  clinic_type text not null default 'child_psychiatry'
    check (clinic_type in ('child_psychiatry', 'clinical_psychology', 'counselling', 'other')),
  region text not null,
  district text,
  municipality text not null,
  address_public text,
  phone_public text,
  email_public text,
  website_url text,
  age_min smallint check (age_min is null or age_min between 0 and 25),
  age_max smallint check (age_max is null or age_max between 0 and 25),
  insurers text[] not null default '{}',
  is_published boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (age_min is null or age_max is null or age_min <= age_max)
);

create table public.clinic_members (
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'reporter'
    check (member_role in ('reporter', 'clinic_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (clinic_id, user_id)
);

create table public.capacity_updates (
  id bigint generated always as identity primary key,
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  availability_status text not null
    check (availability_status in ('available', 'waitlist', 'closed', 'unknown')),
  earliest_available_date date,
  approximate_wait_weeks smallint
    check (approximate_wait_weeks is null or approximate_wait_weeks between 0 and 260),
  available_slots smallint
    check (available_slots is null or available_slots between 0 and 1000),
  accepts_new_patients boolean not null default false,
  public_note text check (public_note is null or char_length(public_note) <= 500),
  valid_until timestamptz not null,
  submitted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  check (valid_until > created_at)
);

create table public.content_resources (
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

create table public.learning_paths (
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

create table public.learning_path_steps (
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

create index clinics_public_location_idx
  on public.clinics (region, district, municipality)
  where is_published = true;
create index clinic_members_user_idx
  on public.clinic_members (user_id, clinic_id)
  where is_active = true;
create index capacity_updates_clinic_created_idx
  on public.capacity_updates (clinic_id, created_at desc);
create index content_resources_topics_idx
  on public.content_resources using gin (topics);
create index content_resources_audience_idx
  on public.content_resources using gin (audience);
create index learning_path_steps_path_order_idx
  on public.learning_path_steps (learning_path_id, step_order);

alter table public.clinics enable row level security;
alter table public.clinic_members enable row level security;
alter table public.capacity_updates enable row level security;
alter table public.content_resources enable row level security;
alter table public.learning_paths enable row level security;
alter table public.learning_path_steps enable row level security;

create policy "Published clinics are public"
  on public.clinics for select
  to anon, authenticated
  using (is_published = true);

create policy "Members can read their clinic"
  on public.clinics for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_members membership
      where membership.clinic_id = clinics.id
        and membership.user_id = (select auth.uid())
        and membership.is_active = true
    )
  );

create policy "Clinic admins can update their clinic"
  on public.clinics for update
  to authenticated
  using (
    exists (
      select 1 from public.clinic_members membership
      where membership.clinic_id = clinics.id
        and membership.user_id = (select auth.uid())
        and membership.member_role = 'clinic_admin'
        and membership.is_active = true
    )
  )
  with check (
    exists (
      select 1 from public.clinic_members membership
      where membership.clinic_id = clinics.id
        and membership.user_id = (select auth.uid())
        and membership.member_role = 'clinic_admin'
        and membership.is_active = true
    )
  );

create policy "Members can read their own memberships"
  on public.clinic_members for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Valid capacity is public"
  on public.capacity_updates for select
  to anon, authenticated
  using (
    valid_until >= now()
    and exists (
      select 1 from public.clinics clinic
      where clinic.id = capacity_updates.clinic_id
        and clinic.is_published = true
    )
  );

create policy "Members can read their clinic capacity history"
  on public.capacity_updates for select
  to authenticated
  using (
    exists (
      select 1 from public.clinic_members membership
      where membership.clinic_id = capacity_updates.clinic_id
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
      select 1 from public.clinic_members membership
      where membership.clinic_id = capacity_updates.clinic_id
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

create view public.current_clinic_capacity
with (security_invoker = true)
as
select
  clinic.id as clinic_id,
  clinic.name,
  clinic.clinic_type,
  clinic.region,
  clinic.district,
  clinic.municipality,
  clinic.address_public,
  clinic.phone_public,
  clinic.email_public,
  clinic.website_url,
  clinic.age_min,
  clinic.age_max,
  clinic.insurers,
  latest.availability_status,
  latest.earliest_available_date,
  latest.approximate_wait_weeks,
  latest.available_slots,
  latest.accepts_new_patients,
  latest.public_note,
  latest.valid_until,
  latest.created_at as capacity_reported_at
from public.clinics clinic
left join lateral (
  select update_row.*
  from public.capacity_updates update_row
  where update_row.clinic_id = clinic.id
    and update_row.valid_until >= now()
  order by update_row.created_at desc
  limit 1
) latest on true
where clinic.is_published = true;

revoke all on public.clinics from anon, authenticated;
revoke all on public.clinic_members from anon, authenticated;
revoke all on public.capacity_updates from anon, authenticated;
revoke all on public.content_resources from anon, authenticated;
revoke all on public.learning_paths from anon, authenticated;
revoke all on public.learning_path_steps from anon, authenticated;

grant select on public.clinics to anon, authenticated;
grant update on public.clinics to authenticated;
grant select on public.clinic_members to authenticated;
grant select on public.capacity_updates to anon, authenticated;
grant insert on public.capacity_updates to authenticated;
grant usage, select on sequence public.capacity_updates_id_seq to authenticated;
grant select on public.content_resources to anon, authenticated;
grant select on public.learning_paths to anon, authenticated;
grant select on public.learning_path_steps to anon, authenticated;
grant select on public.current_clinic_capacity to anon, authenticated;

grant all on public.clinics to service_role;
grant all on public.clinic_members to service_role;
grant all on public.capacity_updates to service_role;
grant all on public.content_resources to service_role;
grant all on public.learning_paths to service_role;
grant all on public.learning_path_steps to service_role;
grant all on sequence public.capacity_updates_id_seq to service_role;

comment on table public.capacity_updates is
  'Append-only availability reports submitted by verified clinic members.';
comment on column public.capacity_updates.public_note is
  'Public operational note only. Never store a diagnosis or other child health data.';

