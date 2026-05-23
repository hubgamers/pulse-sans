import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
    computeTournamentStandings,
    formatMatchDateLabel,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'
import { StandingsImageExporter } from '@/components/public/StandingsImageExporter'

export const dynamic = 'force-dynamic'

type PublicPageSearchParams = {
    bg?: string | string[]
    bgDim?: string | string[]
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0]
    return value
}

function buildOverlayHref(basePath: string, bg: string | undefined, bgDim: string | undefined) {
    const [pathPart, queryPart] = basePath.split('?')
    const params = new URLSearchParams(queryPart ?? '')
    if (bg) params.set('bg', bg)
    if (bgDim) params.set('bgDim', bgDim)
    const query = params.toString()
    return query ? `${pathPart}?${query}` : pathPart
}

export default async function PublicTournamentPage({
    params,
    searchParams,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string }>
    searchParams: Promise<PublicPageSearchParams>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug } = await params
    const query = await searchParams
    const bg = firstParam(query.bg)
    const bgDim = firstParam(query.bgDim)

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload

    const standings = computeTournamentStandings(tournament.registrations, matches)
    const liveMatches = matches.filter((match) => match.status === 'LIVE')
    const upcomingMatches = matches
        .filter((match) => match.status === 'SCHEDULED')
        .sort((a, b) => (a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 8)

    const placementPhases = tournament.phases
        .filter((phase) => phase.type === 'PLACEMENT_BRACKET')
        .sort((a, b) => a.order - b.order)
    const bracketAPhase = placementPhases[0] ?? null
    const bracketBPhase = placementPhases[1] ?? null
    const hasGroupPhase = tournament.phases.some((phase) => phase.type === 'GROUP')

    return (
        <main className="min-h-screen bg-white text-slate-900">
            <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
                <section className="rounded-2xl border border-slate-200 bg-white p-5">
                    <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Suivi public</p>
                    <h1 className="mt-2 text-2xl font-black md:text-4xl">{tournament.name}</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        {tournament.organization.name} · {tournament.game.name} · statut {tournament.status}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-2">
                        <Link
                            href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/pools`, bg, bgDim)}
                            className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        >
                            Overlay poules
                        </Link>

                        {hasGroupPhase ? (
                            <Link
                                href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/standings`, bg, bgDim)}
                                className="rounded-lg border border-orange-300 bg-orange-50 px-3 py-2 text-xs font-semibold text-orange-700 hover:bg-orange-100"
                            >
                                Overlay classements en direct
                            </Link>
                        ) : (
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                Overlay classements indisponible
                            </span>
                        )}

                        {bracketAPhase ? (
                            <Link
                                href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/placement?phaseId=${bracketAPhase.id}`, bg, bgDim)}
                                className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100"
                            >
                                Overlay {bracketAPhase.name}
                            </Link>
                        ) : (
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                Overlay bracket A indisponible
                            </span>
                        )}

                        {bracketBPhase ? (
                            <Link
                                href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/placement?phaseId=${bracketBPhase.id}`, bg, bgDim)}
                                className="rounded-lg border border-indigo-300 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                                Overlay {bracketBPhase.name}
                            </Link>
                        ) : (
                            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                                Overlay bracket B indisponible
                            </span>
                        )}

                        <Link
                            href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay`, bg, bgDim)}
                            className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                        >
                            Overlay classement general
                        </Link>

                         <Link
                            href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/tablet`, bg, bgDim)}
                            className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                        >
                            Tablette de score
                        </Link>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase text-slate-500">Équipes</p>
                        <p className="mt-2 text-3xl font-black">{tournament.registrations.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase text-slate-500">Phases</p>
                        <p className="mt-2 text-3xl font-black">{tournament.phases.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase text-slate-500">Matchs en direct</p>
                        <p className="mt-2 text-3xl font-black text-emerald-700">{liveMatches.length}</p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase text-slate-500">Matchs termines</p>
                        <p className="mt-2 text-3xl font-black">{matches.filter((match) => match.status === 'FINISHED').length}</p>
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Classement global</h2>
                                <p className="mt-1 text-xs text-slate-500">Téléchargez le classement général avec les logos des équipes.</p>
                            </div>
                            <StandingsImageExporter
                                rows={standings}
                                title={`${tournament.name} · Classement général`}
                                subtitle="Classement général"
                            />
                        </div>
                        <div className="mt-3 overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs uppercase text-slate-500">
                                    <tr>
                                        <th className="py-2">#</th>
                                        <th className="py-2">Equipe</th>
                                        <th className="py-2">Pts</th>
                                        <th className="py-2">V-N-D</th>
                                        <th className="py-2">Diff</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {standings.map((row, index) => (
                                        <tr key={row.teamId} className="border-t border-slate-200">
                                            <td className="py-2 font-semibold">{index + 1}</td>
                                            <td className="py-2">
                                                <div className="flex items-center gap-3">
                                                    {row.teamLogoUrl ? (
                                                        <img
                                                            src={row.teamLogoUrl}
                                                            alt={`${row.teamName} logo`}
                                                            className="h-8 w-8 rounded-full object-cover"
                                                        />
                                                    ) : (
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold uppercase text-slate-600">
                                                            {row.teamName.slice(0, 2)}
                                                        </div>
                                                    )}
                                                    <span>{row.teamName}</span>
                                                </div>
                                            </td>
                                            <td className="py-2 font-semibold">{row.points}</td>
                                            <td className="py-2">{row.wins}-{row.draws}-{row.losses}</td>
                                            <td className="py-2">{row.goalDiff >= 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-emerald-700">Matchs en direct</h2>
                            <div className="mt-3 space-y-2">
                                {liveMatches.length === 0 ? (
                                    <p className="text-sm text-slate-500">Aucun match live pour le moment.</p>
                                ) : (
                                    liveMatches.map((match) => (
                                        <Link
                                            key={match.id}
                                            href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/match/${match.id}`, bg, bgDim)}
                                            className="block rounded-lg border border-emerald-200 bg-emerald-50 p-3 hover:bg-emerald-100"
                                        >
                                            <p className="text-xs uppercase text-emerald-700">{match.pitch.name} · {match.phase.name}</p>
                                            <p className="mt-1 text-base font-bold">
                                                {match.homeTeam?.name ?? 'TBD'} {match.result ? match.result.homeScore : 0}
                                                {' - '}
                                                {match.result ? match.result.awayScore : 0} {match.awayTeam?.name ?? 'TBD'}
                                            </p>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Prochains matchs</h2>
                            <div className="mt-3 space-y-2">
                                {upcomingMatches.length === 0 ? (
                                    <p className="text-sm text-slate-500">Aucun match planifie.</p>
                                ) : (
                                    upcomingMatches.map((match) => (
                                        <div key={match.id} className="rounded-lg border border-slate-200 bg-white p-3">
                                            <p className="text-xs uppercase text-slate-500">{formatMatchDateLabel(match.scheduledAt)} · {match.pitch.name}</p>
                                            <p className="mt-1 text-sm font-semibold">{match.homeTeam?.name ?? 'TBD'} vs {match.awayTeam?.name ?? 'TBD'}</p>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
