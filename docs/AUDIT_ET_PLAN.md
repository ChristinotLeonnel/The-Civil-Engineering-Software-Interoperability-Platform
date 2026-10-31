# Audit et plan d'évolution — base documentaire des logiciels de génie civil

Date : 31 octobre 2026. Auteur du projet : TSARALOHA Nomenjanahary Christinot Léonnel Calixte (BTP, M2 Académique).

## 1. Audit de l'existant

| Élément | Constat |
|---|---|
| Technologie | Site statique : HTML, CSS, modules JavaScript natifs, aucune dépendance ni étape de build obligatoire. Publication GitHub Pages (workflow `pages.yml`), Netlify, Vercel. |
| Données | `data/meta.json` (catégories, types de liaison, confiance), `software.json` (17 logiciels), `connections.json` (34 liaisons sourcées, datées, avec niveau de confiance et nature des preuves), `formats.json` (15 formats). Validateur `scripts/validate_data.py`. |
| Vues | Graphe Blueprint (nœuds, broches, câbles, cadres, mode édition), Liste (tableaux), Formats, À propos. Panneau de détails, recherche, filtres (fiabilité, catégories, types), liens profonds, plein écran. |
| Édition | Espace de travail du visiteur (localStorage) : ajout de logiciels, liaisons, blocs ; export / import JSON. Les ajouts ne modifient pas la base vérifiée. |
| Interface | Tableau de bord : barre latérale marine, cartes blanches, tableaux à en-tête marine, tuiles. Responsive (testé 1440, 768, 390, 844×390). |
| Points forts à conserver | Rigueur des sources (confiance, preuves, date), séparation base vérifiée / ajouts, graphe, versionnement anti-cache. |
| Manques au regard de la mission | Pas de fiches techniques détaillées ; 17 logiciels seulement ; pas de comparateur ; pas de section Madagascar ; formats non classés par famille ; pas de base de références commune. |

## 2. Architecture d'évolution (données modulaires, sans duplication)

```
data/
  meta.json          catégories (graphe), domaines (catalogue), types de liaison, confiance
  software.json      identification de chaque logiciel (un enregistrement par logiciel)
  connections.json   liaisons entre logiciels (inchangé ; alimente graphe, fiches, comparateur)
  formats.json       formats, avec famille (géométrique, BIM, analytique, maillage, résultats, données)
  methods.json       catalogue des méthodes de calcul (définitions, utilisées par fiches et comparateur)
  standards.json     catalogue des familles de normes (Eurocodes, ACI, AISC, BAEL, BS, IS…)
  references.json    bibliographie commune (identifiant, titre, éditeur, URL, type, date de consultation)
  madagascar.json    contexte malgache par logiciel + cadre d'enquête (réponses à intégrer)
  profiles/<id>.json fiche technique détaillée (sections B à K), chaque affirmation liée à des références
```

- **Une information, un seul endroit** : l'interopérabilité d'une fiche est lue dans `connections.json` (pas recopiée) ; les logiciels compatibles d'un format sont déduits des liaisons et des fiches ; les références sont citées par identifiant.
- **Statut de chaque affirmation** : `vérifié` (source consultée), `extrait` (lu à travers un résumé), `non documenté` (absence de source, jamais remplacée par une supposition), `sans objet`, `appréciation` (jugement, distingué des faits).
- **Chargement** : base et catalogues au démarrage ; fiches détaillées chargées à la demande.

## 3. Nouvelles vues

| Vue | Contenu |
|---|---|
| Catalogue | Les logiciels par domaine (Structures, BIM, Géotechnique, Routes et topographie, Hydraulique, Gestion de projet), recherche, filtres (domaine, licence, état de la fiche), sélection pour comparaison. |
| Fiche logiciel | Structure A à L imposée ; chaque champ montre son statut et ses références ; « non documenté » quand aucune source n'a été consultée. |
| Comparateur | Jusqu'à 4 logiciels ; tableaux : spécialités, méthodes, normes, modélisation, résultats, interopérabilité, formats, limites, points forts et faibles. |
| Madagascar | Logiciels étudiés dans le contexte malgache ; fréquence d'usage « non documentée » faute de statistiques ; cadre d'enquête (questionnaire, modèle CSV, schéma des réponses). |
| Formats | Familles de formats, logiciels compatibles déduits des données. |
| Graphe | Inchangé ; n'affiche que les logiciels ayant au moins une liaison documentée (les autres restent consultables dans le catalogue). |

## 4. Plan d'implémentation

1. Données : domaines, catalogues (méthodes, normes, références), extension des formats, identification des 58 logiciels (55 de la mission + DraftSight, Gmsh, Salome déjà présents).
2. Fiches détaillées vérifiées pour un premier lot dont la documentation officielle est accessible ; les autres fiches affichent l'identification, l'interopérabilité documentée et « non documenté » ailleurs.
3. Vues Catalogue, Fiche, Comparateur, Madagascar ; enrichissement de Formats ; navigation.
4. Validateur étendu (références, fiches, domaines), test des liens, tests navigateur (ordinateur, tablette, téléphone), documentation.

## 5. Limites assumées

- Remplir de façon vérifiée 12 sections pour 55 logiciels demande une recherche documentaire longue (manuels, guides de validation). Ce premier lot couvre les logiciels dont la documentation officielle a pu être consultée ; les autres fiches sont explicitement « à compléter ».
- Aucune statistique fiable d'usage des logiciels à Madagascar n'a été trouvée : aucun classement n'est publié ; une enquête est nécessaire.
- Les captures d'écran de logiciels commerciaux sont protégées par le droit d'auteur : aucune n'est intégrée. Le schéma prévoit un champ image avec source et licence pour ajouter des illustrations dont les droits sont acquis.
