'use client' — Composants dashboard / tournois

Ce dossier regroupe les composants UI utilisés dans la gestion d’un tournoi (dashboard) : création, configuration des phases, génération des matchs, édition en masse, seeds, brackets (dont placement bracket), et outils d’assignation (poules, rotations / tranches horaires).

### Vue d’ensemble (qui appelle quoi)

- **`TournamentTabShell.tsx`** est le “chef d’orchestre” : il compose les onglets et appelle les autres composants en leur passant les données (tournoi, phases, inscriptions, matchs, pitches…).
- Les composants “éditeurs” appellent des **server actions** (dans `@/lib/actions/tournament-management.actions`) via `useActionState` ou `startTransition`.
- Les composants “vues” (`BracketPhaseView`, `PlacementBracketPhaseView`) affichent des brackets et renvoient vers des pages match (`/dashboard/.../matches/[id]`) pour édition/consultation.

---

### `TournamentTabShell.tsx`

**Rôle**
- Shell des onglets de gestion d’un tournoi (overview, phases, registrations, pools, bracket, planning, matches…).
- Centralise la plupart des actions “admin” (création/suppression en masse, génération de matchs, configuration de phase, timers, duplication, reset…).

**Composants intégrés**
- `GroupPlacementBoard`, `MatchBulkEditor`, `MatchBulkCreateForm`, `BracketPhaseView`, `BracketSeedEditor`, `PhaseFlowEditor`.

**Server actions utilisées (extraits)**
- Gestion inscriptions : `addTournamentRegistration`, `removeTournamentRegistration`, `updateTournamentRegistrationConfirmation`
- Phases / flow : `configureGroupPhase`, `closeTournamentPhase`, `resetTournamentForReconfiguration`, `retryTournamentPropagation`
- Génération / matches : `generatePhaseRoundRobinMatches`, `generateGroupMatchesFromPlacements`, `generateLinkedBracketMatches`, `generateCustomPlacementBracketMatches`
- CRUD pitches/matches : `createTournamentPitch`, `bulkCreateTournamentPitches`, `bulkDeleteTournamentPitches`, `createTournamentMatch`, `deleteTournamentMatch`, `deleteAllTournamentMatches`, `deleteSelectedTournamentMatches`
- Timers / planning : `startTournamentBreakTimer`, `startTournamentMatchesByScheduleSlot`
- Visuel overlay : `updateTournamentOverlayBackground`
- Duplication : `duplicateTournamentForOrganization`

**Helpers internes notables**
- `va(action)`: wrapper typage des server actions (forme `void | Promise<void>`).
- Lecteurs de config : `readRoutes`, `readParallelGroup`, `readGroupConfig`, `readPlacementLabels`… (parsing de `phase.config`).

---

### `TournamentCreateForm.tsx`

**Rôle**
- Wizard de création de tournoi en 4 étapes (identité → réglages → phases → validation).
- Prépare une structure de phases avec routes de qualification (ex: poules → bracket).

**Points clés**
- Slug auto-généré + vérification asynchrone via `slugTournamentExists`.
- Construction du JSON `phasesJson` (keys, types `PhaseType`, order, `parallelGroup`, routes `TOP/BOTTOM/RANGE`).

**Server actions**
- `createTournament`, `slugTournamentExists`.

---

### `PhaseFlowEditor.tsx`

**Rôle**
- Éditeur de la structure des phases (après création du tournoi) : ajout/suppression/re-ordre + règles sortantes (routes).

**Données**
- Entrée: `phases` (id, name, type, order, config).
- État UI: `flow: PhaseUI[]` puis sérialisation `phasesJson`.

**Helpers internes**
- `readRoutes(config)`, `readKey(config, name, fallbackOrder)`, `readParallelGroup(config)`, `slugify`, `toPhaseType`.

**Server action**
- `updateTournamentPhaseFlow`.

---

### `MatchBulkEditor.tsx`

**Rôle**
- Édition rapide “en masse” des matchs (statut, scores, notes) avec sauvegarde en une seule action.

**Fonctionnement**
- Maintient un état `rows[]` (status/homeScore/awayScore/notes).
- Calcule `updates` en diffant vs un `initialMap`.
- Filtres/tri côté UI : `phaseFilter`, `statusFilter`, `sortBy` (dont tri par priorité de statut).

**Server action**
- `bulkUpdateTournamentMatches`.

---

### `MatchBulkCreateForm.tsx`

**Rôle**
- Création de matchs en masse à partir de 3 colonnes texte (horaires / pistes / matchups).

**Helpers internes**
- `parseTime` (formats `14h`, `14h10`, `14:30`…)
- `buildScheduledAt(timeStr, referenceDate)` → ISO string
- `resolveTeamName` (validation “contains” / égalité)
- `resolvePitchName` (validation piste; log console de debug)

