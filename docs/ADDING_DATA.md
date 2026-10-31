# Ajouter un logiciel ou une connexion

Toute la carte est pilotée par les fichiers de `data/`. Aucun code à modifier pour ajouter du contenu.

| Fichier | Contenu |
|---|---|
| `data/meta.json` | catégories, types de liaison, niveaux de confiance, avertissement |
| `data/software.json` | les logiciels (nœuds) |
| `data/connections.json` | les liaisons (flèches) |
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
  "license": "Commerciale",
  "description": "Une phrase décrivant le logiciel.",
  "website": "https://www.exemple.com/produit",
  "formats": ["ifc", "dxf"],
  "position": { "x": 600, "y": 300 },
  "positionPortrait": { "x": 250, "y": 500 },
  "logo": "assets/logos/monlogiciel.svg"
}
```

| Champ | Obligatoire | Remarques |
|---|---|---|
| `id` | oui | minuscules, chiffres, `-` et `_` ; unique ; utilisé dans les liaisons et les URL |
| `name` | oui | nom complet (panneaux, listes, recherche) |
| `shortName` | non | étiquette du nœud, 16 caractères maximum ; sinon `name` |
| `vendor`, `description`, `website` | oui | `website` : URL `https://` officielle |
| `category` | oui | un `id` de `meta.json › categories` |
| `license` | non | texte libre |
| `formats` | non | `id` de `formats.json` que le logiciel mentionne dans cette base (alimente la recherche par format) |
| `position` | oui | coordonnées de la disposition paysage (écran large) |
| `positionPortrait` | non | disposition téléphone en portrait ; sinon `position` est réutilisée |
| `logo` | non | chemin **relatif** dans le dépôt, affiché dans le panneau. N'ajouter que des logos dont vous avez le droit d'usage |

### Placer le nœud

Les positions sont en unités libres ; la carte se cadre automatiquement. Repères actuels : paysage, x de 80 à 1160 et y de 60 à 660 ; portrait, x de 60 à 410 et y de 40 à 840. Regroupez par catégorie et évitez de poser un nœud sur le trajet d'une flèche. L'utilisateur peut aussi passer en disposition automatique avec le bouton ⁂ de la carte.

### Ajouter une catégorie

Dans `meta.json › categories`, ajouter `{ "id", "label", "color", "description" }`. Choisir une couleur assez sombre pour que le texte blanc du nœud reste lisible (contraste d'au moins 4,5:1).

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

## Ajouter un format

Dans `data/formats.json` :

```json
{
  "id": "monformat",
  "name": "MonFormat",
  "fullName": "Nom complet du format",
  "kind": "open",
  "steward": "Organisme responsable",
  "extensions": [".mfx"],
  "description": "À quoi sert le format.",
  "carries": "Ce qu'il transporte réellement.",
  "caveats": "Ses pièges : versions, sous-ensembles implémentés…",
  "url": "https://www.exemple.org/spec"
}
```

`kind` vaut `open`, `proprietary` ou `api`. La fiche apparaît dans l'onglet Formats avec la liste des liaisons qui l'utilisent.

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
