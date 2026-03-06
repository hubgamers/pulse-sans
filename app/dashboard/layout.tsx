'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react'; // Retrait de useState et use
import LogoutButton from '@/components/auth/LogoutButton';
import {
    Calendar,
    Trophy,
    Users,
    LayoutDashboard,
    Settings,
    Bell
} from 'lucide-react';
import { useProfile } from '@/lib/auth'; // Vérifie que ton hook est bien exporté d'ici

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const { session, loading } = useAuth();
    const router = useRouter();

    // 1. Redirection si non connecté
    useEffect(() => {
        if (!loading && !session) {
            router.push('/');
        }
    }, [session, loading, router]);

    // 2. Appel du hook de profil (toujours au top-level)
    // On passe l'id s'il existe, sinon une string vide. 
    // Le hook gérera le fetch quand l'id deviendra disponible.
    const { profile, loading: profileLoading } = useProfile(session?.user?.id ?? "");

    // 3. État de chargement (Auth OU Profil)
    if (loading || (session && profileLoading)) {
        return (
            <div className="min-h-screen bg-[#0a0a0c] flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-[#5865F2] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-400 animate-pulse">Chargement de votre univers...</p>
                </div>
            </div>
        );
    }

    // Sécurité supplémentaire
    if (!session) return null;

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-gray-100 flex">
            {/* --- SIDEBAR --- */}
            <aside className="hidden lg:flex flex-col w-64 bg-[#0f0f12] border-r border-white/5 p-6 sticky top-0 h-screen">
                <div className="flex items-center gap-3 mb-10 px-2">
                    <div className="bg-[#5865F2] p-2 rounded-lg">
                        <Trophy size={24} className="text-white" />
                    </div>
                    <span className="text-xl font-bold tracking-tight">ARENA<span className="text-[#5865F2]">HUB</span></span>
                </div>

                <nav className="flex-1 space-y-2">
                    <SidebarItem icon={<LayoutDashboard size={20} />} label="Tableau de bord" active />
                    <SidebarItem icon={<Calendar size={20} />} label="Événements" />
                    <SidebarItem icon={<Trophy size={20} />} label="Compétitions" />
                    <SidebarItem icon={<Users size={20} />} label="Communautés" />
                    <div className="pt-4 mt-4 border-t border-white/5">
                        <SidebarItem icon={<Settings size={20} />} label="Paramètres" />
                    </div>
                </nav>

                <div className="mt-auto">
                    <LogoutButton />
                </div>
            </aside>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
                <header className="h-16 border-b border-white/5 bg-[#0a0a0c]/80 backdrop-blur-md sticky top-0 z-10 px-4 lg:px-8 flex items-center justify-between">
                    <h2 className="text-lg font-semibold">
                        Bienvenue, {profile?.username || 'Gamer'} 👋
                    </h2>
                    <div className="flex items-center gap-4">
                        <button className="p-2 hover:bg-white/5 rounded-full relative">
                            <Bell size={20} />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#0a0a0c]"></span>
                        </button>
                        {/* Utilisation de l'avatar du profil si dispo */}
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Avatar" className="w-8 h-8 rounded-full border border-white/10 object-cover" />
                        ) : (
                            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#5865F2] to-purple-500 border border-white/10" />
                        )}
                    </div>
                </header>

                <div className="p-4 lg:p-8 max-w-7xl mx-auto w-full">
                    {children}
                </div>
            </main>
        </div>
    );
}

function SidebarItem({ icon, label, active = false }: { icon: React.ReactNode, label: string, active?: boolean }) {
    return (
        <button className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-[#5865F2] text-white shadow-lg shadow-[#5865F2]/20' : 'text-gray-400 hover:bg-white/5 hover:text-white'
            }`}>
            {icon}
            <span className="font-medium">{label}</span>
        </button>
    );
}