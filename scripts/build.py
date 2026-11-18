"""Build site/data.js for markobozac.com/turizam from the raw sources in data/raw.

Usage: python3 scripts/build.py [data/raw] [site]

Sources (raw/):
  TU18_<year>.csv  DZS PX-Web BS_TU18 (capacities, arrivals, nights by JLS, monthly)
  BS_TU19.csv      DZS intensity indicators 2025 (population, area)
  kategorizacija_2026-10-31.xlsx  MINTS list of categorised objects
  izor_eu_<year>.json  IZOR bathing water EU annual assessment
  lau2024_hr.geojson   Eurostat GISCO LAU 2024 boundaries (Croatia)
  meta_BS_T01.json     DZS naselja -> JLS hierarchy (coastal)
"""
import csv, json, re, sys, unicodedata, collections, io
import openpyxl
from shapely.geometry import shape, Point, mapping
from shapely.ops import unary_union

RAW = sys.argv[1] if len(sys.argv) > 1 else 'data/raw'
OUT = sys.argv[2] if len(sys.argv) > 2 else 'site'

def norm(s):
    s = unicodedata.normalize('NFKD', s.lower())
    s = ''.join(c for c in s if not unicodedata.combining(c))
    s = s.replace('đ', 'd')
    s = re.sub(r'[^a-z0-9]+', ' ', s).strip()
    return s

def num(x):
    x = (x or '').strip()
    if x in ('', '-', '..', '...'):
        return 0
    if x == 'z':  # statistical confidentiality
        return None
    return float(x)

# ---------- 1. territorial hierarchy from DZS meta ----------
meta = json.load(open(f'{RAW}/meta_BS_TU18.json', encoding='utf-8'))
units = meta['variables'][0]['valueTexts']
NUTS2 = {'Republika Hrvatska', 'Panonska Hrvatska', 'Jadranska Hrvatska', 'Grad Zagreb', 'Sjeverna Hrvatska'}
jls = []  # (index, name, county)
county = None
for i, u in enumerate(units):
    if u.endswith('županija'):
        county = u.replace('Grad Zagreb županija', 'Grad Zagreb')
        continue
    if u in NUTS2 and not (u == 'Grad Zagreb' and county == 'Grad Zagreb' and i > 0 and units[i-1] == 'Grad Zagreb županija'):
        continue
    jls.append((i, u, county))
assert len(jls) == 556, len(jls)

# ---------- 2. DZS monthly data ----------
def read_tu18(year):
    raw = open(f'{RAW}/TU18_{year}.csv', 'rb').read().decode('cp1250')
    rows = list(csv.reader(io.StringIO(raw)))
    hdr = rows[0]
    return hdr, rows[1:]

MEAS = {'Broj soba, apartmana i mjesta za kampiranje': 'units', 'Broj stalnih postelja': 'beds',
        'Dolasci turista - ukupno': 'arr', 'Dolasci turista - domaći': 'arr_d', 'Dolasci turista - strani': 'arr_f',
        'Noćenja turista - ukupno': 'n', 'Noćenja turista - domaći': 'n_d', 'Noćenja turista  - strani': 'n_f'}

data = {}  # name|county -> {year: {month: {meas: v}}}
for year in (2023, 2024, 2025, 2026):
    hdr, rows = read_tu18(year)
    assert len(rows) == len(units)
    for i, row in enumerate(rows):
        key = i
        for h, v in zip(hdr[1:], row[1:]):
            m = re.match(r'(\d{4}) (\S+) (.*)$', h)
            y, mon, meas = m.group(1), m.group(2), m.group(3)
            meas = MEAS[meas]
            data.setdefault(key, {}).setdefault(int(y), {}).setdefault(mon, {})[meas] = num(v)

# ---------- 3. intensity (population, area) ----------
raw = open(f'{RAW}/BS_TU19.csv', 'rb').read().decode('cp1250')
rows = list(csv.reader(io.StringIO(raw)))
assert len(rows) - 1 == len(units)
pop = {}
for i, row in enumerate(rows[1:]):
    pop[i] = (num(row[1]), num(row[2]))

