# Analyseur de parties d'échecs — Plan d'action

Objectif : une alternative locale et gratuite à l'analyse de parties de chess.com.
On donne une partie (PGN), le logiciel l'analyse avec Stockfish, note chaque coup
(Brillant, Excellent, Gaffe…), calcule la précision, et explique les erreurs.

**État (23/11/2026) : les 6 phases sont terminées et le site est en ligne :
https://cakechose.github.io/analyseur-d-checs/**

## Choix techniques

### Plateforme : application web (Vite + TypeScript)
- Tourne dans le navigateur, rien à installer, Stockfish compilé en WebAssembly.
- Site statique hébergé sur GitHub Pages ; chaque push sur `main` le republie
  (`.github/workflows/deploy.yml`). En local : `npm install` puis `npm run dev`.
- Peut devenir une appli de bureau plus tard avec Tauri sans réécrire.
- C'est l'architecture de l'analyse Lichess : prouvée.

### Moteur : Stockfish 19 WASM, version « lite single-threaded » (paquet npm `stockfish`)
- ~1,8 Mo (la version complète fait 99 Mo, trop lourde à charger) ; plus faible que la
  version complète mais très au-dessus du niveau humain. Aucun en-tête COOP/COEP requis.
- Copié de `node_modules` vers `public/stockfish/` après `npm install` (`scripts/copy-stockfish.mjs`),
  donc absent de git.
- Exécuté dans un Web Worker ; une seule recherche à la fois, une nouvelle position
  arrête la précédente (`src/engine.ts`). Scores ramenés au point de vue des Blancs.
- Protocole UCI : `position fen ...`, `go depth N`, lecture de `info ... score cp/mate ... pv ...`.
- MultiPV 3 : nécessaire pour détecter les coups "Great / seul bon coup" (écart entre 1er et 2e coup).

### Règles et notation : chess.js
- Parsing PGN, génération de FEN, validation des coups, SAN, cases attaquées (tactiques).

### Échiquier : @lichess-org/chessground
- L'ancien paquet `chessground` est abandonné sur npm ; on utilise la version maintenue par Lichess.
- Glisser-déposer, flèches (meilleur coup), surlignage des cases, animations.
- Licence GPL-3 : le projet est GPL (dépôt public).

## Organisation du code (`src/`)

| Fichier | Rôle |
|---|---|
| `main.ts` | Interface : affichage, navigation, analyse, exercices, import |
| `engine.ts` | Pilote UCI de Stockfish |
| `analysis.ts` | Évaluation des positions, notes des coups, précision ; seuils dans `THRESHOLDS` |
| `winprob.ts` | Conversion évaluation → probabilité de gain |
| `tree.ts` | Arbre des coups (partie principale + variantes) |
| `explain.ts` | Explications couche 1 (faits vérifiés) |
| `profile.ts` | Profil joueur : fiches, étiquettes des erreurs, synthèse, analyse en lot, export / import |
| `openings.ts` + `data/openings.json` | Base d'ouvertures (coups de livre, nom de l'ouverture) |
| `import.ts` | Parties chess.com / Lichess |
| `graph.ts` | Graphique d'évaluation |
| `cache.ts` | Cache des analyses (IndexedDB) |
| `game.ts` | Lecture du PGN, conversion UCI → SAN |

## Modules

### Import de partie — fait
- Coller un PGN.
- Récupérer ses 20 dernières parties via l'API publique chess.com
  (`api.chess.com/pub/player/{user}/games/archives`) et l'API Lichess (`/api/games/user/{user}`).

### Analyseur de partie (pipeline) — fait
- Pour chaque position de la partie : évaluation Stockfish (profondeur réglable 12 / 16 / 20, 16 par défaut ; MultiPV 3).
- Résultats affichés progressivement pendant l'analyse (barre de progression).
- Cache des analyses dans IndexedDB : seules les évaluations sont gardées, les notes sont
  recalculées, donc un changement de seuils s'applique aussi aux parties déjà analysées.

### Probabilité de gain (win%) — fait
- Conversion centipions -> probabilité de gain : `win% = 50 + 50 * (2 / (1 + exp(-0.00368208 * cp)) - 1)` (formule Lichess).
- Travailler en win% plutôt qu'en centipions : perdre 200 cp à +10 ne compte presque pas, à 0 c'est énorme.

