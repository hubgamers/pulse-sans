import { notFound } from 'next/navigation'
import {
    computeGroupOverviews,
    type StandingRow,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'
import {
    buildOverlayBackgroundStyle,
    readOverlayBackgroundConfig,
    type OverlayBackgroundSearchParams,
} from '../_lib/background'

type OverlaySearchParams = OverlayBackgroundSearchParams & {
    phaseId?: string | string[]
    mode?: string | string[]
}

type GroupWithStandings = {
    groupIndex: number
    standings: StandingRow[]
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0]
    return value
}

function buildSelfHref(
    orgSlug: string,
    tournamentSlug: string,
    options: {
        phaseId: string
        mode: 'groups' | 'global'
        bg?: string
        bgDim?: string
    }
) {
    const params = new URLSearchParams()
    params.set('phaseId', options.phaseId)
    params.set('mode', options.mode)
    if (options.bg) params.set('bg', options.bg)
    if (options.bgDim) params.set('bgDim', options.bgDim)
    return `/public/${orgSlug}/${tournamentSlug}/overlay/standings?${params.toString()}`
}

function computeGlobalStandings(groups: GroupWithStandings[]) {
    const rows = groups.flatMap((group) =>
        group.standings.map((row) => ({
            ...row,
            groupIndex: group.groupIndex,
        }))
    )

    return rows.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
        if (a.groupIndex !== b.groupIndex) return a.groupIndex - b.groupIndex
        return a.teamName.localeCompare(b.teamName, 'fr', { sensitivity: 'base' })
    })
}

