// Base documentaire : catalogue, fiche technique (sections A à L), comparateur, section Madagascar.
// Règle d'affichage : une information absente des données s'affiche « Non documenté », jamais une valeur supposée.
import { h, clear, formatDate, hostOf, plural, kindSwatch, norm } from './util.js?v=20261031.14';
import { loadProfile } from './data.js?v=20261031.14';

const MAX_COMPARE = 4;
const ELEMENTS = { beam: 'Poutres', column: 'Poteaux', truss: 'Barres', cable: 'Câbles', plate: 'Plaques', shell: 'Coques', solid: 'Solides', foundation: 'Fondations', complex: 'Structures complexes' };
const RESULTS = { displacements: 'Déplacements', rotations: 'Rotations', reactions: 'Réactions d’appui', axial: 'Efforts normaux', shear: 'Efforts tranchants', moments: 'Moments fléchissants', stresses: 'Contraintes', strains: 'Déformations', modes: 'Modes propres', frequencies: 'Fréquences', nonlinear: 'Résultats non linéaires' };
const LIMIT_KINDS = { technique: 'Technique', numerique: 'Numérique', modelisation: 'Modélisation', convergence: 'Convergence', post: 'Post-traitement', personnalisation: 'Personnalisation', dependance: 'Dépendance externe' };
const NEEDS = { software: 'Un autre logiciel', module: 'Un module supplémentaire', api: 'Une API', script: 'Un script', manual: 'Une intervention manuelle' };
const CANNOT_KIND = { absent: 'Fonction absente', limitation: 'Limitation', extension: 'Possible par extension' };
const EVIDENCE = { read: 'page lue', excerpt: 'lue par extrait', community: 'source communautaire' };
const REF_TYPES = { officiel: 'Documentation officielle', manuel: 'Manuel technique', article: 'Article scientifique', validation: 'Guide de validation', tiers: 'Source tierce' };
// Logiciels et formats dont la mission demande de préciser la liaison.
const TARGETS = [['revit', 'Revit'], ['autocad', 'AutoCAD'], ['archicad', 'ArchiCAD'], ['tekla', 'Tekla Structures'], ['gmsh', 'Gmsh'], ['opensees', 'OpenSees']];
const TEXT_TARGETS = ['Excel', 'Python', 'MATLAB'];

const unknown = () => h('span', { class: 'st st-unknown', text: 'Non documenté' });
const licenseGroup = (s) => (/^commerciale|inclus/i.test(s.license || '') ? 'commercial' : /libre|domaine public|gratuit/i.test(s.license || '') ? 'free' : 'unknown');
const LICENSE_LABEL = { commercial: 'Commerciale', free: 'Libre ou gratuite', unknown: 'Non précisée' };

function sheetBadge(kb, id) {
  return kb.profileIds.has(id)
    ? h('span', { class: 'badge conf-high', text: 'Fiche détaillée' })
    : h('span', { class: 'badge', text: 'Identification seule' });
}

/* ------------------------------------------------------------------ Catalogue */

const catalogFilters = { q: '', domain: 'all', license: 'all', sheet: 'all' };

