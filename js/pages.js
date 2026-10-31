// Vues « Liste », « Formats » et « À propos ».
import { h, clear, kindSwatch, formatDate, hostOf, plural } from './util.js?v=20261031.14';

/* ------------------------------------------------------------------ Liste */

function confBadge(db, c) {
  if (c.user) return h('span', { class: 'badge user-badge', text: 'Ajout personnel' });
  return h('span', { class: `badge conf-${c.confidence}`, text: db.confById.get(c.confidence)?.label ?? c.confidence });
}

export function renderList(root, db, view, actions) {
  clear(root);
  const visibleSoftware = db.software.filter((s) => view.cats.has(s.category) && (!view.matches || view.matches.has(s.id)));
  const shownIds = new Set(visibleSoftware.map((s) => s.id));
  const conns = db.connections
    .filter((c) => view.kinds.has(c.kind))
    .filter((c) => c.user || !view.confs || view.confs.has(c.confidence))
    .filter((c) => view.cats.has(db.softwareById.get(c.source).category) && view.cats.has(db.softwareById.get(c.target).category))
    .filter((c) => !view.matches || shownIds.has(c.source) || shownIds.has(c.target))
    .filter((c) => !view.format || (c.formats || []).includes(view.format))
    .sort((x, y) => db.kindById.get(x.kind).rank - db.kindById.get(y.kind).rank
      || db.softwareById.get(x.source).name.localeCompare(db.softwareById.get(y.source).name, 'fr'));

  const connRows = conns.map((c) => {
    const kind = db.kindById.get(c.kind);
    const a = db.softwareById.get(c.source);
    const b = db.softwareById.get(c.target);
    const fmts = (c.formats || []).map((id) => db.formatById.get(id)?.name ?? id).join(', ');
    return h('tr', {},
      h('td', {}, h('button', { type: 'button', class: 'cell-link', onClick: () => actions.selectConnection(c.id) },
        `${a.name} ${c.direction === 'bi' ? '⇄' : '→'} ${b.name}`)),
      h('td', {}, h('span', { class: 'cell-kind' }, kindSwatch(kind, c.direction === 'bi' ? 'both' : 'right'), kind.short)),
      h('td', { class: 'meta', text: fmts || '—' }),
      h('td', {}, confBadge(db, c)));
  });

  const softRows = visibleSoftware.map((s) => {
    const cat = db.catById.get(s.category);
    const n = conns.filter((c) => c.source === s.id || c.target === s.id).length;
    return h('tr', {},
      h('td', {}, h('button', { type: 'button', class: 'cell-link', onClick: () => actions.selectSoftware(s.id) }, s.name)),
      h('td', {}, h('span', { class: 'cell-kind' }, h('span', { class: 'dot', style: `background:${cat.color}` }), cat.label)),
      h('td', { class: 'meta', text: s.user ? 'Ajout personnel' : s.vendor }),
      h('td', { text: String(n) }));
  });

  const table = (head, rows, empty) => rows.length
    ? h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' },
        h('thead', {}, h('tr', {}, head.map((t) => h('th', { scope: 'col', text: t })))),
        h('tbody', {}, rows)))
    : h('p', { class: 'empty', text: empty });

  root.append(h('div', { class: 'page' },
    h('h2', { class: 'section-title', text: 'Logiciels et connexions' }),
    h('p', { class: 'lead', text: 'Même contenu que le graphe, sous forme de tableaux : pratique sur petit écran ou au clavier. Les filtres et la recherche s’appliquent aussi ici.' }),
    h('section', { class: 'card card-pad' },
      h('div', { class: 'card-bar flat' },
        h('h3', { class: 'card-title', text: 'Liaisons' }),
        h('span', { class: 'pill', text: plural(conns.length, 'liaison affichée', 'liaisons affichées') })),
      table(['Liaison', 'Type', 'Formats', 'Fiabilité'], connRows, 'Aucune liaison ne correspond aux filtres et à la recherche actuels.')),
    h('section', { class: 'card card-pad' },
      h('div', { class: 'card-bar flat' },
        h('h3', { class: 'card-title', text: 'Logiciels' }),
        h('span', { class: 'pill', text: plural(visibleSoftware.length, 'logiciel', 'logiciels') })),
      table(['Logiciel', 'Catégorie', 'Éditeur', 'Liaisons'], softRows, 'Aucun logiciel ne correspond aux filtres et à la recherche actuels.'))
  ));
}

/* ---------------------------------------------------------------- Formats */

const FORMAT_KIND_LABEL = {
  open: 'Format ouvert / publié',
  proprietary: 'Format propriétaire',
  api: 'Lien direct, extension ou API'
};

