/* Page Actualités : lit data/news/stories.json et l'affiche.
   Tout le contenu provient d'un robot (sources externes + IA) : il est inséré
   uniquement via textContent, jamais via innerHTML, et les liens sont filtrés. */
(function () {
  'use strict';

  var mode = document.body.getAttribute('data-mode') || 'published'; // 'published' | 'drafts'
  var list = document.getElementById('news');
  var filters = document.getElementById('newsFilters');
  var summary = document.getElementById('newsSummary');
  var state = { stories: [], cat: 'Toutes' };

  var STATUS = {
    officiel: { label: 'Confirmé par une source officielle', cls: 'st-official' },
    corrobore: { label: 'Corroboré par plusieurs sources', cls: 'st-corroborated' },
    source_unique: { label: 'Source unique', cls: 'st-single' }
  };

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function safeUrl(u) {
    return /^https?:\/\/[^\s<>"']+$/.test(u || '') ? u : null;
  }

  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) { return iso; }
  }

  function visible(s) {
    if (s.hidden || s.withdrawn) return false;
    return mode === 'drafts' ? true : s.published === true;
  }

  function renderFilters(stories) {
    var cats = ['Toutes'];
    stories.forEach(function (s) { if (cats.indexOf(s.categorie) < 0) cats.push(s.categorie); });
    filters.textContent = '';
    cats.forEach(function (c) {
      var b = el('button', 'btn chip' + (c === state.cat ? ' active' : ''), c);
      b.type = 'button';
      b.setAttribute('aria-pressed', c === state.cat ? 'true' : 'false');
      b.addEventListener('click', function () { state.cat = c; render(); });
      filters.appendChild(b);
    });
  }

  function storyCard(s) {
    var card = el('article', 'news-card panel');
    card.id = s.id;

    var head = el('div', 'news-head');
    head.appendChild(el('span', 'news-cat', s.categorie));
    var st = STATUS[s.verification && s.verification.status] || { label: 'Non vérifié', cls: 'st-unverified' };
    head.appendChild(el('span', 'news-status ' + st.cls, st.label));
    if (mode === 'drafts') head.appendChild(el('span', 'news-status st-draft', s.published ? 'Publié' : 'Brouillon'));
    card.appendChild(head);

    card.appendChild(el('h2', 'news-title', s.titre));
    var meta = 'Publié le ' + fmtDate(s.created);
    if (s.version > 1) meta += ' · mis à jour le ' + fmtDate(s.updated);
    card.appendChild(el('p', 'meta', meta));
    card.appendChild(el('p', 'news-chapo', s.chapo));
    (s.paragraphes || []).forEach(function (p) { card.appendChild(el('p', null, p)); });
    if (s.contradictions) card.appendChild(el('p', 'news-warning', 'Points divergents entre les sources : ' + s.contradictions));

    var det = el('details', 'news-sources');
    det.appendChild(el('summary', null, 'Sources (' + (s.sources || []).length + ')'));
    var ul = el('ul');
    (s.sources || []).forEach(function (src) {
      var li = el('li');
      var url = safeUrl(src.url);
      if (url) {
        var a = el('a', null, src.title || src.name);
        a.href = url; a.target = '_blank'; a.rel = 'noopener nofollow';
        li.appendChild(a);
      } else {
        li.textContent = src.title || src.name;
      }
      li.appendChild(el('span', 'meta', ' — ' + src.name + (src.official ? ' (source officielle)' : '')));
      ul.appendChild(li);
    });
    det.appendChild(ul);
    card.appendChild(det);
    return card;
  }

  function render() {
    var all = state.stories.filter(visible);
    renderFilters(all);
    var shown = all.filter(function (s) { return state.cat === 'Toutes' || s.categorie === state.cat; });
    list.textContent = '';
    summary.textContent = shown.length + (shown.length > 1 ? ' articles' : ' article');
    if (!shown.length) {
      list.appendChild(el('div', 'empty', mode === 'drafts'
        ? 'Aucun brouillon pour le moment. Le robot n’a encore rien rédigé.'
        : 'Aucune actualité publiée pour le moment.'));
      return;
    }
    shown.forEach(function (s) { list.appendChild(storyCard(s)); });
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) target.scrollIntoView();
    }
  }

  fetch('/data/news/stories.json', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (data) { state.stories = Array.isArray(data) ? data : []; render(); })
    .catch(function () {
      list.textContent = '';
      list.appendChild(el('div', 'empty', 'Impossible de charger les actualités pour le moment.'));
    });
})();
