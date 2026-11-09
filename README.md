# Cesta k pomoci

Technický základ slovenskej platformy, ktorá má prepájať:

- overené materiály o duševnom zdraví detí,
- postupy pre rodičov, učiteľov a odborníkov,
- aktuálnu kapacitu ambulancií detskej psychiatrie,
- bezpečné nasmerovanie ku krízovej alebo odbornej pomoci.

## Aktuálny stav

- statická úvodná stránka nasadená na [cestakpomoci-sk.vercel.app](https://cestakpomoci-sk.vercel.app),
- produkčný Vercel projekt je prepojený s vetvou `main`,
- Supabase databáza vo Frankfurte je aktívna a prepojená cez publishable key,
- nasadená databázová schéma je zachytená v `supabase/schema.sql`,
- verejná knižnica obsahuje 83 klasifikovaných a publikovaných zdrojov,
- adresár ambulancií odlišuje overené kontakty od kandidátov čakajúcich na kontrolu,
- používateľské zdravotné údaje sa v tejto fáze nezbierajú,
- verejné údaje sú oddelené od účtov pracovníkov ambulancií,
- kapacitné hlásenia sú navrhnuté ako append-only záznamy s auditnou stopou.

## Databázové moduly

1. `ambulances` – verejný register ambulancií a ich aktuálna kapacita,
2. `ambulance_members` – oprávnení pracovníci ambulancií,
3. `capacity_updates` – časovo platné hlásenia o kapacite,
4. `demands` – anonymný agregovaný dopyt bez kontaktných a zdravotných údajov,
5. `content_resources` – overené slovenské a zahraničné zdroje,
6. `learning_paths` a `learning_path_steps` – usporiadané cesty podľa situácie.

Všetky tabuľky v schéme `public` majú zapnuté Row Level Security. Verejnosť môže čítať iba publikované údaje. Kapacitu môže odoslať iba prihlásený aktívny člen príslušnej ambulancie.

## Lokálne spustenie

Úvodná stránka je zámerne bez build kroku. Stačí ju otvoriť cez ľubovoľný statický HTTP server:

```bash
npx serve .
```

## Ďalší krok

1. pripojiť zakúpenú doménu `cestakpomoci.sk`,
2. doplniť prihlasovanie a onboarding pracovníkov ambulancií,
3. vytvoriť formulár na odosielanie kapacity,
4. pokračovať v redakčnom overovaní kontaktov ambulancií,
5. dopracovať vedenú funkciu „Nájsť moju cestu“.

