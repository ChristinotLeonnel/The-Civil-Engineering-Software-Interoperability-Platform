# Ajouter un logiciel ou une connexion

Tout le graphe est piloté par les fichiers de `data/`. Aucun code à modifier pour ajouter du contenu.

> Les visiteurs peuvent aussi ajouter des logiciels, liaisons et blocs depuis le site (**Mode édition**), mais ces ajouts restent dans leur navigateur. Pour intégrer un ajout proposé par un visiteur, demandez-lui le fichier produit par **Exporter mes modifications**, vérifiez chaque liaison selon les règles ci-dessous (source fiable, confiance, nature des preuves), puis recopiez-la dans `data/` avec un identifiant définitif (sans le préfixe `u-`).

| Fichier | Contenu |
|---|---|
| `data/meta.json` | catégories, types de liaison, niveaux de confiance, avertissement |
| `data/software.json` | les logiciels (nœuds) |
| `data/connections.json` | les liaisons (câbles) |
| `data/formats.json` | les formats et protocoles d'échange |

Après chaque modification :

```bash
python scripts/validate_data.py            # erreurs de structure
python scripts/validate_data.py --check-links
python -m http.server 8080                 # puis ouvrir http://localhost:8080
```

## Règles de fond (à lire avant d'ajouter une liaison)

1. **Une liaison = une source fiable.** Documentation de l'éditeur, guide d'interopérabilité, documentation du format ouvert, publication technique. Un forum seul donne une confiance `low`.
2. **Ne jamais conclure à une compatibilité parce que deux logiciels acceptent le même format.** Si vous n'avez qu'un format commun, utilisez `"kind": "conditional"` et `"confidence": "low"`, et expliquez-le dans `limitations`. Le validateur interdit `conditional` + `high`.
3. **Une seule liaison par paire de logiciels.** Si plusieurs chemins existent (lien direct + IFC + fichier), mettez tous les formats dans `formats` et décrivez les chemins dans `transfers` et `limitations`.
4. **Indiquer ce qui est vrai pour quelles versions**, dans `versions`. Si la source est ancienne, dites-le dans `limitations`.
5. **Dire la nature des preuves** dans `evidence` :
   - `read` : vous avez ouvert et lu la page citée ;
   - `excerpt` : vous vous appuyez sur un extrait ou un résumé, pas sur la page complète ;
   - `community` : forums, rapports de bugs, tutoriels non officiels.
6. **Mettre `verifiedOn` à la date où vous avez réellement relu les sources** (AAAA-MM-JJ), pas à la date d'ajout par habitude.
7. **Sens du transfert** : `bi` seulement si les sources décrivent les deux sens. Sinon `uni`, avec `source` → `target` dans le sens du transfert documenté.

## Les cinq types de liaison (`kind`)

| `kind` | À utiliser quand |
|---|---|
| `native` | lien, module ou filtre d'import/export fourni par les éditeurs eux-mêmes (lien direct, même écosystème, lecture native d'un format propriétaire) |
| `open` | échange par un format ouvert documenté (IFC, SAF, CIS/2, MED…) que chaque logiciel documente |
| `extension` | passerelle installée en plus : plug-in, add-on, outil tiers |
| `geometry` | seules des entités géométriques passent (DWG/DXF) |
| `conditional` | plausible mais non vérifié, ou très dépendant des réglages et versions |

## Ajouter un logiciel

Ajouter un objet dans `data/software.json` :

```json
{
  "id": "monlogiciel",
  "name": "Mon Logiciel Structure",
  "shortName": "MonLogiciel",
  "vendor": "Éditeur SA",
  "category": "calcul",
  "domain": "structures",
  "license": "Commerciale",
  "description": "Une phrase décrivant le logiciel.",
  "website": "https://www.exemple.com/produit",
  "formats": ["ifc", "dxf"],
  "position": { "x": 600, "y": 300 },
  "logo": "assets/logos/monlogiciel.svg"
}
```

| Champ | Obligatoire | Remarques |
|---|---|---|
| `id` | oui | minuscules, chiffres, `-` et `_` ; unique ; utilisé dans les liaisons et les URL |
| `name` | oui | nom complet (panneaux, listes, recherche) |
| `shortName` | non | étiquette du nœud, 16 caractères maximum ; sinon `name` |
| `vendor`, `description`, `website` | oui | `website` : URL `https://` officielle |
| `category` | oui | un `id` de `meta.json › categories` (colonne du graphe) |
| `domain` | oui | un `id` de `meta.json › domains` (filtre du catalogue) |
| `license` | non | texte libre |
| `formats` | non | `id` de `formats.json` que le logiciel mentionne dans cette base (alimente la recherche par format) |
| `position` | non | seul `y` compte : il ordonne les nœuds de haut en bas dans la colonne de leur catégorie (`x` est ignoré) |
| `logo` | non | chemin **relatif** dans le dépôt, affiché dans le panneau. N'ajouter que des logos dont vous avez le droit d'usage |

### Placer le nœud

Le graphe Blueprint range les logiciels en colonnes, une par catégorie (CAO → BIM → calcul → maillage → éléments finis). Dans une colonne, les nœuds sont empilés par `position.y` croissant, avec un espacement automatique selon leur hauteur. Pour limiter les croisements de câbles, placez un logiciel près de ceux auxquels il est le plus relié. Les broches (une par liaison) sont créées et ordonnées automatiquement. L'utilisateur peut déplacer les nœuds à la main ; le bouton ▥ remet les colonnes.

### Ajouter une catégorie