# ---------- 4. geometry ----------
geo = json.load(open(f'{RAW}/lau2024_hr.geojson', encoding='utf-8'))
by_name = collections.defaultdict(list)
for f in geo['features']:
    by_name[norm(f['properties']['LAU_NAME'])].append(f)

ALIASES = {'Motovun - Montana': 'Motovun - Montona'}

def lau_for(name, cnty):
    k = norm(name)
    cands = by_name.get(k) or by_name.get(norm(ALIASES.get(name, name)))
    if not cands:
        # try prefix match (e.g. 'Bale' vs 'Bale - Valle')
        cands = [f for kk, fs in by_name.items() for f in fs if kk.startswith(k + ' ') or k.startswith(kk + ' ')]
    if len(cands) == 1:
        return cands[0]
    if len(cands) > 1:
        east = cnty in ('Vukovarsko-srijemska županija', 'Osječko-baranjska županija')
        inland_zg = cnty == 'Zagrebačka županija'
        def lon(f):
            return shape(f['geometry']).centroid.x
        if name in ('Otok', 'Privlaka'):
            return max(cands, key=lon) if east else min(cands, key=lon)
        if name == 'Sveta Nedelja':
            return max(cands, key=lon) if inland_zg else min(cands, key=lon)
    return None

units_out = []
used = set()
for idx, name, cnty in jls:
    f = lau_for(name, cnty)
    if f is None:
        print('NO GEO', name, cnty)
        continue
    gid = f['properties']['GISCO_ID']
    assert gid not in used, (name, gid)
    used.add(gid)
    units_out.append({'idx': idx, 'name': name, 'county': cnty, 'gid': gid, 'feature': f})
print('matched', len(units_out))
_cnt = collections.Counter(u['name'] for u in units_out)
for u in units_out:
    u['label'] = u['name']
    if _cnt[u['name']] > 1:
        u['name'] = f"{u['name']} ({u['county'].replace(' županija','')})"


# ---------- 5. naselje -> JLS (county aware) ----------
def base(s):
    # 'Poreč - Parenzo' -> 'Poreč';  'Umag -Umago' -> 'Umag'
    return re.split(r'\s+-\s*', s)[0].strip()

def cnorm(c):
    return norm(c.replace(' županija', ''))

mt1 = json.load(open(f'{RAW}/meta_BS_T01.json', encoding='utf-8'))
nas = collections.defaultdict(dict)   # county_norm -> {naselje_norm: jls_name}
glob = {}
cur_c = cur_j = None
for t in mt1['variables'][0]['valueTexts']:
    depth = len(t) - len(t.lstrip(' '))
    s_ = t.strip()
    if depth == 0:
        cur_c = cnorm(s_); continue
    if depth == 5:
        cur_j = s_
    for key in {norm(s_), norm(base(s_))}:
        nas[cur_c].setdefault(key, cur_j)
        glob.setdefault(key, cur_j)

jls_by_c = collections.defaultdict(dict)
for u in units_out:
    c = cnorm(u['county'])
    for key in {norm(u['label']), norm(base(u['label']))}:
        jls_by_c[c][key] = u['name']
        nas[c][key] = u['name']
name_to_unit = {u['name']: u for u in units_out}