export function renderCatalog(root, db, kb, actions) {
  clear(root);
  const grid = h('div', {});
  const count = h('span', { class: 'pill' });

  const domainBtns = [{ id: 'all', short: 'Tous' }, ...db.meta.domains].map((d) => h('button', {
    type: 'button', class: 'chip chip-radio', 'aria-pressed': String(catalogFilters.domain === d.id), dataset: { id: d.id },
    onClick: () => { catalogFilters.domain = d.id; syncChips(); update(); }
  }, h('span', { class: 'chip-label', text: d.short })));
  const syncChips = () => domainBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === catalogFilters.domain)));

  const select = (key, options) => {
    const el = h('select', { class: 'input select-inline', 'aria-label': options[0][1], onChange: (e) => { catalogFilters[key] = e.target.value; update(); } },
      options.map(([v, label]) => h('option', { value: v, text: label })));
    el.value = catalogFilters[key];
    return el;
  };

  function update() {
    clear(grid);
    const q = norm(catalogFilters.q.trim());
    const items = db.software.filter((s) => !s.user
      && (catalogFilters.domain === 'all' || s.domain === catalogFilters.domain)
      && (catalogFilters.license === 'all' || licenseGroup(s) === catalogFilters.license)
      && (catalogFilters.sheet === 'all' || (catalogFilters.sheet === 'detailed') === kb.profileIds.has(s.id))
      && (!q || norm(`${s.name} ${s.vendor} ${s.description}`).includes(q)));
    count.textContent = plural(items.length, 'logiciel', 'logiciels');
    for (const d of db.meta.domains) {
      const list = items.filter((s) => s.domain === d.id);
      if (!list.length) continue;
      grid.append(h('h3', { class: 'group-title', text: d.label }), h('div', { class: 'cat-grid' }, list.map((s) => softwareCard(s))));
    }
    if (!items.length) grid.append(h('p', { class: 'empty', text: 'Aucun logiciel ne correspond à ces critères.' }));
  }

  function softwareCard(s) {
    const links = (db.connsBySoftware.get(s.id) || []).length;
    const selected = actions.compareIds().includes(s.id);
    return h('article', { class: 'sw-card card' },
      h('button', { type: 'button', class: 'cell-link sw-card-name', onClick: () => actions.openSheet(s.id) }, s.name),
      h('p', { class: 'meta', text: s.vendor }),
      h('p', { class: 'sw-card-desc', text: s.description }),
      h('div', { class: 'badges' }, sheetBadge(kb, s.id), h('span', { class: 'badge', text: LICENSE_LABEL[licenseGroup(s)] }),
        links ? h('span', { class: 'badge', text: plural(links, 'liaison', 'liaisons') }) : null),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: selected, onChange: (e) => { if (!actions.toggleCompare(s.id, e.target.checked)) e.target.checked = false; } }),
        h('span', { text: 'Comparer' })));
  }

  root.append(h('div', { class: 'page page-wide' },
    h('h2', { class: 'section-title', text: 'Catalogue des logiciels' }),
    h('p', { class: 'lead', text: 'Logiciels de génie civil par domaine. La présence dans ce catalogue ne dit rien de leur diffusion ni de leur usage réel, à Madagascar comme ailleurs.' }),
    h('section', { class: 'card card-pad toolbar-card' },
      h('div', { class: 'toolbar-row' },
        h('input', { class: 'input', type: 'search', placeholder: 'Filtrer par nom, éditeur…', 'aria-label': 'Filtrer le catalogue', value: catalogFilters.q, onInput: (e) => { catalogFilters.q = e.target.value; update(); } }),
        select('license', [['all', 'Toutes les licences'], ['commercial', 'Commerciale'], ['free', 'Libre ou gratuite'], ['unknown', 'Non précisée']]),
        select('sheet', [['all', 'Toutes les fiches'], ['detailed', 'Fiches détaillées'], ['id', 'Identification seule']]),
        count),
      h('div', { class: 'chips' }, domainBtns)),
    grid));
  update();
}

/* ------------------------------------------------------------------ Fiche technique */

function citer(kb, order) {
  // Numérote les références dans l'ordre d'apparition sur la fiche.
  return (refs) => (refs || []).filter((id) => kb.references.has(id)).map((id) => {
    if (!order.includes(id)) order.push(id);
    const r = kb.references.get(id);
    return h('a', { class: 'cite', href: r.url, target: '_blank', rel: 'noopener noreferrer', title: `${r.title} — ${r.publisher}` }, `[${order.indexOf(id) + 1}]`);
  });
}

function section(letter, title, hasContent, ...children) {
  return h('details', { class: 'ue-section sheet-section', open: hasContent ? true : null },
    h('summary', {}, h('span', { class: 'sec-letter', text: letter }), title, hasContent ? null : h('span', { class: 'st st-unknown sec-empty', text: 'Non documenté' })),
    h('div', { class: 'ue-section-body' }, children));
}

