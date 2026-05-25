'use client'

import { useCallback, useMemo } from 'react'
import type { TimerLogPayload, PhaseData, SerializedMatch, TournamentData } from './TournamentTabShell.types'
import {
    comparePitchNames,
    computeGlobalGroupPhaseStandings,
    computeGroupStandings,
    formatMatchGroupLabel,
    readGroupConfig,
    readParallelGroup,
    readRoutes,
} from './TournamentTabShell.utils'

const BRACKET_PHASE_TYPES = ['BRACKET_SINGLE', 'BRACKET_DOUBLE', 'PLACEMENT_BRACKET', 'CUSTOM']

export function useTournamentPhaseCollections(tournament: TournamentData, matches: SerializedMatch[]) {
    const bracketPhases = useMemo(
        () => tournament.phases.filter((phase) => BRACKET_PHASE_TYPES.includes(phase.type)),
        [tournament.phases]
    )
    const groupPhases = useMemo(
        () => tournament.phases.filter((phase) => phase.type === 'GROUP'),
        [tournament.phases]
    )

    const bracketParallelGroups = useMemo(() => {
        const grouped = new Map<string, PhaseData[]>()

        for (const phase of bracketPhases) {
            const group = readParallelGroup(phase.config)
            if (!group) continue
            const bucket = grouped.get(group) ?? []
            bucket.push(phase)
            grouped.set(group, bucket)
        }

        return Array.from(grouped.entries())
            .map(([group, phases]) => {
                const sorted = [...phases].sort((a, b) => a.order - b.order)
                return {
                    key: `group:${group}`,
                    group,
                    phases: sorted,
                    leaderPhase: sorted[0],
                }
            })
            .filter((item): item is { key: string; group: string; phases: PhaseData[]; leaderPhase: PhaseData } => Boolean(item.leaderPhase))
            .sort((a, b) => a.leaderPhase.order - b.leaderPhase.order)
    }, [bracketPhases])

    const bracketSubTabKeys = useMemo(() => {
        const phaseKeys = bracketPhases.map((phase) => phase.id)
        const groupKeys = bracketParallelGroups.map((group) => group.key)
        return [...phaseKeys, ...groupKeys]
    }, [bracketParallelGroups, bracketPhases])

    const pitchGroups = useMemo(() => {
        const grouped = new Map<string, {
            name: string
            pitchIds: string[]
            hasGlobal: boolean
            phaseNames: string[]
        }>()

        for (const pitch of tournament.pitches) {
            const key = pitch.name.trim().toLowerCase()
            const existing = grouped.get(key)
            if (existing) {
                existing.pitchIds.push(pitch.id)
                if (!pitch.phase) {
                    existing.hasGlobal = true
                } else if (!existing.phaseNames.includes(pitch.phase.name)) {
                    existing.phaseNames.push(pitch.phase.name)
                }
                continue
            }

            grouped.set(key, {
                name: pitch.name,
                pitchIds: [pitch.id],
                hasGlobal: !pitch.phase,
                phaseNames: pitch.phase ? [pitch.phase.name] : [],
            })
        }

        return [...grouped.values()]
            .map((group) => ({
                ...group,
                phaseNames: [...group.phaseNames].sort((a, b) => a.localeCompare(b)),
            }))
            .sort((a, b) => a.name.localeCompare(b.name))
    }, [tournament.pitches])

    const matchesByPhase = useMemo(() => {
        const map = new Map<string, { total: number; finished: number }>()
        for (const phase of tournament.phases) {
            const phaseMatches = matches.filter((match) => match.phaseId === phase.id)
            map.set(phase.id, {
                total: phaseMatches.length,
                finished: phaseMatches.filter((match) => match.status === 'FINISHED').length,
            })
        }
        return map
    }, [matches, tournament.phases])

    const teamNameById = useMemo(
        () => new Map(tournament.registrations.map((registration) => [registration.teamId, registration.team.name])),
        [tournament.registrations]
    )

    const phaseTypeById = useMemo(
        () => new Map(tournament.phases.map((phase) => [phase.id, phase.type])),
        [tournament.phases]
    )
    const getMatchGroupLabel = useCallback(
        (match: SerializedMatch) => formatMatchGroupLabel(phaseTypeById.get(match.phaseId), match.bracketPos),
        [phaseTypeById]
    )

    return {
        bracketPhases,
        groupPhases,
        bracketParallelGroups,
        bracketSubTabKeys,
        pitchGroups,
        matchesByPhase,
        teamNameById,
        getMatchGroupLabel,
    }
}

