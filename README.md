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

## Objava (continuous deploy)

Svaki push u `main` koji mijenja `site/` pokreće `.github/workflows/deploy.yml`, koji preko FTPS-a sinkronizira `site/` u `public_html/markobozac/turizam/` na hosting.com serveru. Workflow dodaje `?v=<commit>` na CSS/JS kako bi preglednici uvijek dobili novu verziju.

Potrebni GitHub secrets (Settings → Secrets and variables → Actions):

| Secret | Vrijednost |
|---|---|
| `FTP_SERVER` | FTP poslužitelj iz cPanela (FTP Accounts → Configure FTP Client) |
| `FTP_USERNAME` | FTP račun čiji je direktorij `public_html/markobozac/turizam` |
| `FTP_PASSWORD` | lozinka tog FTP računa |

Umjesto posebnog FTP računa može se koristiti glavni cPanel račun (`FTP_USERNAME` = cPanel korisničko ime, `FTP_PASSWORD` = cPanel lozinka). Tada dodaj i repo varijablu (Settings → Secrets and variables → Actions → Variables) `FTP_SERVER_DIR` = `public_html/markobozac/turizam/`. Napomena: glavni račun ima pristup svim stranicama na hostingu, pa je zaseban FTP račun sigurniji.

Bez tih secreta workflow samo ispisuje upozorenje i ne objavljuje ništa. Ručna objava: Actions → Deploy → Run workflow.

## Licenca

Kod: MIT. Podaci pripadaju navedenim izvorima i koriste se prema njihovim uvjetima ponovne uporabe otvorenih podataka.
