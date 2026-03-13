import { cache } from 'react'
import { MatchStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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

export type StandingRow = {
    teamId: string
    teamName: string
    played: number
    wins: number
    draws: number
    losses: number
    points: number
    goalsFor: number
    goalsAgainst: number
    goalDiff: number
}

export const getPublicTournamentBySlugs = cache(async (orgSlug: string, tournamentSlug: string) => {
    const tournament = await prisma.tournament.findFirst({
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
            status: true,
            startDate: true,
            endDate: true,
            organization: { select: { id: true, name: true, slug: true } },
            game: { select: { name: true } },
            pitches: { select: { id: true, name: true }, orderBy: { name: 'asc' } },
            phases: {
                select: { id: true, name: true, type: true, order: true, isCompleted: true },
                orderBy: { order: 'asc' },
            },
            registrations: {
                select: {
                    teamId: true,
                    seed: true,
                    isConfirmed: true,
                    team: { select: { id: true, name: true, slug: true } },
                },
                orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }],
            },
        },
    })

    if (!tournament) return null

    const matches = await prisma.match.findMany({
        where: { phase: { tournamentId: tournament.id } },
        include: {
            pitch: { select: { id: true, name: true } },
            phase: { select: { id: true, name: true, type: true } },
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            result: { select: { homeScore: true, awayScore: true, notes: true } },
        },
        orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }, { createdAt: 'desc' }],
    })

    return { tournament, matches }
})

export function computeTournamentStandings(
    registrations: Array<{ teamId: string; team: { id: string; name: string } }>,
    matches: PublicMatch[]
): StandingRow[] {
    const rows = new Map<string, StandingRow>(
        registrations.map((registration) => [
            registration.teamId,
            {
                teamId: registration.team.id,
                teamName: registration.team.name,
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
