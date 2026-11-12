-- Persistent API limiter for privileged admin endpoints.
-- Only the server-side service_role can invoke the function.
-- No raw IP addresses, access tokens, or clinic identifiers are stored.
begin;
create table if not exists public.admin_api_rate_limits (
  request_key text primary key check (request_key ~ '^[a-f0-9]{64}$'),
  used integer not null check (used >= 1),
  window_ends_at timestamptz not null
);
alter table public.admin_api_rate_limits enable row level security;
revoke all on public.admin_api_rate_limits from public, anon, authenticated;
grant select, insert, update, delete on public.admin_api_rate_limits to service_role;

create or replace function public.consume_admin_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  new_count integer;
begin
  if p_key is null or p_key !~ '^[a-f0-9]{64}$'
     or p_limit not between 1 and 120
     or p_window_seconds not between 10 and 3600 then
    raise exception 'Invalid limit settings' using errcode = '22023';
  end if;

  insert into public.admin_api_rate_limits as b(request_key, used, window_ends_at)
  values(p_key, 1, clock_timestamp() + make_interval(secs => p_window_seconds))
  on conflict(request_key) do update set
    used = case when b.window_ends_at <= clock_timestamp()
                then 1 else b.used + 1 end,
    window_ends_at = case when b.window_ends_at <= clock_timestamp()
                then clock_timestamp() + make_interval(secs => p_window_seconds)
                else b.window_ends_at end
  returning used into new_count;
  return new_count <= p_limit;
end;
$$;
revoke all on function public.consume_admin_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_admin_rate_limit(text, integer, integer) to service_role;
comment on function public.consume_admin_rate_limit(text, integer, integer)
  is 'Server-side persistent rate limiter, invoked only with service_role key. Key is a server-HMAC digest.';
commit;
