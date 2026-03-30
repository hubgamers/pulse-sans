import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organization/organization.queries'
import { prisma } from '@/lib/prisma'
import PlacementBracketPhaseView from '@/components/dashboard/tournaments/PlacementBracketPhaseView'
import { createClient } from '@/lib/supabase/server'

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
    searchParams,
}: {
    params: Promise<{ orgSlug: string; tSlug: string }>
    searchParams?: Promise<{ phaseId?: string }>
}) {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/auth')
    }

    const { orgSlug, tSlug: tournamentSlug } = await params
    const resolvedSearchParams = searchParams ? await searchParams : undefined
    const requestedPhaseId = resolvedSearchParams?.phaseId?.trim() || null
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

    const phases = tournament.phases
    const currentPhase = phases.find((phase) => phase.id === requestedPhaseId) ?? phases[0]

    if (!currentPhase) {
        notFound()
    }

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
            phaseId: currentPhase.id,
        },
        include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            pitch: { select: { name: true } },
            result: true,
        },
        orderBy: [{ phaseId: 'asc' }, { roundNumber: 'asc' }, { createdAt: 'asc' }],
    })

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-6">
            <div className="mx-auto max-w-[1800px] space-y-4">
                <div className="flex flex-col gap-3 rounded-3xl border border-white/10 bg-white/[0.04] p-4 text-white backdrop-blur-sm md:flex-row md:items-center md:justify-between">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">Admin plein écran</p>
                        <h1 className="mt-1 text-2xl font-black tracking-tight">{tournament.name}</h1>
                        <p className="mt-1 text-sm text-slate-400">Vue sans sidebar avec édition des matchs et gestion des rotations.</p>
                    </div>
                    <Link
                        href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}`}
                        className="inline-flex items-center rounded-xl border border-slate-500 px-4 py-2 text-sm font-semibold text-slate-200 hover:border-slate-300 hover:bg-white/5"
                    >
                        Retour tournoi
                    </Link>
                </div>

                {phases.length > 1 && (
                    <div className="flex flex-wrap gap-2">
                        {phases.map((phase) => (
                            <Link
                                key={phase.id}
                                href={`/tournaments/${orgSlug}/${tournament.slug}/bracket/placement?phaseId=${phase.id}`}
                                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${phase.id === currentPhase.id
                                    ? 'border-teal-400 bg-teal-500/15 text-teal-100'
                                    : 'border-slate-600 bg-slate-900/40 text-slate-300 hover:border-slate-400'
                                    }`}
                            >
                                {phase.name}
                            </Link>
                        ))}
                    </div>
                )}

                <PlacementBracketPhaseView
                    tournamentId={tournament.id}
                    orgSlug={orgSlug}
                    tournamentSlug={tournament.slug}
                    phase={{
                        id: currentPhase.id,
                        name: currentPhase.name,
                        type: currentPhase.type,
                        order: currentPhase.order,
                        config: currentPhase.config,
                    }}
                    matches={matches.map((match) => ({
                        id: match.id,
                        roundNumber: match.roundNumber,
                        bracketPos: match.bracketPos,
                        scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
                        pitchName: match.pitch?.name ?? null,
                        status: match.status,
                        homeTeamName: match.homeTeam?.name || 'TBD',
                        awayTeamName: match.awayTeam?.name || 'TBD',
                        homeScore: match.result?.homeScore ?? null,
                        awayScore: match.result?.awayScore ?? null,
                    }))}
                    timer={{
                        timerSeconds: latestLaunchTimerSeconds,
                        timerStartMs: timerStartMs ?? Date.now(),
                        timerMode,
                    }}
                    fullscreen
                    showFullscreenLink={false}
                />
            </div>
        </div>
    )
}
