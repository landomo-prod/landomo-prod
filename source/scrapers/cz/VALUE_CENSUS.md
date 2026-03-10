# Czech Portal Value Census

> Generated: 2026-02-27T09:21:57.325Z
> Source: `source/scrapers/cz/census/build-value-census.ts`

## Data Sources

| Portal | Listings | Details | Timestamp |
|--------|----------|---------|-----------|
| sreality-cz | 400 | 400 | 2026-02-27 |
| bezrealitky-cz | 1599 | 0 | 2026-02-27 |
| reality-cz | 541 | 541 | 2026-02-27 |
| idnes-reality-cz | 1248 | 1243 | 2026-02-27 |
| realingo-cz | 3960 | 0 | 2026-02-27 |
| ulovdomov-cz | 800 | 0 | 2026-02-27 |
| ceskereality-cz | 760 | 751 | 2026-02-27 |
| bazos-cz | 200 | 200 | 2026-02-27 |

## Overall Coverage Matrix

| Field | sreality | bezrealitky | reality | idnes-reality | realingo | ulovdomov | ceskereality | bazos |
|-------|---|---|---|---|---|---|---|---|
| **disposition** | 0% | 73% | 100% | 3% | 11% | 100% | 50% | ⚠️ N/A |
| **ownership** | 100% | 100% | 100% | 100% | ⚠️ N/A | ⚠️ N/A | 100% | ⚠️ N/A |
| **condition** | 100% | 73% | 0% | 100% | ⚠️ N/A | ⚠️ N/A | 100% | ⚠️ N/A |
| **construction_type** | 100% | 73% | 50% | 100% | ⚠️ N/A | ⚠️ N/A | 100% | ⚠️ N/A |
| **energy_rating** | 84% | 100% | ⚠️ N/A | 100% | ⚠️ N/A | ⚠️ N/A | 100% | ⚠️ N/A |
| **heating_type** | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | 100% | ⚠️ N/A | ⚠️ N/A | 100% | ⚠️ N/A |
| **furnished** | 53% | 100% | ⚠️ N/A | 100% | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A | ⚠️ N/A |

---

## Disposition (czech_disposition)

**Canonical values:** `1+kk`, `1+1`, `2+kk`, `2+1`, `3+kk`, `3+1`, `4+kk`, `4+1`, `5+kk`, `5+1`, `6+kk`, `6+1`, `7+kk`, `7+1`, `atypical`

### Raw Values

