# Staging Supabase + správcovský panel – bezpečný prevádzkový postup

## Stav k 12. 11. 2026
- Kód administrácie je vo feature vetve a v preview nasadení. **Nie je zapnutá**: chýba samostatný Supabase projekt, admin účet a preview env vars.
- Produkčný Supabase projekt `cxopqzxdtxjtuxzatldx` sa nesmie používať v staging administrácii a API to kontroluje.
- Všetky mutácie magic linkov sú zakázané na Vercel `production` a bez `ADMIN_ENVIRONMENT=staging`.
- Vydaný odkaz funguje iba vtedy, keď verejný preview formulár a admin API používajú **tú istú** staging databázu.

## Vytvorenie staging projektu
1. Potvrdiť organizáciu Supabase, v ktorej môže vzniknúť nový projekt, a skontrolovať prípadný účtovaný náklad. Nezakladať ani nemať náklad bez schválenia.
2. Vytvoriť samostatný projekt `cestakpomoci-staging` v `eu-central-1`.
3. Naimportovať len nevyhnutnú schému existujúcich tabuliek (ambulances, capacity_updates a súvisiace tabuľky) zo schválených migrácií. **Neimportovať produkčné kontakty, tokeny, históriu či identifikátory používateľov.** Testovať na syntetických ambulanciách.
4. Po základnej schéme aplikovať `supabase/schema.sql`, `supabase/capacity-link-lifecycle.sql` a `supabase/staging-admin.sql` v tomto poradí, s kontrolou výstupu každého kroku. Súčasný `supabase/schema.sql` je *additive* nad základnou schémou, nejde o kompletnú fresh-install migráciu.
5. V staging Auth vytvoriť **ručne** administrátorský účet s bezpečným heslom a potvrdenou e-mailovou adresou. Pridelenie oprávnenia sa vykoná ručne až po overení UUID: `insert into public.admin_users (user_id, active) values ('UUID', true) on conflict (user_id) do update set active = true;`.
6. V stagingu overiť `get_advisors` security/performance, RLS a pilotný test issuing/revocation.

## Nastavenie Vercel preview (iba branch-scoped)
Do projektových Vercel env vars viazaných výlučne na `feature/guided-journey-mvp`:
- `NEXT_PUBLIC_SUPABASE_URL` = URL nového staging projektu
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = staging publishable key
- `ADMIN_ENVIRONMENT` = `staging`
- `ADMIN_SUPABASE_URL` = presne rovnaké URL staging projektu
- `ADMIN_SUPABASE_PUBLISHABLE_KEY` = staging publishable key
- `ADMIN_SUPABASE_SECRET_KEY` = **iba server-side, encrypted/sensitive** staging secret key alebo service-role kľúč (nikdy nie produkčný)
- `ADMIN_APP_ORIGIN` = presná stabilná HTTPS URL preview, na ktorej sú admin aj kapacitný formulár. Nedávajte sem path ani fragment.

Pozor: Vercel pre každý commit môže vytvoriť novú neprenosnú preview URL. Pre `ADMIN_APP_ORIGIN` použiť stabilne priradený preview hostname alebo vlastný staging subdomain. Rotačné odkazy musia zostať použiteľné po ďalšom commite.

Produkčné env vars nikdy neprepisovať. Po zmene branch-scoped env vars vytvoriť nový preview deployment a potvrdiť jeho env a Git commit.

## Panel
- `/admin.html` — používateľské rozhranie.
- `/api/admin-config` — vracia len staging Supabase URL a publishable key.
- `/api/admin-links` — po overení bearer tokenu voči staging Supabase Auth kontroluje aktívneho správcu v `admin_users`; bez oprávnenia vracia 403.
- `GET` zobrazuje anonymizovaný prehľad stavu linkov. `POST` umožňuje vydať nový alebo odvolať existujúci odkaz.
- Tajný token sa generuje náhodne na serveri, ukladá sa iba SHA-256, a klient ho zobrazí len raz v dialógu. V databáze sa ukladajú auditné udalosti issued/rotated/revoked bez tokenu.
- Token je v pamäti otvorenej stránky; samotné prihlásenie nie je perzistentné. Neposiela sa cookie.
- Akákoľvek chyba v konfigurácii spôsobí fail-closed 503.

## Záverečné bezpečnostné požiadavky pred live pilotom
- Otestovať rotáciu a odvolanie cez **reálne** staging API. Overiť, že neautorizovaný používateľ nikdy nevidí údaje ani nevykoná zmenu.
- Pridať rate limiting a abuse ochranu na API aj Auth loginy; zvážiť/požadovať MFA pre prevádzkového administrátora.
- Vykonať kontrolu CSRF, CSP, origin, úniku tokenov cez Referrer, cloud logy a audit stopy.
- Posúdiť, či má byť admin panel dostupný na samostatnom internom hostname a izolovaný od verejného webu.
- Pred akýmkoľvek nasadením do produkcie musí byť schválená schéma, migrácia, oprávnenia a záloha; funkčné testy v izolovanej CI Postgres DB nenahrádzajú reálne staging E2E.
