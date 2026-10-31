// Carte façon « Blueprint » (éditeur de graphes d'Unreal Engine) : nœuds HTML à en-tête coloré et broches,
// câbles SVG en courbes de Bézier, grille, cadres de commentaire par catégorie.
// Navigation : clic droit ou molette-clic + glisser pour déplacer la vue, molette pour zoomer par paliers,
// glisser un nœud pour le déplacer, Origine pour tout cadrer. Au toucher : glisser, pincer, appui long pour déplacer un nœud.
// Aucune logique métier ici : le module affiche l'état reçu et signale les clics via des callbacks.
import { h, svg, clear, dashArray } from './util.js?v=20261031.3';

const NODE_W = 290; // doit correspondre à la largeur de .bp-node dans styles.css
const COL_GAP = 170;
const ROW_GAP = 56;
const COMMENT_PAD = 26;
const COMMENT_HEAD = 34;
// Paliers de zoom de l'éditeur Blueprint ; l'indice 12 correspond au « Zoom 1:1 ».
const ZOOM_LEVELS = [0.1, 0.125, 0.15, 0.175, 0.2, 0.225, 0.25, 0.375, 0.5, 0.675, 0.75, 0.875, 1, 1.25, 1.375, 1.5, 1.675, 1.75, 2];
const ONE_TO_ONE = 12;
const MIN_K = ZOOM_LEVELS[0];
const MAX_K = ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
const LOD_LABELS = 0.6; // en dessous, les libellés des broches sont masqués
const CATEGORY_ICON = { cao: '✎', bim: '▦', calcul: 'ƒ', mesh: '◬', fem: '∿' };

const clampK = (k) => Math.min(MAX_K, Math.max(MIN_K, k));

function bezier(a, b) {
  const dx = b.x - a.x;
  // Câble vers l'avant : tangentes horizontales proportionnelles à l'écart. Vers l'arrière : la boucle s'élargit.
  const t = dx >= 0 ? Math.max(50, dx * 0.5) : Math.min(320, 90 + Math.abs(dx) * 0.4);
  return `M${a.x},${a.y} C${a.x + t},${a.y} ${b.x - t},${b.y} ${b.x},${b.y}`;
}

function shortFormat(db, ids) {
  if (!ids || !ids.length) return '';
  const first = db.formatById.get(ids[0]);
  const name = first ? (first.name.length > 9 ? first.id.toUpperCase() : first.name) : ids[0];
  return ids.length > 1 ? `${name} +${ids.length - 1}` : name;
}

