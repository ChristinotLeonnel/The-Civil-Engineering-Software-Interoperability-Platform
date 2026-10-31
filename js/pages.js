// Vues « Liste », « Formats » et « À propos ».
import { h, clear, kindSwatch, kindColor, formatDate, hostOf, plural } from './util.js';
import { otherEnd } from './data.js';

/* ------------------------------------------------------------------ Liste */

export function renderList(root, db, view, actions) {
  clear(root);
  const wrap = h('div', {});
  wrap.append(
    h('h2', { text: 'Logiciels et connexions' }),
    h('p', { class: 'lead', text: 'Même contenu que la carte, sous forme de liste : pratique sur petit écran ou au clavier. Les filtres et la recherche s’appliquent aussi ici.' })
  );

  let shown = 0;
  for (const cat of db.meta.categories) {
    if (!view.cats.has(cat.id)) continue;
    const items = db.software.filter((s) => s.category === cat.id && (!view.matches || view.matches.has(s.id)));
    if (!items.length) continue;

    const block = h('section', { class: 'cat-block' },
      h('h2', {}, h('span', { class: 'dot', style: `background:${cat.color}` }), cat.label),
      h('p', { text: cat.description })
    );

    for (const s of items) {
      const conns = (db.connsBySoftware.get(s.id) || [])
        .filter((c) => view.kinds.has(c.kind))
        .filter((c) => view.cats.has(db.softwareById.get(otherEnd(c, s.id)).category))
        .filter((c) => !view.format || (c.formats || []).includes(view.format))
        .sort((x, y) => db.kindById.get(x.kind).rank - db.kindById.get(y.kind).rank);

      const list = conns.length
        ? h('ul', { class: 'conn-list' }, conns.map((c) => {
            const kind = db.kindById.get(c.kind);
            const other = db.softwareById.get(otherEnd(c, s.id));
            const arrow = c.direction === 'bi' ? '↔' : c.source === s.id ? '→' : '←';
            const fmts = (c.formats || []).map((id) => db.formatById.get(id)?.name ?? id).join(', ');
            return h('li', {}, h('button', {
              type: 'button', class: 'conn-btn', onClick: () => actions.selectConnection(c.id)
            },
              kindSwatch(kind, c.direction === 'bi' ? 'both' : c.source === s.id ? 'right' : 'left'),
              h('span', { class: 'conn-main' },
                h('span', { class: 'conn-title', text: `${arrow} ${other.name}` }),
                h('span', { class: 'conn-sub', text: ` ${kind.short}${fmts ? ' · ' + fmts : ''}` })
              )
            ));
          }))
        : h('p', { class: 'meta', text: 'Aucune connexion à afficher avec les filtres actuels.' });

      block.append(h('article', { class: 'card' },
        h('div', { class: 'card-head' },
          h('button', { type: 'button', class: 'name', onClick: () => actions.selectSoftware(s.id) }, s.name),
          h('span', { class: 'meta', text: `${s.vendor} · ${plural(conns.length, 'connexion', 'connexions')}` })
        ),
        list
      ));
      shown += 1;
    }
    wrap.append(block);
  }

  if (!shown) wrap.append(h('p', { class: 'empty', text: 'Aucun logiciel ne correspond aux filtres et à la recherche actuels.' }));
  root.append(wrap);
}

/* ---------------------------------------------------------------- Formats */

const FORMAT_KIND_LABEL = {
  open: 'Format ouvert / publié',
  proprietary: 'Format propriétaire',
  api: 'Lien direct, extension ou API'
};

export function renderFormats(root, db, actions) {
  clear(root);
  const wrap = h('div', {});
  wrap.append(
    h('h2', { text: 'Formats et protocoles d’échange' }),
    h('p', { class: 'lead', text: 'Un format commun ne suffit pas à garantir qu’un échange fonctionne : version du format, réglages d’export et sous-ensemble implémenté comptent. Chaque fiche indique les liaisons de cette carte qui l’utilisent.' })
  );

  for (const group of ['open', 'proprietary', 'api']) {
    const items = db.formats.filter((f) => f.kind === group);
    if (!items.length) continue;
    wrap.append(h('h3', { text: FORMAT_KIND_LABEL[group] }));
    for (const f of items) {
      const conns = db.connsByFormat.get(f.id) || [];
      wrap.append(h('article', { class: 'card', id: `format-${f.id}` },
        h('div', { class: 'card-head' },
          h('h3', { text: f.name }),
          h('span', { class: 'meta', text: f.fullName })
        ),
        f.extensions?.length ? h('p', { class: 'meta', text: `Extensions : ${f.extensions.join(', ')}` }) : null,
        h('p', { text: f.description }),
        h('dl', { class: 'kv' },
          h('dt', { text: 'Contenu typique' }), h('dd', { text: f.carries }),
          h('dt', { text: 'Précautions' }), h('dd', { text: f.caveats }),
          h('dt', { text: 'Responsable' }), h('dd', { text: f.steward })
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
  const wrap = h('div', {});
  const total = db.connections.length;
  const byConfidence = (id) => db.connections.filter((c) => c.confidence === id).length;

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

  wrap.append(
    h('h2', { text: 'À propos de cette carte' }),
    h('p', { class: 'lead', text: 'Plateforme pédagogique autonome pour comprendre comment les logiciels de génie civil, de BIM, de CAO, de calcul de structures et d’éléments finis peuvent échanger des données. Elle n’est affiliée à aucun éditeur.' }),

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

    h('h3', { text: 'Données ouvertes' }),
    h('p', {},
      'Les données sont des fichiers JSON simples : ',
      ...['software', 'connections', 'formats', 'meta'].flatMap((n, i) => [
        i ? ', ' : null,
        h('a', { href: `data/${n}.json`, target: '_blank', rel: 'noopener' }, `${n}.json`)
      ]),
      '. La procédure pour ajouter un logiciel ou une connexion est décrite dans le dossier docs/ du dépôt.'
    )
  );
  root.append(wrap);
}
