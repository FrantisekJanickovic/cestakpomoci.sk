# Produkčná databáza Cesta k pomoci — stav po rozšírení (12. 11. 2026)

Používaná databáza: Supabase projekt **volna-ambulancia**, ref `cxopqzxdtxjtuxzatldx`, Frankfurt (`eu-central-1`).

## Aplikované migrácie
1. `capacity_link_expiration_and_atomic_audit` (zdroj: `supabase/capacity-link-lifecycle.sql`).
   - Čas vydania a expirácie tokenu.
   - Existujúce vydané odkazy majú prechodnú 30-dňovú platnosť od migrácie.
   - RLS odmieta expirované tokeny.
   - Trigger atomicky zaznamenáva zmeny kapacity do `capacity_updates`.
2. `admin_accounts_and_link_event_audit` (zdroj: `supabase/staging-admin.sql`, hlavičkový komentár upravený pri aplikácii).
   - `admin_users` — ručne schvaľovaní správcovia.
   - `capacity_token_events` — audit vydania, rotácie a odvolania tokenov.
   - Obe tabuľky majú RLS enabled a bez verejných politík (deny-by-default); server-side secret/service role iba pre autorizované administrátorské API.

## Integrita overená po migráciách
- 60 ambulancií
- 83 zdrojov
- 2 historické záznamy kapacít
- 3 existujúce tokeny (prechodne platné)
- 0 admin účtov
- 0 nových udalostí vydania/rotácie/odvolania

## Aktivácia administrátorského panelu (ešte nevykonaná)
Kód `api/admin-links.js` a `api/admin-config.js` je aktualizovaný vo vývojovej vetve. V režime production použije výlučne `https://cxopqzxdtxjtuxzatldx.supabase.co`. API je vypnuté, kým nie sú splnené všetky tieto podmienky:
- Nasadenie z `main` do Vercel `production`, po review a schválených CI testoch.
- `ADMIN_ENABLED=true`, `ADMIN_ENVIRONMENT=production`.
- `ADMIN_SUPABASE_URL=https://cxopqzxdtxjtuxzatldx.supabase.co`.
- `NEXT_PUBLIC_SUPABASE_URL` musí byť rovnaké.
- `ADMIN_SUPABASE_PUBLISHABLE_KEY` — verejný Supabase publishable kľúč projektu.
- `ADMIN_SUPABASE_SECRET_KEY` — len server-side secret/service-role key, vo Vercel encrypted/sensitive env, nikdy nie na klientovi, v dokumente, Gite alebo logu.
- `ADMIN_APP_ORIGIN` — presná HTTPS doména live webu bez path alebo fragmentu.
- Manuálne vytvorený a overený Supabase Auth používateľ priradený do `public.admin_users` s `active=true`. Nepovoľovať samoregistráciu adminov.

Odporúčanie: pred aktiváciou MFA, perzistentné rate limiting, kontrola auditov a pozvánka iba overenej osobe. Bez toho nepovažovať admin panel za pripravený na produkčné používanie.

## Testy
Automatické GitHub CI testy: `node --test`, Playwright browser smoke a izolované PostgreSQL SQL testy. Posledný úspešný run: `43278207832`.
Žiadne testovanie cez produkčný admin účet zatiaľ neprebehlo (ešte neexistuje).

## Poznámka k nákladom a stagingu
Samostatný projekt `cestakpomoci-staging` bol vytvorený na používateľovu žiadosť v predchádzajúcom kroku; používateľ ho následne sám pozastavil. Produkčný zdroj pravdy zostáva `volna-ambulancia`; žiadna migrácia údajov do stagingu sa nerobila.
