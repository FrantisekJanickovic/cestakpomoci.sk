begin;
create table if not exists public.resource_feedback_daily_limits(
 actor_hash text not null check(actor_hash ~ '^[a-f0-9]{64}$'),
 day date not null,
 attempts integer not null default 0 check(attempts>=0),
 primary key(actor_hash,day)
);
alter table public.resource_feedback_daily_limits enable row level security;
revoke all on public.resource_feedback_daily_limits from public,anon,authenticated;
create or replace function public.consume_resource_feedback_quota(p_hash text,p_day date)
returns boolean language plpgsql security definer set search_path=public as $$
declare quota integer;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_day<>current_date then return false; end if;
 insert into public.resource_feedback_daily_limits(actor_hash,day,attempts)
 values(p_hash,p_day,1)
 on conflict(actor_hash,day) do update set attempts=public.resource_feedback_daily_limits.attempts+1
 where public.resource_feedback_daily_limits.attempts<5
 returning attempts into quota;
 return quota is not null and quota<=5;
end $$;
revoke all on function public.consume_resource_feedback_quota(text,date) from public,anon,authenticated;
grant execute on function public.consume_resource_feedback_quota(text,date) to service_role;
commit;