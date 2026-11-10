-- Jednorazovo spustite ako administrátor v Supabase SQL Editore.
-- Nahraďte iba REPLACE_WITH_EXTERNAL_ID hodnotou ambulances.external_id.
-- Výsledný odkaz skopírujte hneď; surový token sa nikde neukladá.

with secret as (
  select encode(gen_random_bytes(32), 'hex') as raw_token
), updated as (
  update public.ambulances as ambulance
  set
    update_token_hash = encode(digest(secret.raw_token, 'sha256'), 'hex'),
    updated_at = now()
  from secret
  where ambulance.external_id = 'REPLACE_WITH_EXTERNAL_ID'
    and ambulance.active = true
  returning ambulance.external_id, ambulance.name
)
select
  updated.name,
  'https://cestakpomoci.sk/#kapacita/' || updated.external_id || '/' || secret.raw_token as capacity_link
from updated
cross join secret;