export function useTournamentQualifiers(
    tournament: TournamentData,
    matches: SerializedMatch[],
    teamNameById: Map<string, string>
) {
    const seededTeamsByPhase = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const phase of tournament.phases) {
            let ids: string[] = []

            if (phase.type === 'GROUP') {
                ids = readGroupConfig(phase.config).placements.map((placement) => placement.teamId)
            } else if (BRACKET_PHASE_TYPES.includes(phase.type)) {
                ids = matches
                    .filter((match) => match.phaseId === phase.id && match.roundNumber === 1)
                    .flatMap((match) => [match.homeTeamId, match.awayTeamId])
                    .filter((id): id is string => Boolean(id))
            } else {
                ids = matches
                    .filter((match) => match.phaseId === phase.id)
                    .flatMap((match) => [match.homeTeamId, match.awayTeamId])
                    .filter((id): id is string => Boolean(id))
            }

            map.set(phase.id, [...new Set(ids)])
        }
        return map
    }, [matches, tournament.phases])

    const incomingQualifiersByPhase = useMemo(() => {
        const map = new Map<string, string[]>()

        for (const sourcePhase of tournament.phases) {
            if (!sourcePhase.isCompleted) continue

            const routes = readRoutes(sourcePhase.config)
                .filter((route) => typeof route.toPhaseId === 'string' && route.toPhaseId)

            if (routes.length === 0) continue

            let orderedQualifiedIds: string[] = []

            if (sourcePhase.type === 'GROUP') {
                const groupConfig = readGroupConfig(sourcePhase.config)
                const standingsByGroup = Array.from({ length: groupConfig.count }, (_, idx) => {
                    const groupIndex = idx + 1
                    return computeGroupStandings(groupIndex, groupConfig, sourcePhase.id, matches, teamNameById)
                        .map((row) => row.teamId)
                })

                for (const route of routes) {
                    const routeIds: string[] = []
                    if (route.rule === 'TOP' && route.countPerGroup) {
                        for (let rank = 0; rank < route.countPerGroup; rank += 1) {
                            for (const groupRows of standingsByGroup) {
                                const teamId = groupRows[rank]
                                if (teamId) routeIds.push(teamId)
                            }
                        }
                    } else if (route.rule === 'BOTTOM' && route.countPerGroup) {
                        for (let rank = 0; rank < route.countPerGroup; rank += 1) {
                            for (const groupRows of standingsByGroup) {
                                const idx = groupRows.length - 1 - rank
                                const teamId = idx >= 0 ? groupRows[idx] : undefined
                                if (teamId) routeIds.push(teamId)
                            }
                        }
                    } else if (route.rule === 'RANGE' && route.startRank && route.endRank) {
                        for (let rank = route.startRank - 1; rank < route.endRank; rank += 1) {
                            for (const groupRows of standingsByGroup) {
                                const teamId = groupRows[rank]
                                if (teamId) routeIds.push(teamId)
                            }
                        }
                    }

                    if (route.toPhaseId) {
                        const existing = map.get(route.toPhaseId) ?? []
                        map.set(route.toPhaseId, [...new Set([...existing, ...routeIds])])
                    }

                    orderedQualifiedIds = [...new Set([...orderedQualifiedIds, ...routeIds])]
                }
            } else {
                const winners = matches
                    .filter((match) => match.phaseId === sourcePhase.id && match.status === 'FINISHED' && Boolean(match.result))
                    .sort((a, b) => {
                        const roundA = a.roundNumber ?? 0
                        const roundB = b.roundNumber ?? 0
                        if (roundA !== roundB) return roundB - roundA
                        return (a.bracketPos ?? '').localeCompare(b.bracketPos ?? '')
                    })
                    .map((match) => {
                        if (!match.result || !match.homeTeamId || !match.awayTeamId) return null
                        return match.result.homeScore >= match.result.awayScore ? match.homeTeamId : match.awayTeamId
                    })
                    .filter((id): id is string => Boolean(id))

                orderedQualifiedIds = [...new Set(winners)]

                for (const route of routes) {
                    if (!route.toPhaseId) continue
                    const existing = map.get(route.toPhaseId) ?? []
                    map.set(route.toPhaseId, [...new Set([...existing, ...orderedQualifiedIds])])
                }
            }
        }

        return map
    }, [matches, teamNameById, tournament.phases])

    const pendingQualifierPhases = useMemo(() => {
        const items: Array<{ phaseId: string; phaseName: string; pending: number }> = []

        for (const phase of tournament.phases) {
            const incoming = incomingQualifiersByPhase.get(phase.id) ?? []
            const seededCount = (seededTeamsByPhase.get(phase.id) ?? []).length
            const pending = Math.max(0, incoming.length - seededCount)
            if (pending > 0) {
                items.push({
                    phaseId: phase.id,
                    phaseName: phase.name,
                    pending,
                })
            }
        }

        return items
    }, [incomingQualifiersByPhase, seededTeamsByPhase, tournament.phases])

    const expectedIncomingQualifierCountByPhase = useMemo(() => {
        const map = new Map<string, number>()

        for (const targetPhase of tournament.phases) {
            let total = 0

            for (const sourcePhase of tournament.phases) {
                const routes = readRoutes(sourcePhase.config).filter((route) => route.toPhaseId === targetPhase.id)
                if (routes.length === 0 || sourcePhase.type !== 'GROUP') continue

                const groupConfig = readGroupConfig(sourcePhase.config)
                for (const route of routes) {
                    if ((route.rule === 'TOP' || route.rule === 'BOTTOM') && route.countPerGroup) {
                        total += groupConfig.count * route.countPerGroup
                    } else if (route.rule === 'RANGE' && route.startRank && route.endRank && route.endRank >= route.startRank) {
                        total += groupConfig.count * (route.endRank - route.startRank + 1)
                    }
                }
            }

            map.set(targetPhase.id, total)
        }

        return map
    }, [tournament.phases])

    return {
        seededTeamsByPhase,
        incomingQualifiersByPhase,
        pendingQualifierPhases,
        expectedIncomingQualifierCountByPhase,
    }
}

