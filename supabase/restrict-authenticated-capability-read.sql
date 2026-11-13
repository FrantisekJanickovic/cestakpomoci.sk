-- Security-only ACL correction. Does NOT modify clinic magic-link issuance,
-- verification, rotation, expiry, existing data or capacity-write RLS policies.
begin;
revoke select on table public.ambulances from authenticated;
-- Preserve the ability to read ordinary ambulance fields for verified staff,
-- while never exposing capability hashes or administrative token timestamps.
do $$
declare allowed_columns text;
begin
 select string_agg(format('%I',column_name),', ' order by ordinal_position)
 into allowed_columns
 from information_schema.columns
 where table_schema='public' and table_name='ambulances'
   and column_name not in (
     'update_token_hash', 'capacity_token_issued_at', 'capacity_token_expires_at'
   );
 if allowed_columns is null then
   raise exception 'ambulances table is missing';
 end if;
 execute format('grant select (%s) on public.ambulances to authenticated',allowed_columns);
end $$;
-- Revoke possible explicit per-column permissions too, defense in depth.
revoke select (update_token_hash,capacity_token_issued_at,capacity_token_expires_at)
 on public.ambulances from authenticated,anon;
commit;
