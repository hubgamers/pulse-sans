import { notFound } from 'next/navigation'
import { Prisma } from '@prisma/client'
import { getOrganizationBySlug } from '@/lib/actions/organization/organization.queries'
import { prisma } from '@/lib/prisma'
import TournamentTabShell from '@/components/dashboard/tournaments/TournamentTabShell'

function comparePitchNames(a: string, b: string) {
    return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
}

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

    const orgSlug = org.slug

    const [tournament, matches] = await Promise.all([
        prisma.tournament.findFirst({
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
                        payload: true,
                        createdAt: true,
                    },
                },
            },
        }),
        prisma.match.findMany({
            where: {
                phase: {
                    tournament: {
                        organizationId: org.id,
                        slug: tournamentSlug,
                    },
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
        }),
    ])

    if (!tournament) {
        notFound()
    }

    const sponsorRows = await prisma.$queryRaw<Array<{ sponsor_config: Prisma.JsonValue | null }>>`
        SELECT "sponsor_config"
        FROM "public"."tournaments"
        WHERE "id" = ${tournament.id}
        LIMIT 1
    `
    const sponsorConfig = sponsorRows[0]?.sponsor_config ?? null

    const sortedPitches = [...tournament.pitches].sort((a, b) => comparePitchNames(a.name, b.name))

    const registeredTeamIds = new Set(tournament.registrations.map((r) => r.teamId))
    const availableTeamsForRegistration = tournament.organization.teams.filter((t) => !registeredTeamIds.has(t.id))

    return (
        <div className="text-slate-900">
            <TournamentTabShell
                orgSlug={orgSlug}
                tournament={{
                    id: tournament.id,
                    name: tournament.name,
                    slug: tournament.slug,
                    description: tournament.description,
                    bannerUrl: tournament.bannerUrl,
                    sponsorConfig,
                    status: tournament.status,
                    isPublic: tournament.isPublic,
                    tabletRequiresReferee: tournament.tabletRequiresReferee,
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
                    pitches: sortedPitches.map((p) => ({
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
                        payload: log.payload,
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
