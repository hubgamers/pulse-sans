'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
    addTournamentRegistration,
    autoPlaceGroupTeams,
    closeTournamentPhase,
    configureGroupPhase,
    createTournamentMatch,
    createTournamentPitch,
    deleteAllTournamentMatches,
    deleteSelectedTournamentMatches,
    deleteTournamentMatch,
    deleteTournamentPitch,
    generateCustomPlacementBracketMatches,
    generateGroupMatchesFromPlacements,
    generatePhaseRoundRobinMatches,
    removeTournamentRegistration,
} from '@/lib/actions/tournament-management.actions'
import GroupPlacementBoard from './GroupPlacementBoard'
import MatchBulkEditor from './MatchBulkEditor'
import MatchBulkCreateForm from './MatchBulkCreateForm'
import BracketPhaseView from './BracketPhaseView'
import BracketSeedEditor from './BracketSeedEditor'
import PhaseFlowEditor from './PhaseFlowEditor'

// Next.js server actions can return arbitrary values, but the React HTML form
// `action` prop typing requires `void | Promise<void>`. This wrapper silences
// the mismatch while preserving the server action's behaviour at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function va<T extends (fd: FormData) => Promise<any>>(action: T) {
    return (fd: FormData): void => { void action(fd) }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'phases' | 'registrations' | 'pools' | 'bracket' | 'planning' | 'planning-time' | 'matches'

type RouteConfig = {
    toPhaseKey?: string
    toPhaseId?: string | null
    rule?: 'TOP' | 'BOTTOM' | 'RANGE'
    countPerGroup?: number
    startRank?: number
    endRank?: number
    label?: string
}

type GroupPlacement = { teamId: string; groupIndex: number; slot: number }
type GroupConfig = { count: number; teamsPerGroup: number; placements: GroupPlacement[] }

export type PhaseData = {
    id: string
    name: string
    type: string
    order: number
    isCompleted: boolean
    config: unknown
}

export type PitchData = {
    id: string
    name: string
    phase: { id: string; name: string } | null
}

export type RegistrationData = {
    id: string
    teamId: string
    seed: number | null
    isConfirmed: boolean
    team: { id: string; name: string; slug: string }
}

export type SerializedMatch = {
    id: string
    status: string
    phaseId: string
    homeTeamId: string | null
    awayTeamId: string | null
    roundNumber: number | null
    bracketPos: string | null
    scheduledAt: string | null
    homeTeam: { id: string; name: string } | null
    awayTeam: { id: string; name: string } | null
    pitch: { id: string; name: string }
    phase: { id: string; name: string }
    result: { homeScore: number; awayScore: number; notes: string | null } | null
}

type Props = {
    orgSlug: string
    tournament: {
        id: string
        name: string
        slug: string
        description: string | null
        status: string
        isPublic: boolean
        maxTeams: number | null
        game: { name: string }
        phases: PhaseData[]
        pitches: PitchData[]
        registrations: RegistrationData[]
        actionLogs: Array<{
            id: string
            actionType: string
            message: string
            actorName: string | null
            createdAt: string
        }>
        _count: { registrations: number }
    }
    availableTeams: Array<{ id: string; name: string; slug: string }>
    matches: SerializedMatch[]
}

// ─── Helper functions ─────────────────────────────────────────────────────────

function readRoutes(config: unknown): RouteConfig[] {
    if (!config || typeof config !== 'object') return []
    const routes = (config as { routes?: unknown }).routes
    if (!Array.isArray(routes)) return []
    return routes.filter((r) => r && typeof r === 'object') as RouteConfig[]
}

function readParallelGroup(config: unknown) {
    if (!config || typeof config !== 'object') return null
    const raw = (config as { parallelGroup?: unknown }).parallelGroup
    if (typeof raw !== 'string') return null
    const value = raw.trim()
    return value.length > 0 ? value : null
}

function formatRouteRule(route: RouteConfig) {
    if (route.rule === 'TOP') return `Top ${route.countPerGroup ?? '?'} par poule`
    if (route.rule === 'BOTTOM') return `Bottom ${route.countPerGroup ?? '?'} par poule`
    if (route.rule === 'RANGE') return `Places ${route.startRank ?? '?'} a ${route.endRank ?? '?'}`
    return 'Regle non definie'
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
              (p): p is GroupPlacement =>
                  p && typeof p === 'object' &&
                  typeof p.teamId === 'string' &&
                  typeof p.groupIndex === 'number' &&
                  typeof p.slot === 'number'
          )
        : []
    return { count, teamsPerGroup, placements }
}

function formatPhaseType(type: string) {
    if (type === 'GROUP') return 'Poules'
    if (type === 'BRACKET_SINGLE') return 'Bracket simple'
    if (type === 'BRACKET_DOUBLE') return 'Bracket double'
    if (type === 'PLACEMENT_BRACKET') return 'Bracket de placement'
    if (type === 'ROUND_SWISS') return 'Swiss'
    return 'Personnalisee'
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
    DRAFT: { label: 'Brouillon', cls: 'bg-slate-700 text-slate-800' },
    REGISTRATION: { label: 'Inscriptions ouvertes', cls: 'bg-blue-600/20 text-blue-200 border border-blue-500/30' },
    ONGOING: { label: 'En cours', cls: 'bg-emerald-600/20 text-emerald-200 border border-emerald-500/30' },
    FINISHED: { label: 'Termine', cls: 'bg-purple-600/20 text-purple-200 border border-purple-500/30' },
    CANCELLED: { label: 'Annule', cls: 'bg-red-600/20 text-red-200 border border-red-500/30' },
}