export async function renderSheet(root, id, db, kb, actions) {
  clear(root);
  const s = db.softwareById.get(id);
  if (!s) { root.append(h('p', { class: 'empty', text: 'Logiciel introuvable.' })); return; }
  const p = await loadProfile(kb, id);
  const order = [];
  const cite = citer(kb, order);
  const list = (items) => h('ul', { class: 'plain' }, items.map((i) => h('li', {}, i.text, ' ', cite(i.refs))));

  const claimCell = (c) => {
    if (!c) return unknown();
    if (c.v === 'na') return h('span', {}, h('span', { class: 'st st-na', text: 'Sans objet' }), c.note ? h('span', { class: 'meta', text: ` ${c.note}` }) : null);
    return h('span', {}, h('span', { class: 'st st-ok', text: 'Confirmé' }), c.note ? ` ${c.note} ` : ' ', cite(c.refs));
  };
  const claimTable = (rows) => h('table', { class: 'kv-table' }, h('tbody', {}, rows.map(([label, c]) => h('tr', {}, h('th', { scope: 'row', text: label }), h('td', {}, claimCell(c))))));
  const textOr = (x) => (x ? h('span', {}, x.text, ' ', cite(x.refs)) : unknown());

  /* A. Identification */
  const secA = section('A', 'Identification générale', true, h('table', { class: 'kv-table' }, h('tbody', {},
    [['Nom', s.name], ['Éditeur', s.vendor], ['Version étudiée', textOr(p?.version)],
      ['Site officiel', h('a', { href: s.website, target: '_blank', rel: 'noopener noreferrer' }, `${hostOf(s.website)} ↗`)],
      ['Licence et distribution', p?.license ? textOr(p.license) : h('span', {}, s.license, h('span', { class: 'meta', text: ' (information générale, non détaillée)' }))],
      ['Domaine d’application', p?.applicationDomain ? textOr(p.applicationDomain) : (db.meta.domains.find((d) => d.id === s.domain)?.label ?? '')]]
      .map(([k, v]) => h('tr', {}, h('th', { scope: 'row', text: k }), h('td', {}, v))))));

  /* B. Spécialités */
  const sp = p?.specialties || {};
  const spGroups = [['Types de structures et d’objets traités', sp.structures], ['Domaines d’utilisation', sp.uses], ['Matériaux pris en charge', sp.materials], ['Cas particuliers', sp.cases]];
  const hasB = spGroups.some(([, v]) => v?.length);
  const secB = section('B', 'Spécialités', hasB, spGroups.map(([label, v]) => h('div', { class: 'sub-block' }, h('h4', { text: label }), v?.length ? list(v) : unknown())));

  /* C. Méthodes */
  const hasC = Boolean(p && (Object.keys(p.methods || {}).length || p.otherMethods?.length));
  const secC = section('C', 'Méthodes de calcul', hasC,
    claimTable(kb.methods.map((m) => [m.label, p?.methods?.[m.id]])),
    p?.otherMethods?.length ? h('div', { class: 'sub-block' }, h('h4', { text: 'Autres méthodes disponibles' }), list(p.otherMethods)) : null);

  /* D. Normes */
  const secD = section('D', 'Normes', Boolean(p?.standards?.length || p?.standardsNote),
    p?.standardsNote ? h('p', {}, p.standardsNote.text, ' ', cite(p.standardsNote.refs)) : null,
    h('table', { class: 'kv-table' }, h('tbody', {}, kb.standards.map((f) => {
      const items = (p?.standards || []).filter((x) => x.family === f.id);
      return h('tr', {}, h('th', { scope: 'row', title: f.description, text: f.label }), h('td', {}, items.length ? list(items) : unknown()));
    }))));

  /* E. Modélisation */
  const m = p?.modelling || {};
  const hasE = Boolean(m.dims || m.objects?.length || Object.keys(m.elements || {}).length);
  const secE = section('E', 'Modélisation', hasE,
    claimTable([['Dimensions', m.dims], ...Object.entries(ELEMENTS).map(([k, label]) => [label, m.elements?.[k]])]),
    m.objects?.length ? h('div', { class: 'sub-block' }, h('h4', { text: 'Objets modélisés' }), list(m.objects)) : null);

  /* F. Résultats */
  const hasF = Boolean(p && (Object.keys(p.results || {}).length || p.otherResults?.length));
  const secF = section('F', 'Résultats', hasF,
    claimTable(Object.entries(RESULTS).map(([k, label]) => [label, p?.results?.[k]])),
    p?.otherResults?.length ? h('div', { class: 'sub-block' }, h('h4', { text: 'Autres résultats' }), list(p.otherResults)) : null);

  /* G. Limites */
  const limits = p?.limits || [];
  const secG = section('G', 'Limites et faiblesses', limits.length > 0,
    limits.length ? h('ul', { class: 'plain' }, limits.map((l) => h('li', {}, h('span', { class: 'badge', text: LIMIT_KINDS[l.kind] ?? l.kind }), ' ', l.text, ' ', cite(l.refs)))) : null,
    h('p', { class: 'meta', text: 'Seules les limites confirmées par une source sont listées. L’absence d’une limite ici ne prouve pas qu’elle n’existe pas.' }));

  /* H. Interopérabilité : lue dans la base des liaisons, sans duplication */
  const conns = db.connsBySoftware.get(id) || [];
  const extra = p?.interop || [];
  const modeOf = (c) => (c.kind === 'native' ? 'Directe' : c.kind === 'extension' ? 'Par plug-in ou API' : c.kind === 'conditional' ? 'Non vérifiée' : 'Indirecte (fichier)');
  const interopRows = conns.map((c) => {
    const other = db.softwareById.get(c.source === id ? c.target : c.source);
    const kind = db.kindById.get(c.kind);
    return h('tr', {},
      h('td', {}, h('button', { type: 'button', class: 'cell-link', onClick: () => actions.selectConnection(c.id) }, `${c.direction === 'bi' ? '⇄' : c.source === id ? '→' : '←'} ${other.name}`)),
      h('td', {}, h('span', { class: 'cell-kind' }, kindSwatch(kind, c.direction === 'bi' ? 'both' : 'right'), modeOf(c))),
      h('td', { class: 'meta', text: (c.formats || []).map((f) => db.formatById.get(f)?.name ?? f).join(', ') || '—' }),
      h('td', { text: (c.transfers || [])[0] ?? '' }),
      h('td', { text: (c.limitations || [])[0] ?? '' }),
      h('td', {}, h('span', { class: `badge conf-${c.confidence}`, text: c.user ? 'Ajout personnel' : db.confById.get(c.confidence)?.label })));
  });
  const haystack = extra.map((e) => e.target).join(' ');
  const missing = [
    ...TARGETS.filter(([tid]) => tid !== id && !conns.some((c) => c.source === tid || c.target === tid)).map(([, label]) => label),
    ...TEXT_TARGETS.filter((t) => !haystack.includes(t)),
    ...(conns.some((c) => (c.formats || []).includes('ifc')) ? [] : ['IFC'])
  ];
  const secH = section('H', 'Interopérabilité', conns.length + extra.length > 0,
    interopRows.length ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
      h('thead', {}, h('tr', {}, ['Liaison', 'Mode', 'Formats', 'Données', 'Risques et limites', 'Fiabilité'].map((c) => h('th', { scope: 'col', text: c })))),
      h('tbody', {}, interopRows))) : null,
    extra.length ? h('div', { class: 'sub-block' }, h('h4', { text: 'Autres possibilités documentées' }), h('ul', { class: 'plain' }, extra.map((e) =>
      h('li', {}, h('b', { text: `${e.target} ` }), `(${e.via}) : ${e.data}`, ' ', cite(e.refs))))) : null,
    missing.length ? h('p', { class: 'meta', text: `Aucune liaison documentée ici avec : ${missing.join(', ')}. Cela ne prouve pas qu’elle n’existe pas.` }) : null);

  /* I. Ce que le logiciel ne fait pas directement */
  const cannot = p?.cannotDo || [];
  const secI = section('I', 'Ce que le logiciel ne peut pas faire directement', cannot.length > 0,
    cannot.length ? h('ul', { class: 'plain' }, cannot.map((c) => h('li', {}, h('span', { class: 'badge', text: CANNOT_KIND[c.kind] ?? c.kind }), ' ', c.text, ' → ', h('b', { text: NEEDS[c.needs] ?? c.needs }), ' ', cite(c.refs)))) : null);

  /* J. Points forts et faibles */
  const nature = (i) => h('li', {}, h('span', { class: `st ${i.nature === 'fait' ? 'st-ok' : 'st-opinion'}`, text: i.nature === 'fait' ? 'Fait' : 'Appréciation' }), ' ', i.text, ' ', cite(i.refs));
  const secJ = section('J', 'Points forts et points faibles', Boolean(p?.strengths?.length || p?.weaknesses?.length),
    h('div', { class: 'sub-block' }, h('h4', { text: 'Points forts' }), p?.strengths?.length ? h('ul', { class: 'plain' }, p.strengths.map(nature)) : unknown()),
    h('div', { class: 'sub-block' }, h('h4', { text: 'Points faibles' }), p?.weaknesses?.length ? h('ul', { class: 'plain' }, p.weaknesses.map(nature)) : unknown()));

  /* K. Améliorations */
  const secK = section('K', 'Améliorations possibles', Boolean(p?.improvements?.length),
    p?.improvements?.length ? h('ul', { class: 'plain' }, p.improvements.map(nature)) : null);

  /* L. Sources (après les autres sections : la numérotation y est complète) */
  const connSources = conns.flatMap((c) => c.sources || []);
  const uniqueConn = [...new Map(connSources.map((x) => [x.url, x])).values()];
  const secL = section('L', 'Sources', order.length + uniqueConn.length > 0,
    order.length ? h('ol', { class: 'ref-list' }, order.map((rid) => {
      const r = kb.references.get(rid);
      return h('li', {}, h('a', { href: r.url, target: '_blank', rel: 'noopener noreferrer' }, r.title), ` — ${r.publisher}. ${REF_TYPES[r.type] ?? r.type}, consulté le ${formatDate(r.accessed)} (${EVIDENCE[r.evidence] ?? r.evidence}).`, r.note ? h('span', { class: 'meta', text: ` ${r.note}` }) : null);
    })) : null,
    uniqueConn.length ? h('div', { class: 'sub-block' }, h('h4', { text: 'Sources des liaisons' }), h('ul', { class: 'plain' }, uniqueConn.map((x) => h('li', {}, h('a', { href: x.url, target: '_blank', rel: 'noopener noreferrer' }, x.title))))) : null);

  root.append(h('div', { class: 'page' },
    h('button', { type: 'button', class: 'link-btn', onClick: () => actions.setView('catalog') }, '← Catalogue'),
    h('div', { class: 'sheet-head' },
      h('div', {}, h('h2', { class: 'section-title', text: s.name }), h('p', { class: 'lead', text: s.description })),
      h('div', { class: 'sheet-actions' },
        (db.connsBySoftware.get(id) || []).length ? h('button', { type: 'button', class: 'btn', onClick: () => actions.selectSoftware(id) }, 'Voir dans le graphe') : null,
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => { actions.toggleCompare(id, true); actions.setView('compare'); } }, 'Comparer'))),
    p
      ? h('p', { class: 'meta', text: `Fiche revue le ${formatDate(p.reviewed)}. Seules les informations confirmées par une source sont affirmées ; le reste est marqué « Non documenté ».` })
      : h('div', { class: 'warn', role: 'note', text: 'Fiche à compléter : seuls l’identification et les liaisons déjà documentées sont disponibles. Aucune valeur n’a été supposée.' }),
    h('section', { class: 'card sheet' }, secA, secB, secC, secD, secE, secF, secG, secH, secI, secJ, secK, secL)));
}