### Précision par coup et par partie — fait
- Précision du coup : `103.1668 * exp(-0.04354 * perte_win%) - 3.1669`, bornée 0–100.
- Précision de la partie : moyenne pondérée (harmonique + pondération par volatilité, méthode Lichess).

### Classification des coups — fait
- Livre (Book) : la position et toutes celles d'avant sont dans la base d'ouvertures Lichess (CC0).
- Meilleur (Best) : coup n°1 du moteur.
- Excellent : perte de win% < 2.
- Bon (Good) : perte < 5.
- Imprécision : perte < 10.
- Erreur : perte < 20.
- Gaffe (Blunder) : perte >= 20.
- Très bon / Seul coup (Great) : meilleur coup ET écart win% avec le 2e coup MultiPV > 10
  ET le 2e coup ne garde pas une position nettement gagnante (≤ 75 %).
- Brillant : coup quasi parfait (perte < 2) qui sacrifie au moins 2 pions de matériel (mesuré
  après nos reprises sur la ligne du moteur), position pas déjà gagnée (< 97 %) et pas perdante après.
- Raté (Miss) : l'adversaire venait de perdre ≥ 10 points et le coup joué en perd entre 10 et 20
  (une vraie gaffe reste une gaffe).
- Les seuils sont des constantes réglables (`THRESHOLDS`), à calibrer en comparant avec des analyses chess.com.

### Barre d'évaluation — fait
- Affiche l'évaluation de la position courante (en probabilité de gain), animée ; « 1-0 / 0-1 » en cas de mat.

### Graphique d'évaluation — fait
- Courbe de la probabilité de gain sur toute la partie, cliquable, points colorés sur les erreurs et coups brillants.

### Mode exploration (jouer ses propres coups) — fait
- Depuis n'importe quelle position, jouer un autre coup sur l'échiquier (promotion automatique en dame).
- Analyse en direct par le moteur, classification du coup essayé.
- Arbre de variantes (la partie principale reste intacte), sous-variantes, suppression, ↑ pour revenir à la partie.

### Moteur d'explication — fait
- Couche 1 (règles, fiable) : faits extraits de Stockfish + chess.js :
  - réfutation : "l'adversaire répond X et gagne un cavalier" (bilan matériel sur la ligne du moteur) ;
  - pièce en prise, mat forcé, fourchette, clouage (devant le roi ou la dame) ;
  - ce que le meilleur coup obtenait (gain de matériel, mat en N, évaluation) ;
  - sacrifice d'un coup brillant, seul coup, occasion manquée.
- Couche 2 (reformulation par Claude avec une clé API) : retirée. Demander une clé API donnait
  au site un air douteux, et les faits de la couche 1 suffisent.

### Interface (UI) — fait
- Trois colonnes sur grand écran : partie / bilan / import à gauche, échiquier + barre d'éval au centre,
  commentaire du coup + moteur + liste des coups à droite. Deux colonnes sur écran moyen, une sur téléphone.
- L'échiquier prend la hauteur disponible ; la liste des coups défile seule (le plateau reste visible).
- Navigation clavier (flèches gauche/droite, ↑, Début/Fin).
- Icônes et style propres au projet (ne pas copier les visuels de chess.com).

## Idées bonus — faites
- Mode "Réessayer" : rejouer ses erreurs comme des exercices (moteur masqué, solution à la demande).
- Moments clés : boutons « ‹ Clé / Clé › » pour sauter aux gaffes, erreurs, coups brillants.
- Elo estimé à partir de la précision (simple ordre de grandeur, interpolation sur des repères).
- Rapport de partie : précision et nombre de coups par catégorie pour chaque joueur.

## Phases
1. ~~Socle : projet Vite + TS, chess.js, chessground, import PGN, navigation dans les coups.~~
2. ~~Moteur : Worker Stockfish WASM, barre d'évaluation, flèche du meilleur coup en direct.~~
3. ~~Analyse complète : pipeline, win%, précision, classification, graphique d'évaluation.~~
4. ~~Mode exploration : jouer ses coups, arbre de variantes, analyse en direct.~~
5. ~~Explications : couche règles (la couche LLM a été retirée ensuite).~~
6. ~~Bonus : import chess.com/Lichess, coups de livre, mode Réessayer, moments clés.~~
7. ~~Mise en ligne : GitHub Pages, déploiement automatique.~~
8. ~~Profil du joueur : analyse en lot des parties chess.com, synthèse des forces et faiblesses, exercices ciblés (voir ci-dessous).~~
9. ~~Version mobile : interface adaptée au téléphone + appli installable (PWA) (voir ci-dessous).~~

