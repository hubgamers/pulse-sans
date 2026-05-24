# HubGamers

HubGamers est un SaaS de gestion de competitions sport/esport: organisations, equipes, joueurs, tournois, phases, inscriptions, pistes, matchs, resultats et brackets.

## Documentation

- [Documentation generale](./docs/README.md)
- [Guide developpeur](./docs/developers.md)
- [Guide utilisateur](./docs/users.md)
- [Guide import massif](./BULK_IMPORT_GUIDE.md)
- [Guide placement bracket](./PLACEMENT_BRACKET_EDITOR_GUIDE.md)

## Demarrage rapide

```bash
npm install
npx supabase start
npx prisma migrate dev
npx prisma generate
npm run dev
```

Variables principales a configurer dans `.env` / `.env.local`:

```text
DATABASE_URL=
DIRECT_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

## Commandes utiles

```bash
npm run dev
node node_modules/typescript/bin/tsc --noEmit
npm run lint
npm run update-types
```

## Reperes code

- `app/dashboard`: routes dashboard.
- `components/dashboard`: composants metier.
- `components/ui`: design system commun.
- `lib/actions`: server actions et queries.
- `lib/validations`: validations Zod.
- `prisma/schema.prisma`: modele de donnees.
