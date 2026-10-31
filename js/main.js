// Point d'entrée : état de l'application, navigation entre vues, liens profonds (#view=…&node=…),
// espace de travail personnel (ajouts du visiteur) et mode édition.
import { loadBase, buildDb } from './data.js?v=20261031.10';
import { createGraph } from './graph.js?v=20261031.10';
import { createPanel } from './panel.js?v=20261031.10';
import { initControls, searchDb } from './controls.js?v=20261031.10';
import { renderList, renderFormats, renderAbout } from './pages.js?v=20261031.10';
import { h, kindSwatch, formatDate } from './util.js?v=20261031.10';
import { loadWorkspace, saveWorkspace, mergeWorkspace } from './workspace.js?v=20261031.10';
import { createEditor } from './editor.js?v=20261031.10';

const $ = (id) => document.getElementById(id);
const VIEWS = ['map', 'list', 'formats', 'about'];
const mobileQuery = window.matchMedia('(max-width: 760px)');
// Par défaut, seules les liaisons documentées par un éditeur sont affichées (confiance élevée ou moyenne) ;
// les liaisons incertaines (forums, déductions, non vérifiées) se réaffichent par le filtre « Fiabilité ».
const DEFAULT_CONFS = ['high', 'medium'];

async function start() {
  const base = await loadBase();
  let ws = loadWorkspace(base.meta);
  // `db` garde la même identité : les modules qui la référencent voient les ajouts après chaque reconstruction.
  const db = buildDb(mergeWorkspace(base, ws));
  const rebuildDb = () => Object.assign(db, buildDb(mergeWorkspace(base, ws)));

  const state = {
    view: 'map',
    cats: new Set(db.meta.categories.map((c) => c.id)),
    kinds: new Set(db.meta.kinds.map((k) => k.id)),
    confs: new Set(DEFAULT_CONFS),
    format: null,
    query: '',
    edit: false,
    selected: null // { type: 'software' | 'connection' | 'block', id }
  };

  const stage = $('main');
  let graph = null;
  let controls = null;
  let panel = null;
  let editor = null;

  const matchSet = () => (state.query.trim() ? searchDb(db, state.query).softwareIds : null);

  /* ------------------------------------------------------------ messages */
  let toastTimer;
  function toast(message) {
    const el = $('toast');
    el.textContent = message;
    el.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { el.hidden = true; }, 4000);
  }

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
      revealConnection(c);
      if (state.format && !(c.formats || []).includes(state.format)) state.format = null;
      if (state.view !== 'map') setView('map', { keepSelection: true });
      render({ recenter: true });
    },
    selectBlock(id) {
      if (!ws.blocks.some((b) => b.id === id)) return;
      state.selected = { type: 'block', id };
      if (state.view !== 'map') setView('map', { keepSelection: true });
      render();
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
    },
    // édition
    isEditing: () => state.edit,
    editItem: (sel) => editor.edit(sel),
    deleteItem: (sel) => editor.remove(sel),
    linkFrom: (id) => editor.connectionForm({ source: id })
  };

  // Une liaison ouverte doit être visible : on lève les filtres qui la cachent (sauf ajouts personnels, toujours visibles).
  function revealConnection(c) {
    state.kinds.add(c.kind);
    if (!c.user) state.confs.add(c.confidence);
    state.cats.add(db.softwareById.get(c.source).category);
    state.cats.add(db.softwareById.get(c.target).category);
  }

  function toggle(set, id) {
    if (set.has(id)) set.delete(id);
    else set.add(id);
  }

  /* ------------------------------------------------------------ espace de travail */
  const graphCallbacks = {
    onNode: (id) => app.selectSoftware(id),
    onEdge: (id) => app.selectConnection(id),
    onBlock: (id) => app.selectBlock(id),
    onBackground: () => { if (state.selected) app.clearSelection(); },
    onNodesMoved(moved) {
      Object.assign(ws.positions, moved);
      persist();
    },
    onBlockChange(block) {
      const b = ws.blocks.find((x) => x.id === block.id);
      if (b) Object.assign(b, { x: block.x, y: block.y, w: block.w, h: block.h });
      persist();
    },
    onLink: (from, to) => editor.connectionForm({ source: from, target: to })
  };

  function mountGraph() {
    const view = graph?.getView();
    graph?.destroy();
    graph = createGraph($('graph'), db, graphCallbacks, { positions: ws.positions, blocks: ws.blocks, view, editMode: state.edit });
    if (window.__imap) window.__imap.graph = graph;
  }

  function persist() {
    if (!saveWorkspace(ws)) toast('Stockage du navigateur indisponible : vos modifications seront perdues en quittant la page. Exportez-les pour les garder.');
    updateWsCount();
  }

  /** Applique un nouvel espace de travail : enregistre, reconstruit la base fusionnée et le graphe. */
  function commit(next, { select = null, message = '' } = {}) {
    ws = next;
    persist();
    rebuildDb();
    mountGraph();
    const exists = (sel) => sel && (sel.type === 'software' ? db.softwareById.has(sel.id)
      : sel.type === 'connection' ? db.connectionById.has(sel.id) : ws.blocks.some((b) => b.id === sel.id));
    state.selected = exists(select) ? select : (exists(state.selected) ? state.selected : null);
    if (state.selected?.type === 'connection') revealConnection(db.connectionById.get(state.selected.id));
    if (state.view !== 'map' && state.view !== 'list') setView('map', { keepSelection: true });
    else render({ recenter: state.selected?.type === 'connection' });
    if (state.view === 'formats' || state.view === 'about') renderPage();
    if (message) toast(message);
  }

  function updateWsCount() {
    const n = ws.nodes.length + ws.connections.length + ws.blocks.length;
    $('ws-count').hidden = !n;
    $('ws-count').textContent = String(n);
    $('ws-count').title = `${n} ajout${n > 1 ? 's' : ''} personnel${n > 1 ? 's' : ''}`;
  }

  function setEditMode(on) {
    state.edit = on;
    document.body.classList.toggle('editing', on);
    $('edit-toggle').setAttribute('aria-pressed', String(on));
    $('edit-bar').hidden = !on;
    graph.setEditMode(on);
    if (on && state.view !== 'map') setView('map', { keepSelection: true });
    else render();
    app.layoutChanged();
    toast(on ? 'Mode édition : ajoutez des logiciels, des liaisons ou des blocs. Tirez le port ➜ d’un nœud vers un autre pour les relier.' : 'Mode édition désactivé.');
  }

  /* ------------------------------------------------------------ vues */
  function renderPage() {
    if (state.view === 'formats') renderFormats($('view-formats'), db, app);
    if (state.view === 'about') renderAbout($('view-about'), db);
  }

  function setView(view, { keepSelection = false } = {}) {
    if (!VIEWS.includes(view)) view = 'map';
    state.view = view;
    if (!keepSelection) state.selected = null;
    for (const v of VIEWS) $(`view-${v}`).hidden = v !== view;
    for (const tab of document.querySelectorAll('.tab')) tab.setAttribute('aria-pressed', String(tab.dataset.view === view));
    document.body.dataset.view = view;
    closeSidebar();
    renderPage();
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
    const sel = state.selected;
    if (state.view === 'map' && sel) {
      if (sel.type === 'software') panel.showSoftware(sel.id);
      else if (sel.type === 'connection') panel.showConnection(sel.id);
      else panel.showBlock(ws.blocks.find((b) => b.id === sel.id));
    } else {
      panel.hide();
    }

    graph.setFilters({ cats: state.cats, kinds: state.kinds, confs: state.confs, format: state.format });
    graph.setMatches(matches);
    if (sel && state.view === 'map') {
      graph.select({ software: 'node', connection: 'edge', block: 'block' }[sel.type], sel.id);
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
        if (sel && recenter && sel.type !== 'block') {
          if (sel.type === 'software') graph.centerOn(sel.id, inset);
          else graph.centerOnEdge(sel.id, inset);
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
    const unsure = db.connections.filter((c) => !c.user && !state.confs.has(c.confidence)).length;
    if (unsure) parts.push(`${unsure} liaison${unsure > 1 ? 's' : ''} incertaine${unsure > 1 ? 's' : ''} masquée${unsure > 1 ? 's' : ''}`);
    el.textContent = parts.join(' · ');
    el.classList.toggle('is-warning', unsure > 0);
  }

  /* ------------------------------------------------------------ liens profonds */
  let hashLock = false;

  function updateHash() {
    const parts = [];
    if (state.view !== 'map') parts.push(`view=${state.view}`);
    const sel = state.selected;
    if (sel && sel.type !== 'block') parts.push(`${sel.type === 'software' ? 'node' : 'edge'}=${encodeURIComponent(sel.id)}`);
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
      revealConnection(db.connectionById.get(edge));
    }
    setView(VIEWS.includes(view) ? view : 'map', { keepSelection: true });
    if (state.selected) render({ recenter: true });
  }

  /* ------------------------------------------------------------ barre latérale (mobile) */
  function closeSidebar() {
    document.body.classList.remove('sb-open');
    $('sb-backdrop').hidden = true;
    $('sb-open').setAttribute('aria-expanded', 'false');
  }
  $('sb-open').addEventListener('click', () => {
    const open = !document.body.classList.contains('sb-open');
    document.body.classList.toggle('sb-open', open);
    $('sb-backdrop').hidden = !open;
    $('sb-open').setAttribute('aria-expanded', String(open));
  });
  $('sb-backdrop').addEventListener('click', closeSidebar);

  // Menu réduit en rail d'icônes (grand écran) : choix mémorisé.
  const MINI_KEY = 'imap.sidebarMini';
  const setMini = (on, remember = true) => {
    document.body.classList.toggle('sb-mini', on);
    $('sb-collapse').setAttribute('aria-pressed', String(on));
    $('sb-collapse').setAttribute('aria-label', on ? 'Développer le menu' : 'Réduire le menu');
    $('sb-collapse').title = on ? 'Développer le menu' : 'Réduire le menu';
    if (remember) try { localStorage.setItem(MINI_KEY, on ? '1' : '0'); } catch { /* stockage indisponible */ }
  };
  let miniPref = null;
  try { miniPref = localStorage.getItem(MINI_KEY); } catch { /* stockage indisponible */ }
  setMini(miniPref === '1', false);
  $('sb-collapse').addEventListener('click', () => {
    setMini(!document.body.classList.contains('sb-mini'));
    requestAnimationFrame(() => { graph?.resize(); if (state.view === 'map') graph?.fit(bottomInset()); });
  });

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

  mountGraph();

  editor = createEditor({
    db,
    dialog: $('editor-dialog'),
    getWs: () => ws,
    commit,
    viewCenter: () => graph.viewCenter(),
    toast
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
    ws.positions = {};
    persist();
    toast('Nœuds remis en colonnes par catégorie.');
  });
  $('help-toggle').addEventListener('click', () => {
    const help = $('bp-help');
    help.hidden = !help.hidden;
    $('help-toggle').setAttribute('aria-expanded', String(!help.hidden));
  });
  $('footer-disclaimer').textContent = db.meta.disclaimer;
  $('sb-foot').textContent = `Base vérifiée : revue du ${formatDate(db.meta.lastReview)}`;

  // Édition
  $('edit-toggle').addEventListener('click', () => { closeSidebar(); setEditMode(!state.edit); });
  $('add-node').addEventListener('click', () => editor.nodeForm());
  $('add-link').addEventListener('click', () => editor.connectionForm({ source: state.selected?.type === 'software' ? state.selected.id : undefined }));
  $('add-block').addEventListener('click', () => editor.blockForm());
  $('ws-export').addEventListener('click', () => { closeSidebar(); editor.exportAll(); });
  $('ws-import').addEventListener('click', () => { closeSidebar(); $('import-file').click(); });
  $('import-file').addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) editor.importFile(file);
  });
  $('ws-reset').addEventListener('click', () => { closeSidebar(); editor.resetAll(); });
  updateWsCount();

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
    const typing = e.target.closest?.('input, textarea, select, dialog');
    if (typing) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.edit && editor.isOwn(state.selected)) {
      e.preventDefault();
      editor.remove(state.selected);
      return;
    }
    if (e.key !== 'Escape') return;
    if (document.body.classList.contains('sb-open')) closeSidebar();
    else if (state.selected) app.clearSelection();
    else if (document.body.classList.contains('graph-max')) setMaximized(false);
  });
  window.addEventListener('hashchange', () => { if (!hashLock) applyHash(); });

  let resizeTimer;
  const onResize = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      graph.resize();
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
  if (new URLSearchParams(location.search).has('debug')) window.__imap = { graph, state, db, getWs: () => ws };
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
