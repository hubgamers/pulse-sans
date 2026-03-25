# Guide - Édition des Placement Brackets

## 🎯 Objectif Réalisé

Une page d'édition externe pour les **placement brackets** avec interface **fullscreen** permettant aux admins d'éditer les résultats de chaque match via une popup.

## 📍 Accès à la Fonctionnalité

### 1. Depuis l'interface existante
- Allez sur la page du **bracket d'un tournoi**
- Cherchez le bouton **"Éditer en grand"** dans le header du placement bracket
- Cliquez pour ouvrir la page d'édition fullscreen

### 2. Accès direct via URL
```
/dashboard/org/{org-slug}/tournaments/{tournament-slug}/bracket/placement
```

## 🎨 Interface d'Édition

### Vue d'ensemble
- **Affichage en grand**: Les brackets occupent toute la largeur (mode sombre/moderne)
- **8 arbres de placement** organisés (si configurés):
  - 🏆 Winner Bracket (tableau principal)
  - 🥈 Place 25 à 32
  - 🥉 Place 21 à 24
  - Place 19 & 20
  - Place 29 à 32
  - Place 27 & 28
  - Place 31 & 32
  - Place 23 & 24

### Navigation
- Si **plusieurs phases PLACEMENT_BRACKET** existent → **Tabs** pour sélectionner la phase
- Bouton **"Retour tournoi"** pour revenir

## ✏️ Édition des Résultats

### Comment éditer un match?
1. **Cliquez sur une carte de match** dans le bracket
2. Une **popup modale** apparaît avec:
   - Nom des deux équipes
   - Champs pour entrer les **scores** (homeScore / awayScore)
   - Champ optionnel pour les **remarques**
3. Entrez les scores et cliquez **"Enregistrer"**
4. Le résultat est sauvegardé et le gagnant est **propagé automatiquement** au match suivant

### Validation
- Les scores doivent être remplis (0-999 chacun)
- Les notes sont optionnelles
- Erreurs affichées en cas de problème de sauvegarde

## 🔄 Intégration Système

### Composition des fichiers créés

**Page Server** (`app/dashboard/org/[slug]/tournaments/[t-slug]/bracket/placement/page.tsx`):
- Récupère les données du tournoi
- Charge toutes les phases PLACEMENT_BRACKET
- Récupère tous les matchs avec résultats
- Passe les données au composant client

**Composant Client** (`components/dashboard/tournaments/PlacementBracketEditor.tsx`):
- Gère l'affichage interactif du bracket
- Gère l'état selectedPhase, editingMatch
- Ouvre la modale au clic sur un match
- Thème moderne (dégradés noirs/slate, bordures teal/amber)

**Composant Modal** (`components/dashboard/tournaments/MatchResultModal.tsx`):
- Affiche la popup d'édition
- Collecte les scores et remarques
- Appelle `recordTournamentMatchResult` (server action existante)
- Ferme automatiquement après succès

**Modification** (`components/dashboard/tournaments/PlacementBracketPhaseView.tsx`):
- Ajout du bouton "Éditer en grand" dans le header

## 🔧 Détails Techniques

### Dimensions du canvas
```
- Colonne: 280px (espace horizontal par round)
- Ligne: 64px (espace vertical par match)
- Carte match: 228px × 92px
- Padding: 60px (horizontal), 120px (vertical)
```

### Format des bracketPos
- **Winner**: `WB-R{round}-M{matchNo}`
- **Placement**: `P{start}-{end}-R{round}-M{matchNo}`
  - Exemple: `P25-32-R1-M1` = Bracket Place 25-32, Round 1, Match 1

### Server Action Utilisée
```typescript
recordTournamentMatchResult(formData)
```
- Met à jour le match et son résultat
- Détermine automatiquement le gagnant
- Propage le gagnant au match suivant via `propagateWinnerToNextBracketMatch`

## 🎯 Cas d'Usage - Workflow Admin

1. **Admin accède au tournoi** → **Visualisation des brackets**
2. **Clique "Éditer en grand"** → **Page placement fullscreen** s'ouvre
3. **Clique sur un match** → **Modal s'ouvre**
4. **Saisit les scores** → **Clique Enregistrer**
5. **Le résultat est enregistré**
6. **Le gagnant est propagé** au bracket suivant (si applicable)
7. **La modal se ferme** → admin peut éditer d'autres matchs

## 📝 Notes

- La page recharge les données via les server actions (pas de refresh manuelle)
- Les résultats sont immédiatement disponibles pour les autres utilisateurs
- Support du responsive (scroll horizontal pour grands brackets)
- Thème sombre optimisé pour l'affichage sur écran large

## ✅ Checklist de Test

- [ ] Accéder à `/bracket` d'un tournoi avec placement bracket
- [ ] Voir le bouton "Éditer en grand"
- [ ] Cliquer et vérifier que la page fullscreen s'affiche
- [ ] Cliquer sur un match → la modal apparaît
- [ ] Entrer les scores → cliquer Enregistrer
- [ ] Vérifier que le score s'affiche dans le bracket
- [ ] Vérifier que le gagnant est propagé (regarder next round)
- [ ] Tester avec plusieurs phases (via les tabs)
