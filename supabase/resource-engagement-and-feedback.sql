-- New material engagement and moderated public feedback. Never expose visitor identifiers.
begin;
alter table public.content_resources
 add column if not exists open_count bigint not null default 0 check(open_count>=0),
 add column if not exists rating_sum bigint not null default 0 check(rating_sum>=0),
 add column if not exists rating_count integer not null default 0 check(rating_count>=0);
create table if not exists public.resource_feedback (
 id uuid primary key default gen_random_uuid(),
 resource_id uuid not null references public.content_resources(id) on delete cascade,
 display_name text not null default 'Anonym',
 body text not null check(char_length(body) between 8 and 1200),
 rating smallint not null check(rating between 1 and 5),
 actor_hash text not null check(actor_hash ~ '^[a-f0-9]{64}$'),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(),
 reviewed_at timestamptz
);
create index if not exists resource_feedback_review_idx on public.resource_feedback(status,created_at desc);
create index if not exists resource_feedback_resource_idx on public.resource_feedback(resource_id,status,created_at desc);
create unique index if not exists resource_feedback_unique_actor on public.resource_feedback(resource_id,actor_hash)
 where status in ('pending','approved');
alter table public.resource_feedback enable row level security;
revoke all on public.resource_feedback from public,anon,authenticated;
-- All mutations occur server-side with an authenticated service secret.
-- Review changes happen through privileged manual administration only.
create or replace function public.record_resource_open(p_resource_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
 update public.content_resources set open_count=open_count+1 where id=p_resource_id and is_published;
end $$;
revoke all on function public.record_resource_open(uuid) from public,anon,authenticated;
grant execute on function public.record_resource_open(uuid) to service_role;
create or replace function public.refresh_resource_feedback_rating()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and new.status=old.status and new.rating=old.rating and new.resource_id=old.resource_id then return new; end if;
 if tg_op='DELETE' then
  update public.content_resources set
    rating_sum=greatest(0,rating_sum-case when old.status='approved' then old.rating else 0 end),
    rating_count=greatest(0,rating_count-case when old.status='approved' then 1 else 0 end)
   where id=old.resource_id; return old;
 end if;
 if tg_op='UPDATE' then
  update public.content_resources set
    rating_sum=greatest(0,rating_sum-case when old.status='approved' then old.rating else 0 end),
    rating_count=greatest(0,rating_count-case when old.status='approved' then 1 else 0 end)
   where id=old.resource_id;
 end if;
 if new.status='approved' then
  update public.content_resources set rating_sum=rating_sum+new.rating,rating_count=rating_count+1 where id=new.resource_id;
 end if;
 return new;
end $$;
drop trigger if exists resource_feedback_update_stats on public.resource_feedback;
create trigger resource_feedback_update_stats after insert or update or delete on public.resource_feedback
for each row execute function public.refresh_resource_feedback_rating();
-- Existing catalog stays readable but source IDs and count columns are safe public metadata.
commit;