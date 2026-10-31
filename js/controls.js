// Barre de recherche, filtres par catégorie et légende filtrante.
import { h, clear, kindSwatch, norm } from './util.js?v=20261031.14';

/** Recherche dans les logiciels et les formats. Renvoie aussi l'ensemble des logiciels concernés. */
export function searchDb(db, query) {
  const q = norm(query.trim());
  if (!q) return { software: [], formats: [], softwareIds: null };

  const score = (haystacks) => {
    let best = 0;
    for (const raw of haystacks) {
      const t = norm(raw);
      if (!t) continue;
      if (t === q) best = Math.max(best, 4);
      else if (t.startsWith(q)) best = Math.max(best, 3);
      else if (t.split(/[\s/._-]+/).some((w) => w.startsWith(q))) best = Math.max(best, 2);
      else if (t.includes(q)) best = Math.max(best, 1);
    }
    return best;
  };

  const software = db.software
    .map((s) => ({ item: s, score: score([s.name, s.id, s.vendor]) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((r) => r.item);

  const formats = db.formats
    .map((f) => ({ item: f, score: score([f.name, f.id, f.fullName, ...(f.extensions || [])]) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.item.name.localeCompare(b.item.name))
    .map((r) => r.item);

  const softwareIds = new Set(software.map((s) => s.id));
  for (const f of formats) {
    for (const s of db.software) if ((s.formats || []).includes(f.id)) softwareIds.add(s.id);
  }
  return { software, formats, softwareIds };
}

export function initControls({ db, els, app }) {
  const catButtons = new Map();
  const kindButtons = new Map();

  /* ---- chips de catégories ---- */
  clear(els.categoryChips);
  for (const cat of db.meta.categories) {
    const count = db.software.filter((s) => s.category === cat.id).length;
    const btn = h('button', {
      type: 'button', class: 'chip', 'aria-pressed': 'true',
      title: cat.description,
      onClick: () => app.toggleCategory(cat.id)
    },
      h('span', { class: 'dot', style: `background:${cat.color}` }),
      h('span', { class: 'chip-label', text: cat.label }),
      h('span', { class: 'count', text: String(count) })
    );
    catButtons.set(cat.id, btn);
    els.categoryChips.append(btn);
  }

  /* ---- chips de types de connexion (légende) ---- */
  clear(els.kindChips);
  const kindCounts = new Map(db.meta.kinds.map((k) => [k.id, db.connections.filter((c) => c.kind === k.id).length]));
  for (const kind of db.meta.kinds) {
    const btn = h('button', {
      type: 'button', class: 'chip', 'aria-pressed': 'true',
      title: kind.description,
      onClick: () => app.toggleKind(kind.id)
    },
      kindSwatch(kind, false),
      h('span', { class: 'chip-label', text: kind.short }),
      h('span', { class: 'count', text: String(kindCounts.get(kind.id)) })
    );
    kindButtons.set(kind.id, btn);
    els.kindChips.append(btn);
  }

  /* ---- chips de fiabilité (niveau de confiance) ---- */
  const confButtons = new Map();
  clear(els.confChips);
  for (const conf of db.meta.confidence) {
    const btn = h('button', {
      type: 'button', class: `chip conf-chip conf-${conf.id}`, 'aria-pressed': 'true',
      title: conf.description,
      onClick: () => app.toggleConfidence(conf.id)
    },
      h('span', { class: 'conf-mark', 'aria-hidden': 'true' }),
      h('span', { class: 'chip-label', text: conf.label }),
      h('span', { class: 'count', text: String(db.connections.filter((c) => c.confidence === conf.id).length) })
    );
    confButtons.set(conf.id, btn);
    els.confChips.append(btn);
  }

  els.resetBtn.addEventListener('click', () => app.resetFilters());

  // Légende et filtres repliés par défaut pour laisser la place au graphe ; le choix est mémorisé.
  const FILTERS_KEY = 'imap.filtersOpen';
  const setFiltersOpen = (open) => {
    els.filters.classList.toggle('open', open);
    els.toggleFilters.setAttribute('aria-expanded', String(open));
    try { localStorage.setItem(FILTERS_KEY, open ? '1' : '0'); } catch { /* stockage indisponible */ }
    app.layoutChanged();
  };
  let initiallyOpen = false;
  try { initiallyOpen = localStorage.getItem(FILTERS_KEY) === '1'; } catch { /* stockage indisponible */ }
  els.filters.classList.toggle('open', initiallyOpen);
  els.toggleFilters.setAttribute('aria-expanded', String(initiallyOpen));
  els.toggleFilters.addEventListener('click', () => setFiltersOpen(!els.filters.classList.contains('open')));

  /* ---- recherche ---- */
  const input = els.searchInput;
  const results = els.searchResults;
  let options = [];
  let active = -1;

  function closeResults() {
    results.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }

  function setActive(index) {
    active = index;
    options.forEach((o, i) => o.el.setAttribute('aria-selected', String(i === index)));
    if (index >= 0) {
      input.setAttribute('aria-activedescendant', options[index].el.id);
      options[index].el.scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  }

  function choose(option) {
    closeResults();
    if (option.type === 'software') {
      input.value = '';
      app.setQuery('');
      app.selectSoftware(option.id);
    } else {
      input.value = '';
      app.setQuery('');
      app.filterByFormat(option.id);
    }
    input.blur();
  }

  function renderResults() {
    const found = searchDb(db, input.value);
    clear(results);
    options = [];
    if (!input.value.trim()) { closeResults(); return; }

    const addGroup = (label, items, type) => {
      if (!items.length) return;
      results.append(h('li', { class: 'group-label', role: 'presentation', text: label }));
      for (const item of items.slice(0, 8)) {
        const cat = type === 'software' ? db.catById.get(item.category) : null;
        const el = h('button', {
          type: 'button', role: 'option', id: `opt-${type}-${item.id}`, 'aria-selected': 'false', tabindex: '-1',
          onClick: () => choose({ type, id: item.id })
        },
          cat ? h('span', { class: 'dot', style: `background:${cat.color};width:12px;height:12px;border-radius:50%;flex-shrink:0` }) : null,
          h('span', {},
            h('span', { text: item.name }),
            h('span', { class: 'sub', text: type === 'software' ? ` — ${item.vendor}` : ` — ${item.fullName}` })
          )
        );
        results.append(h('li', { role: 'presentation' }, el));
        options.push({ type, id: item.id, el });
      }
    };
    addGroup('Logiciels', found.software, 'software');
    addGroup('Formats', found.formats, 'format');

    if (!options.length) results.append(h('li', { class: 'search-empty', role: 'presentation', text: 'Aucun résultat dans cette base.' }));
    results.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    active = -1;
  }

  input.addEventListener('input', () => {
    app.setQuery(input.value);
    renderResults();
  });
  input.addEventListener('focus', () => { if (input.value.trim()) renderResults(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (results.hidden) renderResults();
      if (options.length) setActive((active + 1) % options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (options.length) setActive((active - 1 + options.length) % options.length);
    } else if (e.key === 'Enter') {
      const pick = active >= 0 ? options[active] : options[0];
      if (pick) { e.preventDefault(); choose(pick); }
    } else if (e.key === 'Escape') {
      if (!results.hidden) closeResults();
      else if (input.value) { input.value = ''; app.setQuery(''); }
    }
  });
  document.addEventListener('click', (e) => {
    if (!els.searchInput.parentElement.contains(e.target)) closeResults();
  });
  input.addEventListener('search', () => { app.setQuery(input.value); renderResults(); });

  return {
    sync(state) {
      for (const [id, btn] of catButtons) btn.setAttribute('aria-pressed', String(state.cats.has(id)));
      for (const [id, btn] of kindButtons) btn.setAttribute('aria-pressed', String(state.kinds.has(id)));
      for (const [id, btn] of confButtons) btn.setAttribute('aria-pressed', String(state.confs.has(id)));
      // compteurs recalculés : la base affichée peut contenir les ajouts personnels du visiteur
      const setCount = (btn, n) => { btn.querySelector('.count').textContent = String(n); };
      for (const [id, btn] of catButtons) setCount(btn, db.software.filter((s) => s.category === id).length);
      for (const [id, btn] of kindButtons) setCount(btn, db.connections.filter((c) => c.kind === id).length);
      for (const [id, btn] of confButtons) setCount(btn, db.connections.filter((c) => !c.user && c.confidence === id).length);

      const allCats = state.cats.size === db.meta.categories.length;
      const allKinds = state.kinds.size === db.meta.kinds.length;
      const defaultConfs = state.confs.size === app.defaultConfs.size && [...app.defaultConfs].every((c) => state.confs.has(c));
      els.resetBtn.hidden = allCats && allKinds && defaultConfs && !state.format && !state.query;

      // Nombre de filtres actifs, rappelé sur le bouton quand le panneau est replié.
      const active = (allCats ? 0 : 1) + (allKinds ? 0 : 1) + (state.format ? 1 : 0);
      els.toggleFilters.dataset.badge = active ? String(active) : '';

      clear(els.formatFilter);
      if (state.format) {
        const f = db.formatById.get(state.format);
        els.formatFilter.append(
          `Format : ${f?.name ?? state.format} `,
          h('button', {
            type: 'button', class: 'link-btn', style: 'color:inherit', 'aria-label': 'Retirer le filtre de format',
            onClick: () => app.filterByFormat(null)
          }, '×')
        );
        els.formatFilter.hidden = false;
      } else {
        els.formatFilter.hidden = true;
      }
      if (input.value !== state.query && document.activeElement !== input) input.value = state.query;
    }
  };
}
