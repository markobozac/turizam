#!/usr/bin/env bash
# Download the raw open data into data/raw, then run scripts/build.py.
# Some government hosts block datacenter IPs, so run this from a normal
# (home/office) connection.
set -euo pipefail
cd "$(dirname "$0")/../data/raw"

# 1) Ministry of Tourism and Sport: list of categorised objects.
#    Check https://mints.gov.hr/kategorizacija-11512/11512 for the newest file name.
KAT_URL=${KAT_URL:-'https://mints.gov.hr/UserDocsImages/1A_UPISNICI/2026/POPIS%20KATEGORIZIRANIH%20UGOSTITELJSKIH%20I%20TURISTI%C4%8CKIH%20OBJEKATA%20U%20RH%20(31.10.2026.).xlsx'}
curl -fsSL -o kategorizacija.xlsx "$KAT_URL"
echo "kategorizacija.xlsx: rename to kategorizacija_<date>.xlsx and update scripts/build.py if the date changed"

# 2) DZS PX-Web: tables 1.8 (capacities, arrivals, nights by city/municipality, monthly)
#    and 1.9 (population, area). The API limits cells per request, so 1.8 is fetched per year.
PX='https://web.dzs.hr/PxWeb/api/v1/hr/Turizam/Dolasci%20i%20no%C4%87enja%20turista%20u%20komercijalnim%20smje%C5%A1tajnim%20objektima'
curl -fsSL -o meta_BS_TU18.json "$PX/BS_TU18.px"
curl -fsSL -o meta_BS_TU19.json "$PX/BS_TU19.px"
python3 - <<'EOF'
import json
m = json.load(open('meta_BS_TU18.json'))
years = [t for t in m['variables'][1]['valueTexts'] if int(t) >= 2023]
for y in years:
    q = []
    for v in m['variables']:
        vals = v['values'] if v['code'] != 'Godina' else [x for x, t in zip(v['values'], v['valueTexts']) if t == y]
        q.append({'code': v['code'], 'selection': {'filter': 'item', 'values': vals}})
    json.dump({'query': q, 'response': {'format': 'csv'}}, open(f'q_TU18_{y}.json', 'w'))
m = json.load(open('meta_BS_TU19.json'))
last = m['variables'][1]['values'][-1]
q = [{'code': v['code'], 'selection': {'filter': 'item', 'values': v['values'] if v['code'] != 'Godina' else [last]}} for v in m['variables']]
json.dump({'query': q, 'response': {'format': 'csv'}}, open('q_BS_TU19.json', 'w'))
print(' '.join(years))
EOF
for q in q_TU18_*.json; do
  y=${q#q_TU18_}; y=${y%.json}
  curl -fsSL -X POST -H 'Content-Type: application/json' --data @"$q" -o "TU18_$y.csv" "$PX/BS_TU18.px"
  sleep 2
done
curl -fsSL -X POST -H 'Content-Type: application/json' --data @q_BS_TU19.json -o BS_TU19.csv "$PX/BS_TU19.px"
rm -f q_*.json

# 3) DZS coastal settlements -> municipality hierarchy (used to place objects)
curl -fsSL -o meta_BS_T01.json 'https://web.dzs.hr/PxWeb/api/v1/hr/Turizam/Turizam%20u%20primorskim%20gradovima%20i%20op%C4%87inama/BS_T01.px'

# 3b) accommodation types: national monthly (BS_TU14) and coastal municipalities (BS_T02 nights, BS_T04 beds)
python3 - <<'EOF2'
import json, urllib.request
def meta(url): return json.load(urllib.request.urlopen(url))
P = 'https://web.dzs.hr/PxWeb/api/v1/hr/Turizam/Turizam%20u%20primorskim%20gradovima%20i%20op%C4%87inama/'
K = 'https://web.dzs.hr/PxWeb/api/v1/hr/Turizam/Dolasci%20i%20no%C4%87enja%20turista%20u%20komercijalnim%20smje%C5%A1tajnim%20objektima/'
def q(m, f):
    return {'query': [{'code': v['code'], 'selection': {'filter': 'item', 'values': [x for x, t in zip(v['values'], v['valueTexts']) if f(v['code'], x, t)]}} for v in m['variables']], 'response': {'format': 'csv'}}
yrs = {'2019', '2023', '2024', '2025'}
def f2(c, x, t):
    if c in ('Prostor', 'Prostorna jedinica'): return x.endswith('000000') or len(t) - len(t.lstrip()) == 5
    if c == 'Godina': return t in yrs
    if c == 'Promet turista': return t == 'Noćenja'
    if c == 'Sobe/Postelje': return t == 'Postelje'
    return True
for name, base, f, out in [('BS_T02', P, f2, 'q_T02.json'), ('BS_T04', P, f2, 'q_T04.json'),
                           ('BS_TU14', K, lambda c, x, t: c != 'Godina' or t >= '2024', 'q_TU14m.json')]:
    json.dump(q(meta(base + name + '.px'), f), open(out, 'w'))
EOF2
curl -fsSL -X POST -H 'Content-Type: application/json' --data @q_T02.json -o T02.csv 'https://web.dzs.hr/PxWeb/api/v1/hr/Turizam/Turizam%20u%20primorskim%20gradovima%20i%20op%C4%87inama/BS_T02.px'
curl -fsSL -X POST -H 'Content-Type: application/json' --data @q_T04.json -o T04.csv 'https://web.dzs.hr/PxWeb/api/v1/hr/Turizam/Turizam%20u%20primorskim%20gradovima%20i%20op%C4%87inama/BS_T04.px'
curl -fsSL -X POST -H 'Content-Type: application/json' --data @q_TU14m.json -o TU14m.csv "$PX/BS_TU14.px"
curl -fsSL -o BS_TU14.csv -X POST -H 'Content-Type: application/json' --data "$(python3 -c "import json,urllib.request;m=json.load(urllib.request.urlopen('$PX/BS_TU14.px'));print(json.dumps({'query':[{'code':v['code'],'selection':{'filter':'item','values':[x for x,t in zip(v['values'],v['valueTexts']) if v['code']!='Mjesec' or t=='01.-12.']}} for v in m['variables']],'response':{'format':'csv'}}))")" "$PX/BS_TU14.px"
rm -f q_*.json

# 4) IZOR bathing water quality, EU final assessment (p_ciklus=-2)
for y in 2024 2025 2026; do
  curl -fsSL -o "izor_eu_$y.json" "https://vrtlac.izor.hr/ords/kakvoca/kakvoce_sve_json?p_jezik=hr&p_god=$y&p_usif=&p_ciklus=-2"
done

# 5) Boundaries: Eurostat GISCO LAU (Croatia only)
if [ ! -f lau2024_hr.geojson ]; then
  curl -fsSL -o /tmp/lau.geojson 'https://gisco-services.ec.europa.eu/distribution/v2/lau/geojson/LAU_RG_01M_2024_4326.geojson'
  python3 -c "import json;d=json.load(open('/tmp/lau.geojson'));json.dump({'type':'FeatureCollection','features':[f for f in d['features'] if f['properties'].get('CNTR_CODE')=='HR']},open('lau2024_hr.geojson','w'))"
fi
echo done