export function useTournamentScheduling(tournament: TournamentData, matches: SerializedMatch[]) {
    const scheduleByPitch = useMemo(() => {
        const byPitch = new Map<string, Map<number, SerializedMatch[]>>()
        const unscheduledByPitch = new Map<string, SerializedMatch[]>()

        for (const match of matches) {
            const pitchName = match.pitch.name
            if (!match.scheduledAt) {
                const bucket = unscheduledByPitch.get(pitchName) ?? []
                bucket.push(match)
                unscheduledByPitch.set(pitchName, bucket)
                continue
            }

            const parsed = new Date(match.scheduledAt)
            if (Number.isNaN(parsed.getTime())) {
                const bucket = unscheduledByPitch.get(pitchName) ?? []
                bucket.push(match)
                unscheduledByPitch.set(pitchName, bucket)
                continue
            }

            const slotStart = parsed.getTime()
            const pitchMap = byPitch.get(pitchName) ?? new Map<number, SerializedMatch[]>()
            const slotMatches = pitchMap.get(slotStart) ?? []
            slotMatches.push(match)
            pitchMap.set(slotStart, slotMatches)
            byPitch.set(pitchName, pitchMap)
        }

        const pitchNames = [...new Set([...tournament.pitches.map((pitch) => pitch.name), ...matches.map((match) => match.pitch.name)])]
            .sort((a, b) => comparePitchNames(a, b))

        return pitchNames.map((pitchName) => {
            const pitchSlots = byPitch.get(pitchName) ?? new Map<number, SerializedMatch[]>()
            const slots = [...pitchSlots.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([slotStart, slotMatches]) => {
                    const startDate = new Date(slotStart)
                    const label = startDate.toLocaleString('fr-FR', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        timeZone: 'UTC',
                    })
                    return {
                        slotStart,
                        label,
                        matches: [...slotMatches].sort((a, b) => {
                            const aTime = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
                            const bTime = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0
                            return aTime - bTime
                        }),
                    }
                })

            const unscheduled = (unscheduledByPitch.get(pitchName) ?? []).sort((a, b) => a.phase.name.localeCompare(b.phase.name))

            return {
                pitchName,
                slots,
                unscheduled,
            }
        })
    }, [matches, tournament.pitches])

    const scheduleByTime = useMemo(() => {
        const byTime = new Map<number, SerializedMatch[]>()
        const unscheduled: SerializedMatch[] = []

        for (const match of matches) {
            if (!match.scheduledAt) {
                unscheduled.push(match)
                continue
            }

            const parsed = new Date(match.scheduledAt)
            if (Number.isNaN(parsed.getTime())) {
                unscheduled.push(match)
                continue
            }

            const at = parsed.getTime()
            const bucket = byTime.get(at) ?? []
            bucket.push(match)
            byTime.set(at, bucket)
        }

        const slots = [...byTime.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([at, slotMatches]) => ({
                at,
                label: new Date(at).toLocaleString('fr-FR', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'UTC',
                }),
                matches: [...slotMatches].sort((a, b) => {
                    const pitchCmp = comparePitchNames(a.pitch.name, b.pitch.name)
                    if (pitchCmp !== 0) return pitchCmp
                    return a.phase.name.localeCompare(b.phase.name)
                }),
            }))

        return {
            slots,
            unscheduled: unscheduled.sort((a, b) => comparePitchNames(a.pitch.name, b.pitch.name)),
        }
    }, [matches])

    return { scheduleByPitch, scheduleByTime }
}