## Phase 8 : profil du joueur — fait (onglet « Mon profil », `src/profile.ts`)
Non fait : enfilade et attaque à la découverte, problèmes de la base Lichess, vrais comptes.

Objectif : analyser les N dernières parties d'un joueur chess.com, garder ces analyses,
et en tirer une synthèse de ses erreurs les plus fréquentes, puis des exercices ciblés.

### Pas besoin de commentaires écrits sur les coups
- La cause d'une erreur se déduit des mêmes faits vérifiés que les explications (couche 1,
  `src/explain.ts`) : au lieu de phrases, chaque erreur reçoit des **étiquettes** calculées
  (phase, pièce laissée en prise, tactique manquée…). On peut les compter ; aucune IA n'est nécessaire.

### Comptes : commencer sans serveur
- Le site est statique (GitHub Pages) : il ne peut rien stocker de son côté.
- Version 1 : le « profil » est un pseudo chess.com mémorisé dans le navigateur, et les analyses sont
  gardées dans IndexedDB (le cache existe déjà, `src/cache.ts`). Gratuit, privé, aucun compte à créer.
  Limite : les données restent dans ce navigateur → bouton export / import d'un fichier pour les déplacer.
- Plus tard, seulement si la synchronisation entre appareils devient nécessaire : un vrai système de
  comptes avec une base en ligne (ex. Supabase, offre gratuite). Ça ajoute connexion, mots de passe,
  données personnelles à protéger : à ne faire que si la version 1 ne suffit pas.

### Stockage, export et doublons
- Une fiche par partie dans IndexedDB, identifiée par le lien chess.com (ou une empreinte des
  coups pour un PGN collé), avec la profondeur utilisée. Remplace le cache actuel, dont la clé
  contient la profondeur (une même partie peut y être stockée deux fois).
- Contenu d'une fiche : le PGN et les évaluations du moteur, allégées (meilleure suite limitée à
  8 demi-coups + score du 2e coup). Les notes, la précision et les étiquettes ne sont pas stockées :
  elles se recalculent à l'ouverture (rapide), donc un changement de seuils s'applique aussi aux
  parties déjà analysées. ~15 Ko par partie.
- Partie déjà présente : réutilisée tout de suite à l'ouverture ; « Réanalyser » avec une
  profondeur plus grande la recalcule ; en lot, les parties déjà présentes sont sautées.
- Export / import d'un fichier JSON **non compressé** (~1,5 Mo pour 100 parties : assez léger,
  et ça épargne le processeur). L'import vérifie chaque fiche et fusionne (une partie présente des
  deux côtés garde la version la plus profonde). Le fichier se range où l'on veut (disque, Drive, clé USB).

### 8.1 Analyse en lot
- Choisir le pseudo et le nombre de parties (ex. 20 / 50 / 100), filtrer par cadence (blitz, rapide…).
- File d'attente : les parties sont analysées une par une, en arrière-plan, avec une progression.
  Reprise possible si on ferme la page (chaque partie finie est enregistrée).
