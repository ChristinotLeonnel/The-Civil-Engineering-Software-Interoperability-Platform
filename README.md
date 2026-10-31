# Civil Engineering Software Interoperability Map

Carte interactive qui montre **quels logiciels de génie civil peuvent échanger des données, par quel format, avec quelles limites**, et d'où vient chaque information. Présentation et navigation inspirées de l'éditeur de graphes **Blueprint** d'Unreal Engine.

Site statique (HTML, CSS, JavaScript) : rien à installer pour les visiteurs, pas de serveur, pas de base de données, pas de compte, aucune bibliothèque externe. Il fonctionne sur téléphone, tablette et ordinateur. Le projet est **autonome** et n'est lié à aucun éditeur de logiciel.

> Un étudiant reçoit un lien, l'ouvre sur son téléphone, touche un logiciel ou un câble et obtient : source, destination, format, sens, données transférables, limites, versions, liens vers la documentation, date de vérification et niveau de confiance.

## Interface

Présentation de type tableau de bord : **barre latérale** marine (Exploration · Édition · Information), réductible en rail d'icônes avec le bouton « ; zone principale claire avec le titre, la recherche et le bouton **Filtres** ; le graphe dans une **carte** dont la barre de titre affiche en pastille rouge le nombre de liaisons incertaines masquées ; vues Liste et À propos en cartes, **tableaux** à en-tête marine et **tuiles** de chiffres. Sur téléphone et tablette, la barre latérale s'ouvre avec le bouton ☰.

## Modifier le graphe (mode édition)

Le menu **Mode édition** permet à chaque visiteur de compléter le graphe :

- **＋ Logiciel** : ajoute un nœud (nom, catégorie, éditeur, site, description), placé au centre de la vue ;
- **＋ Liaison**, ou en **tirant le port ➜** d'un nœud vers un autre : crée une liaison (sens, type d'échange, formats, remarques) ;
- **＋ Bloc** : ajoute un cadre de commentaire à la manière de Blueprint ; glisser son titre déplace aussi les logiciels qu'il contient, le coin inférieur droit le redimensionne ;
- sélectionner un ajout ouvre ses boutons **Modifier** et **Supprimer** (touche Suppr en mode édition) ;
- la disposition des nœuds déplacés est conservée ; le bouton ▥ remet les colonnes.

Les ajouts sont marqués **« ajout personnel, non vérifié »**, toujours visibles quel que soit le filtre de fiabilité, et **ne modifient jamais la base vérifiée** (lecture seule). Ils sont enregistrés **dans le navigateur du visiteur** (localStorage) : **Exporter mes modifications** produit un fichier JSON, **Importer** le recharge (sur un autre appareil, ou chez un collègue), **Réinitialiser** revient à la base vérifiée. Le site restant statique, il n'y a pas d'édition partagée entre visiteurs ; pour intégrer un ajout à la base publique, envoyer le fichier exporté au mainteneur, qui vérifie les sources puis l'ajoute dans `data/` (voir [docs/ADDING_DATA.md](docs/ADDING_DATA.md)).

## Contenu

- **Graphe** (style Blueprint) : 17 logiciels en nœuds et 34 liaisons en câbles, sur une grille sombre.
  - Chaque nœud a un en-tête coloré selon sa catégorie et une **broche par liaison** : entrées à gauche, sorties à droite. Le libellé de la broche donne le logiciel relié et le format.
  - Les câbles sont colorés selon le type d'échange (blanc et broche triangulaire = lien direct, vert = format ouvert, bleu = extension/API, gris pointillé = géométrie seule, orange tireté = non vérifié). Quand une liaison est sélectionnée, des impulsions montrent le sens du transfert.
  - Des **cadres de commentaire** regroupent les logiciels par catégorie, en colonnes : CAO → BIM → calcul → maillage → éléments finis.