/* ------------------------------------------------------------------ Comparateur */

const joinItems = (items) => (items?.length ? items.map((i) => i.text).join(' ; ') : null);

export async function renderCompare(root, db, kb, actions) {
  clear(root);
  const ids = actions.compareIds().filter((id) => db.softwareById.has(id));
  const wrap = h('div', { class: 'page page-wide' },
    h('h2', { class: 'section-title', text: 'Comparateur de logiciels' }),
    h('p', { class: 'lead', text: `Choisissez jusqu’à ${MAX_COMPARE} logiciels. « Non documenté » signifie qu’aucune source n’a été consultée pour ce point, pas que la fonction n’existe pas.` }));

  const domainSel = h('select', { class: 'input select-inline', 'aria-label': 'Domaine', onChange: () => fillSoftware() },
    [h('option', { value: 'all', text: 'Tous les domaines' }), ...db.meta.domains.map((d) => h('option', { value: d.id, text: d.short }))]);
  const softSel = h('select', { class: 'input select-inline', 'aria-label': 'Logiciel à ajouter' });
  function fillSoftware() {
    clear(softSel);
    softSel.append(h('option', { value: '', text: 'Ajouter un logiciel…' }));
    for (const s of db.software.filter((x) => !x.user && !ids.includes(x.id) && (domainSel.value === 'all' || x.domain === domainSel.value))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))) {
      softSel.append(h('option', { value: s.id, text: `${s.name}${kb.profileIds.has(s.id) ? '' : ' (identification seule)'}` }));
    }
  }
  fillSoftware();
  softSel.addEventListener('change', () => { if (softSel.value) actions.toggleCompare(softSel.value, true); });

  wrap.append(h('section', { class: 'card card-pad toolbar-card' },
    h('div', { class: 'toolbar-row' }, domainSel, softSel),
    ids.length ? h('div', { class: 'chips' }, ids.map((id) => h('button', {
      type: 'button', class: 'chip', title: 'Retirer de la comparaison', onClick: () => actions.toggleCompare(id, false)
    }, h('span', { class: 'chip-label', text: db.softwareById.get(id).name }), ' ×'))) : null));

  if (ids.length < 2) {
    wrap.append(h('p', { class: 'empty', text: 'Sélectionnez au moins deux logiciels pour afficher la comparaison.' }));
    root.append(wrap);
    return;
  }

  const profiles = await Promise.all(ids.map((id) => loadProfile(kb, id)));
  const sw = ids.map((id) => db.softwareById.get(id));
  const statusCell = (c) => {
    if (!c) return unknown();
    if (c.v === 'na') return h('span', { class: 'st st-na', text: 'Sans objet' });
    return h('span', {}, h('span', { class: 'st st-ok', text: 'Confirmé' }), c.note ? ` ${c.note}` : '');
  };
  const textCell = (v) => (v ? h('span', { text: v }) : unknown());
  const rows = (fn) => sw.map((s, i) => h('td', {}, fn(s, profiles[i])));
  const row = (label, fn) => h('tr', {}, h('th', { scope: 'row', text: label }), rows(fn));
  const group = (label) => h('tr', { class: 'cmp-group' }, h('th', { colspan: sw.length + 1, scope: 'colgroup', text: label }));

  const connsOf = (s) => db.connsBySoftware.get(s.id) || [];
  const body = [
    group('Identification'),
    row('Domaine', (s) => textCell(db.meta.domains.find((d) => d.id === s.domain)?.short)),
    row('Éditeur', (s) => textCell(s.vendor)),
    row('Licence', (s, p) => textCell(p?.license?.text ?? s.license)),
    row('Version étudiée', (s, p) => textCell(p?.version?.text)),
    group('Spécialités'),
    row('Structures et objets', (s, p) => textCell(joinItems(p?.specialties?.structures))),
    row('Utilisations', (s, p) => textCell(joinItems(p?.specialties?.uses))),
    row('Matériaux', (s, p) => textCell(joinItems(p?.specialties?.materials))),
    group('Méthodes de calcul et analyses'),
    ...kb.methods.map((m) => row(m.label, (s, p) => statusCell(p?.methods?.[m.id]))),
    row('Autres méthodes', (s, p) => textCell(joinItems(p?.otherMethods))),
    group('Normes'),
    row('Règlements', (s, p) => textCell(joinItems(p?.standards) ?? p?.standardsNote?.text)),
    group('Modélisation'),
    row('Dimensions', (s, p) => statusCell(p?.modelling?.dims)),
    ...Object.entries(ELEMENTS).map(([k, label]) => row(label, (s, p) => statusCell(p?.modelling?.elements?.[k]))),
    group('Interopérabilité'),
    row('Liaisons documentées', (s) => textCell(connsOf(s).length ? connsOf(s).map((c) => db.softwareById.get(c.source === s.id ? c.target : c.source).name).join(', ') : null)),
    row('Formats de fichiers', (s) => {
      const f = [...new Set(connsOf(s).flatMap((c) => c.formats || []))];
      return textCell(f.length ? f.map((x) => db.formatById.get(x)?.name ?? x).join(', ') : null);
    }),
    group('Analyse critique'),
    row('Limites', (s, p) => textCell(joinItems(p?.limits))),
    row('Points forts', (s, p) => textCell(joinItems(p?.strengths))),
    row('Points faibles', (s, p) => textCell(joinItems(p?.weaknesses)))
  ];

  wrap.append(h('section', { class: 'card' }, h('div', { class: 'table-wrap' }, h('table', { class: 'data-table cmp-table' },
    h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: 'Critère' }), sw.map((s) => h('th', { scope: 'col' },
      h('button', { type: 'button', class: 'cell-link cmp-head', onClick: () => actions.openSheet(s.id) }, s.name))))),
    h('tbody', {}, body)))));
  root.append(wrap);
}

