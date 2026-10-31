// Édition par le visiteur : formulaires pour ajouter / modifier / supprimer ses propres logiciels, liaisons et blocs.
// Les données de la base vérifiée ne sont jamais modifiées ; seuls les ajouts personnels le sont.
import { h, clear } from './util.js?v=20261031.10';
import { newId, exportWorkspace, importWorkspaceFile, emptyWorkspace, isEmpty } from './workspace.js?v=20261031.10';

const BLOCK_COLORS = [
  ['#5e6472', 'Gris'], ['#2e6bb8', 'Bleu'], ['#b03a2e', 'Rouge'], ['#3d8b37', 'Vert'],
  ['#7a4bb7', 'Violet'], ['#c77c12', 'Orange'], ['#1f8a99', 'Turquoise']
];

const clone = (ws) => JSON.parse(JSON.stringify(ws));

export function createEditor({ db, dialog, getWs, commit, viewCenter, toast }) {
  /* ------------------------------------------------------------ fenêtre de formulaire */
  function field(label, control, hint) {
    return h('label', { class: 'field' },
      h('span', { class: 'field-label', text: label }),
      control,
      hint ? h('span', { class: 'field-hint', text: hint }) : null);
  }
  const input = (name, value = '', attrs = {}) => h('input', { name, value, class: 'input', ...attrs });
  const select = (name, options, value) => {
    const el = h('select', { name, class: 'input' }, options.map(([v, label]) => h('option', { value: v, text: label })));
    if (value != null) el.value = value;
    return el;
  };

  function open(title, body, onSubmit, submitLabel = 'Enregistrer') {
    clear(dialog);
    const error = h('p', { class: 'form-error', role: 'alert', hidden: true });
    const form = h('form', { class: 'dialog-form', novalidate: true },
      h('div', { class: 'dialog-head' },
        h('h2', { id: 'dialog-title', text: title }),
        h('button', { type: 'button', class: 'dialog-x', 'aria-label': 'Fermer', onClick: () => dialog.close() }, '×')),
      h('div', { class: 'dialog-body' }, body, error),
      h('div', { class: 'dialog-actions' },
        h('button', { type: 'button', class: 'btn', onClick: () => dialog.close() }, 'Annuler'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, submitLabel)));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const message = onSubmit(new FormData(form));
      if (message) {
        error.textContent = message;
        error.hidden = false;
        return;
      }
      dialog.close();
    });
    dialog.append(form);
    dialog.showModal();
    form.querySelector('input, select, textarea')?.focus();
  }

  const softwareOptions = () => db.software
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
    .map((s) => [s.id, s.user ? `${s.name} (ajout personnel)` : s.name]);

  /* ------------------------------------------------------------ logiciel */
  function nodeForm(existing) {
    const n = existing || {};
    open(existing ? 'Modifier le logiciel' : 'Nouveau logiciel', [
      field('Nom *', input('name', n.name, { required: true, maxlength: 80, placeholder: 'Ex. : Advance Design' })),
      field('Étiquette du nœud', input('shortName', n.shortName, { maxlength: 16, placeholder: '16 caractères au plus' }), 'Affichée dans le graphe ; par défaut, le nom.'),
      field('Catégorie *', select('category', db.meta.categories.map((c) => [c.id, c.label]), n.category || 'calcul')),
      field('Éditeur', input('vendor', n.vendor, { maxlength: 80 })),
      field('Site officiel', input('website', n.website, { type: 'url', placeholder: 'https://…' })),
      field('Description', h('textarea', { name: 'description', class: 'input', rows: 3, maxlength: 600, text: n.description || '' }))
    ], (data) => {
      const name = String(data.get('name') || '').trim();
      if (!name) return 'Le nom est obligatoire.';
      const website = String(data.get('website') || '').trim();
      if (website && !/^https?:\/\//.test(website)) return 'Le site doit commencer par http:// ou https://';
      const ws = clone(getWs());
      const values = {
        name,
        shortName: String(data.get('shortName') || '').trim().slice(0, 16) || name.slice(0, 16),
        category: String(data.get('category')),
        vendor: String(data.get('vendor') || '').trim(),
        website,
        description: String(data.get('description') || '').trim()
      };
      let id = n.id;
      if (existing) {
        Object.assign(ws.nodes.find((x) => x.id === id), values);
      } else {
        id = newId('n');
        ws.nodes.push({ id, ...values });
        const c = viewCenter();
        ws.positions[id] = { x: Math.round(c.x - 145), y: Math.round(c.y - 40) };
      }
      commit(ws, { select: { type: 'software', id }, message: existing ? 'Logiciel modifié.' : 'Logiciel ajouté.' });
      return null;
    }, existing ? 'Enregistrer' : 'Ajouter');
  }

  /* ------------------------------------------------------------ liaison */
  function connectionForm({ existing, source, target } = {}) {
    const c = existing || {};
    const formatBoxes = h('div', { class: 'check-grid' }, db.formats.map((f) =>
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', name: 'formats', value: f.id, checked: (c.formats || []).includes(f.id) }),
        h('span', { text: f.name }))));
    open(existing ? 'Modifier la liaison' : 'Nouvelle liaison', [
      h('div', { class: 'field-row' },
        field('Logiciel source *', select('source', softwareOptions(), c.source || source)),
        field('Logiciel destination *', select('target', softwareOptions(), c.target || target))),
      h('div', { class: 'field-row' },
        field('Sens', select('direction', [['uni', 'Unidirectionnel (source → destination)'], ['bi', 'Bidirectionnel (⇄)']], c.direction || 'uni')),
        field('Type d’échange', select('kind', db.meta.kinds.map((k) => [k.id, k.label]), c.kind || 'open'))),
      h('fieldset', { class: 'field' }, h('legend', { class: 'field-label', text: 'Formats ou protocoles' }), formatBoxes),
      field('Résumé', input('summary', c.summary, { maxlength: 400, placeholder: 'Ex. : export IFC du modèle physique' })),
      field('Données transférables, remarques', h('textarea', { name: 'notes', class: 'input', rows: 3, maxlength: 1000, text: c.notes || '' })),
      h('p', { class: 'field-hint', text: 'Cette liaison sera marquée « ajout personnel, non vérifié ». Elle n’est visible que dans ce navigateur, sauf si vous exportez vos modifications.' })
    ], (data) => {
      const src = String(data.get('source'));
      const dst = String(data.get('target'));
      if (src === dst) return 'Choisissez deux logiciels différents.';
      const ws = clone(getWs());
      const values = {
        source: src,
        target: dst,
        direction: data.get('direction') === 'bi' ? 'bi' : 'uni',
        kind: String(data.get('kind')),
        formats: data.getAll('formats').map(String),
        summary: String(data.get('summary') || '').trim(),
        notes: String(data.get('notes') || '').trim()
      };
      let id = c.id;
      if (existing) {
        Object.assign(ws.connections.find((x) => x.id === id), values);
      } else {
        id = newId('c');
        ws.connections.push({ id, ...values, created: new Date().toISOString().slice(0, 10) });
      }
      commit(ws, { select: { type: 'connection', id }, message: existing ? 'Liaison modifiée.' : 'Liaison ajoutée.' });
      return null;
    }, existing ? 'Enregistrer' : 'Ajouter');
  }

  /* ------------------------------------------------------------ bloc */
  function blockForm(existing) {
    const b = existing || {};
    open(existing ? 'Modifier le bloc' : 'Nouveau bloc', [
      field('Titre *', input('title', b.title, { required: true, maxlength: 80, placeholder: 'Ex. : Chaîne BIM → calcul du projet' })),
      field('Couleur', select('color', BLOCK_COLORS, b.color || BLOCK_COLORS[0][0])),
      h('p', { class: 'field-hint', text: 'Un bloc est un cadre de commentaire : placez-le autour de logiciels pour les regrouper. Déplacer le bloc par son titre déplace aussi les logiciels qu’il contient ; le coin inférieur droit sert à le redimensionner.' })
    ], (data) => {
      const title = String(data.get('title') || '').trim();
      if (!title) return 'Le titre est obligatoire.';
      const ws = clone(getWs());
      let id = b.id;
      if (existing) {
        Object.assign(ws.blocks.find((x) => x.id === id), { title, color: String(data.get('color')) });
      } else {
        id = newId('b');
        const c = viewCenter();
        ws.blocks.push({ id, title, color: String(data.get('color')), x: Math.round(c.x - 220), y: Math.round(c.y - 150), w: 440, h: 300 });
      }
      commit(ws, { select: { type: 'block', id }, message: existing ? 'Bloc modifié.' : 'Bloc ajouté.' });
      return null;
    }, existing ? 'Enregistrer' : 'Ajouter');
  }

  /* ------------------------------------------------------------ actions sur la sélection */
  function edit(sel) {
    const ws = getWs();
    if (sel?.type === 'software') {
      const n = ws.nodes.find((x) => x.id === sel.id);
      if (n) nodeForm(n);
    } else if (sel?.type === 'connection') {
      const c = ws.connections.find((x) => x.id === sel.id);
      if (c) connectionForm({ existing: c });
    } else if (sel?.type === 'block') {
      const b = ws.blocks.find((x) => x.id === sel.id);
      if (b) blockForm(b);
    }
  }

  function remove(sel) {
    const ws = clone(getWs());
    if (sel?.type === 'software') {
      const n = ws.nodes.find((x) => x.id === sel.id);
      if (!n) return;
      const linked = ws.connections.filter((c) => c.source === n.id || c.target === n.id).length;
      const extra = linked ? ` et ${linked} liaison${linked > 1 ? 's' : ''} personnelle${linked > 1 ? 's' : ''}` : '';
      if (!window.confirm(`Supprimer « ${n.name} »${extra} ?`)) return;
      ws.nodes = ws.nodes.filter((x) => x.id !== n.id);
      ws.connections = ws.connections.filter((c) => c.source !== n.id && c.target !== n.id);
      delete ws.positions[n.id];
    } else if (sel?.type === 'connection') {
      if (!ws.connections.some((x) => x.id === sel.id)) return;
      if (!window.confirm('Supprimer cette liaison personnelle ?')) return;
      ws.connections = ws.connections.filter((x) => x.id !== sel.id);
    } else if (sel?.type === 'block') {
      const b = ws.blocks.find((x) => x.id === sel.id);
      if (!b || !window.confirm(`Supprimer le bloc « ${b.title} » ? (les logiciels qu’il contient restent)`)) return;
      ws.blocks = ws.blocks.filter((x) => x.id !== sel.id);
    } else {
      return;
    }
    commit(ws, { select: null, message: 'Supprimé.' });
  }

  /** Vrai si l'élément sélectionné est un ajout personnel (donc modifiable). */
  function isOwn(sel) {
    const ws = getWs();
    if (sel?.type === 'software') return ws.nodes.some((x) => x.id === sel.id);
    if (sel?.type === 'connection') return ws.connections.some((x) => x.id === sel.id);
    return sel?.type === 'block' && ws.blocks.some((x) => x.id === sel.id);
  }

  /* ------------------------------------------------------------ export / import / réinitialisation */
  function exportAll() {
    const ws = getWs();
    if (isEmpty(ws)) { toast('Aucune modification à exporter.'); return; }
    exportWorkspace(ws);
    toast('Fichier exporté.');
  }

  async function importFile(file) {
    try {
      const imported = await importWorkspaceFile(file, db.meta);
      const current = getWs();
      if (!isEmpty(current) && !window.confirm('Remplacer vos modifications actuelles par celles du fichier ?')) return;
      commit(imported, { select: null, message: 'Modifications importées.' });
    } catch (err) {
      toast(err.message || 'Import impossible.');
    }
  }

  function resetAll() {
    if (isEmpty(getWs())) { toast('Rien à réinitialiser : aucune modification enregistrée.'); return; }
    if (!window.confirm('Supprimer tous vos ajouts (logiciels, liaisons, blocs) et les positions des nœuds ? Pensez à exporter avant si vous voulez les garder.')) return;
    commit(emptyWorkspace(), { select: null, message: 'Modifications supprimées : retour à la base vérifiée.' });
  }

  return { nodeForm, connectionForm, blockForm, edit, remove, isOwn, exportAll, importFile, resetAll };
}
