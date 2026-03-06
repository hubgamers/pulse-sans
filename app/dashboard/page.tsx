import { ProfileCard } from "@/components/dashboard";
import { BarChart3, Bell, Calendar, Gamepad2, Trophy, Users } from "lucide-react";

export default function DashboardPage() {
  // Mock data (Idem que ton code original)
  const mockProfile = {
    id: 'session.user.id',
    username: 'session.user.user_metadata?.preferred_username || session.user.email?.split()[0]',
    email: 'session.user.email',
    avatar_url: 'session.user.user_metadata?.avatar_url',
    role: 'member' as const,
    xp_balance: 1250,
    bio: 'Passionné par les esports',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const stats = [
    { label: 'XP Total', value: '1,250', icon: BarChart3, color: 'text-blue-400' },
    { label: 'Tournois', value: '12', icon: Trophy, color: 'text-yellow-400' },
    { label: 'Matchs', value: '48', icon: Gamepad2, color: 'text-purple-400' },
    { label: 'Communautés', value: '4', icon: Users, color: 'text-emerald-400' },
  ];
  return (
    <>
      {/* Header mobile/sticky */}

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <div key={i} className="bg-[#15151a] p-5 rounded-2xl border border-white/5 flex items-center gap-4">
            <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-400">{stat.label}</p>
              <p className="text-xl font-bold">{stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-10">

          {/* Events Section */}
          <section>
            <SectionHeader icon={<Calendar className="text-blue-400" />} title="Événements à venir" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              {/* Tes composants existants */}
              {/* mockEvents.map(...) */}
              <div className="h-48 rounded-2xl border border-dashed border-white/10 flex items-center justify-center text-gray-500">
                Insérer EventCard ici
              </div>
            </div>
          </section>

          {/* Tournaments Section */}
          <section>
            <SectionHeader icon={<Trophy className="text-yellow-400" />} title="Mes Compétitions" />
            <div className="grid grid-cols-1 gap-4 mt-4">
              {/* Insérer TournamentCard ici */}
            </div>
          </section>
        </div>

        {/* Right Column - Sidebar style content */}
        <div className="space-y-8">
          <section>
            <SectionHeader icon={<Users className="text-emerald-400" />} title="Mon Profil" />
            <div className="mt-4">
              <ProfileCard profile={mockProfile} />
            </div>
          </section>

          <section>
            <SectionHeader icon={<Users className="text-[#5865F2]" />} title="Communautés" />
            <div className="mt-4 space-y-3">
              {/* Version compacte de CommunityCard si possible */}
            </div>
          </section>
        </div>
      </div>
    </>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode, title: string }) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>
      <button className="text-xs text-[#5865F2] hover:underline font-medium">Voir tout</button>
    </div>
  );
}