MANUAL = {
    'vabriga': 'Tar-Vabriga', 'tar': 'Tar-Vabriga', 'banjole': 'Medulin', 'premantura': 'Medulin',
    'rabac': 'Labin', 'sveta marina': 'Raša', 'savudrija': 'Umag', 'cervar': 'Poreč', 'cervar porec': 'Poreč',
    'krnica': 'Marčana', 'stara baska': 'Punat', 'ika': 'Opatija', 'icici': 'Opatija', 'volosko': 'Opatija',
    'dramalj': 'Crikvenica', 'selce': 'Crikvenica', 'jablanac': 'Senj', 'brijuni': 'Pula', 'veli brijun': 'Pula',
    'punta kriza': 'Mali Lošinj', 'veli losinj': 'Mali Lošinj', 'nerezine': 'Mali Lošinj', 'susak': 'Mali Lošinj',
    'martinscica': 'Cres', 'osor': 'Mali Lošinj', 'roc': 'Buzet', 'kanegra': 'Umag', 'lindar': 'Pazin',
    'sibinj krmpotski': 'Novi Vinodolski', 'klenovica': 'Novi Vinodolski', 'povile': 'Novi Vinodolski',
    'bakarac': 'Bakar', 'njivice': 'Omišalj', 'silo': 'Dobrinj', 'klimno': 'Dobrinj',
    'plitvicka jezera': 'Plitvička Jezera', 'licko petrovo selo': 'Plitvička Jezera', 'grabovac': 'Rakovica',
    'kapela dvor': 'Pitomača', 'basko polje': 'Baška Voda',
    'brod na kupi': 'Delnice', 'korenica': 'Plitvička Jezera', 'vrelo korenicko': 'Plitvička Jezera',
    'smoljanac': 'Plitvička Jezera', 'studenci': 'Lovreć', 'kovacica 16': 'Makarska', 'gromacnik': 'Podcrkavlje',
    'mreznicki brig': 'Duga Resa', 'hampovica': 'Đurđevac', 'skaricevo': 'Krapina', 'tuheljske toplice': 'Tuhelj',
    'lug': 'Bilje', 'kostajnica': 'Hrvatska Kostajnica', 'turcin': 'Gornji Kneginec',
    'horvatsko': 'Sveti Križ Začretje', 'rakitje': 'Sveta Nedelja', 'rakov potok': 'Samobor', 'staro cice': 'Velika Gorica',
}

def resolve(jname, c=None):
    if jname in name_to_unit:
        return jname
    hits = [u['name'] for u in units_out if norm(base(u['label'])) == norm(base(jname))]
    if c is not None:
        inc = [h for h in hits if cnorm(name_to_unit[h]['county']) == c]
        if inc:
            return inc[0]
    return hits[0] if len(hits) == 1 else None

def place_to_jls(place, addr, cnty):
    c = cnorm(cnty)
    if c == 'grad zagreb':
        return 'Grad Zagreb'
    if 'Romana Beach' in addr or 'Ivana Gorana Kovačića 16' in place:
        return 'Makarska'
    texts = [place] + list(reversed([x.strip() for x in addr.split(',') if x.strip()]))
    for t in texts:
        t = re.sub(r'^\d{5}\s*', '', t)
        t = re.sub(r'\(.*?\)', '', t)
        n = norm(base(t))
        if not n:
            continue
        toks = n.split(' ')
        keys = [n, ' '.join(toks[-2:]), toks[-1], toks[0]]
        for k in keys:
            if k in MANUAL:
                r = resolve(MANUAL[k], c)
                if r: return r
            if k in nas.get(c, {}):
                r = resolve(nas[c][k], c)
                if r: return r
    # global fallback (only exact place)
    n = norm(base(re.sub(r'^\d{5}\s*', '', place)))
    if n in glob:
        return resolve(glob[n])
    return None

# ---------- 6. categorised objects ----------
wb = openpyxl.load_workbook(f'{RAW}/kategorizacija_2026-10-31.xlsx', read_only=True, data_only=True)
ws = wb['POPIS']
COUNTIES = {'Istarska', 'Primorsko-goranska', 'Ličko-senjska', 'Zadarska', 'Šibensko-Kninska', 'Splitsko-dalmatinska',
            'Dubrovačko-neretvanska', 'Bjelovarsko-bilogorska', 'Brodsko-posavska', 'Grad Zagreb', 'Karlovačka',
            'Koprivničko-križevačka', 'Krapinsko-zagorska', 'Međimurska', 'Osječko-baranjska', 'Požeško-slavonska',
            'Sisačko-moslavačka', 'Varaždinska', 'Virovitičko-podravska', 'Vukovarsko-srijemska', 'Zagrebačka'}
