# Rapport de modifications — enrichissement documentaire

Date : 31 octobre 2026. Voir aussi [AUDIT_ET_PLAN.md](AUDIT_ET_PLAN.md).

## 1. Réalisé

| Livrable | État |
|---|---|
| Base documentaire modulaire | Fait : `software`, `profiles/`, `methods`, `standards`, `formats`, `connections`, `references`, `madagascar`. |
| Catalogue | Fait : 58 logiciels (55 de la mission + DraftSight, Gmsh, Salome), 6 domaines, recherche, filtres domaine / licence / état de la fiche. |
| Fiches techniques A à L | Structure complète pour les 58. **12 fiches détaillées** ; 46 fiches au niveau identification + liaisons documentées, le reste affichant « Non documenté ». |
| Comparateur | Fait : jusqu'à 4 logiciels, filtre par domaine, tableaux par thème, lien partageable. |
| Cartographie | Graphe existant conservé. Il ne montre que les logiciels ayant au moins une liaison ; tout logiciel relié (y compris par le mode édition) y apparaît. |
| Formats | 24 formats classés en 6 familles (géométriques, BIM, analytiques, maillage, données, liens) ; logiciels cités déduits des données. |
| Madagascar | Section créée : 15 logiciels, aucun classement, fréquence « non documentée », cadre d'enquête et modèle CSV. |
| Références | 18 références communes, avec type, date de consultation et nature de la lecture. |
| Validateur | Étendu : références existantes, toute affirmation confirmée sourcée, index des fiches, domaines, familles. |

## 2. Fiches détaillées (premier lot)

EPANET, SWMM, HEC-RAS, HEC-HMS, CalculiX, Code_Aster, OpenSees, OpenSeesPy, QGIS, ETABS, SAP2000, PLAXIS.

Elles restent inégales : les pages de présentation d'ETABS, SAP2000 et PLAXIS sont pauvres en détails techniques. Ces trois fiches sont donc peu remplies. Les manuels techniques n'ont pas été dépouillés pour ce lot.

## 3. Non réalisé ou partiel

| Point de la mission | État et raison |
|---|---|
| 12 sections documentées pour chaque logiciel | **Non atteint** : 46 fiches sont à compléter. Le travail demande de dépouiller des manuels, parfois réservés aux clients. |
| Normes réellement prises en charge | **Non documenté** pour tous les logiciels : aucune liste de normes n'a pu être lue (page CSI non accessible, Autodesk bloquant). |
| Robot Structural Analysis | Pas de fiche détaillée : les pages Autodesk refusent l'accès automatisé. |
| Flux de la mission | Revit → Robot existe. **Non ajoutés faute de source consultée** : Robot → Excel, AutoCAD → Civil 3D → Covadis, Code_Aster → ParaView, Tekla → fabrication. Excel, Python, MATLAB et ParaView ne sont pas des nœuds du graphe. |
| Usage à Madagascar | Aucune source fiable : pas de statistique, pas d'offre de formation locale vérifiée. Enquête à mener. |
| Captures d'écran | Aucune : protégées par le droit d'auteur, droits non acquis. |
| Liaisons pour les 41 nouveaux logiciels | Aucune liaison n'a été ajoutée : ils sont au catalogue, pas dans le graphe. |

## 4. Changements de comportement à connaître

- La liaison « Gmsh → OpenSees » est devenue « Gmsh → OpenSeesPy », ce que dit sa source (opstool). OpenSees n'a donc plus de liaison et sort du graphe ; sa fiche reste au catalogue. L'ancien lien `#edge=gmsh--opensees` ne fonctionne plus.
- `meta.json`, `software.json` et `formats.json` ont de nouveaux champs obligatoires (`domain`, `family`).
- La description sommaire des 41 nouveaux logiciels vient de connaissances générales : elle n'est pas sourcée. Les sites officiels ont été testés ; les 8 pages Autodesk et Allplan répondent 403 aux scripts et n'ont pas pu être confirmées automatiquement.

## 5. Tests réalisés

Chrome piloté par le protocole DevTools, en émulation d'appareil, avec les en-têtes CSP du déploiement.

| Testé | Résultat |
|---|---|
| Validateur de données | Réussi |
| Catalogue : 58 cartes, filtre domaine (7 en hydraulique), filtre fiches détaillées (12) | Réussi |
| Comparateur : ajout depuis le catalogue, limite à 4, colonnes, lien partageable | Réussi |
| Recherche d'un logiciel hors graphe → fiche ; panneau → fiche ; fiche → liaison dans le graphe | Réussi |
| Les 58 fiches s'ouvrent avec leurs 12 sections | Réussi |
| Mode édition : relier un logiciel hors graphe l'y fait apparaître ; réinitialisation | Réussi |
| Madagascar : 15 logiciels | Réussi |
| Absence de débordement : 5 vues à 768×1024, 390×844, 844×390 | Réussi |
| Erreurs de console | Aucune |
| Liens | 200 pour la plupart ; 403 anti-robot sur Autodesk, Allplan, buildingSMART (non confirmables par script) |

## 6. Reste à vérifier

- Téléchargement effectif du modèle CSV (bouton cliqué sans erreur, fichier non ouvert).
- Vrais téléphones, Safari, Firefox.
- Déploiement GitHub Pages : non vérifié, rien n'a été publié dans cette étape.
- Relecture humaine des fiches, surtout celles lues par extrait (Code_Aster, PLAXIS).

## 7. Priorités proposées

1. Fiche Robot Structural Analysis et listes de normes (CSI, Autodesk) à partir des manuels, à relever à la main.
2. Enquête Madagascar auprès de quelques bureaux d'études et de l'enseignement.
3. Fiches des logiciels de la section Madagascar, puis les autres par domaine.
4. Ajout des flux de la mission, liaison par liaison, avec leur source.
