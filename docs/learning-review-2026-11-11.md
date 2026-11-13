# Learning Paths — pripravené na odbornú revíziu (11. 11. 2026)

## Implementované
- Šesť tematických ciest: úzkosť, nálada, pozornosť/ADHD, správanie, škola, spánok.
- Každá cesta má tri redakčne pripravené bezpečné kroky.
- K dispozícii na stránke Zdroje; odporúčanie vhodnej cesty sa zobrazuje aj po vyplnení orientačného dotazníka.
- K téme sa ponúkajú súvisiace už publikované materiály z adresára; žiadne nové zdroje neboli označené za overené.
- Označenie dokončených krokov zostáva iba v pamäti otvorenej stránky. Žiadne konto, zdravotné údaje ani výsledky cesty sa neukladajú.

## Dôležité obmedzenia
- Obsah v `learning-paths.js` je **redakčný návrh**, ktorý ešte neschválil detský psychiater / klinický psychológ.
- Súčasné databázové tabuľky `learning_paths` a `learning_path_steps` ostávajú prázdne; zámerne nebolo nič publikované ani zmenené v spoločnej produkčnej databáze.
- Pokrok sa po opätovnom načítaní stránky resetuje; neprezentovať ako trvalé sledovanie.
- Dotazník filtruje ambulancie podľa kraja, nie reálnej cestnej vzdialenosti. Radiálne voľby boli z UI odstránené.
- Pri okamžitom ohrození dotazník prechádza na krízové kontakty. Pri téme sebapoškodzovania sa žiadna generická vzdelávacia cesta automaticky neponúka.

## Klinický a redakčný release gate
1. Skontrolovať presné formulácie všetkých 18 krokov, vekovú primeranosť a varovné signály.
2. Overiť aktuálnosť tiesňových čísel a krízových liniek na Slovensku.
3. Rozlíšiť orientáciu od diagnostiky; preskúšať scenáre s akútnym rizikom.
4. Overiť relevanciu automaticky odporúčaných verejných materiálov.
5. Na mobile aj desktope prejsť každý zo šiestich krokov orientačného dotazníka, možnosť Späť, krízovú vetvu a otvorenie vzdelávacej cesty.
6. Nezlučovať draft PR do `main` pred schválením odborného obsahu a bezpečnostných blokátorov aktualizácie kapacity.

## Technické testy
- `node --check app.js && node --check learning-paths.js`
- `node --test tests/*.test.cjs`
- Preview nasadenie Vercel musí byť `READY`, následne urobiť reálne browser E2E testy.
