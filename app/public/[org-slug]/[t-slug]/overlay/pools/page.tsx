import { notFound } from 'next/navigation'
import {
    computeGroupOverviews,
    formatMatchDateLabel,
    formatMatchTimeLabel,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'
import PoolsOverlayCarousel from './PoolsOverlayCarousel'
import {
    buildOverlayBackgroundStyle,
    readOverlayBackgroundConfig,
    type OverlayBackgroundSearchParams,
} from '../_lib/background'
import { OverlaySponsorStrip, readOverlaySponsors } from '../_lib/sponsors'

type OverlaySearchParams = OverlayBackgroundSearchParams & {
    phaseId?: string | string[]
    rotate?: string | string[]
    refresh?: string | string[]
    timer?: string | string[]
    startedAt?: string | string[]
    groupFrom?: string | string[]
    groupTo?: string | string[]
}

type LaunchSlotPayload = {
    slotAt?: string
    startedAt?: string
    stoppedAt?: string
    timerMinutes?: number
    launchedStatus?: string
    timerKind?: 'MATCH' | 'BREAK' | 'STOP'
}

type PhaseRouteConfig = {
    toPhaseId?: string | null
    rule?: 'TOP' | 'BOTTOM' | 'RANGE'
    countPerGroup?: number
    startRank?: number
    endRank?: number
}

type QualificationRule = {
    type: 'TOP' | 'BOTTOM' | 'RANGE'
    label: string
    priority: number
    countPerGroup?: number
    startRank?: number
    endRank?: number
}

function readRoutes(config: unknown): PhaseRouteConfig[] {
    if (!config || typeof config !== 'object') return []
    const routes = (config as { routes?: unknown }).routes
    return Array.isArray(routes) ? routes.filter((route) => route && typeof route === 'object') as PhaseRouteConfig[] : []
}

function buildQualificationMeta(
    config: unknown,
    phaseNameById: Map<string, string>
): { labels: string[]; rules: QualificationRule[] } {
    const rules: QualificationRule[] = []

    for (const route of readRoutes(config)) {
        const targetPhaseName = route.toPhaseId ? phaseNameById.get(route.toPhaseId) : null
        const targetLabel = targetPhaseName ?? 'phase suivante'

        if (route.rule === 'TOP' && route.countPerGroup) {
            rules.push({
                type: 'TOP',
                label: `Top ${route.countPerGroup} vers ${targetLabel}`,
                priority: 1,
                countPerGroup: route.countPerGroup,
            })
        }

        if (route.rule === 'BOTTOM' && route.countPerGroup) {
            rules.push({
                type: 'BOTTOM',
                label: `Bottom ${route.countPerGroup} vers ${targetLabel}`,
                priority: 3,
                countPerGroup: route.countPerGroup,
            })
        }

        if (route.rule === 'RANGE' && route.startRank && route.endRank) {
            rules.push({
                type: 'RANGE',
                label: `Places ${route.startRank}-${route.endRank} vers ${targetLabel}`,
                priority: 2,
                startRank: route.startRank,
                endRank: route.endRank,
            })
        }
    }

    const sortedRules = rules.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority
        return a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' })
    })

    return {
        labels: [...new Set(sortedRules.map((rule) => rule.label))],
        rules: sortedRules,
    }
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0]
    return value
}

function parseIntervalSeconds(
    raw: string | undefined,
    fallbackSeconds: number,
    minSeconds: number,
    maxSeconds: number
) {
    const parsed = raw ? Number(raw) : NaN
    if (!Number.isFinite(parsed)) return fallbackSeconds
    return Math.max(minSeconds, Math.min(maxSeconds, Math.round(parsed)))
}

function parseGroupIndex(raw: string | undefined) {
    const value = raw?.trim()
    if (!value) return null

    const numberValue = Number(value)
    if (Number.isInteger(numberValue) && numberValue > 0) return numberValue

    return null
}

function readLaunchSlotPayload(value: unknown): LaunchSlotPayload | null {
    if (!value || typeof value !== 'object') return null
    return value as LaunchSlotPayload
}

export const dynamic = 'force-dynamic'