/* ------------------------------------------------------------------ Madagascar */

export function renderMadagascar(root, db, kb, actions) {
  clear(root);
  const data = kb.madagascar;
  const rows = data.entries.filter((e) => db.softwareById.has(e.software)).map((e) => {
    const s = db.softwareById.get(e.software);
    const free = licenseGroup(s) === 'free';
    const n = (db.connsBySoftware.get(s.id) || []).length;
    return h('tr', {},
      h('td', {}, h('button', { type: 'button', class: 'cell-link', onClick: () => actions.openSheet(s.id) }, s.name)),
      h('td', { text: e.domains.join(', ') }),
      h('td', {}, h('span', { class: 'st st-unknown', text: 'Non documentée' })),
      h('td', { text: e.signal ? 'Cité dans des profils professionnels en ligne (indice, sans valeur statistique)' : 'Aucun indice relevé' }),
      h('td', {}, h('span', { class: 'st st-unknown', text: 'Non documentée localement' })),
      h('td', { text: free ? 'Sans coût de licence' : licenseGroup(s) === 'commercial' ? 'Licence payante' : 'Licence non précisée' }),
      h('td', { text: n ? plural(n, 'liaison documentée', 'liaisons documentées') : 'Aucune documentée' }));
  });

  const downloadTemplate = () => {
    const header = data.survey.fields.map((f) => f.id).join(';');
    const blob = new Blob([`﻿${header}\n`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = h('a', { href: url, download: 'enquete-logiciels-madagascar.csv' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  root.append(h('div', { class: 'page page-wide' },
    h('h2', { class: 'section-title', text: data.title }),
    h('p', { class: 'lead', text: 'Logiciels étudiés dans le contexte des bureaux d’études, entreprises BTP, administrations et établissements de formation à Madagascar.' }),
    h('div', { class: 'warn', role: 'note', text: data.statement }),
    h('section', { class: 'card card-pad' },
      h('div', { class: 'card-bar flat' }, h('h3', { class: 'card-title', text: 'Logiciels étudiés' }), h('span', { class: 'pill', text: 'Ordre sans valeur de classement' })),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
        h('thead', {}, h('tr', {}, ['Logiciel', 'Domaines professionnels', 'Fréquence d’usage', 'Indice relevé', 'Formation', 'Licence', 'Interconnexions'].map((c) => h('th', { scope: 'col', text: c })))),
        h('tbody', {}, rows))),
      h('p', { class: 'meta', text: data.method })),
    h('section', { class: 'card card-pad' },
      h('div', { class: 'card-bar flat' }, h('h3', { class: 'card-title', text: 'Enquête à mener' }), h('span', { class: 'pill', text: data.survey.status })),
      h('p', { text: data.survey.objective }),
      h('p', { class: 'meta', text: data.survey.ethics }),
      h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
        h('thead', {}, h('tr', {}, ['Champ', 'Réponses attendues'].map((c) => h('th', { scope: 'col', text: c })))),
        h('tbody', {}, data.survey.fields.map((f) => h('tr', {}, h('td', { text: f.label }), h('td', { class: 'meta', text: f.hint })))))),
      h('p', {}, h('button', { type: 'button', class: 'btn btn-primary', onClick: downloadTemplate }, '⇩ Télécharger le modèle de saisie (CSV)')))));
}
