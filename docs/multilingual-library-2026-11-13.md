# Multijazyčná knižnica – metodika a výskum, 13. 11. 2026

## Rozsah
- 83 pôvodných slovenských položiek klasifikovaných; dostupná slovenská verzia podľa predchádzajúcich katalógových údajov.
- 35 nových položiek z rešerše autoritatívnych zdrojov (CZ 9, GB 6, DE 2, FI 8, medzinárodné organizácie 10; finálne počty vždy over SQL).
- 5 pilotných slovenských anotácií: INT001–INT005.
- Doplnené tri filtre: dostupný jazyk, pôvodný jazyk, krajina pôvodu. Výber sa kombinuje s vekovou skupinou, témou, publikom a vyhľadávaním.

## Dátové pravidlá
- `source_country_code`: krajina pôvodu pôvodného programu / vydavateľa; `INT` pre nadnárodné organizácie alebo spoluprácu.
- `original_language_code`: jazyk prvého originálu **iba pri dostatočnom dôkaze**. Null = neoverený, nie automaticky fínčina pri fínskom vydavateľovi.
- `available_language_codes`: jazyky plnej dostupnej externej publikácie; nie jazyk slovenského anotovaného záznamu, nie jazyk telefonickej podpory.
- `excerpt_sk`: vlastná krátka slovenská anotácia, nie plný preklad alebo kópia autorského textu. Zachovávať prístup na originálny web.
- `language_code`: starý atribút, zachovaný pre kompatibilitu; pri nových položkách označuje primárny dostupný jazyk.
- `origin`: staré opisné pole, neprepisovať na kódy.
- `language_verified_at`: dátum redakčnej kontroly dostupných jazykov. Pôvodné slovenské materiály boli klasifikované z existujúcich metadát, nie jednotlivo stiahnuté a preskúmané.
- Pri nemeckých a britských textoch nepreberať kontakty na zdravotnícky systém iných krajín ako služby fungujúce na Slovensku.
- Nie všetky zdroje sú úzko klinické. Rozlišovať rodičovské materiály, pracovné karty, brožúry, metodiky a medzinárodné inštitucionálne odporúčania.
- Kvalita vydavateľa nie je automatické klinické schválenie každej formulácie.
- Nepreberať chránené PDF súbory na server bez licencie. Katalóg odkazuje na originály.

## Výber vydavateľov a doloženie
- NZIP / Všeobecná fakultní nemocnice v Praze: https://www.nzip.cz/zdroj/453-uzkostne-poruchy-u-deti-a-dospivajicich-pro-rodice-a-pecujici
- Duševní zdraví do škol (materiály v spolupráci s NÚDZ): https://dzda.cz/materialy-pro-rodice/
- Linka bezpečí: https://www.linkabezpeci.cz/poradna/uzkost
- NHS: https://www.nhs.uk/mental-health/children-and-young-adults/advice-for-parents/anxiety-in-children/
- YoungMinds: https://www.youngminds.org.uk/parent/parents-a-z-mental-health-guide/anxiety/
- IQWiG: https://www.gesundheitsinformation.de/depressionen-bei-kindern-und-jugendlichen.html
- MIELI Mental Health Finland: https://mieli.fi/en/materials/coping-skills-poster/
- WHO + UNICEF: https://www.who.int/publications-detail-redirect/9789240025554
- WHO + UNICEF + UNESCO (2026): https://www.who.int/publications/i/item/9789240124912
- UNICEF Parenting: https://www.unicef.org/parenting/mental-health-and-well-being

## Pilotné zhrnutia
INT001 česká brožúra o úzkosti, INT002 česká knižnica pre rodičov, INT003 britské rady NHS o úzkosti, INT004 fínsky plagát Coping Skills (viac jazykových verzií), INT005 nemecký IQWiG článok o depresii. Úplné slovenské anotácie sú v databázovom seede v `excerpt_sk`, odkazujú na pôvodné materiály a nepodávajú vlastnú diagnózu.

## Ďalšia priebežná redakčná kontrola
Aktuálnosť externých odkazov, licencie na prípadné preklady, aktuálnosť zdravotníckych informácií, lokalizácia krízových kontaktov a individuálne odborné posúdenie citlivého obsahu. Zahraničné katalógy obsahujú ďalšie materiály – tento import **nie je úplným zrkadlom všetkých publikácií na internete**, je to overený výber a základ rozšíriteľnej knižnice.
