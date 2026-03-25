import { notFound } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organization/organization.queries'
import { prisma } from '@/lib/prisma'
import PlacementBracketEditor from '@/components/dashboard/tournaments/PlacementBracketEditor'

type LaunchSlotPayload = {
    startedAt?: string
    timerMinutes?: number
    launchedStatus?: string
    timerKind?: 'MATCH' | 'BREAK'
}

function readLaunchSlotPayload(value: unknown): LaunchSlotPayload | null {
    if (!value || typeof value !== 'object') return null
    return value as LaunchSlotPayload
}

export default async function ExternalPlacementBracketEditPage({
    params,
}: {
    params: Promise<{ orgSlug: string; tSlug: string }>
}) {
    const { orgSlug, tSlug: tournamentSlug } = await params
    const org = await getOrganizationBySlug(orgSlug)

    if (!org) {
        notFound()
    }

    const tournament = await prisma.tournament.findFirst({
        where: {
            organizationId: org.id,
            slug: tournamentSlug,
        },
        include: {
            phases: {
                orderBy: { order: 'asc' },
                where: {
                    type: 'PLACEMENT_BRACKET',
                },
            },
            actionLogs: {
                where: {
                    actionType: {
                        in: ['TIMER_CONTROL', 'MATCH_BULK_UPDATE'],
                    },
                },
                orderBy: { createdAt: 'desc' },
                take: 40,
            },
        },
    })

    if (!tournament) {
        notFound()
    }

    if (tournament.phases.length === 0) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <h1 className="text-3xl font-black text-white mb-4">Aucune phase de placement bracket</h1>
                    <p className="text-slate-400 mb-8">Ce tournoi n'a pas de phase de placement bracket configurée.</p>
                    <a
                        href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}`}
                        className="inline-flex items-center rounded-xl border border-slate-600 px-6 py-3 text-sm font-semibold text-slate-300 hover:border-slate-400 hover:bg-slate-800 transition"
                    >
                        Retour au tableau de bord
                    </a>
                </div>
            </div>
        )
    }

    // Fetch all matches for all placement phases
    const phases = tournament.phases
    const latestTimerEvent = tournament.actionLogs.find((log) => {
        const launch = readLaunchSlotPayload(log.payload)
        if (!launch || typeof launch.timerMinutes !== 'number') return false
        if (log.actionType === 'TIMER_CONTROL' && launch.timerKind === 'BREAK') return true
        if (log.actionType === 'MATCH_BULK_UPDATE' && launch.launchedStatus === 'LIVE') return true
        return false
    })

    const latestLaunchPayload = latestTimerEvent ? readLaunchSlotPayload(latestTimerEvent.payload) : null
    const latestLaunchStartedAtMs = latestLaunchPayload?.startedAt ? new Date(latestLaunchPayload.startedAt).getTime() : NaN
    const latestLaunchCreatedAtMs = latestTimerEvent ? new Date(latestTimerEvent.createdAt).getTime() : NaN
    const latestLaunchTimerSeconds = typeof latestLaunchPayload?.timerMinutes === 'number'
        ? Math.max(0, Math.min(7200, Math.round(latestLaunchPayload.timerMinutes * 60)))
        : 0

    const maxAcceptedFutureMs = Date.now() + 5 * 60 * 1000
    const rawTimerStartMs = Number.isFinite(latestLaunchStartedAtMs) ? latestLaunchStartedAtMs : latestLaunchCreatedAtMs
    const resolvedTimerStartMs = Number.isFinite(rawTimerStartMs) && rawTimerStartMs <= maxAcceptedFutureMs
        ? rawTimerStartMs
        : (Number.isFinite(latestLaunchCreatedAtMs) ? latestLaunchCreatedAtMs : Date.now())

    const timerStartMs = Number.isFinite(resolvedTimerStartMs) ? resolvedTimerStartMs : null
    const timerMode = latestLaunchPayload?.timerKind === 'BREAK' ? 'BREAK' : 'MATCH'

    const matches = await prisma.match.findMany({
        where: {
            phase: {
                tournamentId: tournament.id,
                type: 'PLACEMENT_BRACKET',
            },
        },
        include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            result: true,
        },
        orderBy: [{ phaseId: 'asc' }, { roundNumber: 'asc' }, { createdAt: 'asc' }],
    })

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
            <PlacementBracketEditor
                orgSlug={orgSlug}
                tournamentSlug={tournament.slug}
                tournamentId={tournament.id}
                phases={phases.map((phase) => ({
                    id: phase.id,
                    name: phase.name,
                    type: phase.type,
                    order: phase.order,
                }))}
                matches={matches.map((match) => ({
                    id: match.id,
                    phaseId: match.phaseId,
                    roundNumber: match.roundNumber,
                    bracketPos: match.bracketPos,
                    status: match.status,
                    homeTeamId: match.homeTeamId,
                    homeTeamName: match.homeTeam?.name || 'TBD',
                    awayTeamId: match.awayTeamId,
                    awayTeamName: match.awayTeam?.name || 'TBD',
                    homeScore: match.result?.homeScore ?? null,
                    awayScore: match.result?.awayScore ?? null,
                }))}
                timerSeconds={latestLaunchTimerSeconds}
                timerStartMs={timerStartMs}
                timerMode={timerMode}
            />
        </div>
    )
}
