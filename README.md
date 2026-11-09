# Cesta k pomoci

Technický základ slovenskej platformy, ktorá má prepájať:

- overené materiály o duševnom zdraví detí,
- postupy pre rodičov, učiteľov a odborníkov,
- aktuálnu kapacitu ambulancií detskej psychiatrie,
- bezpečné nasmerovanie ku krízovej alebo odbornej pomoci.

## Aktuálny stav

- statická úvodná stránka pripravená na Vercel,
- databázová schéma pripravená v `supabase/schema.sql`,
- používateľské zdravotné údaje sa v tejto fáze nezbierajú,
- verejné údaje sú oddelené od účtov pracovníkov ambulancií,
- kapacitné hlásenia sú navrhnuté ako append-only záznamy s auditnou stopou.

## Databázové moduly

1. `clinics` – verejný register ambulancií,
2. `clinic_members` – oprávnení pracovníci ambulancií,
3. `capacity_updates` – časovo platné hlásenia o kapacite,
4. `content_resources` – overené slovenské a zahraničné zdroje,
5. `learning_paths` a `learning_path_steps` – usporiadané cesty podľa situácie.

Všetky tabuľky v schéme `public` majú zapnuté Row Level Security. Verejnosť môže čítať iba publikované údaje. Kapacitu môže odoslať iba prihlásený aktívny člen príslušnej ambulancie.

## Lokálne spustenie

Úvodná stránka je zámerne bez build kroku. Stačí ju otvoriť cez ľubovoľný statický HTTP server:

```bash
npx serve .
```

## Ďalší krok

Po aktivovaní Supabase projektu:

1. aplikovať a overiť `supabase/schema.sql`,
2. nastaviť URL projektu a publishable key vo Verceli,
3. doplniť prihlasovanie pracovníkov ambulancií,
4. vytvoriť formulár na odosielanie kapacity a verejné vyhľadávanie.

