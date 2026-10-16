# Lisibilité à distance — script Adobe Illustrator

**LisibiliteDistance.jsx** v1.0.0 — vérifie que chaque texte d'un panneau, d'une affiche, d'une bâche, d'un kakémono, d'une vitrine, d'un stand ou d'une diapositive sera **vraiment lisible à la distance où on le lira**, en mesurant la hauteur réelle des lettres une fois imprimées.
*Checks that every text on a sign, poster, banner, roll-up, window, booth or slide will really be readable from the distance it will be read at, by measuring the real printed letter height (FR/EN dialog).*

## Ce que fait le script

Le corps en points ne dit pas si un texte est lisible de loin : deux polices au même corps n'ont pas la même hauteur de capitale, un bloc agrandi à la flèche de sélection garde son corps d'origine, et une bâche dessinée au 1:10 ou un document « grand format » trompe toutes les règles de tête. Le script fait le calcul à la place du graphiste :

1. **il mesure la police réelle** : il vectorise en coulisse un « H » (hauteur de capitale), un « x » (hauteur d'x, en option) et un alif « ا » pour l'arabe, à 100 pt, dans chaque police utilisée, puis efface ces mesures ;
2. **il calcule la hauteur imprimée de chaque passage de texte** : corps × rapport mesuré × échelle verticale × mise à l'échelle du bloc (matrice du texte) × échelle du document (1:4, 1:10…) × facteur des documents grand format (en option) ; dans un texte, c'est le passage le plus petit qui compte ; un texte bilingue arabe + latin est jugé sur l'écriture la plus petite ;
3. **il compare à la distance de lecture prévue**, globale ou propre à chaque objet (note de l'objet « distance=12 ») ou à chaque calque (nom « Hall d'accueil [12 m] », « Façade [60 ft] »), selon un critère au choix :
   - **angle visuel 20′** (lecture confortable) ou **16′** (seuil minimal), valeurs de la norme ISO 9241-303, ou angle personnalisé ;
   - **règle « 1 pouce par 10 pieds »** des enseignistes (≈ 2,5 cm de capitale pour 3 m) ;
   - **ADA 2010 §703.5.5** (signalétique accessible aux États-Unis) : hauteur minimale selon la hauteur de la ligne de base au-dessus du sol et la distance horizontale (+ 1/8 in par pied), avec signalement d'une pose sous 40 in (1016 mm) ;
4. **il donne pour chaque texte** : hauteur réelle, hauteur requise, **distance maximale de lecture** et **corps minimal conseillé** (arrondi au demi-point supérieur), avec un statut TROP PETIT, JUSTE (dans une marge réglable, 10 % par défaut) ou OK ;
5. **il signale les traits trop fins** (filets, pictogrammes au trait, soulignés) qui disparaîtront à cette distance, avec l'épaisseur conseillée (seuil en minutes d'arc, 1′ = acuité 10/10 par défaut).

Résultat :

- **Analyser** : le rapport complet s'affiche dans la fenêtre, sans rien modifier ; **Enregistrer le rapport…** l'écrit dans un fichier .txt de votre choix ;
- **OK** : cadres et étiquettes de couleur (rouge trop petit, orange juste, vert conforme, magenta trait fin) sur le calque non imprimable **« Lisibilité à distance – repères »**, sélection des textes et traits à corriger ;
- option **Agrandir les textes trop petits au corps conseillé** (les textes verrouillés sont laissés tels quels ; vérifiez ensuite les débordements des textes captifs) ;
- **Effacer les repères** supprime le calque de repères.

La fenêtre affiche en direct la hauteur requise à la distance saisie, en taille réelle et à l'échelle du document. Les réglages sont mémorisés dans un petit fichier local (dossier des données utilisateur).

## Pourquoi c'est nouveau

Vérifié le 16 octobre 2026 :

