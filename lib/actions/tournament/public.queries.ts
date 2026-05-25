import { cache } from 'react'
import { MatchStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

function comparePitchNames(a: string, b: string) {
    return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
}

export type PublicMatch = {
    id: string
    status: MatchStatus
    scheduledAt: Date | null
    playedAt: Date | null
    roundNumber: number | null
    bracketPos: string | null
    pitch: { id: string; name: string }
    phase: { id: string; name: string; type: string }
    homeTeam: { id: string; name: string } | null
    awayTeam: { id: string; name: string } | null
    result: { homeScore: number; awayScore: number; notes: string | null } | null
}

export type PublicTournamentPhase = {
    id: string
    name: string
    type: string
    order: number
    isCompleted: boolean
    config: unknown
}

export type StandingRow = {
    teamId: string
    teamName: string
    teamLogoUrl: string | null
    played: number
    wins: number
    draws: number
    losses: number
    points: number
    goalsFor: number
    goalsAgainst: number
    goalDiff: number
}

export type PublicGroupOverview = {
    phaseId: string
    phaseName: string
    groups: Array<{
        groupIndex: number
        standings: StandingRow[]
        featuredMatches: PublicMatch[]
    }>
}

type GroupPlacement = {
    teamId: string
    groupIndex: number
    slot: number
}

type GroupConfig = {
    count: number
    teamsPerGroup: number
    placements: GroupPlacement[]
}

function readGroupConfig(config: unknown): GroupConfig {
    if (!config || typeof config !== 'object') return { count: 2, teamsPerGroup: 4, placements: [] }

    const groups = (config as { groups?: unknown }).groups
    if (!groups || typeof groups !== 'object') return { count: 2, teamsPerGroup: 4, placements: [] }

    const raw = groups as { count?: unknown; teamsPerGroup?: unknown; placements?: unknown }
    const count = typeof raw.count === 'number' && raw.count > 0 ? raw.count : 2
    const teamsPerGroup = typeof raw.teamsPerGroup === 'number' && raw.teamsPerGroup > 0 ? raw.teamsPerGroup : 4
    const placements = Array.isArray(raw.placements)
        ? raw.placements.filter(
            (placement): placement is GroupPlacement =>
                Boolean(placement) &&
                typeof placement === 'object' &&
                typeof placement.teamId === 'string' &&
                typeof placement.groupIndex === 'number' &&
                typeof placement.slot === 'number'
        )
        : []

    return { count, teamsPerGroup, placements }
}

function compareFeaturedGroupMatches(a: PublicMatch, b: PublicMatch) {
    const priority = (status: MatchStatus) => {
        if (status === MatchStatus.LIVE) return 0
        if (status === MatchStatus.SCHEDULED) return 1
        if (status === MatchStatus.FINISHED) return 2
        return 3
    }

    const aPriority = priority(a.status)
    const bPriority = priority(b.status)
    if (aPriority !== bPriority) return aPriority - bPriority

    if (a.status === MatchStatus.FINISHED && b.status === MatchStatus.FINISHED) {
        const aTime = a.playedAt?.getTime() ?? a.scheduledAt?.getTime() ?? 0
        const bTime = b.playedAt?.getTime() ?? b.scheduledAt?.getTime() ?? 0
        if (aTime !== bTime) return bTime - aTime
    } else {
        const aTime = a.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        const bTime = b.scheduledAt?.getTime() ?? Number.MAX_SAFE_INTEGER
        if (aTime !== bTime) return aTime - bTime
    }

    return a.pitch.name.localeCompare(b.pitch.name, 'fr', { numeric: true, sensitivity: 'base' })
}

export const getPublicTournamentBySlugs = cache(async (orgSlug: string, tournamentSlug: string) => {
    const [tournament, matches] = await Promise.all([
        prisma.tournament.findFirst({
            where: {
                slug: tournamentSlug,
                isPublic: true,
                organization: { slug: orgSlug },
            },
            select: {
                id: true,
                name: true,
                slug: true,
                description: true,
                bannerUrl: true,
                status: true,
                startDate: true,
                endDate: true,
                organization: { select: { id: true, name: true, slug: true } },
                game: { select: { name: true } },
                pitches: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
                phases: {
                    select: { id: true, name: true, type: true, order: true, isCompleted: true, config: true },
                    orderBy: { order: 'asc' },
                },
                registrations: {
                    select: {
                        teamId: true,
                        seed: true,
                        isConfirmed: true,
                        team: { select: { id: true, name: true, slug: true, logoUrl: true } },
                    },
                    orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }],
                },
                actionLogs: {
                    select: {
                        actionType: true,
                        payload: true,
                        createdAt: true,
                    },
                    orderBy: { createdAt: 'desc' },
                    take: 30,
                },
            },
        }),
        prisma.match.findMany({
            where: {
                phase: {
                    tournament: {
                        slug: tournamentSlug,
                        isPublic: true,
                        organization: { slug: orgSlug },
                    },
                },
            },
            include: {
                pitch: { select: { id: true, name: true } },
                phase: { select: { id: true, name: true, type: true } },
                homeTeam: { select: { id: true, name: true } },
                awayTeam: { select: { id: true, name: true } },
                result: { select: { homeScore: true, awayScore: true, notes: true } },
            },
            orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'desc' }],
        }),
    ])

    if (!tournament) return null

    const sponsorRows = await prisma.$queryRaw<Array<{ sponsor_config: Prisma.JsonValue | null }>>`
        SELECT "sponsor_config"
        FROM "public"."tournaments"
        WHERE "id" = ${tournament.id}
        LIMIT 1
    `

    const sortedTournament = {
        ...tournament,
        sponsorConfig: sponsorRows[0]?.sponsor_config ?? null,
        pitches: [...tournament.pitches].sort((a, b) => comparePitchNames(a.name, b.name)),
    }

    return { tournament: sortedTournament, matches }
})