export function createGraph(container, db, callbacks) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const columnOf = (s) => db.catById.get(s.category).column ?? 0;

  /* ------------------------------------------------------------ orientation des câbles */
  // Convention Blueprint : un câble part d'une broche de sortie (à droite) vers une broche d'entrée (à gauche).
  // Liaison unidirectionnelle : de la source vers la cible. Bidirectionnelle : de la colonne de gauche vers celle de droite.
  const orient = new Map();
  for (const c of db.connections) {
    let from = c.source;
    let to = c.target;
    if (c.direction === 'bi') {
      const a = db.softwareById.get(c.source);
      const b = db.softwareById.get(c.target);
      const ka = [columnOf(a), a.position.y];
      const kb = [columnOf(b), b.position.y];
      if (kb[0] < ka[0] || (kb[0] === ka[0] && kb[1] < ka[1])) { from = c.target; to = c.source; }
    }
    orient.set(c.id, { from, to });
  }
  const sortKey = (id) => {
    const s = db.softwareById.get(id);
    return columnOf(s) * 10000 + s.position.y;
  };

  /* ------------------------------------------------------------ DOM */
  clear(container);
  container.classList.add('bp-canvas');
  const commentLayer = h('div', { class: 'bp-layer bp-comments' });
  const wireSvg = svg('svg', { class: 'bp-wires', 'aria-hidden': 'true' });
  const wireRoot = svg('g', {});
  wireSvg.append(wireRoot);
  const nodeLayer = h('div', { class: 'bp-layer bp-nodes' });
  const zoomLabel = h('div', { class: 'bp-zoom-label', 'aria-hidden': 'true' });
  const watermark = h('div', { class: 'bp-watermark', 'aria-hidden': 'true', text: 'INTEROPERABILITY' });
  const tooltip = h('div', { class: 'bp-tooltip', role: 'tooltip', hidden: true });
  container.append(commentLayer, wireSvg, nodeLayer, zoomLabel, watermark, tooltip);

  const nodeEls = new Map();
  const pinEls = new Map(); // connId -> { out: { row, dot }, in: { row, dot } }
  const wires = new Map(); // connId -> { g, line, hit, pulses[] }
  const commentEls = new Map();

  function pinRow(c, side) {
    const kind = db.kindById.get(c.kind);
    const { from, to } = orient.get(c.id);
    const other = db.softwareById.get(side === 'in' ? from : to);
    const dot = h('span', { class: `bp-dot${c.kind === 'native' ? ' bp-exec' : ''}`, style: `--pin:${kind.color}` });
    const label = h('span', { class: 'bp-label', text: `${c.direction === 'bi' ? '⇄ ' : ''}${other.shortName || other.name}` });
    const fmt = h('span', { class: 'bp-fmt', text: shortFormat(db, c.formats) });
    const row = h('div', { class: 'bp-pin', dataset: { conn: c.id } }, side === 'in' ? [dot, label, fmt] : [fmt, label, dot]);
    const entry = pinEls.get(c.id) || {};
    entry[side] = { row, dot };
    pinEls.set(c.id, entry);
    return row;
  }

  for (const s of db.software) {
    const cat = db.catById.get(s.category);
    const outs = db.connections.filter((c) => orient.get(c.id).from === s.id).sort((a, b) => sortKey(orient.get(a.id).to) - sortKey(orient.get(b.id).to));
    const ins = db.connections.filter((c) => orient.get(c.id).to === s.id).sort((a, b) => sortKey(orient.get(a.id).from) - sortKey(orient.get(b.id).from));
    const el = h('div', {
      class: 'bp-node', role: 'button', tabindex: '0', dataset: { id: s.id }, style: `--cat:${cat.color}`,
      'aria-label': `${s.name}, ${cat.label}, ${ins.length + outs.length} connexions`
    },
      h('div', { class: 'bp-head' },
        h('span', { class: 'bp-icon', 'aria-hidden': 'true', text: CATEGORY_ICON[s.category] ?? '◆' }),
        h('span', { class: 'bp-titles' },
          h('span', { class: 'bp-title', text: s.shortName || s.name }),
          h('span', { class: 'bp-sub', text: `${cat.label} · ${s.vendor}` })
        )
      ),
      h('div', { class: 'bp-body' },
        h('div', { class: 'bp-col bp-in' }, ins.map((c) => pinRow(c, 'in'))),
        h('div', { class: 'bp-col bp-out' }, outs.map((c) => pinRow(c, 'out')))
      )
    );
    nodeEls.set(s.id, el);
    nodeLayer.append(el);
  }

  for (const c of db.connections) {
    const kind = db.kindById.get(c.kind);
    const g = svg('g', { class: `bp-wire kind-${c.kind}`, 'data-conn': c.id });
    const hit = svg('path', { class: 'bp-hit' });
    const line = svg('path', { class: 'bp-line', stroke: kind.color, 'stroke-linecap': kind.dash === 'dotted' ? 'round' : 'butt' });
    const pulses = [svg('path', { class: 'bp-pulse', stroke: kind.color })];
    if (c.direction === 'bi') pulses.push(svg('path', { class: 'bp-pulse rev', stroke: kind.color }));
    g.append(hit, line, ...pulses);
    wireRoot.append(g);
    wires.set(c.id, { g, hit, line, pulses, width: kind.width, dash: dashArray(kind.dash).split(' ').filter(Boolean).map(Number) });
  }

  for (const cat of db.meta.categories) {
    const head = h('div', { class: 'bp-comment-head', dataset: { cat: cat.id } }, h('span', { class: 'bp-comment-title', text: cat.label }));
    const el = h('div', { class: 'bp-comment', style: `--cat:${cat.color}` }, head);
    commentEls.set(cat.id, el);
    commentLayer.append(el);
  }

  /* ------------------------------------------------------------ géométrie */
  const pos = new Map();
  const size = new Map();
  const pinOffset = new Map(); // `${connId}:${side}` -> {x, y} relatif au nœud
  const view = { x: 0, y: 0, k: 1 };
  let layoutReady = false;
  let selected = null;
  let visibleConn = new Set(db.connections.map((c) => c.id));
  let shownNodes = new Set(db.software.map((s) => s.id));

  function measure() {
    for (const [id, el] of nodeEls) size.set(id, { w: el.offsetWidth, h: el.offsetHeight });
    pinOffset.clear();
    for (const [connId, sides] of pinEls) {
      for (const side of ['in', 'out']) {
        const dot = sides[side]?.dot;
        // offsetParent du point = le nœud (seul ancêtre positionné) ; null si la ligne est masquée.
        if (!dot || dot.offsetParent === null) continue;
        pinOffset.set(`${connId}:${side}`, { x: dot.offsetLeft + dot.offsetWidth / 2, y: dot.offsetTop + dot.offsetHeight / 2 });
      }
    }
  }

  function autoLayout() {
    const columns = new Map();
    for (const s of db.software) {
      const col = columnOf(s);
      if (!columns.has(col)) columns.set(col, []);
      columns.get(col).push(s);
    }
    for (const [col, list] of columns) {
      list.sort((a, b) => a.position.y - b.position.y);
      const total = list.reduce((sum, s) => sum + (size.get(s.id)?.h || 120), 0) + ROW_GAP * (list.length - 1);
      let y = -total / 2;
      for (const s of list) {
        pos.set(s.id, { x: col * (NODE_W + COL_GAP), y });
        y += (size.get(s.id)?.h || 120) + ROW_GAP;
      }
    }
  }

  function placeNodes(ids = nodeEls.keys()) {
    for (const id of ids) {
      const p = pos.get(id);
      nodeEls.get(id).style.transform = `translate(${p.x}px, ${p.y}px)`;
    }
  }

  function pinPoint(nodeId, connId, side) {
    const off = pinOffset.get(`${connId}:${side}`);
    const p = pos.get(nodeId);
    return off && p ? { x: p.x + off.x, y: p.y + off.y } : null;
  }

  function renderWires() {
    for (const [id, w] of wires) {
      const { from, to } = orient.get(id);
      const a = visibleConn.has(id) ? pinPoint(from, id, 'out') : null;
      const b = visibleConn.has(id) ? pinPoint(to, id, 'in') : null;
      if (!a || !b) { w.g.style.display = 'none'; continue; }
      w.g.style.display = '';
      const d = bezier(a, b);
      w.hit.setAttribute('d', d);
      w.line.setAttribute('d', d);
      for (const p of w.pulses) p.setAttribute('d', d);
    }
  }

  function renderComments() {
    for (const cat of db.meta.categories) {
      const el = commentEls.get(cat.id);
      const ids = db.software.filter((s) => s.category === cat.id && shownNodes.has(s.id)).map((s) => s.id);
      if (!ids.length) { el.hidden = true; continue; }
      el.hidden = false;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      for (const id of ids) {
        const p = pos.get(id);
        const s = size.get(id);
        x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
        x2 = Math.max(x2, p.x + s.w); y2 = Math.max(y2, p.y + s.h);
      }
      const x = x1 - COMMENT_PAD;
      const y = y1 - COMMENT_PAD - COMMENT_HEAD;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.style.width = `${x2 - x1 + COMMENT_PAD * 2}px`;
      el.style.height = `${y2 - y1 + COMMENT_PAD * 2 + COMMENT_HEAD}px`;
    }
  }

  function ensureLayout() {
    if (!container.offsetWidth) return false;
    if (!layoutReady) {
      measure();
      autoLayout();
      placeNodes();
      layoutReady = true;
      renderWires();
      renderComments();
      applyView(true);
    }
    return true;
  }

  /* ------------------------------------------------------------ vue (déplacement / zoom) */
  let lastK = null;
  let zoomTimer = null;

  function zoomText(k) {
    let best = 0;
    ZOOM_LEVELS.forEach((lvl, i) => { if (Math.abs(lvl - k) < Math.abs(ZOOM_LEVELS[best] - k)) best = i; });
    const step = best - ONE_TO_ONE;
    return step === 0 ? 'Zoom 1:1' : `Zoom ${step > 0 ? '+' : ''}${step}`;
  }

  function showZoomLabel() {
    zoomLabel.textContent = zoomText(view.k);
    zoomLabel.classList.add('show');
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => zoomLabel.classList.remove('show'), 1400);
  }

  function applyView(force = false) {
    const { x, y, k } = view;
    const t = `translate(${x}px, ${y}px) scale(${k})`;
    commentLayer.style.transform = t;
    nodeLayer.style.transform = t;
    wireRoot.setAttribute('transform', `translate(${x} ${y}) scale(${k})`);

    const major = 128 * k;
    const minor = 16 * k;
    container.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
    container.style.backgroundPosition = Array(4).fill(`${x}px ${y}px`).join(', ');

    if (force || k !== lastK) {
      lastK = k;
      container.classList.toggle('bp-grid-coarse', minor < 6);
      container.classList.toggle('lod-far', k < LOD_LABELS);
      // Titres agrandis quand on dézoome, pour rester lisibles (≈ 11 px à l'écran au minimum).
      container.style.setProperty('--lod', String(Math.min(4, Math.max(1, 0.75 / k))));
      // Câbles : épaisseur minimale lisible à l'écran, zone de clic constante.
      const wscale = Math.max(1, 0.7 / k);
      const hitPx = coarse ? 26 : 14;
      for (const w of wires.values()) {
        w.line.setAttribute('stroke-width', String(w.width * wscale));
        w.line.setAttribute('stroke-dasharray', w.dash.length ? w.dash.map((v) => v * wscale).join(' ') : 'none');
        w.hit.setAttribute('stroke-width', String(hitPx / k));
        for (const p of w.pulses) p.setAttribute('stroke-width', String(4.5 * wscale));
      }
    }
  }

  function zoomAt(k, sx, sy) {
    k = clampK(k);
    const wx = (sx - view.x) / view.k;
    const wy = (sy - view.y) / view.k;
    view.k = k;
    view.x = sx - wx * k;
    view.y = sy - wy * k;
    applyView();
  }

  function stepLevel(k, dir) {
    if (dir > 0) return ZOOM_LEVELS.find((lvl) => lvl > k + 1e-6) ?? MAX_K;
    for (let i = ZOOM_LEVELS.length - 1; i >= 0; i--) if (ZOOM_LEVELS[i] < k - 1e-6) return ZOOM_LEVELS[i];
    return MIN_K;
  }

  let anim = null;
  function animateTo(target) {
    cancelAnimationFrame(anim);
    if (reduceMotion) { Object.assign(view, target); applyView(); return; }
    const start = { ...view };
    const t0 = performance.now();
    const dur = 280;
    const step = (now) => {
      const t = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      view.x = start.x + (target.x - start.x) * e;
      view.y = start.y + (target.y - start.y) * e;
      view.k = start.k + (target.k - start.k) * e;
      applyView();
      if (t < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  }

  function boxOf(ids) {
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    for (const id of ids) {
      const p = pos.get(id);
      const s = size.get(id);
      if (!p || !s) continue;
      x1 = Math.min(x1, p.x); y1 = Math.min(y1, p.y);
      x2 = Math.max(x2, p.x + s.w); y2 = Math.max(y2, p.y + s.h);
    }
    return { x1, y1, x2, y2, w: x2 - x1, h: y2 - y1 };
  }

  function frame(box, inset, { pad = 40, minK = MIN_K, maxK = 1, animate = true } = {}) {
    const W = container.clientWidth;
    const H = Math.max(120, container.clientHeight - Math.max(0, inset || 0));
    const k = clampK(Math.min(maxK, Math.max(minK, Math.min((W - pad * 2) / Math.max(box.w, 1), (H - pad * 2) / Math.max(box.h, 1)))));
    const target = { k, x: W / 2 - ((box.x1 + box.x2) / 2) * k, y: H / 2 - ((box.y1 + box.y2) / 2) * k };
    if (animate) animateTo(target);
    else { Object.assign(view, target); applyView(); }
  }

  /* ------------------------------------------------------------ mise en évidence */
  function applyEmphasis() {
    for (const el of nodeEls.values()) el.classList.remove('is-selected', 'is-related', 'is-faded');
    for (const w of wires.values()) w.g.classList.remove('is-hl', 'is-selected', 'is-faded');
    for (const sides of pinEls.values()) for (const s of Object.values(sides)) s.row.classList.remove('is-faded', 'is-hl');
    if (!selected) return;

    const lit = new Set();
    const related = new Set();
    if (selected.type === 'node') {
      related.add(selected.id);
      for (const c of db.connsBySoftware.get(selected.id) || []) {
        if (!visibleConn.has(c.id)) continue;
        lit.add(c.id);
        related.add(c.source);
        related.add(c.target);
      }
    } else if (db.connectionById.has(selected.id)) {
      const c = db.connectionById.get(selected.id);
      lit.add(c.id);
      related.add(c.source);
      related.add(c.target);
    }

    for (const [id, el] of nodeEls) {
      if (selected.type === 'node' && id === selected.id) el.classList.add('is-selected');
      else if (related.has(id)) el.classList.add('is-related');
      else el.classList.add('is-faded');
    }
    for (const [id, w] of wires) {
      if (lit.has(id)) {
        w.g.classList.add(selected.type === 'edge' ? 'is-selected' : 'is-hl');
        wireRoot.append(w.g); // passe au premier plan
      } else {
        w.g.classList.add('is-faded');
      }
    }
    for (const [id, sides] of pinEls) {
      for (const s of Object.values(sides)) s.row.classList.add(lit.has(id) ? 'is-hl' : 'is-faded');
    }
  }

  /* ------------------------------------------------------------ infobulle et survol (souris) */
  let hoverId = null;
  function setHover(connId, evt) {
    if (connId !== hoverId) {
      if (hoverId) {
        wires.get(hoverId)?.g.classList.remove('is-hover');
        for (const s of Object.values(pinEls.get(hoverId) || {})) s.row.classList.remove('is-hover');
      }
      hoverId = connId;
      if (connId) {
        wires.get(connId)?.g.classList.add('is-hover');
        for (const s of Object.values(pinEls.get(connId) || {})) s.row.classList.add('is-hover');
        const c = db.connectionById.get(connId);
        const a = db.softwareById.get(c.source).name;
        const b = db.softwareById.get(c.target).name;
        const fmts = (c.formats || []).map((f) => db.formatById.get(f)?.name ?? f).join(', ');
        tooltip.textContent = `${a} ${c.direction === 'bi' ? '⇄' : '→'} ${b}\n${db.kindById.get(c.kind).label}${fmts ? ' · ' + fmts : ''}\nConfiance : ${db.confById.get(c.confidence)?.label}`;
      }
    }
    tooltip.hidden = !connId;
    if (connId && evt) {
      const r = container.getBoundingClientRect();
      const x = Math.min(evt.clientX - r.left + 14, container.clientWidth - 290);
      const y = Math.min(evt.clientY - r.top + 16, container.clientHeight - 80);
      tooltip.style.transform = `translate(${Math.max(4, x)}px, ${Math.max(4, y)}px)`;
    }
  }

  /* ------------------------------------------------------------ interactions */
  const pointers = new Map();
  let gesture = null;
  const pt = (e) => {
    const r = container.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function beginDrag(g) {
    if (g.groupCat) {
      g.type = 'group';
      g.ids = db.software.filter((s) => s.category === g.groupCat && shownNodes.has(s.id)).map((s) => s.id);
    } else {
      g.type = 'node';
      g.ids = [g.nodeId];
    }
    for (const id of g.ids) nodeEls.get(id).classList.add('is-dragging');
    container.classList.add('is-dragging');
  }

  function endGesture() {
    if (gesture?.ids) for (const id of gesture.ids) nodeEls.get(id)?.classList.remove('is-dragging');
    clearTimeout(gesture?.timer);
    gesture = null;
    container.classList.remove('is-panning', 'is-dragging');
  }

  container.addEventListener('contextmenu', (e) => e.preventDefault());

  container.addEventListener('pointerdown', (e) => {
    if (!ensureLayout()) return;
    cancelAnimationFrame(anim);
    setHover(null);
    pointers.set(e.pointerId, pt(e));
    try { container.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }

    if (pointers.size === 2) {
      clearTimeout(gesture?.timer);
      if (gesture?.ids) for (const id of gesture.ids) nodeEls.get(id)?.classList.remove('is-dragging');
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      gesture = {
        type: 'pinch',
        startDist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
        startK: view.k,
        anchor: { x: (mid.x - view.x) / view.k, y: (mid.y - view.y) / view.k }
      };
      return;
    }
    if (pointers.size > 2) return;

    const p = pt(e);
    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      gesture = { type: 'pan', start: p, last: p, moved: true };
      container.classList.add('is-panning');
      return;
    }
    if (e.button !== 0) return;
    const isTouch = e.pointerType === 'touch';
    // Le navigateur « recale » parfois un toucher vers un élément cliquable voisin (un nœud) alors que le doigt
    // est sur un câble : on préfère l'élément réellement sous le point, et la cible recalée seulement sur le fond.
    const exact = document.elementFromPoint(e.clientX, e.clientY);
    const interactive = (el) => el?.closest?.('.bp-node, .bp-wire, .bp-comment-head');
    const target = interactive(exact) ? exact : e.target;
    const nodeEl = target.closest('.bp-node');
    gesture = {
      type: 'pending',
      start: p,
      last: p,
      isTouch,
      moved: false,
      dragMoved: false,
      nodeId: nodeEl?.dataset.id,
      wireId: nodeEl ? null : target.closest('.bp-wire')?.dataset.conn,
      groupCat: nodeEl ? null : target.closest('.bp-comment-head')?.dataset.cat
    };
    if (isTouch && (gesture.nodeId || gesture.groupCat)) {
      const g = gesture;
      // Au toucher, glisser déplace la vue ; un appui long « attrape » le nœud (ou le cadre).
      g.timer = setTimeout(() => {
        if (gesture === g && g.type === 'pending' && !g.moved) {
          beginDrag(g);
          navigator.vibrate?.(12);
        }
      }, 380);
    }
  });

  container.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) {
      if (e.pointerType === 'mouse' && !gesture) {
        const t = e.target;
        const id = t.closest?.('.bp-wire')?.dataset.conn ?? t.closest?.('.bp-pin')?.dataset.conn ?? null;
        setHover(id, e);
      }
      return;
    }
    pointers.set(e.pointerId, pt(e));
    if (!gesture) return;

    if (gesture.type === 'pinch') {
      if (pointers.size < 2) return;
      const [a, b] = [...pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const k = clampK(gesture.startK * Math.hypot(a.x - b.x, a.y - b.y) / gesture.startDist);
      view.k = k;
      view.x = mid.x - gesture.anchor.x * k;
      view.y = mid.y - gesture.anchor.y * k;
      applyView();
      showZoomLabel();
      return;
    }

    const p = pt(e);
    if (gesture.type === 'pending') {
      const dist = Math.hypot(p.x - gesture.start.x, p.y - gesture.start.y);
      if (dist < (gesture.isTouch ? 8 : 4)) return;
      gesture.moved = true;
      clearTimeout(gesture.timer);
      if (!gesture.isTouch && (gesture.nodeId || gesture.groupCat)) beginDrag(gesture);
      else { gesture.type = 'pan'; container.classList.add('is-panning'); }
    }

    const dx = p.x - gesture.last.x;
    const dy = p.y - gesture.last.y;
    gesture.last = p;
    if (gesture.type === 'pan') {
      view.x += dx;
      view.y += dy;
      applyView();
    } else if (gesture.type === 'node' || gesture.type === 'group') {
      gesture.dragMoved = true;
      for (const id of gesture.ids) {
        const q = pos.get(id);
        q.x += dx / view.k;
        q.y += dy / view.k;
      }
      placeNodes(gesture.ids);
      renderWires();
      renderComments();
    }
  });

  const release = (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    const g = gesture;
    if (!g) return;
    if (g.type === 'pinch') {
      if (pointers.size === 1) {
        const [rest] = pointers.values();
        gesture = { type: 'pan', start: rest, last: rest, moved: true };
      } else if (pointers.size === 0) {
        gesture = null;
      }
      return;
    }
    if (pointers.size > 0) return;
    endGesture();
    if (e.type === 'pointercancel') return;
    const tapped = (g.type === 'pending' && !g.moved) || (g.type === 'node' && !g.dragMoved);
    if (!tapped) return;
    if (g.nodeId) callbacks.onNode(g.nodeId);
    else if (g.wireId) callbacks.onEdge(g.wireId);
    else if (!g.groupCat) callbacks.onBackground();
  };
  container.addEventListener('pointerup', release);
  container.addEventListener('pointercancel', release);
  container.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && !pointers.size) setHover(null); });

  let wheelAcc = 0;
  container.addEventListener('wheel', (e) => {
    if (!ensureLayout()) return;
    e.preventDefault();
    cancelAnimationFrame(anim);
    setHover(null);
    const p = pt(e);
    if (e.ctrlKey) {
      // pincement sur pavé tactile : zoom continu
      zoomAt(view.k * Math.exp(-e.deltaY * 0.01), p.x, p.y);
    } else {
      wheelAcc += e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY;
      if (Math.abs(wheelAcc) < 40) return;
      const dir = wheelAcc > 0 ? -1 : 1;
      wheelAcc = 0;
      zoomAt(stepLevel(view.k, dir), p.x, p.y);
    }
    showZoomLabel();
  }, { passive: false });

  container.addEventListener('keydown', (e) => {
    const nodeEl = e.target.closest?.('.bp-node');
    if (nodeEl && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      callbacks.onNode(nodeEl.dataset.id);
      return;
    }
    if (!ensureLayout()) return;
    const W = container.clientWidth;
    const H = container.clientHeight;
    const pan = (dx, dy) => { view.x += dx; view.y += dy; applyView(); };
    switch (e.key) {
      case 'Home': api.fit(0); break;
      case 'f': case 'F':
        if (selected?.type === 'node') api.centerOn(selected.id, 0);
        else if (selected?.type === 'edge') api.centerOnEdge(selected.id, 0);
        else api.fit(0);
        break;
      case '+': case '=': zoomAt(stepLevel(view.k, 1), W / 2, H / 2); showZoomLabel(); break;
      case '-': case '_': zoomAt(stepLevel(view.k, -1), W / 2, H / 2); showZoomLabel(); break;
      case 'ArrowLeft': pan(60, 0); break;
      case 'ArrowRight': pan(-60, 0); break;
      case 'ArrowUp': pan(0, 60); break;
      case 'ArrowDown': pan(0, -60); break;
      default: return;
    }
    e.preventDefault();
  });

  /* ------------------------------------------------------------ API publique */
  const api = {
    /** Filtres de visibilité : catégories et types actifs, format optionnel. */
    setFilters({ cats, kinds, format }) {
      shownNodes = new Set(db.software.filter((s) => cats.has(s.category)).map((s) => s.id));
      visibleConn = new Set();
      const linked = new Set();
      for (const c of db.connections) {
        const ok = kinds.has(c.kind) && shownNodes.has(c.source) && shownNodes.has(c.target) && (!format || (c.formats || []).includes(format));
        if (ok) { visibleConn.add(c.id); linked.add(c.source); linked.add(c.target); }
      }
      for (const [id, el] of nodeEls) {
        el.hidden = !shownNodes.has(id);
        el.classList.toggle('is-isolated', Boolean(format) && !linked.has(id));
      }
      for (const [id, sides] of pinEls) for (const s of Object.values(sides)) s.row.hidden = !visibleConn.has(id);
      if (layoutReady) {
        measure();
        renderWires();
        renderComments();
      }
      applyEmphasis();
    },

    /** Recherche : estompe les logiciels qui ne correspondent pas (null = pas de recherche). */
    setMatches(ids) {
      for (const [id, el] of nodeEls) el.classList.toggle('is-dim', ids != null && !ids.has(id));
    },

    select(type, id) {
      selected = id ? { type, id } : null;
      applyEmphasis();
    },

    clearSelection() {
      selected = null;
      applyEmphasis();
    },

    /** Centre un logiciel dans la partie visible (au-dessus du panneau sur mobile). */
    centerOn(id, bottomInset = 0) {
      if (!ensureLayout() || !pos.has(id)) return;
      const p = pos.get(id);
      const s = size.get(id);
      const k = Math.max(view.k, coarse ? 0.6 : 0.75);
      const H = container.clientHeight - Math.max(0, bottomInset);
      animateTo({ k, x: container.clientWidth / 2 - (p.x + s.w / 2) * k, y: H / 2 - (p.y + s.h / 2) * k });
    },

    centerOnEdge(id, bottomInset = 0) {
      const c = db.connectionById.get(id);
      if (!c || !ensureLayout()) return;
      frame(boxOf([c.source, c.target]), bottomInset, { pad: 30, minK: 0.3, maxK: 1 });
    },

    /** Cadre tous les logiciels affichés (touche Origine). */
    fit(bottomInset = 0) {
      if (!ensureLayout()) return;
      const ids = [...shownNodes];
      if (!ids.length) return;
      const box = boxOf(ids);
      box.y1 -= COMMENT_HEAD + COMMENT_PAD;
      box.h += COMMENT_HEAD + COMMENT_PAD;
      // Sur petit écran, tout faire tenir rendrait les nœuds illisibles : on garde un zoom lisible et l'on navigue.
      frame(box, bottomInset, { pad: 24, minK: container.clientWidth < 600 ? 0.3 : 0.18, maxK: 1 });
    },

    zoomBy(factor) {
      if (!ensureLayout()) return;
      cancelAnimationFrame(anim);
      zoomAt(stepLevel(view.k, factor > 1 ? 1 : -1), container.clientWidth / 2, container.clientHeight / 2);
      showZoomLabel();
    },

    resize() {
      ensureLayout();
    },

    /** Remet les nœuds en colonnes par catégorie (après des déplacements manuels). */
    toggleLayout() {
      if (!ensureLayout()) return 'columns';
      autoLayout();
      placeNodes();
      renderWires();
      renderComments();
      api.fit(0);
      return 'columns';
    },

    syncOrientation() {
      return false;
    },

    refreshTheme() {},

    /** Pour les tests : coordonnées écran (fenêtre) d'un nœud ou du milieu d'un câble. */
    debugPoint(kind, id) {
      const r = container.getBoundingClientRect();
      if (kind === 'node') {
        const p = pos.get(id);
        const s = size.get(id);
        return { x: r.left + view.x + (p.x + s.w / 2) * view.k, y: r.top + view.y + (p.y + 18) * view.k };
      }
      const line = wires.get(id).line;
      const m = line.getPointAtLength(line.getTotalLength() / 2);
      return { x: r.left + view.x + m.x * view.k, y: r.top + view.y + m.y * view.k };
    },

    get view() {
      return { ...view };
    }
  };

  ensureLayout();
  return api;
}