export function useTournamentStandingsOverlay(
    standingsOverlay: { phaseId: string; mode: 'groups' | 'global' } | null,
    tournament: TournamentData,
    matches: SerializedMatch[],
    teamNameById: Map<string, string>
) {
    const standingsOverlayPhase = useMemo(
        () => standingsOverlay
            ? tournament.phases.find((phase) => phase.id === standingsOverlay.phaseId) ?? null
            : null,
        [standingsOverlay, tournament.phases]
    )

    const standingsOverlayGroupConfig = useMemo(
        () => (standingsOverlayPhase?.type === 'GROUP' ? readGroupConfig(standingsOverlayPhase.config) : null),
        [standingsOverlayPhase]
    )

    const standingsOverlayByGroup = useMemo(() => {
        if (!standingsOverlayPhase || !standingsOverlayGroupConfig) return []
        return Array.from({ length: standingsOverlayGroupConfig.count }, (_, idx) => {
            const groupIndex = idx + 1
            return {
                groupIndex,
                standings: computeGroupStandings(
                    groupIndex,
                    standingsOverlayGroupConfig,
                    standingsOverlayPhase.id,
                    matches,
                    teamNameById
                ),
            }
        })
    }, [matches, standingsOverlayGroupConfig, standingsOverlayPhase, teamNameById])

    const standingsOverlayGlobal = useMemo(() => {
        if (!standingsOverlayPhase || !standingsOverlayGroupConfig) return []
        return computeGlobalGroupPhaseStandings(
            standingsOverlayGroupConfig,
            standingsOverlayPhase.id,
            matches,
            teamNameById
        )
    }, [matches, standingsOverlayGroupConfig, standingsOverlayPhase, teamNameById])

    return {
        standingsOverlayPhase,
        standingsOverlayGroupConfig,
        standingsOverlayByGroup,
        standingsOverlayGlobal,
    }
}