export function renderFormats(root, db, actions) {
  clear(root);
  const wrap = h('div', { class: 'page' });
  wrap.append(
    h('h2', { class: 'section-title', text: 'Formats et protocoles d’échange' }),
    h('p', { class: 'lead', text: 'Un format commun ne suffit pas à garantir qu’un échange fonctionne : version du format, réglages d’export et sous-ensemble implémenté comptent. Chaque fiche indique les liaisons de cette carte qui l’utilisent.' })
  );

  for (const family of db.meta.formatFamilies) {
    const items = db.formats.filter((f) => f.family === family.id);
    if (!items.length) continue;
    wrap.append(h('h3', { class: 'group-title', text: `Formats : ${family.label.toLowerCase()}` }), h('p', { class: 'meta', text: family.description }));
    for (const f of items) {
      const conns = db.connsByFormat.get(f.id) || [];
      // Logiciels compatibles : déduits des liaisons documentées et des formats cités par chaque logiciel.
      const ids = new Set([...conns.flatMap((c) => [c.source, c.target]), ...db.software.filter((s) => (s.formats || []).includes(f.id)).map((s) => s.id)]);
      const compatible = [...ids].map((id) => db.softwareById.get(id)).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
      wrap.append(h('article', { class: 'card card-pad', id: `format-${f.id}` },
        h('div', { class: 'card-head' },
          h('h3', { text: f.name }),
          h('span', { class: 'meta', text: f.fullName })
        ),
        h('div', { class: 'badges' }, h('span', { class: 'badge', text: FORMAT_KIND_LABEL[f.kind] })),
        f.extensions?.length ? h('p', { class: 'meta', text: `Extensions : ${f.extensions.join(', ')}` }) : null,
        h('p', { text: f.description }),
        h('dl', { class: 'kv' },
          h('dt', { text: 'Contenu typique' }), h('dd', { text: f.carries }),
          h('dt', { text: 'Précautions' }), h('dd', { text: f.caveats }),
          h('dt', { text: 'Responsable' }), h('dd', { text: f.steward }),
          h('dt', { text: 'Logiciels cités' }), h('dd', { text: compatible.length ? compatible.map((s) => s.name).join(', ') : 'Aucun dans cette base' })
        ),
        h('p', {}, h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, `Référence (${hostOf(f.url)}) ↗`)),
        h('div', { class: 'badges' },
          h('button', {
            type: 'button', class: 'btn', disabled: conns.length ? null : true,
            onClick: () => actions.filterByFormat(f.id)
          }, conns.length ? `Voir les ${plural(conns.length, 'liaison', 'liaisons')} sur la carte` : 'Aucune liaison dans cette base')
        )
      ));
    }
  }
  root.append(wrap);
}

/* ---------------------------------------------------------------- À propos */

