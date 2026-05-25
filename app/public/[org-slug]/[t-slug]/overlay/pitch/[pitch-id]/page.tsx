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

export default async function TournamentPitchOverlayPage({
    params,
    searchParams,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string; 'pitch-id': string }>
    searchParams: Promise<OverlayBackgroundSearchParams>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug, 'pitch-id': pitchId } = await params
    const query = await searchParams

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload

    const pitch = tournament.pitches.find((item) => item.id === pitchId)
    if (!pitch) notFound()

    const pitchMatches = matches
        .filter((match) => match.pitch.id === pitch.id)
        .sort((a, b) => (a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER))

    const liveMatch = pitchMatches.find((match) => match.status === 'LIVE')
    const nextMatch = pitchMatches.find((match) => match.status === 'SCHEDULED')
    const latestFinished = [...pitchMatches].reverse().find((match) => match.status === 'FINISHED')

    const focusMatch = liveMatch ?? nextMatch ?? latestFinished
    const background = readOverlayBackgroundConfig(query, tournament.bannerUrl)
    const backgroundStyle = buildOverlayBackgroundStyle(background.backgroundUrl, background.dim)
    const sponsors = readOverlaySponsors(tournament.sponsorConfig)

    return (
        <main className="min-h-screen bg-transparent text-slate-900" style={backgroundStyle}>
            <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-6">
                <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Overlay piste</p>
                    <h1 className="mt-2 text-4xl font-black">{pitch.name}</h1>
                    <p className="mt-1 text-sm text-slate-500">{tournament.name} · {tournament.organization.name}</p>

                    {!focusMatch ? (
                        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            Aucun match assigne a cette piste.
                        </p>
                    ) : (
                        <div className="mt-6 space-y-4">
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                                <p className="text-xs uppercase tracking-[0.16em] text-emerald-700">
                                    {focusMatch.status === 'LIVE' ? 'Match en direct' : focusMatch.status === 'SCHEDULED' ? 'Prochain match' : 'Dernier resultat'}
                                </p>
                                <p className="mt-1 text-sm text-emerald-700">{focusMatch.phase.name} · {formatMatchDateLabel(focusMatch.scheduledAt)}</p>
                                <p className="mt-3 text-3xl font-extrabold">
                                    {focusMatch.homeTeam?.name ?? 'TBD'} {focusMatch.result?.homeScore ?? 0}
                                    {' - '}
                                    {focusMatch.result?.awayScore ?? 0} {focusMatch.awayTeam?.name ?? 'TBD'}
                                </p>
                            </div>

                            <div className="grid gap-2 md:grid-cols-2">
                                {pitchMatches.slice(0, 6).map((match) => (
                                    <div key={match.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-[11px] uppercase tracking-wider text-slate-500">{match.status} · {formatMatchDateLabel(match.scheduledAt)}</p>
                                        <p className="mt-1 text-sm font-semibold">{match.homeTeam?.name ?? 'TBD'} vs {match.awayTeam?.name ?? 'TBD'}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
            </div>
            <OverlaySponsorStrip sponsors={sponsors} variant="light" />
        </main>
    )
}
