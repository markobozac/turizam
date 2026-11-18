# Turistička karta Hrvatske

Interaktivna karta i analiza turizma za svih 556 gradova i općina u Hrvatskoj: noćenja, rast, sezonalnost, premium hotelski kapaciteti, operateri i kakvoća vode za kupanje.

**Live:** https://markobozac.com/turizam/

## Izvori podataka

| Izvor | Sadržaj | Datoteka |
|---|---|---|
| DZS PX-Web, tablica 1.8 (BS_TU18) | kapaciteti, dolasci i noćenja po gradovima i općinama, mjesečno (2023.–2026.) | `data/raw/TU18_*.csv` |
| DZS PX-Web, tablica 1.9 (BS_TU19) | stanovništvo i površina | `data/raw/BS_TU19.csv` |
| DZS PX-Web, BS_T01 | naselja primorskih gradova i općina (za smještaj objekata) | `data/raw/meta_BS_T01.json` |
| Ministarstvo turizma i sporta | popis kategoriziranih ugostiteljskih i turističkih objekata (31. 10. 2026.) | `data/raw/kategorizacija_2026-10-31.xlsx` |
| IZOR | kakvoća vode za kupanje, konačna ocjena prema EU direktivi | `data/raw/izor_eu_*.json` |
| Eurostat GISCO | granice LAU 2024 | `data/raw/lau2024_hr.geojson` |

## Struktura

```
site/               statična stranica koja se objavljuje (HTML, CSS, JS, data.js)
scripts/build.py    gradi site/data.js iz data/raw
scripts/fetch_data.sh  ponovno preuzima izvorne podatke
data/raw/           preuzeti izvorni podaci
```

Nema build koraka za samu stranicu: `site/` je spreman za objavu. Za lokalni pregled otvori `site/index.html` u pregledniku.

## Osvježavanje podataka

```bash
pip install openpyxl shapely
./scripts/fetch_data.sh      # s kućne/uredske mreže; neki državni serveri blokiraju datacentre
python3 scripts/build.py     # zapisuje site/data.js
git commit -am "Osvježeni podaci" && git push
```

Ako Ministarstvo objavi novi popis kategoriziranih objekata, ažuriraj URL u `fetch_data.sh` i naziv datoteke u `scripts/build.py`.

## Licenca

Kod: MIT. Podaci pripadaju navedenim izvorima i koriste se prema njihovim uvjetima ponovne uporabe otvorenih podataka.
