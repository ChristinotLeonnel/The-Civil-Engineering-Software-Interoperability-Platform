// Point d'entrée : état de l'application, navigation entre vues, liens profonds (#view=…&node=…).
import { loadData } from './data.js?v=20261031.6';
import { createGraph } from './graph.js?v=20261031.6';
import { createPanel } from './panel.js?v=20261031.6';
import { initControls, searchDb } from './controls.js?v=20261031.6';
import { renderList, renderFormats, renderAbout } from './pages.js?v=20261031.6';
import { h, kindSwatch } from './util.js?v=20261031.6';

const $ = (id) => document.getElementById(id);
const VIEWS = ['map', 'list', 'formats', 'about'];
const mobileQuery = window.matchMedia('(max-width: 760px)');
// Par défaut, seules les liaisons documentées par un éditeur sont affichées (confiance élevée ou moyenne) ;
// les liaisons incertaines (forums, déductions, non vérifiées) se réaffichent par le filtre « Fiabilité ».
const DEFAULT_CONFS = ['high', 'medium'];

async function start() {
  let db;
  try {
    db = await loadData();
  } catch (err) {
    showFatal(err);
    return;
  }

  const state = {
    view: 'map',
    cats: new Set(db.meta.categories.map((c) => c.id)),
    kinds: new Set(db.meta.kinds.map((k) => k.id)),
    confs: new Set(DEFAULT_CONFS),
    format: null,
    query: '',
    selected: null // { type: 'software' | 'connection', id }
  };

  const stage = $('main');
  let graph = null;
  let controls = null;
  let panel = null;

  const matchSet = () => (state.query.trim() ? searchDb(db, state.query).softwareIds : null);

  /* ------------------------------------------------------------ actions */
  const app = {
    selectSoftware(id) {
      if (!db.softwareById.has(id)) return;
      state.selected = { type: 'software', id };
      if (state.view !== 'map') setView('map', { keepSelection: true });
      render({ recenter: true });
    },
    selectConnection(id) {
      const c = db.connectionById.get(id);
      if (!c) return;
      state.selected = { type: 'connection', id };
      // Si la connexion est masquée par un filtre, on lève les filtres qui la cachent.
      state.kinds.add(c.kind);
      state.confs.add(c.confidence);
      state.cats.add(db.softwareById.get(c.source).category);
      state.cats.add(db.softwareById.get(c.target).category);
      if (state.format && !(c.formats || []).includes(state.format)) state.format = null;
      if (state.view !== 'map') setView('map', { keepSelection: true });
      render({ recenter: true });
    },
    clearSelection() {
      state.selected = null;
      render();
    },
    openFormat(id) {
      state.selected = null;
      setView('formats', { keepSelection: true });
      requestAnimationFrame(() => {
        const card = document.getElementById(`format-${id}`);
        card?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        card?.querySelector('h3')?.setAttribute('tabindex', '-1');
        card?.querySelector('h3')?.focus({ preventScroll: true });
      });
    },
    filterByFormat(id) {
      state.format = id;
      if (id) {
        state.selected = null;
        state.kinds = new Set(db.meta.kinds.map((k) => k.id));
        state.cats = new Set(db.meta.categories.map((c) => c.id));
        if (state.view !== 'map' && state.view !== 'list') setView('map', { keepSelection: true });
      }
      render({ refit: true });
    },
    toggleCategory(id) {
      toggle(state.cats, id);
      render({ refit: true });
    },
    toggleKind(id) {
      toggle(state.kinds, id);
      render();
    },
    toggleConfidence(id) {
      toggle(state.confs, id);
      render();
    },
    defaultConfs: new Set(DEFAULT_CONFS),
    resetFilters() {
      state.cats = new Set(db.meta.categories.map((c) => c.id));
      state.kinds = new Set(db.meta.kinds.map((k) => k.id));
      state.confs = new Set(DEFAULT_CONFS);
      state.format = null;
      state.query = '';
      render({ refit: true });
    },
    setQuery(q) {
      state.query = q;
      render();
    },
    layoutChanged() {
      requestAnimationFrame(() => graph?.resize());
    }
  };

  function toggle(set, id) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }

  /* ------------------------------------------------------------ vues */
  function setView(view, { keepSelection = false } = {}) {
    if (!VIEWS.includes(view)) view = 'map';
    state.view = view;
    if (!keepSelection) state.selected = null;
    for (const v of VIEWS) $(`view-${v}`).hidden = v !== view;
    for (const tab of document.querySelectorAll('.tab')) tab.setAttribute('aria-pressed', String(tab.dataset.view === view));
    document.body.dataset.view = view;
    $('controls').hidden = view === 'formats' || view === 'about';
    if (view === 'formats') renderFormats($('view-formats'), db, app);
    if (view === 'about') renderAbout($('view-about'), db);
    render({ refit: view === 'map' });
  }

  // Espace du bas de la carte occupé par le panneau (mobile) ou par l'encart « vue Liste ».
  let denseDismissed = false;
  function bottomInset() {
    if (!mobileQuery.matches) return 0;
    if (panel.isOpen()) return panel.height();
    return !denseDismissed && state.view === 'map' ? 56 : 0;
  }

  /* ------------------------------------------------------------ rendu */
  function render({ recenter = false, refit = false } = {}) {
    const matches = matchSet();

    controls.sync(state);

    // Panneau : n'est visible que sur la carte.
    if (state.view === 'map' && state.selected) {
      if (state.selected.type === 'software') panel.showSoftware(state.selected.id);
      else panel.showConnection(state.selected.id);
    } else {
      panel.hide();
    }

    graph.setFilters({ cats: state.cats, kinds: state.kinds, confs: state.confs, format: state.format });
    graph.setMatches(matches);
    if (state.selected && state.view === 'map') {
      graph.select(state.selected.type === 'software' ? 'node' : 'edge', state.selected.id);
    } else {
      graph.clearSelection();
    }

    if (state.view === 'list') renderList($('view-list'), db, { cats: state.cats, kinds: state.kinds, confs: state.confs, format: state.format, matches }, app);

    updateStatus(matches);
    updateHash();

    if (state.view === 'map') {
      requestAnimationFrame(() => {
        graph.resize();
        const inset = bottomInset();
        if (state.selected && recenter) {
          if (state.selected.type === 'software') graph.centerOn(state.selected.id, inset);
          else graph.centerOnEdge(state.selected.id, inset);
        } else if (refit) {
          graph.fit(bottomInset());
        }
      });
    }
  }

  function updateStatus(matches) {
    const el = $('status');
    const parts = [];
    if (state.format) {
      const f = db.formatById.get(state.format);
      const n = db.connsByFormat.get(state.format)?.length ?? 0;
      parts.push(`${f?.name ?? state.format} : ${n} liaison${n > 1 ? 's' : ''}`);
    }
    if (matches && state.query.trim()) parts.push(`${matches.size} logiciel${matches.size > 1 ? 's' : ''} trouvé${matches.size > 1 ? 's' : ''}`);
    const unsure = db.connections.filter((c) => !state.confs.has(c.confidence)).length;
    if (unsure) parts.push(`${unsure} liaison${unsure > 1 ? 's' : ''} incertaine${unsure > 1 ? 's' : ''} masquée${unsure > 1 ? 's' : ''}`);
    el.textContent = parts.join(' · ');
  }

  /* ------------------------------------------------------------ liens profonds */
  let hashLock = false;

  function updateHash() {
    const parts = [];
    if (state.view !== 'map') parts.push(`view=${state.view}`);
    if (state.selected) parts.push(`${state.selected.type === 'software' ? 'node' : 'edge'}=${encodeURIComponent(state.selected.id)}`);
    if (state.format && state.view !== 'formats') parts.push(`format=${encodeURIComponent(state.format)}`);
    const next = parts.length ? `#${parts.join('&')}` : '';
    if (next !== location.hash) {
      hashLock = true;
      history.replaceState(null, '', next || location.pathname + location.search);
      hashLock = false;
    }
  }

  function applyHash() {
    const params = new URLSearchParams(location.hash.replace(/^#/, ''));
    const view = params.get('view');
    const format = params.get('format');
    state.format = format && db.formatById.has(format) ? format : null;
    const node = params.get('node');
    const edge = params.get('edge');
    state.selected = null;
    if (node && db.softwareById.has(node)) state.selected = { type: 'software', id: node };
    else if (edge && db.connectionById.has(edge)) {
      state.selected = { type: 'connection', id: edge };
      // Une liaison ouverte par lien doit être visible, même si elle est incertaine ou d'un type filtré.
      const c = db.connectionById.get(edge);
      state.confs.add(c.confidence);
      state.kinds.add(c.kind);
    }
    setView(VIEWS.includes(view) ? view : 'map', { keepSelection: true });
    if (state.selected) render({ recenter: true });
  }

  /* ------------------------------------------------------------ initialisation */
  panel = createPanel({
    db,
    root: $('panel'),
    stage,
    body: $('panel-body'),
    kicker: $('panel-kicker'),
    closeBtn: $('panel-close'),
    actions: app
  });

  graph = createGraph($('graph'), db, {
    onNode: (id) => app.selectSoftware(id),
    onEdge: (id) => app.selectConnection(id),
    onBackground: () => { if (state.selected) app.clearSelection(); }
  });

  controls = initControls({
    db,
    app,
    els: {
      searchInput: $('search-input'),
      searchResults: $('search-results'),
      categoryChips: $('category-chips'),
      kindChips: $('kind-chips'),
      formatFilter: $('format-filter'),
      resetBtn: $('reset-filters'),
      toggleFilters: $('toggle-filters'),
      filters: $('filters'),
      confChips: $('conf-chips')
    }
  });

  for (const tab of document.querySelectorAll('.tab')) tab.addEventListener('click', () => setView(tab.dataset.view));
  document.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => setView(b.dataset.goto)));

  $('zoom-in').addEventListener('click', () => graph.zoomBy(1.35));
  $('zoom-out').addEventListener('click', () => graph.zoomBy(1 / 1.35));
  $('zoom-fit').addEventListener('click', () => graph.fit(bottomInset()));
  $('layout-toggle').addEventListener('click', () => {
    graph.toggleLayout();
    $('status').textContent = 'Nœuds remis en colonnes par catégorie';
  });
  $('help-toggle').addEventListener('click', () => {
    const help = $('bp-help');
    help.hidden = !help.hidden;
    $('help-toggle').setAttribute('aria-expanded', String(!help.hidden));
  });
  $('footer-disclaimer').textContent = db.meta.disclaimer;

  // Légende compacte superposée au graphe (masquable) et mode « graphe plein écran ».
  const LEGEND_KEY = 'imap.legend';
  const legend = $('bp-legend');
  $('bp-legend-body').append(
    ...db.meta.kinds.map((k) => h('li', { title: k.description }, kindSwatch(k, 'right'), h('span', { text: k.short }))),
    h('li', { class: 'legend-note' }, h('span', { class: 'legend-glyph', text: '⇄' }), h('span', { text: 'échange dans les deux sens' })),
    h('li', { class: 'legend-note' }, h('span', { class: 'legend-glyph', text: '→' }), h('span', { text: 'sortie (droite) vers entrée (gauche)' }))
  );
  // Seul un choix explicite est mémorisé ; sinon : visible sur grand écran, masquée sur téléphone.
  const setLegend = (show, remember = true) => {
    legend.hidden = !show;
    $('legend-toggle').setAttribute('aria-pressed', String(show));
    if (remember) try { localStorage.setItem(LEGEND_KEY, show ? '1' : '0'); } catch { /* stockage indisponible */ }
  };
  let legendPref = null;
  try { legendPref = localStorage.getItem(LEGEND_KEY); } catch { /* stockage indisponible */ }
  setLegend(legendPref ? legendPref === '1' : !mobileQuery.matches, false);
  $('legend-toggle').addEventListener('click', () => setLegend(legend.hidden));
  $('legend-close').addEventListener('click', () => setLegend(false));

  const setMaximized = (on) => {
    document.body.classList.toggle('graph-max', on);
    $('max-toggle').setAttribute('aria-pressed', String(on));
    $('max-toggle').setAttribute('aria-label', on ? 'Quitter le plein écran du graphe' : 'Graphe en plein écran');
    $('max-toggle').title = on ? 'Quitter le plein écran (Échap)' : 'Graphe en plein écran';
    $('max-toggle').textContent = on ? '⤡' : '⛶';
    requestAnimationFrame(() => { graph.resize(); graph.fit(bottomInset()); });
  };
  $('max-toggle').addEventListener('click', () => setMaximized(!document.body.classList.contains('graph-max')));

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.activeElement?.id === 'search-input') return;
    if (state.selected) app.clearSelection();
    else if (document.body.classList.contains('graph-max')) setMaximized(false);
  });
  window.addEventListener('hashchange', () => { if (!hashLock) applyHash(); });

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      graph.resize();
      if (graph.syncOrientation() && state.view === 'map') graph.fit(bottomInset());
      updateDenseHint();
    }, 120);
  };
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);

  function updateDenseHint() {
    $('dense-hint').hidden = denseDismissed || !(mobileQuery.matches && state.view === 'map');
  }
  $('dense-dismiss').addEventListener('click', () => {
    denseDismissed = true;
    updateDenseHint();
    graph.fit(bottomInset());
  });
  mobileQuery.addEventListener('change', updateDenseHint);

  applyHash();
  updateDenseHint();
  if (!state.selected) graph.fit(bottomInset());
  document.body.dataset.ready = 'true';
  if (new URLSearchParams(location.search).has('debug')) window.__imap = { graph, state, db };
}

