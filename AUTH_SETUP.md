# Configuration de l'Authentification et du Dashboard

## 📋 Structure créée

### Authentification
- **Page d'authentification** : `/app/auth/page.tsx` - Interface de connexion avec Discord
- **Callback d'authentification** : `/app/auth/callback/route.ts` - Gère le retour de Discord OAuth
- **Provider d'authentification** : `/lib/auth/AuthProvider.tsx` - Context React pour la gestion de session

### Dashboard
- **Page dashboard** : `/app/dashboard/page.tsx` - Dashboard principal avec toutes les entités
- **Composants dashboard** : `/components/dashboard/` - Cartes pour chaque entité

### Composants d'authentification
- **LoginButton** : `/components/auth/LoginButton.tsx` - Bouton de connexion Discord
- **LogoutButton** : `/components/auth/LogoutButton.tsx` - Bouton de déconnexion

### Hooks personnalisés
- **useAuth** : Accès à la session et aux fonctions d'authentification
- **useProfile** : Récupère le profil d'un utilisateur
- **useEvents** : Récupère les événements
- **useTournaments** : Récupère les compétitions
- **useCommunities** : Récupère les communautés

## 🔧 Configuration Supabase

Discord OAuth est déjà configuré dans votre `.env` :
```
DISCORD_CLIENT_ID=1479446617911197716
DISCORD_CLIENT_SECRET=ep3a7YNis9ezoW2I1eovE6-LewoTsr5P
```

### Configuration requise dans Supabase

1. **Vérifier les fournisseurs OAuth** :
   - Allez dans Supabase Console → Authentication → Providers
   - Assurez-vous que Discord est activé

2. **Ajouter l'URL de rappel** :
   - URL de rappel : `http://127.0.0.1:54321/auth/v1/callback` (local)
   - Ou `https://votre-app.com/auth/callback` (production)

3. **Fournisseurs activés** :
   - Email/Mot de passe (optionnel)
   - Discord OAuth (requis)

## 🚀 Utilisation

### Authentification basique

```tsx
'use client';

import { useAuth } from '@/lib/auth';

export function MyComponent() {
  const { session, loading, signInWithDiscord, signOut } = useAuth();

  if (loading) return <div>Chargement...</div>;
  if (!session) return <button onClick={signInWithDiscord}>Se connecter</button>;

  return <button onClick={signOut}>Déconnexion</button>;
}
```

### Utiliser les hooks de données

```tsx
'use client';

import { useProfile, useEvents, useTournaments, useCommunities } from '@/lib/auth';
import { useAuth } from '@/lib/auth';

export function Dashboard() {
  const { session } = useAuth();
  const { profile, loading } = useProfile(session?.user.id || '');
  const { events } = useEvents();
  const { tournaments } = useTournaments();
  const { communities } = useCommunities();

  return (
    // Votre UI ici
  );
}
```

## 📁 Structure des fichiers

```
app/
├── auth/
│   ├── page.tsx           # Page de connexion
│   └── callback/
│       └── route.ts       # Callback OAuth
├── dashboard/
│   └── page.tsx           # Dashboard principal
└── page.tsx               # Redirection vers /auth

components/
├── auth/
│   ├── LoginButton.tsx
│   ├── LogoutButton.tsx
│   └── index.ts
└── dashboard/
    ├── ProfileCard.tsx
    ├── EventCard.tsx
    ├── TournamentCard.tsx
    ├── CommunityCard.tsx
    ├── Skeletons.tsx
    └── index.ts

lib/
└── auth/
    ├── AuthProvider.tsx
    ├── useProfile.ts
    ├── useEvents.ts
    ├── useTournaments.ts
    ├── useCommunities.ts
    └── index.ts
```

## 🎨 Thème

Le design utilise une palette sombre avec les couleurs Discord :
- Fond : `#0a0a0b`
- Cartes : `#1a1a2e`
- Accent principal : `#5865F2` (Discord Blurple)

Tailwind CSS est configuré avec postcss pour supporter les variables CSS.

## 📝 Notes

### Environnement local
- L'application est configurée pour utiliser Supabase local : `http://127.0.0.1:54321`
- Les clés d'authentification sont dans `.env`

### Production
- Basculez les variables dans `.env` vers votre projet Supabase de production
- Les URL de rappel doivent correspondre à votre domaine

### Données mockées
- Le dashboard affiche actuellement des données mockées
- Remplacez les données mockées par les hooks `useEvents`, `useTournaments`, etc.

## 🔒 Sécurité

- Session gérée côté client avec Supabase Auth Helpers
- Les tokens sont stockés de manière sécurisée
- Redirection automatique pour les utilisateurs non authentifiés

## 📚 Prochaines étapes

1. **Créer les tables Supabase** :
   - Assurez-vous que les tables `profiles`, `events`, `tournaments`, `communities` existent

2. **Ajouter des pages détaillées** :
   - Pages d'événements, de compétitions, de profils détaillés

3. **Implémenter la gestion des données réelles** :
   - Remplacer les mocks dans le dashboard par les vrais appels API

4. **Ajouter des fonctionnalités** :
   - Inscription aux événements
   - Création de compétitions
   - Rejoindre des communautés