**Server action**
- `bulkCreateTournamentMatches`.

---

### `GroupPlacementBoard.tsx`

**Rôle**
- Tableau de placement visuel des équipes dans des poules (drag & drop) avec sauvegarde.

**Fonctionnement**
- Synchronise un mapping `assignments` (slotKey `"group-slot"` → teamId) depuis `placements`.
- Calcule `placementsJson` à partir de `assignments`.
- Liste “Équipes non placées” = `teamOptions` moins `assignedTeamIds`.

**Server action**
- `bulkSetGroupPlacements`.

---

### `BracketSeedEditor.tsx`

**Rôle**
- Assignation/édition des seeds d’un bracket (Round 1) : choisir équipe domicile/extérieur par match.

**Fonctionnement**
- État `seedRows[]` + diff `updates` vs `initialMap`.
- Sérialisation `seedsJson` envoyée au serveur.

**Server action**
- `bulkAssignBracketSeeds`.

---

### `BracketPhaseView.tsx`

**Rôle**
- Vue “bracket” générique pour une phase (WB/LB/placement/other) avec colonnes par round.
- Redirige vers la page match via `next/link`.

**Fonctionnement**
- `parseLane(match)`: classe un match par voie (`WB`, `LB`, `PLACEMENT`, `OTHER`).
- `buildLanes(matches)`: regroupe et trie par round, puis rend une colonne par round.
- **Cas spécial**: si `phase.type === 'PLACEMENT_BRACKET'`, délègue à `PlacementBracketPhaseView`.

---

### `PlacementBracketPhaseView.tsx`

**Rôle**
- Vue dédiée “placement bracket” (admin + rendu type overlay) avec :
  - Winner bracket + arbres de placement (places X à Y)
  - Edition résultat par match via modal
  - Mode “plein écran” (overlay scrollable + zoom)
  - Option “rotations / tranches horaires” (mode entrelacer) directement sur les cartes match
  - Classement déduit des résultats (segments configurables)

**Helpers internes clés**
- Parsing des positions: `parseWinnerMatch`, `parsePlacementMatch`
- Construction des rounds: `buildWinnerData`, `buildPlacementTrees`, `countTreeMatches`
- Rotations (interleaved): `readRotationMode`, `readInterleavedTimeSlots`, `normalizeInterleavedTimeSlots`, `serializeInterleavedTimeSlots`,
  `buildDefaultInterleavedTimeSlots`, `buildRotationLookup`, `buildRotationLabelLookup`
- Classement: `buildPlacementRanking`, `readPlacementRankingSegments`, `readPlacementLabels`

**Server action**
- `configureInterleavedTimeSlots` (sauvegarde des rotations / timeSlots).

**Composants utilisés**
- `MatchResultModal` pour enregistrer un score directement depuis le bracket.

---

### `MatchResultModal.tsx`

**Rôle**
- Modal de saisie d’un résultat (scores + notes) pour un match.

**Server action**
- `recordTournamentMatchResult`.

---

### `InterleavedTimeSlotManager.tsx`

**Rôle**
- Éditeur générique de configuration “entrelacer” : définir des tranches horaires et sélectionner des matchs par phase.

**API**
- `onSave(config)` est injecté par le parent (persistance côté serveur).
- Lit/écrit `config.interleavedTimeSlots`.

**Helpers internes**
- `readInterleavedConfig`, `groupMatchesByPhase`, `formatTime`, `getMatchLabel`.

---

### `PlacementBracketEditor.tsx`

**Rôle**
- Page/board “Tableau Officiel” (plein écran) pour afficher un bracket de placement (winner + placements), avec rafraîchissement périodique.

**Entrée (props)**
- `phases`, `matches`, `initialPhaseId` + timer (`timerSeconds`, `timerStartMs`, `timerMode`) + background (`backgroundImageUrl`, `backgroundDim`).

**Helpers internes**
- `parseWinnerMatch`, `parsePlacementMatch`, `buildWinnerData`, `buildPlacementTrees`, `formatRemainingTime`…

---

## Conventions implicites (importantes)

- **Clés `bracketPos`**:
  - Winner bracket: `WB-R{round}-M{matchNo}` (ex: `WB-R2-M1`)
  - Loser bracket: `LB-R{round}-M{matchNo}` (utilisé dans `BracketPhaseView`)
  - Placement bracket (arbre): `P{start}-{end}-R{round}-M{matchNo}` (ex: `P3-4-R1-M1`)
- **Pattern “diff + JSON caché”**:
  - Plusieurs éditeurs calculent une liste `updates`, puis envoient un `...Json` via `<input type="hidden" />` dans un `<form action={serverAction} />`.

