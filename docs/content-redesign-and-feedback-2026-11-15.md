# Redizajn a hodnotenia Cesta k pomoci — prevádzková metodika

## Stránky
- Domov: zrozumiteľný hero, CTA, 6 benefitov, 3 najnovšie materiály; „Najlepšie hodnotené“ a „TOP 3 najotváranejšie“ až po získaní skutočných dát.
- Materiály: kompletné vyhľadávanie, jazykové a krajinské filtre; každá karta má `Otvoriť` a `Detail`.
- Detail: `/material.html?id=<uuid>` načítava verejné katalógové dáta, popis, pôvod, jazyk, cenu, schválené hviezdičky a komentáre.

## Meranie otvorení
- `/api/resource-open?id=<uuid>` overí publikovaný materiál, vezme cieľ z databázy, atomicky zvýši `open_count` a presmeruje návštevníka na pôvodný URL.
- Počítame **kliknutia na otvorenie cez náš web**, nie návštevnosť cudzieho webu, zobrazenia PDF ani unikátnych používateľov. Opakované kliknutie sa môže zarátať viackrát.
- TOP 3 sa radí podľa open_count. Bez údajov sa nezobrazí.

## Anonymné hviezdičky a komentáre
- Jedno hodnotenie 1–5 hviezdičkami na zdroj; text komentára nepovinný (8–1200 znakov, ak je vyplnený).
- Bez registrácie; názov voliteľný a skrátený na max 35 znakov.
- Po prijatí má komentár aj hodnotenie status `pending`. Verejne sa zobrazujú **výlučne approved** položky, agregované do `rating_sum` / `rating_count` databázovým triggerom.
- Server kontroluje origin, content type, limit dĺžky, honeypot, zákaz URL v texte, existenciu zdroja, denný limit 5 požiadaviek a unikátny pseudonymný HMAC odtlačok na zdroj.
- Odtlačok pochádza z IP + User-Agent a tajného kľúča. Surová IP sa neukladá; odtlačok je však stále **pseudonymný technický údaj**, nie úplná anonymita. Zdieľané siete a obmena prehliadača znamenajú, že nie je možné garantovať 1 skutočná osoba = 1 komentár.
- Vyžaduje sa redakčná kontrola obsahu vrátane možných citlivých údajov o deťoch. Nezverejňovať diagnózy, identifikovateľné osoby, kontakty, žiadosti o krízovú pomoc alebo reklamu.

## Moderácia v Supabase Dashboard (kým nebude samostatný zabezpečený moderátorský panel)
1. `select id,resource_id,display_name,body,rating,created_at from public.resource_feedback where status='pending' order by created_at;`
2. Po kontrole konkrétneho komentára: `update public.resource_feedback set status='approved',reviewed_at=now() where id='<uuid>' and status='pending';`
3. Ak obsah nie je vhodný: `update public.resource_feedback set status='rejected',reviewed_at=now() where id='<uuid>' and status='pending';`
4. Po prechode do approved trigger aktualizuje skóre. Pri zamietnutí zostane hodnotenie nezverejnené.
5. Oprávnenia Supabase REST: `anon` a `authenticated` nemajú priamy prístup k tabuľke feedback ani kvótam, RPC používa iba serverový secret.

## Pred aktivovaním produkčnej spätnej väzby
- Vercel: nastavené `ADMIN_SUPABASE_SECRET_KEY` a `ADMIN_RATE_LIMIT_SECRET` **iba na Production**; tieto premenné nesmú byť klientovi sprístupnené.
- Overiť read-only prepojenie zdrojov, prvé manuálne hodnotenie na demo materiáli, presmerovanie na autoritatívny URL a moderáciu v administrácii Supabase.
- Vypracovať krátke verejné pravidlá spracúvania technických identifikátorov a dobu uchovávania pred prijímaním skutočných komentárov.
- Zvažovať Turnstile ako dodatočnú bot ochranu pri raste návštevnosti a užitočnosti obsahu; aktuálny honeypot+kvóty+moderácia sú MVP, nie nepriestrelná ochrana.
- Zásahy do ambulancií, kapacít, magic linkov a administrátorských oprávnení neboli súčasťou tejto zmeny.