- **Liaisons sûres par défaut** : seules les liaisons de confiance élevée ou moyenne (documentées par un éditeur) sont affichées ; les liaisons de confiance faible (forums, déductions, « non vérifiées ») sont masquées. Le filtre **Fiabilité** permet de les réafficher ; un rappel en haut du graphe indique combien sont masquées.
- **Place maximale pour le graphe** : en-tête sur une ligne, filtres repliés derrière le bouton **Filtres** (le choix est mémorisé), légende compacte superposée et masquable (bouton ◧ ou ×), mode **plein écran** du graphe (bouton ⛶, Échap pour sortir). À l'ouverture sur ordinateur, le zoom suffit pour lire les broches sans zoomer.
- **Liste** : même contenu sous forme de liste, pour les petits écrans, le clavier et les lecteurs d'écran.
- **Formats** : fiches des formats d'échange (IFC, SAF, DXF/DWG, SDNF, CIS/2, MED, etc.) et des liaisons qui les utilisent.
- **À propos** : méthode, niveaux de confiance, limites.
- **Panneau « Détails »** à sections repliables (comme le panneau Details d'Unreal).
- **Liens profonds** : l'URL garde l'état. Exemples : `#node=tekla`, `#edge=revit--etabs`, `#view=formats`, `#format=ifc`.

## Navigation dans le graphe

| Action | Souris / clavier | Écran tactile |
|---|---|---|
| Déplacer la vue | clic droit (ou molette-clic) + glisser, ou glisser le fond | glisser |
| Zoomer | molette, par paliers (« Zoom -2 », « Zoom 1:1 »…) sous le curseur | pincer |
| Ouvrir les détails | clic sur un nœud ou un câble | toucher |
| Déplacer un nœud | glisser le nœud | appui long puis glisser |
| Déplacer un groupe | glisser le titre du cadre | appui long sur le titre puis glisser |
| Tout afficher | touche Origine, bouton ⤢ | bouton ⤢ |
| Cadrer la sélection | touche F | — |
| Désélectionner | Échap, clic sur le fond | toucher le fond |
| Remettre en colonnes | bouton ▥ | bouton ▥ |
| Graphe plein écran | bouton ⛶, Échap pour sortir | bouton ⛶ |
| Afficher / masquer la légende | bouton ◧ | bouton ◧ |

Le bouton **?** de la carte rappelle ces commandes. Quand on dézoome, les libellés des broches disparaissent et les titres s'agrandissent pour rester lisibles. Survoler un câble ou une broche à la souris affiche une infobulle.

## Structure du dépôt

```
index.html               page unique
css/styles.css           thème « éditeur Blueprint » (sombre), mobile d'abord
js/                      main, graph, panel, controls, pages, data, util (modules ES, sans build)
data/                    la base de données : meta, software, connections, formats (JSON)
assets/                  icône
scripts/validate_data.py contrôle de la base (et test des liens avec --check-links)
scripts/build.mjs        assemble dist/ (fichiers publics seulement, versionnés)
scripts/stamp-version.mjs met à jour le numéro de version ?v= des CSS/JS
docs/                    ARCHITECTURE.md et ADDING_DATA.md
```

Aucune étape de build obligatoire et aucune dépendance : le rendu du graphe est écrit à la main (nœuds HTML, câbles SVG), sans bibliothèque, police ni script externe.

## Tester en local

Les navigateurs bloquent la lecture de fichiers JSON quand on ouvre `index.html` en double-cliquant. Lancer un petit serveur depuis le dossier du projet :

```bash
npx serve . -l 8080            # avec Node.js
python -m http.server 8080     # ou avec Python (Windows : py -3 -m http.server 8080)
# puis ouvrir http://localhost:8080
```

Valider la base de données avant de publier :

```bash
python scripts/validate_data.py                 # contrôle structurel
python scripts/validate_data.py --check-links   # vérifie aussi que chaque URL répond
node scripts/build.mjs                          # assemble dist/ (facultatif)
```

Avec `--check-links`, certains éditeurs répondent `403` aux scripts (blocage anti-robot) alors que la page s'ouvre normalement dans un navigateur : ouvrir ces liens à la main avant de conclure à une panne.

## Déploiement

Le site est **100 % statique** : publier le dossier tel quel (ou `dist/`).

### GitHub Pages (gratuit)

1. Pousser le contenu de ce dossier sur la branche `main` d'un dépôt GitHub.
2. Dans **Settings → Pages → Build and deployment → Source**, choisir **GitHub Actions**. Sans cette étape, le workflow échoue avec « Get Pages site failed ».
3. Le workflow `.github/workflows/pages.yml` valide les données puis publie. L'adresse sera `https://<compte>.github.io/<dépôt>/`.

Tous les chemins du site sont relatifs, il fonctionne donc dans un sous-dossier (`/<dépôt>/`). Le fichier `.nojekyll` est présent.

### Netlify (gratuit)

Glisser-déposer le dossier (ou `site-publiable.zip`, produit à partir de `dist/`) sur <https://app.netlify.com/drop>, ou connecter le dépôt : *Build command* vide, *Publish directory* `.`. Le fichier `netlify.toml` ajoute des en-têtes de sécurité.

### Vercel (gratuit)

Importer le dépôt, *Framework preset* « Other », sans commande de build ni dossier de sortie spécial. Le fichier `vercel.json` ajoute les mêmes en-têtes.

### Mises à jour et cache des navigateurs

Les fichiers CSS et JS sont appelés avec un numéro de version (`styles.css?v=…`, et chaque `import` de module porte le même numéro). Sans lui, un navigateur peut combiner la nouvelle page avec d'anciens fichiers gardés en mémoire, ce qui casse le site après une mise à jour (page sans graphe ni filtres).

- Le workflow GitHub Pages et `node scripts/build.mjs` posent automatiquement un numéro unique à chaque publication.
- Pour un déploiement manuel du dossier racine (Netlify par glisser-déposer, par exemple), lancer d'abord `node scripts/stamp-version.mjs` après toute modification de CSS ou de JS.
- Netlify et Vercel reçoivent en plus `Cache-Control: no-cache` (revalidation à chaque visite).
- Si le démarrage échoue malgré tout, la page affiche un message avec un bouton « Recharger la page » au lieu d'une page à moitié construite.

> Les en-têtes de sécurité (CSP) autorisent seulement les ressources du site lui-même. Si vous ajoutez un script, une police ou une image externe, il faudra adapter `netlify.toml` / `vercel.json`.

## Ajouter ou corriger un logiciel ou une connexion

Voir [docs/ADDING_DATA.md](docs/ADDING_DATA.md). En résumé : éditer `data/software.json` et `data/connections.json`, lancer `python scripts/validate_data.py`, tester en local. Les nœuds et leurs broches sont générés automatiquement à partir des données.

L'architecture est décrite dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Fiabilité des informations

Règles appliquées à chaque liaison :

- Source obligatoire (documentation éditeur, guide d'interopérabilité, documentation du format ou publication technique). Les forums ne servent que d'indice et sont signalés comme tels.
- **Aucune compatibilité n'est déduite du simple fait que deux logiciels acceptent le même format.** Dans ce cas la liaison est classée « conditionnelle ou non vérifiée », avec une confiance faible.
- Chaque liaison porte : date de revue, niveau de confiance (élevé / moyen / faible), nature des preuves (`read` pages lues, `excerpt` extraits de recherche, `community` forums), versions quand elles sont documentées.
- Les possibilités varient selon les versions, licences, modules et extensions : le site le rappelle en pied de page et sur chaque fiche.

**État de la revue (31 octobre 2026).** La revue initiale a été faite par recherche web et lecture ciblée de pages éditeurs. Certaines pages ont été lues en entier (table de compatibilité Tekla, Dlubal–Tekla, CSiXRevit, aide Archicad SAF, STAAD–Tekla), d'autres seulement à travers des extraits de résultats de recherche ; plusieurs pages éditeurs (Autodesk, SCIA, Allplan) refusent l'accès automatisé et n'ont pas pu être relues en entier. Le champ `evidence` de chaque liaison le dit. **Avant une diffusion large, une relecture humaine des liaisons `excerpt` et `community` est recommandée**, idéalement par quelqu'un qui dispose des logiciels pour les tester.

### Ce que la carte ne prétend pas

- Pas de câble ne signifie pas « impossible », seulement « non documenté ici ». Par exemple OpenSees n'a qu'une liaison (via Gmsh) parce qu'aucune autre n'a été trouvée dans des sources fiables, pas parce qu'aucune n'existe.
- La ressemblance avec Blueprint est visuelle : le site n'utilise ni code ni ressource d'Unreal Engine.
- Les logos des éditeurs ne sont pas intégrés (marques déposées). Le champ optionnel `logo` de `software.json` permet d'en ajouter si vous en avez le droit.

## Accessibilité et mobile

- Cibles tactiles d'au moins 44 px, champ de recherche en 16 px (évite le zoom automatique d'iOS), mise en page testée à 390 px de large.
- Les nœuds du graphe sont de vrais éléments HTML : Tabulation pour les parcourir, Entrée pour ouvrir, flèches pour déplacer la vue, + et − pour zoomer.
- Au toucher, la zone sensible d'un câble fait 26 px de large quel que soit le zoom ; sur petit écran, la vue de départ garde un zoom lisible plutôt que de tout faire tenir.
- Sur téléphone, les détails s'ouvrent dans un tiroir en bas d'écran ; un encart propose la **vue Liste** quand le graphe est dense.
- Thème sombre unique (celui de l'éditeur Blueprint) ; contrastes vérifiés pour le texte courant.

## Tests

Réalisés le 31 octobre 2026 avec Chrome (Windows) piloté par le protocole DevTools, en émulation d'appareil, avec les en-têtes CSP du déploiement. **Pas de test sur de vrais appareils Android ou iPhone, ni sur Safari ou Firefox** : à faire avant une diffusion large.

| Configuration | Vérifié |
|---|---|
| Ordinateur 1440×900, souris | chargement sans erreur console, 17 nœuds et 34 câbles affichés, clic sur un nœud et sur un câble (à 5 px), panneau Détails, clic droit + glisser pour déplacer la vue, molette par paliers (« Zoom -1 »), glisser un nœud, remise en colonnes, désélection par clic sur le fond, filtre de format, vue Liste |
| Mobile 390×844, tactile | aucun défilement horizontal, glisser pour déplacer la vue, pincer pour zoomer, toucher un nœud (tiroir de détails), toucher un câble (à 8 px), glisser depuis un nœud = déplacer la vue, appui long + glisser = déplacer le nœud |

Limites connues : quand beaucoup de câbles convergent vers un nœud (Tekla), le graphe reste dense ; la vue Liste est l'alternative prévue. Les positions des nœuds déplacés à la main ne sont pas conservées au rechargement.

## Licences

- Code du site : à choisir par le propriétaire du dépôt (ajouter un fichier `LICENSE`).
- Les noms de logiciels et de formats appartiennent à leurs propriétaires respectifs. Unreal Engine et Blueprint sont des marques d'Epic Games ; ce projet n'y est pas affilié.