export function renderAbout(root, db) {
  clear(root);
  const wrap = h('div', { class: 'page' });
  const verified = db.connections.filter((c) => !c.user);
  const total = verified.length;
  const byConfidence = (id) => verified.filter((c) => c.confidence === id).length;
  const own = db.connections.length - total + db.software.filter((s) => s.user).length;

  const kindRows = db.meta.kinds.map((k) =>
    h('tr', {},
      h('td', {}, kindSwatch(k, false)),
      h('th', { scope: 'row', text: k.label }),
      h('td', { text: k.description })
    )
  );
  const confRows = db.meta.confidence.map((c) =>
    h('tr', {},
      h('td', {}, h('span', { class: `badge conf-${c.id}`, text: c.label })),
      h('td', { text: c.description }),
      h('td', { text: String(byConfidence(c.id)) })
    )
  );

  const tile = (cls, n, label) => h('div', { class: `tile ${cls}` }, h('span', { class: 'tile-num', text: String(n) }), h('span', { class: 'tile-label', text: label }));
  wrap.append(
    h('h2', { class: 'section-title', text: 'À propos de cette carte' }),
    h('p', { class: 'lead', text: 'Plateforme pédagogique autonome pour comprendre comment les logiciels de génie civil, de BIM, de CAO, de calcul de structures et d’éléments finis peuvent échanger des données. Elle n’est affiliée à aucun éditeur.' }),

    h('section', { class: 'card card-pad' },
      h('div', { class: 'card-bar flat' }, h('h3', { class: 'card-title', text: 'La base en chiffres' })),
      h('div', { class: 'tiles' },
        tile('tile-cyan', byConfidence('high'), 'Liaisons de confiance élevée'),
        tile('tile-yellow', byConfidence('medium'), 'Liaisons de confiance moyenne'),
        tile('tile-red', byConfidence('low'), 'Liaisons de confiance faible (masquées par défaut)'),
        tile('tile-orange', db.software.filter((s) => !s.user).length, 'Logiciels')),
      h('div', { class: 'banner' }, h('span', { class: 'banner-icon', 'aria-hidden': 'true', text: '◷' }),
        h('span', { class: 'banner-num', text: String(total) }),
        h('span', { text: `liaisons documentées · revue du ${formatDate(db.meta.lastReview)}` }))),

    h('p', { class: 'meta', text: 'Auteur : TSARALOHA Nomenjanahary Christinot Léonnel Calixte, BTP, M2 Académique. Génie civil, calcul des structures, interopérabilité logicielle et méthodes numériques.' }),

    h('h3', { text: 'Comment lire le graphe' }),
    h('ul', { class: 'plain' },
      h('li', { text: 'Chaque nœud est un logiciel ; la couleur de son en-tête et le cadre qui l’entoure indiquent sa catégorie.' }),
      h('li', { text: 'Chaque câble est une liaison documentée. Il part d’une broche de sortie (à droite du nœud) vers une broche d’entrée (à gauche) : le transfert va dans ce sens. Le symbole « ⇄ » sur une broche indique un échange dans les deux sens.' }),
      h('li', { text: 'La couleur et le trait du câble indiquent la nature de l’échange (tableau ci-dessous). Une broche triangulaire blanche signale un lien direct. Touchez un câble pour voir formats, données, limites et sources.' }),
      h('li', { text: 'Pas de câble ne veut pas dire « impossible » : cela veut dire « non documenté dans cette base ».' })
    ),

    h('h3', { text: 'Les cinq types de liaison' }),
    h('table', { class: 'kind-table' }, h('tbody', {}, kindRows)),

    h('h3', { text: 'Niveaux de confiance' }),
    h('p', { text: `Chaque liaison porte une date de revue, un niveau de confiance et la nature de ses preuves. Sur ${total} liaisons :` }),
    h('table', { class: 'kind-table' },
      h('thead', {}, h('tr', {}, h('th', { text: 'Niveau' }), h('th', { text: 'Signification' }), h('th', { text: 'Nombre' }))),
      h('tbody', {}, confRows)),

    h('h3', { text: 'Méthode et limites' }),
    h('ul', { class: 'plain' },
      h('li', { text: `Dernière revue de la base : ${formatDate(db.meta.lastReview)}.` }),
      h('li', { text: 'Sources retenues : documentation officielle des éditeurs, guides d’interopérabilité, documentation des formats ouverts. Les forums ne servent que d’indice et sont signalés comme tels.' }),
      h('li', { text: 'Certaines pages ont été lues en entier, d’autres seulement à travers des extraits de résultats de recherche : la nature des preuves est indiquée sur chaque fiche de connexion.' }),
      h('li', { text: 'Aucune liaison n’est déduite du seul fait que deux logiciels acceptent le même format. Quand un format commun existe sans documentation conjointe, la liaison est marquée « conditionnelle ou non vérifiée » avec une confiance faible.' }),
      h('li', { text: 'Les logos des éditeurs ne sont pas intégrés (marques déposées) ; les noms de produits appartiennent à leurs propriétaires respectifs.' })
    ),
    h('p', { class: 'warn', role: 'note', text: db.meta.disclaimer }),

    h('h3', { text: 'Modifier le graphe (mode édition)' }),
    h('ul', { class: 'plain' },
      h('li', { text: 'Le menu « Mode édition » permet d’ajouter vos propres logiciels, liaisons et blocs (cadres de commentaire), de les modifier et de les supprimer. Tirez le port ➜ d’un nœud vers un autre pour créer une liaison.' }),
      h('li', { text: 'Vos ajouts sont marqués « ajout personnel, non vérifié » et ne modifient jamais la base vérifiée. Ils restent dans votre navigateur ; exportez-les en fichier JSON pour les garder, les partager ou les proposer à l’intégration après vérification.' }),
      h('li', { text: own ? `Vous avez actuellement ${own} ajout${own > 1 ? 's' : ''} personnel${own > 1 ? 's' : ''} (logiciels et liaisons).` : 'Vous n’avez encore aucun ajout personnel.' })
    ),

    h('h3', { text: 'Base documentaire' }),
    h('ul', { class: 'plain' },
      h('li', { text: 'Le catalogue recense les logiciels par domaine ; une fiche détaillée n’existe que si des sources ont été consultées. Sinon, la fiche indique « Non documenté » plutôt qu’une supposition.' }),
      h('li', { text: 'Le graphe ne montre que les logiciels ayant au moins une liaison documentée ; les autres restent consultables dans le catalogue.' }),
      h('li', { text: 'Dans les fiches, « Fait » renvoie à une source ; « Appréciation » est un jugement.' })
    ),

    h('h3', { text: 'Données ouvertes' }),
    h('p', {},
      'Les données sont des fichiers JSON simples : ',
      ...['software', 'connections', 'formats', 'methods', 'standards', 'references', 'madagascar', 'meta'].flatMap((n, i) => [
        i ? ', ' : null,
        h('a', { href: `data/${n}.json`, target: '_blank', rel: 'noopener' }, `${n}.json`)
      ]),
      '. La procédure pour ajouter un logiciel ou une connexion est décrite dans le dossier docs/ du dépôt.'
    )
  );
  root.append(wrap);
}