objs = []
ctype = ccounty = ccat = None
uidx = None
for r in ws.iter_rows(values_only=True):
    r = [('' if v is None else str(v)) for v in r] + [''] * 15
    c0 = r[0].strip()
    if c0 in COUNTIES and not r[5]:
        ccounty = c0; continue
    if r[5] in COUNTIES and c0 and not c0[0].isdigit():
        ctype, ccounty = c0, r[5]; continue
    if c0 == 'Rbr.':
        continue
    if c0 == '' and r[1].startswith('kategorija'):
        uidx = next(i for i, x in enumerate(r) if x.startswith('Ukupno'))
        continue
    if re.fullmatch(r'\d+', c0) and r[1] and not r[2] and not r[4]:
        ccat = r[1].strip(); continue
    if c0 == '1' and r[1]:
        addr_lines = [x.strip() for x in r[2].split('\n') if x.strip()]
        addr = ', '.join(addr_lines)
        place = addr_lines[-1] if addr_lines else ''
        op = r[4].split('\n')[0].strip().rstrip(',').strip()
        units_ = num(r[uidx]); beds = num(r[uidx + 1]) if ctype != 'Marina' else 0
        stars = int(re.sub(r'\D', '', ccat) or 0)
        objs.append({'type': ctype, 'county': ccounty, 'stars': stars,
                     'name': re.sub(r'\s+', ' ', r[1]).strip(), 'addr': addr, 'place': place,
                     'op': op, 'units': int(units_), 'beds': int(beds)})
print('objects', len(objs))

COUNTY_FULL = {}
for u in units_out:
    COUNTY_FULL.setdefault(norm(u['county'].replace(' županija', '')), u['county'])

unmatched = []
for o in objs:
    j = place_to_jls(o['place'], o['addr'], o['county'])
    o['jls'] = j
    if not j:
        unmatched.append(o)
print('unmatched objects', len(unmatched))
for o in unmatched[:80]:
    print('  ?', o['county'], '|', o['place'], '|', o['addr'], '|', o['name'])

# sanity: object county vs jls county
jls_county = {u['name']: u['county'] for u in units_out}
mism = [o for o in objs if o['jls'] and cnorm(jls_county[o['jls']]) != cnorm(o['county'])]
print('county mismatches', len(mism))
for o in mism[:40]:
    print('  !', o['county'], '->', o['jls'], jls_county[o['jls']], '|', o['place'], '|', o['name'])



# ======================= STAGE 2: aggregate & export =======================
from shapely.geometry import shape as _shape, Point as _Pt
from shapely import set_precision

def g(i, y, mon, meas):
    v = data[i].get(y, {}).get(mon, {}).get(meas)
    return v

MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12']
# months published for 2026
pub26 = [m for m in MONTHS if g(0, 2026, m, 'n') not in (None, 0)]
print('2026 months published', pub26)

geoms = {}
for u in units_out:
    geoms[u['name']] = _shape(u['feature']['geometry'])

# bathing waters
beach = {}
for y in (2025, 2026):
    bm = json.load(open(f'{RAW}/izor_eu_{y}.json', encoding='utf-8'))['markers']
    beach[y] = bm
# point in polygon (with small buffer fallback for coastal points falling in sea)
from shapely.strtree import STRtree
names = [u['name'] for u in units_out]
polys = [geoms[n] for n in names]
tree = STRtree(polys)
def locate(lat, lng):
    p = _Pt(lng, lat)
    for i in tree.query(p):
        if polys[i].contains(p):
            return names[i]
    i = tree.nearest(p)
    return names[i]
beach_pts = []
for b in beach[2026]:
    j = locate(b['lat'], b['lng'])
    beach_pts.append({'lat': round(b['lat'], 5), 'lng': round(b['lng'], 5), 'q': b['locj'], 'n': b['lpla'], 'j': j})
beach_by_j = collections.defaultdict(list)
for b in beach_pts:
    beach_by_j[b['j']].append(b['q'])

objs_by_j = collections.defaultdict(list)
for o in objs:
    objs_by_j[o['jls']].append(o)

