# Architecture

## Choix

| Besoin | Choix | Raison |
|---|---|---|
| Publication gratuite, aucun serveur | site statique, fichiers servis tels quels | GitHub Pages, Netlify et Vercel le publient sans configuration |
| Aucune installation côté visiteur | HTML + CSS + modules ES natifs, **pas de build obligatoire** | ce qu'on édite est ce qui est publié ; `scripts/build.mjs` ne fait qu'assembler `dist/` |
| Graphe façon Blueprint | rendu écrit à la main (`js/graph.js`) : nœuds HTML, câbles SVG, navigation par Pointer Events | des nœuds à en-tête et broches, des câbles en Bézier et une navigation clic droit / molette par paliers ne sont pas réalisables proprement avec une bibliothèque de graphes générique ; aucune dépendance à maintenir |
| Données | quatre fichiers JSON dans `data/` | lisibles, versionnables, relisables par des non-développeurs ; pas de base de données |
| Confiance scientifique | champs `confidence`, `evidence`, `verifiedOn`, `sources` obligatoires, contrôlés par `scripts/validate_data.py` | la fiabilité fait partie du modèle de données, pas de la présentation |

Pas de framework (React, etc.) : l'interface est composée de quelques vues simples ; le DOM est construit avec un petit utilitaire `h()` qui n'utilise que `textContent`, ce qui évite d'interpréter des données comme du HTML.

## Modèle de données

```
meta.json        categories[{id,label,color,column,description}]  kinds[]  confidence[]  disclaimer  lastReview
software.json    [ { id, name, shortName, vendor, category, description, website, formats[], position, license?, logo? } ]
connections.json [ { id, source, target, direction, kind, formats[], summary, transfers[], limitations[],
                     versions, confidence, evidence, verifiedOn, sources[{title,url}] } ]
formats.json     [ { id, name, fullName, kind, steward, extensions[], description, carries, caveats, url } ]
```

- La **colonne** d'un nœud vient de sa catégorie (`categories[].column`) ; `position.y` ne sert qu'à ordonner les nœuds de haut en bas dans la colonne (`position.x` est ignoré par le rendu Blueprint).
- Les cinq types de liaison (`kind`) correspondent au cahier des charges : directe/native, format ouvert, extension ou API tierce, géométrie seule, conditionnelle ou non vérifiée. Couleur **et** style de trait (plein, tirets, pointillés) les distinguent ; la broche d'un lien direct est un triangle, comme les broches d'exécution de Blueprint.

## Rendu du graphe (`js/graph.js`)

```
#graph.bp-canvas            grille en CSS (background), suit le déplacement et le zoom
 ├─ .bp-comments            cadres de commentaire (un par catégorie)      ┐
 ├─ svg.bp-wires > g        câbles : chemin de clic large + trait + impulsions │ même transformation
 └─ .bp-nodes               nœuds HTML : en-tête, colonnes de broches     ┘ translate(x,y) scale(k)
```

- **Broches et orientation** : chaque liaison crée une broche de sortie (à droite) sur le logiciel d'origine et une broche d'entrée (à gauche) sur la cible. Pour une liaison bidirectionnelle, le câble part du nœud de la colonne la plus à gauche ; la broche porte « ⇄ ».
- **Géométrie** : la position des broches est mesurée dans le DOM (`offsetLeft/Top` relatifs au nœud, insensibles au zoom). Les câbles sont des courbes de Bézier à tangentes horizontales ; un câble qui revient vers la gauche forme une boucle.
- **Disposition** : colonnes par catégorie, nœuds empilés selon leur hauteur réelle. L'utilisateur peut déplacer un nœud ou un groupe ; le bouton ▥ remet les colonnes.
- **Zoom** : paliers de l'éditeur Blueprint (0,1 à 2 ; « Zoom 1:1 » = 1) à la molette, zoom continu au pincement ou au pavé tactile. En dessous de 0,6, les libellés des broches sont masqués et les titres agrandis (`--lod`) ; l'épaisseur des câbles a un minimum à l'écran et leur zone de clic garde une largeur constante.
- **Gestes** : clic droit / molette-clic = déplacer la vue ; clic gauche sur le fond = déplacer la vue ; sur un nœud = le déplacer (souris) ; seuil de 4 px (souris) ou 8 px (toucher) entre clic et glisser. Au toucher, glisser déplace la vue même depuis un nœud ; un appui long (380 ms) l'attrape. La cible d'un toucher est l'élément réellement sous le doigt (`elementFromPoint`), pour éviter que le navigateur ne recale un toucher de câble sur un nœud voisin.

## Code (`js/`)

```
main.js      état global (vue, filtres, sélection), actions, liens profonds (#view=…&node=…), rendu
data.js      chargement des JSON, index (par id, par logiciel, par format)
graph.js     graphe Blueprint : nœuds, broches, câbles, cadres, navigation, mise en évidence, cadrage
panel.js     panneau « Détails » à sections repliables (volet latéral sur ordinateur, tiroir sur mobile)
controls.js  recherche (combobox ARIA), puces de catégories, légende filtrante
pages.js     vues Liste, Formats, À propos
util.js      h() (DOM sans innerHTML), échantillons SVG de légende, dates, normalisation de texte
```

Flux : un clic (graphe, liste, recherche) appelle une action de `main.js` ; elle met à jour `state` puis `render()` synchronise le graphe, le panneau, la vue active et l'URL. `graph.js` ne connaît pas l'interface ; il reçoit un état et renvoie des événements (`onNode`, `onEdge`, `onBackground`).

## Mobile

- Mise en page : `100dvh`, en-tête compact, défilement horizontal des puces, zones tactiles de 44 px minimum, saisie à 16 px ; en paysage (hauteur ≤ 520 px), en-tête réduit et pied de page masqué.
- Vue de départ : sur un écran de moins de 600 px, le zoom ne descend pas sous 0,3 ; on navigue en glissant plutôt que de tout réduire.
- Le panneau de détails devient un tiroir bas (52 % de la hauteur maximum) ; le graphe se recentre dans la zone restée visible.
- Alternative en liste : onglet **Liste** et encart « Graphe dense ? Vue Liste » sur petit écran.

## Sécurité

- Les données sont toujours insérées avec `textContent` / `setAttribute`, jamais `innerHTML`.
- Liens externes en `rel="noopener noreferrer"`. Le validateur n'accepte que des URL `http(s)` et des couleurs `#rrggbb` (utilisées dans des attributs `style`).
- En-têtes CSP dans `netlify.toml` et `vercel.json` : uniquement les ressources du site. GitHub Pages ne permet pas de fixer des en-têtes ; le site n'y dépend pas de ces en-têtes.

## Tests réalisés

Voir la section « Tests » du README.
