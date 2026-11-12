-- Administrative revocation. Requires capacity-link-lifecycle.sql applied first.
-- Replace external ID and run in Supabase SQL Editor as an administrator.
-- No patient data is modified; prior link immediately stops authorizing updates.
update public.ambulances
set update_token_hash = null,
    capacity_token_issued_at = null,
    capacity_token_expires_at = null,
    updated_at = now()
where external_id = 'REPLACE_WITH_EXTERNAL_ID'
  and active = true
  and external_id <> 'REPLACE_WITH_EXTERNAL_ID'
returning name, external_id, updated_at as revoked_at;
