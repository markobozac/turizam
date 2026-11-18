(function () {
  'use strict';
  const D = window.TURIZAM;
  const U = D.units;
  const byId = new Map(U.map(u => [u.id, u]));
  const NAT = D.nat;
  const MON = ['sij', 'velj', 'ožu', 'tra', 'svi', 'lip', 'srp', 'kol', 'ruj', 'lis', 'stu', 'pro'];
  const PUB = NAT.pub26.length; // months of 2026 published
  const GEN = ['siječnja', 'veljače', 'ožujka', 'travnja', 'svibnja', 'lipnja', 'srpnja', 'kolovoza', 'rujna', 'listopada', 'studenoga', 'prosinca'];
  const TYPES = D.types;
  const HOTELISH = new Set([0, 1, 2]);

  // ---------- formatting ----------
  const nf = new Intl.NumberFormat('hr-HR');
  const fmt = v => (v == null ? '–' : nf.format(Math.round(v)));
  const pct = (v, d = 1) => (v == null ? '–' : (v * 100).toLocaleString('hr-HR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %');
  const spct = (v, d = 1) => (v == null ? '–' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v * 100).toLocaleString('hr-HR', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %');
  const mil = v => (v / 1e6).toLocaleString('hr-HR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' mil.';
  const short = n => n.replace(/\s+-\s*\S.*$/, '').replace(/\s+\(.*\)$/, '') || n;
  const nm = u => short(u.label);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const sum = a => a.reduce((s, x) => s + (x || 0), 0);

  // ---------- derived metrics ----------
  const objsBy = new Map();
  D.objs.forEach(o => { if (!objsBy.has(o[6])) objsBy.set(o[6], []); objsBy.get(o[6]).push(o); });
  U.forEach(u => {
    u.objs = objsBy.get(u.name) || [];
    u.growth = (u.n2023 >= 20000 && u.n2025 != null) ? u.n2025 / u.n2023 - 1 : null;
    u.ytd = (u.ytd25 >= 20000 && u.ytd26 != null) ? u.ytd26 / u.ytd25 - 1 : null;
    u.season = (u.n2025 >= 20000 && u.m2025.every(v => v != null)) ? (u.m2025[6] + u.m2025[7]) / u.n2025 : null;
    u.prem = (u.n2025 >= 100000) ? u.c_prem_beds / u.n2025 * 1e4 : null;
    u.intens = (u.n2025 != null && u.pop > 0) ? u.n2025 / u.pop : null;
    u.sea = u.b_n > 0 ? u.b_exc / u.b_n : null;
    u.foreign = (u.n2025 > 0 && u.nf2025 != null) ? u.nf2025 / u.n2025 : null;
  });
  const natPrem = sum(U.map(u => u.c_prem_beds)) / NAT.n2025 * 1e4;
  U.forEach(u => {
    u.npb = (u.beds2025 && u.n2025) ? u.n2025 / u.beds2025 : null;
    // accommodation types (coastal municipalities only): [hotels, private, camps, other, total]
    const tn = u.tn && u.tn[2025], tb = u.tb && u.tb[2025];
    u.coastal = !!tn;
    u.ps = tn && tn[4] && tn[1] != null ? tn[1] / tn[4] : null;
    u.pocc = tn && tb && tn[1] && tb[1] ? tn[1] / tb[1] : null;
    u.hocc = tn && tb && tn[0] && tb[0] ? tn[0] / tb[0] : null;
    u.pbeds = tb ? tb[1] : null;
  });
  const TT = Object.fromEntries(NAT.types.map(t => [t.name, t]));
  const T25 = n => TT[n].years[2025];
  const HR_POCC = T25('Privatni smještaj (sobe, apartmani, kuće)').n / T25('Privatni smještaj (sobe, apartmani, kuće)').beds;
  const HR_HOCC = T25('Hoteli').n / T25('Hoteli').beds;
  const HR_PS = T25('Privatni smještaj (sobe, apartmani, kuće)').n / T25('Ukupno').n;
  // coastal panel uses DZS groups 55.1 (hotels and similar) and 55.2 (private and similar)
  const HR_OCC51 = T25('55.1').n / T25('55.1').beds, HR_OCC52 = T25('55.2').n / T25('55.2').beds;
  // peer group for "high / low" badges: places with at least 50.000 nights
  const PEERS = U.filter(u => u.n2025 >= 50000);
  const DIST = {};
  ['npb', 'growth', 'ytd', 'season', 'foreign', 'intens', 'n2025', 'beds2025', 'ps', 'pocc', 'hocc'].forEach(k => {
    DIST[k] = PEERS.map(u => u[k]).filter(v => v != null).sort((a, b) => a - b);
  });
  // good: true = higher is better, false = lower is better, null = neutral
  function lvl(k, v, good) {
    if (v == null || !DIST[k] || DIST[k].length < 10) return '';
    const d = DIST[k];
    let i = 0; while (i < d.length && d[i] < v) i++;
    const p = i / d.length;
    const t = p >= 0.75 ? 'visoko' : p <= 0.25 ? 'nisko' : 'prosječno';
    const cls = t === 'prosječno' || good == null ? 'neu' : ((t === 'visoko') === good ? 'good' : 'bad');
    const arrow = t === 'visoko' ? '▲' : t === 'nisko' ? '▼' : '●';
    return `<span class="lvl ${cls}" title="Više od ${Math.round(p * 100)} % od ${d.length} usporedivih mjesta (50.000+ noćenja)">${arrow} ${t}</span>`;
  }

  // ---------- metric definitions ----------
  const SEQ = ['--sea-0', '--sea-1', '--sea-2', '--sea-3', '--sea-4', '--sea-5', '--sea-6'];
  const DIV = ['--neg-2', '--neg-1', '--neu', '--pos-1', '--pos-2'];
  const METRICS = [
    { key: 'n2025', label: 'Noćenja 2025.', breaks: [10000, 50000, 150000, 400000, 1000000, 2000000], colors: SEQ, fmt: v => fmt(v),
      legend: ['< 10 tis.', '10–50 tis.', '50–150 tis.', '150–400 tis.', '0,4–1 mil.', '1–2 mil.', '> 2 mil.'],
      note: 'Noćenja turista u komercijalnom smještaju u 2025. (DZS).' },
    { key: 'ytd', label: `2026. (sij–${MON[PUB - 1]})`, breaks: [-0.1, -0.02, 0.02, 0.1], colors: DIV, fmt: v => spct(v),
      legend: ['pad > 10 %', 'pad 2–10 %', '± 2 %', 'rast 2–10 %', 'rast > 10 %'],
      note: `Promjena noćenja od siječnja do ${GEN[PUB - 1]} 2026. u odnosu na isto razdoblje 2025. Prikazano za mjesta s barem 20.000 noćenja.` },
    { key: 'growth', label: 'Rast 2023.–2025.', breaks: [-0.1, -0.02, 0.02, 0.1], colors: DIV, fmt: v => spct(v),
      legend: ['pad > 10 %', 'pad 2–10 %', '± 2 %', 'rast 2–10 %', 'rast > 10 %'],
      note: 'Promjena godišnjih noćenja 2025. u odnosu na 2023. Prikazano za mjesta s barem 20.000 noćenja u 2023.' },
    { key: 'season', label: 'Ovisnost o srpnju i kolovozu', breaks: [0.25, 0.35, 0.45, 0.52, 0.58], colors: ['--sea-0', '--sea-1', '--sea-2', '--sea-3', '--sea-4', '--sea-6'], fmt: v => pct(v, 0),
      legend: ['< 25 %', '25–35 %', '35–45 %', '45–52 %', '52–58 %', '> 58 %'],
      note: 'Udio srpnja i kolovoza u godišnjim noćenjima 2025. Što je tamnije, sezona je kraća.' },
    { key: 'prem', label: 'Premium hotelski kapacitet', breaks: [1, 5, 10, 20, 30], colors: ['--neg-2', '--neg-1', '--neu', '--sea-2', '--sea-4', '--sea-6'], fmt: v => v.toLocaleString('hr-HR', { maximumFractionDigits: 1 }) + ' / 10 tis.',
      legend: ['< 1', '1–5', '5–10', '10–20', '20–30', '> 30'],
      note: `Kreveti u hotelima, aparthotelima i turističkim naseljima s 4 i 5 zvjezdica na 10.000 noćenja. Hrvatski prosjek: ${natPrem.toLocaleString('hr-HR', { maximumFractionDigits: 1 })}. Crveno = jaka potražnja, malo premium hotela. Prikazano za mjesta s barem 100.000 noćenja.` },
    { key: 'intens', label: 'Noćenja po stanovniku', breaks: [1, 10, 50, 150, 400, 1000], colors: SEQ, fmt: v => fmt(v),
      legend: ['< 1', '1–10', '10–50', '50–150', '150–400', '400–1000', '> 1000'],
      note: 'Godišnja noćenja 2025. po stanovniku (Popis 2021.). Mjera turističkog pritiska na lokalnu zajednicu.' },
    { key: 'ps', label: 'Mali iznajmljivači', breaks: [0.2, 0.4, 0.6, 0.8, 0.9], colors: ['--sea-0', '--sea-1', '--sea-2', '--sea-3', '--sea-4', '--sea-6'], fmt: v => pct(v, 0) + ' noćenja',
      legend: ['< 20 %', '20–40 %', '40–60 %', '60–80 %', '80–90 %', '> 90 %'],
      note: `Udio privatnog smještaja (sobe, apartmani i kuće za odmor malih iznajmljivača) u noćenjima 2025. Hrvatski prosjek: ${pct(HR_PS, 0)}. Podjela po vrsti smještaja postoji samo za primorske gradove i općine.` },
    { key: 'sea', label: 'Kakvoća mora', breaks: [0.8, 0.9, 0.999], colors: ['--neg-2', '--neg-1', '--sea-2', '--sea-4'], fmt: v => pct(v, 0) + ' izvrsno',
      legend: ['< 80 % izvrsno', '80–90 %', '90–99 %', 'sva mjesta izvrsna'],
      note: 'Udio mjernih mjesta s izvrsnom kakvoćom mora za kupanje (konačna ocjena 2026., IZOR). Unutrašnjost bez mjernih mjesta je siva.' },
  ];
  let metric = METRICS[0];
  let selected = null;

  const css = name => `var(${name})`;
  function colorFor(v, m) {
    if (v == null) return null;
    let i = 0; while (i < m.breaks.length && v >= m.breaks[i]) i++;
    return m.colors[i];
  }

  // ---------- KPIs ----------
  (function kpis() {
    const ytd25 = sum(NAT.m2025.slice(0, PUB)), ytd26 = sum(NAT.m2026);
    const ja = (NAT.m2025[6] + NAT.m2025[7]) / NAT.n2025;
    const sorted = U.filter(u => u.n2025).sort((a, b) => b.n2025 - a.n2025);
    const top10 = sum(sorted.slice(0, 10).map(u => u.n2025)) / NAT.n2025;
    const bex = D.beaches.filter(b => b[2] === 1).length / D.beaches.length;
    const k = [
      { v: mil(NAT.n2025), l: 'noćenja u 2025.', d: `${spct(NAT.n2025 / NAT.n2024 - 1)} u odnosu na 2024.`, c: NAT.n2025 >= NAT.n2024 },
      { v: spct(ytd26 / ytd25 - 1), l: `2026. sij–${MON[PUB - 1]} prema 2025.`, d: `${mil(ytd26)} noćenja`, c: ytd26 >= ytd25 },
      { v: pct(top10, 0), l: 'noćenja u 10 najvećih destinacija', d: `od ${sorted.length} mjesta s noćenjima` },
      { v: pct(ja, 0), l: 'noćenja u srpnju i kolovozu', d: `lipanj–rujan: ${pct(sum(NAT.m2025.slice(5, 9)) / NAT.n2025, 0)}` },
      { v: pct(bex, 0), l: 'mjesta za kupanje izvrsne kakvoće', d: `${fmt(D.beaches.length)} mjesta na moru, rijekama i jezerima, 2026.` },
    ];
    document.getElementById('kpis').innerHTML = k.map(x =>
      `<div class="kpi"><div class="v">${x.v}</div><div class="l">${x.l}</div><div class="d ${x.c === true ? 'up' : x.c === false ? 'down' : ''}">${x.d}</div></div>`).join('');
  })();

  // ---------- map ----------
  const svg = document.getElementById('map');
  const NS = 'http://www.w3.org/2000/svg';
  const LAT0 = 44.5, KX = Math.cos(LAT0 * Math.PI / 180);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const proj = ([lon, lat]) => [lon * KX * 100, -lat * 100];
  D.geo.features.forEach(f => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    polys.forEach(p => p.forEach(r => r.forEach(c => { const [x, y] = proj(c); if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; })));
  });
  const pad = 4;
  svg.setAttribute('viewBox', `${(minX - pad).toFixed(1)} ${(minY - pad).toFixed(1)} ${(maxX - minX + 2 * pad).toFixed(1)} ${(maxY - minY + 2 * pad).toFixed(1)}`);
  const pathOf = g => {
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    return polys.map(p => p.map(r => 'M' + r.map(c => proj(c).map(n => n.toFixed(2)).join(',')).join('L') + 'Z').join('')).join('');
  };
  // hatch pattern for confidential data
  svg.innerHTML = `<defs><pattern id="hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="var(--nodata)"/><line x1="0" y1="0" x2="0" y2="4" stroke="var(--line)" stroke-width="1.6"/></pattern></defs>`;
  const gU = document.createElementNS(NS, 'g'); svg.appendChild(gU);
  const gB = document.createElementNS(NS, 'g'); svg.appendChild(gB);
  const pathEls = new Map();
  D.geo.features.forEach(f => {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', pathOf(f.geometry));
    p.setAttribute('class', 'u');
    p.dataset.id = f.id;
    gU.appendChild(p);
    pathEls.set(f.id, p);
  });
  // ---------- hero background: Croatia drawn from the data ----------
  (function hero() {
    const h = document.getElementById('herobg');
    h.setAttribute('viewBox', svg.getAttribute('viewBox'));
    const op = v => v == null || v < 1000 ? 0.10 : v < 50000 ? 0.20 : v < 150000 ? 0.32 : v < 400000 ? 0.46 : v < 1000000 ? 0.62 : v < 2000000 ? 0.80 : 0.95;
    let out = '';
    D.geo.features.forEach(f => {
      const u = byId.get(f.id);
      out += `<path d="${pathEls.get(f.id).getAttribute('d')}" fill="#9fe3ea" fill-opacity="${op(u && u.n2025)}" stroke="#0d3446" stroke-width=".35"/>`;
    });
    D.beaches.forEach(b => { const [x, y] = proj([b[1], b[0]]); out += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="1.1" fill="#ffd27a" fill-opacity=".85"/>`; });
    h.innerHTML = out;
    document.getElementById('herofig').innerHTML = `<span><b>${fmt(U.length)}</b> gradova i općina</span><span><b>${fmt(D.objs.length)}</b> hotela, kampova i marina</span><span><b>${fmt(D.beaches.length)}</b> mjesta za kupanje</span>`;
  })();

  const QCOL = { 1: '--sea-4', 2: '--good', 3: '--warn', 4: '--bad' };
  D.beaches.forEach(b => {
    const c = document.createElementNS(NS, 'circle');
    const [x, y] = proj([b[1], b[0]]);
    c.setAttribute('cx', x.toFixed(2)); c.setAttribute('cy', y.toFixed(2));
    c.dataset.r = b[2] >= 3 ? 1.6 : 0.9;
    c.setAttribute('r', c.dataset.r);
    c.setAttribute('class', 'b');
    c.dataset.n = b[3]; c.dataset.q = b[2]; c.dataset.j = b[4];
    c.style.fill = css(QCOL[b[2]] || '--muted');
    gB.appendChild(c);
  });
  const showB = document.getElementById('showBeaches');
  gB.style.display = 'none';
  showB.addEventListener('change', () => { gB.style.display = showB.checked ? '' : 'none'; window.track && window.track('toggle_beaches', { on: showB.checked }); });

  function paint() {
    U.forEach(u => {
      const p = pathEls.get(u.id);
      const v = u[metric.key];
      const c = colorFor(v, metric);
      const confidential = metric.key === 'n2025' ? u.n2025 == null : false;
      p.style.fill = c ? css(c) : (confidential ? 'url(#hatch)' : css('--nodata'));
    });
    const lg = document.getElementById('legend');
    lg.innerHTML = `<div class="t">${metric.label}</div>` + metric.colors.map((c, i) =>
      `<div class="row"><span class="sw" style="background:${css(c)}"></span>${metric.legend[i]}</div>`).join('') +
      `<div class="row"><span class="sw" style="background:var(--nodata);border:1px solid var(--line)"></span>nema podatka</div>`;
    document.getElementById('metricNote').textContent = metric.note;
  }

  const tabs = document.getElementById('metricTabs');
  tabs.innerHTML = METRICS.map((m, i) => `<button role="tab" type="button" id="tab-${m.key}" aria-selected="${i === 0}">${m.label}</button>`).join('');
  tabs.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    metric = METRICS.find(m => 'tab-' + m.key === b.id);
    window.track && window.track('select_metric', { metric: metric.key });
    tabs.querySelectorAll('button').forEach(x => x.setAttribute('aria-selected', x === b));
    paint();
    if (selected) renderPanel(selected);
  });

  // tooltip
  const tip = document.getElementById('tip');
  const fig = document.getElementById('mapfig');
  svg.addEventListener('mousemove', e => {
    const bc = e.target.closest('circle.b');
    let html;
    if (bc) {
      const bu = U.find(x => x.name === bc.dataset.j);
      html = `<b>${esc(bc.dataset.n)}</b>Kakvoća vode 2026.: ${QLBL[bc.dataset.q]}${bu ? `<br><span style="opacity:.75">${esc(nm(bu))}</span>` : ''}`;
    } else {
    const p = e.target.closest('path.u'); if (!p) { tip.hidden = true; return; }
    const u = byId.get(p.dataset.id);
    const v = u[metric.key];
    html = `<b>${esc(nm(u))}</b>${metric.label}: ${v == null ? (metric.key === 'n2025' && u.n2025 == null ? 'tajno (z)' : 'nema podatka') : metric.fmt(v)}`;
    }
    tip.innerHTML = html;
    const r = fig.getBoundingClientRect();
    let x = e.clientX - r.left + 12, y = e.clientY - r.top + 12;
    if (x > r.width - 200) x -= 220;
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.hidden = false;
  });
  svg.addEventListener('mouseleave', () => { tip.hidden = true; });
  svg.addEventListener('click', e => {
    if (dragged) return;
    const bc = e.target.closest('circle.b');
    if (bc) { const bu = U.find(x => x.name === bc.dataset.j); if (bu) select(bu); return; }
    const p = e.target.closest('path.u'); if (!p) return;
    select(byId.get(p.dataset.id));
  });

  let firstSelect = true;
  function select(u, scroll, zoom) {
    if (!firstSelect && window.track) window.track('select_place', { place: nm(u), county: u.county });
    firstSelect = false;
    if (zoom || scroll) zoomToUnit(u);
    if (selected) pathEls.get(selected.id).classList.remove('sel');
    selected = u;
    const p = pathEls.get(u.id);
    p.classList.add('sel');
    p.parentNode.appendChild(p); // bring to front
    renderPanel(u);
    if (scroll) document.querySelector('.mapblock').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  // ---------- detail panel ----------
  function monthChart(u) {
    const W = 320, H = 120, L = 34, B = 16, T = 6;
    const a = u.m2025, b = u.m2026;
    if (a.every(v => v == null)) return '<p class="empty">Mjesečni podaci su tajni ili ih nema.</p>';
    const mx = Math.max(1, ...a.filter(v => v != null), ...b.filter(v => v != null));
    const nice = (() => { const p = Math.pow(10, Math.floor(Math.log10(mx))); const m = mx / p; return (m <= 2 ? 2 : m <= 5 ? 5 : 10) * p; })();
    const bw = (W - L) / 12;
    const y = v => T + (H - B - T) * (1 - v / nice);
    let s = `<svg class="mchart" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Noćenja po mjesecima">`;
    [0, 0.5, 1].forEach(f => { const yy = y(nice * f); s += `<line class="grid" x1="${L}" x2="${W}" y1="${yy}" y2="${yy}"/><text x="${L - 4}" y="${yy + 3}" text-anchor="end">${nice * f >= 1e6 ? (nice * f / 1e6).toLocaleString('hr-HR') + ' mil.' : nice * f >= 1000 ? fmt(nice * f / 1000) + ' tis.' : fmt(nice * f)}</text>`; });
    a.forEach((v, i) => { if (v != null) s += `<rect class="bar" x="${L + i * bw + 2}" y="${y(v)}" width="${bw - 4}" height="${H - B - y(v)}" rx="1.5"><title>${MON[i]} 2025.: ${fmt(v)}</title></rect>`; s += `<text x="${L + i * bw + bw / 2}" y="${H - 4}" text-anchor="middle">${MON[i]}</text>`; });
    const pts = b.map((v, i) => v == null ? null : [L + i * bw + bw / 2, y(v)]).filter(Boolean);
    if (pts.length > 1) s += `<polyline class="ln" points="${pts.map(p => p.join(',')).join(' ')}"/>`;
    pts.forEach(p => { s += `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="2.2"/>`; });
    return s + '</svg><div class="leg2"><span><i style="background:var(--sea-3)"></i>2025.</span><span><i style="background:var(--accent)"></i>2026.</span></div>';
  }

  function typeBlock(u) {
    if (!u.coastal) return '<h4>Vrsta smještaja</h4><p class="empty">Podjelu noćenja po vrsti smještaja DZS objavljuje samo za primorske gradove i općine.</p>';
    const n = u.tn[2025], b = u.tb[2025] || [];
    const parts = [['Hoteli i sl.', n[0], '--sea-5'], ['Privatni smještaj', n[1], '--sea-3'], ['Kampovi', n[2], '--accent'], ['Ostalo', n[3], '--line']];
    const tot = n[4] || 0;
    if (!tot) return '';
    const bar = parts.filter(p => p[1]).map(p => `<span title="${p[0]}: ${pct(p[1] / tot, 0)}" style="width:${(p[1] / tot * 100).toFixed(1)}%;background:var(${p[2]})"></span>`).join('');
    const leg = parts.filter(p => p[1]).map(p => `<span><i style="background:var(${p[2]})"></i>${p[0]} ${pct(p[1] / tot, 0)}</span>`).join('');
    const hidden = n.slice(0, 4).some(v => v == null) ? '<p class="note" style="padding:4px 0 0">Dio podataka je tajan (z) zbog malog broja objekata.</p>' : '';
    return `<h4>Vrsta smještaja (2025.)</h4>
      <div class="stats" style="margin:6px 0 12px">
        <div><b>${u.ps == null ? '–' : pct(u.ps, 0)}</b>noćenja kod malih iznajmljivača ${lvl('ps', u.ps, null)}</div>
        <div><b>${b[1] ? fmt(b[1]) : '–'}</b>kreveta u privatnom smještaju</div>
        <div><b>${u.pocc == null ? '–' : fmt(u.pocc)}</b>noćenja po privatnom krevetu (HR: ${fmt(HR_OCC52)}) ${lvl('pocc', u.pocc, true)}</div>
        <div><b>${u.hocc == null ? '–' : fmt(u.hocc)}</b>noćenja po hotelskom krevetu (HR: ${fmt(HR_OCC51)}) ${lvl('hocc', u.hocc, true)}</div>
      </div>
      <div class="tbar">${bar}</div><div class="leg2 wrap">${leg}</div>${hidden}`;
  }

  const QLBL = { 1: 'izvrsna', 2: 'dobra', 3: 'zadovoljavajuća', 4: 'nezadovoljavajuća' };
  const beachesBy = new Map();
  D.beaches.forEach(b => { if (!beachesBy.has(b[4])) beachesBy.set(b[4], []); beachesBy.get(b[4]).push(b); });
  function beachList(u) {
    const bs = (beachesBy.get(u.name) || []).slice().sort((a, b) => b[2] - a[2] || a[3].localeCompare(b[3], 'hr'));
    if (!bs.length) return '<h4>Mjesta za kupanje</h4><p class="empty">Nema službenih mjernih mjesta kakvoće vode za kupanje.</p>';
    return `<h4>Mjesta za kupanje (${bs.length})</h4><ul class="beachlist">${bs.map(b => `<li><span class="qd" style="background:${css(QCOL[b[2]])}"></span><span>${esc(b[3])}</span><span class="ql q${b[2]}">${QLBL[b[2]]}</span></li>`).join('')}</ul><p class="note" style="padding:4px 0 0">Konačna ocjena kakvoće vode 2026. (IZOR). Mjesta su označena i na karti.</p>`;
  }
  const gSel = document.createElementNS(NS, 'g'); svg.appendChild(gSel);
  function markBeaches(u) {
    gSel.innerHTML = '';
    (beachesBy.get(u.name) || []).forEach(b => {
      const c = document.createElementNS(NS, 'circle');
      const [x, y] = proj([b[1], b[0]]);
      c.setAttribute('cx', x.toFixed(2)); c.setAttribute('cy', y.toFixed(2));
      c.dataset.r = 1.4; c.setAttribute('r', (1.4 / Math.pow(VB0.w / vb.w, 0.6)).toFixed(3));
      c.setAttribute('class', 'b bs');
      c.dataset.n = b[3]; c.dataset.q = b[2]; c.dataset.j = b[4];
      c.style.fill = css(QCOL[b[2]]);
      gSel.appendChild(c);
    });
  }

  function renderPanel(u) {
    markBeaches(u);
    const el = document.getElementById('panel');
    const nights = u.n2025 == null ? 'tajno (z)' : fmt(u.n2025);
    const chips = [];
    if (u.prem != null && u.prem < natPrem / 2 && u.n2025 >= 300000) chips.push('<span class="chip warn">malo premium hotela za ovu potražnju</span>');
    if (u.season != null && u.season > 0.55) chips.push('<span class="chip">izrazito sezonsko</span>');
    if (u.growth != null && u.growth > 0.08) chips.push('<span class="chip">brz rast</span>');
    if (u.objs.some(o => /MAISTRA|HUP-ZAGREB/i.test(o[3]))) chips.push('<span class="chip">Maistra u mjestu</span>');
    const types = TYPES.map((t, i) => {
      const os = u.objs.filter(o => o[0] === i).sort((a, b) => b[1] - a[1] || b[4] - a[4]);
      if (!os.length) return '';
      return os.map(o => `<li><span>${esc(o[2])}<br><span class="on">${t} · ${esc(o[3])}</span></span><span><span class="stars">${o[0] === 5 ? 'kat. ' + o[1] : '★'.repeat(o[1])}</span><br><span class="on" style="text-align:right">${o[0] === 5 ? fmt(o[5]) + ' vezova' : fmt(o[4]) + ' kr.'}</span></span></li>`).join('');
    }).join('');
    el.innerHTML = `
      <h3>${esc(nm(u))}</h3>
      <div class="cty">${esc(u.county)}${u.label !== nm(u) ? ' · ' + esc(u.label) : ''}</div>
      <div class="chips">${chips.join('')}</div>
      <h4 class="sh">Pokazatelji <span class="info" tabindex="0" role="button" aria-label="Objašnjenje oznaka visoko i nisko">i<span class="pop" role="tooltip">▲ visoko, ● prosječno, ▼ nisko: gornja četvrtina, sredina ili donja četvrtina među ${PEERS.length} mjesta s barem 50.000 noćenja. Zeleno je povoljno, crveno nepovoljno, sivo neutralno.</span></span></h4>
      <div class="stats">
        <div><b>${nights}</b>noćenja 2025. ${lvl('n2025', u.n2025, null)}</div>
        <div><b>${u.ytd == null ? '–' : spct(u.ytd)}</b>2026. sij–${MON[PUB - 1]} ${lvl('ytd', u.ytd, true)}</div>
        <div><b>${u.growth == null ? '–' : spct(u.growth)}</b>rast od 2023. ${lvl('growth', u.growth, true)}</div>
        <div><b>${u.season == null ? '–' : pct(u.season, 0)}</b>u srpnju i kolovozu ${lvl('season', u.season, false)}</div>
        <div><b>${u.foreign == null ? '–' : pct(u.foreign, 0)}</b>stranih noćenja ${lvl('foreign', u.foreign, null)}</div>
        <div><b>${u.intens == null ? '–' : fmt(u.intens)}</b>noćenja po stanovniku ${lvl('intens', u.intens, null)}</div>
        <div><b>${u.beds2025 ? fmt(u.beds2025) : '–'}</b>stalnih kreveta (svi smještaj) ${lvl('beds2025', u.beds2025, null)}</div>
        <div><b>${u.npb == null ? '–' : fmt(u.npb)}</b>noćenja po krevetu godišnje (HR: ${fmt(NAT.n2025 / NAT.beds2025)}) ${lvl('npb', u.npb, true)}</div>
        <div><b>${fmt(u.c_prem_beds)}</b>kreveta u hotelima i naseljima s 4–5★</div>
        <div><b>${u.b_n ? u.b_exc + ' / ' + u.b_n : '–'}</b>plaža izvrsne kakvoće</div>
      </div>
      <h4>Noćenja po mjesecima</h4>
      ${monthChart(u)}
      ${typeBlock(u)}
      ${beachList(u)}
      <h4>Kategorizirani objekti (${u.objs.length})</h4>
      ${u.objs.length ? `<ul class="objlist">${types}</ul>` : '<p class="empty">Nema hotela, kampova ni marina u popisu Ministarstva.</p>'}`;
  }

  function renderEmptyPanel() {
    document.getElementById('panel').innerHTML = `<h3>Odaberi mjesto</h3><p class="empty">Klikni na grad ili općinu na karti, potraži je po imenu ili odaberi iz ljestvice. Prikazat će se noćenja po mjesecima, rast, sezonalnost, kakvoća mora i popis hotela, kampova i marina.</p>`;
  }

  // ---------- search ----------
  const q = document.getElementById('q'), qres = document.getElementById('qres');
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd');
  let hits = [], hi = 0;
  function showHits() {
    qres.innerHTML = hits.map((u, i) => `<li role="option" aria-selected="${i === hi}" data-id="${u.id}">${esc(nm(u))} <small>${esc(u.county.replace(' županija', ''))}</small></li>`).join('');
    qres.hidden = !hits.length;
  }
  q.addEventListener('input', () => {
    const t = norm(q.value.trim());
    hits = t ? U.filter(u => norm(u.label).includes(t)).sort((a, b) => (norm(a.label).startsWith(t) ? 0 : 1) - (norm(b.label).startsWith(t) ? 0 : 1) || (b.n2025 || 0) - (a.n2025 || 0)).slice(0, 8) : [];
    hi = 0; showHits();
  });
  q.addEventListener('keydown', e => {
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { hi = Math.min(hits.length - 1, hi + 1); showHits(); e.preventDefault(); }
    if (e.key === 'ArrowUp') { hi = Math.max(0, hi - 1); showHits(); e.preventDefault(); }
    if (e.key === 'Enter') { select(hits[hi], false, true); qres.hidden = true; }
    if (e.key === 'Escape') { qres.hidden = true; }
  });
  qres.addEventListener('click', e => { const li = e.target.closest('li'); if (!li) return; select(byId.get(li.dataset.id), false, true); qres.hidden = true; q.value = ''; });
  document.addEventListener('click', e => { if (!e.target.closest('.search')) qres.hidden = true; });

  // ---------- insights ----------
  (function insights() {
    const big = U.filter(u => u.n2025 >= 500000);
    const sorted = U.filter(u => u.n2025).sort((a, b) => b.n2025 - a.n2025);
    const top10 = sorted.slice(0, 10), top20 = sum(sorted.slice(0, 20).map(u => u.n2025)) / NAT.n2025;
    big.forEach(u => { u.gapBeds = natPrem * u.n2025 / 1e4 - u.c_prem_beds; });
    const gap = big.filter(u => u.prem != null && u.prem < natPrem).sort((a, b) => b.gapBeds - a.gapBeds).slice(0, 6);
    const grow = U.filter(u => u.n2023 >= 300000 && u.growth != null).sort((a, b) => b.growth - a.growth).slice(0, 5);
    const fall = U.filter(u => u.n2023 >= 300000 && u.growth != null).sort((a, b) => a.growth - b.growth).slice(0, 3);
    const seas = U.filter(u => u.n2025 >= 500000 && u.season != null).sort((a, b) => b.season - a.season);
    const ytdUp = U.filter(u => u.ytd25 >= 300000 && u.ytd != null).sort((a, b) => b.ytd - a.ytd).slice(0, 5);
    const badSea = U.filter(u => u.b_bad > 0).sort((a, b) => b.b_bad - a.b_bad);
    const c200 = U.filter(u => u.n2025 >= 200000);
    const privHi = c200.filter(u => u.ps != null).sort((a, b) => b.ps - a.ps).slice(0, 6);
    const privLo = c200.filter(u => u.ps != null).sort((a, b) => a.ps - b.ps).slice(0, 6);
    const occLo = c200.filter(u => u.npb != null).sort((a, b) => a.npb - b.npb).slice(0, 6);
    const occHi = c200.filter(u => u.npb != null).sort((a, b) => b.npb - a.npb).slice(0, 3);
    const btn = u => `<button class="lnk" type="button" data-id="${u.id}">${esc(nm(u))}</button>`;
    const cards = [
      { n: 'Koncentracija', h: `Deset mjesta ostvaruje ${pct(sum(top10.map(u => u.n2025)) / NAT.n2025, 0)} svih noćenja`,
        p: `Dvadeset najvećih destinacija donosi ${pct(top20, 0)} noćenja. Od deset najvećih, ${top10.filter(u => /Istarska/.test(u.county)).length} je u Istri.`,
        l: top10.map(u => `${btn(u)} ${mil(u.n2025)}`) },
      { n: 'Prilika', h: 'Velika potražnja, malo hotela s 4 i 5 zvjezdica',
        p: `Hrvatska ima ${natPrem.toLocaleString('hr-HR', { maximumFractionDigits: 1 })} kreveta u hotelima, aparthotelima i turističkim naseljima s 4 i 5 zvjezdica na 10.000 noćenja. Da imaju isti omjer, ovim bi destinacijama trebalo otprilike ovoliko dodatnih premium kreveta. Danas njihovu potražnju uglavnom pokrivaju privatni smještaj i kampovi.`,
        l: gap.map(u => `${btn(u)} ≈ ${fmt(Math.round(u.gapBeds / 10) * 10)} kreveta (sada ${fmt(u.c_prem_beds)})`) },
      { n: 'Rast', h: 'Gdje noćenja rastu najbrže',
        p: `Promjena od 2023. do 2025. među mjestima s više od 300.000 noćenja. Hrvatska ukupno: ${spct(NAT.n2025 / NAT.n2023 - 1)}. Najveći pad: ${fall.map(u => `${esc(nm(u))} ${spct(u.growth, 0)}`).join(', ')}.`,
        l: grow.map(u => `${btn(u)} ${spct(u.growth)}`) },
      { n: '2026.', h: `2026. do ${GEN[PUB - 1]}: gdje raste najviše`,
        p: `Hrvatska je ${spct(sum(NAT.m2026) / sum(NAT.m2025.slice(0, PUB)) - 1)} u odnosu na isto razdoblje 2025. Ovo su mjesta s više od 300.000 noćenja i najvećim porastom.`,
        l: ytdUp.map(u => `${btn(u)} ${spct(u.ytd)}`) },
      { n: 'Najkraća sezona', h: `${esc(nm(seas[0]))}: ${pct(seas[0].season, 0)} noćenja u samo dva mjeseca`,
        p: `Velike destinacije (više od 500.000 noćenja) kojima su srpanj i kolovoz najvažniji. Brojka je udio ta dva mjeseca u godišnjim noćenjima; hrvatski prosjek je ${pct((NAT.m2025[6] + NAT.m2025[7]) / NAT.n2025, 0)}.`,
        l: seas.slice(0, 6).map(u => `${btn(u)} ${pct(u.season, 0)}`) },
      { n: 'Najduža sezona', h: 'Gdje se noćenja događaju kroz cijelu godinu',
        p: `Velike destinacije (više od 500.000 noćenja) s najmanjim udjelom srpnja i kolovoza u godišnjim noćenjima. Ovdje su noćenja najravnomjernije raspoređena kroz godinu.`,
        l: seas.slice(-6).reverse().map(u => `${btn(u)} ${pct(u.season, 0)}`) },
      { n: 'Mali iznajmljivači', h: 'Gdje gotovo sva noćenja idu privatnom smještaju',
        p: `Udio soba, apartmana i kuća za odmor u noćenjima 2025., primorska mjesta s više od 200.000 noćenja. Hrvatski prosjek je ${pct(HR_PS, 0)}.`,
        l: privHi.map(u => `${btn(u)} ${pct(u.ps, 0)}`) },
      { n: 'Hoteli i kampovi', h: 'Gdje privatni smještaj gotovo ne postoji',
        p: 'Najmanji udio malih iznajmljivača među istim mjestima. Ovdje noćenja nose hoteli, turistička naselja i kampovi velikih tvrtki.',
        l: privLo.map(u => `${btn(u)} ${pct(u.ps, 0)} privatno`) },
      { n: 'Iskorištenost', h: 'Gdje kreveti najviše stoje prazni',
        p: `Noćenja po stalnom krevetu godišnje, mjesta s više od 200.000 noćenja. Hrvatski prosjek je ${fmt(NAT.n2025 / NAT.beds2025)}, a najbolje stoje ${occHi.map(u => `${esc(nm(u))} (${fmt(u.npb)})`).join(', ')}.`,
        l: occLo.map(u => `${btn(u)} ${fmt(u.npb)}`) },
      { n: 'Vrste smještaja', h: `Hotelski krevet radi ${(HR_HOCC / HR_POCC).toLocaleString('hr-HR', { maximumFractionDigits: 1 })} puta više od privatnog`,
        p: `U 2025. krevet u hotelu ostvario je ${fmt(HR_HOCC)} noćenja, a krevet u privatnom smještaju ${fmt(HR_POCC)}. Privatni smještaj ima ${pct(T25('Privatni smještaj (sobe, apartmani, kuće)').beds / T25('Ukupno').beds, 0)} svih kreveta, ali ${pct(HR_PS, 0)} noćenja.`,
        l: [], a: `<a href="#vrste-h">Sve vrste smještaja i trendovi →</a>` },
      { n: 'More', h: `${pct(D.beaches.filter(b => b[2] === 1).length / D.beaches.length, 0)} mjesta za kupanje ima izvrsnu kakvoću vode`,
        p: `Od ${fmt(D.beaches.length)} mjesta na moru, rijekama i jezerima samo ${D.beaches.filter(b => b[2] >= 3).length} ima ocjenu zadovoljavajuće ili loše. Čisto more zajednička je prednost cijele obale, pa destinacije po tome teško mogu biti različite.`,
        l: badSea.slice(0, 4).map(u => `${btn(u)} ${u.b_bad} od ${u.b_n} mjesta ispod „dobro”`) },
    ];
    const el = document.getElementById('insights');
    el.innerHTML = cards.map(c => `<article class="card"><div class="n">${c.n}</div><h3>${c.h}</h3><p>${c.p}</p>${c.l.length ? `<ol>${c.l.map(x => `<li>${x}</li>`).join('')}</ol>` : ''}${c.a ? `<p style="margin-top:auto">${c.a}</p>` : ''}</article>`).join('');
    el.addEventListener('click', e => { const b = e.target.closest('button.lnk'); if (b) select(byId.get(b.dataset.id), true); });
  })();

  // ---------- accommodation types section ----------
  (function typesSection() {
    const P = 'Privatni smještaj (sobe, apartmani, kuće)';
    const MAIN = [[P, 'Privatni smještaj', 'sobe, apartmani i kuće za odmor malih iznajmljivača', '--sea-3'],
      ['Kampovi', 'Kampovi', '', '--accent'], ['Hoteli', 'Hoteli', '', '--sea-5'], ['Turistička naselja', 'Turistička naselja', '', '--sea-2']];
    const years = Object.keys(TT['Ukupno'].years).map(Number).filter(y => y <= 2025).sort();
    const tot = y => TT['Ukupno'].years[y];
    const row = (key, y) => TT[key].years[y];
    // "other" = total minus the four main types (company apartments, guest houses, hostels…)
    const other = y => {
      const t = tot(y), o = { n: t.n, beds: t.beds, nf: t.nf };
      MAIN.forEach(([k]) => { const r = row(k, y); o.n -= r.n || 0; o.beds -= r.beds || 0; o.nf -= r.nf || 0; });
      return o;
    };
    const otherM = () => TT['Ukupno'].m2025.map((v, i) => v - MAIN.reduce((s, [k]) => s + (TT[k].m2025[i] || 0), 0));
    const rows = MAIN.map(([k, label, sub, col]) => ({ label, sub, col, r: row(k, 2025), m: TT[k].m2025 }))
      .concat([{ label: 'Ostalo', sub: 'apartmani tvrtki, pansioni, hosteli, lječilišta…', col: '--line', r: other(2025), m: otherM() }]);
    const T = tot(2025);
    const maxN = Math.max(...rows.map(x => x.r.n)), maxO = Math.max(...rows.map(x => x.r.n / x.r.beds));
    document.getElementById('typeTable').innerHTML = `<thead><tr><th scope="col">Vrsta smještaja</th><th scope="col">Noćenja 2025.</th><th scope="col">Udio noćenja</th><th scope="col">Stalni kreveti</th><th scope="col">Udio kreveta</th><th scope="col">Iskorištenost</th><th scope="col">Strani gosti</th><th scope="col">Srpanj + kolovoz</th></tr></thead><tbody>` +
      rows.map(x => {
        const occ = x.r.n / x.r.beds, ja = (x.m[6] + x.m[7]) / x.r.n;
        return `<tr class="nohover"><td><span class="sw2" style="background:var(${x.col})"></span>${x.label}${x.sub ? `<div class="tsub">${x.sub}</div>` : ''}</td>
          <td><span class="cbar"><i style="width:${(x.r.n / maxN * 100).toFixed(0)}%"></i></span>${(x.r.n / 1e6).toLocaleString('hr-HR', { maximumFractionDigits: 1 })} mil.</td>
          <td>${pct(x.r.n / T.n, 0)}</td><td>${fmt(x.r.beds)}</td><td>${pct(x.r.beds / T.beds, 0)}</td>
          <td><span class="cbar o"><i style="width:${(occ / maxO * 100).toFixed(0)}%"></i></span>${fmt(occ)}</td>
          <td>${pct(x.r.nf / x.r.n, 0)}</td><td>${pct(ja, 0)}</td></tr>`;
      }).join('') +
      `<tr class="nohover tot"><td>Ukupno</td><td>${(T.n / 1e6).toLocaleString('hr-HR', { maximumFractionDigits: 1 })} mil.</td><td>100 %</td><td>${fmt(T.beds)}</td><td>100 %</td><td>${fmt(T.n / T.beds)}</td><td>${pct(T.nf / T.n, 0)}</td><td>${pct((NAT.m2025[6] + NAT.m2025[7]) / T.n, 0)}</td></tr></tbody>`;
    const pr = row(P, 2025);
    document.getElementById('typeKpis').innerHTML = [
      [pct(pr.n / T.n, 0), 'noćenja kod malih iznajmljivača', `uz ${pct(pr.beds / T.beds, 0)} svih kreveta`],
      [fmt(HR_HOCC), 'noćenja po hotelskom krevetu', `privatni smještaj: ${fmt(HR_POCC)}`],
      [fmt(row('Kampovi', 2025).n / row('Kampovi', 2025).beds), 'noćenja po krevetu u kampovima', `2019.: ${fmt(row('Kampovi', 2019).n / row('Kampovi', 2019).beds)}`],
    ].map(k => `<div class="kpi"><div class="v">${k[0]}</div><div class="l">${k[1]}</div><div class="d">${k[2]}</div></div>`).join('');

    // line charts
    function lines(el, get, fmtY) {
      const W = 520, H = 230, L = 46, R = 26, Tp = 12, B = 26;
      const series = MAIN.map(([k, label, , col]) => ({ label, col, v: years.map(y => get(row(k, y))) }));
      const all = series.flatMap(s => s.v).filter(v => v != null);
      const mx = Math.max(...all) * 1.08, mn = 0;
      const x = i => L + i * (W - L - R) / (years.length - 1), y = v => Tp + (H - Tp - B) * (1 - (v - mn) / (mx - mn));
      let g = '';
      const step = mx > 30 ? (mx > 100 ? 50 : 10) : 10;
      for (let t = 0; t <= mx; t += step) g += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 6}" y="${y(t) + 3}" text-anchor="end">${fmtY(t)}</text>`;
      years.forEach((yy, i) => { g += `<text x="${x(i)}" y="${H - 8}" text-anchor="middle">${yy}</text>`; });
      series.forEach(s => {
        const pts = s.v.map((v, i) => v == null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`).filter(Boolean).join(' ');
        g += `<polyline points="${pts}" fill="none" style="stroke:var(${s.col})" stroke-width="2.4"/>`;
        const li = s.v.length - 1;
        g += `<circle cx="${x(li)}" cy="${y(s.v[li])}" r="3.5" style="fill:var(${s.col})"/>`;
      });
      document.getElementById(el).innerHTML = `<svg class="mchart lc" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Linijski graf po vrsti smještaja">${g}</svg>` +
        `<div class="leg2 wrap">${series.map(s => `<span><i style="background:var(${s.col})"></i>${s.label}</span>`).join('')}</div>`;
    }
    lines('trendN', r => r && r.n ? r.n / 1e6 : null, t => t.toLocaleString('hr-HR'));
    lines('trendO', r => r && r.n && r.beds ? r.n / r.beds : null, t => fmt(t));

    const ch = (k, a, b) => row(k, b).n / row(k, a).n - 1;
    const bch = (k, a, b) => row(k, b).beds / row(k, a).beds - 1;
    const ytd = k => sum(TT[k].m2026) / sum(TT[k].m2025.slice(0, PUB)) - 1;
    document.getElementById('typeNotes').innerHTML = [
      `<b>Kampovi rastu najbrže:</b> ${spct(ch('Kampovi', 2019, 2025))} noćenja od 2019., uz ${spct(bch('Kampovi', 2019, 2025))} kreveta. Iskorištenost im je porasla s ${fmt(row('Kampovi', 2019).n / row('Kampovi', 2019).beds)} na ${fmt(row('Kampovi', 2025).n / row('Kampovi', 2025).beds)} noćenja po krevetu.`,
      `<b>Privatni smještaj stoji:</b> noćenja ${spct(ch(P, 2019, 2025))} od 2019., kreveta ${spct(bch(P, 2019, 2025))}. Osim u pandemijskim 2020. i 2021., iskorištenost je stalno oko ${fmt(HR_POCC)} noćenja po krevetu, što odgovara otprilike dva mjeseca pune popunjenosti godišnje.`,
      `<b>Hoteli</b> imaju najveću iskorištenost (${fmt(HR_HOCC)}) i ${spct(ch('Hoteli', 2019, 2025))} noćenja od 2019.; <b>turistička naselja</b> ${spct(ch('Turistička naselja', 2019, 2025))}.`,
      `<b>2026. (sij–${MON[PUB - 1]}) prema istom razdoblju 2025.:</b> hoteli ${spct(ytd('Hoteli'))}, turistička naselja ${spct(ytd('Turistička naselja'))}, privatni smještaj ${spct(ytd(P))}, kampovi ${spct(ytd('Kampovi'))}.`,
    ].map(t => `<li>${t}</li>`).join('');
  })();

  // ---------- operators ----------
  (function operators() {
    const agg = new Map();
    // brand groups that operate through several legal entities
    const GROUPS = [[/^HUP-ZAGREB/, 'MAISTRA']];
    const clean = s => {
      const k = s.replace(/,.*$/, '').replace(/\s+(d\.d\.|d\.o\.o\.?|j\.d\.o\.o\.?)\s*$/i, '').trim().toUpperCase();
      const g = GROUPS.find(([re]) => re.test(k));
      return g ? g[1] : k;
    };
    const unitByName = new Map(U.map(u => [u.name, u]));
    D.objs.forEach(o => {
      if (o[0] === 5) return; // marinas have berths, not beds
      const k = clean(o[3]);
      if (!agg.has(k)) agg.set(k, { beds: 0, objs: [], places: new Map() });
      const a = agg.get(k); a.beds += o[4]; a.objs.push(o);
      const pl = short(unitByName.get(o[6])?.label || o[6]);
      a.places.set(pl, (a.places.get(pl) || 0) + o[4]);
    });
    const top = [...agg.entries()].sort((a, b) => b[1].beds - a[1].beds).slice(0, 20);
    const mx = top[0][1].beds;
    const allBeds = sum([...agg.values()].map(a => a.beds));
    document.getElementById('opsCount').innerHTML = `Prikazano je <b>${top.length} najvećih od ukupno ${fmt(agg.size)} operatera</b>. Zajedno imaju ${fmt(sum(top.map(t => t[1].beds)))} od ${fmt(allBeds)} kategoriziranih kreveta (${pct(sum(top.map(t => t[1].beds)) / allBeds, 0)}).`;
    const title = s => s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase());
    const chart = document.getElementById('opsChart');
    chart.innerHTML = `<div class="ophead" aria-hidden="true"><span>Operater<span class="where">broj objekata · mjesta s najviše kreveta</span></span><span></span><span class="val">Stalni kreveti</span></div>` + top.map(([k, a], i) => {
      const pl = [...a.places.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => x[0]).join(', ');
      return `<button type="button" class="oprow" data-i="${i}" aria-pressed="false"><span class="nm" title="${esc(k)}">${esc(title(k))}<span class="where">${a.objs.length} objekata · ${esc(pl)}</span></span><span class="barw"><span class="bar" style="width:${(a.beds / mx * 100).toFixed(1)}%"></span></span><span class="val">${fmt(a.beds)}</span></button>`;
    }).join('');
    const panel = document.getElementById('opsPanel');
    function show(i) {
      const [k, a] = top[i];
      chart.querySelectorAll('.oprow').forEach(r => r.setAttribute('aria-pressed', r.dataset.i == i));
      const byType = TYPES.slice(0, 5).map((t, ti) => {
        const os = a.objs.filter(o => o[0] === ti);
        const b = sum(os.map(o => o[4]));
        return os.length ? `<div><b>${fmt(b)} <span class="pc">${pct(b / a.beds, 0)}</span></b>${t.toLowerCase()} (${os.length})</div>` : '';
      }).join('');
      const prem = sum(a.objs.filter(o => HOTELISH.has(o[0]) && o[1] >= 4).map(o => o[4]));
      const places = [...a.places.entries()].sort((x, y) => y[1] - x[1]);
      const list = a.objs.slice().sort((x, y) => y[4] - x[4]).map(o => {
        const u = unitByName.get(o[6]);
        return `<li><span>${esc(o[2])}<br><span class="on">${TYPES[o[0]]} · ${u ? `<button type="button" class="lnk" data-id="${u.id}">${esc(nm(u))}</button>` : esc(o[6])}</span></span><span><span class="stars">${'★'.repeat(o[1])}</span><br><span class="on" style="text-align:right">${fmt(o[4])} kr.</span></span></li>`;
      }).join('');
      panel.innerHTML = `<h3>${esc(title(k))}</h3>
        <div class="cty">${a.objs.length} objekata u ${places.length} ${places.length === 1 ? 'mjestu' : 'mjesta'}</div>
        <div class="stats"><div><b>${fmt(a.beds)} <span class="pc">100 %</span></b>stalnih kreveta ukupno</div><div><b>${fmt(prem)} <span class="pc">${pct(prem / a.beds, 0)}</span></b>u hotelima i naseljima s 4–5★</div>${byType}</div>
        <h4>Gdje posluje</h4>
        <div class="chips">${places.map(([p, b]) => `<span class="chip">${esc(p)} · ${fmt(b)}</span>`).join('')}</div>
        <h4>Objekti</h4><ul class="objlist">${list}</ul>`;
    }
    chart.addEventListener('click', e => { const r = e.target.closest('.oprow'); if (r) { show(+r.dataset.i); window.track && window.track('select_operator', { operator: top[+r.dataset.i][0] }); } });
    panel.addEventListener('click', e => { const b = e.target.closest('button.lnk'); if (b) select(byId.get(b.dataset.id), true); });
    show(0);
  })();

  // ---------- ranking table ----------
  (function table() {
    const rows = U.filter(u => u.n2025 >= 100000);
    const cols = [
      { k: 'label', t: 'Mjesto', f: u => esc(nm(u)), s: u => nm(u) },
      { k: 'county', t: 'Županija', f: u => `<span class="muted">${esc(u.county.replace(' županija', ''))}</span>`, s: u => u.county },
      { k: 'n2025', t: 'Noćenja 2025.', f: u => fmt(u.n2025) },
      { k: 'growth', t: 'Rast od 2023.', f: u => spct(u.growth) },
      { k: 'ytd', t: `2026. (sij–${MON[PUB - 1]})`, f: u => spct(u.ytd) },
      { k: 'season', t: 'Srpanj + kolovoz', f: u => pct(u.season, 0) },
      { k: 'c_prem_beds', t: 'Kreveti 4–5★ (hoteli i naselja)', f: u => fmt(u.c_prem_beds) },
      { k: 'prem', t: 'na 10 tis. noćenja', f: u => u.prem == null ? '–' : u.prem.toLocaleString('hr-HR', { maximumFractionDigits: 1 }) },
      { k: 'intens', t: 'Noćenja po stan.', f: u => fmt(u.intens) },
    ];
    let sk = 'n2025', dir = -1;
    const t = document.getElementById('rankTable');
    function draw() {
      const col = cols.find(c => c.k === sk);
      const val = col.s || (u => u[sk]);
      rows.sort((a, b) => {
        const x = val(a), y = val(b);
        if (x == null) return 1; if (y == null) return -1;
        return (typeof x === 'string' ? x.localeCompare(y, 'hr') : x - y) * dir;
      });
      t.innerHTML = `<thead><tr>${cols.map(c => `<th scope="col" data-k="${c.k}" ${c.k === sk ? `aria-sort="${dir > 0 ? 'ascending' : 'descending'}"` : ''} tabindex="0">${c.t}${c.k === sk ? (dir > 0 ? ' ↑' : ' ↓') : ''}</th>`).join('')}</tr></thead>` +
        `<tbody>${rows.map(u => `<tr data-id="${u.id}">${cols.map(c => `<td>${c.f(u)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    }
    const sortBy = k => { if (sk === k) dir = -dir; else { sk = k; dir = (k === 'label' || k === 'county') ? 1 : -1; } draw(); };
    t.addEventListener('click', e => {
      const th = e.target.closest('th'); if (th) return sortBy(th.dataset.k);
      const tr = e.target.closest('tr[data-id]'); if (tr) select(byId.get(tr.dataset.id), true);
    });
    t.addEventListener('keydown', e => { const th = e.target.closest('th'); if (th && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sortBy(th.dataset.k); } });
    draw();
  })();

  // ---------- sources ----------
  document.getElementById('sources').innerHTML = Object.values(D.meta.sources).map(s => `<li>${esc(s)}</li>`).join('');

  // ---------- zoom & pan ----------
  const VB0 = { x: minX - pad, y: minY - pad, w: maxX - minX + 2 * pad, h: maxY - minY + 2 * pad };
  let vb = { ...VB0 };
  let dragged = false;
  const MAXK = 25;
  const beachEls = [...gB.children];
  function setVB(n) {
    const w = Math.min(VB0.w, Math.max(VB0.w / MAXK, n.w));
    const h = w * VB0.h / VB0.w;
    const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
    let x = cx - w / 2, y = cy - h / 2;
    x = Math.min(Math.max(x, VB0.x - w * 0.25), VB0.x + VB0.w - w * 0.75);
    y = Math.min(Math.max(y, VB0.y - h * 0.25), VB0.y + VB0.h - h * 0.75);
    if (w >= VB0.w) { x = VB0.x; y = VB0.y; }
    vb = { x, y, w, h };
    svg.setAttribute('viewBox', `${x.toFixed(2)} ${y.toFixed(2)} ${w.toFixed(2)} ${h.toFixed(2)}`);
    const k = VB0.w / w;
    beachEls.concat([...gSel.children]).forEach(c => c.setAttribute('r', (c.dataset.r / Math.pow(k, 0.6)).toFixed(3)));
    svg.style.touchAction = k > 1.01 ? 'none' : 'pan-y';
    zoomReset.disabled = k <= 1.01;
  }
  function svgPt(cx, cy) {
    const r = svg.getBoundingClientRect();
    return { x: vb.x + (cx - r.left) / r.width * vb.w, y: vb.y + (cy - r.top) / r.height * vb.h };
  }
  function zoomAt(f, px, py) { // f > 1 zooms in, around svg point (px, py)
    const w = vb.w / f, h = vb.h / f;
    setVB({ x: px - (px - vb.x) / f, y: py - (py - vb.y) / f, w, h });
  }
  function zoomCenter(f) { zoomAt(f, vb.x + vb.w / 2, vb.y + vb.h / 2); }
  function zoomToUnit(u) {
    const bb = pathEls.get(u.id).getBBox();
    const w = Math.max(bb.width, bb.height * VB0.w / VB0.h) * 4;
    setVB({ x: bb.x + bb.width / 2 - w / 2, y: bb.y + bb.height / 2 - w * VB0.h / VB0.w / 2, w, h: w * VB0.h / VB0.w });
  }
  const zc = document.createElement('div');
  zc.className = 'zoomctl';
  zc.innerHTML = '<button type="button" id="zin" aria-label="Približi">+</button><button type="button" id="zout" aria-label="Udalji">−</button><button type="button" id="zreset" aria-label="Prikaži cijelu Hrvatsku" title="Cijela Hrvatska">⤢</button>';
  fig.appendChild(zc);
  const zoomReset = zc.querySelector('#zreset');
  zc.querySelector('#zin').addEventListener('click', () => zoomCenter(1.8));
  zc.querySelector('#zout').addEventListener('click', () => zoomCenter(1 / 1.8));
  zoomReset.addEventListener('click', () => setVB(VB0));
  svg.addEventListener('wheel', e => {
    e.preventDefault();
    const p = svgPt(e.clientX, e.clientY);
    zoomAt(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0018)), p.x, p.y);
  }, { passive: false });
  svg.addEventListener('dblclick', e => { e.preventDefault(); const p = svgPt(e.clientX, e.clientY); zoomAt(2, p.x, p.y); });
  const ptrs = new Map();
  let start = null;
  svg.addEventListener('pointerdown', e => {
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;
    start = { vb: { ...vb }, pts: [...ptrs.values()].map(p => ({ ...p })) };
  });
  svg.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !start) return;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const r = svg.getBoundingClientRect();
    const sc = start.vb.w / r.width;
    const cur = [...ptrs.values()];
    if (cur.length === 1 && start.pts.length === 1) {
      const dx = cur[0].x - start.pts[0].x, dy = cur[0].y - start.pts[0].y;
      if (!dragged && Math.hypot(dx, dy) < 5) return;
      if (VB0.w / vb.w <= 1.01) return; // nothing to pan at full view
      dragged = true; tip.hidden = true;
      if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId);
      setVB({ ...start.vb, x: start.vb.x - dx * sc, y: start.vb.y - dy * sc });
    } else if (cur.length === 2 && start.pts.length === 2) {
      dragged = true; tip.hidden = true;
      const d0 = Math.hypot(start.pts[0].x - start.pts[1].x, start.pts[0].y - start.pts[1].y);
      const d1 = Math.hypot(cur[0].x - cur[1].x, cur[0].y - cur[1].y);
      const f = d1 / Math.max(d0, 1);
      const m0 = { x: (start.pts[0].x + start.pts[1].x) / 2, y: (start.pts[0].y + start.pts[1].y) / 2 };
      const m1 = { x: (cur[0].x + cur[1].x) / 2, y: (cur[0].y + cur[1].y) / 2 };
      const px = start.vb.x + (m0.x - r.left) * sc, py = start.vb.y + (m0.y - r.top) * sc;
      const w = start.vb.w / f, h = start.vb.h / f;
      const nx = px - (m1.x - r.left) / r.width * w, ny = py - (m1.y - r.top) / r.height * h;
      setVB({ x: nx, y: ny, w, h });
    }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId);
    start = ptrs.size ? { vb: { ...vb }, pts: [...ptrs.values()].map(p => ({ ...p })) } : null;
    if (dragged) setTimeout(() => { dragged = false; }, 0);
  };
  svg.addEventListener('pointerup', endPtr);
  svg.addEventListener('pointercancel', endPtr);
  setVB(VB0);

  paint();
  const startU = U.find(u => /^Rovinj/.test(u.label));
  if (startU) select(startU); else renderEmptyPanel();
})();
