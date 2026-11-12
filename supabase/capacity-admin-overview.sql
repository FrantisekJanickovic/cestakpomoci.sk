-- Administrator-only report, NOT a public Data API view.
-- No hashes, raw tokens, patient data, or private links are returned.
select
  a.external_id, a.name, a.city,
  case
    when a.update_token_hash is null then 'not_issued'
    when a.capacity_token_expires_at is null then 'migration_required'
    when a.capacity_token_expires_at <= now() then 'expired'
    else 'active'
  end as link_status,
  a.capacity_token_issued_at,
  a.capacity_token_expires_at,
  a.capacity_status,
  a.capacity_updated_at,
  a.capacity_valid_until,
  (select count(*) from public.capacity_updates h
   where h.ambulance_id = a.id) as audit_entries,
  (select max(h.created_at) from public.capacity_updates h
   where h.ambulance_id = a.id) as last_audit_at
from public.ambulances a
where a.active = true
order by a.name, a.external_id;
