import { TournamentStatus } from '@prisma/client'
import type { ActionLogPayload, GroupPlacement, GroupConfig, PlacementRankingMatch, PlacementRankingRow, RouteConfig } from './TournamentTabShell.types'

export function va<T extends (fd: FormData) => Promise<any>>(action: T) {
    return (fd: FormData): void => { void action(fd) }
}

export function readRoutes(config: unknown): RouteConfig[] {
    if (!config || typeof config !== 'object') return []
    const routes = (config as { routes?: unknown }).routes
    if (!Array.isArray(routes)) return []
    return routes.filter((r) => r && typeof r === 'object') as RouteConfig[]
}

export function readParallelGroup(config: unknown) {
    if (!config || typeof config !== 'object') return null
    const raw = (config as { parallelGroup?: unknown }).parallelGroup
    if (typeof raw !== 'string') return null
    const value = raw.trim()
    return value.length > 0 ? value : null
}

export function formatRouteRule(route: RouteConfig) {
    if (route.rule === 'TOP') return `Top ${route.countPerGroup ?? '?'} par poule`
    if (route.rule === 'BOTTOM') return `Bottom ${route.countPerGroup ?? '?'} par poule`
    if (route.rule === 'RANGE') return `Places ${route.startRank ?? '?'} a ${route.endRank ?? '?'}`
    return 'Regle non definie'
}

export function readGroupConfig(config: unknown): GroupConfig {
    if (!config || typeof config !== 'object') return { count: 2, teamsPerGroup: 4, placements: [], preferredPitchIdByGroup: {} }
    const groups = (config as { groups?: unknown }).groups
    if (!groups || typeof groups !== 'object') return { count: 2, teamsPerGroup: 4, placements: [], preferredPitchIdByGroup: {} }
    const raw = groups as { count?: unknown; teamsPerGroup?: unknown; placements?: unknown; preferredPitchIdByGroup?: unknown }
    const count = typeof raw.count === 'number' && raw.count > 0 ? raw.count : 2
    const teamsPerGroup = typeof raw.teamsPerGroup === 'number' && raw.teamsPerGroup > 0 ? raw.teamsPerGroup : 4
    const placements = Array.isArray(raw.placements)
        ? raw.placements.filter(
            (p): p is GroupPlacement =>
                p && typeof p === 'object' &&
                typeof p.teamId === 'string' &&
                typeof p.groupIndex === 'number' &&
                typeof p.slot === 'number'
        )
        : []

    const preferredPitchIdByGroupRaw =
        raw.preferredPitchIdByGroup && typeof raw.preferredPitchIdByGroup === 'object'
            ? (raw.preferredPitchIdByGroup as Record<string, unknown>)
            : {}

    const preferredPitchIdByGroup = Object.fromEntries(
        Object.entries(preferredPitchIdByGroupRaw)
            .filter(([groupIndex, pitchId]) => Number.isInteger(Number(groupIndex)) && Number(groupIndex) > 0 && typeof pitchId === 'string' && pitchId.length > 0)
            .map(([groupIndex, pitchId]) => [Number(groupIndex), pitchId as string])
    ) as Record<number, string>

    return { count, teamsPerGroup, placements, preferredPitchIdByGroup }
}

export function readPlacementLabels(config: unknown): Record<string, string> {
    if (!config || typeof config !== 'object') return {}
    const raw = (config as { placementLabels?: unknown }).placementLabels
    if (!raw || typeof raw !== 'object') return {}

    return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>)
            .filter(([key, value]) => /^\d+-\d+$/.test(key) && typeof value === 'string' && value.trim().length > 0)
            .map(([key, value]) => [key, (value as string).trim()])
    )
}

