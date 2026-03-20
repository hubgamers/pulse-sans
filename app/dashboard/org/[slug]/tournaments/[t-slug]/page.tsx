import { notFound } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organization/organization.queries'
import { prisma } from '@/lib/prisma'
import TournamentTabShell from '@/components/dashboard/tournaments/TournamentTabShell'

export default async function DashboardOrgTournamentDetails({
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
            game: true,
            phases: {
                orderBy: { order: 'asc' },
            },
            pitches: {
                include: { phase: { select: { id: true, name: true } } },
                orderBy: { name: 'asc' },
            },
            registrations: {
                include: {
                    team: { select: { id: true, name: true, slug: true } },
                },
                orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }],
            },
            organization: {
                select: {
                    teams: {
                        select: { id: true, name: true, slug: true },
                        orderBy: { name: 'asc' },
                    },
                },
            },
            _count: {
                select: { registrations: true },
            },
            actionLogs: {
                orderBy: { createdAt: 'desc' },
                take: 60,
                select: {
                    id: true,
                    actionType: true,
                    message: true,
                    actorName: true,
                    createdAt: true,
                },
            },
        },
    })

    if (!tournament) {
        notFound()
    }

    const matches = await prisma.match.findMany({
        where: {
            phase: {
                tournamentId: tournament.id,
            },
        },
        include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            pitch: { select: { id: true, name: true } },
            phase: { select: { id: true, name: true } },
            result: true,
        },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'desc' }],
    })

    const registeredTeamIds = new Set(tournament.registrations.map((r) => r.teamId))
    const availableTeamsForRegistration = tournament.organization.teams.filter((t) => !registeredTeamIds.has(t.id))

    return (
        <div className="text-slate-900">
            <TournamentTabShell
                orgSlug={slug}
                tournament={{
                    id: tournament.id,
                    name: tournament.name,
                    slug: tournament.slug,
                    description: tournament.description,
                    status: tournament.status,
                    isPublic: tournament.isPublic,
                    maxTeams: tournament.maxTeams,
                    game: { name: tournament.game.name },
                    phases: tournament.phases.map((p) => ({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        order: p.order,
                        isCompleted: p.isCompleted,
                        config: p.config,
                    })),
                    pitches: tournament.pitches.map((p) => ({
                        id: p.id,
                        name: p.name,
                        phase: p.phase,
                    })),
                    registrations: tournament.registrations.map((r) => ({
                        id: r.id,
                        teamId: r.teamId,
                        seed: r.seed,
                        isConfirmed: r.isConfirmed,
                        team: r.team,
                    })),
                    actionLogs: tournament.actionLogs.map((log) => ({
                        id: log.id,
                        actionType: log.actionType,
                        message: log.message,
                        actorName: log.actorName,
                        createdAt: log.createdAt.toISOString(),
                    })),
                    _count: tournament._count,
                }}
                availableTeams={availableTeamsForRegistration}
                matches={matches.map((m) => ({
                    id: m.id,
                    status: m.status,
                    phaseId: m.phaseId,
                    homeTeamId: m.homeTeamId,
                    awayTeamId: m.awayTeamId,
                    roundNumber: m.roundNumber,
                    bracketPos: m.bracketPos,
                    scheduledAt: m.scheduledAt?.toISOString() ?? null,
                    homeTeam: m.homeTeam,
                    awayTeam: m.awayTeam,
                    pitch: m.pitch,
                    phase: m.phase,
                    result: m.result
                        ? {
                              homeScore: m.result.homeScore,
                              awayScore: m.result.awayScore,
                              notes: m.result.notes,
                          }
                        : null,
                }))}
            />
        </div>
    )
}
