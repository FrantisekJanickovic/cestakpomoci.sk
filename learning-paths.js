// Editorial starter paths. General information only; not diagnosis or treatment.
// No answers, progress, diagnoses or identifiers are persisted by this module.
const LEARNING_PATHS = [
  {
    "slug": "anxiety",
    "title": "Úzkosť, strach a panika",
    "summary": "Pokojný začiatok pre rodiča alebo blízkeho. Bez stanovovania diagnózy.",
    "steps": [
      [
        "Všimnúť si situáciu",
        "Skús pozorovať, kedy sa obavy objavujú a čo dieťaťu pomáha cítiť sa bezpečne. Nepotrebujete hneď poznať príčinu.",
        "self_help"
      ],
      [
        "Rozhovor bez tlaku",
        "Vypočuj dieťa a daj najavo, že jeho obavy berieš vážne. Nesľubuj, že všetko okamžite zmizne.",
        "self_help"
      ],
      [
        "Kedy zapojiť odborníka",
        "Ak strach výrazne obmedzuje školu, spánok alebo bežný život, oslov pediatra alebo odborníka na duševné zdravie.",
        "professional"
      ]
    ]
  },
  {
    "slug": "mood",
    "title": "Smútok a zmeny nálady",
    "summary": "Ako rozpoznať signály, byť nablízku a vedieť, kedy vyhľadať pomoc.",
    "steps": [
      [
        "Všímať si zmeny",
        "Všímaj si dlhšie trvajúce zmeny nálady, spánku, záujmov či kontaktu s blízkymi bez vyvodzovania diagnózy.",
        "self_help"
      ],
      [
        "Byť dostupný",
        "Vytvor priestor na rozhovor a nebagatelizuj pocity. Dieťa nemusí vedieť hneď pomenovať, čo sa deje.",
        "self_help"
      ],
      [
        "Vyžiadať odbornú pomoc",
        "Pri pretrvávajúcich alebo zhoršujúcich sa ťažkostiach kontaktuj pediatra či detského odborníka. Pri bezprostrednom ohrození volaj 112 alebo 155.",
        "professional"
      ]
    ]
  },
  {
    "slug": "adhd",
    "title": "Pozornosť a ADHD",
    "summary": "Praktická orientácia bez nálepkovania správania dieťaťa.",
    "steps": [
      [
        "Pozrieť sa na súvislosti",
        "Zaznamenaj, v akých situáciách má dieťa problém sústrediť sa a kedy sa mu darí. Jednotlivé prejavy samy osebe nie sú diagnóza.",
        "self_help"
      ],
      [
        "Zjednodušiť očakávania",
        "Vyskúšaj jasné krátke pokyny a predvídateľné prostredie. Zmeny prispôsob veku a potrebám dieťaťa.",
        "self_help"
      ],
      [
        "Spolupracovať so školou a odborníkom",
        "Ak ťažkosti pretrvávajú vo viacerých prostrediach, preber ich so školou a pediatrom; odborné vyšetrenie rozhodne o ďalšom postupe.",
        "professional"
      ]
    ]
  },
  {
    "slug": "behaviour",
    "title": "Silné emócie a náročné správanie",
    "summary": "Ako reagovať bezpečne a hľadať podporu bez hanby či nálepkovania.",
    "steps": [
      [
        "Bezpečie a pokoj",
        "Pri silných emóciách najprv zaisti bezpečie a pokojný kontakt. Rozhovor o pravidlách si nechaj na chvíľu, keď napätie klesne.",
        "self_help"
      ],
      [
        "Hľadať opakujúce sa situácie",
        "Všímaj si možné spúšťače, únavu alebo preťaženie. Pýtaj sa, čo sa dieťa snaží správaním vyjadriť.",
        "self_help"
      ],
      [
        "Zapájať podporu",
        "Ak konflikty narúšajú bežný život alebo niekoho ohrozujú, obráť sa na pediatra, školského psychológa alebo odborníka.",
        "professional"
      ]
    ]
  },
  {
    "slug": "school",
    "title": "Škola a odmietanie dochádzky",
    "summary": "Prvé kroky, keď je škola zdrojom veľkého stresu.",
    "steps": [
      [
        "Zistiť, čo je náročné",
        "Porozprávaj sa s dieťaťom bez výčitiek. Ťažkosti môžu súvisieť s rôznymi príčinami a treba ich preskúmať individuálne.",
        "self_help"
      ],
      [
        "Dohodnúť spoluprácu",
        "V spojení so školou hľadaj primerané a bezpečné riešenia namiesto trestov alebo tlaku.",
        "school_support"
      ],
      [
        "Požiadať o odborné posúdenie",
        "Pri opakovanom odmietaní školy a výraznej úzkosti oslov pediatra alebo školské poradenské zariadenie.",
        "professional"
      ]
    ]
  },
  {
    "slug": "sleep",
    "title": "Spánok a večerné ťažkosti",
    "summary": "Orientácia v spánkových problémoch detí a kedy ich konzultovať.",
    "steps": [
      [
        "Zmapovať režim",
        "Všímaj si pravidelnosť spánku, večerné napätie a zmeny počas dňa. Nevyvodzuj diagnózu iba z jednej noci.",
        "self_help"
      ],
      [
        "Podporiť pokojný večer",
        "Vyskúšaj predvídateľný večerný režim a prostredie primerané veku dieťaťa.",
        "self_help"
      ],
      [
        "Konzultovať pretrvávajúce ťažkosti",
        "Ak problém trvá alebo má výrazný vplyv na fungovanie, kontaktuj pediatra. Náhle závažné príznaky rieš urgentne.",
        "professional"
      ]
    ]
  }
];
if (typeof module !== "undefined" && module.exports) module.exports = LEARNING_PATHS;