| Portal | Raw Value | Count | → Normalized | Status |
|--------|-----------|-------|-------------|--------|
| bezrealitky | `UNDEFINED` | 433 | — | ❌ |
| bezrealitky | `DISP_2_KK` | 243 | 2+kk | ✅ |
| bezrealitky | `DISP_3_KK` | 175 | 3+kk | ✅ |
| bezrealitky | `DISP_1_KK` | 114 | 1+kk | ✅ |
| bezrealitky | `DISP_2_1` | 108 | 2+1 | ✅ |
| bezrealitky | `DISP_5_KK` | 102 | 5+kk | ✅ |
| bezrealitky | `DISP_3_1` | 95 | 3+1 | ✅ |
| bezrealitky | `DISP_4_KK` | 94 | 4+kk | ✅ |
| bezrealitky | `OSTATNI` | 80 | atypical | ✅ |
| bezrealitky | `DISP_1_1` | 47 | 1+1 | ✅ |
| bezrealitky | `DISP_4_1` | 41 | 4+1 | ✅ |
| bezrealitky | `DISP_5_1` | 22 | 5+1 | ✅ |
| bezrealitky | `DISP_6_KK` | 17 | 6+kk | ✅ |
| bezrealitky | `DISP_6_1` | 10 | 6+1 | ✅ |
| bezrealitky | `DISP_7_KK` | 7 | 7+kk | ✅ |
| bezrealitky | `DISP_7_1` | 6 | 7+1 | ✅ |
| bezrealitky | `GARSONIERA` | 5 | 1+kk | ✅ |
| ceskereality | `Pronájem bytu 1+kk a garsoniéry 50 m² Prachatice Oseky` | 20 | 1+kk | ✅ |
| ceskereality | `Prodej komerčního pozemku 4 486 m² Stará Paka` | 11 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 14 182 m² Desná` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 36 970 m² Karlovy Vary Tašovice...` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 11 196 m² Jindřichův Hradec II,...` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 6 439 m² Úsilné, Úsilné` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 54 254 m² Trhový Štěpánov` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 2 534 m² Hůry, Hůry` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 126 960 m² Chodová Planá, Chodo...` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 3 503 m² Pištín Češnovice` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 54 268 m² Bavorov, Tírenská` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 1 255 m² Podivín, Podivín` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 2 594 m² Úsilné, Úsilné` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 230 m² Harrachov, Harrachov` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 1 301 m² Rokytnice nad Jizerou ...` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 789 m² Bavory` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 15 000 m² Ústí nad Labem Předli...` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 44 200 m² Dřísy` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 1 172 m² Benátky nad Jizerou Kbel` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 17 000 m² České Budějovice 4, S...` | 10 | — | ❌ |
| ceskereality | `Prodej komerčního pozemku 6 493 m² Svrkyně` | 10 | — | ❌ |
| ceskereality | `Pronájem bytu 1+1 43 m² České Budějovice 5, Dělnická` | 10 | 1+1 | ✅ |
| ceskereality | `Pronájem bytu 2+kk 40 m² Holešov, nám. Svobody` | 10 | 2+kk | ✅ |
| ceskereality | `Pronájem bytu 2+1 53 m² Most, Zdeňka Fibicha` | 10 | 2+1 | ✅ |
| ceskereality | `Pronájem bytu 1+kk a garsoniéry 22 m² Most, U Věžových domů` | 10 | 1+kk | ✅ |
| ceskereality | `Pronájem bytu 2+1 46 m² Zábřeh, Krumpach` | 10 | 2+1 | ✅ |
| ceskereality | `Pronájem bytu 1+kk a garsoniéry 34 m² Praha Letňany, Hluč...` | 10 | 1+kk | ✅ |
| ceskereality | `Pronájem bytu 3+kk 65 m² Příbram VII, Politických vězňů` | 10 | 3+kk | ✅ |
| ceskereality | `Pronájem bytu 2+1 63 m² Chomutov, Písečná` | 10 | 2+1 | ✅ |
| ceskereality | `Pronájem bytu 2+1 75 m² Praha, Na okraji` | 10 | 2+1 | ✅ |
| ceskereality | `Pronájem bytu 2+1 87 m² Praha, Vinohradská` | 10 | 2+1 | ✅ |
| ceskereality | `Pronájem bytu 2+kk 59 m² Praha Letňany, Pavla Beneše` | 10 | 2+kk | ✅ |
| ceskereality | `Pronájem bytu 1+kk a garsoniéry 47 m² Prachatice Oseky` | 10 | 1+kk | ✅ |
| ceskereality | `Pronájem bytu 2+kk 46 m² Včelná, Lesní kolonie` | 10 | 2+kk | ✅ |
| ceskereality | `Pronájem bytu 3+kk 86 m² Včelná, Lesní kolonie` | 10 | 3+kk | ✅ |
| ceskereality | `Pronájem bytu 3+1 68 m² Kladno Kročehlavy, Italská` | 10 | 3+1 | ✅ |
| ceskereality | `Pronájem bytu 1+kk a garsoniéry 30 m² Praha Nusle, Bolesl...` | 10 | 1+kk | ✅ |
| ceskereality | `Pronájem bytu 1+kk a garsoniéry 20 m² Kopřivnice, Záhumenní` | 10 | 1+kk | ✅ |
| ceskereality | `Prodej bytu 4+1 80 m² Rožmitál pod Třemšínem, Sídliště` | 9 | 4+1 | ✅ |
| ceskereality | `Prodej bytu 4+1 90 m² Brno Židenice, Stará osada` | 9 | 4+1 | ✅ |
| ceskereality | `Prodej bytu 1+1 40 m² Mladošovice` | 9 | 1+1 | ✅ |
| ceskereality | `Prodej bytu 2+kk 44 m² Praha Žižkov, U kněžské louky` | 9 | 2+kk | ✅ |
| ceskereality | `Prodej bytu 2+1 55 m² Hrádek nad Nisou, Sokolská` | 9 | 2+1 | ✅ |
| ceskereality | `Prodej bytu 2+kk 61 m² Praha, U konečné` | 9 | 2+kk | ✅ |
| ceskereality | `Prodej bytu 3+1 72 m² Lysá nad Labem, Sídliště` | 9 | 3+1 | ✅ |
| ceskereality | `Prodej bytu 1+1 40 m² Častolovice, U Konopáče` | 9 | 1+1 | ✅ |
| ceskereality | `Prodej bytu 2+1 42 m² Praha Lhotka, Zálesí` | 9 | 2+1 | ✅ |
| ceskereality | `Prodej bytu 3+kk 148 m² Kladno Kročehlavy, Vrchlického` | 9 | 3+kk | ✅ |
| ceskereality | `Prodej bytu 2+kk 72 m² Kladno Kročehlavy, Vrchlického` | 9 | 2+kk | ✅ |
| ceskereality | `Prodej bytu 2+kk 62 m² Kladno Kročehlavy, Vrchlického` | 9 | 2+kk | ✅ |
| ceskereality | `Prodej bytu 4+kk 77 m² Praha Žižkov, Domažlická` | 9 | 4+kk | ✅ |
| ceskereality | `Prodej bytu 2+kk 41 m² Praha Modřany, Pirinská` | 9 | 2+kk | ✅ |
| ceskereality | `Prodej bytu 3+1 58 m² Jirkov, Pionýrů` | 9 | 3+1 | ✅ |
| ceskereality | `Prodej bytu 3+1 70 m² Česká Lípa, Újezd` | 9 | 3+1 | ✅ |
| ceskereality | `Prodej bytu 3+kk 80 m² Vrchlabí Hořejší Vrchlabí, Horská` | 9 | 3+kk | ✅ |
| ceskereality | `Prodej bytu 3+1 62 m² Olomouc Nová Ulice, Pionýrská` | 9 | 3+1 | ✅ |
| ceskereality | `Prodej bytu 3+kk 93 m² Praha Hlubočepy, Kříženeckého náměstí` | 9 | 3+kk | ✅ |
| ceskereality | `Prodej stavební parcely 4 217 m² Habrovany` | 9 | — | ❌ |
| ceskereality | `Prodej zemědělské půdy 2 760 m² Horní Břečkov` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 430 m² Kněžmost Úhelnice` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 309 m² Uhlířská Lhota Rasochy` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 3 220 m² Strančice Sklenka` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 610 m² Říčany Jažlovice` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 2 627 m² Uhlířská Lhota Rasochy` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 358 m² Horní Planá Bližší Lhota` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 427 m² Horní Planá Bližší Lhota` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 966 m² Rychnov u Jablonce nad Nis...` | 9 | — | ❌ |
| ceskereality | `Prodej zemědělské půdy 11 183 m² Vyšehořovice` | 9 | — | ❌ |
| ceskereality | `Prodej zemědělské půdy 5 120 m² Mělník` | 9 | — | ❌ |
| ceskereality | `Prodej ostatního pozemku 1 852 m² Mělník` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 050 m² Kněžmost Násedlnice` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 527 m² Žandov Heřmanice` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 2 480 m² Kly Záboří` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 900 m² Zlatá` | 9 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 147 m² Lipoltice Sovoluská Lhota` | 8 | — | ❌ |
| ceskereality | `Prodej stavební parcely 2 067 m² Seč Hoješín` | 5 | — | ❌ |
| ceskereality | `Prodej zahrady 581 m² Zlín Malenovice` | 4 | — | ❌ |
| ceskereality | `Prodej bytu 2+kk 43 m² Praha Chodov, Valentova` | 3 | 2+kk | ✅ |
| ceskereality | `Prodej bytu 2+1 65 m² Jičín Valdické Předměstí, Nám. V. Č...` | 3 | 2+1 | ✅ |
| ceskereality | `Prodej stavební parcely 1 000 m² Libomyšl` | 3 | — | ❌ |
| ceskereality | `Prodej bytu 5+kk 119 m² Praha Hostavice, Českobrodská` | 2 | 5+kk | ✅ |
| ceskereality | `Prodej stavební parcely 3 570 m² Chaloupky` | 2 | — | ❌ |
| ceskereality | `Pronájem bytu 1+1 50 m² Žatec` | 2 | 1+1 | ✅ |
| ceskereality | `Pronájem bytu 2+kk 58 m² Plzeň Jižní Předměstí, Hálkova` | 2 | 2+kk | ✅ |
| ceskereality | `Pronájem bytu 2+kk 75 m² Plzeň Jižní Předměstí, Antonína Uxy` | 2 | 2+kk | ✅ |
| ceskereality | `Pronájem bytu 2+kk 44 m² Praha Nusle, Maroldova` | 2 | 2+kk | ✅ |
| ceskereality | `Prodej bytu 2+kk 48 m² Tuchoměřice, V Kněžívce` | 1 | 2+kk | ✅ |
| ceskereality | `Prodej stavební parcely 2 677 m² Čkyně Dolany` | 1 | — | ❌ |
| ceskereality | `Prodej stavební parcely 2 017 m² Tetín` | 1 | — | ❌ |
| ceskereality | `Prodej louky 3 562 m² Holín` | 1 | — | ❌ |
| ceskereality | `Prodej stavební parcely 1 007 m² Podhradí` | 1 | — | ❌ |
| ceskereality | `Pronájem pokoje 25 m² České Budějovice 4, U Smaltovny` | 1 | — | ❌ |
| ceskereality | `Pronájem bytu 2+kk 48 m² Hradec Králové, Mánesova` | 1 | 2+kk | ✅ |
| idnes-reality | `5` | 122 | — | ❌ |
| idnes-reality | `4` | 69 | — | ❌ |
| idnes-reality | `3` | 36 | — | ❌ |
| idnes-reality | `2` | 23 | — | ❌ |
| idnes-reality | `6` | 22 | — | ❌ |
| idnes-reality | `8` | 9 | — | ❌ |
| idnes-reality | `1` | 8 | — | ❌ |
| idnes-reality | `7` | 7 | — | ❌ |
| idnes-reality | `9` | 3 | — | ❌ |
| idnes-reality | `12` | 1 | — | ❌ |
| idnes-reality | `17` | 1 | — | ❌ |
| idnes-reality | `42` | 1 | — | ❌ |
| idnes-reality | `10` | 1 | — | ❌ |
| idnes-reality | `prodej
bytu 2+kk 43 m²` | 1 | 2+kk | ✅ |
| idnes-reality | `prodej
bytu 3+kk 89 m²` | 1 | 3+kk | ✅ |
| idnes-reality | `prodej
bytu 3+kk 110 m²` | 1 | 3+kk | ✅ |
| idnes-reality | `prodej
bytu 3+kk 60 m²` | 1 | 3+kk | ✅ |
| idnes-reality | `prodej
bytu 2+1 55 m²` | 1 | 2+1 | ✅ |
| idnes-reality | `prodej
bytu 2+kk 47 m²` | 1 | 2+kk | ✅ |
| idnes-reality | `prodej
bytu 1+kk 28 m²` | 1 | 1+kk | ✅ |
| idnes-reality | `prodej
bytu 4+kk 127 m²` | 1 | 4+kk | ✅ |
| idnes-reality | `prodej
bytu 2+kk 49 m²` | 1 | 2+kk | ✅ |
| idnes-reality | `prodej
bytu 1+kk 46 m²` | 1 | 1+kk | ✅ |
| realingo | `HOUSE_FAMILY` | 770 | — | ❌ |
| realingo | `LAND_HOUSING` | 466 | — | ❌ |
| realingo | `OTHERS_GARAGE` | 410 | — | ❌ |
| realingo | `OTHERS_OTHERS` | 327 | — | ❌ |
| realingo | `OTHERS_FLAT` | 321 | — | ❌ |
| realingo | `COMMERCIAL_BUSINESS` | 216 | — | ❌ |
| realingo | `LAND_GARDEN` | 164 | — | ❌ |
| realingo | `COMMERCIAL_STORAGE` | 163 | — | ❌ |
| realingo | `COMMERCIAL_OFFICE` | 160 | — | ❌ |
| realingo | `OTHERS_HUT` | 151 | — | ❌ |
| realingo | `FLAT21` | 98 | 2+1 | ✅ |
| realingo | `FLAT2_KK` | 85 | 2+kk | ✅ |
| realingo | `COMMERCIAL_RESTAURANT` | 74 | — | ❌ |
| realingo | `FLAT1_KK` | 70 | 1+kk | ✅ |
| realingo | `LAND_COMMERCIAL` | 67 | — | ❌ |
| realingo | `FLAT31` | 59 | 3+1 | ✅ |
| realingo | `FLAT3_KK` | 55 | 3+kk | ✅ |
| realingo | `COMMERCIAL_ACCOMMODATION` | 55 | — | ❌ |
| realingo | `FLAT11` | 46 | 1+1 | ✅ |
| realingo | `COMMERCIAL_MANUFACTURING` | 41 | — | ❌ |
| realingo | `LAND_AGRICULTURAL` | 38 | — | ❌ |
| realingo | `OTHERS_COTTAGE` | 29 | — | ❌ |
| realingo | `LAND_MEADOW` | 21 | — | ❌ |
| realingo | `FLAT41` | 16 | 4+1 | ✅ |
| realingo | `HOUSE_APARTMENT` | 16 | — | ❌ |
| realingo | `OTHERS_FARMHOUSE` | 10 | — | ❌ |
| realingo | `FLAT4_KK` | 9 | 4+kk | ✅ |
| realingo | `HOUSE_MANSION` | 8 | — | ❌ |
| realingo | `COMMERCIAL_AGRICULTURAL` | 6 | — | ❌ |
| realingo | `LAND_FOREST` | 5 | — | ❌ |
| realingo | `FLAT5_KK` | 2 | 5+kk | ✅ |
| realingo | `OTHERS_POND` | 1 | — | ❌ |
| realingo | `OTHERS_MONUMENTS` | 1 | — | ❌ |
| reality | `byt 3+1, 114 m², cihla, osobní` | 1 | 3+1 | ✅ |
| reality | `byt 4+1, 90 m², osobní` | 1 | 4+1 | ✅ |
| reality | `byt 4+kk, 200 m², osobní` | 1 | 4+kk | ✅ |
| reality | `byt 3+1, 72 m², panel, osobní` | 1 | 3+1 | ✅ |
| reality | `byt 2+kk, 47 m², cihla, osobní` | 1 | 2+kk | ✅ |
| reality | `byt 4+1, 121 m², cihla, osobní` | 1 | 4+1 | ✅ |
| reality | `byt 2+kk, osobní` | 1 | 2+kk | ✅ |
| reality | `byt 3+1, 91 m², osobní` | 1 | 3+1 | ✅ |
| reality | `byt 1+1, 42 m², cihla, osobní` | 1 | 1+1 | ✅ |
| reality | `byt 3+kk, 104 m², osobní` | 1 | 3+kk | ✅ |
| sreality | `0` | 329 | — | ❌ |
| sreality | `1` | 25 | — | ❌ |
| sreality | `3` | 19 | — | ❌ |
| sreality | `4` | 13 | — | ❌ |
| sreality | `2` | 10 | — | ❌ |
| sreality | `5` | 4 | — | ❌ |
| ulovdomov | `twoPlusKk` | 204 | 2+kk | ✅ |
| ulovdomov | `onePlusKk` | 145 | 1+kk | ✅ |
| ulovdomov | `threePlusKk` | 88 | 3+kk | ✅ |
| ulovdomov | `twoPlusOne` | 84 | 2+1 | ✅ |
| ulovdomov | `threePlusOne` | 77 | 3+1 | ✅ |
| ulovdomov | `onePlusOne` | 45 | 1+1 | ✅ |
| ulovdomov | `fourPlusKk` | 28 | 4+kk | ✅ |
| ulovdomov | `fourPlusOne` | 13 | 4+1 | ✅ |
| ulovdomov | `fivePlusOne` | 2 | 5+1 | ✅ |
| ulovdomov | `fivePlusKk` | 2 | 5+kk | ✅ |
| ulovdomov | `sixAndMore` | 1 | atypical | ✅ |
| ulovdomov | `atypical` | 1 | atypical | ✅ |

### Coverage Summary

| Portal | Total | Mapped | Unmapped | Status |
|--------|-------|--------|----------|--------|
| sreality | 400 | 0 | 400 | 0% |
| bezrealitky | 1599 | 1166 | 433 | 73% |
| reality | 10 | 10 | 0 | 100% |
| idnes-reality | 313 | 10 | 303 | 3% |
| realingo | 3960 | 440 | 3520 | 11% |
| ulovdomov | 690 | 690 | 0 | 100% |
| ceskereality | 760 | 379 | 381 | 50% |
| bazos | — | — | — | ⚠️ NOT PROVIDED |

### ❌ Action Items (Unmapped Values)

- **bezrealitky**: `UNDEFINED` (433× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 4 486 m² Stará Paka` (11× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 14 182 m² Desná` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 36 970 m² Karlovy Vary Tašovice, Tašovice` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 11 196 m² Jindřichův Hradec II, U Dolního Skrýchova` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 6 439 m² Úsilné, Úsilné` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 54 254 m² Trhový Štěpánov` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 2 534 m² Hůry, Hůry` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 126 960 m² Chodová Planá, Chodová Planá` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 3 503 m² Pištín Češnovice` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 54 268 m² Bavorov, Tírenská` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 1 255 m² Podivín, Podivín` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 2 594 m² Úsilné, Úsilné` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 230 m² Harrachov, Harrachov` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 1 301 m² Rokytnice nad Jizerou Rokytno, Rokytno` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 789 m² Bavory` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 15 000 m² Ústí nad Labem Předlice, Hrbovická` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 44 200 m² Dřísy` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 1 172 m² Benátky nad Jizerou Kbel` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 17 000 m² České Budějovice 4, Slévárenská` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej komerčního pozemku 6 493 m² Svrkyně` (10× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 4 217 m² Habrovany` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej zemědělské půdy 2 760 m² Horní Břečkov` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 430 m² Kněžmost Úhelnice` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 309 m² Uhlířská Lhota Rasochy` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 3 220 m² Strančice Sklenka` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 610 m² Říčany Jažlovice` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 2 627 m² Uhlířská Lhota Rasochy` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 358 m² Horní Planá Bližší Lhota` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 427 m² Horní Planá Bližší Lhota` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 966 m² Rychnov u Jablonce nad Nisou, Zálesí` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej zemědělské půdy 11 183 m² Vyšehořovice` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej zemědělské půdy 5 120 m² Mělník` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej ostatního pozemku 1 852 m² Mělník` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 050 m² Kněžmost Násedlnice` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 527 m² Žandov Heřmanice` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 2 480 m² Kly Záboří` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 900 m² Zlatá` (9× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 147 m² Lipoltice Sovoluská Lhota` (8× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 2 067 m² Seč Hoješín` (5× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej zahrady 581 m² Zlín Malenovice` (4× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 1 000 m² Libomyšl` (3× seen) — needs mapping to `disposition`
- **ceskereality**: `Prodej stavební parcely 3 570 m² Chaloupky` (2× seen) — needs mapping to `disposition`
- **idnes-reality**: `5` (122× seen) — needs mapping to `disposition`
- **idnes-reality**: `4` (69× seen) — needs mapping to `disposition`
- **idnes-reality**: `3` (36× seen) — needs mapping to `disposition`
- **idnes-reality**: `2` (23× seen) — needs mapping to `disposition`
- **idnes-reality**: `6` (22× seen) — needs mapping to `disposition`
- **idnes-reality**: `8` (9× seen) — needs mapping to `disposition`
- **idnes-reality**: `1` (8× seen) — needs mapping to `disposition`
- **idnes-reality**: `7` (7× seen) — needs mapping to `disposition`
- **idnes-reality**: `9` (3× seen) — needs mapping to `disposition`
- **realingo**: `HOUSE_FAMILY` (770× seen) — needs mapping to `disposition`
- **realingo**: `LAND_HOUSING` (466× seen) — needs mapping to `disposition`
- **realingo**: `OTHERS_GARAGE` (410× seen) — needs mapping to `disposition`
- **realingo**: `OTHERS_OTHERS` (327× seen) — needs mapping to `disposition`
- **realingo**: `OTHERS_FLAT` (321× seen) — needs mapping to `disposition`
- **realingo**: `COMMERCIAL_BUSINESS` (216× seen) — needs mapping to `disposition`
- **realingo**: `LAND_GARDEN` (164× seen) — needs mapping to `disposition`
- **realingo**: `COMMERCIAL_STORAGE` (163× seen) — needs mapping to `disposition`
- **realingo**: `COMMERCIAL_OFFICE` (160× seen) — needs mapping to `disposition`
- **realingo**: `OTHERS_HUT` (151× seen) — needs mapping to `disposition`
- **realingo**: `COMMERCIAL_RESTAURANT` (74× seen) — needs mapping to `disposition`
- **realingo**: `LAND_COMMERCIAL` (67× seen) — needs mapping to `disposition`
- **realingo**: `COMMERCIAL_ACCOMMODATION` (55× seen) — needs mapping to `disposition`
- **realingo**: `COMMERCIAL_MANUFACTURING` (41× seen) — needs mapping to `disposition`
- **realingo**: `LAND_AGRICULTURAL` (38× seen) — needs mapping to `disposition`
- **realingo**: `OTHERS_COTTAGE` (29× seen) — needs mapping to `disposition`
- **realingo**: `LAND_MEADOW` (21× seen) — needs mapping to `disposition`
- **realingo**: `HOUSE_APARTMENT` (16× seen) — needs mapping to `disposition`
- **realingo**: `OTHERS_FARMHOUSE` (10× seen) — needs mapping to `disposition`
- **realingo**: `HOUSE_MANSION` (8× seen) — needs mapping to `disposition`
- **realingo**: `COMMERCIAL_AGRICULTURAL` (6× seen) — needs mapping to `disposition`
- **realingo**: `LAND_FOREST` (5× seen) — needs mapping to `disposition`
- **sreality**: `0` (329× seen) — needs mapping to `disposition`
- **sreality**: `1` (25× seen) — needs mapping to `disposition`
- **sreality**: `3` (19× seen) — needs mapping to `disposition`
- **sreality**: `4` (13× seen) — needs mapping to `disposition`
- **sreality**: `2` (10× seen) — needs mapping to `disposition`
- **sreality**: `5` (4× seen) — needs mapping to `disposition`

---

## Ownership (czech_ownership)

**Canonical values:** `personal`, `cooperative`, `state`, `other`

### Raw Values

| Portal | Raw Value | Count | → Normalized | Status |
|--------|-----------|-------|-------------|--------|
| bezrealitky | `OSOBNI` | 969 | personal | ✅ |
| bezrealitky | `UNDEFINED` | 569 | other | ✅ |
| bezrealitky | `DRUZSTEVNI` | 56 | cooperative | ✅ |
| bezrealitky | `OSTATNI` | 4 | state | ✅ |
| bezrealitky | `OBECNI` | 1 | state | ✅ |
| ceskereality | `soukromé` | 422 | personal | ✅ |
| ceskereality | `družstevní` | 44 | cooperative | ✅ |
| ceskereality | `státní, obecní, jiné` | 22 | state | ✅ |
| idnes-reality | `osobní` | 744 | personal | ✅ |
| idnes-reality | `jiné` | 30 | other | ✅ |
| idnes-reality | `družstevní` | 19 | cooperative | ✅ |
| idnes-reality | `s.r.o.` | 3 | other | ✅ |
| reality | `byt 3+1, 114 m², cihla, osobní` | 1 | personal | ✅ |
| reality | `byt 4+1, 90 m², osobní` | 1 | personal | ✅ |
| reality | `byt 4+kk, 200 m², osobní` | 1 | personal | ✅ |
| reality | `byt 3+1, 72 m², panel, osobní` | 1 | personal | ✅ |
| reality | `byt 2+kk, 47 m², cihla, osobní` | 1 | personal | ✅ |
| reality | `byt 4+1, 121 m², cihla, osobní` | 1 | personal | ✅ |
| reality | `byt 2+kk, osobní` | 1 | personal | ✅ |
| reality | `byt 3+1, 91 m², osobní` | 1 | personal | ✅ |
| reality | `byt 1+1, 42 m², cihla, osobní` | 1 | personal | ✅ |
| reality | `byt 3+kk, 104 m², osobní` | 1 | personal | ✅ |
| sreality | `1` | 363 | personal | ✅ |
| sreality | `2` | 36 | cooperative | ✅ |
| sreality | `3` | 1 | state | ✅ |

### Coverage Summary

| Portal | Total | Mapped | Unmapped | Status |
|--------|-------|--------|----------|--------|
| sreality | 400 | 400 | 0 | 100% |
| bezrealitky | 1599 | 1599 | 0 | 100% |
| reality | 10 | 10 | 0 | 100% |
| idnes-reality | 796 | 796 | 0 | 100% |
| realingo | — | — | — | ⚠️ NOT PROVIDED |
| ulovdomov | — | — | — | ⚠️ NOT PROVIDED |
| ceskereality | 488 | 488 | 0 | 100% |
| bazos | — | — | — | ⚠️ NOT PROVIDED |

---

## Condition (condition)

**Canonical values:** `new`, `excellent`, `very_good`, `good`, `after_renovation`, `before_renovation`, `requires_renovation`, `project`, `under_construction`

### Raw Values

| Portal | Raw Value | Count | → Normalized | Status |
|--------|-----------|-------|-------------|--------|
| bezrealitky | `VERY_GOOD` | 496 | very_good | ✅ |
| bezrealitky | `UNDEFINED` | 436 | — | ❌ |
| bezrealitky | `NEW` | 249 | new | ✅ |
| bezrealitky | `GOOD` | 232 | good | ✅ |
| bezrealitky | `AFTER_RECONSTRUCTION` | 93 | after_renovation | ✅ |
| bezrealitky | `BEFORE_RECONSTRUCTION` | 43 | before_renovation | ✅ |
| bezrealitky | `BAD` | 24 | requires_renovation | ✅ |
| bezrealitky | `AFTER_PARTIAL_RECONSTRUCTION` | 9 | after_renovation | ✅ |
| bezrealitky | `CONSTRUCTION` | 7 | under_construction | ✅ |
| bezrealitky | `IN_RECONSTRUCTION` | 5 | under_construction | ✅ |
| bezrealitky | `PROJECT` | 4 | project | ✅ |
| bezrealitky | `DEMOLITION` | 1 | requires_renovation | ✅ |
| ceskereality | `Dobrý` | 189 | good | ✅ |
| ceskereality | `Bezvadný` | 154 | excellent | ✅ |
| ceskereality | `Po rekonstrukci` | 45 | after_renovation | ✅ |
| ceskereality | `Novostavba` | 40 | new | ✅ |
| ceskereality | `Rozestavěný` | 21 | under_construction | ✅ |
| idnes-reality | `velmi dobrý stav` | 192 | very_good | ✅ |
| idnes-reality | `novostavba` | 163 | new | ✅ |
| idnes-reality | `po rekonstrukci` | 61 | after_renovation | ✅ |
| idnes-reality | `dobrý stav` | 23 | good | ✅ |
| idnes-reality | `ve výstavbě` | 9 | under_construction | ✅ |
| idnes-reality | `projekt` | 3 | project | ✅ |
| idnes-reality | `před rekonstrukcí` | 2 | before_renovation | ✅ |
| idnes-reality | `v rekonstrukci` | 2 | under_construction | ✅ |
| idnes-reality | `špatný stav` | 1 | requires_renovation | ✅ |
| idnes-reality | `k demolici` | 1 | requires_renovation | ✅ |
| reality | `byt 3+1, 114 m², cihla, osobní` | 1 | — | ❌ |
| reality | `byt 4+1, 90 m², osobní` | 1 | — | ❌ |
| reality | `byt 4+kk, 200 m², osobní` | 1 | — | ❌ |
| reality | `byt 3+1, 72 m², panel, osobní` | 1 | — | ❌ |
| reality | `byt 2+kk, 47 m², cihla, osobní` | 1 | — | ❌ |
| reality | `byt 4+1, 121 m², cihla, osobní` | 1 | — | ❌ |
| reality | `byt 2+kk, osobní` | 1 | — | ❌ |
| reality | `byt 3+1, 91 m², osobní` | 1 | — | ❌ |
| reality | `byt 1+1, 42 m², cihla, osobní` | 1 | — | ❌ |
| reality | `byt 3+kk, 104 m², osobní` | 1 | — | ❌ |
| sreality | `1` | 121 | very_good | ✅ |
| sreality | `6` | 92 | project | ✅ |
| sreality | `9` | 80 | before_renovation | ✅ |
| sreality | `2` | 72 | good | ✅ |
| sreality | `4` | 19 | requires_renovation | ✅ |
| sreality | `8` | 8 | new | ✅ |
| sreality | `5` | 7 | under_construction | ✅ |
| sreality | `10` | 1 | after_renovation | ✅ |

### Coverage Summary

| Portal | Total | Mapped | Unmapped | Status |
|--------|-------|--------|----------|--------|
| sreality | 400 | 400 | 0 | 100% |
| bezrealitky | 1599 | 1163 | 436 | 73% |
| reality | 10 | 0 | 10 | 0% |
| idnes-reality | 457 | 457 | 0 | 100% |
| realingo | — | — | — | ⚠️ NOT PROVIDED |
| ulovdomov | — | — | — | ⚠️ NOT PROVIDED |
| ceskereality | 449 | 449 | 0 | 100% |
| bazos | — | — | — | ⚠️ NOT PROVIDED |

### ❌ Action Items (Unmapped Values)

- **bezrealitky**: `UNDEFINED` (436× seen) — needs mapping to `condition`

---

## Construction Type (construction_type)

**Canonical values:** `panel`, `brick`, `stone`, `wood`, `concrete`, `mixed`, `other`

### Raw Values

| Portal | Raw Value | Count | → Normalized | Status |
|--------|-----------|-------|-------------|--------|
| bezrealitky | `BRICK` | 793 | brick | ✅ |
| bezrealitky | `UNDEFINED` | 432 | — | ❌ |
| bezrealitky | `PANEL` | 183 | panel | ✅ |
| bezrealitky | `MIXED` | 136 | mixed | ✅ |
| bezrealitky | `WOOD` | 25 | wood | ✅ |
| bezrealitky | `SKELET` | 21 | concrete | ✅ |
| bezrealitky | `STONE` | 6 | stone | ✅ |
| bezrealitky | `PREFAB` | 3 | other | ✅ |
| ceskereality | `Zděná` | 146 | stone | ✅ |
| ceskereality | `Panelová` | 112 | panel | ✅ |
| ceskereality | `Jiná` | 36 | other | ✅ |
| ceskereality | `Skeletová` | 2 | concrete | ✅ |
| idnes-reality | `cihlová` | 717 | brick | ✅ |
| idnes-reality | `smíšená` | 124 | mixed | ✅ |
| idnes-reality | `panelová` | 82 | panel | ✅ |
| idnes-reality | `dřevěná` | 27 | wood | ✅ |
| idnes-reality | `skeletová` | 11 | concrete | ✅ |
| idnes-reality | `montovaná` | 3 | other | ✅ |
| idnes-reality | `kamenná` | 2 | stone | ✅ |
| reality | `byt 3+1, 114 m², cihla, osobní` | 1 | brick | ✅ |
| reality | `byt 4+1, 90 m², osobní` | 1 | — | ❌ |
| reality | `byt 4+kk, 200 m², osobní` | 1 | — | ❌ |
| reality | `byt 3+1, 72 m², panel, osobní` | 1 | panel | ✅ |
| reality | `byt 2+kk, 47 m², cihla, osobní` | 1 | brick | ✅ |
| reality | `byt 4+1, 121 m², cihla, osobní` | 1 | brick | ✅ |
| reality | `byt 2+kk, osobní` | 1 | — | ❌ |
| reality | `byt 3+1, 91 m², osobní` | 1 | — | ❌ |
| reality | `byt 1+1, 42 m², cihla, osobní` | 1 | brick | ✅ |
| reality | `byt 3+kk, 104 m², osobní` | 1 | — | ❌ |
| sreality | `2` | 244 | panel | ✅ |
| sreality | `1` | 88 | brick | ✅ |
| sreality | `3` | 68 | other | ✅ |

### Coverage Summary

| Portal | Total | Mapped | Unmapped | Status |
|--------|-------|--------|----------|--------|
| sreality | 400 | 400 | 0 | 100% |
| bezrealitky | 1599 | 1167 | 432 | 73% |
| reality | 10 | 5 | 5 | 50% |
| idnes-reality | 966 | 966 | 0 | 100% |
| realingo | — | — | — | ⚠️ NOT PROVIDED |
| ulovdomov | — | — | — | ⚠️ NOT PROVIDED |
| ceskereality | 296 | 296 | 0 | 100% |
| bazos | — | — | — | ⚠️ NOT PROVIDED |

### ❌ Action Items (Unmapped Values)

- **bezrealitky**: `UNDEFINED` (432× seen) — needs mapping to `construction_type`

---

## Energy Rating (energy_rating)

**Canonical values:** `a`, `b`, `c`, `d`, `e`, `f`, `g`

### Raw Values

| Portal | Raw Value | Count | → Normalized | Status |
|--------|-----------|-------|-------------|--------|
| bezrealitky | `G` | 333 | g | ✅ |
| bezrealitky | `B` | 208 | b | ✅ |
| bezrealitky | `C` | 165 | c | ✅ |
| bezrealitky | `D` | 122 | d | ✅ |
| bezrealitky | `E` | 62 | e | ✅ |
| bezrealitky | `A` | 42 | a | ✅ |
| bezrealitky | `F` | 19 | f | ✅ |
| ceskereality | `G - Mimořádně nehospodárná` | 174 | g | ✅ |
| ceskereality | `C - Úsporná` | 92 | c | ✅ |
| ceskereality | `B - Velmi úsporná` | 59 | b | ✅ |
| ceskereality | `D - Méně úsporná` | 29 | d | ✅ |
| ceskereality | `E - Nehospodárná` | 9 | e | ✅ |
| ceskereality | `F - Velmi nehospodárná` | 8 | f | ✅ |
| idnes-reality | `G (vyhl. č. 264/2020 Sb.)` | 360 | g | ✅ |
| idnes-reality | `G (vyhl. č. 78/2013 Sb.)` | 173 | g | ✅ |
| idnes-reality | `B (vyhl. č. 264/2020 Sb.)` | 144 | b | ✅ |
| idnes-reality | `G (vyhl. č. 148/2007 Sb.)` | 73 | g | ✅ |
| idnes-reality | `C (vyhl. č. 264/2020 Sb.)` | 52 | c | ✅ |
| idnes-reality | `B (vyhl. č. 78/2013 Sb.)` | 35 | b | ✅ |
| idnes-reality | `D (vyhl. č. 264/2020 Sb.)` | 28 | d | ✅ |
| idnes-reality | `A (vyhl. č. 264/2020 Sb.)` | 23 | a | ✅ |
| idnes-reality | `C (vyhl. č. 78/2013 Sb.)` | 17 | c | ✅ |
| idnes-reality | `B (vyhl. č. 148/2007 Sb.)` | 16 | b | ✅ |
| idnes-reality | `E (vyhl. č. 264/2020 Sb.)` | 14 | e | ✅ |
| idnes-reality | `D (vyhl. č. 78/2013 Sb.)` | 11 | d | ✅ |
| idnes-reality | `C (vyhl. č. 148/2007 Sb.)` | 8 | c | ✅ |
| idnes-reality | `E (vyhl. č. 78/2013 Sb.)` | 7 | e | ✅ |
| idnes-reality | `D (vyhl. č. 148/2007 Sb.)` | 4 | d | ✅ |
| idnes-reality | `A (vyhl. č. 148/2007 Sb.)` | 4 | a | ✅ |
| idnes-reality | `A (vyhl. č. 78/2013 Sb.)` | 4 | a | ✅ |
| idnes-reality | `G` | 2 | g | ✅ |
| idnes-reality | `F (vyhl. č. 78/2013 Sb.)` | 2 | f | ✅ |
| idnes-reality | `F (vyhl. č. 264/2020 Sb.)` | 1 | f | ✅ |
| idnes-reality | `B` | 1 | b | ✅ |
| idnes-reality | `E (vyhl. č. 148/2007 Sb.)` | 1 | e | ✅ |
| idnes-reality | `C` | 1 | c | ✅ |
| sreality | `2` | 100 | b | ✅ |
| sreality | `7` | 99 | g | ✅ |
| sreality | `3` | 65 | c | ✅ |
| sreality | `0` | 65 | — | ❌ |
| sreality | `4` | 34 | d | ✅ |
| sreality | `5` | 15 | e | ✅ |
| sreality | `1` | 14 | a | ✅ |
| sreality | `6` | 8 | f | ✅ |

### Coverage Summary

| Portal | Total | Mapped | Unmapped | Status |
|--------|-------|--------|----------|--------|
| sreality | 400 | 335 | 65 | 84% |
| bezrealitky | 951 | 951 | 0 | 100% |
| reality | — | — | — | ⚠️ NOT PROVIDED |
| idnes-reality | 981 | 981 | 0 | 100% |
| realingo | — | — | — | ⚠️ NOT PROVIDED |
| ulovdomov | — | — | — | ⚠️ NOT PROVIDED |
| ceskereality | 371 | 371 | 0 | 100% |
| bazos | — | — | — | ⚠️ NOT PROVIDED |

### ❌ Action Items (Unmapped Values)

- **sreality**: `0` (65× seen) — needs mapping to `energy_rating`

---

## Heating Type (heating_type)

**Canonical values:** `central_heating`, `individual_heating`, `electric_heating`, `gas_heating`, `water_heating`, `heat_pump`, `other`

### Raw Values

| Portal | Raw Value | Count | → Normalized | Status |
|--------|-----------|-------|-------------|--------|
| ceskereality | `Ústřední - dálkové` | 48 | central_heating | ✅ |
| ceskereality | `Ústřední - plynové` | 39 | central_heating | ✅ |
| ceskereality | `Ústřední - tuhá paliva` | 30 | central_heating | ✅ |
| ceskereality | `Lokální - plynové` | 12 | gas_heating | ✅ |
| ceskereality | `Ústřední - elektrické` | 10 | central_heating | ✅ |
| ceskereality | `Lokální - tuhá paliva` | 4 | other | ✅ |
| idnes-reality | `ústřední - plynové` | 69 | central_heating | ✅ |
| idnes-reality | `ústřední - dálkové` | 51 | central_heating | ✅ |
| idnes-reality | `jiné` | 38 | other | ✅ |
| idnes-reality | `ústřední - elektrické` | 27 | central_heating | ✅ |
| idnes-reality | `lokální - elektrické` | 20 | electric_heating | ✅ |
| idnes-reality | `lokální - tuhá paliva` | 19 | other | ✅ |
| idnes-reality | `lokální - plyn` | 14 | gas_heating | ✅ |
| idnes-reality | `ústřední - tuhá paliva` | 5 | central_heating | ✅ |
| idnes-reality | `lokální - tuhá paliva, lokální - elektrické` | 3 | electric_heating | ✅ |
| idnes-reality | `lokální - tuhá paliva, ústřední - plynové` | 2 | central_heating | ✅ |
| idnes-reality | `ústřední - plynové, ústřední - tuhá paliva` | 2 | central_heating | ✅ |
| idnes-reality | `lokální - tuhá paliva, lokální - elektrické, jiné` | 1 | electric_heating | ✅ |
| idnes-reality | `lokální - plyn, lokální - tuhá paliva, ústřední - plynové` | 1 | central_heating | ✅ |
| idnes-reality | `ústřední - dálkové, jiné` | 1 | central_heating | ✅ |
| idnes-reality | `lokální - elektrické, ústřední - elektrické` | 1 | central_heating | ✅ |
| idnes-reality | `lokální - tuhá paliva, ústřední - elektrické` | 1 | central_heating | ✅ |

### Coverage Summary

| Portal | Total | Mapped | Unmapped | Status |
|--------|-------|--------|----------|--------|
| sreality | — | — | — | ⚠️ NOT PROVIDED |
| bezrealitky | — | — | — | ⚠️ NOT PROVIDED |
| reality | — | — | — | ⚠️ NOT PROVIDED |
| idnes-reality | 255 | 255 | 0 | 100% |
| realingo | — | — | — | ⚠️ NOT PROVIDED |
| ulovdomov | — | — | — | ⚠️ NOT PROVIDED |
| ceskereality | 143 | 143 | 0 | 100% |
| bazos | — | — | — | ⚠️ NOT PROVIDED |

---

## Furnished (furnished)

**Canonical values:** `furnished`, `partially_furnished`, `not_furnished`

### Raw Values

| Portal | Raw Value | Count | → Normalized | Status |
|--------|-----------|-------|-------------|--------|
| bezrealitky | `CASTECNE` | 500 | partially_furnished | ✅ |
| bezrealitky | `VYBAVENY` | 314 | furnished | ✅ |
| bezrealitky | `NEVYBAVENY` | 280 | not_furnished | ✅ |
| idnes-reality | `nezařízený` | 189 | not_furnished | ✅ |
| idnes-reality | `částečně zařízený` | 99 | partially_furnished | ✅ |
| idnes-reality | `zařízený` | 84 | furnished | ✅ |
| sreality | `0` | 189 | — | ❌ |
| sreality | `3` | 91 | partially_furnished | ✅ |
| sreality | `2` | 84 | not_furnished | ✅ |
| sreality | `1` | 36 | furnished | ✅ |

### Coverage Summary

| Portal | Total | Mapped | Unmapped | Status |
|--------|-------|--------|----------|--------|
| sreality | 400 | 211 | 189 | 53% |
| bezrealitky | 1094 | 1094 | 0 | 100% |
| reality | — | — | — | ⚠️ NOT PROVIDED |
| idnes-reality | 372 | 372 | 0 | 100% |
| realingo | — | — | — | ⚠️ NOT PROVIDED |
| ulovdomov | — | — | — | ⚠️ NOT PROVIDED |
| ceskereality | — | — | — | ⚠️ NOT PROVIDED |
| bazos | — | — | — | ⚠️ NOT PROVIDED |

### ❌ Action Items (Unmapped Values)

- **sreality**: `0` (189× seen) — needs mapping to `furnished`
