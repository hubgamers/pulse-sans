import Link from 'next/link'
import type { TabId, TournamentData } from './TournamentTabShell.types'
import { Badge, buttonClassName, TabLink, Tabs } from '@/components/ui'

type TournamentTabShellHeaderProps = {
    orgSlug: string
    tournament: TournamentData
    tabs: Array<{ id: TabId; label: string; badge?: number }>
    activeTab: TabId
    setActiveTab: (tab: TabId) => void
    makeTabHref: (tab: TabId) => string
    statusMeta: { label: string; cls: string }
}

export default function TournamentTabShellHeader({
    orgSlug,
    tournament,
    tabs,
    activeTab,
    setActiveTab,
    makeTabHref,
    statusMeta,
}: TournamentTabShellHeaderProps) {
    return (
        <>
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{tournament.game.name}</p>
                    <h1 className="text-2xl font-black md:text-3xl">{tournament.name}</h1>
                    {tournament.description && <p className="mt-1 max-w-xl text-sm text-slate-500">{tournament.description}</p>}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Badge className={statusMeta.cls}>{statusMeta.label}</Badge>
                        <span>/{tournament.slug}</span>
                        <span>-</span>
                        <span>{tournament._count.registrations}{tournament.maxTeams ? `/${tournament.maxTeams}` : ''} equipes</span>
                        <span>-</span>
                        <span>{tournament.isPublic ? 'Public' : 'Prive'}</span>
                    </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                    {tournament.isPublic && (
                        <Link
                            href={`/public/${orgSlug}/${tournament.slug}`}
                            target="_blank"
                            className={buttonClassName({ variant: 'secondary', size: 'sm', className: 'border-teal-300 text-teal-700 hover:bg-teal-50' })}
                        >
                            Overlays
                        </Link>
                    )}
                    <Link href={`/dashboard/org/${orgSlug}/tournaments`} className={buttonClassName({ variant: 'secondary' })}>
                        Retour
                    </Link>
                </div>
            </div>

            <Tabs className="overflow-x-auto rounded-none border-x-0 border-t-0 bg-transparent p-0">
                {tabs.map((tab) => (
                    <TabLink
                        key={tab.id}
                        href={makeTabHref(tab.id)}
                        active={activeTab === tab.id}
                        onClick={(event) => {
                            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                            event.preventDefault()
                            setActiveTab(tab.id)
                        }}
                        className="shrink-0 rounded-none border-b-2 border-transparent bg-transparent px-4 py-3 shadow-none data-[active=true]:border-teal-600"
                        data-active={activeTab === tab.id}
                    >
                        {tab.label}
                        {tab.badge !== undefined && (
                            <Badge variant={activeTab === tab.id ? 'info' : 'default'} className="ml-1.5 px-1.5 py-0.5">
                                {tab.badge}
                            </Badge>
                        )}
                    </TabLink>
                ))}
            </Tabs>
        </>
    )
}
