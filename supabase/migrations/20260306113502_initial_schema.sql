-- --- 1. EXTENSIONS & TYPES ---
-- Active l'UUID si nécessaire
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Énumérations
CREATE TYPE public.user_role AS ENUM ('admin', 'lead', 'ambassador', 'member');
CREATE TYPE public.event_type AS ENUM ('esport', 'festival', 'meetup', 'workshop');

-- --- 2. PÔLE IDENTITÉ ---
CREATE TABLE public.profiles (
    id uuid REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    username text UNIQUE NOT NULL,
    avatar_url text,
    role public.user_role DEFAULT 'member'::public.user_role,
    total_xp bigint DEFAULT 0,
    qr_token uuid DEFAULT gen_random_uuid(),
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.xp_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount int NOT NULL,
    source text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- --- 3. PÔLE ÉVÉNEMENTS ---
CREATE TABLE public.events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    type public.event_type NOT NULL,
    location text,
    start_date timestamptz,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.registrations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    checked_in boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- --- 4. PÔLE COMPÉTITION ---
CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    captain_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.tournaments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
    game_key text NOT NULL,
    format_type text NOT NULL,
    format_settings jsonb DEFAULT '{}'::jsonb,
    max_teams int DEFAULT 16,
    status text DEFAULT 'setup',
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
    team_a_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    team_b_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    winner_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
    identifier text,
    next_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
    loser_next_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
    score_a int DEFAULT 0,
    score_b int DEFAULT 0,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamptz DEFAULT now()
);

-- --- 5. PÔLE COMMUNAUTAIRE ---
CREATE TABLE public.contests (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
    title text NOT NULL,
    category text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.submissions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    contest_id uuid REFERENCES public.contests(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    media_url text NOT NULL,
    description text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE public.votes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    submission_id uuid REFERENCES public.submissions(id) ON DELETE CASCADE,
    profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamptz DEFAULT now(),
    UNIQUE(submission_id, profile_id)
);

-- --- 6. SÉCURITÉ (RLS) ---
-- On active la sécurité par défaut
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
-- (Tu pourras ajouter tes politiques de sécurité plus tard)