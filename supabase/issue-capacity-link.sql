-- Spustiť manuálne iba ako správca v Supabase SQL Editore.
-- Najprv aplikujte supabase/capacity-link-lifecycle.sql a overte ho.
-- Nahraďte ID a presnú HTTPS origin adresu reálne otestovaného deploymentu.
-- Pozor: vydanie nového odkazu okamžite zneplatní predchádzajúci.
-- Surový token sa vráti LEN v tomto výsledku; nikde sa neukladá.
-- Neposielajte výslednú URL do logov ani do GitHubu.

with settings as (
  select 'REPLACE_WITH_EXTERNAL_ID'::text as external_id,
         'https://REPLACE_WITH_DEPLOYMENT_ORIGIN'::text as app_origin
), secret as materialized (
  select encode(gen_random_bytes(32), 'hex') as raw_token
), updated as (
  update public.ambulances as a
  set update_token_hash = encode(digest(secret.raw_token, 'sha256'), 'hex'),
      capacity_token_issued_at = now(),
      capacity_token_expires_at = now() + interval '90 days',
      updated_at = now()
  from settings, secret
  where a.external_id = settings.external_id and a.active = true
    and settings.external_id <> 'REPLACE_WITH_EXTERNAL_ID'
    and settings.app_origin ~ '^https://[a-zA-Z0-9.-]+(:[0-9]+)?$'
    and settings.app_origin not like '%REPLACE%'
  returning a.external_id, a.name, a.capacity_token_expires_at
)
select updated.name, updated.capacity_token_expires_at as link_expires_at,
  settings.app_origin || '/#kapacita/' || updated.external_id || '/' || secret.raw_token as capacity_link
from updated cross join secret cross join settings;
