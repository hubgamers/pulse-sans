# Guide developpeur

HubGamers est une application Next.js pour organiser des competitions sport/esport: organisations, equipes, joueurs, tournois, phases, inscriptions, terrains/pistes, matchs, resultats et brackets.

## Stack

- Next.js App Router, React, TypeScript.
- Prisma avec PostgreSQL/Supabase.
- Server Actions pour les mutations.
- Tailwind CSS.
- Composants UI communs dans `components/ui`.
- Zod pour les validations.

## Demarrage local

1. Installer les dependances:

```bash
npm install
```

2. Configurer `.env` et `.env.local`.

Variables attendues selon l'environnement:

```text
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Ne jamais documenter ni commiter de secrets reels.

3. Lancer Supabase local si besoin:

```bash
npx supabase start
```

4. Appliquer les migrations et regenerer Prisma:

```bash
npx prisma migrate dev
npx prisma generate
```

5. Lancer l'application:

```bash
npm run dev
```

6. Verifications avant livraison:

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run lint
```

## Structure principale

```text
app/
  dashboard/                 Pages dashboard authentifiees
  dashboard/org/[slug]/       Espace organisation
  dashboard/org/[slug]/teams  Gestion equipes
  dashboard/org/[slug]/tournaments
                              Gestion tournois
components/
  dashboard/                  UI metier dashboard
  dashboard/tournaments/      UI metier tournoi
  ui/                         Design system commun
lib/
  actions/                    Server actions et queries
  supabase/                   Clients Supabase
  tournament/                 Helpers phase flow et templates
  validations/                Schemas Zod
prisma/
  schema.prisma               Modele de donnees
  migrations/                 Migrations SQL
```

## Donnees et modele metier

Les entites centrales sont:

- `User`: utilisateur authentifie.
- `Organization`: club, association, structure esport ou mixte.
- `OrganizationMember`: appartenance et role dans une organisation.
- `OrganizationInvitation`: invitation email avec token et statut.
- `Team`: equipe rattachee a une organisation.
- `Player`: joueur rattache a une equipe.
- `Tournament`: tournoi rattache a une organisation et a un jeu.
- `Phase`: etape du tournoi, par exemple poules, bracket simple, double bracket, placement bracket.
- `TournamentRegistration`: inscription d'une equipe a un tournoi.
- `Pitch`: terrain, piste, poste ou ressource de match.
- `Match`: rencontre planifiee.
- `MatchResult`: score et gagnant.
- `TournamentActionLog`: journal d'actions sur un tournoi.

Conventions Prisma importantes:

- Les tables utilisent souvent `@@map` pour conserver des noms SQL en snake_case.
- Les relations destructives utilisent `onDelete: Cascade` quand la suppression parent doit nettoyer les enfants.
- Les routes dashboard manipulent surtout des `slug`, mais les actions sensibles valident avec les ids.

## Server Actions

Les mutations vivent principalement dans `lib/actions`.

Fichiers importants:

- `lib/actions/utils.actions.ts`: recuperation de l'utilisateur courant.
- `lib/actions/dashboard.actions.ts`: recherche globale dashboard et notifications.
- `lib/actions/organization/organization.actions.ts`: creation organisation, membres, invitations.
- `lib/actions/team/team.actions.ts`: creation, edition, import massif d'equipes.
- `lib/actions/tournament/tournament.actions.ts`: creation et CRUD simple tournoi.
- `lib/actions/tournament-management.actions.ts`: orchestration avancee d'un tournoi.

Conventions:

- Toujours verifier l'utilisateur courant dans une action qui modifie des donnees.
- Valider les permissions organisation/tournoi avant mutation.
- Revalider les chemins impactes avec `revalidatePath`.
- Garder les actions serveur sans dependance UI.
- Retourner des objets simples `{ success, message }` quand l'action est appelee depuis `useActionState`.

## Gestion des tournois

Le coeur UI des tournois se trouve dans `components/dashboard/tournaments`.

