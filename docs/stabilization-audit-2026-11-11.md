# Technická stabilizácia – 2026-11-11

## Overené
- GitHub feature branch je oddelený od `main`; produkčný deployment zostal na `main`.
- Vercel preview deployment po zmenách dosiahol `READY`.
- Supabase projekt `volna-ambulancia` je `ACTIVE_HEALTHY`.
- Supabase security advisors: 0 nálezov.
- Supabase performance advisors: 1 varovanie `auth_rls_initplan` a 15 informačných hlásení o nepoužitých indexoch (neodstraňovať bez merania).
- API validácia: 10 izolovaných scenárov ručne odskúšaných proti aktuálnemu kódu s mockovaným upstreamom; všetky prešli.

## Implementované vo feature vetve
- Horný limit 8 s pri volaniach Supabase vo všetkých štyroch API endpointoch.
- Strict ISO kalendárna validácia dátumu v kapacitnom formulári (odmieta nemožné dátumy).
- 64-znakový hex token; neprípustný vstup sa odmietne pred dotykom s databázou.
- Poznámky dlhšie než 240 znakov sa odmietnu namiesto tichého orezania.
- Povolené HTTP metódy sa kontrolujú pred prístupom do DB; no-store na kapacite a anonymnej analytike.
- Krízová vetva `urgency=crisis|emergency` sa nesmie ukladať do anonymnej analytiky.
- Regressné testy v `tests/api.test.cjs` a workflow `.github/workflows/api-tests.yml`.

## Otvorené riziká – pred pilotom
1. **Capacity audit trail:** Priama PATCH aktualizácia z magic linku nevyvoláva append-only zápis do `capacity_updates`. README preto nesmie naznačovať, že história týchto zápisov je auditovaná. Doplniť DB trigger/transactional RPC s kontrolou oprávnenia a otestovať.
2. **Magic link lifecycle:** Token má 256 bitov, je uložený hashovaný a dá sa rotovať, ale nie je časovo obmedzený; doručenie a revokácia sú manuálne. Pred pilotom doplniť expiráciu a bezpečný proces vydania/obnovenia odkazu.
3. **Rate limiting:** `/api/capacity` a `/api/demand` nemajú nezávislé server-side/IP rate limiting. Pred verejným spustením doplniť limitovanie aj mimo in-memory stavu serverless funkcie.
4. **Content privacy:** Text verejnej poznámky môže byť vyplnený človekom a môže obsahovať citlivé údaje; samotný UI oznam nie je technickou prevenciou. Zaviesť prevádzkové pravidlá, kontrolu/moderáciu a bezpečné odstránenie omylom zadaných údajov.
5. **Shared DB:** Preview aj produkcia používajú ten istý Supabase projekt; úpravy schémy/politík vyžadujú samostatne kontrolovaný rollout a testovanie, žiadne ad-hoc zmeny.
6. **RLS performance:** Politika `Magic link can update ambulance capacity` vykonáva `current_setting()` na riadok; vyhodnotiť pri optimalizácii. Nemení sa v rámci bezpečného API hotfixu.
7. **Live E2E:** Izolované testy a READY deploy nepotvrdzujú kompletný formulár s reálnou DB. Otestovať neplatný/revokovaný/platný token na neprodukčnej ambulancii a skontrolovať, že verejný zoznam má správne stale flagy.

## Release gate
Neprepájať `feature/guided-journey-mvp` do `main`, kým neprejdú GitHub Actions, E2E magic link s testovacou ambulanciou a kontrola súkromia. Nevydávať reálne odkazy pred vyriešením audit trail a lifecycle.
