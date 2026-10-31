// Petits utilitaires DOM. Tout le contenu issu des données passe par textContent :
// aucune chaîne de données n'est jamais interprétée comme du HTML.

export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key === 'text') el.textContent = value;
    else if (key === 'dataset') Object.assign(el.dataset, value);
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2).toLowerCase(), value);
    else el.setAttribute(key, value === true ? '' : String(value));
  }
  append(el, children);
  return el;
}

export function append(parent, children) {
  for (const child of children.flat(Infinity)) {
    if (child == null || child === false) continue;
    parent.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return parent;
}

export function clear(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
  return el;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
export function svg(tag, attrs, ...children) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, String(v));
  for (const c of children.flat()) if (c) el.append(c);
  return el;
}

export function kindColor(kind) {
  return kind.color;
}

const DASH = { solid: '', dashed: '7 4', dotted: '1 5', 'dashed-sparse': '4 8' };
export function dashArray(dash) {
  return DASH[dash] ?? '';
}

// Échantillon de ligne pour la légende : même style (couleur, tirets, flèches) que sur la carte.
// mode : 'right' (→), 'left' (←) ou 'both' (↔). `true` vaut 'both', `false` vaut 'right'.
export function kindSwatch(kind, mode = 'right') {
  if (mode === true) mode = 'both';
  if (mode === false) mode = 'right';
  const color = kindColor(kind);
  const width = Math.max(2, kind.width - 0.5);
  const toRight = mode === 'right' || mode === 'both';
  const toLeft = mode === 'left' || mode === 'both';
  const s = svg('svg', { width: 52, height: 16, viewBox: '0 0 52 16', 'aria-hidden': 'true', focusable: 'false' });
  s.append(svg('line', {
    x1: toLeft ? 8 : 2, y1: 8, x2: toRight ? 44 : 50, y2: 8,
    stroke: color, 'stroke-width': width,
    'stroke-dasharray': dashArray(kind.dash), 'stroke-linecap': kind.dash === 'dotted' ? 'round' : 'butt'
  }));
  if (toRight) s.append(svg('polygon', { points: '50,8 43,4 43,12', fill: color }));
  if (toLeft) s.append(svg('polygon', { points: '2,8 9,4 9,12', fill: color }));
  return s;
}

export function norm(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function formatDate(iso) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export function plural(n, one, many) {
  return `${n} ${n > 1 ? many : one}`;
}
