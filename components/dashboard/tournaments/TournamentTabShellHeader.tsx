import Link from 'next/link'
import type { TabId, TournamentData } from './TournamentTabShell.types'

type TournamentTabShellHeaderProps = {
    orgSlug: string
    tournament: TournamentData
    tabs: Array<{ id: TabId; label: string; badge?: number }>
    activeTab: TabId
    setActiveTab: (tab: TabId) => void
    makeTabHref: (tab: TabId) => string
    statusMeta: { label: string; cls: string }
}

export default function TournamentTabShellHeader({ orgSlug, tournament, tabs, activeTab, setActiveTab, makeTabHref, statusMeta }: TournamentTabShellHeaderProps) {
    return (
        <>
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{tournament.game.name}</p>
                    <h1 className="text-2xl font-black md:text-3xl">{tournament.name}</h1>
                    {tournament.description && (
                        <p className="mt-1 max-w-xl text-sm text-slate-500">{tournament.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
                            {statusMeta.label}
                        </span>
                        <span>/{tournament.slug}</span>
                        <span>•</span>
                        <span>{tournament._count.registrations}{tournament.maxTeams ? `/${tournament.maxTeams}` : ''} équipes</span>
                        <span>•</span>
                        <span>{tournament.isPublic ? 'Public' : 'Prive'}</span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {tournament.isPublic && (
                        <Link
                            href={`/public/${orgSlug}/${tournament.slug}`}
                            target="_blank"
                            className="rounded-xl border border-teal-300 px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50 transition"
                        >
                            Lien public
                        </Link>
                    )}
                    <Link
                        href={`/dashboard/org/${orgSlug}/tournaments`}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-white transition"
                    >
                        ← Retour
                    </Link>
                </div>
            </div>

            <div className="flex border-b border-teal-200">
                {tabs.map((tab) => (
                    <Link
                        key={tab.id}
                        href={makeTabHref(tab.id)}
                        scroll={false}
                        onClick={(event) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                            event.preventDefault()
                            setActiveTab(tab.id)
                        }}
                        className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'border-teal-600 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        {tab.label}
                        {tab.badge !== undefined && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${activeTab === tab.id ? 'bg-teal-700 text-white' : 'bg-slate-800 text-white'
                                }`}>
                                {tab.badge}
                            </span>
                        )}
                    </Link>
                ))}
            </div>
        </>
    )
}
