-- --- 1. ACTIVATION DU RLS SUR TOUTES LES TABLES ---
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;

-- --- 2. POLITIQUES DE SÉCURITÉ (EXEMPLES STANDARDS) ---

-- PROFILES : Tout le monde voit, seul l'utilisateur modifie son propre profil
CREATE POLICY "Profils visibles par tous" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Utilisateurs modifient leur propre profil" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- EVENTS : Tout le monde voit, seuls les admins (à définir) modifient
CREATE POLICY "Événements visibles par tous" ON public.events FOR SELECT USING (true);

-- REGISTRATIONS : L'utilisateur voit ses propres inscriptions
CREATE POLICY "Utilisateurs voient leurs inscriptions" ON public.registrations FOR SELECT USING (auth.uid() = profile_id);
CREATE POLICY "Utilisateurs s'inscrivent eux-mêmes" ON public.registrations FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- SUBMISSIONS : Tout le monde voit, seul l'auteur modifie/supprime
CREATE POLICY "Submissions visibles par tous" ON public.submissions FOR SELECT USING (true);
CREATE POLICY "Auteurs créent leurs submissions" ON public.submissions FOR INSERT WITH CHECK (auth.uid() = profile_id);

-- VOTES : (On reprend ce qu'on a fait avant)
CREATE POLICY "Votes visibles par tous" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Utilisateurs votent une fois" ON public.votes FOR INSERT WITH CHECK (auth.uid() = profile_id);