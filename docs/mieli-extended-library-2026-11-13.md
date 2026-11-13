# MIELI Mental Health Finland – detailný import (2026-11-13)

## Rozsah
Z 118 publikovaných záznamov sme importovali ďalších **37 jedinečných materiálov MIELI**: 23 jednotlivo dostupných fínskych pracovných listov z `Hyvän mielen treenivihko`, kompletný 32-stranový zošit, 40-stranovú príručku pre lektora, ročný kalendár s dvoma doplnkami, 4 anglicky dostupné materiály pre rodiny a školy a 5 samostatných tlačiteľných PDF z kolekcie `Hyvää mieltä yhdessä` (4 skupiny kartičiek + metodické aktivity). **Spolu 155 zdrojov**, z toho **45 fínskeho pôvodu**, ak zostane databáza bez ďalších zmien.

## Autoritatívne zdroje
- [MIELI – Hyvän mielen materiaalit nuorille](https://mieli.fi/materiaalit-ja-koulutukset/materiaalit/hyvan-mielen-treenivihko-nuorille/): samostatné PDF odkazy, pracovný zošit a metodika
- [MIELI – Hyvää mieltä yhdessä -kortit](https://mieli.fi/materiaalit-ja-koulutukset/materiaalit/hyvaa-mielta-yhdessa-kortit-2/): 49 kariet v 4 sadách, metodické námety a predaj tlačenej verzie; PDFs sú na stránke vydavateľa verejne dostupné
- [MIELI – Being Together](https://mieli.fi/en/materials/being-together/): plagát pre predškolské deti
- [MIELI – Dealing with Worries](https://mieli.fi/en/materials/dealing-with-worries-poster-for-child-health-clinics-and-early-education/): plagát o detských obavách
- [MIELI – Everyday Life as a Strength](https://mieli.fi/en/materials/everyday-life-as-a-strength/): pomôcka na rozhovor s rodinou, vyžaduje profesionálne vyškolenie pre použitie v metodike
- [MIELI – How Can I Care for My Children?](https://mieli.fi/en/materials/how-can-i-care-for-myo-children-guidebook/): dôležité – príručka o dopadoch problémového užívania alkoholu/drog u rodiča, **nie** všeobecná príručka o depresii

## Metadáta
- `source_country_code = FI`, `available_language_codes`: 33 fínskych originálnych PDF a štyri anglické materiály; jazyk dostupnej verzie je nezávislý od krajiny pôvodu.
- `original_language_code = fi` len pri priamo fínskych materiáloch. Pri 4 anglických verziách je tento atribút **null**; pôvodný jazyk prvého vydania nebol dostatočne doložený.
- Všetkých 37 položiek má vlastné redakčné `excerpt_sk`, tematické štítky, vekovú kategóriu, účel, formát, prístup a URL konkrétneho PDF alebo autoritatívnej stránky.
- `origin` identifikuje kolekciu či účel a pomáha redakčnej správe. Pôvodné zdroje `INT...` zostávajú nedotknuté.
- PDF **neboli kopírované na naše servery**; stránka ukazuje odkazy vydavateľa. Pred prekladom, rehostovaním alebo úpravou pracovných listov treba skontrolovať licenciu a získať súhlas.
- Fínske kontakty a krízové linky vo fínskych materiáloch sa nesmú prezentovať ako slovenské linky pomoci.
- Niektoré obrázkové PDF odkazy pri automatickom načítaní vracali `cache miss` alebo `throttled` v nástroji vyhľadávania, hoci sú uvedené na aktuálnych oficiálnych stránkach. Pred komunikovaním ich individuálnej dostupnosti ako garantovanej treba HTTP kontrolu každého súboru.
- Odborné schválenie slovenských anotácií odporúčame pri témach traumy, úzkosti a pri intervenciách vedených odborníkom.

## Dátové zmeny
Skript `supabase/mieli-finnish-resources-2026-11-13.sql` je idempotentný a mení len 37 položiek so stabilnými identifikátormi `FI101` až `FI137`. V produkčnej databáze sa aplikoval a doplnila sa oprava pôvodného jazyka 4 anglických verzií. Existujúce magic linky, ambulancie, Auth a admin sa nemenili.

## Testovacie kritériá
- 37 záznamov `FI101` až `FI137`, bez duplicít URL a s neprázdnym `excerpt_sk`
- Verejné `/api/resources` ich vracia s jazykmi a sumármi; celkový počet 155
- Filter Krajina pôvodu: Fínsko vracia 45 položiek
- Filter Jazyk materiálu: fínčina vracia 33 nových fínskych PDF, angličtina zahŕňa ďalšie 4
- Žiadne zásahy do prevádzky ambulancií a admin API
