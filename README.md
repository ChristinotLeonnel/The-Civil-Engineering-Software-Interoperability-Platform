# Civil Engineering Software Interoperability Map

Carte interactive qui montre **quels logiciels de génie civil peuvent échanger des données, par quel format, avec quelles limites**, et d'où vient chaque information.

Site statique (HTML, CSS, JavaScript) : rien à installer pour les visiteurs, pas de serveur, pas de base de données, pas de compte. Il fonctionne sur téléphone, tablette et ordinateur. Le projet est **autonome** et n'est lié à aucun éditeur de logiciel.

> Un étudiant reçoit un lien, l'ouvre sur son téléphone, touche un logiciel ou une flèche et obtient : source, destination, format, sens, données transférables, limites, versions, liens vers la documentation, date de vérification et niveau de confiance.

## Contenu

- **Carte** : réseau de 17 logiciels et 34 liaisons (Cytoscape.js), zoom et déplacement au toucher, recherche, filtres par catégorie, légende filtrante.
- **Liste** : même contenu sous forme de liste, pour les petits écrans, le clavier et les lecteurs d'écran.
- **Formats** : fiches des formats d'échange (IFC, SAF, DXF/DWG, SDNF, CIS/2, MED, etc.) et des liaisons qui les utilisent.
- **À propos** : méthode, niveaux de confiance, limites.
- **Liens profonds** : l'URL garde l'état. Exemples : `#node=tekla`, `#edge=revit--etabs`, `#view=formats`, `#format=ifc`.

## Structure du dépôt

```
index.html              page unique
css/styles.css          styles (clair/sombre, mobile d'abord)
js/                     main, graph, panel, controls, pages, data, util (modules ES, sans build)
data/                   la base de données : meta, software, connections, formats (JSON)
vendor/                 Cytoscape.js 3.30.2 (MIT), copié dans le dépôt
assets/                 icône
scripts/validate_data.py contrôle de la base (et test des liens avec --check-links)
docs/                   ARCHITECTURE.md et ADDING_DATA.md
```

Aucune étape de build. Aucune dépendance à télécharger côté visiteur : Cytoscape.js est dans `vendor/`, aucune police ni script externe.

## Tester en local

Les navigateurs bloquent la lecture de fichiers JSON quand on ouvre `index.html` en double-cliquant. Lancer un petit serveur depuis le dossier du projet :

```bash
python -m http.server 8080
# puis ouvrir http://localhost:8080
```

(Sous Windows : `py -3 -m http.server 8080`.) Toute autre commande de serveur statique convient.

Valider la base de données avant de publier :

```bash
python scripts/validate_data.py                 # contrôle structurel
python scripts/validate_data.py --check-links   # vérifie aussi que chaque URL répond
```

Avec `--check-links`, certains éditeurs répondent `403` aux scripts (blocage anti-robot) alors que la page s'ouvre normalement dans un navigateur : ouvrir ces liens à la main avant de conclure à une panne.

## Déploiement

Le site est **100 % statique** : publier le dossier tel quel.

### GitHub Pages (gratuit)

1. Créer un dépôt GitHub et y pousser le contenu de ce dossier (branche `main`).
2. Dans **Settings → Pages → Build and deployment → Source**, choisir **GitHub Actions**.
3. Le workflow `.github/workflows/pages.yml` valide les données puis publie. L'adresse sera `https://<compte>.github.io/<dépôt>/`.

Alternative sans Actions : **Source = Deploy from a branch**, branche `main`, dossier `/ (root)`. Le fichier `.nojekyll` est déjà présent. Tous les chemins du site sont relatifs, il fonctionne donc dans un sous-dossier (`/<dépôt>/`).

### Netlify (gratuit)

Glisser-déposer le dossier sur <https://app.netlify.com/drop>, ou connecter le dépôt : *Build command* vide, *Publish directory* `.`. Le fichier `netlify.toml` ajoute des en-têtes de sécurité.

### Vercel (gratuit)

Importer le dépôt, *Framework preset* « Other », sans commande de build ni dossier de sortie spécial. Le fichier `vercel.json` ajoute les mêmes en-têtes.

> Les en-têtes de sécurité (CSP) autorisent seulement les ressources du site lui-même. Si vous ajoutez un script, une police ou une image externe, il faudra adapter `netlify.toml` / `vercel.json`.

## Ajouter ou corriger un logiciel ou une connexion

Voir [docs/ADDING_DATA.md](docs/ADDING_DATA.md). En résumé : éditer `data/software.json` et `data/connections.json`, lancer `python scripts/validate_data.py`, tester en local.