export function readPlacementRangesFromMatches(matches: Array<{ bracketPos: string | null }>) {
    const ranges = new Set<string>()
    for (const match of matches) {
        const parsed = match.bracketPos?.match(/^P(\d+)-(\d+)-R\d+-M\d+$/)
        if (!parsed) continue
        ranges.add(`${Number(parsed[1])}-${Number(parsed[2])}`)
    }

    return Array.from(ranges)
        .map((rangeKey) => {
            const [start, end] = rangeKey.split('-').map(Number)
            return { key: rangeKey, start, end, size: end - start + 1 }
        })
        .sort((a, b) => b.size - a.size || a.start - b.start)
}

export function defaultPlacementLabel(start: number, end: number) {
    return start === end ? `Place ${start}` : `Place ${start} a ${end}`
}

export function readPlacementRankingSegments(config: unknown): Array<{ start: number; end: number; label: string }> {
    if (!config || typeof config !== 'object') return []
    const raw = (config as { placementRankingSegments?: unknown }).placementRankingSegments
    if (!Array.isArray(raw)) return []

    return raw
        .map((item) => {
            if (!item || typeof item !== 'object') return null
            const entry = item as Record<string, unknown>
            const start = typeof entry.start === 'number' ? entry.start : Number.NaN
            const end = typeof entry.end === 'number' ? entry.end : Number.NaN
            const label = typeof entry.label === 'string' ? entry.label.trim() : ''
            if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) return null
            return { start, end, label: label || `${start}-${end}` }
        })
        .filter((item): item is { start: number; end: number; label: string } => Boolean(item))
        .sort((a, b) => a.start - b.start || a.end - b.end)
}

export function parseWbBracketPos(bracketPos: string | null) {
    if (!bracketPos) return null
    const parsed = bracketPos.match(/^WB-R(\d+)-M(\d+)$/)
    if (!parsed) return null
    const round = Number(parsed[1])
    const matchNo = Number(parsed[2])
    if (!Number.isInteger(round) || !Number.isInteger(matchNo) || round < 1 || matchNo < 1) return null
    return { round, matchNo }
}

export function parsePlacementBracketPos(bracketPos: string | null) {
    if (!bracketPos) return null
    const parsed = bracketPos.match(/^P(\d+)-(\d+)-R(\d+)-M(\d+)$/)
    if (!parsed) return null
    const start = Number(parsed[1])
    const end = Number(parsed[2])
    const round = Number(parsed[3])
    const matchNo = Number(parsed[4])
    if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(round) || !Number.isInteger(matchNo)) return null
    return { start, end, round, matchNo, size: end - start + 1 }
}

export function winnerAndLoser(match: PlacementRankingMatch) {
    if (match.status !== 'FINISHED' || match.homeScore === null || match.awayScore === null) return null
    if (!match.homeTeamId || !match.awayTeamId) return null

    if (match.homeScore >= match.awayScore) {
        return {
            winner: { id: match.homeTeamId, name: match.homeTeamName || 'Equipe' },
            loser: { id: match.awayTeamId, name: match.awayTeamName || 'Equipe' },
        }
    }

    return {
        winner: { id: match.awayTeamId, name: match.awayTeamName || 'Equipe' },
        loser: { id: match.homeTeamId, name: match.homeTeamName || 'Equipe' },
    }
}

