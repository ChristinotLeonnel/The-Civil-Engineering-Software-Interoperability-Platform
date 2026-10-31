// Chargement et indexation de la base de données (data/*.json).
// Les entrées incohérentes sont ignorées avec un avertissement console, pour qu'une erreur de saisie
// ne casse pas tout le site. Le contrôle strict se fait avec scripts/validate_data.py.

const FILES = ['meta', 'software', 'connections', 'formats'];

/** Charge la base vérifiée telle qu'elle est publiée (sans index). */
export async function loadBase() {
  const loaded = await Promise.all(
    FILES.map(async (name) => {
      const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Impossible de charger data/${name}.json (HTTP ${res.status})`);
      return res.json();
    })
  );
  const [meta, software, connections, formats] = loaded;
  return { meta, software, connections, formats };
}

/** Catalogues de la base documentaire (références, méthodes, normes, Madagascar, liste des fiches). */
export async function loadKnowledge() {
  const names = ['references', 'methods', 'standards', 'madagascar', 'profiles/index'];
  const [references, methods, standards, madagascar, profileIds] = await Promise.all(
    names.map(async (name) => {
      const res = await fetch(`data/${name}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error(`Impossible de charger data/${name}.json (HTTP ${res.status})`);
      return res.json();
    })
  );
  return {
    references: new Map(references.map((r) => [r.id, r])),
    methods,
    standards,
    madagascar,
    profileIds: new Set(profileIds),
    profiles: new Map()
  };
}

/** Fiche détaillée d'un logiciel, chargée à la demande ; null si elle n'existe pas encore. */
export async function loadProfile(kb, id) {
  if (!kb.profileIds.has(id)) return null;
  if (!kb.profiles.has(id)) {
    const res = await fetch(`data/profiles/${encodeURIComponent(id)}.json`, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`Impossible de charger la fiche ${id} (HTTP ${res.status})`);
    kb.profiles.set(id, await res.json());
  }
  return kb.profiles.get(id);
}

/** Construit les index à partir de listes brutes (base vérifiée, éventuellement complétée des ajouts personnels). */
export function buildDb({ meta, software, connections, formats }) {
  const catById = new Map(meta.categories.map((c) => [c.id, c]));
  const kindById = new Map(meta.kinds.map((k) => [k.id, k]));
  const confById = new Map(meta.confidence.map((c) => [c.id, c]));
  const formatById = new Map(formats.map((f) => [f.id, f]));

  // Sans position : le logiciel se range en bas de la colonne de sa catégorie.
  const goodSoftware = software.map((s) => (s.position ? s : { ...s, position: { x: 0, y: 100000 } })).filter((s) => {
    const ok = catById.has(s.category);
    if (!ok) console.warn('Logiciel ignoré (catégorie inconnue) :', s.id);
    return ok;
  });
  const softwareById = new Map(goodSoftware.map((s) => [s.id, s]));

  const goodConnections = connections.filter((c) => {
    const ok = softwareById.has(c.source) && softwareById.has(c.target) && kindById.has(c.kind);
    if (!ok) console.warn('Connexion ignorée (référence inconnue) :', c.id);
    return ok;
  });
  const connectionById = new Map(goodConnections.map((c) => [c.id, c]));

  const connsBySoftware = new Map(goodSoftware.map((s) => [s.id, []]));
  const connsByFormat = new Map(formats.map((f) => [f.id, []]));
  for (const c of goodConnections) {
    connsBySoftware.get(c.source).push(c);
    connsBySoftware.get(c.target).push(c);
    for (const fid of c.formats || []) connsByFormat.get(fid)?.push(c);
  }

  return {
    meta,
    software: goodSoftware,
    connections: goodConnections,
    formats,
    catById,
    kindById,
    confById,
    formatById,
    softwareById,
    connectionById,
    connsBySoftware,
    connsByFormat
  };
}

export function otherEnd(connection, softwareId) {
  return connection.source === softwareId ? connection.target : connection.source;
}

export function formatNames(db, ids) {
  return (ids || []).map((id) => db.formatById.get(id)?.name ?? id);
}