Pieces principales:

- `TournamentTabShell.tsx`: compose les onglets et distribue les donnees.
- `TournamentTabShellHeader.tsx`: entete et navigation du tournoi.
- `TournamentTabShellAdminPanel.tsx`: panneau d'actions rapides admin.
- `TournamentOverviewTab.tsx`: resume, overlay, sponsors.
- `TournamentPhasesTab.tsx`: phases, flow, reset, duplication, propagation.
- `TournamentRegistrationsTab.tsx`: equipes inscrites et pistes.
- `TournamentPlanningTimeTab.tsx`: planning, timers, lancement par tranche horaire.
- `TournamentMatchesTab.tsx`: generation, creation, verification et edition des matchs.
- `MatchBulkCreateForm.tsx`: creation de matchs depuis trois colonnes texte.
- `MatchBulkEditor.tsx`: edition rapide des statuts/scores/notes.

Conventions de phase:

- `GROUP`: poules.
- `BRACKET_SINGLE`: bracket a elimination simple.
- `BRACKET_DOUBLE`: double bracket.
- `PLACEMENT_BRACKET`: classement par places.
- `ROUND_SWISS`: reserve pour ronde suisse.
- `CUSTOM`: cas manuel.

Conventions `bracketPos`:

- Winner bracket: `WB-R{round}-M{matchNo}`.
- Loser bracket: `LB-R{round}-M{matchNo}`.
- Placement bracket: `P{start}-{end}-R{round}-M{matchNo}`.

## Design system

Les composants communs sont dans `components/ui`.

Composants disponibles:

- `Button`, `buttonClassName`
- `Card`, `CardHeader`, `CardTitle`, `CardDescription`
- `Field`, `Label`, `Input`, `Select`, `Textarea`, `FieldError`
- `Badge`
- `EmptyState`
- `Tabs`, `TabButton`, `TabLink`
- `Modal`
- `StatusAlert`

Regles:

- Preferer ces composants aux classes Tailwind locales pour les controles courants.
- Garder les composants metier dans `components/dashboard`.
- Utiliser `cx` depuis `lib/ui.ts` pour composer les classes.
- Les boutons d'action passent par `Button`; les liens styles bouton utilisent `buttonClassName`.
- Les messages d'erreur/succes passent par `StatusAlert`.
- Les vues vides passent par `EmptyState`.

## Patterns React

- Les pages App Router chargent les donnees cote serveur quand c'est possible.
- Les composants interactifs commencent par `'use client'`.
- Les formulaires simples utilisent `<form action={serverAction}>`.
- Les formulaires avec etat utilisent `useActionState`.
- Les operations client plus libres utilisent `useTransition`.
- Les editeurs bulk utilisent souvent un pattern `diff + JSON hidden input`.

## Recherche et notifications

Le dashboard shell consomme:

- `globalDashboardSearch(query)` pour chercher organisations, equipes, tournois et invitations accessibles.
- `getDashboardNotifications()` pour remonter invitations et alertes operationnelles.

Ces actions doivent rester filtrees par utilisateur et par organisations accessibles.

## Tests et verification

Base minimale avant de pousser:

```bash
node node_modules/typescript/bin/tsc --noEmit
npm run lint
```

Pour une modification ciblee, lancer ESLint sur les fichiers touches:

```bash
npx eslint components/dashboard/tournaments/TournamentMatchesTab.tsx
```

Pour une modification Prisma:

```bash
npx prisma validate
npx prisma generate
```

## Checklist de contribution

- Les permissions sont verifiees cote serveur.
- Les donnees utilisateur sont validees avec Zod ou controles equivalents.
- Les chemins impactes sont revalides.
- Les composants UI communs sont utilises pour les controles standard.
- Les textes visibles sont coherents en francais et sans artefacts d'encodage.
- TypeScript et ESLint passent.
- La documentation user/dev est mise a jour si le comportement change.