function initialsFromTeamName(name: string) {
    return name
        .trim()
        .split(/[^A-Za-zÀ-ÖØ-öø-ÿ]+/)
        .filter(Boolean)
        .map((word) => word[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
}

export const dynamic = 'force-dynamic'

export default async function TournamentStandingsOverlayPage({
    params,
    searchParams,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string }>
    searchParams: Promise<OverlaySearchParams>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug } = await params
    const query = await searchParams

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload
    const groupOverviews = computeGroupOverviews(tournament.registrations, tournament.phases, matches)
    const background = readOverlayBackgroundConfig(query, tournament.bannerUrl)
    const backgroundStyle = buildOverlayBackgroundStyle(background.backgroundUrl, background.dim)

    if (groupOverviews.length === 0) {
        return (
            <main className="min-h-screen bg-transparent text-slate-900" style={backgroundStyle}>
                <div className="mx-auto flex min-h-screen w-full max-w-400 flex-col gap-4 px-4 py-4">
                    <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
                        <p className="text-xs uppercase tracking-[0.24em] text-teal-700">Overlay classements en direct</p>
                        <div className="mt-2">
                            <h1 className="text-2xl font-black md:text-4xl">{tournament.name}</h1>
                            <p className="mt-1 text-xs text-slate-500 md:text-sm">
                                {tournament.organization.name} · {tournament.game.name}
                            </p>
                        </div>
                    </section>

                    <section className="rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-sm backdrop-blur">
                        <p className="text-lg font-semibold text-slate-700">Aucune phase de poules configuree.</p>
                        <p className="mt-2 text-sm text-slate-500">
                            Cet overlay s&apos;active des qu&apos;une phase de type poule contient des equipes ou des matchs.
                        </p>
                    </section>
                </div>
            </main>
        )
    }

    const requestedPhaseId = firstParam(query.phaseId)
    const selectedOverview = groupOverviews.find((overview) => overview.phaseId === requestedPhaseId) ?? groupOverviews[0]
    const requestedMode = firstParam(query.mode)
    const mode: 'groups' | 'global' = requestedMode === 'global' ? 'global' : 'groups'
    const globalStandings = computeGlobalStandings(selectedOverview.groups)

    const bg = firstParam(query.bg)
    const bgDim = firstParam(query.bgDim)

    return (
        <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white" style={backgroundStyle}>
            <div className="mx-auto min-h-screen w-full max-w-7xl space-y-6 px-4 py-6">
                <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-[0.24em] text-[#ccff00]">Overlay classements en direct</p>
                            <div className="mt-2">
                                <h1 className="text-3xl font-black md:text-5xl text-white">{tournament.name}</h1>
                                <p className="mt-1 text-sm text-slate-300 md:text-base">
                                    {selectedOverview.phaseName} · {tournament.organization.name}
                                </p>
                            </div>
                        </div>
                        <div className="rounded-3xl border border-white/10 bg-white/5 px-5 py-4 text-right">
                            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Mode</p>
                            <p className="mt-1 text-2xl font-black text-[#ccff00]">
                                {mode === 'groups' ? 'Par poule' : 'Classement global'}
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                        {groupOverviews.map((overview) => (
                            <a
                                key={`phase-link-${overview.phaseId}`}
                                href={buildSelfHref(orgSlug, tournamentSlug, {
                                    phaseId: overview.phaseId,
                                    mode,
                                    bg,
                                    bgDim,
                                })}
                                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${overview.phaseId === selectedOverview.phaseId
                                    ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]'
                                    : 'border-white/10 bg-white/5 text-slate-200 hover:border-[#ccff00]/40 hover:bg-[#ccff00]/10 hover:text-[#ccff00]'
                                    }`}
                            >
                                {overview.phaseName}
                            </a>
                        ))}
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <a
                            href={buildSelfHref(orgSlug, tournamentSlug, {
                                phaseId: selectedOverview.phaseId,
                                mode: 'groups',
                                bg,
                                bgDim,
                            })}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${mode === 'groups'
                                ? 'border-amber-300 bg-amber-300/10 text-amber-300'
                                : 'border-white/10 bg-white/5 text-slate-200 hover:border-amber-300 hover:bg-amber-300/10 hover:text-amber-300'
                                }`}
                        >
                            Classement par poule
                        </a>
                        <a
                            href={buildSelfHref(orgSlug, tournamentSlug, {
                                phaseId: selectedOverview.phaseId,
                                mode: 'global',
                                bg,
                                bgDim,
                            })}
                            className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${mode === 'global'
                                ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]'
                                : 'border-white/10 bg-white/5 text-slate-200 hover:border-[#ccff00]/40 hover:bg-[#ccff00]/10 hover:text-[#ccff00]'
                                }`}
                        >
                            Classement global phase
                        </a>
                    </div>
                </section>

                {mode === 'groups' ? (
                    <section className="grid gap-4 xl:grid-cols-2">
                        {selectedOverview.groups.map((group) => (
                            <article key={`group-${selectedOverview.phaseId}-${group.groupIndex}`} className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl">
                                <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-amber-300">Poule {group.groupIndex}</p>

                                {group.standings.length === 0 ? (
                                    <p className="text-sm text-slate-300">Aucune équipe.</p>
                                ) : (
                                    <div className="space-y-2">
                                        {group.standings.map((row, rank) => (
                                            <div key={row.teamId} className="grid grid-cols-[32px_1fr_70px_50px] items-center gap-3 rounded-3xl border border-white/10 bg-slate-950/70 px-3 py-2">
                                                <span className="text-sm font-black text-[#ccff00]">{rank + 1}</span>
                                                <div className="flex items-center gap-3 min-w-0">
                                                    {row.teamLogoUrl ? (
                                                        <img src={row.teamLogoUrl} alt={row.teamName} className="h-9 w-9 rounded-full object-cover" />
                                                    ) : (
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-black uppercase text-slate-300">
                                                            {initialsFromTeamName(row.teamName)}
                                                        </div>
                                                    )}
                                                    <span className="truncate text-sm font-semibold text-white">{row.teamName}</span>
                                                </div>
                                                <span className="text-right text-sm font-bold text-slate-200">{row.points}</span>
                                                <span className={`text-right text-sm font-bold ${row.goalDiff > 0 ? 'text-emerald-300' : row.goalDiff < 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                                                    {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </article>
                        ))}
                    </section>
                ) : (
                    <section className="rounded-3xl border border-white/10 bg-white/5 p-4 shadow-2xl backdrop-blur-xl">
                        {globalStandings.length === 0 ? (
                            <p className="text-sm text-slate-300">Aucune équipe classée pour cette phase.</p>
                        ) : (
                            <div className="space-y-3">
                                {globalStandings.map((row, idx) => (
                                    <div key={`global-${row.teamId}`} className={`grid grid-cols-[40px_minmax(0,1fr)_60px_40px] items-center gap-3 rounded-3xl border border-white/10 px-4 py-3 ${idx < 3 ? 'bg-amber-300/10' : 'bg-slate-950/70'}`}>
                                        <span className="text-base font-black text-[#ccff00]">{idx + 1}</span>
                                        <div className="flex items-center gap-3 min-w-0">
                                            {row.teamLogoUrl ? (
                                                <img src={row.teamLogoUrl} alt={row.teamName} className="h-10 w-10 rounded-full object-cover" />
                                            ) : (
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xs font-black uppercase text-slate-300">
                                                    {initialsFromTeamName(row.teamName)}
                                                </div>
                                            )}
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-white">{row.teamName}</p>
                                                <p className="text-[11px] text-slate-400">Poule {row.groupIndex}</p>
                                            </div>
                                        </div>
                                        <span className="text-right text-sm font-black text-[#ccff00]">{row.points}</span>
                                        <span className={`text-right text-sm font-semibold ${row.goalDiff > 0 ? 'text-emerald-300' : row.goalDiff < 0 ? 'text-rose-300' : 'text-slate-300'}`}>
                                            {row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}
            </div>
        </main>
    )
}
