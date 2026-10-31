// Carte interactive (Cytoscape.js). Aucune logique métier ici : le module affiche l'état qu'on lui donne
// et signale les clics via des callbacks.
import { isDark, kindColor, dashArray } from './util.js';
import { formatNames } from './data.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const NODE_FONT = 15;

const isShown = (ele) => !ele.hasClass('hide');

function distanceToSegment(p, a, b) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function createGraph(container, db, callbacks) {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const edgeBoost = coarse ? 0.5 : 0;

  // Largeur des nœuds mesurée au canvas (l'option Cytoscape width:'label' est dépréciée).
  const measurer = document.createElement('canvas').getContext('2d');
  measurer.font = `700 ${NODE_FONT}px ${FONT}`;
  const nodeWidth = (text) => Math.max(64, Math.ceil(measurer.measureText(text).width) + 26);

  const homes = {
    landscape: new Map(db.software.map((s) => [s.id, { x: s.position.x, y: s.position.y }])),
    portrait: new Map(db.software.map((s) => [s.id, { ...(s.positionPortrait || s.position) }]))
  };
  const orientationNow = () => (container.clientWidth / Math.max(container.clientHeight, 1) < 0.85 ? 'portrait' : 'landscape');
  let orientation = orientationNow();

  const elements = [
    ...db.software.map((s) => {
      const label = s.shortName || s.name;
      return {
        group: 'nodes',
        data: { id: s.id, label, w: nodeWidth(label), category: s.category, color: db.catById.get(s.category).color },
        position: { ...homes[orientation].get(s.id) }
      };
    }),
    ...db.connections.map((c) => ({
      group: 'edges',
      data: {
        id: c.id,
        source: c.source,
        target: c.target,
        kind: c.kind,
        bi: c.direction === 'bi',
        formats: c.formats || [],
        formatsLabel: formatNames(db, c.formats).join(' · ')
      },
      classes: c.direction === 'bi' ? 'bi' : 'uni'
    }))
  ];

  const cy = window.cytoscape({
    container,
    elements,
    style: buildStyle(db),
    layout: { name: 'preset' },
    minZoom: 0.25,
    maxZoom: 3,
    boxSelectionEnabled: false,
    autounselectify: true,
    pixelRatio: 'auto',
    textureOnViewport: false
  });

  let selected = null; // { type: 'node' | 'edge', id }
  let layoutMode = 'preset';

  cy.on('tap', 'node', (evt) => callbacks.onNode(evt.target.id()));
  cy.on('tap', 'edge', (evt) => callbacks.onEdge(evt.target.id()));
  // Tolérance de toucher : un tap qui tombe près d'une arête (sans la toucher exactement) la sélectionne.
  // Les arêtes sont fines ; sur écran tactile le doigt couvre bien plus que leur largeur.
  cy.on('tap', (evt) => {
    if (evt.target !== cy) return;
    const limit = coarse ? 18 : 7;
    const p = evt.renderedPosition;
    let best = null;
    let bestDist = limit;
    cy.edges().filter(isShown).forEach((edge) => {
      const d = distanceToSegment(p, edge.source().renderedPosition(), edge.target().renderedPosition());
      if (d < bestDist) { bestDist = d; best = edge; }
    });
    if (best) callbacks.onEdge(best.id());
    else callbacks.onBackground();
  });
  cy.on('mouseover', 'node, edge', () => { container.style.cursor = 'pointer'; });
  cy.on('mouseout', 'node, edge', () => { container.style.cursor = ''; });

  function applyEmphasis() {
    cy.batch(() => {
      cy.elements().removeClass('faded sel hl');
      if (!selected) return;
      if (selected.type === 'node') {
        const node = cy.getElementById(selected.id);
        const keep = node.closedNeighborhood().filter(isShown);
        cy.elements().not(keep).addClass('faded');
        node.addClass('sel');
        keep.edges().addClass('hl');
      } else {
        const edge = cy.getElementById(selected.id);
        const keep = edge.connectedNodes().union(edge);
        cy.elements().not(keep).addClass('faded');
        edge.addClass('sel hl');
        edge.connectedNodes().addClass('sel');
      }
    });
  }

  function bottomInsetPx(inset) {
    return Math.max(0, inset || 0);
  }

  return {
    cy,

    /** Filtres de visibilité : catégories et types actifs, format optionnel. */
    setFilters({ cats, kinds, format }) {
      cy.batch(() => {
        cy.nodes().forEach((n) => n.toggleClass('hide', !cats.has(n.data('category'))));
        const linked = new Set(); // logiciels qui conservent au moins une liaison affichée
        cy.edges().forEach((e) => {
          const hidden =
            !kinds.has(e.data('kind')) ||
            e.source().hasClass('hide') ||
            e.target().hasClass('hide') ||
            (format && !e.data('formats').includes(format));
          e.toggleClass('hide', Boolean(hidden));
          if (!hidden) {
            linked.add(e.data('source'));
            linked.add(e.data('target'));
          }
        });
        // Quand un format est filtré, les logiciels sans liaison restante s'estompent.
        cy.nodes().forEach((n) => n.toggleClass('dim', Boolean(format) && !linked.has(n.id())));
      });
      applyEmphasis();
    },

    /** Recherche : estompe les logiciels qui ne correspondent pas (null = pas de recherche). */
    setMatches(ids) {
      cy.batch(() => {
        cy.nodes().forEach((n) => n.toggleClass('search-dim', ids != null && !ids.has(n.id())));
      });
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
      const node = cy.getElementById(id);
      if (node.empty()) return;
      const zoom = Math.max(cy.zoom(), 0.8);
      const visibleH = container.clientHeight - bottomInsetPx(bottomInset);
      const pos = node.position();
      cy.animate({
        zoom,
        pan: { x: container.clientWidth / 2 - pos.x * zoom, y: visibleH / 2 - pos.y * zoom }
      }, { duration: 260 });
    },

    centerOnEdge(id, bottomInset = 0) {
      const edge = cy.getElementById(id);
      if (edge.empty()) return;
      const box = edge.connectedNodes().boundingBox({ includeLabels: false });
      const visibleH = Math.max(120, container.clientHeight - bottomInsetPx(bottomInset));
      const pad = 40;
      const zoom = Math.min(
        1.4,
        Math.max(0.5, Math.min((container.clientWidth - pad * 2) / Math.max(box.w, 1), (visibleH - pad * 2) / Math.max(box.h, 1)))
      );
      const cx = (box.x1 + box.x2) / 2;
      const cyy = (box.y1 + box.y2) / 2;
      cy.animate({
        zoom,
        pan: { x: container.clientWidth / 2 - cx * zoom, y: visibleH / 2 - cyy * zoom }
      }, { duration: 260 });
    },

    /** Cadre tous les éléments visibles dans la zone libre (hors panneau ou encart du bas). */
    fit(bottomInset = 0) {
      const nodes = cy.nodes().filter(isShown);
      if (nodes.empty()) return;
      cy.stop();
      const pad = 28;
      const box = nodes.boundingBox({ includeLabels: false });
      const w = container.clientWidth;
      const h = Math.max(120, container.clientHeight - bottomInsetPx(bottomInset));
      const zoom = Math.min(
        cy.maxZoom(),
        Math.max(cy.minZoom(), Math.min((w - pad * 2) / Math.max(box.w, 1), (h - pad * 2) / Math.max(box.h, 1)))
      );
      cy.zoom(zoom);
      cy.pan({
        x: w / 2 - ((box.x1 + box.x2) / 2) * zoom,
        y: h / 2 - ((box.y1 + box.y2) / 2) * zoom
      });
    },

    zoomBy(factor) {
      const z = Math.min(cy.maxZoom(), Math.max(cy.minZoom(), cy.zoom() * factor));
      cy.animate({ zoom: { level: z, renderedPosition: { x: container.clientWidth / 2, y: container.clientHeight / 2 } } }, { duration: 160 });
    },

    resize() {
      cy.resize();
    },

    /** Si l'écran passe de paysage à portrait (ou l'inverse), reprend la disposition adaptée. */
    syncOrientation() {
      const next = orientationNow();
      if (next === orientation) return false;
      orientation = next;
      if (layoutMode !== 'preset') return false;
      cy.layout({ name: 'preset', positions: (n) => homes[orientation].get(n.id()), animate: false, fit: false }).run();
      return true;
    },

    toggleLayout() {
      layoutMode = layoutMode === 'preset' ? 'cose' : 'preset';
      const options = layoutMode === 'preset'
        ? { name: 'preset', positions: (n) => homes[orientation].get(n.id()), animate: true, animationDuration: 400, fit: true, padding: 36 }
        : { name: 'cose', animate: true, animationDuration: 500, fit: true, padding: 36, randomize: false, nodeRepulsion: () => 90000, idealEdgeLength: () => 140, nodeOverlap: 40 };
      cy.layout(options).run();
      return layoutMode;
    },

    refreshTheme() {
      cy.style(buildStyle(db));
    },

    destroy() {
      cy.destroy();
    }
  };

  function buildStyle(database) {
    const dark = isDark();
    const labelBg = dark ? '#131c2e' : '#ffffff';
    const labelFg = dark ? '#e8edf6' : '#0f172a';

    const style = [
      {
        selector: 'node',
        style: {
          shape: 'round-rectangle',
          label: 'data(label)',
          'background-color': 'data(color)',
          color: '#ffffff',
          'font-family': FONT,
          'font-size': NODE_FONT,
          'font-weight': 700,
          'text-valign': 'center',
          'text-halign': 'center',
          width: 'data(w)',
          height: 38,
          padding: 0,
          'border-width': 2,
          'border-color': dark ? '#e8edf6' : '#ffffff',
          'overlay-opacity': 0,
          'min-zoomed-font-size': 0
        }
      },
      { selector: 'node.sel', style: { 'border-width': 5, 'border-color': '#facc15', 'z-index': 20 } },
      {
        selector: 'edge',
        style: {
          'curve-style': 'bezier',
          'line-color': '#64748b',
          'target-arrow-shape': 'triangle',
          'target-arrow-color': '#64748b',
          'arrow-scale': 1.1,
          width: 3,
          opacity: 0.95,
          'overlay-opacity': 0,
          'font-family': FONT,
          'font-size': 12,
          'font-weight': 700,
          color: labelFg,
          'text-background-color': labelBg,
          'text-background-opacity': 0.92,
          'text-background-padding': 3,
          'text-background-shape': 'roundrectangle'
        }
      },
      { selector: 'edge.bi', style: { 'source-arrow-shape': 'triangle' } },
      { selector: 'edge.sel', style: { label: 'data(formatsLabel)', 'z-index': 30, width: 6 } },
      { selector: 'edge.hl', style: { opacity: 1 } },
      { selector: '.faded', style: { opacity: 0.14 } },
      { selector: 'node.dim, node.search-dim', style: { opacity: 0.22 } },
      { selector: '.hide', style: { display: 'none' } }
    ];

    for (const kind of database.meta.kinds) {
      const color = kindColor(kind);
      const pattern = dashArray(kind.dash).split(' ').filter(Boolean).map(Number);
      const lineStyle = kind.dash === 'solid' ? 'solid' : kind.dash === 'dotted' ? 'dotted' : 'dashed';
      const edgeStyle = {
        'line-color': color,
        'target-arrow-color': color,
        'source-arrow-color': color,
        'line-style': lineStyle,
        width: kind.width + edgeBoost
      };
      if (lineStyle === 'dashed' && pattern.length) edgeStyle['line-dash-pattern'] = pattern;
      style.push({ selector: `edge[kind = "${kind.id}"]`, style: edgeStyle });
      style.push({ selector: `edge.sel[kind = "${kind.id}"]`, style: { width: kind.width + 3 + edgeBoost } });
    }
    return style;
  }
}