L'architecture est décrite dans [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Fiabilité des informations

Règles appliquées à chaque liaison :

- Source obligatoire (documentation éditeur, guide d'interopérabilité, documentation du format ou publication technique). Les forums ne servent que d'indice et sont signalés comme tels.
- **Aucune compatibilité n'est déduite du simple fait que deux logiciels acceptent le même format.** Dans ce cas la liaison est classée « conditionnelle ou non vérifiée », avec une confiance faible.
- Chaque liaison porte : date de revue, niveau de confiance (élevé / moyen / faible), nature des preuves (`read` pages lues, `excerpt` extraits de recherche, `community` forums), versions quand elles sont documentées.
- Les possibilités varient selon les versions, licences, modules et extensions : la carte le rappelle en pied de page et sur chaque fiche.

**État de la revue (31 octobre 2026).** La revue initiale a été faite par recherche web et lecture ciblée de pages éditeurs. Certaines pages ont été lues en entier (table de compatibilité Tekla, Dlubal–Tekla, CSiXRevit, aide Archicad SAF, STAAD–Tekla), d'autres seulement à travers des extraits de résultats de recherche ; plusieurs pages éditeurs (Autodesk, SCIA, Allplan) refusent l'accès automatisé et n'ont pas pu être relues en entier. Le champ `evidence` de chaque liaison le dit. **Avant une diffusion large, une relecture humaine des liaisons `excerpt` et `community` est recommandée**, idéalement par quelqu'un qui dispose des logiciels pour les tester.

### Ce que la carte ne prétend pas

- Pas de flèche ne signifie pas « impossible », seulement « non documenté ici ». Par exemple OpenSees n'a qu'une liaison (via Gmsh) parce qu'aucune autre n'a été trouvée dans des sources fiables, pas parce qu'aucune n'existe.
- Les logos des éditeurs ne sont pas intégrés (marques déposées). Le champ optionnel `logo` de `software.json` permet d'en ajouter si vous en avez le droit.

## Accessibilité et mobile

- Cibles tactiles d'au moins 44 px, champ de recherche en 16 px (évite le zoom automatique d'iOS), mise en page testée à 390 px de large.
- Zoom et déplacement au toucher sur la carte ; le toucher à proximité d'une flèche la sélectionne (tolérance de 18 px).
- Sur téléphone, les détails s'ouvrent dans un panneau en bas d'écran ; un encart propose la **vue Liste** quand la carte est dense.
- Navigation clavier et lecteur d'écran assurées par la vue Liste, la recherche (ARIA combobox) et les boutons de filtre.
- Thème clair et sombre selon les réglages du système.

## Tests

Réalisés le 31 octobre 2026 avec Chrome (Windows) piloté par le protocole DevTools, en émulation d'appareil. **Pas de test sur de vrais appareils Android ou iPhone, ni sur Safari ou Firefox** : à faire avant une diffusion large.

| Configuration | Vérifié |
|---|---|
| Ordinateur 1440×900, souris | chargement sans erreur console, clic nœud et flèche, panneau latéral, recherche clavier (flèches, Entrée), filtres de catégorie et de type, filtre de format, bouton « Tout afficher », disposition automatique, Échap, liens profonds, vues Liste / Formats / À propos |
| Mobile 390×844, tactile, pointeur grossier | aucun défilement horizontal, sélection au toucher d'un nœud, d'une flèche (tap à 12 px) et rejet d'un tap dans une zone vide, tiroir de détails, filtres repliables, liste vers carte, thème sombre |
| Téléphone paysage 844×390 | bascule automatique de la disposition de la carte, en-tête compact, panneau latéral |
| Tablette 768×1024 | mise en page et panneau |
| En-têtes CSP du déploiement | aucune violation (Netlify et Vercel) |

Limites connues : sur téléphone, quand beaucoup de flèches convergent vers un nœud (Tekla), la carte reste dense ; la vue Liste est l'alternative prévue. L'étiquette de format affichée sur la flèche sélectionnée peut chevaucher les boutons de zoom.

## Licences

- Code du site : à choisir par le propriétaire du dépôt (ajouter un fichier `LICENSE`).
- Cytoscape.js : licence MIT, voir `vendor/cytoscape-LICENSE.txt`.
- Les noms de logiciels et de formats appartiennent à leurs propriétaires respectifs.
#   T h e - C i v i l - E n g i n e e r i n g - S o f t w a r e - I n t e r o p e r a b i l i t y - P l a t f o r m  
 