- Plusieurs moteurs en parallèle (un Web Worker Stockfish par cœur, moins un pour la page),
  chacun sur une partie différente : gain presque proportionnel au nombre de cœurs, sans
  en-têtes COOP/COEP. Nombre de moteurs réglable + bouton pause (l'ordi chauffe, la batterie descend).
- Profondeur 12 pour le lot (3 à 4 fois plus rapide que 16). Ordre de grandeur : 50 parties en
  quelques minutes avec 6 moteurs. (Sauter les positions du livre : gain faible, pas fait.)
- Les parties déjà analysées (cache) ne sont pas recalculées.

### 8.2 Étiquettes de chaque erreur (imprécision, erreur, gaffe, raté)
- **Phase** : ouverture (encore dans le livre ou avant le coup ~12), milieu, finale
  (peu de matériel : plus de dames, ou ≤ 13 points de pièces par camp).
- **Pièce laissée en prise** : l'adversaire gagne du matériel dès le coup suivant.
- **Tactique subie** : le coup permet une fourchette, un clouage, un mat, une attaque double…
- **Tactique manquée** : le meilleur coup gagnait du matériel ou matait ; type de motif
  (fourchette, clouage, enfilade, attaque à la découverte, mat, pièce non défendue).
- **Occasion manquée** : l'adversaire venait de gaffer et on n'en a pas profité.
- **Avantage gâché** : position gagnante (≥ 80 %) qui finit en nulle ou en défaite.
- **Pression du temps** : les PGN chess.com contiennent la pendule (`%clk`) → erreurs avec moins
  de 10 % du temps restant.
- Contexte : couleur jouée, cadence, ouverture (code ECO).
- Le code de détection de `explain.ts` est réutilisé (fourchette, clouage, mat, bilan matériel).
  Une erreur sans tactique détectée est classée « erreur de position ». Enfilade et attaque à la
  découverte : plus tard.

### 8.3 Synthèse du profil
- Une synthèse par cadence (rapide, blitz, bullet, par jour) : on ne mélange pas les cadences.
  Boutons pour passer de l'une à l'autre quand plusieurs sont analysées ; la plus jouée est
  affichée d'abord. Cadence déduite du champ TimeControl avec les seuils de chess.com
  (base + 40 × incrément : bullet < 3 min, blitz < 10 min, sinon rapide).
- Réglage « Erreurs retenues » : toutes, erreurs et gaffes (perte ≥ 10 pts de chances de gain),
  ou gaffes seulement (≥ 20 pts). Les imprécisions apprennent moins : on peut les écarter.
  Le réglage filtre les causes, les erreurs par phase, les exemples et les exercices.
- Précision moyenne, par couleur, et son évolution dans le temps.
- Erreurs par phase (pour 100 coups joués dans chaque phase, pour comparer à poids égal).
- Classement des causes les plus fréquentes, avec pour chacune des exemples cliquables
  (ouvre la partie sur la position).
- Ouvertures : les plus jouées, avec le score et la précision dans chacune.
- Forces : ce qui va bien (peu d'erreurs dans une phase, tactiques trouvées, bonne conversion).

### 8.4 Exercices ciblés
- Version 1 : réutiliser le mode « Réessayer » sur **ses propres erreurs**, filtrées par faiblesse
  (ex. « toutes mes fourchettes manquées »).
- Option ensuite : la base de problèmes de Lichess (domaine public, classée par thème : fork, pin,
  mateIn2…) pour proposer de nouveaux problèmes sur les thèmes faibles. Fichier volumineux :
  n'en garder qu'un extrait par thème.

### Risques de la phase 8
- Temps d'analyse : le moteur lite dans le navigateur reste lent pour 100 parties ; prévoir la reprise
  et éventuellement une profondeur plus faible.
- Les étiquettes de tactique sont des règles simples : elles rateront certains motifs complexes.
  Mieux vaut quelques catégories fiables que beaucoup de catégories approximatives.
- Données locales : vider le navigateur efface le profil → l'export de fichier est important.

## Phase 9 : version mobile — fait
Non fait : panneaux repliables (la page s'empile simplement, la liste des coups défile), test sur de vrais téléphones.

Objectif : un site agréable sur téléphone, installable comme une appli, sans passer par les magasins.

### 9.1 Interface adaptée au téléphone
- Échiquier en pleine largeur en haut, puis le commentaire du coup et les boutons de navigation.
- Panneaux repliables (moteur, liste des coups, bilan, import) pour ne pas faire défiler sans fin.
- Boutons assez grands pour le doigt (≥ 44 px), pas d'action cachée au survol.
- Navigation entre les coups par glissement du doigt sur l'échiquier (en plus des boutons),
  à la place des raccourcis clavier.
- Page profil : tableaux empilés au lieu de déborder, onglets de cadence défilants.
- Tester sur de vrais téléphones (Android/Chrome et iPhone/Safari).

### 9.2 Appli installable (PWA)
- Manifeste (nom, icônes, couleurs, plein écran) : icône sur l'écran d'accueil.
- Service worker qui garde le site en cache : fonctionnement hors ligne (tout tourne déjà dans
  le navigateur ; seul l'import chess.com / Lichess demande le réseau).
- Mise à jour : pas de message ; les pages sont demandées au réseau d'abord, donc la dernière version
  s'affiche dès qu'on est en ligne (public/sw.js). Icônes : public/icon-*.png.

### 9.3 Réglages adaptés au mobile
- Profondeur et nombre de moteurs plus faibles par défaut sur téléphone (moins de cœurs, chauffe,
  batterie) : sur écran tactile, analyse en direct à 14, analyse de partie à 12, profil à 10,
  2 moteurs (détection : pointer: coarse).
- Garder l'écran allumé pendant l'analyse en lot (API Wake Lock) : les navigateurs mobiles
  suspendent une page en arrière-plan ; la reprise automatique existe déjà.

### Risques de la phase 9
- Analyse 2 à 4 fois plus lente que sur ordinateur.
- iPhone : Safari peut effacer les données d'un site non installé après ~7 jours sans visite →
  conseiller l'installation (PWA) et l'export du profil.
- Pas de présence dans l'App Store / le Play Store : possible plus tard (Capacitor), mais comptes
  développeur payants et validation des magasins.

## Design épuré — fait
- Pièces cburnett (libres, GPL) ; échiquier vert et crème sans relief (thème marron de chessground retiré,
  couleurs dans `src/style.css`). Les pièces façon chess.com ne sont pas libres : on ne les copie pas.
- Barre du haut : nom, onglets Analyse / Profil, bouton « Importer une partie » qui ouvre une fenêtre
  (parties chess.com / Lichess ou PGN collé).
- Noms des joueurs au-dessus et au-dessous de l'échiquier, avec Elo et précision.
- Coup commenté : une simple barre de couleur ; boutons « ‹ Erreur / Erreur › » (erreurs, ratés, gaffes).
- Profil en tableau de bord : chiffres clés (précision, Elo estimé, score, gaffes par partie),
  « Ton point faible n°1 » avec « S'entraîner » (hors catégorie fourre-tout « erreur de position »),
  causes en barres, erreurs par phase en pastilles colorées, courbe de précision par mois.
- Téléphone : barre de navigation en bas (Analyse, Importer, Profil).
- Non fait : onglets Coups / Moteur / Bilan sous l'échiquier sur téléphone.

## Phase 10 : un site organisé autour du profil — squelette (10.1 à 10.4) et pages Problèmes / Ouvertures (10.5) faits
Non fait en 10.5 : l'explorateur de « tes coups ici » (ce que tu joues dans chaque position) et le départ
des entraînements à tes points de sortie de la théorie.

Objectif : un accueil qui sert une seule fois, puis tout tourne autour de la page profil.
On construit d'abord le **squelette** (10.1 à 10.4), puis les **pages d'apprentissage** (10.5).

### 10.1 Accueil (une seule fois)
- Deux grands choix : **« Entrer mon pseudo chess.com »** (→ profil) ou **« Importer une partie »**
  (→ fenêtre d'import, puis vue de la partie).
- On n'y revient plus : le pseudo est retenu et les visites suivantes ouvrent directement le profil.
  (Sans pseudo, après un import seul, on retombe sur l'accueil à la visite suivante.)
- Plus de partie d'exemple (Morphy) chargée au démarrage.
- Petit lien **« J'ai un fichier d'analyses »** : sur un nouvel appareil, restaure tout d'un coup ; le pseudo
  est dans le fichier, donc on arrive directement sur son profil.

### 10.2 Navigation
- **Toutes les pages ont un bouton « Profil »** toujours visible (barre du haut ; barre du bas sur téléphone)
  qui ramène à la page profil.
- Le bouton « Importer une partie » est sur la page profil.

### 10.3 Page profil (page principale) — trois colonnes
- **Gauche : dernières parties** (chess.com, ~50), la même colonne que sur la vue d'une partie.
  Chaque ligne : adversaire et son Elo, date, cadence, **précision** (ou « — » si non analysée),
  et une **pastille verte / rouge / grise** pour victoire / défaite / nulle. Clic → vue de la partie.
- **Milieu : statistiques générales** (à lire) : précision moyenne, bilan victoires / nulles / défaites,
  **graphe de l'Elo** (tiré des en-têtes WhiteElo / BlackElo des parties récupérées),
  **graphe de la précision** partie par partie, boutons de cadence.
- **Droite : statistiques cliquables** (à travailler), en cartes courtes : erreurs les plus commises,
  ouvertures les plus jouées, avantage gâché… Dans le squelette, elles mènent aux vues actuelles
  (détail des causes, exercices « S'entraîner ») ; ensuite, vers les pages d'apprentissage (10.5).
- En haut : pseudo, « Importer une partie », « Analyser toutes les parties », **« Exporter mes analyses »** et
  **« Restaurer mes analyses »** (noms distincts pour ne pas confondre avec l'import d'une partie).
- Courbes Elo et précision côte à côte, avec axes. Cartes en plus, sur les dernières parties de la cadence
  (pour ne pas être faussées par les anciennes) : victoire contre l'adversaire le plus fort (Elo), adversaire le plus fort, Elo moyen
  des adversaires, performance estimée, séries, score Blancs / Noirs, fins de partie (mat, abandon, temps…).
  Carte « Toutes les cadences » (API stats chess.com, tout l'historique) : Elo actuel, meilleur Elo et sa date,
  nombre de parties, V / N / D, score ; meilleur classement en problèmes.
- Liste gardée en cache ~1 h pour ne pas interroger chess.com à chaque visite.
- Téléphone : stats générales → cartes cliquables → liste des parties.

### 10.4 Vue d'une partie
- **Gauche : la même liste des dernières parties** (partie ouverte surlignée) pour changer de partie.
- Milieu : échiquier ; droite : commentaire du coup, moteur, coups (comme aujourd'hui).
- **Le joueur du profil (ou le pseudo recherché à l'import) est toujours en bas de l'échiquier**,
  qu'il joue les Blancs ou les Noirs.
- Bouton « Analyser la partie » ; les coups se regardent avant l'analyse.
- Téléphone : la liste des parties dans un volet repliable, l'échiquier reste en haut.

### 10.5 Pages d'apprentissage (après le squelette)
- **Ouvertures** (depuis la carte « ouvertures ») : tes ouvertures avec les Blancs / les Noirs,
  score, précision, où tu sors de la théorie ; **explorateur** (coups de livre de la base d'ouvertures +
  3 meilleurs coups de Stockfish avec leurs lignes) ; **entraînement** (le site joue l'adversaire, tu dois
  trouver un coup de livre ou un des meilleurs coups).
- **Catalogue d'ouvertures** : une seule page Ouvertures, sans onglets. **En haut, « Mes ouvertures »** :
  les ouvertures les plus jouées dans tes parties analysées (avec les Blancs / les Noirs, parties, score,
  précision), mises en avant. **En dessous, « Toutes les ouvertures »** : les ~3 500 variantes nommées
  de la base Lichess, rangées par famille (Sicilienne → Najdorf, Dragon…), avec une recherche. Une variante choisie : l'échiquier rejoue la ligne de théorie, Stockfish donne
  l'évaluation et les 3 meilleures suites de la position finale, les sous-variantes sont listées,
  « Jouée N fois · score » si elle figure dans tes parties, et « S'entraîner sur cette ligne ».
  Données : un second fichier généré par `scripts/build-openings.mjs` (code, nom, coups ; ~250 Ko),
  chargé seulement à l'ouverture du catalogue. Limites : pas de popularité ni de taux de réussite
  mondiaux, noms en anglais.
- **Problèmes** (depuis la carte « erreurs ») : exercices tirés de tes erreurs, par type
  (pièce en prise, fourchette, mat manqué…), avec suivi de réussite.
- D'autres pages pourront suivre le même modèle (finales, gestion du temps…).

### Risques de la phase 10
- L'API chess.com limite le nombre de requêtes : cache de la liste des parties, chargement mois par mois.
- L'Elo n'est connu que pour les parties récupérées (pas d'historique complet sans plus d'appels).
- La base d'ouvertures donne des positions nommées, pas des statistiques de popularité :
  « coups de livre » oui, « coup le plus joué au monde » non (il faudrait l'explorateur Lichess).
- C'est une réorganisation importante de `main.ts` : à découper en pages (accueil, profil, partie,
  apprentissage) pour rester lisible.
## Pistes pour la suite
- Calibrer les seuils (surtout Brillant et Seul coup) sur des parties analysées par chess.com.
- Choix de la pièce lors d'une promotion (aujourd'hui : dame automatique).
- Version multithread de Stockfish pour analyser plus vite (nécessite les en-têtes COOP/COEP, non disponibles sur GitHub Pages).
- Appli de bureau (Tauri).

## Risques
- Les seuils de classification ne correspondront jamais exactement à chess.com (leur modèle est privé) : on vise "cohérent", pas "identique".
- La détection "Brillant" est la plus subjective : à calibrer sur des exemples (aucun sur la partie de l'Opéra de Morphy, la position y étant déjà gagnante).
- Vitesse : Stockfish WASM monothread ~1 s par position -> 1 à 2 min pour une partie de 40 coups.
- Le moteur lite est un peu plus faible que celui de chess.com : de petites différences d'évaluation sont normales.
