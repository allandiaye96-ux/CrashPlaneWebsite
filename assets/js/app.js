/* Carnet de Vol — application principale
   Accueil (enregistreur + actualités + base), fiche accident, à propos.
   Les données de la base sont rédigées à la main ; les actualités viennent du robot
   et sont insérées en texte brut uniquement (voir news.js / renderNewsTeaser). */
(function () {
  'use strict';

  const state = {
    accidents: [], filtered: [], news: [],
    q: '', decade: 'all', manufacturer: 'all', phase: 'all', sortBy: 'date_desc',
    view: 'list', listMap: null, detailMap: null, fallbackUsed: false,
  };

  const $app = document.getElementById('app');
  const nf = new Intl.NumberFormat('fr-FR');
  const fmt = n => (typeof n === 'number' ? nf.format(n) : '—');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fdate = d => { const x = new Date(d); return isNaN(x) ? '—' : x.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); };
  const year = a => new Date(a.date).getFullYear();
  const survivors = a => (typeof a.passengersTotal === 'number' && typeof a.fatalities === 'number') ? a.passengersTotal - a.fatalities : null;
  const flightCode = a => { const m = /^([a-z]{1,4}\d{1,5})-\d{4}$/i.exec(a.id); return m ? m[1].toUpperCase() : null; };
  const shortTitle = a => String(a.title || '').split(/\s[–-]\s/)[0];
  const subTitle = a => { const p = String(a.title || '').split(/\s[–-]\s/); return p.length > 1 ? p.slice(1).join(' – ') : (a.location || ''); };

  /* ---------------- Recherche et filtres ---------------- */
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const tokens = q => norm(q).split(/\s+/).filter(t => t.length >= 2);
  function matches(a, q) {
    const t = tokens(q); if (!t.length) return true;
    const h = norm([a.title, a.location, a.airline, a.aircraft, a.id, a.description].join(' '));
    return t.every(x => h.includes(x));
  }
  const uniq = k => Array.from(new Set(state.accidents.map(a => a[k]).filter(Boolean))).sort((x, y) => x.localeCompare(y, 'fr'));
  const decades = () => Array.from(new Set(state.accidents.map(a => Math.floor(year(a) / 10) * 10))).sort((x, y) => x - y);

  function applyFilters() {
    const f = state.accidents.filter(a => matches(a, state.q)
      && (state.decade === 'all' || Math.floor(year(a) / 10) * 10 === Number(state.decade))
      && (state.manufacturer === 'all' || a.manufacturer === state.manufacturer)
      && (state.phase === 'all' || a.phaseOfFlight === state.phase));
    const num = v => (typeof v === 'number' ? v : null);
    const cmp = (x, y, d) => (x == null && y == null) ? 0 : x == null ? 1 : y == null ? -1 : d * (x - y);
    const s = state.sortBy;
    f.sort((a, b) => s === 'date_asc' ? cmp(+new Date(a.date), +new Date(b.date), 1)
      : s === 'deaths_desc' ? cmp(num(a.fatalities), num(b.fatalities), -1)
      : s === 'surv_desc' ? cmp(survivors(a), survivors(b), -1)
      : cmp(+new Date(a.date), +new Date(b.date), -1));
    state.filtered = f;
  }

  /* ---------------- Enregistreur (frise 1905 → aujourd'hui) ---------------- */
  function recorderSvg() {
    const W = 1000, H = 150, base = 120, top = 14;
    const y0 = 1905, y1 = Math.max(new Date().getFullYear() + 1, 2026);
    const x = d => { const t = new Date(d); return ((t.getFullYear() + t.getMonth() / 12 - y0) / (y1 - y0)) * W; };
    const maxF = Math.max(1, ...state.accidents.map(a => a.fatalities || 0));
    const h = a => typeof a.fatalities === 'number' ? 6 + (base - top - 6) * Math.sqrt(a.fatalities / maxF) : 6;
    let grid = '';
    for (let yr = 1910; yr < y1; yr += 10) {
      const gx = ((yr - y0) / (y1 - y0)) * W;
      grid += `<line class="rec-grid" x1="${gx}" x2="${gx}" y1="${top}" y2="${base}"/>`
        + `<text class="rec-year" x="${gx}" y="${base + 20}" text-anchor="middle">${yr}</text>`;
    }
    const sorted = state.accidents.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const bars = sorted.map((a, i) => {
      const bx = x(a.date).toFixed(1), bh = h(a).toFixed(1);
      const label = `${year(a)}, ${shortTitle(a)} : ${typeof a.fatalities === 'number' ? fmt(a.fatalities) + ' morts' : 'bilan non renseigné'}`;
      return `<a href="#/accident/${encodeURIComponent(a.id)}" class="rec-bar" data-id="${esc(a.id)}" aria-label="${esc(label)}" style="--i:${i}">`
        + `<rect x="${bx - 6}" y="${top}" width="12" height="${base - top}" class="rec-hit"/>`
        + `<line x1="${bx}" x2="${bx}" y1="${base}" y2="${(base - bh).toFixed(1)}" class="rec-line"/></a>`;
    }).join('');
    const dated = state.accidents.filter(a => !isNaN(new Date(a.date)));
    const byDate = dated.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
    const worst = dated.filter(a => typeof a.fatalities === 'number').sort((a, b) => b.fatalities - a.fatalities)[0];
    const picks = [];
    if (byDate[0]) picks.push([byDate[0], 'Le plus ancien']);
    if (worst && worst !== byDate[0]) picks.push([worst, 'Le plus meurtrier']);
    const latest = byDate[byDate.length - 1];
    if (latest && !picks.some(p => p[0] === latest)) picks.push([latest, 'Le plus récent']);
    const notes = picks.map(([a, k]) => {
      const pos = x(a.date) / W * 100, right = pos > 75;
      return `<li class="${right ? 'is-right' : ''}" style="left:${pos.toFixed(2)}%;height:calc(34px + ${((base - h(a)) / H).toFixed(3)} * (100% - 34px))"><a href="#/accident/${encodeURIComponent(a.id)}" tabindex="-1"><span class="rec-note-k">${k}</span>${esc(shortTitle(a))}${shortTitle(a).includes(String(year(a))) ? '' : ', ' + year(a)}</a></li>`;
    }).join('');
    return `<div class="recorder-plot"><svg class="recorder-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="group" aria-label="Frise des accidents de la base, de 1908 à aujourd'hui">
      ${grid}<line class="rec-base" x1="0" x2="${W}" y1="${base}" y2="${base}"/>${bars}</svg><ul class="rec-notes" aria-hidden="true">${notes}</ul></div>`;
  }

  function bindRecorder() {
    const svg = document.querySelector('.recorder-svg'); const out = document.getElementById('recReadout');
    if (!svg || !out) return;
    const show = id => {
      const a = state.accidents.find(z => z.id === id); if (!a) return;
      svg.querySelectorAll('.rec-bar').forEach(b => b.classList.toggle('is-active', b.dataset.id === id));
      out.textContent = '';
      const strong = document.createElement('strong'); strong.textContent = shortTitle(a);
      out.append(strong, document.createTextNode(` — ${fdate(a.date)}, ${a.location || ''}. `
        + (typeof a.fatalities === 'number' ? `${fmt(a.fatalities)} morts` : 'Bilan non renseigné')
        + (survivors(a) > 0 ? `, ${fmt(survivors(a))} survivants.` : '.')));
    };
    svg.querySelectorAll('.rec-bar').forEach(b => {
      b.addEventListener('mouseenter', () => show(b.dataset.id));
      b.addEventListener('focus', () => show(b.dataset.id));
    });
  }

  /* ---------------- Accueil ---------------- */
  function stripHtml(a) {
    const code = flightCode(a);
    const surv = survivors(a);
    return `<li><a class="strip" href="#/accident/${encodeURIComponent(a.id)}">
      <span class="strip-code">${code ? esc(code) : '<span class="strip-nocode">—</span>'}<span class="strip-year">${year(a)}</span></span>
      <span class="strip-main"><span class="strip-title">${esc(shortTitle(a))}</span><span class="strip-sub">${esc(subTitle(a))}</span></span>
      <span class="strip-ac">${esc(a.aircraft || '')}</span>
      <span class="strip-toll"><span class="strip-num">${fmt(a.fatalities)}</span><span class="strip-unit">morts</span>${surv > 0 ? `<span class="strip-surv">${fmt(surv)} survivants</span>` : ''}</span>
    </a></li>`;
  }

  function optionList(values, current, allLabel, labelFn) {
    return `<option value="all">${esc(allLabel)}</option>` + values.map(v => `<option value="${esc(v)}" ${String(current) === String(v) ? 'selected' : ''}>${esc(labelFn ? labelFn(v) : v)}</option>`).join('');
  }

  function renderHome() {
    applyFilters();
    const n = state.accidents.length;
    const first = n ? Math.min(...state.accidents.map(year)) : '', last = n ? Math.max(...state.accidents.map(year)) : '';
    $app.innerHTML = `
      ${state.fallbackUsed ? '<p class="notice">Données chargées en mode local (fichier ouvert hors serveur).</p>' : ''}
      <section class="hero">
        <div class="hero-top"><h1 class="hero-title">Chaque accident a changé la façon de voler.</h1>
        <p class="hero-lede">L’actualité aéronautique vérifiée par recoupement de sources, et ${n} accidents documentés de ${first} à ${last} à partir des rapports d’enquête.</p></div>
        <figure class="recorder">
          ${recorderSvg()}
          <figcaption><p id="recReadout" class="rec-readout" aria-live="polite">Survolez un trait pour lire l’accident. La hauteur suit le nombre de victimes.</p></figcaption>
        </figure>
      </section>

      <section class="home-news" aria-labelledby="newsHeading">
        <div class="section-head"><h2 id="newsHeading">Actualités vérifiées</h2><a class="link" href="/actualites/">Toutes les actualités</a></div>
        <div id="newsTeaser"><p class="empty">Chargement…</p></div>
      </section>

      <section class="base" aria-labelledby="baseHeading">
        <div class="section-head"><h2 id="baseHeading">La base historique</h2>
          <div class="view-switch" role="group" aria-label="Affichage">
            <button class="seg ${state.view === 'list' ? 'is-on' : ''}" data-view="list" aria-pressed="${state.view === 'list'}">Liste</button>
            <button class="seg ${state.view === 'map' ? 'is-on' : ''}" data-view="map" aria-pressed="${state.view === 'map'}">Carte</button>
          </div>
        </div>
        <div class="toolbar">
          <label class="field field-search"><span class="sr-only">Rechercher</span>
            <input id="q" type="search" placeholder="Rechercher un vol, une compagnie, un lieu…" value="${esc(state.q)}" autocomplete="off" /></label>
          <label class="field"><span class="sr-only">Décennie</span><select id="decade">${optionList(decades(), state.decade, 'Toutes les décennies', d => `Années ${d}`)}</select></label>
          <label class="field"><span class="sr-only">Constructeur</span><select id="manufacturer">${optionList(uniq('manufacturer'), state.manufacturer, 'Tous les constructeurs')}</select></label>
          <label class="field"><span class="sr-only">Phase de vol</span><select id="phase">${optionList(uniq('phaseOfFlight'), state.phase, 'Toutes les phases')}</select></label>
          <label class="field"><span class="sr-only">Trier</span><select id="sortBy">
            <option value="date_desc" ${state.sortBy === 'date_desc' ? 'selected' : ''}>Plus récents d’abord</option>
            <option value="date_asc" ${state.sortBy === 'date_asc' ? 'selected' : ''}>Plus anciens d’abord</option>
            <option value="deaths_desc" ${state.sortBy === 'deaths_desc' ? 'selected' : ''}>Bilan le plus lourd</option>
            <option value="surv_desc" ${state.sortBy === 'surv_desc' ? 'selected' : ''}>Plus de survivants</option>
          </select></label>
        </div>
        <p class="count" aria-live="polite">${state.filtered.length} accident${state.filtered.length > 1 ? 's' : ''}</p>
        ${state.view === 'map'
          ? '<div id="mapList" class="map map-large" role="region" aria-label="Carte des accidents"></div>'
          : (state.filtered.length ? `<ol class="strips">${state.filtered.map(stripHtml).join('')}</ol>` : '<p class="empty">Aucun accident ne correspond. Élargissez la recherche ou retirez un filtre.</p>')}
      </section>`;

    bindRecorder();
    renderNewsTeaser();
    const rerender = () => { const pos = document.getElementById('q'); const caret = pos && document.activeElement === pos ? pos.selectionStart : null; renderHome(); if (caret != null) { const q = document.getElementById('q'); q.focus(); q.setSelectionRange(caret, caret); } };
    document.getElementById('q').addEventListener('input', e => { state.q = e.target.value; rerender(); });
    ['decade', 'manufacturer', 'phase', 'sortBy'].forEach(id => document.getElementById(id).addEventListener('change', e => { state[id] = e.target.value; renderHome(); document.getElementById(id).focus(); }));
    document.querySelectorAll('.seg').forEach(b => b.addEventListener('click', () => { state.view = b.dataset.view; renderHome(); }));
    if (state.view === 'map') setupListMap();
  }

  function renderNewsTeaser() {
    const box = document.getElementById('newsTeaser'); if (!box) return;
    const items = state.news.filter(s => s.published === true && !s.hidden && !s.withdrawn).slice(0, 3);
    box.textContent = '';
    if (!items.length) {
      const p = document.createElement('p'); p.className = 'empty';
      p.textContent = 'Les premières brèves sont en cours de vérification. Elles apparaîtront ici dès qu’un événement sera confirmé par plusieurs sources.';
      box.appendChild(p); return;
    }
    const ul = document.createElement('ul'); ul.className = 'teasers';
    items.forEach(s => {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.className = 'teaser'; a.href = '/actualites/#' + encodeURIComponent(s.id);
      const st = document.createElement('span'); const vs = s.verification && s.verification.status;
      st.className = 'status ' + (vs === 'officiel' ? 'status-official' : vs === 'source_unique' ? 'status-single' : 'status-corroborated');
      st.textContent = vs === 'officiel' ? 'Source officielle' : vs === 'source_unique' ? 'Source unique' : `${(s.verification && s.verification.independent_sources) || 2} sources`;
      const t = document.createElement('span'); t.className = 'teaser-title'; t.textContent = s.titre;
      const m = document.createElement('span'); m.className = 'teaser-meta'; m.textContent = `${s.categorie}, ${fdate(s.updated)}`;
      a.append(st, t, m); li.appendChild(a); ul.appendChild(li);
    });
    box.appendChild(ul);
  }

  /* ---------------- Fiche accident ---------------- */
  function renderDetail(id) {
    const a = state.accidents.find(z => String(z.id) === String(id));
    if (!a) { $app.innerHTML = '<p class="empty">Cet accident n’existe pas dans la base. <a class="link" href="#/">Revenir à l’accueil</a></p>'; return; }
    const code = flightCode(a), surv = survivors(a);
    const cell = (k, v) => v == null || v === '' ? '' : `<div class="db-cell"><dt>${k}</dt><dd>${v}</dd></div>`;
    const sources = (a.sources || []).filter(s => /^https?:\/\//.test(s.url || '')).map(s => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title || s.url)}</a></li>`).join('');
    const images = (a.images || []).map(img => `<figure class="detail-fig"><img src="${esc(img.url)}" alt="${esc(img.caption || a.title)}" loading="lazy" />${img.caption ? `<figcaption>${esc(img.caption)}</figcaption>` : ''}</figure>`).join('');
    $app.innerHTML = `
      <nav class="crumbs" aria-label="Fil d’Ariane"><a class="link" href="#/">Accueil</a><span aria-hidden="true">/</span><span>${esc(shortTitle(a))}</span></nav>
      <article class="detail">
        <header class="detail-head">
          ${code ? `<p class="detail-code">${esc(code)}</p>` : ''}
          <h1>${esc(a.title)}</h1>
          <dl class="datablock">
            ${cell('Date', esc(fdate(a.date)))}
            ${cell('Lieu', esc(a.location))}
            ${cell('Exploitant', esc(a.airline))}
            ${cell('Appareil', esc(a.aircraft))}
            ${cell('Phase de vol', esc(a.phaseOfFlight))}
            ${cell('À bord', typeof a.passengersTotal === 'number' ? fmt(a.passengersTotal) : null)}
            ${cell('Victimes', typeof a.fatalities === 'number' ? fmt(a.fatalities) : 'Non établi')}
            ${cell('Survivants', surv != null && surv >= 0 ? fmt(surv) : null)}
          </dl>
        </header>
        <div class="detail-body">
          <div class="story">${a.description || '<p>Aucun récit pour le moment.</p>'}</div>
          ${(typeof a.lat === 'number' && typeof a.lon === 'number') ? `
          <figure class="detail-map">
            <div id="mapDetail" class="map" role="region" aria-label="Carte : route prévue et lieu de l’accident"></div>
            <figcaption class="legend"><span class="lg lg-route">Route prévue</span><span class="lg lg-site">Lieu de l’accident</span></figcaption>
          </figure>` : ''}
          ${images}
        </div>
        <aside class="detail-side">
          <section class="side-block"><h2>Sources</h2>${sources ? `<ul class="sources">${sources}</ul>` : '<p class="empty">Aucune source renseignée.</p>'}</section>
          <section class="side-block"><h2>Partager</h2><button class="btn" id="copyLink" type="button">Copier le lien</button></section>
        </aside>
      </article>`;
    const btn = document.getElementById('copyLink');
    btn.addEventListener('click', async () => { try { await navigator.clipboard.writeText(location.href); btn.textContent = 'Lien copié'; setTimeout(() => (btn.textContent = 'Copier le lien'), 1500); } catch (e) { btn.textContent = 'Copie impossible'; } });
    window.scrollTo(0, 0);
    setupDetailMap(a);
  }

  function renderAbout() {
    $app.innerHTML = `
      <article class="prose">
        <h1>À propos</h1>
        <p>Carnet de Vol est un projet personnel de passionné d’aviation. Il réunit une veille d’actualité aéronautique vérifiée et une base d’accidents racontés à partir des rapports d’enquête officiels : ce qui s’est passé, et ce qui a changé ensuite.</p>
        <p>Ces récits sont des synthèses : ils ne remplacent pas les rapports des organismes d’enquête (BEA en France, NTSB aux États-Unis, AAIB au Royaume-Uni, BST au Canada…). Les liens vers ces rapports figurent sur chaque fiche.</p>
        <h2 id="methode">Comment les actualités sont produites</h2>
        <p>Un programme consulte régulièrement des flux d’actualité aéronautique : presse spécialisée et autorités (EASA, AAIB…). Une intelligence artificielle regroupe les articles qui parlent du même événement, puis rédige une brève à partir des seules sources citées.</p>
        <p>Pour un accident, un incident ou une enquête, une brève n’est publiée que si l’événement est rapporté par au moins deux médias indépendants ou par une source officielle. Pour l’actualité des compagnies, des constructeurs et des aéroports, une seule source spécialisée peut suffire : la brève porte alors la mention « Source unique ».</p>
        <p>Chaque chiffre d’une brève doit figurer dans au moins une source, et les causes d’un accident ne sont jamais avancées avant les enquêteurs. Ces contrôles réduisent les erreurs sans les éliminer, surtout dans les premières heures d’un événement : référez-vous toujours aux sources.</p>
        <p>Une erreur ou une source à ajouter ? Le projet est ouvert sur GitHub.</p>
      </article>`;
  }

  /* ---------------- Cartes ---------------- */
  const isDark = () => document.documentElement.dataset.theme !== 'light';
  const cssVar = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function tiles(map) {
    const dark = isDark();
    L.tileLayer(dark ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, subdomains: dark ? 'abcd' : 'abc',
      attribution: '&copy; OpenStreetMap' + (dark ? ' &copy; CARTO' : ''),
    }).addTo(map);
  }
  function setupListMap() {
    const el = document.getElementById('mapList'); if (!el) return;
    if (typeof L === 'undefined') { el.textContent = 'La carte n’a pas pu être chargée. Vérifiez votre connexion.'; return; }
    if (state.listMap) { try { state.listMap.remove(); } catch (e) {} }
    const map = state.listMap = L.map(el, { worldCopyJump: true }); tiles(map);
    const c = cssVar('--cyan');
    const pts = state.filtered.filter(a => typeof a.lat === 'number' && typeof a.lon === 'number');
    const markers = pts.map(a => {
      const m = L.circleMarker([a.lat, a.lon], { radius: 6, color: c, weight: 2, fillColor: c, fillOpacity: 0.35 });
      m.bindTooltip(esc(shortTitle(a)) + ', ' + year(a), { direction: 'top', offset: [0, -6] });
      m.on('click', () => { location.hash = '#/accident/' + encodeURIComponent(a.id); });
      return m;
    });
    const group = (typeof L.markerClusterGroup === 'function') ? L.markerClusterGroup({ showCoverageOnHover: false, disableClusteringAtZoom: 6 }) : L.featureGroup();
    markers.forEach(m => group.addLayer(m)); map.addLayer(group);
    try { map.fitBounds(group.getBounds().pad(0.15)); } catch (e) { map.setView([20, 0], 2); }
  }
  function setupDetailMap(a) {
    const el = document.getElementById('mapDetail'); if (!el) return;
    if (typeof L === 'undefined') { el.textContent = 'La carte n’a pas pu être chargée.'; return; }
    if (state.detailMap) { try { state.detailMap.remove(); } catch (e) {} }
    const map = state.detailMap = L.map(el, { scrollWheelZoom: false }); tiles(map);
    const mag = cssVar('--magenta'), amb = cssVar('--amber');
    const site = [a.lat, a.lon], pts = [site];
    const r = a.route;
    const ok = p => p && typeof p.lat === 'number' && typeof p.lon === 'number';
    if (r && ok(r.from) && ok(r.to)) {
      const from = [r.from.lat, r.from.lon], to = [r.to.lat, r.to.lon]; pts.push(from, to);
      L.polyline([from, to], { color: mag, weight: 2, dashArray: '6 6', opacity: 0.9 }).addTo(map);
      [[from, r.from, 'Départ'], [to, r.to, 'Destination prévue']].forEach(([ll, p, k]) => L.circleMarker(ll, { radius: 4, color: mag, weight: 2, fillOpacity: 0 }).addTo(map).bindTooltip(`${k} : ${esc(p.iata || '')} ${esc(p.name || '')}`));
    }
    L.circleMarker(site, { radius: 7, color: amb, weight: 2, fillColor: amb, fillOpacity: 0.6 }).addTo(map).bindTooltip('Lieu de l’accident');
    if (pts.length > 1) { try { map.fitBounds(L.latLngBounds(pts).pad(0.2)); } catch (e) { map.setView(site, 6); } } else map.setView(site, 7);
  }

  /* ---------------- Données, thème, routage ---------------- */
  async function loadData() {
    try {
      const res = await fetch('data/accidents.json', { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json(); state.accidents = Array.isArray(json) ? json : (json.accidents || []);
    } catch (e) {
      if (Array.isArray(window.__ACCIDENTS_FALLBACK)) { state.accidents = window.__ACCIDENTS_FALLBACK.slice(); state.fallbackUsed = true; }
      else throw e;
    }
    try { const r = await fetch('data/news/stories.json', { cache: 'no-cache' }); if (r.ok) { const n = await r.json(); state.news = Array.isArray(n) ? n : []; } } catch (e) { state.news = []; }
  }

  function router() {
    const hash = location.hash || '#/';
    document.querySelectorAll('.nav a').forEach(l => l.removeAttribute('aria-current'));
    if (hash.startsWith('#/accident/')) { renderDetail(decodeURIComponent(hash.split('/')[2] || '')); return; }
    if (hash === '#/a-propos') { renderAbout(); const l = document.querySelector('.nav a[href="#/a-propos"]'); if (l) l.setAttribute('aria-current', 'page'); return; }
    renderHome();
    if (hash === '#/base') { const b = document.getElementById('baseHeading'); if (b) b.scrollIntoView(); }
  }

  window.addEventListener('hashchange', router);
  window.addEventListener('DOMContentLoaded', async () => {
    try { await loadData(); } catch (e) { $app.innerHTML = '<p class="empty">Les données n’ont pas pu être chargées. Rechargez la page.</p>'; return; }
    router();
  });
  document.addEventListener('themechange', () => { if (state.view === 'map') setupListMap(); const a = state.accidents.find(z => location.hash === '#/accident/' + encodeURIComponent(z.id)); if (a) setupDetailMap(a); });
})();