export function computePlacementPhaseRanking(matches: PlacementRankingMatch[]): PlacementRankingRow[] {
    const byRank = new Map<number, PlacementRankingRow>()

    const wbMatches = matches
        .map((match) => ({ match, parsed: parseWbBracketPos(match.bracketPos) }))
        .filter((item): item is { match: PlacementRankingMatch; parsed: { round: number; matchNo: number } } => Boolean(item.parsed))

    const maxWbRound = wbMatches.reduce((max, item) => Math.max(max, item.parsed.round), 0)
    if (maxWbRound > 0) {
        const finalWb = wbMatches.find((item) => item.parsed.round === maxWbRound && item.parsed.matchNo === 1)
        if (finalWb) {
            const result = winnerAndLoser(finalWb.match)
            if (result) {
                byRank.set(1, { rank: 1, teamName: result.winner.name, teamId: result.winner.id, source: 'Finale WB' })
                byRank.set(2, { rank: 2, teamName: result.loser.name, teamId: result.loser.id, source: 'Finale WB' })
            }
        }
    }

    const placementMatches = matches
        .map((match) => ({ match, parsed: parsePlacementBracketPos(match.bracketPos) }))
        .filter((item): item is { match: PlacementRankingMatch; parsed: { start: number; end: number; round: number; matchNo: number; size: number } } => Boolean(item.parsed))

    const groupedByRange = new Map<string, Array<{ match: PlacementRankingMatch; parsed: { start: number; end: number; round: number; matchNo: number; size: number } }>>()
    for (const item of placementMatches) {
        const key = `${item.parsed.start}-${item.parsed.end}`
        if (!groupedByRange.has(key)) groupedByRange.set(key, [])
        groupedByRange.get(key)!.push(item)
    }

    for (const rangeItems of groupedByRange.values()) {
        const sample = rangeItems[0]
        if (sample.parsed.size !== 2) continue

        const finalRound = rangeItems.reduce((max, item) => Math.max(max, item.parsed.round), 0)
        const finalMatch = rangeItems
            .filter((item) => item.parsed.round === finalRound)
            .sort((a, b) => a.parsed.matchNo - b.parsed.matchNo)[0]

        if (!finalMatch) continue
        const result = winnerAndLoser(finalMatch.match)
        if (!result) continue

        byRank.set(sample.parsed.start, {
            rank: sample.parsed.start,
            teamName: result.winner.name,
            teamId: result.winner.id,
            source: `Match de place ${sample.parsed.start}-${sample.parsed.end}`,
        })
        byRank.set(sample.parsed.end, {
            rank: sample.parsed.end,
            teamName: result.loser.name,
            teamId: result.loser.id,
            source: `Match de place ${sample.parsed.start}-${sample.parsed.end}`,
        })
    }

    return Array.from(byRank.values()).sort((a, b) => a.rank - b.rank)
}

export function formatPhaseType(type: string) {
    if (type === 'GROUP') return 'Poules'
    if (type === 'BRACKET_SINGLE') return 'Bracket simple'
    if (type === 'BRACKET_DOUBLE') return 'Bracket double'
    if (type === 'PLACEMENT_BRACKET') return 'Bracket de placement'
    if (type === 'ROUND_SWISS') return 'Swiss'
    return 'Personnalisee'
}

export function comparePitchNames(a: string, b: string) {
    return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
}

export function readGroupIndexFromBracketPos(bracketPos: string | null) {
    if (!bracketPos) return null
    const match = bracketPos.match(/^G(\d+)-/)
    if (!match) return null
    const groupIndex = Number(match[1])
    return Number.isInteger(groupIndex) && groupIndex > 0 ? groupIndex : null
}

export function formatMatchGroupLabel(phaseType: string | undefined, bracketPos: string | null) {
    if (phaseType !== 'GROUP') return null
    const groupIndex = readGroupIndexFromBracketPos(bracketPos)
    return groupIndex ? `Poule ${groupIndex}` : 'Poule'
}

export function readPlanningDefaultsFromLogs(logs: Array<{ actionType: string; payload?: unknown }>) {
    const MIN_MATCH_MINUTES = 5
    const MAX_MATCH_MINUTES = 600
    const MIN_BREAK_MINUTES = 0
    const MAX_BREAK_MINUTES = 240

    for (const log of logs) {
        const payload = (log.payload && typeof log.payload === 'object' ? log.payload : null) as ActionLogPayload | null
        if (!payload) continue

        const rawMatch = typeof payload.maxDurationMinutes === 'number' ? payload.maxDurationMinutes : null
        const rawBreak = typeof payload.teamBreakMinutes === 'number' ? payload.teamBreakMinutes : null
        if (rawMatch === null || rawBreak === null) continue

        return {
            matchMinutes: Math.min(MAX_MATCH_MINUTES, Math.max(MIN_MATCH_MINUTES, Math.round(rawMatch))),
            breakMinutes: Math.min(MAX_BREAK_MINUTES, Math.max(MIN_BREAK_MINUTES, Math.round(rawBreak))),
        }
    }

    return {
        matchMinutes: 30,
        breakMinutes: 10,
    }
}

