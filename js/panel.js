// Panneau de détails : fiche d'un logiciel ou d'une connexion.
import { h, clear, kindSwatch, kindColor, formatDate, hostOf, plural } from './util.js?v=20261031.3';
import { otherEnd } from './data.js?v=20261031.3';

const EVIDENCE_LABEL = {
  read: 'Pages de documentation consultées en entier',
  excerpt: 'Extraits des pages officielles obtenus par recherche (à relire à la source)',
  community: 'Sources communautaires (forums, rapports de bugs) : indices, pas une garantie'
};

// Section repliable, à la manière des catégories du panneau « Details » d'Unreal.
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

  function confidenceBadge(conf) {
    const c = db.confById.get(conf);
    return h('span', { class: `badge conf-${conf}`, title: c?.description }, `Confiance : ${c?.label ?? conf}`);
  }

  function connectionButton(connection, fromId) {
    const kind = db.kindById.get(connection.kind);
    const other = db.softwareById.get(otherEnd(connection, fromId));
    const arrow = connection.direction === 'bi' ? '↔' : connection.source === fromId ? '→' : '←';
    const fmts = (connection.formats || []).map((id) => db.formatById.get(id)?.name ?? id).join(', ');
    return h('li', {}, h('button', {
      type: 'button',
      class: 'conn-btn',
      onClick: () => actions.selectConnection(connection.id)
    },
      kindSwatch(kind, connection.direction === 'bi' ? 'both' : connection.source === fromId ? 'right' : 'left'),
      h('span', { class: 'conn-main' },
        h('span', { class: 'conn-title', text: `${arrow} ${other.name}` }),
        h('span', { class: 'conn-sub', text: ` ${kind.short}${fmts ? ' · ' + fmts : ''} · confiance ${db.confById.get(connection.confidence)?.label.toLowerCase()}` })
      )
    ));
  }

  function showSoftware(id) {
    const s = db.softwareById.get(id);
    const cat = db.catById.get(s.category);
    const conns = (db.connsBySoftware.get(id) || []).slice().sort(
      (a, b) => db.kindById.get(a.kind).rank - db.kindById.get(b.kind).rank
    );
    const nodes = [
      h('div', { class: 'sw-head' },
        s.logo ? h('img', { class: 'sw-logo', src: s.logo, alt: '', loading: 'lazy' }) : h('span', { class: 'dot', style: `background:${cat.color}` }),
        h('h2', { text: s.name })
      ),
      h('div', { class: 'badges' },
        h('span', { class: 'badge', text: cat.label }),
        s.license ? h('span', { class: 'badge', text: s.license }) : null
      ),
      h('p', { class: 'meta', text: `Éditeur / projet : ${s.vendor}` }),
      h('p', { text: s.description }),
      h('p', {}, h('a', { href: s.website, target: '_blank', rel: 'noopener noreferrer' }, `Site officiel (${hostOf(s.website)}) ↗`)),
      section(`Connexions documentées (${conns.length})`,
        conns.length
          ? h('ul', { class: 'conn-list' }, conns.map((c) => connectionButton(c, id)))
          : h('p', { class: 'meta', text: 'Aucune connexion documentée dans cette base pour ce logiciel. Cela ne prouve pas qu’aucun échange n’existe.' })),
      section('Formats mentionnés dans cette base', formatChips(s.formats))
    ];
    show('Logiciel', nodes);
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
      h('div', { class: 'badges' },
        h('span', { class: 'badge', title: kind.description, style: `border-color:${kindColor(kind)}` }, kindSwatch(kind, bi), kind.label),
        confidenceBadge(c.confidence)
      ),
      c.kind === 'conditional'
        ? h('div', { class: 'warn', role: 'note', text: 'Compatibilité conditionnelle ou non vérifiée : ne pas considérer ce transfert comme acquis. Un format commun ne garantit pas que deux logiciels échangent correctement.' })
        : null,
      h('p', { text: c.summary }),

      section('Format ou protocole d’échange', formatChips(c.formats)),
      section('Sens du transfert', h('p', { text: bi
        ? `Bidirectionnel : ${a.name} ⇄ ${b.name}.`
        : `Unidirectionnel : de ${a.name} vers ${b.name} d’après les sources consultées.` })),
      section('Données transférables', h('ul', { class: 'plain' }, c.transfers.map((t) => h('li', { text: t })))),
      section('Limitations éventuelles', h('ul', { class: 'plain' }, c.limitations.map((t) => h('li', { text: t })))),
      section('Versions compatibles', h('p', { text: c.versions || 'Non documenté dans les sources consultées.' })),
      section('Documentation et sources', h('ul', { class: 'link-list' }, sources)),
      section('Vérification',
        h('p', { text: `Dernière revue : ${formatDate(c.verifiedOn)}.` }),
        h('p', { class: 'meta', text: `Nature des preuves : ${EVIDENCE_LABEL[c.evidence] ?? c.evidence}.` }),
        h('p', { class: 'meta', text: db.meta.disclaimer }))
    ];
    show('Connexion', nodes);
  }

  function hide() {
    open = false;
    stage.classList.remove('panel-open');
    root.setAttribute('aria-hidden', 'true');
  }

  return {
    showSoftware,
    showConnection,
    hide,
    isOpen: () => open,
    height: () => (open ? root.offsetHeight : 0),
    focus: () => root.focus({ preventScroll: true }),
    countLabel: (n) => plural(n, 'connexion', 'connexions')
  };
}
