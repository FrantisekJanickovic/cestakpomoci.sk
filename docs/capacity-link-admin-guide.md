# Správa magic linkov — administrátorský postup

**Stav:** bezpečný databázový základ pripravený v GitHub vetve, **nenasadený v zdieľanej Supabase databáze**. Databázu používajú súčasne produkcia a preview. Bez oddeleného stagingu nespúšťať migračný SQL naživo bez kontrolovaného release plánu.

## Životný cyklus
- Správca vytvorí pre konkrétnu aktívnu ambulanciu náhodný 256-bitový token v Supabase SQL Editore.
- Uloží sa iba jeho SHA-256 hash a čas vydania/expirácie. Odkaz sa zobrazí **len pri vydaní**; nedá sa z databázy neskôr zrekonštruovať.
- Po 90 dňoch je odkaz neplatný. Opätovné vydanie okamžite zneplatní starý. Odvolanie nastaví hash aj metadáta na NULL.
- Údaj o kapacite sa nezávisle považuje za aktuálny len 14 dní. Expirovaný magic link teda **neznamená** automaticky zastaranú kapacitu a naopak.
- Zmeny kapacity (aj cez magic link) automaticky zapíše trigger do `capacity_updates`. Zápis a história sú atomické.

## Ako postupovať
1. Najprv vytvoriť oddelené staging Supabase prostredie alebo schváliť kontrolovanú migráciu so zálohou.
2. Na stagingu aplikovať `supabase/capacity-link-lifecycle.sql`, overiť migráciu, oprávnenia a testovaciu ambulanciu.
3. V `supabase/issue-capacity-link.sql` nahradiť identifikátor ambulancie a **skutočný otestovaný HTTPS origin**. Vydanie tokenu presne na 90 dní.
4. Skopírovať výsledný odkaz a poslať ho overenému kontaktu ambulancie bezpečným kanálom. Nepridávať do logov, screenshotov ani verejného ticketu.
5. V `supabase/capacity-admin-overview.sql` sa dá sledovať len stav (active/expired/not_issued), platnosť a história; tajný token ani hash sa nezobrazujú.
6. Pri podozrení na únik spustiť `supabase/revoke-capacity-link.sql` pre konkrétnu ambulanciu; následne vydať nový link.
7. Otestovať platný, expirovaný, odvolaný a rotovaný odkaz; porovnať počet a čas záznamov histórie.

## Existujúce odkazy
Migračný skript prideľuje existujúcim vydaným tokenom **prechodných 30 dní** od spustenia migrácie (ak dosiaľ nemajú dátumy). Neodstraňuje ich okamžite. Administrátor môže z bezpečnostných dôvodov všetky existujúce odkazy vedome zrotovať.

## Bezpečnostné obmedzenia
- **Administrátorský webový panel zatiaľ neexistuje.** Bez prihlásenia administrátora a autorizácie na serveri by stránka na vydávanie tokenov bola bezpečnostná chyba. SQL Editor je zatiaľ zámerne jediným správnym miestom pre tieto privilegované operácie.
- Nesmie sa používať service-role kľúč v prehliadači alebo vo verejnom repozitári.
- Jednorazový token možno používať opakovane až do expirácie alebo odvolania; „magic link“ tu znamená prístup bez hesla, nie jednorazové použitie.
- **Rate limiting zatiaľ chýba.** Pred pilotom odporúčame Vercel WAF/server-side rate limiting s perzistentným úložiskom. Nepoužívajte in-memory počítadlá vo Vercel Functions.
- Trigger ukladá status, dátum, počet miest, verejnú poznámku a čas; neukladá surový token. Existujúca tabuľka `capacity_updates` má `accepts_new NOT NULL`; pri stavoch bez explicitného boolean sa uloží `false` a rozhodujúci presný stav je `capacity_status`.
- Súčasný verejný formulár dovoľuje krátku verejnú poznámku; prevádzkové pravidlá musia zakazovať mená pacientov, diagnózy či osobné údaje.
- Dátumy a trvanie 90/30 dní sú prevádzkové východiská; pred pilotom ich treba potvrdiť s prevádzkovateľom.

## Pred produkciou
- SQL integration testy / izolovaná skúšobná databáza a manuálne testy s testovacou ambulanciou.
- Overenie RLS, schopnosti obnoviť DB zo zálohy a bezpečného spracovania tokenov.
- Následne bezpečná správcovská autentifikácia a až potom UI na vydávanie/rotáciu/odvolanie.
