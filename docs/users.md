# Guide utilisateur

HubGamers permet de gerer une organisation, ses equipes et ses tournois depuis un dashboard unique.

## 1. Dashboard

Le dashboard donne une vue d'ensemble des organisations auxquelles vous avez acces.

Fonctions principales:

- Voir vos organisations.
- Acceder rapidement aux equipes et tournois.
- Utiliser la recherche globale pour retrouver une organisation, une equipe, un tournoi ou une invitation.
- Consulter les notifications utiles, notamment les invitations en attente.

## 2. Organisations

Une organisation represente un club, une association, une structure esport ou un organisateur.

Depuis une organisation, vous pouvez:

- Consulter le resume de l'activite.
- Gerer les membres.
- Inviter de nouveaux membres.
- Gerer les equipes.
- Gerer les tournois.
- Ajuster les parametres de l'organisation.

### Membres et invitations

Les invitations permettent d'ajouter un membre par email.

Parcours:

1. Ouvrir l'organisation.
2. Aller dans les parametres ou la section membres.
3. Saisir l'email et le role.
4. Envoyer l'invitation.
5. Le membre invite retrouve l'invitation dans son dashboard.
6. Il accepte l'invitation pour rejoindre l'organisation.

Roles usuels:

- `OWNER`: proprietaire.
- `ADMIN`: gestion avancee.
- `MODERATOR`: gestion operationnelle.
- `MEMBER`: acces membre.

## 3. Equipes

Une equipe appartient a une organisation.

Vous pouvez:

- Creer une equipe.
- Modifier son nom et son logo.
- Ajouter des joueurs.
- Importer des equipes et joueurs en masse.

### Import massif d'equipes

L'import accepte un fichier Excel ou CSV.

Colonnes recommandees:

```text
Equipe | Joueur | Numero | Role
```

Le systeme detecte les colonnes, affiche une preview, puis cree les equipes et joueurs apres validation.

Regles importantes:

- La colonne equipe est obligatoire.
- Les lignes avec le meme nom d'equipe sont groupees.
- Les joueurs sont optionnels.
- Les equipes deja existantes ne sont pas recreees.

## 4. Tournois

Un tournoi est rattache a une organisation et a un jeu.

Le wizard de creation permet de definir:

- Le nom et le slug.
- Les dates.
- Le nombre maximum d'equipes.
- Le statut public/prive.
- Les phases du tournoi.

Types de phases disponibles:

- Poules.
- Bracket simple.
- Double bracket.
- Placement bracket.
- Ronde suisse.
- Phase custom.

## 5. Gestion d'un tournoi

La page d'un tournoi est organisee en onglets.

### Vue d'ensemble

Permet de verifier les informations principales du tournoi:

- Statut.
- Dates.
- Nombre d'inscriptions.
- Phases.
- Elements visuels d'overlay.
- Sponsors si configures.

### Phases

Permet de configurer le parcours du tournoi.

Actions possibles:

- Ajouter ou reordonner les phases.
- Configurer les routes entre phases.
- Fermer une phase.
- Relancer une propagation.
- Dupliquer un tournoi.
- Reinitialiser le tournoi pour reconfiguration.

### Inscriptions et pistes

Permet de preparer les participants et les ressources de jeu.

Actions possibles:

- Ajouter une equipe au tournoi.
- Confirmer ou retirer une inscription.
- Creer des pistes, terrains, postes ou ressources.
- Importer plusieurs pistes d'un coup.
- Supprimer des pistes en masse.

### Poules et placements

Pour une phase de poules, vous pouvez:

- Configurer le nombre de groupes.
- Placer automatiquement les equipes.
- Deplacer les equipes dans les groupes.
- Associer des pistes par groupe.
- Generer les matchs a partir des placements.

### Planning et timers

Permet de piloter l'organisation le jour J.

Actions possibles:

- Demarrer un timer de pause.
- Lancer les matchs d'une tranche horaire.
- Gerer les rotations si le tournoi utilise un mode entrelace.

### Matchs

L'onglet matchs suit quatre etapes.

1. Generer automatiquement:
   - choisir une phase;
   - definir l'heure de debut;
   - definir la duree des matchs;
   - definir le battement entre matchs;
   - generer un round-robin.

2. Ajouter manuellement:
   - creer un match unique;
   - ou importer plusieurs matchs avec trois colonnes texte: horaires, pistes, matchups.

3. Verifier:
   - consulter la liste des matchs;
   - filtrer/selectionner par statut;
   - ouvrir le detail d'un match;
   - supprimer une selection.

4. Mettre a jour:
   - modifier plusieurs statuts;
   - saisir les scores;
   - ajouter des notes;
   - sauvegarder toutes les modifications en une fois.

Statuts de match:

- `SCHEDULED`: programme.
- `LIVE`: en direct.
- `FINISHED`: termine.
- `CANCELLED`: annule.

## 6. Brackets

Les brackets affichent les matchs organises par rounds.

Fonctions:

- Voir les matchs par colonne de round.
- Acceder au detail d'un match.
- Saisir un resultat depuis certaines vues.
- Suivre les progressions automatiques quand la phase precedente est terminee.

### Placement bracket

Le placement bracket sert a classer les equipes par places finales.

Il peut afficher:

- un winner bracket;
- des arbres de placement;
- des labels de places configurables;
- des rotations et tranches horaires;
- un classement deduit des resultats.

## 7. Bonnes pratiques jour de tournoi

Avant le debut:

- Verifier que les equipes sont inscrites et confirmees.
- Verifier que les pistes existent.
- Verifier que les phases sont dans le bon ordre.
- Generer les matchs.
- Controler la liste des matchs.

Pendant le tournoi:

- Utiliser les statuts `LIVE` et `FINISHED`.
- Mettre les scores a jour regulierement.
- Fermer les phases terminees.
- Relancer la propagation si une phase suivante n'est pas alimentee comme prevu.

Apres le tournoi:

- Verifier les resultats finaux.
- Marquer le tournoi comme termine si le workflow le demande.
- Dupliquer le tournoi si vous voulez reutiliser la structure pour une prochaine edition.

## 8. Depannage rapide

Une invitation n'apparait pas:

- Verifier que l'email invite correspond a l'email du compte connecte.
- Verifier que l'invitation n'est pas expiree ou deja acceptee.

Une generation de matchs ne marche pas:

- Verifier qu'il y a au moins deux equipes.
- Verifier qu'au moins une piste existe.
- Verifier que la phase choisie est correcte.

Une equipe n'apparait pas dans un tournoi:

- Verifier qu'elle existe dans l'organisation.
- Verifier qu'elle est inscrite au tournoi.
- Verifier que l'inscription est confirmee si le generateur est configure en "confirmees uniquement".

Un bracket ne se remplit pas:

- Verifier que la phase precedente est terminee.
- Verifier les routes de qualification.
- Relancer la propagation depuis l'onglet phases.