- **Illustrator** n'a aucune notion de distance de lecture. L'option native *Hauteur de police* (capitale, x, ICF) change seulement la façon d'afficher le corps ; rien ne compare un texte à une distance, ne tient compte de l'échelle 1:N d'une bâche ni ne dit « lisible jusqu'à 6 m ».
- **Les calculateurs de lisibilité existent seulement hors d'Illustrator**, comme pages web où l'on tape une distance pour obtenir une hauteur de lettre (AltFTool *Text Legibility Distance Calculator*, The Sign Chef *Letter Sizing Calculator*, formspiel *Display Character Size Calculator*, tableaux d'enseignistes comme Pannier Graphics). Ils ne lisent pas le fichier : le graphiste doit mesurer chaque texte à la main.
- **Les contrôles en amont pour Illustrator** (Esko DeskPack Packaging Preflight, Botson Preflight, et mon script ControlePreflight) vérifient un corps minimal en points, la couleur, les traits fins en épaisseur absolue, etc. D'après leurs pages, aucun ne relie la hauteur des lettres à une distance de lecture ni au tableau ADA 703.5.5.
- **GitHub et auteurs connus** : aucune recherche (« illustrator legibility distance », « illustrator signage cap height », code `.jsx` contenant « viewing distance ») ne renvoie de script Illustrator de ce type ; rien chez creold, Hiroyuki Sato, John Wundes, Alexander Ladygin, Kelso Cartography ni dans les quelque 200 scripts de vexy. Le *Road Sign Generator* de Sergei Turulin (adobescript.com) fabrique des panneaux routiers ukrainiens à partir de gabarits ; il ne contrôle pas la lisibilité d'un document existant.

## Installation

- **Ponctuelle** : Fichier > Scripts > Autre script…, puis choisir `LisibiliteDistance.jsx`.
- **Permanente** : copier le fichier dans le dossier `Presets/<langue>/Scripts` d'Illustrator (par exemple `Adobe Illustrator 2026/Presets/fr_FR/Scripts` sur macOS ou `C:\Program Files\Adobe\Adobe Illustrator 2026\Presets\fr_FR\Scripts` sur Windows), puis redémarrer Illustrator. Le script apparaît dans Fichier > Scripts.

## Utilisation

1. Travaillez sur une **copie** de votre fichier (seule l'option d'agrandissement modifie les textes).
2. Sélectionnez les textes (et les traits) à contrôler, ou rien pour contrôler tout le document. Les textes doivent être vivants (non vectorisés).
3. Lancez le script, saisissez la distance de lecture et l'échelle du document (1 si le fichier est en taille réelle, 10 s'il est au dixième), choisissez le critère et cliquez sur **Analyser**.
4. Cliquez sur **OK** pour poser les repères et sélectionner les textes à agrandir.

Distances différentes dans un même fichier : écrivez `distance=2,5` (unité de la fenêtre) ou `distance=8 ft` dans la note de l'objet (panneau Attributs), ou mettez la distance entre crochets dans le nom du calque : `Plan d'accès [1,5 m]`. Pour l'ADA, la hauteur de pose peut aussi être donnée dans la note : `hauteur=1,6`.

**Annuler** : Ctrl+Z / Cmd+Z (plusieurs fois si besoin), ou **Effacer les repères**.

## Version cible et statut des tests

- Cible : Adobe Illustrator CC 2018 et plus récent (ExtendScript, Windows et macOS).
- **Non testé dans Illustrator.**
- Syntaxe vérifiée avec acorn en mode ES3 et ES5 (`npx acorn --ecma3` et `--ecma5`).
- Calculs vérifiés sur données simulées (`tests/test-core.js`, 58 tests) : angle visuel (20′ à 10 m ≈ 58,2 mm, exemple publié 22′ à 8 m ≈ 51 mm, équivalence 1 in / 10 ft ≈ 28,6′), règle des enseignistes, les trois bandes du tableau ADA 703.5.5 et leurs limites (40, 70, 120 in), inverse distance maximale, statuts et marge, hauteur réelle (échelle verticale, matrice, 1:10), corps conseillé, lecture des notes et des noms de calques (m, ft, in, virgule décimale), classement des écritures (latin, arabe, chiffres, tatweel et harakat ignorés), formats FR/EN.
- Logique Illustrator vérifiée sur objets simulés (`tests/test-simulation.js`, 55 tests) : mesure de la police par vectorisation et cache, calque temporaire supprimé, statuts à 5 m et 2 m, repères et étiquettes (CMJN), sélection, échelle 1:10 et facteur grand format, distances par calque et par note, texte bilingue arabe + latin (alif), glyphe absent (valeur estimée signalée), calque masqué, texte verrouillé, bloc mis à l'échelle, agrandissement, traits fins, ADA en pieds, analyse sans modification, effacement, portée sélection, interface anglaise, alertes sans document et sans sélection. Ces simulations ne remplacent pas un essai réel.

Pour lancer les tests : `node tests/test-core.js` puis `node tests/test-simulation.js` (Node.js seul, sans dépendance).

Limites : la mesure suppose des textes vivants ; la hauteur de l'alif sert de référence pour l'arabe (convention de ce script, à adapter à votre charte) ; le texte en excès d'un bloc captif est aussi compté ; les effets (Distorsion, Transformation) et les textes dans les symboles ne sont pas lus ; la façon dont les documents grand format exposent leurs dimensions aux scripts n'a pas pu être vérifiée, d'où la case à cocher du facteur ×10. Les critères sont des repères de conception : contraste, éclairage, graisse et chasse de la police comptent aussi, et la conformité réglementaire (ADA ou autre) reste à valider par le maître d'ouvrage.

Aucun appel réseau, aucune collecte de données.

## Licence

MIT © 2026 Amirouche Amwanes — voir [LICENSE](LICENSE).
