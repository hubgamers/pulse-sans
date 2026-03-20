import { notFound } from 'next/navigation'
import {
    computeTournamentStandings,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'

export const dynamic = 'force-dynamic'

export default async function TournamentOverlayPage({
    params,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string }>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug } = await params

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload
    const standings = computeTournamentStandings(tournament.registrations, matches).slice(0, 8)
    const liveMatches = matches.filter((match) => match.status === 'LIVE').slice(0, 4)

    return (
        <main className="min-h-screen bg-transparent text-slate-900">
            <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Overlay tournoi</p>
                    <h1 className="mt-2 text-3xl font-black">{tournament.name}</h1>
                    <p className="mt-1 text-sm text-slate-500">{tournament.organization.name} · {tournament.game.name}</p>

                    <div className="mt-4 space-y-2">
                        {liveMatches.length === 0 ? (
                            <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-500">
                                Aucun match live actuellement.
                            </p>
                        ) : (
                            liveMatches.map((match) => (
                                <div key={match.id} className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
                                    <p className="text-xs uppercase tracking-wider text-emerald-700">{match.pitch.name} · {match.phase.name}</p>
                                    <p className="mt-1 text-xl font-extrabold">
                                        {match.homeTeam?.name ?? 'TBD'} {match.result?.homeScore ?? 0}
                                        {' - '}
                                        {match.result?.awayScore ?? 0} {match.awayTeam?.name ?? 'TBD'}
                                    </p>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Top classement</p>
                    <div className="mt-3 space-y-2">
                        {standings.map((row, index) => (
                            <div key={row.teamId} className="grid grid-cols-[40px_1fr_auto_auto] items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                <p className="text-xl font-black text-teal-700">{index + 1}</p>
                                <p className="text-base font-bold">{row.teamName}</p>
                                <p className="text-sm text-slate-500">{row.wins}-{row.draws}-{row.losses}</p>
                                <p className="text-xl font-black text-teal-700">{row.points}</p>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    )
}