export default async function TournamentPoolsOverlayPage({
    params,
    searchParams,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string }>
    searchParams: Promise<OverlaySearchParams>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug } = await params
    const query = await searchParams
    const rotateSeconds = parseIntervalSeconds(firstParam(query.rotate), 20, 5, 120)
    const refreshSeconds = parseIntervalSeconds(firstParam(query.refresh), 10, 3, 120)
    const timerSecondsFromQuery = parseIntervalSeconds(firstParam(query.timer), 0, 0, 7200)
    const startedAtRaw = firstParam(query.startedAt)
    const requestedPhaseId = firstParam(query.phaseId)
    const groupFrom = parseGroupIndex(firstParam(query.groupFrom))
    const groupTo = parseGroupIndex(firstParam(query.groupTo))
    const startedAtMs = startedAtRaw ? new Date(startedAtRaw).getTime() : NaN
    const rotationMs = rotateSeconds * 1000
    const refreshMs = refreshSeconds * 1000

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload
    const background = readOverlayBackgroundConfig(query, tournament.bannerUrl)
    const backgroundStyle = buildOverlayBackgroundStyle(background.backgroundUrl, background.dim)
    const sponsors = readOverlaySponsors(tournament.sponsorConfig)
    const latestTimerEvent = tournament.actionLogs.find((log) => {
        const launch = readLaunchSlotPayload(log.payload)
        if (!launch) return false
        if (log.actionType === 'TIMER_CONTROL' && launch.timerKind === 'STOP') return true
        if (typeof launch.timerMinutes !== 'number') return false
        if (log.actionType === 'TIMER_CONTROL' && launch.timerKind === 'BREAK') return true
        if (log.actionType === 'MATCH_BULK_UPDATE' && launch.launchedStatus === 'LIVE' && typeof launch.slotAt === 'string') return true
        return false
    })

    const latestLaunchPayload = latestTimerEvent ? readLaunchSlotPayload(latestTimerEvent.payload) : null
    const timerStopped = latestLaunchPayload?.timerKind === 'STOP'
    const timerKind = latestLaunchPayload?.timerKind === 'BREAK' ? 'BREAK' : 'MATCH'
    const latestLaunchSlotAtMs = latestLaunchPayload?.slotAt ? new Date(latestLaunchPayload.slotAt).getTime() : NaN
    const latestLaunchStartedAtMs = latestLaunchPayload?.startedAt ? new Date(latestLaunchPayload.startedAt).getTime() : NaN
    const latestLaunchCreatedAtMs = latestTimerEvent ? new Date(latestTimerEvent.createdAt).getTime() : NaN
    const latestLaunchTimerSeconds = typeof latestLaunchPayload?.timerMinutes === 'number'
        ? Math.max(0, Math.min(7200, Math.round(latestLaunchPayload.timerMinutes * 60)))
        : 0

    const hasLaunchLog = latestLaunchPayload !== null && !timerStopped
    const timerSeconds = timerStopped
        ? 0
        : hasLaunchLog
        ? latestLaunchTimerSeconds
        : timerSecondsFromQuery
    const rawTimerStartMs = hasLaunchLog
        ? (Number.isFinite(latestLaunchStartedAtMs)
            ? latestLaunchStartedAtMs
            : (Number.isFinite(latestLaunchCreatedAtMs) ? latestLaunchCreatedAtMs : latestLaunchSlotAtMs))
        : startedAtMs

    // Guard against bad future timestamps that can produce absurd values like XXXXX:XX.
    const requestReferenceMs = Number.isFinite(latestLaunchCreatedAtMs)
        ? latestLaunchCreatedAtMs
        : (Number.isFinite(latestLaunchSlotAtMs) ? latestLaunchSlotAtMs : startedAtMs)
    const maxAcceptedFutureMs = Number.isFinite(requestReferenceMs)
        ? requestReferenceMs + 5 * 60 * 1000
        : Number.MAX_SAFE_INTEGER
    const resolvedTimerStartMs = Number.isFinite(rawTimerStartMs) && rawTimerStartMs <= maxAcceptedFutureMs
        ? rawTimerStartMs
        : (Number.isFinite(latestLaunchCreatedAtMs) ? latestLaunchCreatedAtMs : requestReferenceMs)

    const timerStartMs = Number.isFinite(resolvedTimerStartMs) ? resolvedTimerStartMs : null
    const activeSlotAtMs = timerKind === 'MATCH' && Number.isFinite(latestLaunchSlotAtMs) ? latestLaunchSlotAtMs : NaN

    const groupOverviews = computeGroupOverviews(tournament.registrations, tournament.phases, matches)
    const visibleGroupOverviews = requestedPhaseId
        ? groupOverviews.filter((phase) => phase.phaseId === requestedPhaseId)
        : groupOverviews
    const phaseNameById = new Map(tournament.phases.map((phase) => [phase.id, phase.name]))
    const allCards = visibleGroupOverviews.flatMap((phase) =>
        phase.groups.map((group) => {
            const sourcePhase = tournament.phases.find((item) => item.id === phase.phaseId)
            const qualificationMeta = buildQualificationMeta(sourcePhase?.config, phaseNameById)

            return {
                key: `${phase.phaseId}-${group.groupIndex}`,
                phaseName: phase.phaseName,
                groupIndex: group.groupIndex,
                qualificationLabels: qualificationMeta.labels,
                qualificationRules: qualificationMeta.rules,
                standings: group.standings,
                featuredMatches: group.featuredMatches.map((match) => ({
                    id: match.id,
                    status: match.status,
                    label:
                        match.status === 'LIVE'
                            ? 'En direct'
                            : match.status === 'FINISHED'
                                ? 'Termine'
                                : 'A venir',
                    dateLabel:
                        match.status === 'FINISHED'
                            ? formatMatchDateLabel(match.playedAt ?? match.scheduledAt)
                            : formatMatchDateLabel(match.scheduledAt),
                    timeLabel: formatMatchTimeLabel(match.scheduledAt),
                    pitchName: match.pitch.name,
                    phaseName: match.phase.name,
                    homeTeamName: match.homeTeam?.name ?? 'TBD',
                    awayTeamName: match.awayTeam?.name ?? 'TBD',
                    homeScore: match.result?.homeScore ?? null,
                    awayScore: match.result?.awayScore ?? null,
                    isActiveSlotLive:
                        Number.isFinite(activeSlotAtMs) &&
                        match.status === 'LIVE' &&
                        match.scheduledAt !== null &&
                        match.scheduledAt.getTime() === activeSlotAtMs,
                })),
            }
        })
    )
    const minGroupIndex = groupFrom ?? 1
    const maxGroupIndex = groupTo ?? Number.MAX_SAFE_INTEGER
    const cards = allCards.filter((card) => card.groupIndex >= minGroupIndex && card.groupIndex <= maxGroupIndex)

    return (
        <>
            {visibleGroupOverviews.length === 0 || cards.length === 0 ? (
                <main className="min-h-screen bg-transparent text-slate-900" style={backgroundStyle}>
                    <div className="mx-auto flex min-h-screen w-full max-w-[1920px] flex-col gap-4 px-4 py-4">
                        <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-sm backdrop-blur">
                            <p className="text-xs uppercase tracking-[0.24em] text-teal-700">Overlay poules</p>
                            <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
                                <div>
                                    <h1 className="text-2xl font-black md:text-4xl">{tournament.name}</h1>
                                    <p className="mt-1 text-xs text-slate-500 md:text-sm">
                                        {tournament.organization.name} · {tournament.game.name}
                                    </p>
                                </div>
                                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-right">
                                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">Phases de poules</p>
                                    <p className="mt-1 text-2xl font-black text-teal-700">{visibleGroupOverviews.length}</p>
                                </div>
                            </div>
                        </section>

                        <section className="rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-sm backdrop-blur">
                            <p className="text-lg font-semibold text-slate-700">
                                {visibleGroupOverviews.length === 0 ? 'Aucune phase de poules configuree.' : 'Aucune poule dans cette plage.'}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                                {visibleGroupOverviews.length === 0
                                    ? 'Cet overlay s\'active des qu\'une phase de type poule contient des equipes ou des matchs planifies.'
                                    : 'Verifiez les parametres groupFrom et groupTo de l\'URL.'}
                            </p>
                        </section>
                    </div>
                    <OverlaySponsorStrip sponsors={sponsors} variant="light" />
                </main>
            ) : (
                <PoolsOverlayCarousel
                    cards={cards}
                    rotationMs={rotationMs}
                    refreshMs={refreshMs}
                    timerSeconds={timerSeconds}
                    timerStartMs={timerStartMs}
                    timerMode={timerKind}
                    backgroundImageUrl={background.backgroundUrl}
                    backgroundDim={background.dim}
                    sponsors={sponsors}
                />
            )}
        </>
    )
}
