// Panneau de détails : fiche d'un logiciel, d'une connexion ou d'un bloc.
import { h, clear, kindSwatch, kindColor, formatDate, hostOf, plural } from './util.js?v=20261031.10';
import { otherEnd } from './data.js?v=20261031.10';

const EVIDENCE_LABEL = {
  read: 'Pages de documentation consultées en entier',
  excerpt: 'Extraits des pages officielles obtenus par recherche (à relire à la source)',
  community: 'Sources communautaires (forums, rapports de bugs) : indices, pas une garantie',
  user: 'Ajout personnel de l’utilisateur : aucune source vérifiée'
};

// Section repliable du panneau.
function section(title, ...children) {
  return h('details', { class: 'ue-section', open: true },
    h('summary', { text: title }),
    h('div', { class: 'ue-section-body' }, children));
}

export function createPanel({ db, root, stage, body, kicker, closeBtn, actions }) {
  let open = false;

  closeBtn.addEventListener('click', () => actions.clearSelection());

  function show(kickerText, nodes) {
    kicker.textContent = kickerText;
    clear(body);
    body.append(...nodes.filter(Boolean));
    body.scrollTop = 0;
    open = true;
    stage.classList.add('panel-open');
    root.setAttribute('aria-hidden', 'false');
  }

  /** Boutons Modifier / Supprimer pour un ajout personnel ; note de lecture seule pour la base vérifiée en mode édition. */
  function editActions(sel, { own, linkFrom } = {}) {
    if (own) {
      return h('div', { class: 'panel-actions' },
        h('span', { class: 'badge user-badge', text: sel.type === 'block' ? 'Ajout personnel' : 'Ajout personnel · non vérifié' }),
        h('button', { type: 'button', class: 'btn btn-primary', onClick: () => actions.editItem(sel) }, '✎ Modifier'),
        h('button', { type: 'button', class: 'btn btn-danger', onClick: () => actions.deleteItem(sel) }, 'Supprimer'),
        linkFrom ? h('button', { type: 'button', class: 'btn', onClick: () => actions.linkFrom(linkFrom) }, '＋ Relier à…') : null);
    }
    if (!actions.isEditing()) return null;
    return h('div', { class: 'panel-actions' },
      h('span', { class: 'meta', text: 'Donnée de la base vérifiée : lecture seule. Vous pouvez la déplacer et la relier à vos propres ajouts.' }),
      linkFrom ? h('button', { type: 'button', class: 'btn', onClick: () => actions.linkFrom(linkFrom) }, '＋ Relier à…') : null);
  }

  function formatChips(ids) {
    if (!ids || !ids.length) return h('p', { class: 'meta', text: 'Aucun format précis documenté pour cette liaison.' });
    return h('div', { class: 'badges' }, ids.map((id) => {
      const f = db.formatById.get(id);
      return h('button', {
        type: 'button',
        class: 'fmt-chip',
        title: f ? `${f.fullName} — voir la fiche du format` : id,
        onClick: () => actions.openFormat(id)
      }, f ? f.name : id);
    }));
  }

  function confidenceBadge(c) {
    if (c.user) return h('span', { class: 'badge conf-low' }, 'Non vérifié (ajout personnel)');
    const conf = db.confById.get(c.confidence);
    return h('span', { class: `badge conf-${c.confidence}`, title: conf?.description }, `Confiance : ${conf?.label ?? c.confidence}`);
  }

  function connectionButton(connection, fromId) {
    const kind = db.kindById.get(connection.kind);
    const other = db.softwareById.get(otherEnd(connection, fromId));
    const arrow = connection.direction === 'bi' ? '↔' : connection.source === fromId ? '→' : '←';
    const fmts = (connection.formats || []).map((id) => db.formatById.get(id)?.name ?? id).join(', ');
    const conf = connection.user ? 'ajout personnel' : `confiance ${db.confById.get(connection.confidence)?.label.toLowerCase()}`;
    return h('li', {}, h('button', {
      type: 'button',
      class: 'conn-btn',
      onClick: () => actions.selectConnection(connection.id)
    },
      kindSwatch(kind, connection.direction === 'bi' ? 'both' : connection.source === fromId ? 'right' : 'left'),
      h('span', { class: 'conn-main' },
        h('span', { class: 'conn-title', text: `${arrow} ${other.name}` }),
        h('span', { class: 'conn-sub', text: ` ${kind.short}${fmts ? ' · ' + fmts : ''} · ${conf}` })
      )
    ));
  }

  function showSoftware(id) {
    const s = db.softwareById.get(id);
    const cat = db.catById.get(s.category);
    const conns = (db.connsBySoftware.get(id) || []).slice().sort(
      (a, b) => db.kindById.get(a.kind).rank - db.kindById.get(b.kind).rank
    );
    const sel = { type: 'software', id };
    const nodes = [
      h('div', { class: 'sw-head' },
        s.logo ? h('img', { class: 'sw-logo', src: s.logo, alt: '', loading: 'lazy' }) : h('span', { class: 'dot', style: `background:${cat.color}` }),
        h('h2', { text: s.name })
      ),
      editActions(sel, { own: Boolean(s.user), linkFrom: id }),
      h('div', { class: 'badges' },
        h('span', { class: 'badge', text: cat.label }),
        s.license ? h('span', { class: 'badge', text: s.license }) : null
      ),
      s.vendor ? h('p', { class: 'meta', text: `Éditeur / projet : ${s.vendor}` }) : null,
      s.description ? h('p', { text: s.description }) : null,
      s.website ? h('p', {}, h('a', { href: s.website, target: '_blank', rel: 'noopener noreferrer' }, `Site officiel (${hostOf(s.website)}) ↗`)) : null,
      section(`Connexions (${conns.length})`,
        conns.length
          ? h('ul', { class: 'conn-list' }, conns.map((c) => connectionButton(c, id)))
          : h('p', { class: 'meta', text: 'Aucune connexion documentée dans cette base pour ce logiciel. Cela ne prouve pas qu’aucun échange n’existe.' })),
      s.user ? null : section('Formats mentionnés dans cette base', formatChips(s.formats))
    ];
    show(s.user ? 'Logiciel · ajout personnel' : 'Logiciel', nodes);
  }

  function showConnection(id) {
    const c = db.connectionById.get(id);
    const kind = db.kindById.get(c.kind);
    const a = db.softwareById.get(c.source);
    const b = db.softwareById.get(c.target);
    const bi = c.direction === 'bi';

    const sources = c.sources.map((src) =>
      h('li', {}, h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' },
        src.title, h('span', { class: 'host', text: hostOf(src.url) + ' ↗' })))
    );

    const nodes = [
      h('div', { class: 'ends' },
        h('button', { type: 'button', class: 'end-btn', style: `border-color:${db.catById.get(a.category).color}`, onClick: () => actions.selectSoftware(a.id) }, a.name),
        h('span', { class: 'arrow-glyph', 'aria-label': bi ? 'dans les deux sens' : 'vers' }, bi ? '⇄' : '→'),
        h('button', { type: 'button', class: 'end-btn', style: `border-color:${db.catById.get(b.category).color}`, onClick: () => actions.selectSoftware(b.id) }, b.name)
      ),
      h('h2', { text: bi ? `${a.name} ↔ ${b.name}` : `${a.name} → ${b.name}` }),
      editActions({ type: 'connection', id }, { own: Boolean(c.user) }),
      h('div', { class: 'badges' },
        h('span', { class: 'badge', title: kind.description, style: `border-color:${kindColor(kind)}` }, kindSwatch(kind, bi), kind.label),
        confidenceBadge(c)
      ),
      c.kind === 'conditional' || c.user
        ? h('div', { class: 'warn', role: 'note', text: c.user
          ? 'Ajout personnel : cette liaison n’a pas été vérifiée par des sources. Elle n’est visible que dans ce navigateur, sauf export.'
          : 'Compatibilité conditionnelle ou non vérifiée : ne pas considérer ce transfert comme acquis. Un format commun ne garantit pas que deux logiciels échangent correctement.' })
        : null,
      h('p', { text: c.summary }),

      section('Format ou protocole d’échange', formatChips(c.formats)),
      section('Sens du transfert', h('p', { text: bi
        ? `Bidirectionnel : ${a.name} ⇄ ${b.name}.`
        : `Unidirectionnel : de ${a.name} vers ${b.name}${c.user ? '.' : ' d’après les sources consultées.'}` })),
      section('Données transférables', h('ul', { class: 'plain' }, c.transfers.map((t) => h('li', { text: t })))),
      section('Limitations éventuelles', h('ul', { class: 'plain' }, c.limitations.map((t) => h('li', { text: t })))),
      c.user ? null : section('Versions compatibles', h('p', { text: c.versions || 'Non documenté dans les sources consultées.' })),
      c.user ? null : section('Documentation et sources', h('ul', { class: 'link-list' }, sources)),
      section('Vérification',
        h('p', { text: c.user ? `Ajoutée le ${formatDate(c.verifiedOn)}.` : `Dernière revue : ${formatDate(c.verifiedOn)}.` }),
        h('p', { class: 'meta', text: `Nature des preuves : ${EVIDENCE_LABEL[c.evidence] ?? c.evidence}.` }),
        h('p', { class: 'meta', text: db.meta.disclaimer }))
    ];
    show(c.user ? 'Connexion · ajout personnel' : 'Connexion', nodes);
  }

  function showBlock(b) {
    show('Bloc', [
      h('div', { class: 'sw-head' }, h('span', { class: 'dot', style: `background:${b.color}` }), h('h2', { text: b.title })),
      editActions({ type: 'block', id: b.id }, { own: true }),
      h('p', { class: 'meta', text: 'Cadre de commentaire ajouté par l’utilisateur. Glissez son titre pour le déplacer avec les logiciels qu’il contient ; en mode édition, le coin inférieur droit le redimensionne.' })
    ]);
  }

  function hide() {
    open = false;
    stage.classList.remove('panel-open');
    root.setAttribute('aria-hidden', 'true');
  }

  return {
    showSoftware,
    showConnection,
    showBlock,
    hide,
    isOpen: () => open,
    height: () => (open ? root.offsetHeight : 0),
    focus: () => root.focus({ preventScroll: true }),
    countLabel: (n) => plural(n, 'connexion', 'connexions')
  };
}