// Toute erreur au démarrage (données absentes, fichiers obsolètes en cache…) affiche un message clair
// plutôt qu'une page à moitié construite.
function showFatal(err) {
  console.error(err);
  for (const v of VIEWS) { const el = $(`view-${v}`); if (el) el.hidden = v !== 'map'; }
  const view = $('view-map');
  view.textContent = '';
  const box = document.createElement('div');
  box.className = 'notice fatal';
  const title = document.createElement('p');
  title.className = 'fatal-title';
  title.textContent = 'La carte n’a pas pu démarrer.';
  const help = document.createElement('p');
  help.textContent = location.protocol === 'file:'
    ? 'La page est ouverte directement depuis un fichier : les navigateurs bloquent alors la lecture des fichiers JSON. Lancez un petit serveur local (npx serve . ou python -m http.server) ou publiez le site (GitHub Pages, Netlify, Vercel).'
    : 'Si le site vient d’être mis à jour, votre navigateur utilise peut-être d’anciens fichiers gardés en mémoire. Rechargez la page en vidant le cache (Ctrl+Maj+R sur ordinateur, ou fermez et rouvrez l’onglet sur téléphone).';
  const detail = document.createElement('p');
  detail.className = 'meta';
  detail.textContent = `Détail technique : ${err?.message || err}`;
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'btn';
  reload.textContent = 'Recharger la page';
  reload.addEventListener('click', () => location.reload());
  box.append(title, help, reload, detail);
  view.append(box);
}

start().catch(showFatal);
