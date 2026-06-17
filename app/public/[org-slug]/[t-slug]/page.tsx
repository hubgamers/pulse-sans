import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
    computeTournamentStandings,
    formatMatchDateLabel,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'
import { StandingsImageExporter } from '@/components/public/StandingsImageExporter'
import { LinkQRCode } from '@/components/public/LinkQRCode'

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
        .filter((phase) => phase.type === 'BRACKET_SINGLE' || phase.type === 'PLACEMENT_BRACKET')
        .sort((a, b) => a.order - b.order)
    const bracketAPhase = placementPhases[0] ?? null
    const bracketBPhase = placementPhases[1] ?? null
    const groupPhases = tournament.phases
        .filter((phase) => phase.type === 'GROUP')
        .sort((a, b) => a.order - b.order)
    const hasGroupPhase = groupPhases.length > 0

    return (
        <main className="min-h-screen bg-slate-950 text-white">
            <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(20,184,166,0.25),transparent_35%),radial-gradient(circle_at_top_right,rgba(99,102,241,0.22),transparent_35%)]" />

            <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 md:px-8">
                <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.06] shadow-2xl backdrop-blur">
                    <div className="p-6 md:p-8">
                        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                            <div>
                                <p className="text-xs font-bold uppercase tracking-[0.3em] text-teal-300">
                                    Suivi public
                                </p>

                                <h1 className="mt-3 text-3xl font-black tracking-tight md:text-5xl">
                                    {tournament.name}
                                </h1>

                                <p className="mt-3 text-sm text-slate-300">
                                    {tournament.organization.name} · {tournament.game.name} · statut{' '}
                                    <span className="font-semibold text-white">{tournament.status}</span>
                                </p>
                            </div>

                            <div className="rounded-2xl border border-white/10 bg-white/10 p-3">
                                <LinkQRCode
                                    value={buildOverlayHref(
                                        `${process.env.NEXT_PUBLIC_BASE_URL}/public/${orgSlug}/${tournamentSlug}/tablet`,
                                        bg,
                                        bgDim
                                    )}
                                />
                                <p className="mt-2 text-center text-xs text-slate-400">Scanner pour la tablette de score</p>
                            </div>
                        </div>

                        <div className="mt-6 flex flex-wrap gap-3">
                            {groupPhases.map((phase, index) => (
                                <Link
                                    key={`public-pools-overlay-${phase.id}`}
                                    target='_blank'
                                    href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/pools?phaseId=${phase.id}`, bg, bgDim)}
                                    className={`${index === 0 ? 'bg-amber-400 text-amber-950 hover:bg-amber-300' : 'border border-amber-300/40 bg-amber-300/10 text-amber-200 hover:bg-amber-300/20'} rounded-full px-4 py-2 text-xs font-bold`}
                                >
                                    Overlay poules - {phase.name}
                                </Link>
                            ))}

                            {groupPhases.map((phase) => (
                                <Link
                                    key={`public-pools-overlay-${phase.id}-1-4`}
                                    target='_blank'
                                    href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/pools?phaseId=${phase.id}&groupFrom=1&groupTo=4`, bg, bgDim)}
                                    className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/20"
                                >
                                    {phase.name} - Poules 1-4
                                </Link>
                            ))}

                            {groupPhases.map((phase) => (
                                <Link
                                    key={`public-pools-overlay-${phase.id}-5-8`}
                                    target='_blank'
                                    href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/pools?phaseId=${phase.id}&groupFrom=5&groupTo=8`, bg, bgDim)}
                                    className="rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-xs font-bold text-amber-200 hover:bg-amber-300/20"
                                >
                                    {phase.name} - Poules 5-8
                                </Link>
                            ))}

                            {hasGroupPhase ? (
                                <Link target='_blank' href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/standings`, bg, bgDim)} className="rounded-full bg-orange-400 px-4 py-2 text-xs font-bold text-orange-950 hover:bg-orange-300">
                                    Classements live
                                </Link>
                            ) : (
                                <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-slate-400">
                                    Classements indisponibles
                                </span>
                            )}

                            {bracketAPhase && (
                                <Link target='_blank' href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/placement?phaseId=${bracketAPhase.id}`, bg, bgDim)} className="rounded-full bg-fuchsia-400 px-4 py-2 text-xs font-bold text-fuchsia-950 hover:bg-fuchsia-300">
                                    {bracketAPhase.name}
                                </Link>
                            )}

                            {bracketBPhase && (
                                <Link target='_blank' href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/placement?phaseId=${bracketBPhase.id}`, bg, bgDim)} className="rounded-full bg-indigo-400 px-4 py-2 text-xs font-bold text-indigo-950 hover:bg-indigo-300">
                                    {bracketBPhase.name}
                                </Link>
                            )}

                            <Link target='_blank' href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay`, bg, bgDim)} className="rounded-full bg-teal-400 px-4 py-2 text-xs font-bold text-teal-950 hover:bg-teal-300">
                                Classement général
                            </Link>

                            <Link target='_blank' href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/tablet`, bg, bgDim)} className="rounded-full border border-teal-300/40 bg-teal-300/10 px-4 py-2 text-xs font-bold text-teal-200 hover:bg-teal-300/20">
                                Tablette de score
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {[
                        ['Équipes', tournament.registrations.length],
                        ['Phases', tournament.phases.length],
                        ['Matchs en direct', liveMatches.length],
                        ['Matchs terminés', matches.filter((match) => match.status === 'FINISHED').length],
                    ].map(([label, value]) => (
                        <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur">
                            <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
                            <p className="mt-3 text-4xl font-black">{value}</p>
                        </div>
                    ))}
                </section>

                <section className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
                    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">
                                    Classement global
                                </h2>
                                <p className="mt-1 text-sm text-slate-400">
                                    Téléchargez le classement général avec les logos des équipes.
                                </p>
                            </div>

                            <StandingsImageExporter
                                rows={standings}
                                title={`${tournament.name} · Classement général`}
                                subtitle="Classement général"
                            />
                        </div>

                        <div className="mt-5 overflow-hidden rounded-2xl border border-white/10">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-white/10 text-xs uppercase tracking-[0.16em] text-slate-300">
                                    <tr>
                                        <th className="px-4 py-3">#</th>
                                        <th className="px-4 py-3">Équipe</th>
                                        <th className="px-4 py-3">Pts</th>
                                        <th className="px-4 py-3">V-N-D</th>
                                        <th className="px-4 py-3">Diff</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    {standings.map((row, index) => (
                                        <tr key={row.teamId} className="border-t border-white/10 hover:bg-white/[0.04]">
                                            <td className="px-4 py-3 font-black text-slate-300">{index + 1}</td>

                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    {row.teamLogoUrl ? (
                                                        <img src={row.teamLogoUrl} alt={`${row.teamName} logo`} className="h-9 w-9 rounded-full object-cover ring-2 ring-white/10" />
                                                    ) : (
                                                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-[10px] font-black uppercase text-slate-300">
                                                            {row.teamName.slice(0, 2)}
                                                        </div>
                                                    )}

                                                    <span className="font-semibold text-white">{row.teamName}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3 font-black text-teal-300">{row.points}</td>
                                            <td className="px-4 py-3 text-slate-300">{row.wins}-{row.draws}-{row.losses}</td>
                                            <td className="px-4 py-3 font-semibold text-slate-300">
                                                {row.goalDiff >= 0 ? `+${row.goalDiff}` : row.goalDiff}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="rounded-3xl border border-emerald-400/20 bg-emerald-400/[0.08] p-5 shadow-xl backdrop-blur">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-emerald-300">
                                Matchs en direct
                            </h2>

                            <div className="mt-4 space-y-3">
                                {liveMatches.length === 0 ? (
                                    <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                                        Aucun match live pour le moment.
                                    </p>
                                ) : (
                                    liveMatches.map((match) => (
                                        <Link
                                            key={match.id}
                                            href={buildOverlayHref(`/public/${orgSlug}/${tournamentSlug}/overlay/match/${match.id}`, bg, bgDim)}
                                            className="block rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 hover:bg-emerald-300/20"
                                        >
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">
                                                {match.pitch.name} · {match.phase.name}
                                            </p>

                                            <p className="mt-2 text-lg font-black text-white">
                                                {match.homeTeam?.name ?? 'TBD'} {match.result ? match.result.homeScore : 0}
                                                {' - '}
                                                {match.result ? match.result.awayScore : 0} {match.awayTeam?.name ?? 'TBD'}
                                            </p>
                                        </Link>
                                    ))
                                )}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-5 shadow-xl backdrop-blur">
                            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">
                                Prochains matchs
                            </h2>

                            <div className="mt-4 space-y-3">
                                {upcomingMatches.length === 0 ? (
                                    <p className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                                        Aucun match planifié.
                                    </p>
                                ) : (
                                    upcomingMatches.map((match) => (
                                        <div key={match.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                                            <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                                                {formatMatchDateLabel(match.scheduledAt)} · {match.pitch.name}
                                            </p>

                                            <p className="mt-2 text-sm font-bold text-white">
                                                {match.homeTeam?.name ?? 'TBD'} vs {match.awayTeam?.name ?? 'TBD'}
                                            </p>
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
