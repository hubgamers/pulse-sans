import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
    computeTournamentStandings,
    formatMatchDateLabel,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'

export const dynamic = 'force-dynamic'

export default async function PublicTournamentPage({
    params,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string }>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug } = await params

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload

    const standings = computeTournamentStandings(tournament.registrations, matches)
    const liveMatches = matches.filter((match) => match.status === 'LIVE')
    const upcomingMatches = matches
        .filter((match) => match.status === 'SCHEDULED')
        .sort((a, b) => (a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER))
        .slice(0, 8)

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
                            href={`/public/${orgSlug}/${tournamentSlug}/overlay`}
                            className="rounded-lg border border-teal-300 bg-teal-50 px-3 py-2 text-xs font-semibold text-teal-700 hover:bg-teal-100"
                        >
                            Overlay general
                        </Link>
                        {tournament.pitches.map((pitch) => (
                            <Link
                                key={pitch.id}
                                href={`/public/${orgSlug}/${tournamentSlug}/overlay/pitch/${pitch.id}`}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold hover:border-slate-500"
                            >
                                Overlay {pitch.name}
                            </Link>
                        ))}
                    </div>
                </section>

                <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase text-slate-500">Equipes</p>
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
                        <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-700">Classement global</h2>
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
                                            <td className="py-2">{row.teamName}</td>
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
                                            href={`/public/${orgSlug}/${tournamentSlug}/overlay/match/${match.id}`}
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
