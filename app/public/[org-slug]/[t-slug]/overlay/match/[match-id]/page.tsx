import { notFound } from 'next/navigation'
import {
    formatMatchDateLabel,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'
import {
    buildOverlayBackgroundStyle,
    readOverlayBackgroundConfig,
    type OverlayBackgroundSearchParams,
} from '../../_lib/background'
import { OverlaySponsorStrip, readOverlaySponsors } from '../../_lib/sponsors'

export const dynamic = 'force-dynamic'

export default async function TournamentMatchOverlayPage({
    params,
    searchParams,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string; 'match-id': string }>
    searchParams: Promise<OverlayBackgroundSearchParams>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug, 'match-id': matchId } = await params
    const query = await searchParams

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload
    const match = matches.find((item) => item.id === matchId)
    if (!match) notFound()
    const background = readOverlayBackgroundConfig(query, tournament.bannerUrl)
    const backgroundStyle = buildOverlayBackgroundStyle(background.backgroundUrl, background.dim)
    const sponsors = readOverlaySponsors(tournament.sponsorConfig)

    return (
        <main className="min-h-screen bg-transparent text-slate-900" style={backgroundStyle}>
            <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-6">
                <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Overlay match detail</p>
                    <h1 className="mt-2 text-3xl font-black">{tournament.name}</h1>
                    <p className="mt-1 text-sm text-slate-500">{match.phase.name} · {match.pitch.name} · {formatMatchDateLabel(match.scheduledAt)}</p>

                    <div className="mt-6 grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                            <p className="text-sm uppercase tracking-wider text-slate-500">Domicile</p>
                            <p className="mt-3 text-4xl font-extrabold">{match.homeTeam?.name ?? 'TBD'}</p>
                        </div>

                        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-4 text-center">
                            <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">{match.status}</p>
                            <p className="mt-2 text-6xl font-black">
                                {match.result?.homeScore ?? 0} - {match.result?.awayScore ?? 0}
                            </p>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center">
                            <p className="text-sm uppercase tracking-wider text-slate-500">Exterieur</p>
                            <p className="mt-3 text-4xl font-extrabold">{match.awayTeam?.name ?? 'TBD'}</p>
                        </div>
                    </div>
                </section>
            </div>
            <OverlaySponsorStrip sponsors={sponsors} variant="light" />
        </main>
    )
}