function computeGroupStandings(
    groupIndex: number,
    groupConfig: GroupConfig,
    phaseId: string,
    matches: SerializedMatch[],
    teamNameById: Map<string, string>
) {
    const teamIds = groupConfig.placements
        .filter((p) => p.groupIndex === groupIndex)
        .sort((a, b) => a.slot - b.slot)
        .map((p) => p.teamId)
    const uniqueTeamIds = [...new Set(teamIds)]

    type Row = {
        teamId: string; teamName: string; played: number; wins: number
        draws: number; losses: number; goalsFor: number; goalsAgainst: number
        goalDiff: number; points: number
    }
    const rows = new Map<string, Row>(
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

// ─── UI atoms ─────────────────────────────────────────────────────────────────

function StepSection({
    num, title, desc, children, color = 'indigo',
}: {
    num: number; title: string; desc?: string; children: React.ReactNode; color?: 'indigo' | 'cyan' | 'emerald' | 'amber'
}) {
    const colorCls = {
        indigo: 'border-teal-600/40 bg-teal-700/20 text-teal-700',
        cyan: 'border-teal-300 bg-teal-50 text-teal-700',
        emerald: 'border-emerald-500/40 bg-emerald-600/20 text-emerald-300',
        amber: 'border-amber-500/40 bg-amber-600/20 text-amber-300',
    }[color]

    return (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3 pb-1 border-b border-slate-200">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${colorCls}`}>
                    {num}
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
                </div>
            </div>
            {children}
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            {message}
        </div>
    )
}

function PhaseTypeBadge({ type }: { type: string }) {
    const cls = type === 'GROUP' ? 'text-teal-700 bg-teal-50'
        : type === 'BRACKET_SINGLE' ? 'text-amber-300 bg-amber-600/10'
        : type === 'BRACKET_DOUBLE' ? 'text-orange-300 bg-orange-600/10'
        : type === 'PLACEMENT_BRACKET' ? 'text-rose-300 bg-rose-600/10'
        : type === 'ROUND_SWISS' ? 'text-purple-300 bg-purple-600/10'
        : 'text-slate-700 bg-slate-600/10'
    return (
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
            {formatPhaseType(type)}
        </span>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TournamentTabShell({ orgSlug, tournament, availableTeams, matches }: Props) {
    const [activeTab, setActiveTab] = useState<TabId>('overview')
    const [phasesStep, setPhasesStep] = useState<1 | 2 | 3>(1)
    const [matchesStep, setMatchesStep] = useState<1 | 2 | 3 | 4>(1)
    const [matchCreateMode, setMatchCreateMode] = useState<'single' | 'bulk'>('single')
    const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([])

    const bracketPhases = tournament.phases.filter((p) =>
        ['BRACKET_SINGLE', 'BRACKET_DOUBLE', 'PLACEMENT_BRACKET', 'CUSTOM'].includes(p.type)
    )
    const groupPhases = tournament.phases.filter((p) => p.type === 'GROUP')

    const matchesByPhase = useMemo(() => {
        const map = new Map<string, { total: number; finished: number }>()
        for (const phase of tournament.phases) {
            const pm = matches.filter((m) => m.phaseId === phase.id)
            map.set(phase.id, {
                total: pm.length,
                finished: pm.filter((m) => m.status === 'FINISHED').length,
            })
        }
        return map
    }, [tournament.phases, matches])

    const teamNameById = useMemo(
        () => new Map(tournament.registrations.map((r) => [r.teamId, r.team.name])),
        [tournament.registrations]
    )

    const seededTeamsByPhase = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const phase of tournament.phases) {
            const ids = matches
                .filter((m) => m.phaseId === phase.id)
                .flatMap((m) => [m.homeTeamId, m.awayTeamId])
                .filter((id): id is string => Boolean(id))
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
                    .filter((m) => m.phaseId === sourcePhase.id && m.status === 'FINISHED' && Boolean(m.result))
                    .sort((a, b) => {
                        const roundA = a.roundNumber ?? 0
                        const roundB = b.roundNumber ?? 0
                        if (roundA !== roundB) return roundB - roundA
                        return (a.bracketPos ?? '').localeCompare(b.bracketPos ?? '')
                    })
                    .map((m) => {
                        if (!m.result || !m.homeTeamId || !m.awayTeamId) return null
                        return m.result.homeScore >= m.result.awayScore ? m.homeTeamId : m.awayTeamId
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

        const pitchNames = [...new Set([...tournament.pitches.map((pitch) => pitch.name), ...matches.map((m) => m.pitch.name)])]
            .sort((a, b) => a.localeCompare(b))

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
                }),
                matches: [...slotMatches].sort((a, b) => {
                    const pitchCmp = a.pitch.name.localeCompare(b.pitch.name)
                    if (pitchCmp !== 0) return pitchCmp
                    return a.phase.name.localeCompare(b.phase.name)
                }),
            }))

        return {
            slots,
            unscheduled: unscheduled.sort((a, b) => a.pitch.name.localeCompare(b.pitch.name)),
        }
    }, [matches])

    const tabs = [
        { id: 'overview' as TabId, label: "Vue d'ensemble" },
        { id: 'phases' as TabId, label: 'Configuration', badge: tournament.phases.length },
        { id: 'registrations' as TabId, label: 'Equipes & Pistes', badge: tournament.registrations.length },
        ...(groupPhases.length > 0 ? [{ id: 'pools' as TabId, label: 'Poules', badge: groupPhases.length }] : []),
        ...(bracketPhases.length > 0 ? [{ id: 'bracket' as TabId, label: 'Brackets', badge: bracketPhases.length }] : []),
        { id: 'planning' as TabId, label: 'Planning pistes', badge: matches.filter((m) => Boolean(m.scheduledAt)).length },
        { id: 'planning-time' as TabId, label: 'Planning horaire', badge: scheduleByTime.slots.length },
        { id: 'matches' as TabId, label: 'Matchs', badge: matches.length },
    ]

    const statusMeta = STATUS_META[tournament.status] ?? { label: tournament.status, cls: 'bg-slate-700 text-slate-700' }
    const allVisibleMatchIds = useMemo(() => matches.map((m) => m.id), [matches])
    const matchIdsByStatus = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const match of matches) {
            const bucket = map.get(match.status) ?? []
            bucket.push(match.id)
            map.set(match.status, bucket)
        }
        return map
    }, [matches])
    const selectedSet = useMemo(() => new Set(selectedMatchIds), [selectedMatchIds])
    const selectedCount = selectedMatchIds.length
    const allSelected = allVisibleMatchIds.length > 0 && allVisibleMatchIds.every((id) => selectedSet.has(id))

    const toggleSelectStatus = (status: string) => {
        const ids = matchIdsByStatus.get(status) ?? []
        if (ids.length === 0) return
        setSelectedMatchIds((prev) => {
            const prevSet = new Set(prev)
            const allStatusSelected = ids.every((id) => prevSet.has(id))
            if (allStatusSelected) {
                return prev.filter((id) => !ids.includes(id))
            }
            const merged = new Set(prev)
            ids.forEach((id) => merged.add(id))
            return Array.from(merged)
        })
    }

    const inputCls = 'rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-600'
    const btnPrimary = 'rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors'
    const btnGhost = 'rounded-lg border border-teal-600/40 px-3 py-2 text-sm text-teal-700 hover:bg-teal-600/10 transition-colors'
    const btnDanger = 'rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 transition-colors'

    // ── Header ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-0">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{tournament.game.name}</p>
                    <h1 className="text-2xl font-black md:text-3xl">{tournament.name}</h1>
                    {tournament.description && (
                        <p className="mt-1 max-w-xl text-sm text-slate-500">{tournament.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${statusMeta.cls}`}>
                            {statusMeta.label}
                        </span>
                        <span>/{tournament.slug}</span>
                        <span>•</span>
                        <span>{tournament._count.registrations}{tournament.maxTeams ? `/${tournament.maxTeams}` : ''} equipes</span>
                        <span>•</span>
                        <span>{tournament.isPublic ? 'Public' : 'Prive'}</span>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {tournament.isPublic && (
                        <Link
                            href={`/public/${orgSlug}/${tournament.slug}`}
                            target="_blank"
                            className="rounded-xl border border-teal-300 px-3 py-2 text-xs font-medium text-teal-700 hover:bg-teal-50 transition"
                        >
                            Lien public
                        </Link>
                    )}
                    {tournament.isPublic && (
                        <Link
                            href={`/public/${orgSlug}/${tournament.slug}/overlay`}
                            target="_blank"
                            className="rounded-xl border border-emerald-500/40 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-500/10 transition"
                        >
                            Overlay public
                        </Link>
                    )}
                    <Link
                        href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}/bracket`}
                        className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-medium hover:border-slate-500 transition"
                    >
                        Page bracket
                    </Link>
                    <Link
                        href={`/dashboard/org/${orgSlug}/tournaments`}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-white transition"
                    >
                        ← Retour
                    </Link>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-slate-200">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'border-teal-600 text-slate-900'
                                : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                    >
                        {tab.label}
                        {tab.badge !== undefined && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                activeTab === tab.id ? 'bg-teal-700 text-slate-900' : 'bg-slate-800 text-slate-500'
                            }`}>
                                {tab.badge}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Tab content */}
            <div className="pt-6">

                {/* ── Vue d'ensemble ─────────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Stats grid */}
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs uppercase text-slate-500">Phases</p>
                                <p className="mt-2 text-2xl font-black">{tournament.phases.length}</p>
                                <p className="text-xs text-slate-500">{tournament.phases.filter((p) => p.isCompleted).length} completee(s)</p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs uppercase text-slate-500">Equipes</p>
                                <p className="mt-2 text-2xl font-black">{tournament._count.registrations}</p>
                                <p className="text-xs text-slate-500">
                                    {tournament.registrations.filter((r) => r.isConfirmed).length} confirmees
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs uppercase text-slate-500">Matchs</p>
                                <p className="mt-2 text-2xl font-black">{matches.length}</p>
                                <p className="text-xs text-slate-500">
                                    {matches.filter((m) => m.status === 'FINISHED').length} termines
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-200 bg-white p-4">
                                <p className="text-xs uppercase text-slate-500">Pistes</p>
                                <p className="mt-2 text-2xl font-black">{tournament.pitches.length}</p>
                                <p className="text-xs text-slate-500">terrain(s) disponible(s)</p>
                            </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parcours recommande</p>
                            <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                                <button type="button" onClick={() => setActiveTab('phases')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                                    <p className="text-xs font-semibold text-teal-700">Etape 1</p>
                                    <p className="text-sm font-semibold">Configurer les phases</p>
                                </button>
                                <button type="button" onClick={() => setActiveTab('registrations')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                                    <p className="text-xs font-semibold text-teal-700">Etape 2</p>
                                    <p className="text-sm font-semibold">Inscrire equipes et pistes</p>
                                </button>
                                <button type="button" onClick={() => setActiveTab(groupPhases.length > 0 ? 'pools' : 'matches')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                                    <p className="text-xs font-semibold text-teal-700">Etape 3</p>
                                    <p className="text-sm font-semibold">Generer et organiser les matchs</p>
                                </button>
                                <button type="button" onClick={() => setActiveTab(bracketPhases.length > 0 ? 'bracket' : 'planning')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                                    <p className="text-xs font-semibold text-teal-700">Etape 4</p>
                                    <p className="text-sm font-semibold">Suivre bracket et planning</p>
                                </button>
                            </div>
                        </div>

                        {/* Phase flow */}
                        {tournament.phases.length === 0 ? (
                            <EmptyState message="Aucune phase configuree." />
                        ) : (
                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Progression du tournoi</h2>
                                <div className="flex flex-col gap-0">
                                    {tournament.phases.map((phase, idx) => {
                                        const stats = matchesByPhase.get(phase.id) ?? { total: 0, finished: 0 }
                                        const pct = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0
                                        const routes = readRoutes(phase.config)
                                        const parallelGroup = readParallelGroup(phase.config)
                                        return (
                                            <div key={phase.id} className="relative flex gap-4">
                                                {/* Connector line */}
                                                <div className="flex flex-col items-center">
                                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                                        phase.isCompleted
                                                            ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                                                            : 'border-slate-300 bg-slate-50 text-slate-500'
                                                    }`}>
                                                        {phase.isCompleted ? '✓' : phase.order}
                                                    </div>
                                                    {idx < tournament.phases.length - 1 && (
                                                        <div className="w-0.5 flex-1 bg-slate-800 my-1" style={{ minHeight: '24px' }} />
                                                    )}
                                                </div>
                                                <div className="mb-4 flex-1 rounded-xl border border-slate-200 bg-white p-3">
                                                    <div className="mb-2 flex items-center gap-2">
                                                        <p className="text-sm font-semibold">{phase.name}</p>
                                                        <PhaseTypeBadge type={phase.type} />
                                                        {parallelGroup && (
                                                            <span className="rounded-md border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                                                                Simultane: {parallelGroup}
                                                            </span>
                                                        )}
                                                        {phase.isCompleted && (
                                                            <span className="ml-auto text-[10px] font-semibold text-emerald-300">Terminee</span>
                                                        )}
                                                    </div>
                                                    <p className="mb-2 text-xs text-slate-500">
                                                        {stats.finished}/{stats.total} matchs termines
                                                    </p>
                                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${phase.isCompleted ? 'bg-emerald-500' : 'bg-teal-600'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    {routes.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {routes.map((route, i) => (
                                                                <span key={i} className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-700">
                                                                    {formatRouteRule(route)} → {route.toPhaseKey || 'phase cible'}
                                                                    {route.label ? ` (${route.label})` : ''}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Historique des actions</h2>
                                <span className="text-[11px] text-slate-500">{tournament.actionLogs.length} entree(s)</span>
                            </div>

                            {tournament.actionLogs.length === 0 ? (
                                <p className="text-xs text-slate-500">Aucune action enregistree pour le moment.</p>
                            ) : (
                                <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
                                    {tournament.actionLogs.map((log) => (
                                        <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <div className="flex items-start justify-between gap-3">
                                                <p className="text-xs text-slate-800">{log.message}</p>
                                                <span className="shrink-0 rounded-md bg-slate-800 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                                                    {log.actionType}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                {new Date(log.createdAt).toLocaleString('fr-FR')}
                                                {log.actorName ? ` • ${log.actorName}` : ''}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ── Phases ─────────────────────────────────────────────────────── */}
                {activeTab === 'phases' && (
                    <div className="space-y-4">
                        <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-3">
                            {[
                                { step: 1, label: 'Structurer les phases' },
                                { step: 2, label: 'Verifier la progression' },
                                { step: 3, label: 'Cloturer les phases' },
                            ].map((item) => {
                                const isActive = phasesStep === item.step
                                return (
                                    <button
                                        key={`phase-step-${item.step}`}
                                        type="button"
                                        onClick={() => setPhasesStep(item.step as 1 | 2 | 3)}
                                        className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                                            isActive
                                                ? 'border-teal-600 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                        }`}
                                    >
                                        {item.step}. {item.label}
                                    </button>
                                )
                            })}
                        </div>

                        {phasesStep === 1 && (
                            <PhaseFlowEditor
                                tournamentId={tournament.id}
                                tournamentSlug={tournament.slug}
                                orgSlug={orgSlug}
                                phases={tournament.phases.map((phase) => ({
                                    id: phase.id,
                                    name: phase.name,
                                    type: phase.type,
                                    order: phase.order,
                                    config: phase.config,
                                }))}
                            />
                        )}

                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">
                                {phasesStep === 1 ? 'Etape 1: Structure des phases' : phasesStep === 2 ? 'Etape 2: Controle de progression' : 'Etape 3: Cloture des phases'}
                            </p>
                            <p className="mt-1">
                                {phasesStep === 1
                                    ? 'Definissez le flow (ordre, types et routes de qualification) avec le formulaire ci-dessus.'
                                    : phasesStep === 2
                                        ? 'Verifiez les stats de matchs, les routes de qualification et les equipes en attente avant de cloturer.'
                                        : 'Cloturez chaque phase pour propager les qualifies vers la suite du tournoi. Utilisez Forcer la cloture si necessaire.'}
                            </p>
                        </div>

                        {(phasesStep === 2 || phasesStep === 3) && tournament.phases.length === 0 ? (
                            <EmptyState message="Aucune phase configuree. Creez un tournoi avec des phases depuis le formulaire de creation." />
                        ) : (phasesStep === 2 || phasesStep === 3) && (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {tournament.phases.map((phase) => {
                                    const stats = matchesByPhase.get(phase.id) ?? { total: 0, finished: 0 }
                                    const pct = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0
                                    const routes = readRoutes(phase.config)
                                    const parallelGroup = readParallelGroup(phase.config)
                                    const seededTeams = seededTeamsByPhase.get(phase.id) ?? []
                                    const incomingQualifiers = incomingQualifiersByPhase.get(phase.id) ?? []
                                    const waitingQualifiers = incomingQualifiers.filter((teamId) => !seededTeams.includes(teamId))
                                    return (
                                        <div key={phase.id} className={`rounded-xl border p-4 ${phase.isCompleted ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-slate-200 bg-white'}`}>
                                            <div className="mb-3 flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] uppercase tracking-widest text-slate-500">Etape {phase.order}</span>
                                                    <p className="text-base font-bold leading-tight">{phase.name}</p>
                                                    {parallelGroup && (
                                                        <p className="mt-1 text-[11px] text-teal-700">Groupe parallele: {parallelGroup}</p>
                                                    )}
                                                </div>
                                                <PhaseTypeBadge type={phase.type} />
                                            </div>

                                            {/* Progress */}
                                            <div className="mb-3">
                                                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                                    <span>{stats.finished}/{stats.total} matchs</span>
                                                    <span>{pct}%</span>
                                                </div>
                                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                                    <div
                                                        className={`h-full rounded-full transition-all ${phase.isCompleted ? 'bg-emerald-500' : 'bg-teal-600'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Routes */}
                                            {routes.length > 0 && (
                                                <div className="mb-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-500">Qualifications sortantes</p>
                                                    {routes.map((route, i) => (
                                                        <div key={i} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                                                            <span>{formatRouteRule(route)}</span>
                                                            <span className="ml-1 text-slate-500">→ {route.toPhaseKey || 'inconnue'}{route.label ? ` (${route.label})` : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {(seededTeams.length > 0 || waitingQualifiers.length > 0) && (
                                                <div className="mb-3 space-y-2 rounded-lg border border-teal-600/30 bg-teal-50 p-2">
                                                    {seededTeams.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wider text-teal-700">Equipes placees sur cette phase</p>
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {seededTeams.map((teamId) => (
                                                                    <span key={`${phase.id}-seeded-${teamId}`} className="rounded-md bg-slate-800 px-2 py-0.5 text-[11px] text-slate-800">
                                                                        {teamNameById.get(teamId) ?? teamId}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {waitingQualifiers.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wider text-amber-300">Qualifiees detectees (a placer)</p>
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {waitingQualifiers.map((teamId) => (
                                                                    <span key={`${phase.id}-incoming-${teamId}`} className="rounded-md bg-amber-600/20 px-2 py-0.5 text-[11px] text-amber-200">
                                                                        {teamNameById.get(teamId) ?? teamId}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {phasesStep === 3 && (
                                                <form action={va(closeTournamentPhase)} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                    <input type="hidden" name="phaseId" value={phase.id} />
                                                    {phase.isCompleted ? (
                                                        <p className="text-center text-[11px] font-semibold text-emerald-700">✓ Phase cloturee - qualifies propages</p>
                                                    ) : (
                                                        <>
                                                            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-500 hover:text-slate-800">
                                                                <input name="forceClose" type="checkbox" className="h-3.5 w-3.5 accent-teal-600" />
                                                                Forcer la cloture (matchs non termines)
                                                            </label>
                                                            <button type="submit" className="w-full rounded-md border border-teal-600/40 px-2 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-600/10 transition-colors">
                                                                Cloturer et propager les qualifies →
                                                            </button>
                                                        </>
                                                    )}
                                                </form>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                            <button
                                type="button"
                                onClick={() => setPhasesStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
                                disabled={phasesStep === 1}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                                Etape precedente
                            </button>
                            <button
                                type="button"
                                onClick={() => setPhasesStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)}
                                disabled={phasesStep === 3}
                                className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-40"
                            >
                                Etape suivante
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Inscriptions & Pistes ──────────────────────────────────────── */}
                {activeTab === 'registrations' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">Avant de commencer</p>
                            <p className="mt-1">Suivez ces etapes pour preparer votre tournoi : inscrivez les equipes, confirmez leur participation, puis configurez les pistes de jeu disponibles.</p>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            {/* Step 1: Inscriptions */}
                            <StepSection num={1} title="Inscrire les equipes" desc="Ajoutez les equipes participantes et confirmez leur inscription.">
                                <form action={va(addTournamentRegistration)} className="grid gap-2 md:grid-cols-2">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <select
                                        name="teamIds"
                                        className={`${inputCls} md:col-span-2 min-h-40`}
                                        required
                                        multiple
                                        size={Math.min(10, Math.max(4, availableTeams.length))}
                                    >
                                        {availableTeams.map((team) => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                    <p className="md:col-span-2 text-xs text-slate-500">
                                        Multi-selection: maintenez Ctrl (Windows) ou Cmd (Mac), puis cliquez sur les equipes a inscrire.
                                    </p>
                                    <input type="number" name="seed" min={1} placeholder="Seed (optionnel)" className={inputCls} />
                                    <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                        <input name="isConfirmed" type="checkbox" className="h-4 w-4 accent-teal-600" />
                                        Confirmer directement
                                    </label>
                                    <button
                                        type="submit"
                                        className={`${btnPrimary} md:col-span-2`}
                                        disabled={availableTeams.length === 0}
                                    >
                                        {availableTeams.length === 0 ? 'Toutes les equipes sont inscrites' : 'Ajouter les equipes'}
                                    </button>
                                </form>

                                <div className="mt-2 space-y-1.5">
                                    {tournament.registrations.length === 0 ? (
                                        <p className="text-center text-xs text-slate-500 py-4">Aucune equipe inscrite.</p>
                                    ) : (
                                        tournament.registrations.map((reg) => (
                                            <div key={reg.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-2 rounded-full ${reg.isConfirmed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                                    <p className="text-sm font-semibold">{reg.team.name}</p>
                                                    <span className="text-xs text-slate-500">
                                                        {reg.seed ? `seed ${reg.seed}` : ''}
                                                        {!reg.isConfirmed ? ' • en attente' : ''}
                                                    </span>
                                                </div>
                                                <form action={va(removeTournamentRegistration)}>
                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                    <input type="hidden" name="registrationId" value={reg.id} />
                                                    <button type="submit" className={btnDanger}>Retirer</button>
                                                </form>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </StepSection>

                            {/* Step 2: Pistes */}
                            <StepSection num={2} title="Configurer les pistes" desc="Demandez a l'organisateur les phases concernees : une piste peut etre rattachee a plusieurs phases." color="cyan">
                                <form action={va(createTournamentPitch)} className="grid gap-2 md:grid-cols-3">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <input name="name" className={inputCls} placeholder="Nom de la piste" required />
                                    <select
                                        name="phaseIds"
                                        className={`${inputCls} md:col-span-2 min-h-28`}
                                        multiple
                                        size={Math.min(8, Math.max(3, tournament.phases.length))}
                                    >
                                        {tournament.phases.map((phase) => (
                                            <option key={phase.id} value={phase.id}>{phase.name}</option>
                                        ))}
                                    </select>
                                    <p className="md:col-span-2 text-xs text-slate-500">
                                        Aucune phase selectionnee = piste disponible pour toutes les phases. Multi-selection via Ctrl/Cmd + clic.
                                    </p>
                                    <button type="submit" className={btnPrimary}>Ajouter</button>
                                </form>

                                <div className="mt-2 space-y-1.5">
                                    {tournament.pitches.length === 0 ? (
                                        <p className="text-center text-xs text-slate-500 py-4">Aucune piste configuree. Ajoutez au moins une piste avant de generer des matchs.</p>
                                    ) : (
                                        tournament.pitches.map((pitch) => (
                                            <div key={pitch.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div>
                                                    <p className="text-sm font-semibold">{pitch.name}</p>
                                                    <p className="text-xs text-slate-500">Phase : {pitch.phase?.name || 'Toutes'}</p>
                                                </div>
                                                <form action={va(deleteTournamentPitch)}>
                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                    <input type="hidden" name="pitchId" value={pitch.id} />
                                                    <button type="submit" className={btnDanger}>Supprimer</button>
                                                </form>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </StepSection>
                        </div>
                    </div>
                )}

                {/* ── Poules ─────────────────────────────────────────────────────── */}
                {activeTab === 'pools' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">Guide de gestion des poules</p>
                            <p className="mt-1">Suivez les 4 etapes ci-dessous pour chaque phase de type poules. Commencez par configurer le nombre de poules, placez les equipes, generez les matchs, puis suivez les classements en direct.</p>
                        </div>

                        {groupPhases.length === 0 ? (
                            <EmptyState message="Aucune phase de type poule." />
                        ) : (
                            groupPhases.map((phase) => {
                                const groupConfig = readGroupConfig(phase.config)
                                return (
                                    <div key={phase.id} className="space-y-4 rounded-2xl border border-slate-300 bg-white p-4">
                                        {/* Phase header */}
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-xs uppercase tracking-wider text-slate-500">Etape {phase.order}</p>
                                                <p className="text-base font-bold">{phase.name}</p>
                                            </div>
                                            <PhaseTypeBadge type={phase.type} />
                                        </div>

                                        {/* Step 1: Configuration */}
                                        <StepSection num={1} title="Configurer les poules" desc="Definissez le nombre de groupes et le nombre d'equipes par groupe.">
                                            <form action={va(configureGroupPhase)} className="grid gap-2 md:grid-cols-3">
                                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                <input type="hidden" name="phaseId" value={phase.id} />
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Nombre de poules</label>
                                                    <input
                                                        name="groupCount" type="number" min={1} max={64}
                                                        defaultValue={groupConfig.count}
                                                        className={`${inputCls} w-full`}
                                                        placeholder="Ex : 4"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Equipes par poule</label>
                                                    <input
                                                        name="teamsPerGroup" type="number" min={2} max={64}
                                                        defaultValue={groupConfig.teamsPerGroup}
                                                        className={`${inputCls} w-full`}
                                                        placeholder="Ex : 4"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <button type="submit" className={`${btnPrimary} w-full`}>Enregistrer la configuration</button>
                                                </div>
                                            </form>
                                            <p className="text-[11px] text-slate-500">
                                                Configuration actuelle : {groupConfig.count} poule(s) de {groupConfig.teamsPerGroup} equipe(s)
                                            </p>
                                        </StepSection>

                                        {/* Step 2: Placement */}
                                        <StepSection num={2} title="Placer les equipes" desc="Utilisez le placement automatique (seeding serpentin) ou placez les equipes manuellement en drag-and-drop." color="cyan">
                                            <form action={va(autoPlaceGroupTeams)} className="flex flex-wrap items-center gap-2">
                                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                <input type="hidden" name="phaseId" value={phase.id} />
                                                <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                                    <input name="confirmedOnly" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                                    Equipes confirmees uniquement
                                                </label>
                                                <button type="submit" className={btnGhost}>
                                                    ↺ Auto-placer (serpentin)
                                                </button>
                                            </form>
                                            <div className="mt-2">
                                                <GroupPlacementBoard
                                                    tournamentId={tournament.id}
                                                    orgSlug={orgSlug}
                                                    tournamentSlug={tournament.slug}
                                                    phaseId={phase.id}
                                                    groupCount={groupConfig.count}
                                                    teamsPerGroup={groupConfig.teamsPerGroup}
                                                    placements={groupConfig.placements}
                                                    teamOptions={tournament.registrations.map((r) => ({ id: r.teamId, name: r.team.name }))}
                                                />
                                            </div>
                                        </StepSection>

                                        {/* Step 3: Generate matches */}
                                        <StepSection num={3} title="Generer les matchs de poule" desc="Choisissez l'heure de debut, la duree max d'un match et le temps de recuperation entre deux matchs d'une equipe." color="emerald">
                                            <form action={va(generateGroupMatchesFromPlacements)} className="grid gap-2 md:grid-cols-5">
                                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                <input type="hidden" name="phaseId" value={phase.id} />
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                                                    <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Duree max (min)</label>
                                                    <input name="maxDurationMinutes" type="number" min={5} max={600} defaultValue={30} className={`${inputCls} w-full`} />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Battement equipe (min)</label>
                                                    <input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} className={`${inputCls} w-full`} />
                                                </div>
                                                <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                    <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                                    <span className="text-amber-200">Ecraser matchs</span>
                                                </label>
                                                <div className="flex items-end">
                                                    <button type="submit" className={`${btnGhost} w-full border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10`}>
                                                        Generer les matchs
                                                    </button>
                                                </div>
                                            </form>
                                        </StepSection>

                                        {/* Step 4: Standings */}
                                        <StepSection num={4} title="Classements en direct" desc="Mis a jour apres chaque enregistrement de score. Tiebreaker : Pts > Diff buts > Buts marques." color="amber">
                                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                                {Array.from({ length: groupConfig.count }, (_, i) => {
                                                    const gIdx = i + 1
                                                    const standings = computeGroupStandings(gIdx, groupConfig, phase.id, matches, teamNameById)
                                                    return (
                                                        <div key={`${phase.id}-standings-${gIdx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300">Poule {gIdx}</p>
                                                            {standings.length === 0 ? (
                                                                <p className="text-xs text-slate-500">Aucune equipe.</p>
                                                            ) : (
                                                                <table className="w-full text-[11px]">
                                                                    <thead>
                                                                        <tr className="text-slate-500">
                                                                            <th className="px-1 py-0.5 text-left">#</th>
                                                                            <th className="px-1 py-0.5 text-left">Equipe</th>
                                                                            <th className="px-1 py-0.5 text-right">Pts</th>
                                                                            <th className="px-1 py-0.5 text-right">J</th>
                                                                            <th className="px-1 py-0.5 text-right">GD</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {standings.map((row, rank) => (
                                                                            <tr key={row.teamId} className={`border-t border-slate-200 ${rank === 0 ? 'text-amber-200' : 'text-slate-800'}`}>
                                                                                <td className="px-1 py-0.5 font-semibold">{rank + 1}</td>
                                                                                <td className="px-1 py-0.5 truncate max-w-[80px]">{row.teamName}</td>
                                                                                <td className="px-1 py-0.5 text-right font-bold">{row.points}</td>
                                                                                <td className="px-1 py-0.5 text-right">{row.played}</td>
                                                                                <td className={`px-1 py-0.5 text-right ${row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-red-400' : ''}`}>
                                                                                    {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </StepSection>
                                    </div>
                                )
                            })
                        )}
                    </div>
                )}

                {/* ── Bracket ────────────────────────────────────────────────────── */}
                {activeTab === 'bracket' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">Visualisation bracket</p>
                            <p className="mt-1">Les colonnes representent les rounds. Cliquez sur un match pour voir son detail et mettre a jour le score. Pour les phases <em>Personnalisees</em>, generez d'abord la structure du bracket ci-dessous.</p>
                        </div>

                        {bracketPhases.length === 0 ? (
                            <EmptyState message="Aucune phase bracket ou personnalisee." />
                        ) : (
                            <div className="space-y-6">
                                {bracketPhases.map((phase) => {
                                    const phaseMatches = matches
                                        .filter((m) => m.phaseId === phase.id)
                                        .map((m) => ({
                                            id: m.id,
                                            homeTeamId: m.homeTeamId,
                                            awayTeamId: m.awayTeamId,
                                            roundNumber: m.roundNumber,
                                            bracketPos: m.bracketPos,
                                            status: m.status as 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED',
                                            homeTeamName: m.homeTeam?.name || 'TBD',
                                            awayTeamName: m.awayTeam?.name || 'TBD',
                                            homeScore: m.result?.homeScore ?? null,
                                            awayScore: m.result?.awayScore ?? null,
                                        }))

                                    return (
                                        <div key={phase.id} className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-xs uppercase tracking-wider text-slate-500">Etape {phase.order}</p>
                                                    <p className="text-base font-bold">{phase.name}</p>
                                                </div>
                                                <PhaseTypeBadge type={phase.type} />
                                            </div>

                                            <BracketPhaseView
                                                orgSlug={orgSlug}
                                                tournamentSlug={tournament.slug}
                                                phase={{ id: phase.id, name: phase.name, type: phase.type, order: phase.order }}
                                                matches={phaseMatches}
                                            />

                                            {(phase.type === 'CUSTOM' || phase.type === 'PLACEMENT_BRACKET') && (
                                                <StepSection num={1} title="Generer la structure du bracket personnalise" desc="Definissez le nombre de participants. Les perdants peuvent rejouer pour etablir un classement complet.">
                                                    <form action={va(generateCustomPlacementBracketMatches)} className="grid gap-2 md:grid-cols-6">
                                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                        <input type="hidden" name="phaseId" value={phase.id} />
                                                        <div>
                                                            <label className="mb-1 block text-xs text-slate-500">Participants</label>
                                                            <input name="participantsCount" type="number" min={4} max={64} defaultValue={8} className={`${inputCls} w-full`} />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                                                            <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                                                        </div>
                                                        <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                            <input name="includeLosersReplay" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                                            Perdants rejouent (classement complet)
                                                        </label>
                                                        <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                            <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                                            <span className="text-amber-200">Ecraser les matchs</span>
                                                        </label>
                                                        <div className="md:col-span-2 flex items-end">
                                                            <button type="submit" className={`${btnGhost} w-full`}>Generer le bracket</button>
                                                        </div>
                                                    </form>
                                                </StepSection>
                                            )}

                                            {phaseMatches.some((m) => m.roundNumber === 1) && (
                                                <StepSection
                                                    num={2}
                                                    title="Verifier/ajuster les equipes avant lancement"
                                                    desc="Les equipes du round 1 sont auto-assignees a la generation du bracket. Vous pouvez les corriger ici avant le debut des matchs."
                                                    color="amber"
                                                >
                                                    <BracketSeedEditor
                                                        tournamentId={tournament.id}
                                                        orgSlug={orgSlug}
                                                        tournamentSlug={tournament.slug}
                                                        phaseId={phase.id}
                                                        rows={phaseMatches
                                                            .filter((m) => m.roundNumber === 1)
                                                            .sort((a, b) => (a.bracketPos || '').localeCompare(b.bracketPos || ''))
                                                            .map((m) => ({
                                                                matchId: m.id,
                                                                bracketPos: m.bracketPos,
                                                                homeTeamId: m.homeTeamId,
                                                                awayTeamId: m.awayTeamId,
                                                            }))}
                                                        teamOptions={tournament.registrations.map((r) => ({ id: r.teamId, name: r.team.name }))}
                                                    />
                                                </StepSection>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Matchs ─────────────────────────────────────────────────────── */}
                {activeTab === 'planning' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">Planning par piste et tranche horaire</p>
                            <p className="mt-1">Visualisez les matchs par piste puis par horaire exact pour voir les matchs qui demarrent au meme moment.</p>
                        </div>

                        {matches.length === 0 ? (
                            <EmptyState message="Aucun match disponible pour construire le planning." />
                        ) : (
                            <div className="grid gap-4 xl:grid-cols-2">
                                {scheduleByPitch.map((pitch) => (
                                    <div key={`planning-${pitch.pitchName}`} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                                        <div className="flex items-center justify-between">
                                            <p className="text-sm font-bold text-teal-700">{pitch.pitchName}</p>
                                            <span className="text-[11px] text-slate-500">{pitch.slots.length} horaire(s)</span>
                                        </div>

                                        {pitch.slots.length === 0 ? (
                                            <p className="text-xs text-slate-500">Aucun match planifie sur cette piste.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {pitch.slots.map((slot) => (
                                                    <div key={`${pitch.pitchName}-${slot.slotStart}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">{slot.label}</p>
                                                        <div className="space-y-1.5">
                                                            {slot.matches.map((match) => (
                                                                <div key={`slot-${match.id}`} className="rounded-md border border-slate-200 bg-white px-2 py-1.5">
                                                                    <p className="text-xs font-semibold">
                                                                        {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                                                                    </p>
                                                                    <p className="text-[11px] text-slate-500">
                                                                        {match.phase.name}
                                                                        {match.scheduledAt ? ` • ${new Date(match.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''}
                                                                        {match.roundNumber ? ` • Round ${match.roundNumber}` : ''}
                                                                    </p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {pitch.unscheduled.length > 0 && (
                                            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                                                <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Non planifies</p>
                                                <div className="space-y-1">
                                                    {pitch.unscheduled.map((match) => (
                                                        <p key={`unscheduled-${match.id}`} className="text-xs text-slate-700">
                                                            {match.phase.name}: {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                                                        </p>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'planning-time' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">Planning par horaire</p>
                            <p className="mt-1">Tous les matchs regroupes par horaire exact, puis tries par piste pour chaque horaire.</p>
                        </div>

                        {matches.length === 0 ? (
                            <EmptyState message="Aucun match disponible pour construire le planning." />
                        ) : (
                            <div className="space-y-3">
                                {scheduleByTime.slots.length === 0 ? (
                                    <p className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500">
                                        Aucun match planifie avec une date/heure.
                                    </p>
                                ) : (
                                    scheduleByTime.slots.map((slot) => (
                                        <div key={`planning-time-${slot.at}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-sm font-bold text-amber-300">{slot.label}</p>
                                                <span className="text-[11px] text-slate-500">{slot.matches.length} match(s)</span>
                                            </div>
                                            <div className="space-y-1.5">
                                                {slot.matches.map((match) => (
                                                    <div key={`planning-time-match-${match.id}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                        <p className="text-xs font-semibold">
                                                            {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                                                        </p>
                                                        <p className="text-[11px] text-slate-500">
                                                            {match.pitch.name} • {match.phase.name}
                                                            {match.roundNumber ? ` • Round ${match.roundNumber}` : ''}
                                                            {match.bracketPos ? ` • ${match.bracketPos}` : ''}
                                                        </p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                )}

                                {scheduleByTime.unscheduled.length > 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                                        <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Matchs non planifies</p>
                                        <div className="space-y-1">
                                            {scheduleByTime.unscheduled.map((match) => (
                                                <p key={`planning-time-unscheduled-${match.id}`} className="text-xs text-slate-700">
                                                    {match.pitch.name}: {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'} ({match.phase.name})
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Matchs ─────────────────────────────────────────────────────── */}
                {activeTab === 'matches' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
                            <p className="font-semibold text-slate-800">Planification et suivi des matchs</p>
                            <p className="mt-1">Suivez les etapes dans l'ordre pour garder une gestion simple: generer, ajouter, controler, puis mettre a jour en masse.</p>
                            <form
                                action={va(deleteAllTournamentMatches)}
                                className="mt-3"
                                onSubmit={(event) => {
                                    const ok = window.confirm('Supprimer tous les matchs de ce tournoi ? Cette action est irreversible.')
                                    if (!ok) event.preventDefault()
                                }}
                            >
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                <button type="submit" className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors">
                                    Supprimer tous les matchs
                                </button>
                            </form>
                        </div>

                        <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-4">
                            {[
                                { step: 1, label: 'Generer' },
                                { step: 2, label: 'Ajouter' },
                                { step: 3, label: 'Verifier' },
                                { step: 4, label: 'Mettre a jour' },
                            ].map((item) => {
                                const isActive = matchesStep === item.step
                                return (
                                    <button
                                        key={`matches-step-${item.step}`}
                                        type="button"
                                        onClick={() => setMatchesStep(item.step as 1 | 2 | 3 | 4)}
                                        className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${
                                            isActive
                                                ? 'border-teal-600 bg-teal-50 text-teal-700'
                                                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                                        }`}
                                    >
                                        {item.step}. {item.label}
                                    </button>
                                )
                            })}
                        </div>

                        {/* Step 1: Auto generation */}
                        {matchesStep === 1 && (
                        <StepSection num={1} title="Generation automatique round-robin" desc="Genere tous les matchs d'une phase en respectant les disponibilites des pistes et des equipes. Pour une phase de poules, la generation suit les placements de chaque poule.">
                            <form action={va(generatePhaseRoundRobinMatches)} className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />

                                <div className="xl:col-span-2">
                                    <label className="mb-1 block text-xs text-slate-500">Phase</label>
                                    <select name="phaseId" required defaultValue="" className={`${inputCls} w-full`}>
                                        <option value="" disabled>Selectionner une phase</option>
                                        {tournament.phases.map((phase) => (
                                            <option key={phase.id} value={phase.id}>{phase.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                                    <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-slate-500">Duree max (min)</label>
                                    <input name="maxDurationMinutes" type="number" min={5} max={600} defaultValue={30} className={`${inputCls} w-full`} />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs text-slate-500">Battement equipe (min)</label>
                                    <input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} className={`${inputCls} w-full`} />
                                </div>
                                <div className="flex flex-col gap-2">
                                    <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                        <input name="confirmedOnly" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                        Confirmees uniquement
                                    </label>
                                    <button
                                        type="submit"
                                        className={`${btnGhost} w-full`}
                                        disabled={tournament.registrations.length < 2 || tournament.pitches.length === 0}
                                    >
                                        Generer round-robin
                                    </button>
                                </div>
                            </form>
                            {(tournament.registrations.length < 2 || tournament.pitches.length === 0) && (
                                <p className="text-[11px] text-amber-400">
                                    {tournament.registrations.length < 2 ? '⚠ Minimum 2 equipes inscrites requis. ' : ''}
                                    {tournament.pitches.length === 0 ? '⚠ Ajoutez au moins une piste dans l\'onglet Inscriptions & Pistes.' : ''}
                                </p>
                            )}
                        </StepSection>
                        )}

                        {/* Step 2: Manual match creation */}
                        {matchesStep === 2 && (
                        <StepSection num={2} title="Creer des matchs manuellement" desc="Creez un match individuel ou importez plusieurs matchs d'un coup via le mode groupe." color="cyan">
                            {/* Mode toggle */}
                            <div className="mb-3 flex gap-2 border-b border-slate-200 pb-2">
                                <button
                                    type="button"
                                    onClick={() => setMatchCreateMode('single')}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${matchCreateMode === 'single' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Match unique
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setMatchCreateMode('bulk')}
                                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${matchCreateMode === 'bulk' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                                >
                                    Ajout groupé (plusieurs matchs)
                                </button>
                            </div>

                            {matchCreateMode === 'single' && (
                                <form action={va(createTournamentMatch)} className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />

                                    <select name="phaseId" className={inputCls} required defaultValue="">
                                        <option value="" disabled>Phase</option>
                                        {tournament.phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <select name="pitchId" className={inputCls} required defaultValue="">
                                        <option value="" disabled>Piste</option>
                                        {tournament.pitches.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                    <select name="homeTeamId" className={inputCls} defaultValue="">
                                        <option value="">Equipe domicile</option>
                                        {tournament.registrations.map((r) => (
                                            <option key={`home-${r.id}`} value={r.teamId}>{r.team.name}</option>
                                        ))}
                                    </select>
                                    <select name="awayTeamId" className={inputCls} defaultValue="">
                                        <option value="">Equipe exterieur</option>
                                        {tournament.registrations.map((r) => (
                                            <option key={`away-${r.id}`} value={r.teamId}>{r.team.name}</option>
                                        ))}
                                    </select>
                                    <input name="scheduledAt" type="datetime-local" className={inputCls} />
                                    <input name="maxDurationMinutes" type="number" min={5} max={600} defaultValue={30} placeholder="Duree max (min)" className={inputCls} />
                                    <input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} placeholder="Battement (min)" className={inputCls} />
                                    <input name="roundNumber" type="number" min={1} placeholder="Round n°" className={inputCls} />
                                    <input name="bracketPos" placeholder="Position bracket (WB-R1-M1…)" className={inputCls} />
                                    <button
                                        type="submit"
                                        className={`${btnPrimary} xl:col-span-1`}
                                        disabled={tournament.pitches.length === 0 || tournament.phases.length === 0}
                                    >
                                        Creer le match
                                    </button>
                                </form>
                            )}

                            {matchCreateMode === 'bulk' && (
                                <MatchBulkCreateForm
                                    tournamentId={tournament.id}
                                    orgSlug={orgSlug}
                                    tournamentSlug={tournament.slug}
                                    phases={tournament.phases.map((p) => ({ id: p.id, name: p.name }))}
                                    pitches={Array.from(
                                        new Map(tournament.pitches.map((p) => [p.name, { id: p.id, name: p.name }])).values()
                                    )}
                                    teams={tournament.registrations.map((r) => ({ teamId: r.teamId, name: r.team.name }))}
                                />
                            )}
                        </StepSection>
                        )}

                        {/* Step 3: Match list */}
                        {matchesStep === 3 && (
                        <StepSection num={3} title="Liste des matchs" desc={`${matches.length} match(s) planifie(s) — cliquez sur Detail pour voir et modifier un match.`} color="emerald">
                            {matches.length === 0 ? (
                                <p className="text-center text-xs text-slate-500 py-4">Aucun match planifie. Utilisez la generation automatique ou la creation manuelle ci-dessus.</p>
                            ) : (
                                <div className="space-y-2">
                                    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 md:flex-row md:items-center md:justify-between">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedMatchIds(allSelected ? [] : allVisibleMatchIds)}
                                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-slate-800"
                                            >
                                                {allSelected ? 'Tout deselec.' : 'Tout selectionner'}
                                            </button>
                                            {(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'] as const).map((status) => {
                                                const ids = matchIdsByStatus.get(status) ?? []
                                                const hasAny = ids.length > 0
                                                const allThisStatusSelected = hasAny && ids.every((id) => selectedSet.has(id))
                                                return (
                                                    <button
                                                        key={`select-status-${status}`}
                                                        type="button"
                                                        onClick={() => toggleSelectStatus(status)}
                                                        disabled={!hasAny}
                                                        className={`rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${
                                                            allThisStatusSelected
                                                                ? 'border-teal-600/60 bg-teal-700/20 text-teal-700'
                                                                : 'border-slate-300 text-slate-700 hover:bg-slate-800'
                                                        }`}
                                                    >
                                                        {status} ({ids.length})
                                                    </button>
                                                )
                                            })}
                                        </div>

                                        <form action={va(deleteSelectedTournamentMatches)} className="flex items-center gap-2">
                                            <input type="hidden" name="tournamentId" value={tournament.id} />
                                            <input type="hidden" name="orgSlug" value={orgSlug} />
                                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                            {selectedMatchIds.map((id) => (
                                                <input key={`selected-${id}`} type="hidden" name="matchIds" value={id} />
                                            ))}
                                            <button
                                                type="submit"
                                                disabled={selectedCount === 0}
                                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                            >
                                                Supprimer la selection
                                            </button>
                                        </form>
                                    </div>

                                    {matches.map((match) => (
                                        <div key={match.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold">
                                                    {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                                                    {match.result && (
                                                        <span className="ml-2 text-emerald-300">{match.result.homeScore} - {match.result.awayScore}</span>
                                                    )}
                                                </p>
                                                <p className="truncate text-xs text-slate-500">
                                                    {match.phase.name} • {match.pitch.name}
                                                    {match.roundNumber ? ` • Round ${match.roundNumber}` : ''}
                                                    {match.bracketPos ? ` • ${match.bracketPos}` : ''}
                                                    {match.scheduledAt ? ` • ${new Date(match.scheduledAt).toLocaleString('fr-FR')}` : ''}
                                                </p>
                                            </div>
                                            <div className="flex shrink-0 items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedSet.has(match.id)}
                                                    onChange={(event) => {
                                                        const checked = event.target.checked
                                                        setSelectedMatchIds((prev) => {
                                                            if (checked) {
                                                                if (prev.includes(match.id)) return prev
                                                                return [...prev, match.id]
                                                            }
                                                            return prev.filter((id) => id !== match.id)
                                                        })
                                                    }}
                                                    className="h-4 w-4 accent-teal-600"
                                                    aria-label={`Selectionner le match ${match.id}`}
                                                />
                                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                                    match.status === 'FINISHED' ? 'bg-emerald-100 text-emerald-700'
                                                    : match.status === 'LIVE' ? 'bg-amber-100 text-amber-700'
                                                    : match.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
                                                    : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                    {match.status}
                                                </span>
                                                <Link
                                                    href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}/matches/${match.id}`}
                                                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-800 transition-colors"
                                                >
                                                    Detail →
                                                </Link>
                                                <form action={va(deleteTournamentMatch)}>
                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                    <input type="hidden" name="matchId" value={match.id} />
                                                    <button type="submit" className={btnDanger}>Suppr.</button>
                                                </form>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </StepSection>
                        )}

                        {/* Step 4: Bulk editor */}
                        {matchesStep === 4 && matches.length > 0 && (
                            <StepSection num={4} title="Editeur global des scores et statuts" desc="Modifiez plusieurs matchs a la fois et sauvegardez en une seule action." color="amber">
                                <MatchBulkEditor
                                    tournamentId={tournament.id}
                                    orgSlug={orgSlug}
                                    tournamentSlug={tournament.slug}
                                    matches={matches.map((m) => ({
                                        id: m.id,
                                        phaseName: m.phase.name,
                                        pitchName: m.pitch.name,
                                        homeTeamName: m.homeTeam?.name || 'TBD',
                                        awayTeamName: m.awayTeam?.name || 'TBD',
                                        status: m.status as 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED',
                                        homeScore: m.result?.homeScore ?? null,
                                        awayScore: m.result?.awayScore ?? null,
                                        notes: m.result?.notes || '',
                                        scheduledAtLabel: m.scheduledAt
                                            ? new Date(m.scheduledAt).toLocaleString('fr-FR')
                                            : 'Non planifie',
                                    }))}
                                />
                            </StepSection>
                        )}

                        <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                            <button
                                type="button"
                                onClick={() => setMatchesStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
                                disabled={matchesStep === 1}
                                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                            >
                                Etape precedente
                            </button>
                            <button
                                type="button"
                                onClick={() => setMatchesStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
                                disabled={matchesStep === 4}
                                className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-40"
                            >
                                Etape suivante
                            </button>
                        </div>
                    </div>
                )}

            </div>
        </div>
    )
}
