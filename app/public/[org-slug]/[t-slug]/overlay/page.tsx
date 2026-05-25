import { notFound } from 'next/navigation'
import {
    computeTournamentStandings,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'
import {
    buildOverlayBackgroundStyle,
    readOverlayBackgroundConfig,
    type OverlayBackgroundSearchParams,
} from './_lib/background'
import { OverlaySponsorStrip, readOverlaySponsors } from './_lib/sponsors'

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

export default async function TournamentOverlayPage({
    params,
    searchParams,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string }>
    searchParams: Promise<OverlayBackgroundSearchParams>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug } = await params
    const query = await searchParams

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload
    const standings = computeTournamentStandings(tournament.registrations, matches).slice(0, 8)
    const liveMatches = matches.filter((match) => match.status === 'LIVE').slice(0, 4)
    const background = readOverlayBackgroundConfig(query, tournament.bannerUrl)
    const backgroundStyle = buildOverlayBackgroundStyle(background.backgroundUrl, background.dim)
    const sponsors = readOverlaySponsors(tournament.sponsorConfig)

    return (
        <main className="relative min-h-screen overflow-hidden bg-slate-950 text-white" style={backgroundStyle}>
            <div className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-6 py-6 lg:grid-cols-2">
                <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#ccff00]">Overlay tournoi</p>
                    <h1 className="mt-2 text-4xl font-black tracking-tight text-white">{tournament.name}</h1>
                    <p className="mt-1 text-sm text-slate-300">{tournament.organization.name} · {tournament.game.name}</p>

                    <div className="mt-6 space-y-3">
                        {liveMatches.length === 0 ? (
                            <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
                                Aucun match live actuellement.
                            </div>
                        ) : (
                            liveMatches.map((match) => (
                                <div key={match.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                                    <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400">{match.pitch.name} · {match.phase.name}</p>
                                    <div className="mt-2 flex items-center justify-between gap-4">
                                        <div className="min-w-0">
                                            <p className="truncate text-xl font-black text-white">{match.homeTeam?.name ?? 'TBD'} vs {match.awayTeam?.name ?? 'TBD'}</p>
                                            <p className="text-sm text-slate-400">{match.result?.homeScore ?? 0} - {match.result?.awayScore ?? 0}</p>
                                        </div>
                                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.3em] text-slate-300">
                                            {match.result ? 'Terminé' : 'À venir'}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="rounded-3xl border border-white/10 bg-slate-950/80 p-6 shadow-2xl backdrop-blur-xl">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#ccff00]">Top classement</p>
                    <div className="mt-3 space-y-3">
                        {standings.map((row, index) => (
                            <div key={row.teamId} className="grid grid-cols-[40px_minmax(0,1fr)_auto_auto] items-center gap-3 rounded-3xl border border-white/10 bg-white/5 px-4 py-3">
                                <span className="text-xl font-black text-[#ccff00]">{index + 1}</span>
                                <div className="flex items-center gap-3 min-w-0">
                                    {row.teamLogoUrl ? (
                                        <img
                                            src={row.teamLogoUrl}
                                            alt={row.teamName}
                                            className="h-10 w-10 rounded-full object-cover"
                                        />
                                    ) : (
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-xs font-black uppercase text-slate-300">
                                            {initialsFromTeamName(row.teamName)}
                                        </div>
                                    )}
                                    <span className="truncate text-base font-bold text-white">{row.teamName}</span>
                                </div>
                                <span className="text-sm text-slate-400">{row.wins}-{row.draws}-{row.losses}</span>
                                <span className="text-xl font-black text-[#ccff00]">{row.points}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>
            <OverlaySponsorStrip sponsors={sponsors} />
        </main>
    )
}