export function computeTournamentStandings(
    registrations: Array<{ teamId: string; team: { id: string; name: string; logoUrl?: string | null } }> ,
    matches: PublicMatch[]
): StandingRow[] {
    const rows = new Map<string, StandingRow>(
        registrations.map((registration) => [
            registration.teamId,
            {
                teamId: registration.team.id,
                teamName: registration.team.name,
                teamLogoUrl: registration.team.logoUrl ?? null,
                played: 0,
                wins: 0,
                draws: 0,
                losses: 0,
                points: 0,
                goalsFor: 0,
                goalsAgainst: 0,
                goalDiff: 0,
            },
        ])
    )

    for (const match of matches) {
        if (!match.result || !match.homeTeam || !match.awayTeam) continue

        const home = rows.get(match.homeTeam.id)
        const away = rows.get(match.awayTeam.id)
        if (!home || !away) continue

        const hs = match.result.homeScore
        const as_ = match.result.awayScore

        home.played += 1
        away.played += 1
        home.goalsFor += hs
        home.goalsAgainst += as_
        away.goalsFor += as_
        away.goalsAgainst += hs

        if (hs > as_) {
            home.wins += 1
            away.losses += 1
            home.points += 3
        } else if (as_ > hs) {
            away.wins += 1
            home.losses += 1
            away.points += 3
        } else {
            home.draws += 1
            away.draws += 1
            home.points += 1
            away.points += 1
        }

        home.goalDiff = home.goalsFor - home.goalsAgainst
        away.goalDiff = away.goalsFor - away.goalsAgainst
    }

    return Array.from(rows.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
        return a.teamName.localeCompare(b.teamName)
    })
}

export function formatMatchDateLabel(date: Date | null) {
    if (!date) return 'Non planifie'
    return new Intl.DateTimeFormat('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

export function formatMatchTimeLabel(date: Date | null) {
    if (!date) return '--:--'
    return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date)
}

export function computeGroupOverviews(
    registrations: Array<{ teamId: string; team: { id: string; name: string; logoUrl?: string | null } }> ,
    phases: PublicTournamentPhase[],
    matches: PublicMatch[]
): PublicGroupOverview[] {
    const teamById = new Map(
        registrations.map((registration) => [
            registration.teamId,
            { name: registration.team.name, logoUrl: registration.team.logoUrl ?? null },
        ])
    )

    return phases
        .filter((phase) => phase.type === 'GROUP')
        .map((phase) => {
            const groupConfig = readGroupConfig(phase.config)

            const groups = Array.from({ length: groupConfig.count }, (_, index) => {
                const groupIndex = index + 1
                const teamIds = groupConfig.placements
                    .filter((placement) => placement.groupIndex === groupIndex)
                    .sort((a, b) => a.slot - b.slot)
                    .map((placement) => placement.teamId)
                const uniqueTeamIds = [...new Set(teamIds)]
                const rows = new Map<string, StandingRow>(
                    uniqueTeamIds.map((teamId) => [
                        teamId,
                        {
                            teamId,
                            teamName: teamById.get(teamId)?.name ?? 'Equipe',
                            teamLogoUrl: teamById.get(teamId)?.logoUrl ?? null,
                            played: 0,
                            wins: 0,
                            draws: 0,
                            losses: 0,
                            points: 0,
                            goalsFor: 0,
                            goalsAgainst: 0,
                            goalDiff: 0,
                        },
                    ])
                )
                const teamSet = new Set(uniqueTeamIds)

                for (const match of matches) {
                    if (match.phase.id !== phase.id || !match.result || !match.homeTeam || !match.awayTeam) continue
                    if (!teamSet.has(match.homeTeam.id) || !teamSet.has(match.awayTeam.id)) continue

                    const home = rows.get(match.homeTeam.id)
                    const away = rows.get(match.awayTeam.id)
                    if (!home || !away) continue

                    const homeScore = match.result.homeScore
                    const awayScore = match.result.awayScore

                    home.played += 1
                    away.played += 1
                    home.goalsFor += homeScore
                    home.goalsAgainst += awayScore
                    away.goalsFor += awayScore
                    away.goalsAgainst += homeScore

                    if (homeScore > awayScore) {
                        home.wins += 1
                        away.losses += 1
                        home.points += 3
                    } else if (awayScore > homeScore) {
                        away.wins += 1
                        home.losses += 1
                        away.points += 3
                    } else {
                        home.draws += 1
                        away.draws += 1
                        home.points += 1
                        away.points += 1
                    }

                    home.goalDiff = home.goalsFor - home.goalsAgainst
                    away.goalDiff = away.goalsFor - away.goalsAgainst
                }

                const standings = Array.from(rows.values()).sort((a, b) => {
                    if (b.points !== a.points) return b.points - a.points
                    if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
                    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
                    return a.teamName.localeCompare(b.teamName, 'fr', { sensitivity: 'base' })
                })

                const featuredMatches = matches
                    .filter((match) => {
                        if (match.phase.id !== phase.id) return false
                        if (match.status === MatchStatus.CANCELLED) return false
                        if (!match.homeTeam || !match.awayTeam) return false
                        return teamSet.has(match.homeTeam.id) && teamSet.has(match.awayTeam.id)
                    })
                    .sort(compareFeaturedGroupMatches)
                    .slice(0, 6)

                return {
                    groupIndex,
                    standings,
                    featuredMatches,
                }
            }).filter((group) => group.standings.length > 0 || group.featuredMatches.length > 0)

            return {
                phaseId: phase.id,
                phaseName: phase.name,
                groups,
            }
        })
        .filter((phase) => phase.groups.length > 0)
}