Dans `meta.json › categories`, ajouter `{ "id", "label", "color", "column", "description" }`. `column` est un entier (0 = colonne de gauche) ; deux catégories peuvent partager une colonne. Choisir une couleur assez soutenue pour que le texte blanc de l'en-tête des nœuds reste lisible.

## Ajouter une connexion

Ajouter un objet dans `data/connections.json` :

```json
{
  "id": "monlogiciel--revit",
  "source": "monlogiciel",
  "target": "revit",
  "direction": "bi",
  "kind": "extension",
  "formats": ["api"],
  "summary": "Une phrase : quel lien, fourni par qui.",
  "transfers": [
    "Ce qui passe, de façon précise (par exemple : modèle analytique, sections, charges)"
  ],
  "limitations": [
    "Ce qui ne passe pas, ou les conditions (version, licence, installation)"
  ],
  "versions": "Revit 2024 et ultérieur ; Mon Logiciel 5.2 et ultérieur.",
  "confidence": "high",
  "evidence": "read",
  "verifiedOn": "2026-10-31",
  "sources": [
    { "title": "Éditeur – Titre de la page", "url": "https://www.exemple.com/doc/lien-revit" }
  ]
}
```

| Champ | Obligatoire | Remarques |
|---|---|---|
| `id` | oui | convention `source--cible` ; unique |
| `source`, `target` | oui | `id` de logiciels existants ; pour `uni`, le transfert va de `source` vers `target` |
| `direction` | oui | `uni` ou `bi` |
| `kind` | oui | `native`, `open`, `extension`, `geometry` ou `conditional` |
| `formats` | non | liste d'`id` de `formats.json` (liste vide possible si aucun format n'est identifiable) |
| `summary` | oui | une phrase |
| `transfers` | oui | liste ; ce qui est transférable |
| `limitations` | oui | liste ; au moins une ligne. Pour une liaison sans limite connue, dites-le explicitement |
| `versions` | non | texte ; sinon « Non documenté dans les sources consultées » s'affiche |
| `confidence` | oui | `high` (documentation officielle lue, explicite), `medium` (partielle, ancienne, propre à une version, ou lue par extrait), `low` (forum, indirecte, déduite) |
| `evidence` | oui | `read`, `excerpt` ou `community` |
| `verifiedOn` | oui | AAAA-MM-JJ |
| `sources` | oui | au moins une, `{ title, url }` avec URL `http(s)` |

Les liaisons sont non orientées pour l'unicité : `a--b` et `b--a` désignent la même paire, le validateur refuse les doublons.

## Ajouter ou compléter une fiche technique

Chaque fiche détaillée est un fichier `data/profiles/<id>.json`, déclaré dans `data/profiles/index.json`. Les sections suivent la structure A à L : `version`, `license`, `applicationDomain`, `specialties`, `methods`, `otherMethods`, `standards` ou `standardsNote`, `modelling`, `results`, `otherResults`, `limits`, `interop`, `cannotDo`, `strengths`, `weaknesses`, `improvements`.

- Une référence se déclare une fois dans `data/references.json`, puis se cite par son identifiant dans `refs`.
- Une affirmation : `{ "text": "…", "refs": ["id"] }`. Une méthode ou un résultat : `{ "v": true, "note": "…", "refs": ["id"] }`, ou `{ "v": "na", "note": "…" }` si la rubrique est sans objet.
- **Ce qui n'est pas confirmé par une source ne s'écrit pas** : un champ absent s'affiche « Non documenté ». Le validateur refuse une affirmation confirmée ou un « fait » sans référence.
- Dans `strengths`, `weaknesses` et `improvements`, `nature` vaut `fait` (sourcé) ou `appréciation` (jugement).
- L'interopérabilité vient de `connections.json` : ne la recopiez pas ; `interop` sert seulement aux possibilités hors du graphe (API, fichiers génériques).
- Illustrations : n'ajouter une image que si ses droits sont acquis, en indiquant sa source et sa licence.

## Ajouter un format

Dans `data/formats.json` :

```json
{
  "id": "monformat",
  "name": "MonFormat",
  "fullName": "Nom complet du format",
  "kind": "open",
  "family": "analytique",
  "steward": "Organisme responsable",
  "extensions": [".mfx"],
  "description": "À quoi sert le format.",
  "carries": "Ce qu'il transporte réellement.",
  "caveats": "Ses pièges : versions, sous-ensembles implémentés…",
  "url": "https://www.exemple.org/spec"
}
```

`kind` vaut `open`, `proprietary` ou `api`. `family` est un identifiant de `meta.json › formatFamilies`. La fiche apparaît dans l'onglet Formats avec la liste des liaisons qui l'utilisent.

## Mettre à jour une liaison existante

1. Relire la source. Si elle a changé ou disparu, corriger `limitations`, `versions` et `sources`.
2. Mettre à jour `verifiedOn` **seulement** pour ce que vous avez relu.
3. Si une source officielle remplace un forum ou un extrait, passer `evidence` à `read` et revoir `confidence`.
4. Lancer le validateur.

## Aide-mémoire de contrôle avant de publier

- [ ] `python scripts/validate_data.py --check-links` sans erreur ; les `403` anti-robot ouverts à la main.
- [ ] Chaque nouvelle liaison a au moins une source lue ou, à défaut, la confiance et la nature des preuves le disent.
- [ ] Aucune liaison n'est affirmée sur la seule base d'un format commun.
- [ ] La carte s'ouvre en local, en largeur téléphone (390 px) et en largeur ordinateur, sans erreur dans la console du navigateur.