export function isTournamentStatus(value: string): value is TournamentStatus {
    return value in STATUS_META
}

export const STATUS_META: Record<TournamentStatus, { label: string; cls: string }> = {
    DRAFT: {
        label: 'Brouillon',
        cls: 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
    },
    REGISTRATION: {
        label: 'Inscriptions ouvertes',
        cls: 'bg-blue-600/20 text-blue-200 border border-blue-500/30'
    },
    ONGOING: {
        label: 'En cours',
        cls: 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/30'
    },
    FINISHED: {
        label: 'Terminé',
        cls: 'bg-purple-600/20 text-purple-200 border border-purple-500/30'
    },
    CANCELLED: {
        label: 'Annulé',
        cls: 'bg-red-600/20 text-red-200 border border-red-500/30'
    },
};

export function computeGroupStandings(
    groupIndex: number,
    groupConfig: GroupConfig,
    phaseId: string,
    matches: any[],
    teamNameById: Map<string, string>
) {
    const teamIds = groupConfig.placements
        .filter((p) => p.groupIndex === groupIndex)
        .sort((a, b) => a.slot - b.slot)
        .map((p) => p.teamId)
    const uniqueTeamIds = [...new Set(teamIds)]

    const rows = new Map<string, any>(
        uniqueTeamIds.map((id) => [id, {
            teamId: id, teamName: teamNameById.get(id) ?? 'Equipe',
            played: 0, wins: 0, draws: 0, losses: 0,
            goalsFor: 0, goalsAgainst: 0, goalDiff: 0, points: 0,
        }])
    )
    const teamSet = new Set(uniqueTeamIds)

    for (const match of matches) {
        if (match.phaseId !== phaseId || !match.result || !match.homeTeamId || !match.awayTeamId) continue
        if (!teamSet.has(match.homeTeamId) || !teamSet.has(match.awayTeamId)) continue
        const home = rows.get(match.homeTeamId)
        const away = rows.get(match.awayTeamId)
        if (!home || !away) continue
        const hs = match.result.homeScore
        const as_ = match.result.awayScore
        home.played++; away.played++
        home.goalsFor += hs; home.goalsAgainst += as_
        away.goalsFor += as_; away.goalsAgainst += hs
        if (hs > as_) { home.wins++; away.losses++; home.points += 3 }
        else if (hs < as_) { away.wins++; home.losses++; away.points += 3 }
        else { home.draws++; away.draws++; home.points++; away.points++ }
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

export function computeGlobalGroupPhaseStandings(
    groupConfig: GroupConfig,
    phaseId: string,
    matches: any[],
    teamNameById: Map<string, string>
) {
    const rowsByTeam = new Map<string, any>()

    const placements = [...groupConfig.placements]
        .sort((a, b) => a.groupIndex - b.groupIndex || a.slot - b.slot)

    for (const placement of placements) {
        if (rowsByTeam.has(placement.teamId)) continue
        rowsByTeam.set(placement.teamId, {
            teamId: placement.teamId,
            teamName: teamNameById.get(placement.teamId) ?? 'Equipe',
            groupIndex: placement.groupIndex,
            played: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDiff: 0,
            points: 0,
        })
    }

    for (const match of matches) {
        if (match.phaseId !== phaseId || !match.result || !match.homeTeamId || !match.awayTeamId) continue
        const home = rowsByTeam.get(match.homeTeamId)
        const away = rowsByTeam.get(match.awayTeamId)
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
        } else if (hs < as_) {
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

    return Array.from(rowsByTeam.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff
        if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor
        const aGroup = a.groupIndex ?? 999
        const bGroup = b.groupIndex ?? 999
        if (aGroup !== bGroup) return aGroup - bGroup
        return a.teamName.localeCompare(b.teamName)
    })
}