HOTELISH = {'Hotel', 'Aparthotel', 'Turističko naselje'}
out_units = []
for u in units_out:
    i = u['idx']
    rec = {'id': u['gid'], 'name': u['name'], 'label': u['label'], 'county': u['county']}
    p, a = pop[i]
    rec['pop'] = int(p or 0); rec['area'] = round(a or 0, 1)
    for y in (2023, 2024, 2025):
        rec[f'n{y}'] = g(i, y, '01.-12.', 'n')
        rec[f'a{y}'] = g(i, y, '01.-12.', 'arr')
    rec['nf2025'] = g(i, 2025, '01.-12.', 'n_f')
    rec['beds2025'] = g(i, 2025, '01.-12.', 'beds')
    rec['m2025'] = [g(i, 2025, m, 'n') for m in MONTHS]
    rec['m2026'] = [g(i, 2026, m, 'n') for m in pub26]
    # YTD comparison
    ytd25 = [g(i, 2025, m, 'n') for m in pub26]
    ytd26 = rec['m2026']
    rec['ytd25'] = None if any(v is None for v in ytd25) else sum(ytd25)
    rec['ytd26'] = None if any(v is None for v in ytd26) else sum(ytd26)
    # categorised
    ob = objs_by_j.get(u['name'], [])
    def beds(f):
        return sum(o['beds'] for o in ob if f(o))
    rec['c_hotel_beds'] = beds(lambda o: o['type'] in HOTELISH)
    rec['c_prem_beds'] = beds(lambda o: o['type'] in HOTELISH and o['stars'] >= 4)
    rec['c_5_beds'] = beds(lambda o: o['type'] in HOTELISH and o['stars'] == 5)
    rec['c_camp_beds'] = beds(lambda o: o['type'] == 'Kamp')
    rec['c_camp_prem'] = beds(lambda o: o['type'] == 'Kamp' and o['stars'] >= 4)
    rec['c_apt_beds'] = beds(lambda o: o['type'] == 'Turistički apartmani')
    rec['c_berths'] = sum(o['units'] for o in ob if o['type'] == 'Marina')
    rec['c_n'] = len(ob)
    bq = beach_by_j.get(u['name'], [])
    rec['b_n'] = len(bq)
    rec['b_exc'] = sum(1 for q in bq if q == 1)
    rec['b_bad'] = sum(1 for q in bq if q >= 3)
    out_units.append(rec)

# objects export (compact)
TYPES = ['Hotel', 'Aparthotel', 'Turističko naselje', 'Turistički apartmani', 'Kamp', 'Marina']
obj_out = [[TYPES.index(o['type']), o['stars'], o['name'], o['op'], o['beds'], o['units'], o['jls']] for o in objs]

# geometry (simplified)
feats = []
for u in units_out:
    gm = geoms[u['name']].simplify(0.0015, preserve_topology=True)
    gm = set_precision(gm, 0.0001)
    feats.append({'type': 'Feature', 'id': u['gid'], 'properties': {}, 'geometry': mapping(gm)})
geo_out = {'type': 'FeatureCollection', 'features': feats}

# national totals
nat = {}
for y in (2023, 2024, 2025):
    nat[f'n{y}'] = g(0, y, '01.-12.', 'n'); nat[f'a{y}'] = g(0, y, '01.-12.', 'arr')
nat['m2025'] = [g(0, 2025, m, 'n') for m in MONTHS]
nat['m2026'] = [g(0, 2026, m, 'n') for m in pub26]
nat['m2024'] = [g(0, 2024, m, 'n') for m in MONTHS]
nat['beds2025'] = g(0, 2025, '01.-12.', 'beds')
nat['pub26'] = pub26

meta_out = {
    'generated': '2026-11-18',
    'sources': {
        'dzs': 'DZS PX-Web, Tablica 1.8 (BS_TU18), ažurirano 5.11.2026.; Tablica 1.9 (BS_TU19)',
        'mints': 'Ministarstvo turizma i sporta, Popis kategoriziranih ugostiteljskih i turističkih objekata (31.10.2026.)',
        'izor': 'Institut za oceanografiju i ribarstvo, kakvoća mora za kupanje, konačna ocjena (EU) 2026.',
        'geo': 'Eurostat GISCO, LAU 2024 granice',
    },
}
bundle = {'meta': meta_out, 'nat': nat, 'units': out_units, 'objs': obj_out, 'types': TYPES,
          'beaches': [[b['lat'], b['lng'], b['q'], b['n'], b['j']] for b in beach_pts], 'geo': geo_out}
s = json.dumps(bundle, ensure_ascii=False, separators=(',', ':'))
open(f'{OUT}/data.js', 'w', encoding='utf-8').write('window.TURIZAM=' + s + ';')
print('data.js bytes', len(s.encode()))
