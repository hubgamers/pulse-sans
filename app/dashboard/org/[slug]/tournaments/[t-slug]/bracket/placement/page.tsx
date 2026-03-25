import Link from 'next/link'
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

export default async function PlacementBracketEditPage({
    params,
}: {
    params: Promise<{ slug: string; 't-slug': string }>
}) {
    const { slug, 't-slug': tournamentSlug } = await params
    const org = await getOrganizationBySlug(slug)

    if (!org) {
        return <div className="text-slate-700">Organisation introuvable.</div>
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
            <div className="space-y-6 text-slate-900">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs uppercase tracking-widest text-slate-500">{org.name}</p>
                        <h1 className="text-2xl md:text-3xl font-black">Édition - Placement Bracket</h1>
                        <p className="mt-2 text-sm text-slate-500">{tournament.name}</p>
                    </div>
                    <Link
                        href={`/dashboard/org/${slug}/tournaments/${tournament.slug}`}
                        className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-white transition"
                    >
                        Retour tournoi
                    </Link>
                </div>

                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Aucune phase de placement bracket configurée dans ce tournoi.
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
                orgSlug={slug}
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
