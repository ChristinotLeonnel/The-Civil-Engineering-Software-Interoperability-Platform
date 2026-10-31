// Espace de travail personnel : logiciels, liaisons et blocs ajoutés par le visiteur, positions des nœuds.
// Tout reste dans le navigateur du visiteur (localStorage) ; export / import en JSON pour partager.
// Les ajouts ne modifient jamais la base vérifiée : ils sont fusionnés à l'affichage et marqués « non vérifiés ».

const KEY = 'imap.workspace.v1';
const VERSION = 1;
const ID_RE = /^u-[a-z0-9-]{3,40}$/;

export function emptyWorkspace() {
  return { version: VERSION, nodes: [], connections: [], blocks: [], positions: {} };
}

export function newId(prefix) {
  return `u-${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const str = (v, max = 400) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v) => (Number.isFinite(v) ? Math.round(v) : null);

/** Nettoie un espace de travail lu depuis le stockage ou un fichier importé : seuls les champs connus passent. */
export function sanitize(raw, meta) {
  const ws = emptyWorkspace();
  if (!raw || typeof raw !== 'object') return ws;
  const cats = new Set(meta.categories.map((c) => c.id));
  const kinds = new Set(meta.kinds.map((k) => k.id));

  for (const n of Array.isArray(raw.nodes) ? raw.nodes : []) {
    if (!ID_RE.test(n?.id) || !str(n.name) || !cats.has(n.category)) continue;
    ws.nodes.push({
      id: n.id,
      name: str(n.name, 80),
      shortName: str(n.shortName, 16) || str(n.name, 16),
      category: n.category,
      vendor: str(n.vendor, 80),
      description: str(n.description, 600),
      website: /^https?:\/\//.test(str(n.website)) ? str(n.website) : ''
    });
  }
  for (const c of Array.isArray(raw.connections) ? raw.connections : []) {
    if (!ID_RE.test(c?.id) || !kinds.has(c.kind) || !str(c.source) || !str(c.target) || c.source === c.target) continue;
    ws.connections.push({
      id: c.id,
      source: str(c.source, 60),
      target: str(c.target, 60),
      direction: c.direction === 'bi' ? 'bi' : 'uni',
      kind: c.kind,
      formats: Array.isArray(c.formats) ? c.formats.filter((f) => typeof f === 'string').slice(0, 10) : [],
      summary: str(c.summary, 400),
      notes: str(c.notes, 1000),
      created: /^\d{4}-\d{2}-\d{2}$/.test(c.created) ? c.created : new Date().toISOString().slice(0, 10)
    });
  }
  for (const b of Array.isArray(raw.blocks) ? raw.blocks : []) {
    if (!ID_RE.test(b?.id)) continue;
    const [x, y, w, h] = [num(b.x), num(b.y), num(b.w), num(b.h)];
    if ([x, y, w, h].some((v) => v === null)) continue;
    ws.blocks.push({
      id: b.id,
      title: str(b.title, 80) || 'Bloc',
      color: /^#[0-9a-fA-F]{6}$/.test(b.color) ? b.color : '#5e6472',
      x, y, w: Math.max(160, w), h: Math.max(100, h)
    });
  }
  if (raw.positions && typeof raw.positions === 'object') {
    for (const [id, p] of Object.entries(raw.positions)) {
      if (typeof id !== 'string' || id.length > 60) continue;
      const x = num(p?.x);
      const y = num(p?.y);
      if (x !== null && y !== null) ws.positions[id] = { x, y };
    }
  }
  // Une liaison vers un logiciel inexistant est écartée à la fusion (buildDb ignore les références inconnues).
  return ws;
}

export function loadWorkspace(meta) {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? sanitize(JSON.parse(raw), meta) : emptyWorkspace();
  } catch {
    return emptyWorkspace();
  }
}

/** Enregistre ; renvoie false si le stockage est indisponible (navigation privée, quota). */
export function saveWorkspace(ws) {
  try {
    localStorage.setItem(KEY, JSON.stringify(ws));
    return true;
  } catch {
    return false;
  }
}

export function isEmpty(ws) {
  return !ws.nodes.length && !ws.connections.length && !ws.blocks.length && !Object.keys(ws.positions).length;
}

/** Base vérifiée + ajouts personnels, au format attendu par buildDb. */
export function mergeWorkspace(base, ws) {
  const today = new Date().toISOString().slice(0, 10);
  const software = [...base.software];
  for (const n of ws.nodes) {
    software.push({
      ...n,
      user: true,
      license: 'Ajout personnel',
      formats: [],
      // ordre dans la colonne : en bas, sauf position enregistrée
      position: { x: 0, y: 100000 }
    });
  }
  const connections = [...base.connections];
  for (const c of ws.connections) {
    connections.push({
      id: c.id,
      source: c.source,
      target: c.target,
      direction: c.direction,
      kind: c.kind,
      formats: c.formats,
      summary: c.summary || 'Liaison ajoutée par l’utilisateur.',
      transfers: c.notes ? [c.notes] : ['Non précisé.'],
      limitations: ['Ajout personnel : cette liaison n’a pas été vérifiée par des sources et n’engage que son auteur.'],
      versions: '',
      confidence: 'low',
      evidence: 'user',
      verifiedOn: c.created || today,
      sources: [],
      user: true
    });
  }
  return { meta: base.meta, formats: base.formats, software, connections };
}

export function exportWorkspace(ws) {
  const blob = new Blob([JSON.stringify({ ...ws, exported: new Date().toISOString() }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `interop-map-modifications-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function importWorkspaceFile(file, meta) {
  if (file.size > 2_000_000) throw new Error('Fichier trop volumineux (2 Mo au maximum).');
  const text = await file.text();
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Ce fichier n’est pas un JSON valide.');
  }
  const ws = sanitize(raw, meta);
  if (isEmpty(ws)) throw new Error('Aucune modification reconnue dans ce fichier.');
  return ws;
}
