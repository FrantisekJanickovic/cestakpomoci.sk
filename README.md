# Cesta k pomoci

Technický základ slovenskej platformy, ktorá má prepájať:

- overené materiály o duševnom zdraví detí,
- postupy pre rodičov, učiteľov a odborníkov,
- aktuálnu kapacitu ambulancií detskej psychiatrie,
- bezpečné nasmerovanie ku krízovej alebo odbornej pomoci.

## Aktuálny stav

- aplikácia nasadená na [cestakpomoci-sk.vercel.app](https://cestakpomoci-sk.vercel.app),
- produkčný Vercel projekt je prepojený s vetvou `main`,
- Supabase databáza vo Frankfurte je aktívna a prepojená cez publishable key,
- nasadená databázová schéma je zachytená v `supabase/schema.sql`,
- verejná knižnica obsahuje 83 klasifikovaných a publikovaných zdrojov,
- adresár ambulancií odlišuje aktuálne a zastarané kontakty aj kapacitné hlásenia,
- šesťkrokový sprievodca odporúča materiály a ambulancie bez pýtania mena, kontaktu či diagnózy,
- akútna situácia preskočí priamo na krízovú pomoc a neodosiela sa do analytiky,
- anonymná analytika ukladá iba široký vek, kraj, tému, typ pomoci a počet výsledkov,
- každá ambulancia môže aktualizovať svoju kapacitu vlastným odkazom bez hesla; platnosť údaja je 14 dní,
- kontakty staršie než 90 dní a expirovaná kapacita sa automaticky označia na opätovné overenie.

## Databázové moduly

1. `ambulances` – verejný register ambulancií a ich aktuálna kapacita,
2. `ambulance_members` – oprávnení pracovníci ambulancií,
3. `capacity_updates` – časovo platné hlásenia o kapacite,
4. `demands` – anonymný agregovaný dopyt bez kontaktných a zdravotných údajov,
5. `content_resources` – overené slovenské a zahraničné zdroje,
6. `learning_paths` a `learning_path_steps` – usporiadané cesty podľa situácie.

Všetky tabuľky v schéme `public` majú zapnuté Row Level Security. Verejnosť môže čítať iba publikované údaje. Zápis kapacity povoľuje politika iba ambulancii s presným hashom jej náhodného odkazu; surový token sa v databáze neukladá. Aplikácia nepoužíva `service_role` kľúč.

## Vydanie odkazu ambulancii

Administrátor spustí `supabase/issue-capacity-link.sql` v Supabase SQL Editore po nahradení `REPLACE_WITH_EXTERNAL_ID`. Dotaz vytvorí nový náhodný token, uloží iba jeho SHA-256 hash a jednorazovo vráti odkaz pre ambulanciu. Odkaz posielajte overenému kontaktu ambulancie a pri zmene personálu ho vymeňte za nový.

## Lokálne spustenie

Úvodná stránka je zámerne bez build kroku. Stačí ju otvoriť cez ľubovoľný statický HTTP server:

```bash
npx serve .
```

## Prevádzkové ďalšie kroky

1. pripojiť zakúpenú doménu `cestakpomoci.sk`,
2. vybrať 3–5 pilotných ambulancií a vydať im individuálne odkazy,
3. nastaviť vlastníka a rytmus redakčného overovania kontaktov,
4. sledovať iba agregované metriky nedostatku pomoci,
5. po pilote doplniť administrátorský panel a rotáciu odkazov.

