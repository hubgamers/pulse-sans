import PlacementBracketEditor from '@/components/dashboard/tournaments/PlacementBracketEditor'
import { notFound } from 'next/navigation'
import { getPublicTournamentBySlugs } from '@/lib/actions/tournament/public.queries'
import {
    buildOverlayBackgroundStyle,
    readOverlayBackgroundConfig,
    type OverlayBackgroundSearchParams,
} from '../_lib/background'
import { OverlaySponsorStrip, readOverlaySponsors } from '../_lib/sponsors'

type LaunchSlotPayload = {
    startedAt?: string
    timerMinutes?: number
    launchedStatus?: string
    timerKind?: 'MATCH' | 'BREAK'
}

type OverlaySearchParams = OverlayBackgroundSearchParams & {
    phaseId?: string | string[]
}

function readLaunchSlotPayload(value: unknown): LaunchSlotPayload | null {
    if (!value || typeof value !== 'object') return null
    return value as LaunchSlotPayload
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0]
    return value
}

export const dynamic = 'force-dynamic'

export default async function PublicPlacementBracketOverlayPage({
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
    const background = readOverlayBackgroundConfig(query, tournament.bannerUrl)
    const backgroundStyle = buildOverlayBackgroundStyle(background.backgroundUrl, background.dim)
    const sponsors = readOverlaySponsors(tournament.sponsorConfig)

    const placementPhases = tournament.phases
        .filter((phase) => phase.type === 'PLACEMENT_BRACKET')
        .sort((a, b) => a.order - b.order)

    if (placementPhases.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4" style={backgroundStyle}>
                <div className="text-center">
                    <h1 className="text-3xl font-black text-white mb-4">Aucune phase de placement bracket</h1>
                    <p className="text-slate-400 mb-8">Ce tournoi n&apos;a pas de phase de placement bracket configuree.</p>
                </div>
                <OverlaySponsorStrip sponsors={sponsors} />
            </div>
        )
    }

    const requestedPhaseId = firstParam(query.phaseId)
    const selectedPhase = placementPhases.find((phase) => phase.id === requestedPhaseId) ?? placementPhases[0]

    const latestTimerEvent = tournament.actionLogs.find((log) => {
        const launch = readLaunchSlotPayload(log.payload)
        if (!launch || typeof launch.timerMinutes !== 'number') return false
        if (log.actionType === 'TIMER_CONTROL' && launch.timerKind === 'BREAK') return true
        if (log.actionType === 'MATCH_BULK_UPDATE' && launch.launchedStatus === 'LIVE') return true
        return false
    })

    const latestLaunchPayload = latestTimerEvent ? readLaunchSlotPayload(latestTimerEvent.payload) : null
    const latestLaunchStartedAtMs = latestLaunchPayload?.startedAt ? new Date(latestLaunchPayload.startedAt).getTime() : Number.NaN
    const latestLaunchCreatedAtMs = latestTimerEvent ? new Date(latestTimerEvent.createdAt).getTime() : Number.NaN
    const latestLaunchTimerSeconds = typeof latestLaunchPayload?.timerMinutes === 'number'
        ? Math.max(0, Math.min(7200, Math.round(latestLaunchPayload.timerMinutes * 60)))
        : 0

    const requestReferenceMs = Number.isFinite(latestLaunchCreatedAtMs) ? latestLaunchCreatedAtMs : latestLaunchStartedAtMs
    const maxAcceptedFutureMs = Number.isFinite(requestReferenceMs)
        ? requestReferenceMs + 5 * 60 * 1000
        : Number.MAX_SAFE_INTEGER
    const rawTimerStartMs = Number.isFinite(latestLaunchStartedAtMs) ? latestLaunchStartedAtMs : latestLaunchCreatedAtMs
    const resolvedTimerStartMs = Number.isFinite(rawTimerStartMs) && rawTimerStartMs <= maxAcceptedFutureMs
        ? rawTimerStartMs
        : (Number.isFinite(latestLaunchCreatedAtMs) ? latestLaunchCreatedAtMs : requestReferenceMs)

    const timerStartMs = Number.isFinite(resolvedTimerStartMs) ? resolvedTimerStartMs : null
    const timerMode = latestLaunchPayload?.timerKind === 'BREAK' ? 'BREAK' : 'MATCH'

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" style={backgroundStyle}>
            <PlacementBracketEditor
                orgSlug={orgSlug}
                tournamentSlug={tournament.slug}
                tournamentId={tournament.id}
                phases={[{
                    id: selectedPhase.id,
                    name: selectedPhase.name,
                    type: selectedPhase.type,
                    order: selectedPhase.order,
                }]}
                matches={matches
                    .filter((match) => match.phase.id === selectedPhase.id)
                    .map((match) => ({
                        id: match.id,
                        phaseId: match.phase.id,
                        roundNumber: match.roundNumber,
                        bracketPos: match.bracketPos,
                        scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
                        pitchName: match.pitch?.name ?? null,
                        status: match.status,
                        homeTeamId: match.homeTeam?.id ?? null,
                        homeTeamName: match.homeTeam?.name || 'TBD',
                        awayTeamId: match.awayTeam?.id ?? null,
                        awayTeamName: match.awayTeam?.name || 'TBD',
                        homeScore: match.result?.homeScore ?? null,
                        awayScore: match.result?.awayScore ?? null,
                    }))}
                timerSeconds={latestLaunchTimerSeconds}
                timerStartMs={timerStartMs}
                timerMode={timerMode}
                backgroundImageUrl={background.backgroundUrl}
                backgroundDim={background.dim}
            />
            <OverlaySponsorStrip sponsors={sponsors} />
        </div>
    )
}
