# Architecture

## Choix

| Besoin | Choix | Raison |
|---|---|---|
| Publication gratuite, aucun serveur | site statique, fichiers servis tels quels | GitHub Pages, Netlify et Vercel le publient sans configuration |
| Aucune installation côté visiteur | HTML + CSS + modules ES natifs, **pas de build** | pas de Node ni de bundler à maintenir ; ce qu'on édite est ce qui est publié |
| Carte réseau | Cytoscape.js 3.30.2, copié dans `vendor/` | gestion native du toucher (pincer, glisser), flèches, styles par type de liaison ; MIT |
| Données | quatre fichiers JSON dans `data/` | lisibles, versionnables, relisables par des non-développeurs ; pas de base de données |
| Confiance scientifique | champs `confidence`, `evidence`, `verifiedOn`, `sources` obligatoires, contrôlés par `scripts/validate_data.py` | la fiabilité fait partie du modèle de données, pas de la présentation |

Pas de framework (React, etc.) : l'interface est composée de cinq vues simples ; le DOM est construit avec un petit utilitaire `h()` qui n'utilise que `textContent`, ce qui évite d'interpréter des données comme du HTML.

## Modèle de données

```
meta.json        categories[]  kinds[]  confidence[]  disclaimer  lastReview
software.json    [ { id, name, shortName, vendor, category, description, website, formats[], position, positionPortrait, license?, logo? } ]
connections.json [ { id, source, target, direction, kind, formats[], summary, transfers[], limitations[],
                     versions, confidence, evidence, verifiedOn, sources[{title,url}] } ]
formats.json     [ { id, name, fullName, kind, steward, extensions[], description, carries, caveats, url } ]
```

Les cinq types de liaison (`kind`) correspondent au cahier des charges : directe/native, format ouvert, extension ou API tierce, géométrie seule, conditionnelle ou non vérifiée. Le style de ligne (couleur, trait plein, tirets, pointillés) ne repose jamais sur la couleur seule.

## Code (`js/`)

```
main.js      état global (vue, filtres, sélection), actions, liens profonds (#view=…&node=…), rendu
data.js      chargement des JSON, index (par id, par logiciel, par format)
graph.js     Cytoscape : éléments, styles, filtres, mise en évidence, cadrage, tolérance de toucher
panel.js     panneau de détails logiciel / connexion (volet latéral sur ordinateur, tiroir sur mobile)
controls.js  recherche (combobox ARIA), chips de catégories, légende filtrante
pages.js     vues Liste, Formats, À propos
util.js      h() (DOM sans innerHTML), échantillons SVG de légende, dates, normalisation de texte
```

Flux : un clic (carte, liste, recherche) appelle une action de `main.js` ; elle met à jour `state` puis `render()` synchronise le graphe, le panneau, la vue active et l'URL. `graph.js` ne connaît pas l'interface ; il reçoit un état et renvoie des événements.

## Mobile

- Mise en page : `100dvh`, en-tête compact, défilement horizontal des puces, zones tactiles de 44 px minimum, saisie à 16 px.
- Deux dispositions de la carte : paysage et portrait (`position` / `positionPortrait`), choisies selon le rapport largeur/hauteur de la carte ; la bascule se refait si on tourne l'appareil.
- Étiquettes courtes (`shortName`) et largeur de nœud mesurée au canvas pour garder la carte lisible.
- Le panneau de détails devient un tiroir bas (52 % de la hauteur maximum) ; la carte se recentre dans la zone restée visible.
- Tolérance de toucher : un tap près d'une flèche sélectionne la flèche la plus proche (18 px en tactile, 7 px à la souris).
- Alternative en liste : onglet **Liste** et encart « Carte dense ? Vue Liste » sur petit écran.

## Sécurité

- Les données sont toujours insérées avec `textContent` / `setAttribute`, jamais `innerHTML`.
- Liens externes en `rel="noopener noreferrer"`. Le validateur n'accepte que des URL `http(s)`.
- En-têtes CSP dans `netlify.toml` et `vercel.json` : uniquement les ressources du site. GitHub Pages ne permet pas de fixer des en-têtes ; le site n'y dépend pas de ces en-têtes.

## Tests réalisés

Voir la section « Tests » du README. En résumé : chargement sans erreur console à 1440×900 (souris) et 390×844 (mobile émulé, tactile, pointeur grossier), sélection par toucher, recherche, filtres, vue Liste, vues Formats et À propos, thème sombre, absence de défilement horizontal.
