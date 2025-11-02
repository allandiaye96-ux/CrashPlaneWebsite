/* App principal: liste, recherche, tri, filtres, cartes (Leaflet) */
(function(){
  'use strict';

  const state = {
    accidents: [],
    filtered: [],
    q: '',
    yearFrom: '',
    yearTo: '',
    airline: 'all',
    country: 'all',
    manufacturer: 'all',
    phase: 'all',
    sortBy: 'date_desc',
    fallbackUsed: false,
    listMap: null,
    detailMap: null,
    _lastGroupBounds: null,
  };

  const $app = document.getElementById('app');
  const NF = new Intl.NumberFormat('fr-FR');
  const fmt = n => typeof n === 'number' ? NF.format(n) : n;
  const esc = s => String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const firstImage = a => (a.images && a.images.length && a.images[0].url) ? a.images[0].url : 'assets/img/plane.jpg';

  // Recherche tolérante aux accents et légère tolérance aux fautes (subsequence)
  const norm = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const queryTokens = q => norm(q).split(/\s+/).filter(t => t && t.length >= 2);
  const fuzzySubseq = (h, n) => { let i=0; for(const c of n){ i=h.indexOf(c,i); if(i===-1) return false; i++; } return true; };
  function highlightPlain(text, tokens){
    if(!tokens||tokens.length===0) return esc(text);
    const re=/[^\s]+/g; let out='', last=0, m; const s=String(text);
    while((m=re.exec(s))){ const i=m.index; const w=m[0]; out+=esc(s.slice(last,i)); const nw=norm(w);
      const hit=tokens.some(t=>nw.includes(t)||(t.length>=3&&fuzzySubseq(nw,t)));
      out+=hit?('<mark>'+esc(w)+'</mark>'):esc(w); last=i+w.length; }
    out+=esc(s.slice(last)); return out;
  }

  function getYearsRange(){
    const years = state.accidents.map(a=>{ const d=new Date(a.date); return isNaN(d)?null:d.getFullYear();}).filter(y=>y!==null);
    if(!years.length) return [null,null];
    return [Math.min(...years), Math.max(...years)];
  }
  const unique = list => ['all', ...Array.from(new Set(list.filter(Boolean))).sort((a,b)=>String(a).localeCompare(String(b)))];
  const uniqueAirlines = ()=> unique(state.accidents.map(a=>a.airline));
  const uniqueCountries = ()=> unique(state.accidents.map(a=>a.country));
  const uniqueManufacturers = ()=> unique(state.accidents.map(a=>a.manufacturer));
  const uniquePhases = ()=> unique(state.accidents.map(a=>a.phaseOfFlight));

  function matchesQuery(a,q){ const t=queryTokens(q); if(t.length===0) return true; const h=norm([a.title,a.location,a.airline,a.aircraft,a.description||''].join(' ')); return t.every(x=>h.includes(x)||(x.length>=3&&fuzzySubseq(h,x))); }
  function inYearRange(a,f,t){ if(!f&&!t) return true; const y=new Date(a.date).getFullYear(); if(f&&y<Number(f)) return false; if(t&&y>Number(t)) return false; return true; }
  const match = (a,k,v) => (v==='all'||a[k]===v);

  function applySort(){
    const sb=state.sortBy;
    const val=(a,k)=> (typeof a[k]==='number'?a[k]:(a[k]!=null?Number(a[k]):null));
    const surv=a=>(typeof a.passengersTotal==='number'&&typeof a.fatalities==='number')?(a.passengersTotal-a.fatalities):null;
    const date=a=>new Date(a.date).getTime();
    const cmp=(x,y,d)=>{ if(x==null&&y==null) return 0; if(x==null) return 1; if(y==null) return -1; return d*(x-y);} ;
    switch(sb){
      case 'date_asc': state.filtered.sort((a,b)=>cmp(date(a),date(b),+1)); break;
      case 'date_desc': state.filtered.sort((a,b)=>cmp(date(a),date(b),-1)); break;
      case 'deaths_asc': state.filtered.sort((a,b)=>cmp(val(a,'fatalities'),val(b,'fatalities'),+1)); break;
      case 'deaths_desc': state.filtered.sort((a,b)=>cmp(val(a,'fatalities'),val(b,'fatalities'),-1)); break;
      case 'surv_asc': state.filtered.sort((a,b)=>cmp(surv(a),surv(b),+1)); break;
      case 'surv_desc': state.filtered.sort((a,b)=>cmp(surv(a),surv(b),-1)); break;
      default: break;
    }
  }
  function applyFilters(){
    state.filtered = state.accidents
      .filter(a=>matchesQuery(a,state.q))
      .filter(a=>inYearRange(a,state.yearFrom,state.yearTo))
      .filter(a=>match(a,'airline',state.airline))
      .filter(a=>match(a,'country',state.country))
      .filter(a=>match(a,'manufacturer',state.manufacturer))
      .filter(a=>match(a,'phaseOfFlight',state.phase));
    applySort();
  }

  function captureFocus(){ const el=document.activeElement; if(!el||!el.id) return null; const tag=el.tagName; if(tag!=='INPUT'&&tag!=='TEXTAREA'&&tag!=='SELECT') return {id:el.id}; return {id:el.id,start:el.selectionStart,end:el.selectionEnd}; }
  function restoreFocus(fs){ if(!fs) return; const el=document.getElementById(fs.id); if(!el) return; el.focus(); if(typeof fs.start==='number'&&typeof fs.end==='number'&&el.setSelectionRange){ try{ el.setSelectionRange(fs.start,fs.end);}catch{} } }

  function renderHome(){
    applyFilters();
    const [minY,maxY]=getYearsRange(); const airlines=uniqueAirlines(); const countries=uniqueCountries(); const mans=uniqueManufacturers(); const phases=uniquePhases(); const tokens=queryTokens(state.q); const fb=captureFocus();
    const notice = state.fallbackUsed ? '<div class="notice" style="margin:10px 0;">Données chargées en mode local. Pour lire data/accidents.json : lancez <code>py -m http.server 5500</code> puis ouvrez <code>http://localhost:5500</code>.</div>' : '';
    const filters = `
      ${notice}
      <section class="hero"><h1>Accidents et crashes d’avion</h1><p>Histoires documentées, illustrées, sourcées.</p></section>
      <div class="panel" role="region" aria-label="Filtres">
        <div class="filters" style="padding:10px; display:grid; gap:8px; grid-template-columns: 1fr 180px 180px 180px 1fr 1fr 220px; align-items:center;">
          <label class="sr-only" for="q">Rechercher</label>
          <input id="q" type="search" placeholder="Rechercher (titre, lieu, compagnie, appareil, détails)" value="${esc(state.q)}" />
          <select id="airline">${airlines.map(a=>`<option value="${esc(a)}" ${state.airline===a?'selected':''}>${a==='all'?'Toutes compagnies':esc(a)}</option>`).join('')}</select>
          <select id="country" ${countries.length<=1?'disabled':''}>${countries.map(c=>`<option value="${esc(c)}" ${state.country===c?'selected':''}>${c==='all'?'Tous pays':esc(c)}</option>`).join('')}</select>
          <select id="manufacturer" ${mans.length<=1?'disabled':''}>${mans.map(m=>`<option value="${esc(m)}" ${state.manufacturer===m?'selected':''}>${m==='all'?'Tous constructeurs':esc(m)}</option>`).join('')}</select>
          <select id="phase" ${phases.length<=1?'disabled':''}>${phases.map(p=>`<option value="${esc(p)}" ${state.phase===p?'selected':''}>${p==='all'?'Toutes phases':esc(p)}</option>`).join('')}</select>
          <div style="display:flex; gap:8px;">
            <label class="sr-only" for="yearFrom">De</label>
            <input id="yearFrom" type="number" placeholder="De ${minY||''}" value="${esc(state.yearFrom)}" />
            <label class="sr-only" for="yearTo">À</label>
            <input id="yearTo" type="number" placeholder="À ${maxY||''}" value="${esc(state.yearTo)}" />
          </div>
          <select id="sortBy">
            <option value="date_desc" ${state.sortBy==='date_desc'?'selected':''}>Trier : Date (récent → ancien)</option>
            <option value="date_asc" ${state.sortBy==='date_asc'?'selected':''}>Trier : Date (ancien → récent)</option>
            <option value="deaths_desc" ${state.sortBy==='deaths_desc'?'selected':''}>Trier : Morts (plus → moins)</option>
            <option value="deaths_asc" ${state.sortBy==='deaths_asc'?'selected':''}>Trier : Morts (moins → plus)</option>
            <option value="surv_desc" ${state.sortBy==='surv_desc'?'selected':''}>Trier : Survivants (plus → moins)</option>
            <option value="surv_asc" ${state.sortBy==='surv_asc'?'selected':''}>Trier : Survivants (moins → plus)</option>
          </select>
        </div>
        <div style="padding:0 10px 10px;" class="count">${fmt(state.filtered.length)} évènement(s)</div>
      </div>
      <div class="panel" style="padding:10px; margin-top:10px;">
        <h2 class="sr-only">Carte des accidents</h2>
        <div style="display:flex; justify-content:flex-end; margin-bottom:6px;"><button id="fitMap" class="btn">Ajuster la carte aux résultats</button></div>
        <div id="mapList" class="map" role="region" aria-label="Carte des accidents"></div>
      </div>`;

    const grid = `
      <section class="grid" aria-label="Liste des accidents">
        ${state.filtered.map(a=>`
          <article class="card panel">
            <a href="#/accident/${encodeURIComponent(a.id)}"><img class="thumb" src="${esc(firstImage(a))}" alt="Image" loading="lazy" /></a>
            <div>
              <h3><a href="#/accident/${encodeURIComponent(a.id)}">${highlightPlain(a.title,tokens)}</a></h3>
              <div class="meta">${new Date(a.date).toLocaleDateString('fr-FR')} · ${highlightPlain(a.location,tokens)} · ${highlightPlain(a.aircraft||'Appareil',tokens)}</div>
              <div class="meta">${highlightPlain(a.airline||'Compagnie inconnue',tokens)} · Morts : <span class="badge">${typeof a.fatalities==='number'?fmt(a.fatalities):'N/A'}</span></div>
              <div class="meta">${typeof a.passengersTotal==='number'?`Total passagers : ${fmt(a.passengersTotal)} · `:''}${typeof a.fatalities==='number'?`Morts : ${fmt(a.fatalities)} · `:''}${typeof a.passengersTotal==='number'&&typeof a.fatalities==='number'?`Survivants : ${fmt(a.passengersTotal-a.fatalities)}`:''}</div>
            </div>
          </article>`).join('')}
        ${state.filtered.length===0?`<div class="empty">Aucun résultat. Ajustez votre recherche ou vos filtres.</div>`:''}
      </section>`;

    $app.innerHTML = filters + grid;
    document.getElementById('q').addEventListener('input', e=>{ state.q=e.target.value; renderHome(); });
    document.getElementById('airline').addEventListener('change', e=>{ state.airline=e.target.value; renderHome(); });
    const c=document.getElementById('country'); if(c) c.addEventListener('change', e=>{ state.country=e.target.value; renderHome(); });
    const m=document.getElementById('manufacturer'); if(m) m.addEventListener('change', e=>{ state.manufacturer=e.target.value; renderHome(); });
    const p=document.getElementById('phase'); if(p) p.addEventListener('change', e=>{ state.phase=e.target.value; renderHome(); });
    document.getElementById('yearFrom').addEventListener('input', e=>{ state.yearFrom=e.target.value; renderHome(); });
    document.getElementById('yearTo').addEventListener('input', e=>{ state.yearTo=e.target.value; renderHome(); });
    const sortEl=document.getElementById('sortBy'); if(sortEl) sortEl.addEventListener('change', e=>{ state.sortBy=e.target.value; applyFilters(); renderHome(); });

    restoreFocus(fb);
    setupListMap();
    const fitBtn=document.getElementById('fitMap'); if(fitBtn) fitBtn.addEventListener('click', ()=>{ try{ if(state._lastGroupBounds) state.listMap.fitBounds(state._lastGroupBounds.pad(0.2)); }catch{} });
  }

  function renderAbout(){ $app.innerHTML = `
    <section class="panel" style="padding:14px;">
      <h1>À propos</h1>
      <p>Ce site recense des accidents et crashes d’avion et propose un récit documenté, illustré et sourcé pour chaque évènement, à des fins pédagogiques.</p>
      <p class="notice">Avertissement : ces résumés ne remplacent pas les rapports d’enquête officiels. Pour les informations primaires et complètes, référez‑vous aux organismes compétents : <strong>BEA</strong> (France), <strong>NTSB</strong> (USA), <strong>AAIB</strong> (UK), <strong>TSB</strong> (Canada), <strong>CENIPA</strong> (Brésil), <strong>KNKT</strong> (Indonésie), <strong>AAIC/JTSB</strong> (Japon), etc.</p>
      <p>Les sources officielles sont citées au bas de chaque fiche lorsque disponibles. Les images doivent être libres de droits ou personnelles ; en cas de doute, utilisez des illustrations génériques.</p>
      <p>Vous pouvez contribuer en ajoutant des fiches dans <code>data/accidents.json</code> et des images dans <code>assets/img/</code>. Voir le guide dans <a href="README.md" target="_blank" rel="noopener">README</a>.</p>
      <p><a class="btn" href="#/">Retour à la liste</a></p>
    </section>`; }

  function renderDetail(id){
    const acc = state.accidents.find(a=>String(a.id)===String(id)); if(!acc){ $app.innerHTML='<div class="empty">Évènement introuvable. <a href="#/">Retour</a></div>'; return; }
    const images=(acc.images||[]).map(img=>`<figure><img src="${esc(img.url)}" alt="${esc(img.caption||'Illustration')}" loading="lazy" />${img.caption?`<figcaption class="meta">${esc(img.caption)}</figcaption>`:''}</figure>`).join('');
    const sources=(acc.sources||[]).map(s=>`<li><a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title||s.url)}</a></li>`).join('');
    $app.innerHTML = `
      <nav class="meta" style="margin:10px 0;"><a href="#/">← Retour</a></nav>
      <article class="detail panel"><section>
        <h1>${esc(acc.title)}</h1>
        <div class="meta-row">
          <span>Date: ${new Date(acc.date).toLocaleDateString('fr-FR')}</span>
          <span>Lieu: ${esc(acc.location)}</span>
          ${acc.airline?`<span>Compagnie: ${esc(acc.airline)}</span>`:''}
          ${acc.aircraft?`<span>Appareil: ${esc(acc.aircraft)}</span>`:''}
          ${typeof acc.fatalities==='number'?`<span>Morts : ${fmt(acc.fatalities)}</span>`:''}
        </div>
        ${(typeof acc.lat==='number'&&typeof acc.lon==='number')?`
        <div class="block" style="padding:0; margin-top:10px;">
          <div id="mapDetail" class="map" role="region" aria-label="Localisation"></div>
          <div class="meta" style="margin:6px 10px;">
            <span style="display:inline-flex;align-items:center;gap:6px;margin-right:10px;"><span style="width:10px;height:10px;border-radius:50%;background:#2ecc71;display:inline-block;border:1px solid #1b8f55;"></span> Départ</span>
            <span style="display:inline-flex;align-items:center;gap:6px;margin-right:10px;"><span style="width:10px;height:10px;border-radius:50%;background:#a9b2c3;display:inline-block;border:1px solid #6f7889;"></span> Arrivée prévue</span>
            <span style="display:inline-flex;align-items:center;gap:6px;"><span style="width:10px;height:10px;border-radius:50%;background:#ff6b6b;display:inline-block;border:1px solid #c24343;"></span> Lieu de l’accident</span>
          </div>
        </div>`:''}
        <div class="meta-row" style="margin-top:6px;">
          ${typeof acc.passengersTotal==='number'?`<span>Total passagers : ${fmt(acc.passengersTotal)}</span>`:''}
          ${typeof acc.fatalities==='number'?`<span>Morts : ${fmt(acc.fatalities)}</span>`:''}
          ${typeof acc.passengersTotal==='number'&&typeof acc.fatalities==='number'?`<span>Survivants : ${fmt(acc.passengersTotal-acc.fatalities)}</span>`:''}
        </div>
        <div class="block">${acc.description||'<p class="meta">Aucun récit disponible.</p>'}</div>
        ${images?`<section class="gallery">${images}</section>`:''}
      </section><aside>
        <div class="block panel"><h3>Sources</h3>${sources?`<ul class="sources">${sources}</ul>`:'<p class="meta">Aucune source fournie.</p>'}</div>
        <div class="block panel" style="margin-top:10px;"><h3>Partager</h3><button class="btn" id="copyLink">Copier le lien</button></div>
      </aside></article>`;
    const btn=document.getElementById('copyLink'); if(btn) btn.addEventListener('click', async ()=>{ try{ await navigator.clipboard.writeText(location.href); btn.textContent='Lien copié ✓'; setTimeout(()=>btn.textContent='Copier le lien',1200);}catch{} });
    setupDetailMap();
  }

  async function loadData(){
    try{
      const res=await fetch('data/accidents.json',{cache:'no-cache'});
      if(!res.ok) throw new Error('HTTP '+res.status);
      const json=await res.json();
      state.accidents=Array.isArray(json)?json:(json.accidents||[]);
      state.filtered=state.accidents.slice();
      state.fallbackUsed=false;
    }catch(e){
      if(location.protocol==='file:'&&Array.isArray(window.__ACCIDENTS_FALLBACK)){
        state.accidents=window.__ACCIDENTS_FALLBACK.slice();
        state.filtered=state.accidents.slice();
        state.fallbackUsed=true;
      } else { throw e; }
    }
  }

  function router(){
    const hash=location.hash||'#/'
    if(hash.startsWith('#/accident/')){ const id=decodeURIComponent(hash.split('/')[2]||''); renderDetail(id); return; }
    if(hash==='#/a-propos'){ renderAbout(); return; }
    renderHome();
  }

  // Thème clair/sombre simple
  function initTheme(){
    const btn=document.getElementById('themeToggle');
    const current=localStorage.getItem('theme')||'light';
    document.documentElement.dataset.theme=current;
    if(btn){ btn.setAttribute('aria-pressed', current==='dark'?'true':'false');
      btn.addEventListener('click',()=>{
        const next=(document.documentElement.dataset.theme==='dark'?'light':'dark');
        document.documentElement.dataset.theme=next; localStorage.setItem('theme',next);
        btn.setAttribute('aria-pressed', next==='dark'?'true':'false');
      });
    }
  }

  function setupLeafletDefaults(){ /* noop for now */ }
  function setupListMap(){
    const el=document.getElementById('mapList'); if(!el) return;
    if(typeof L==='undefined'){ el.innerHTML='<div class="empty">Carte indisponible (Leaflet non chargé).</div>'; return; }
    if(state.listMap){ try{ state.listMap.remove(); }catch{} state.listMap=null; }
    setupLeafletDefaults();
    const map=L.map('mapList'); state.listMap=map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const pts=state.filtered.filter(a=>typeof a.lat==='number'&&typeof a.lon==='number');
    if(pts.length===0){ map.setView([20,0],2); state._lastGroupBounds=null; return; }
    const markers=pts.map(a=>{ const m=L.circleMarker([a.lat,a.lon],{radius:6,color:'#4ea1ff',weight:2,fillColor:'#4ea1ff',fillOpacity:0.8}); m.bindTooltip(esc(a.title),{direction:'top',offset:[0,-6],opacity:0.9}); m.bindPopup(`<strong>${esc(a.title)}</strong><br>${new Date(a.date).toLocaleDateString('fr-FR')}<br><a href=\"#/accident/${encodeURIComponent(a.id)}\">Voir la fiche</a>`); return m; });
    let group;
    if(typeof L.markerClusterGroup==='function'){
      group=L.markerClusterGroup({showCoverageOnHover:false,spiderfyOnMaxZoom:true,disableClusteringAtZoom:7});
      markers.forEach(m=>group.addLayer(m)); map.addLayer(group);
    } else { group=L.featureGroup(markers).addTo(map); }
    try{ state._lastGroupBounds=group.getBounds(); map.fitBounds(state._lastGroupBounds.pad(0.2)); }catch{ map.setView([20,0],2); }
  }
  function setupDetailMap(){
    const el=document.getElementById('mapDetail'); if(!el) return;
    if(typeof L==='undefined'){ el.innerHTML='<div class="empty">Carte indisponible (Leaflet non chargé).</div>'; return; }
    if(state.detailMap){ try{ state.detailMap.remove(); }catch{} state.detailMap=null; }
    const id=(location.hash.split('/')[2]||'');
    const acc=state.accidents.find(a=>String(a.id)===decodeURIComponent(id||''));
    if(!acc||typeof acc.lat!=='number'||typeof acc.lon!=='number') return;
    setupLeafletDefaults();
    const map=L.map('mapDetail'); state.detailMap=map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19, attribution:'&copy; OpenStreetMap contributors'}).addTo(map);
    const crash=L.circleMarker([acc.lat,acc.lon],{radius:7,color:'#ff6b6b',weight:2,fillColor:'#ff6b6b',fillOpacity:0.85}).addTo(map);
    crash.bindTooltip(esc(acc.title),{direction:'top',offset:[0,-6],opacity:0.9});
    crash.bindPopup(`<strong>${esc(acc.title)}</strong><br>${new Date(acc.date).toLocaleDateString('fr-FR')}`);
    const bounds=[[acc.lat,acc.lon]];
    if(acc.route&&acc.route.from&&acc.route.to&&typeof acc.route.from.lat==='number'&&typeof acc.route.from.lon==='number'&&typeof acc.route.to.lat==='number'&&typeof acc.route.to.lon==='number'){
      const from=[acc.route.from.lat,acc.route.from.lon]; const to=[acc.route.to.lat,acc.route.to.lon];
      bounds.push(from,to);
      const dep=L.circleMarker(from,{radius:5,color:'#2ecc71',weight:2,fillColor:'#2ecc71',fillOpacity:0.9}).addTo(map);
      dep.bindTooltip('Départ : '+esc((acc.route.from.iata?acc.route.from.iata+' – ':'')+(acc.route.from.name||'')),{direction:'top',offset:[0,-6],opacity:0.9});
      const arr=L.circleMarker(to,{radius:5,color:'#a9b2c3',weight:2,fillColor:'#a9b2c3',fillOpacity:0.9}).addTo(map);
      arr.bindTooltip('Arrivée prévue : '+esc((acc.route.to.iata?acc.route.to.iata+' – ':'')+(acc.route.to.name||'')),{direction:'top',offset:[0,-6],opacity:0.9});
      L.polyline([from,to],{color:'#a9b2c3',weight:2,opacity:0.8,dashArray:'6 6'}).addTo(map);
      try{ map.fitBounds(L.latLngBounds(bounds).pad(0.2)); }catch{ map.setView([acc.lat,acc.lon],8); }
    } else { map.setView([acc.lat,acc.lon],8); }
  }

  window.addEventListener('hashchange',()=>{ router(); setTimeout(()=>{ setupListMap(); setupDetailMap(); },0); });
  window.addEventListener('DOMContentLoaded', async ()=>{
    initTheme();
    const appDiv=document.getElementById('app'); if(appDiv) appDiv.innerHTML='<div class="empty">Chargement…</div>';
    try{ await loadData(); }
    catch(e){ $app.innerHTML='<div class="empty">Erreur de chargement des données. Ouvrez via un serveur local ou utilisez le fallback.</div>'; console.error(e); return; }
    router(); setupListMap(); setupDetailMap();
    try{ window.appReady=true;}catch{}
  });
  window.addEventListener('error', ev=>{ try{ const msg=(ev&&ev.message)?ev.message:'Erreur JS'; const where=ev&&ev.filename?(ev.filename+':'+ev.lineno):''; const box=document.createElement('div'); box.className='notice'; box.style.margin='10px 0'; box.textContent='Erreur: '+msg+(where?' ('+where+')':''); const app=document.getElementById('app'); if(app) app.prepend(box);}catch{} });
  window.addEventListener('unhandledrejection', ev=>{ try{ const msg=(ev&&ev.reason&&(ev.reason.message||ev.reason))||'Erreur promesse non gérée'; const box=document.createElement('div'); box.className='notice'; box.style.margin='10px 0'; box.textContent='Erreur: '+msg; const app=document.getElementById('app'); if(app) app.prepend(box);}catch{} });
})();
