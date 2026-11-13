-- Multilingual library taxonomy; do not replace legacy language_code/origin.
begin;
alter table public.content_resources
  add column if not exists source_country_code text
    check (source_country_code is null or source_country_code ~ '^[A-Z]{2,3}$'),
  add column if not exists original_language_code text
    check (original_language_code is null or original_language_code ~ '^[a-z]{2,3}$'),
  add column if not exists available_language_codes text[] not null default '{}',
  add column if not exists excerpt_sk text
    check (excerpt_sk is null or char_length(excerpt_sk)<=1800),
  add column if not exists language_verified_at date;
-- All existing sources have Slovak available versions per catalogue metadata.
update public.content_resources
set source_country_code=case external_id
    when 'SK072' then 'AU'
    when 'SK044' then 'GB'
    when 'SK037' then 'INT'
    else 'SK' end,
    original_language_code=case external_id
    when 'SK072' then 'en'
    when 'SK044' then 'en'
    when 'SK037' then null -- international consortium, first authored language not established
    else 'sk' end,
    available_language_codes=ARRAY['sk']::text[],
    language_verified_at=current_date
where external_id like 'SK%' and available_language_codes='{}'::text[];
-- For legacy hotline: UA/RU are support languages, not verified publication languages.
-- Keep availability as [sk] until exact translations of a document are verified.
create index if not exists content_resources_language_codes_gin
  on public.content_resources using gin(available_language_codes)
  where is_published=true;
create index if not exists content_resources_country_idx
  on public.content_resources(source_country_code)
  where is_published=true;
grant select (source_country_code,original_language_code,available_language_codes,excerpt_sk,language_verified_at)
  on public.content_resources to anon,authenticated;
comment on column public.content_resources.source_country_code is
 'Country of source organization or original program, ISO country code or INT for multinational initiative.';
comment on column public.content_resources.original_language_code is
 'Language of first authored version, null when it cannot be verified; do not infer from country.';
comment on column public.content_resources.available_language_codes is
 'Verified full resource languages, not translation of our catalogue summary or hotline support.';
comment on column public.content_resources.excerpt_sk is
 'Editorial Slovak synopsis of external material; not a licensed translation and not medical advice.';
commit;
