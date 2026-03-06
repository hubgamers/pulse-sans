## Configuration

### Créer un .env

```text
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

### Lancer Supabase

```bash
npx supabase start
```

Lancer les migrations suite à une modifications dans les types pour regénérer proprement le schéma et la DB en parralèle :
```bash
npm run update-types
```