export function useTournamentLiveAdmin(
    tournament: TournamentData,
    matches: SerializedMatch[],
    nowMs: number
) {
    const latestTimerEvent = useMemo(() => {
        return tournament.actionLogs.find((log) => {
            const payload = (log.payload && typeof log.payload === 'object') ? (log.payload as TimerLogPayload) : null
            if (!payload || typeof payload.timerMinutes !== 'number') return false
            if (log.actionType === 'TIMER_CONTROL' && payload.timerKind === 'BREAK') return true
            if (log.actionType === 'MATCH_BULK_UPDATE' && payload.launchedStatus === 'LIVE') return true
            return false
        })
    }, [tournament.actionLogs])

    const bracketTimerContext = useMemo(() => {
        if (!latestTimerEvent) return null
        const payload = (latestTimerEvent.payload && typeof latestTimerEvent.payload === 'object')
            ? (latestTimerEvent.payload as TimerLogPayload)
            : null
        if (!payload || typeof payload.timerMinutes !== 'number') return null

        const slotAtMs = typeof payload.slotAt === 'string' ? new Date(payload.slotAt).getTime() : NaN
        const startedAtMs = typeof payload.startedAt === 'string' ? new Date(payload.startedAt).getTime() : NaN
        const createdAtMs = new Date(latestTimerEvent.createdAt).getTime()
        const rawStartMs = Number.isFinite(startedAtMs)
            ? startedAtMs
            : (Number.isFinite(createdAtMs) ? createdAtMs : slotAtMs)

        const maxAcceptedFutureMs = nowMs + 5 * 60 * 1000
        const startMs = Number.isFinite(rawStartMs) && rawStartMs <= maxAcceptedFutureMs
            ? rawStartMs
            : (Number.isFinite(createdAtMs) ? createdAtMs : nowMs)

        const timerSeconds = Math.max(0, Math.min(7200, Math.round(payload.timerMinutes * 60)))
        if (timerSeconds <= 0) return null

        return {
            timerSeconds,
            timerStartMs: startMs,
            timerMode: payload.timerKind === 'BREAK' ? 'BREAK' : 'MATCH' as 'MATCH' | 'BREAK',
        }
    }, [latestTimerEvent, nowMs])

    const adminTimer = useMemo(() => {
        if (!bracketTimerContext) return null
        const remainingSeconds = Math.max(
            0,
            Math.ceil((bracketTimerContext.timerStartMs + bracketTimerContext.timerSeconds * 1000 - nowMs) / 1000)
        )
        const minutes = Math.floor(remainingSeconds / 60)
        const seconds = remainingSeconds % 60
        return {
            mode: bracketTimerContext.timerMode,
            label: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
            isDone: remainingSeconds === 0,
        }
    }, [bracketTimerContext, nowMs])

    const liveWithoutScores = useMemo(
        () => matches.filter((match) => match.status === 'LIVE' && !match.result),
        [matches]
    )
    const finishedWithoutScores = useMemo(
        () => matches.filter((match) => match.status === 'FINISHED' && !match.result),
        [matches]
    )
    const overdueScheduled = useMemo(
        () => matches.filter((match) =>
            match.status === 'SCHEDULED' &&
            match.scheduledAt !== null &&
            new Date(match.scheduledAt).getTime() <= nowMs &&
            Boolean(match.homeTeamId) &&
            Boolean(match.awayTeamId)
        ),
        [matches, nowMs]
    )
    const requiredActionsCount = liveWithoutScores.length + finishedWithoutScores.length + overdueScheduled.length

    return {
        bracketTimerContext,
        adminTimer,
        liveWithoutScores,
        finishedWithoutScores,
        overdueScheduled,
        requiredActionsCount,
    }
}
