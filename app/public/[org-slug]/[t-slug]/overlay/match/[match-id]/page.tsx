import { notFound } from 'next/navigation'
import {
    formatMatchDateLabel,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'

export const dynamic = 'force-dynamic'

export default async function TournamentMatchOverlayPage({
    params,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string; 'match-id': string }>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug, 'match-id': matchId } = await params

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload
    const match = matches.find((item) => item.id === matchId)
    if (!match) notFound()

    return (
        <main className="min-h-screen bg-black/80 text-white">
            <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-6">
                <section className="w-full rounded-2xl border border-white/30 bg-black/55 p-6 backdrop-blur-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-cyan-200">Overlay match detail</p>
                    <h1 className="mt-2 text-3xl font-black">{tournament.name}</h1>
                    <p className="mt-1 text-sm text-slate-300">{match.phase.name} · {match.pitch.name} · {formatMatchDateLabel(match.scheduledAt)}</p>

                    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <div className="rounded-xl border border-white/20 bg-black/35 p-4 text-center">
                            <p className="text-sm uppercase tracking-wider text-slate-300">Domicile</p>
                            <p className="mt-3 text-4xl font-extrabold">{match.homeTeam?.name ?? 'TBD'}</p>
                        </div>

                        <div className="rounded-xl border border-emerald-300/40 bg-emerald-400/15 px-6 py-4 text-center">
                            <p className="text-xs uppercase tracking-[0.16em] text-emerald-100">{match.status}</p>
                            <p className="mt-2 text-6xl font-black">
                                {match.result?.homeScore ?? 0} - {match.result?.awayScore ?? 0}
                            </p>
                        </div>

                        <div className="rounded-xl border border-white/20 bg-black/35 p-4 text-center">
                            <p className="text-sm uppercase tracking-wider text-slate-300">Exterieur</p>
                            <p className="mt-3 text-4xl font-extrabold">{match.awayTeam?.name ?? 'TBD'}</p>
                        </div>
                    </div>
                </section>
            </div>
        </main>
    )
}
