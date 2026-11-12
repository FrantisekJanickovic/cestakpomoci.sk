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

## Dodatočná ochrana administrátorského API
- Migrácia `privileged_admin_api_rate_limit`: `public.admin_api_rate_limits` so zapnutým RLS a server-only funkcia `public.consume_admin_rate_limit`.
- Server používa HMAC klientovej IP adresy (so serverovým tajomstvom), nikde neukladá samotnú adresu ani bearer token.
- Maximálne 5 POST operácií/minútu a 30 GET/minútu na klienta. Pri prekročení vráti 429, pri chybe limitera 502.
- Nevyhnutná produkčná Vercel env `ADMIN_RATE_LIMIT_SECRET` s náhodnou hodnotou **najmenej 32 znakov**; musí byť `sensitive` alebo `encrypted`.
- Zostáva nastaviť **Supabase Auth rate limits a MFA** (prihlasovanie prebieha cez Supabase Auth priamo z prehliadača, nie cez admin-links API).
- Bez aktívneho admin účtu a kompletných produkčných env vars je správcovské rozhranie zámerne vypnuté.
- Stav pri overení: 0 v `auth.users` a 0 v `public.admin_users`; oprávnenie nemožno bezpečne udeliť bez overenej identity.

## Bezpečné pridelenie prvého admin účtu
1. V `https://supabase.com/dashboard/project/cxopqzxdtxjtuxzatldx/auth/users` vytvor/invituj konkrétneho správcu cez Auth (bez publikovania hesla v chate).
2. Over e-mail a identitu vlastníka účtu; zapni MFA a obmedz self-signup, ak to projekt nepotrebuje.
3. V administrátorskom SQL Editore over konkrétne `auth.users.id` a až potom pridaj používateľa do `public.admin_users`. Nepreber UUID ani e-mail od neoverených osôb.
4. V sekcii Vercel Environment Variables vytvor uvedené produkčné hodnoty, serverový secret key neukladaj do GitHubu alebo klientského JS.
5. Zlúč iba testovaný a schválený commit do `main`, nasadzuj na produkciu a otestuj s demo ambulanciou. Žiadne linky reálnych ambulancií zatiaľ nevydávaj.
