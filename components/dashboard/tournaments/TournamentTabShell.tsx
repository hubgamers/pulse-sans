'use client'

import { useState, useMemo, useEffect, useActionState, type ChangeEvent, type ReactNode } from 'react'
import Link from 'next/link'
import { useFormStatus } from 'react-dom'
import {
    addTournamentRegistration,
    autoPlaceGroupTeams,
    closeTournamentPhase,
    configureGroupPhase,
    configurePlacementBracketLabels,
    configurePlacementBracketRankingSegments,
    createTournamentMatch,
    createTournamentPitch,
    bulkCreateTournamentPitches,
    bulkDeleteTournamentPitches,
    duplicateTournamentForOrganization,
    deleteAllTournamentMatches,
    deleteSelectedTournamentMatches,
    deleteTournamentMatch,
    deleteTournamentPitch,
    generateCustomPlacementBracketMatches,
    generateLinkedBracketMatches,
    generateGroupMatchesFromPlacements,
    generatePhaseRoundRobinMatches,
    removeTournamentRegistration,
    resetTournamentForReconfiguration,
    retryTournamentPropagation,
    startTournamentBreakTimer,
    startTournamentMatchesByScheduleSlot,
    updateTournamentOverlayBackground,
    updateTournamentRegistrationConfirmation,
} from '@/lib/actions/tournament-management.actions'
import GroupPlacementBoard from './GroupPlacementBoard'
import MatchBulkEditor from './MatchBulkEditor'
import MatchBulkCreateForm from './MatchBulkCreateForm'
import BracketPhaseView from './BracketPhaseView'
import BracketSeedEditor from './BracketSeedEditor'
import PhaseFlowEditor from './PhaseFlowEditor'
import { TournamentStatus } from '@prisma/client'
import { createClient } from '@/lib/supabase/client'

// Next.js server actions can return arbitrary values, but the React HTML form
// `action` prop typing requires `void | Promise<void>`. This wrapper silences
// the mismatch while preserving the server action's behaviour at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function va<T extends (fd: FormData) => Promise<any>>(action: T) {
    return (fd: FormData): void => { void action(fd) }
}

type LoadingSubmitButtonProps = {
    children: ReactNode
    className: string
    disabled?: boolean
    loadingLabel?: string
}

function LoadingSubmitButton({ children, className, disabled = false, loadingLabel = 'Traitement...' }: LoadingSubmitButtonProps) {
    const { pending } = useFormStatus()

    return (
        <button type="submit" disabled={pending || disabled} className={className}>
            {pending ? loadingLabel : children}
        </button>
    )
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

type GroupStandingRow = {
    teamId: string
    teamName: string
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    goalDiff: number
    points: number
}

type InlineActionState = {
    success?: boolean
    message: string
}

type ActionLogPayload = {
    maxDurationMinutes?: unknown
    teamBreakMinutes?: unknown
}

type TimerLogPayload = {
    timerMinutes?: unknown
    startedAt?: unknown
    timerKind?: unknown
    launchedStatus?: unknown
    slotAt?: unknown
}

const INITIAL_INLINE_ACTION_STATE: InlineActionState = {
    success: false,
    message: '',
}

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
        bannerUrl: string | null
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
            payload?: unknown
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

function readPlacementLabels(config: unknown): Record<string, string> {
    if (!config || typeof config !== 'object') return {}
    const raw = (config as { placementLabels?: unknown }).placementLabels
    if (!raw || typeof raw !== 'object') return {}

    return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>)
            .filter(([key, value]) => /^\d+-\d+$/.test(key) && typeof value === 'string' && value.trim().length > 0)
            .map(([key, value]) => [key, (value as string).trim()])
    )
}

function readPlacementRangesFromMatches(matches: Array<{ bracketPos: string | null }>) {
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

function defaultPlacementLabel(start: number, end: number) {
    return start === end ? `Place ${start}` : `Place ${start} a ${end}`
}

function readPlacementRankingSegments(config: unknown): Array<{ start: number; end: number; label: string }> {
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

type PlacementRankingMatch = {
    bracketPos: string | null
    roundNumber: number | null
    status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED'
    homeTeamId: string | null
    awayTeamId: string | null
    homeTeamName: string
    awayTeamName: string
    homeScore: number | null
    awayScore: number | null
}

type PlacementRankingRow = {
    rank: number
    teamName: string
    teamId: string | null
    source: string
}

function parseWbBracketPos(bracketPos: string | null) {
    if (!bracketPos) return null
    const parsed = bracketPos.match(/^WB-R(\d+)-M(\d+)$/)
    if (!parsed) return null
    const round = Number(parsed[1])
    const matchNo = Number(parsed[2])
    if (!Number.isInteger(round) || !Number.isInteger(matchNo) || round < 1 || matchNo < 1) return null
    return { round, matchNo }
}

function parsePlacementBracketPos(bracketPos: string | null) {
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

function winnerAndLoser(match: PlacementRankingMatch) {
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

function computePlacementPhaseRanking(matches: PlacementRankingMatch[]): PlacementRankingRow[] {
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

function formatPhaseType(type: string) {
    if (type === 'GROUP') return 'Poules'
    if (type === 'BRACKET_SINGLE') return 'Bracket simple'
    if (type === 'BRACKET_DOUBLE') return 'Bracket double'
    if (type === 'PLACEMENT_BRACKET') return 'Bracket de placement'
    if (type === 'ROUND_SWISS') return 'Swiss'
    return 'Personnalisee'
}

function comparePitchNames(a: string, b: string) {
    return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
}

function readGroupIndexFromBracketPos(bracketPos: string | null) {
    if (!bracketPos) return null
    const match = bracketPos.match(/^G(\d+)-/)
    if (!match) return null
    const groupIndex = Number(match[1])
    return Number.isInteger(groupIndex) && groupIndex > 0 ? groupIndex : null
}

function formatMatchGroupLabel(phaseType: string | undefined, bracketPos: string | null) {
    if (phaseType !== 'GROUP') return null
    const groupIndex = readGroupIndexFromBracketPos(bracketPos)
    return groupIndex ? `Poule ${groupIndex}` : 'Poule'
}

function readPlanningDefaultsFromLogs(logs: Array<{ actionType: string; payload?: unknown }>) {
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

function isTournamentStatus(value: string): value is TournamentStatus {
    return value in STATUS_META
}


const STATUS_META: Record<TournamentStatus, { label: string; cls: string }> = {
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

function computeGroupStandings(
    groupIndex: number,
    groupConfig: GroupConfig,
    phaseId: string,
    matches: SerializedMatch[],
    teamNameById: Map<string, string>
): GroupStandingRow[] {
    const teamIds = groupConfig.placements
        .filter((p) => p.groupIndex === groupIndex)
        .sort((a, b) => a.slot - b.slot)
        .map((p) => p.teamId)
    const uniqueTeamIds = [...new Set(teamIds)]

    const rows = new Map<string, GroupStandingRow>(
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

function computeGlobalGroupPhaseStandings(
    groupConfig: GroupConfig,
    phaseId: string,
    matches: SerializedMatch[],
    teamNameById: Map<string, string>
) {
    const rowsByTeam = new Map<string, GroupStandingRow & { groupIndex: number | null }>()

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
    const PHASE_STYLES: Record<string, string> = {
        GROUP: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        BRACKET_SINGLE: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
        BRACKET_DOUBLE: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        PLACEMENT_BRACKET: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        ROUND_SWISS: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    };

    const cls = PHASE_STYLES[type] || 'text-slate-400 bg-slate-500/10 border-slate-500/20';

    return (
        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest antialiased ${cls}`}>
            {formatPhaseType(type)}
        </span>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TournamentTabShell({ orgSlug, tournament, availableTeams, matches }: Props) {
    const planningDefaults = readPlanningDefaultsFromLogs(tournament.actionLogs)
    const [nowMs, setNowMs] = useState(() => Date.now())
    const [isAdminPanelCollapsed, setIsAdminPanelCollapsed] = useState(false)
    const [activeTab, setActiveTab] = useState<TabId>('overview')
    const [activeBracketPhaseId, setActiveBracketPhaseId] = useState(() =>
        tournament.phases.find((phase) => ['BRACKET_SINGLE', 'BRACKET_DOUBLE', 'PLACEMENT_BRACKET', 'CUSTOM'].includes(phase.type))?.id ?? ''
    )
    const [phasesStep, setPhasesStep] = useState<1 | 2 | 3>(1)
    const [matchesStep, setMatchesStep] = useState<1 | 2 | 3 | 4>(1)
    const [matchCreateMode, setMatchCreateMode] = useState<'single' | 'bulk'>('single')
    const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([])
    const [standingsOverlay, setStandingsOverlay] = useState<{ phaseId: string; mode: 'groups' | 'global' } | null>(null)
    const [slotTimerMinutes, setSlotTimerMinutes] = useState(planningDefaults.matchMinutes)
    const [slotBreakMinutes, setSlotBreakMinutes] = useState(planningDefaults.breakMinutes)
    const [overlayBgUrl, setOverlayBgUrl] = useState(tournament.bannerUrl ?? '')
    const [overlayBgPreview, setOverlayBgPreview] = useState(tournament.bannerUrl ?? '')
    const [overlayBgUploading, setOverlayBgUploading] = useState(false)
    const [overlayBgUploadError, setOverlayBgUploadError] = useState('')
    const [bulkPitchCreateState, bulkPitchCreateAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => bulkCreateTournamentPitches(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [bulkPitchDeleteState, bulkPitchDeleteAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => bulkDeleteTournamentPitches(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [resetTournamentState, resetTournamentAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => resetTournamentForReconfiguration(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [duplicateTournamentState, duplicateTournamentAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => duplicateTournamentForOrganization(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [slotLaunchState, slotLaunchAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => startTournamentMatchesByScheduleSlot(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [breakTimerState, breakTimerAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => startTournamentBreakTimer(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [placementLabelsState, placementLabelsAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => configurePlacementBracketLabels(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [placementSegmentsState, placementSegmentsAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => configurePlacementBracketRankingSegments(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [customBracketGenerationState, customBracketGenerationAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => generateLinkedBracketMatches(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [overlayBackgroundState, overlayBackgroundAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => updateTournamentOverlayBackground(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [retryPropagationState, retryPropagationAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => retryTournamentPropagation(formData),
        INITIAL_INLINE_ACTION_STATE
    )

    const onOverlayBackgroundChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            setOverlayBgUploadError('Format non supporte. Utilisez PNG, JPEG, WEBP, SVG ou GIF.')
            return
        }
        if (file.size > 8 * 1024 * 1024) {
            setOverlayBgUploadError('Le fichier doit faire moins de 8 Mo.')
            return
        }

        setOverlayBgUploadError('')
        setOverlayBgUploading(true)
        setOverlayBgPreview(URL.createObjectURL(file))

        const supabase = createClient()
        const ext = file.name.split('.').pop() ?? 'png'
        const path = `tournaments/${tournament.id}/overlay-bg-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })

        if (error) {
            if (error.message.toLowerCase().includes('row-level security')) {
                setOverlayBgUploadError('Upload bloque par la policy Supabase Storage (RLS). Verifiez le bucket logos.')
            } else {
                setOverlayBgUploadError('Erreur lors de l upload : ' + error.message)
            }
            setOverlayBgUploading(false)
            return
        }

        const { data } = supabase.storage.from('logos').getPublicUrl(path)
        setOverlayBgUrl(data.publicUrl)
        setOverlayBgPreview(data.publicUrl)
        setOverlayBgUploading(false)
    }

    useEffect(() => {
        const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
        return () => window.clearInterval(interval)
    }, [])

    const bracketPhases = tournament.phases.filter((p) =>
        ['BRACKET_SINGLE', 'BRACKET_DOUBLE', 'PLACEMENT_BRACKET', 'CUSTOM'].includes(p.type)
    )
    const groupPhases = tournament.phases.filter((p) => p.type === 'GROUP')

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
            .filter((item) => item.leaderPhase)
            .sort((a, b) => a.leaderPhase.order - b.leaderPhase.order)
    }, [bracketPhases])

    const bracketSubTabKeys = useMemo(() => {
        const phaseKeys = bracketPhases.map((phase) => phase.id)
        const groupKeys = bracketParallelGroups.map((group) => group.key)
        return [...phaseKeys, ...groupKeys]
    }, [bracketParallelGroups, bracketPhases])

    useEffect(() => {
        if (bracketSubTabKeys.length === 0) {
            if (activeBracketPhaseId !== '') setActiveBracketPhaseId('')
            return
        }
        if (!bracketSubTabKeys.includes(activeBracketPhaseId)) {
            setActiveBracketPhaseId(bracketSubTabKeys[0])
        }
    }, [activeBracketPhaseId, bracketSubTabKeys])

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
            let ids: string[] = []

            if (phase.type === 'GROUP') {
                ids = readGroupConfig(phase.config).placements.map((placement) => placement.teamId)
            } else if (
                phase.type === 'BRACKET_SINGLE' ||
                phase.type === 'BRACKET_DOUBLE' ||
                phase.type === 'PLACEMENT_BRACKET' ||
                phase.type === 'CUSTOM'
            ) {
                ids = matches
                    .filter((m) => m.phaseId === phase.id && m.roundNumber === 1)
                    .flatMap((m) => [m.homeTeamId, m.awayTeamId])
                    .filter((id): id is string => Boolean(id))
            } else {
                ids = matches
                    .filter((m) => m.phaseId === phase.id)
                    .flatMap((m) => [m.homeTeamId, m.awayTeamId])
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
                if (!sourcePhase.isCompleted) continue
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
                    timeZone: 'UTC'
                }),
                matches: [...slotMatches].sort((a, b) => {
                    const pitchCmp = comparePitchNames(a.pitch.name, b.pitch.name)
                    if (pitchCmp !== 0) return pitchCmp
                    return a.phase.name.localeCompare(b.phase.name)
                }),
            }))
        console.log('Schedule by time slots:', slots)

        return {
            slots,
            unscheduled: unscheduled.sort((a, b) => comparePitchNames(a.pitch.name, b.pitch.name)),
        }
    }, [matches])

    const tabs = [
        { id: 'overview' as TabId, label: "Vue d'ensemble" },
        { id: 'phases' as TabId, label: 'Configuration', badge: tournament.phases.length },
        { id: 'registrations' as TabId, label: 'Équipes & Pistes', badge: tournament.registrations.length },
        ...(groupPhases.length > 0 ? [{ id: 'pools' as TabId, label: 'Poules', badge: groupPhases.length }] : []),
        ...(bracketPhases.length > 0 ? [{ id: 'bracket' as TabId, label: 'Brackets', badge: bracketPhases.length }] : []),
        { id: 'planning' as TabId, label: 'Planning pistes', badge: matches.filter((m) => Boolean(m.scheduledAt)).length },
        { id: 'planning-time' as TabId, label: 'Planning horaire', badge: scheduleByTime.slots.length },
        { id: 'matches' as TabId, label: 'Matchs', badge: matches.length },
    ]

    const statusMeta = isTournamentStatus(tournament.status)
        ? STATUS_META[tournament.status]
        : { label: tournament.status, cls: 'bg-slate-700 text-slate-700' }
    const phaseTypeById = useMemo(() => new Map(tournament.phases.map((phase) => [phase.id, phase.type])), [tournament.phases])
    const getMatchGroupLabel = (match: SerializedMatch) => formatMatchGroupLabel(phaseTypeById.get(match.phaseId), match.bracketPos)
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

        const maxAcceptedFutureMs = Date.now() + 5 * 60 * 1000
        const startMs = Number.isFinite(rawStartMs) && rawStartMs <= maxAcceptedFutureMs
            ? rawStartMs
            : (Number.isFinite(createdAtMs) ? createdAtMs : Date.now())

        const timerSeconds = Math.max(0, Math.min(7200, Math.round(payload.timerMinutes * 60)))
        if (timerSeconds <= 0) return null

        return {
            timerSeconds,
            timerStartMs: startMs,
            timerMode: payload.timerKind === 'BREAK' ? 'BREAK' : 'MATCH' as 'MATCH' | 'BREAK',
        }
    }, [latestTimerEvent])

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
                        <span>{tournament._count.registrations}{tournament.maxTeams ? `/${tournament.maxTeams}` : ''} équipes</span>
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
                    <Link
                        href={`/dashboard/org/${orgSlug}/tournaments`}
                        className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-white transition"
                    >
                        ← Retour
                    </Link>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-teal-200">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id
                            ? 'border-teal-600 text-slate-900'
                            : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                    >
                        {tab.label}
                        {tab.badge !== undefined && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${activeTab === tab.id ? 'bg-teal-700 text-white' : 'bg-slate-800 text-white'
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
                                <p className="text-xs uppercase text-slate-500">Équipes</p>
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
                                <p className="mt-2 text-2xl font-black">{pitchGroups.length}</p>
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
                                    <p className="text-sm font-semibold">Inscrire équipes et pistes</p>
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

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Maintenance propagation</h2>
                                <p className="mt-1 text-xs text-slate-500">
                                    Utilisez ce bouton si des qualifiees restent en attente apres une reinitialisation ou un incident de propagation.
                                </p>
                            </div>

                            <form action={retryPropagationAction} className="space-y-3">
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                <input type="hidden" name="force" value="on" />

                                <LoadingSubmitButton
                                    className={`${btnPrimary} w-full md:w-auto disabled:opacity-60`}
                                    loadingLabel="Relance forcee..."
                                >
                                    Forcer la propagation des equipes
                                </LoadingSubmitButton>

                                {retryPropagationState.message && (
                                    <p className={`text-xs ${retryPropagationState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {retryPropagationState.message}
                                    </p>
                                )}
                            </form>

                            {pendingQualifierPhases.length > 0 ? (
                                <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                                    <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                                        Equipes en attente de qualification: {pendingQualifierPhases.reduce((sum, item) => sum + item.pending, 0)}
                                    </p>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {pendingQualifierPhases.map((item) => (
                                            <span key={item.phaseId} className="rounded-md bg-white px-2 py-0.5 text-[11px] text-amber-800 border border-amber-300">
                                                {item.phaseName}: {item.pending}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-3 text-xs text-emerald-700">Aucune equipe en attente de qualification detectee.</p>
                            )}
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-white p-4">
                            <div className="mb-3">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Overlay public</h2>
                                <p className="mt-1 text-xs text-slate-500">Importez une image de fond qui sera reprise automatiquement dans les overlays publics.</p>
                            </div>

                            <form action={overlayBackgroundAction} className="space-y-3">
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                <input type="hidden" name="bannerUrl" value={overlayBgUrl} />

                                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Image de fond overlay</label>
                                    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500 transition hover:border-teal-500 hover:bg-teal-50/30">
                                        {overlayBgPreview ? (
                                            <img src={overlayBgPreview} alt="Apercu fond overlay" className="h-24 w-full rounded object-cover" />
                                        ) : (
                                            <span>Aucune image selectionnee</span>
                                        )}
                                        <span>{overlayBgUploading ? 'Upload en cours...' : 'Cliquer pour importer une image'}</span>
                                        <span className="text-[11px] text-slate-400">PNG, JPEG, WEBP, SVG, GIF - max 8 Mo</span>
                                        <input
                                            type="file"
                                            accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                                            onChange={onOverlayBackgroundChange}
                                            disabled={overlayBgUploading}
                                            className="hidden"
                                        />
                                    </label>
                                    {overlayBgUploadError && <p className="mt-2 text-xs text-red-700">{overlayBgUploadError}</p>}
                                </div>

                                <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                                    <input
                                        value={overlayBgUrl}
                                        onChange={(event) => {
                                            setOverlayBgUrl(event.target.value)
                                            setOverlayBgPreview(event.target.value)
                                        }}
                                        className={inputCls}
                                        placeholder="https://..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setOverlayBgUrl('')
                                            setOverlayBgPreview('')
                                            setOverlayBgUploadError('')
                                        }}
                                        className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                    >
                                        Retirer
                                    </button>
                                    <LoadingSubmitButton
                                        className={`${btnPrimary} w-full disabled:opacity-60`}
                                        disabled={overlayBgUploading}
                                        loadingLabel="Enregistrement..."
                                    >
                                        Sauvegarder
                                    </LoadingSubmitButton>
                                </div>

                                {overlayBackgroundState.message && (
                                    <p className={`text-xs ${overlayBackgroundState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {overlayBackgroundState.message}
                                    </p>
                                )}
                            </form>
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
                                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${phase.isCompleted
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
                                                            <span className="ml-auto text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-md">Terminée</span>
                                                        )}
                                                    </div>
                                                    <p className="mb-2 text-xs text-slate-500">
                                                        {stats.finished}/{stats.total} matchs terminés
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
                                                                <span
                                                                    key={i}
                                                                    className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-dark antialiased"
                                                                >
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
                                                <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                                    {log.actionType}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                {new Date(log.createdAt).toLocaleString('fr-FR', { timeZone: 'UTC' })}
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
                                        className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${isActive
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
                                        ? 'Verifiez les stats de matchs, les routes de qualification et les équipes en attente avant de cloturer.'
                                        : 'Cloturez chaque phase pour propager les qualifies vers la suite du tournoi. Utilisez Forcer la cloture si necessaire.'}
                            </p>
                        </div>

                        <div className="grid gap-3 lg:grid-cols-2">
                            <form
                                action={resetTournamentAction}
                                className="space-y-2 rounded-lg border border-red-200 bg-white p-3"
                                onSubmit={(event) => {
                                    const ok = window.confirm('Reinitialiser ce tournoi ? Les matchs seront supprimes et les phases decloturees. Cette action est irreversible.')
                                    if (!ok) event.preventDefault()
                                }}
                            >
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Reinitialisation tournoi</p>
                                <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                    <input name="resetRegistrations" type="checkbox" defaultChecked className="h-4 w-4 accent-red-600" />
                                    Supprimer aussi les inscriptions
                                </label>
                                <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                    <input name="resetPitches" type="checkbox" defaultChecked className="h-4 w-4 accent-red-600" />
                                    Supprimer aussi les pistes
                                </label>
                                <LoadingSubmitButton
                                    className="w-full rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                                    loadingLabel="Reinitialisation..."
                                >
                                    Reinitialiser le tournoi
                                </LoadingSubmitButton>
                                {resetTournamentState.message && (
                                    <p className={`text-[11px] ${resetTournamentState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {resetTournamentState.message}
                                    </p>
                                )}
                            </form>

                            <form action={duplicateTournamentAction} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Duplication tournoi</p>
                                <input
                                    name="targetName"
                                    defaultValue={`${tournament.name} (copie)`}
                                    className={inputCls}
                                    placeholder="Nom du tournoi duplique"
                                    required
                                />
                                <input
                                    name="targetSlug"
                                    defaultValue={`${tournament.slug}-copie`}
                                    className={inputCls}
                                    placeholder="slug-tournoi-copie"
                                    required
                                />
                                <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                    <input name="includePitches" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                    Dupliquer aussi les pistes
                                </label>
                                <LoadingSubmitButton
                                    className="w-full rounded-md border border-teal-300 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-60"
                                    loadingLabel="Duplication..."
                                >
                                    Dupliquer ce tournoi
                                </LoadingSubmitButton>
                                {duplicateTournamentState.message && (
                                    <p className={`text-[11px] ${duplicateTournamentState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                        {duplicateTournamentState.message}
                                    </p>
                                )}
                            </form>
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
                                    const isGroupPhase = phase.type === 'GROUP'
                                    const seededTeams = seededTeamsByPhase.get(phase.id) ?? []
                                    const incomingQualifiers = incomingQualifiersByPhase.get(phase.id) ?? []
                                    const waitingQualifierCount = Math.max(0, incomingQualifiers.length - seededTeams.length)
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

                                            {isGroupPhase && (
                                                <div className="mb-3 grid gap-2 sm:grid-cols-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setStandingsOverlay({ phaseId: phase.id, mode: 'groups' })}
                                                        className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                                    >
                                                        Voir classement par poule
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => setStandingsOverlay({ phaseId: phase.id, mode: 'global' })}
                                                        className="rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-left text-[11px] font-medium text-teal-700 hover:bg-teal-100"
                                                    >
                                                        Voir classement global phase
                                                    </button>
                                                </div>
                                            )}

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

                                            {(seededTeams.length > 0 || waitingQualifierCount > 0) && (
                                                <div className="mb-3 space-y-2 rounded-lg border border-teal-600/30 bg-teal-50 p-2">
                                                    {seededTeams.length > 0 && (
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wider text-teal-700">Équipes placees sur cette phase</p>
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {seededTeams.map((teamId) => (
                                                                    <span key={`${phase.id}-seeded-${teamId}`} className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] text-white">
                                                                        {teamNameById.get(teamId) ?? teamId}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                    {waitingQualifierCount > 0 && (
                                                        <div>
                                                            <p className="text-[10px] uppercase tracking-wider text-amber-700">Qualifiees detectees (a placer)</p>
                                                            <p className="mt-1 text-[11px] text-amber-700">
                                                                {waitingQualifierCount} place(s) d'entree encore vide(s) pour {incomingQualifiers.length} qualifiee(s) detectee(s).
                                                            </p>
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
                                                            <LoadingSubmitButton
                                                                className="w-full rounded-md border border-teal-600/40 px-2 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-600/10 transition-colors disabled:opacity-60"
                                                                loadingLabel="Cloture en cours..."
                                                            >
                                                                Cloturer et propager les qualifies →
                                                            </LoadingSubmitButton>
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
                            <p className="mt-1">Suivez ces etapes pour preparer votre tournoi : inscrivez les équipes, confirmez leur participation, puis configurez les pistes de jeu disponibles.</p>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            {/* Step 1: Inscriptions */}
                            <StepSection num={1} title="Inscrire les équipes" desc="Ajoutez les équipes participantes et confirmez leur inscription.">
                                <form action={va(addTournamentRegistration)} className="grid gap-2 md:grid-cols-2">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <select
                                        name="teamIds"
                                        className="w-full rounded-lg border border-slate-200 bg-white p-1 text-sm text-slate-700 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 md:col-span-2 min-h-40 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent shadow-sm"
                                        required
                                        multiple
                                        size={Math.min(10, Math.max(4, availableTeams.length))}
                                    >
                                        {availableTeams.map((team) => (
                                            <option
                                                key={team.id}
                                                value={team.id}
                                                className="py-2 px-3 bg-white text-slate-600 checked:bg-teal-500 checked:text-white hover:bg-teal-50 cursor-pointer border-b border-slate-50 last:border-0"
                                            >
                                                {team.name}
                                            </option>
                                        ))}
                                    </select>
                                    <p className="md:col-span-2 text-xs text-slate-500">
                                        Multi-selection: maintenez Ctrl (Windows) ou Cmd (Mac), puis cliquez sur les équipes a inscrire.
                                    </p>
                                    <input type="number" name="seed" min={1} placeholder="Seed (optionnel)" className={inputCls} />
                                    <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                        <input name="isConfirmed" type="checkbox" className="h-4 w-4 accent-teal-600" />
                                        Confirmer directement
                                    </label>
                                    <LoadingSubmitButton
                                        className={`${btnPrimary} md:col-span-2 disabled:opacity-60`}
                                        disabled={availableTeams.length === 0}
                                        loadingLabel="Ajout en cours..."
                                    >
                                        {availableTeams.length === 0 ? 'Toutes les équipes sont inscrites' : 'Ajouter les équipes'}
                                    </LoadingSubmitButton>
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
                                                <div className="flex items-center gap-2">
                                                    <form action={va(updateTournamentRegistrationConfirmation)}>
                                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                        <input type="hidden" name="registrationId" value={reg.id} />
                                                        <input type="hidden" name="isConfirmed" value={reg.isConfirmed ? 'false' : 'true'} />
                                                        <LoadingSubmitButton
                                                            className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${reg.isConfirmed
                                                                ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                                                : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                                                }`}
                                                            loadingLabel={reg.isConfirmed ? 'Deconfirmation...' : 'Confirmation...'}
                                                        >
                                                            {reg.isConfirmed ? 'Deconfirmer' : 'Confirmer'}
                                                        </LoadingSubmitButton>
                                                    </form>

                                                    <form action={va(removeTournamentRegistration)}>
                                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                        <input type="hidden" name="registrationId" value={reg.id} />
                                                        <LoadingSubmitButton className={`${btnDanger} disabled:opacity-60`} loadingLabel="Retrait...">Retirer</LoadingSubmitButton>
                                                    </form>
                                                </div>
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
                                    <LoadingSubmitButton className={`${btnPrimary} disabled:opacity-60`} loadingLabel="Ajout...">Ajouter</LoadingSubmitButton>
                                </form>

                                <div className="grid gap-2 md:grid-cols-2">
                                    <form action={bulkPitchCreateAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ajout massif</p>
                                        <textarea
                                            name="pitchNames"
                                            rows={5}
                                            className={`${inputCls} min-h-28 w-full`}
                                            placeholder={'Ex: Piste A\nPiste B\nPiste C'}
                                            required
                                        />
                                        <select
                                            name="phaseIds"
                                            className={`${inputCls} min-h-24 w-full`}
                                            multiple
                                            size={Math.min(6, Math.max(3, tournament.phases.length))}
                                        >
                                            {tournament.phases.map((phase) => (
                                                <option key={`bulk-create-phase-${phase.id}`} value={phase.id}>{phase.name}</option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-slate-500">Un nom par ligne (ou separe par virgule). Sans phase selectionnee = pistes globales.</p>
                                        <LoadingSubmitButton className={`${btnPrimary} w-full disabled:opacity-60`} loadingLabel="Ajout massif...">
                                            Ajouter en masse
                                        </LoadingSubmitButton>

                                        {bulkPitchCreateState.message && (
                                            <p className={`text-[11px] ${bulkPitchCreateState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                {bulkPitchCreateState.message}
                                            </p>
                                        )}
                                    </form>

                                    <form action={bulkPitchDeleteAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Suppression massive</p>
                                        <select
                                            name="pitchIds"
                                            className={`${inputCls} min-h-40 w-full`}
                                            multiple
                                            size={Math.min(10, Math.max(4, tournament.pitches.length))}
                                            required
                                        >
                                            {tournament.pitches.map((pitch) => (
                                                <option key={`bulk-delete-pitch-${pitch.id}`} value={pitch.id}>
                                                    {pitch.name} • {pitch.phase?.name || 'Toutes phases'}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-[11px] text-slate-500">Multi-selection via Ctrl/Cmd + clic. Les pistes deja liees a des matchs seront ignorees.</p>
                                        <LoadingSubmitButton
                                            className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                                            loadingLabel="Suppression massive..."
                                        >
                                            Supprimer la selection
                                        </LoadingSubmitButton>

                                        {bulkPitchDeleteState.message && (
                                            <p className={`text-[11px] ${bulkPitchDeleteState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                {bulkPitchDeleteState.message}
                                            </p>
                                        )}
                                    </form>
                                </div>

                                <div className="mt-2 space-y-1.5">
                                    {tournament.pitches.length === 0 ? (
                                        <p className="text-center text-xs text-slate-500 py-4">Aucune piste configuree. Ajoutez au moins une piste avant de generer des matchs.</p>
                                    ) : (
                                        pitchGroups.map((pitchGroup) => (
                                            <div key={`pitch-group-${pitchGroup.name}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div>
                                                    <p className="text-sm font-semibold">{pitchGroup.name}</p>
                                                    <p className="text-xs text-slate-500">
                                                        Phases : {pitchGroup.hasGlobal ? 'Toutes' : pitchGroup.phaseNames.join(', ')}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500">
                                                        {pitchGroup.pitchIds.length} association(s)
                                                    </p>
                                                </div>
                                                <form action={bulkPitchDeleteAction}>
                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                    {pitchGroup.pitchIds.map((pitchId) => (
                                                        <input key={`del-pitch-group-${pitchGroup.name}-${pitchId}`} type="hidden" name="pitchIds" value={pitchId} />
                                                    ))}
                                                    <LoadingSubmitButton className={`${btnDanger} disabled:opacity-60`} loadingLabel="Suppression...">Supprimer le groupe</LoadingSubmitButton>
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
                            <p className="mt-1">Suivez les 4 etapes ci-dessous pour chaque phase de type poules. Commencez par configurer le nombre de poules, placez les équipes, generez les matchs, puis suivez les classements en direct.</p>
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
                                        <StepSection num={1} title="Configurer les poules" desc="Definissez le nombre de groupes et le nombre d'équipes par groupe.">
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
                                                    <label className="mb-1.5 block text-xs font-medium text-slate-500">
                                                        Équipes par poule
                                                    </label>                                                    <input
                                                        name="teamsPerGroup" type="number" min={2} max={64}
                                                        defaultValue={groupConfig.teamsPerGroup}
                                                        className={`${inputCls} w-full`}
                                                        placeholder="Ex : 4"
                                                    />
                                                </div>
                                                <div className="flex items-end">
                                                    <LoadingSubmitButton className={`${btnPrimary} w-full disabled:opacity-60`} loadingLabel="Enregistrement...">Enregistrer la configuration</LoadingSubmitButton>
                                                </div>
                                            </form>
                                            <p className="text-[11px] text-slate-500">
                                                Configuration actuelle : {groupConfig.count} poule(s) de {groupConfig.teamsPerGroup} equipe(s)
                                            </p>
                                        </StepSection>

                                        {/* Step 2: Placement */}
                                        <StepSection num={2} title="Placer les équipes" desc="Utilisez le placement automatique (seeding serpentin) ou placez les équipes manuellement en drag-and-drop." color="cyan">
                                            <form action={va(autoPlaceGroupTeams)} className="flex flex-wrap items-center gap-2">
                                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                <input type="hidden" name="phaseId" value={phase.id} />
                                                <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                                    <input name="confirmedOnly" type="checkbox" className="h-4 w-4 accent-teal-600" />
                                                    Équipes confirmees uniquement
                                                </label>
                                                <LoadingSubmitButton className={`${btnGhost} disabled:opacity-60`} loadingLabel="Placement...">
                                                    ↺ Auto-placer (serpentin)
                                                </LoadingSubmitButton>
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
                                                    <label className="mb-1 block text-xs text-slate-500">Battement général (min)</label>
                                                    <input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} className={`${inputCls} w-full`} />
                                                </div>
                                                <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                    <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                                    <span className="text-amber-200">Ecraser matchs</span>
                                                </label>
                                                <div className="flex items-end">
                                                    <LoadingSubmitButton
                                                        className={`${btnGhost} w-full border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60`}
                                                        loadingLabel="Generation..."
                                                    >
                                                        Generer les matchs
                                                    </LoadingSubmitButton>
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
                                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
                                    {bracketPhases.map((phase) => (
                                        <button
                                            key={`bracket-tab-${phase.id}`}
                                            type="button"
                                            onClick={() => setActiveBracketPhaseId(phase.id)}
                                            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                                (activeBracketPhaseId || bracketPhases[0]?.id) === phase.id
                                                    ? 'border-teal-600 bg-teal-50 text-teal-700'
                                                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            {phase.name}
                                        </button>
                                    ))}
                                    {bracketParallelGroups.map((group) => (
                                        <button
                                            key={`bracket-group-tab-${group.group}`}
                                            type="button"
                                            onClick={() => setActiveBracketPhaseId(group.key)}
                                            className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${
                                                activeBracketPhaseId === group.key
                                                    ? 'border-cyan-600 bg-cyan-50 text-cyan-700'
                                                    : 'border-cyan-300 bg-white text-cyan-700 hover:bg-cyan-50'
                                            }`}
                                        >
                                            Groupe {group.group}
                                        </button>
                                    ))}
                                </div>

                                {activeBracketPhaseId.startsWith('group:') && (() => {
                                    const groupName = activeBracketPhaseId.slice('group:'.length)
                                    const group = bracketParallelGroups.find((item) => item.group === groupName)
                                    if (!group) return null

                                    const leaderPhase = group.leaderPhase

                                    return (
                                        <StepSection
                                            num={1}
                                            title={`Generer les brackets lies (${group.group})`}
                                            desc="Un seul formulaire pour generer tous les brackets et matchs de ce groupe parallele."
                                            color="cyan"
                                        >
                                            <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                                                Phases incluses: {group.phases.map((phase) => phase.name).join(' • ')}
                                            </div>
                                            <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                                                {group.phases.map((phase) => {
                                                    const resolvedCount = (incomingQualifiersByPhase.get(phase.id) ?? []).length
                                                    const expectedCount = expectedIncomingQualifierCountByPhase.get(phase.id) ?? 0
                                                    const placedCount = (seededTeamsByPhase.get(phase.id) ?? []).length
                                                    const waitingPropagation = expectedCount > 0 && resolvedCount === 0

                                                    return (
                                                        <div key={`linked-group-phase-${phase.id}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                                                            <p className="font-semibold text-slate-900">{phase.name}</p>
                                                            <p className="mt-1">Equipes attendues via routes: <span className="font-semibold text-slate-900">{expectedCount}</span></p>
                                                            <p>Qualifiees resolues maintenant: <span className="font-semibold text-slate-900">{resolvedCount}</span></p>
                                                            <p>Equipes deja placees: <span className="font-semibold text-slate-900">{placedCount}</span></p>
                                                            {waitingPropagation && (
                                                                <p className="mt-1 text-[11px] text-amber-700">
                                                                    En attente de propagation/seed depuis la phase precedente. La structure peut etre generee maintenant, puis alimentee ensuite.
                                                                </p>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                            <form action={customBracketGenerationAction} className="grid gap-2 md:grid-cols-10">
                                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                <input type="hidden" name="phaseId" value={leaderPhase.id} />
                                                <input type="hidden" name="includeLinked" value="on" />

                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                                                    <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Duree max (min)</label>
                                                    <input
                                                        name="maxDurationMinutes"
                                                        type="number"
                                                        min={5}
                                                        max={600}
                                                        defaultValue={planningDefaults.matchMinutes}
                                                        className={`${inputCls} w-full`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Battement général (min)</label>
                                                    <input
                                                        name="teamBreakMinutes"
                                                        type="number"
                                                        min={0}
                                                        max={240}
                                                        defaultValue={planningDefaults.breakMinutes}
                                                        className={`${inputCls} w-full`}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="mb-1 block text-xs text-slate-500">Roulement des brackets</label>
                                                    <select name="rotationMode" defaultValue="sequential" className={`${inputCls} w-full`}>
                                                        <option value="sequential">Sequentiel (bracket par bracket)</option>
                                                        <option value="interleaved">Entrelacer (alterner les brackets)</option>
                                                    </select>
                                                </div>
                                                <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                    <input name="includeLosersReplay" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                                    Perdants rejouent (classement complet)
                                                </label>
                                                <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                    <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                                    <span className="text-amber-700">Ecraser les matchs</span>
                                                </label>
                                                <div className="md:col-span-3 flex items-end gap-2">
                                                    <LoadingSubmitButton className={`${btnGhost} w-full disabled:opacity-60`} loadingLabel="Generation...">
                                                        Generer tous les brackets lies ({group.group})
                                                    </LoadingSubmitButton>
                                                </div>

                                                {customBracketGenerationState.message && (
                                                    <p className={`md:col-span-10 text-[11px] ${customBracketGenerationState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                        {customBracketGenerationState.message}
                                                    </p>
                                                )}
                                            </form>
                                        </StepSection>
                                    )
                                })()}

                                {(bracketPhases.find((phase) => phase.id === (activeBracketPhaseId || bracketPhases[0]?.id)) ? [bracketPhases.find((phase) => phase.id === (activeBracketPhaseId || bracketPhases[0]?.id)) as PhaseData] : []).map((phase) => {
                                    const phaseMatches = matches
                                        .filter((m) => m.phaseId === phase.id)
                                        .map((m) => ({
                                            id: m.id,
                                            homeTeamId: m.homeTeamId,
                                            awayTeamId: m.awayTeamId,
                                            roundNumber: m.roundNumber,
                                            bracketPos: m.bracketPos,
                                            scheduledAt: m.scheduledAt,
                                            pitchName: m.pitch?.name ?? null,
                                            status: m.status as 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED',
                                            homeTeamName: m.homeTeam?.name || 'TBD',
                                            awayTeamName: m.awayTeam?.name || 'TBD',
                                            homeScore: m.result?.homeScore ?? null,
                                            awayScore: m.result?.awayScore ?? null,
                                        }))
                                    const phaseParallelGroup = readParallelGroup(phase.config)
                                    const canGenerateThisPhase = !phaseParallelGroup
                                    const incomingQualifierCount = (incomingQualifiersByPhase.get(phase.id) ?? []).length
                                    const defaultParticipantsCount = Math.max(incomingQualifierCount, 8)

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
                                                tournamentId={tournament.id}
                                                orgSlug={orgSlug}
                                                tournamentSlug={tournament.slug}
                                                phase={{ id: phase.id, name: phase.name, type: phase.type, order: phase.order, config: phase.config }}
                                                matches={phaseMatches}
                                                timer={bracketTimerContext}
                                            />

                                            {(phase.type === 'CUSTOM' || phase.type === 'PLACEMENT_BRACKET') && canGenerateThisPhase && (
                                                <StepSection num={1} title="Generer la structure du bracket personnalise" desc="Definissez le nombre de participants. Pour un bracket a placement, vous pouvez aussi configurer les plages de classement.">
                                                    <form action={customBracketGenerationAction} className="grid gap-2 md:grid-cols-10">
                                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                        <input type="hidden" name="phaseId" value={phase.id} />
                                                        {phaseParallelGroup && <input type="hidden" name="includeLinked" value="on" />}
                                                        <div>
                                                            <label className="mb-1 block text-xs text-slate-500">Participants</label>
                                                            <input
                                                                name="participantsCount"
                                                                type="number"
                                                                min={4}
                                                                max={64}
                                                                defaultValue={defaultParticipantsCount}
                                                                className={`${inputCls} w-full`}
                                                            />
                                                            {incomingQualifierCount > 0 && (
                                                                <p className="mt-1 text-[11px] text-slate-500">
                                                                    {incomingQualifierCount} equipe(s) qualifiee(s) detectee(s) pour cette phase.
                                                                </p>
                                                            )}
                                                        </div>
                                                        <div>
                                                            <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                                                            <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1 block text-xs text-slate-500">Duree max (min)</label>
                                                            <input
                                                                name="maxDurationMinutes"
                                                                type="number"
                                                                min={5}
                                                                max={600}
                                                                defaultValue={planningDefaults.matchMinutes}
                                                                className={`${inputCls} w-full`}
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="mb-1 block text-xs text-slate-500">Battement général (min)</label>
                                                            <input
                                                                name="teamBreakMinutes"
                                                                type="number"
                                                                min={0}
                                                                max={240}
                                                                defaultValue={planningDefaults.breakMinutes}
                                                                className={`${inputCls} w-full`}
                                                            />
                                                        </div>
                                                        {phase.type === 'PLACEMENT_BRACKET' && (
                                                            <div className="md:col-span-2">
                                                                <label className="mb-1 block text-xs text-slate-500">Plages de classement</label>
                                                                <input
                                                                    name="placementRanges"
                                                                    className={`${inputCls} w-full`}
                                                                    placeholder="Optionnel. Ex: 25-32, 21-24, 19-20"
                                                                />
                                                                <p className="mt-1 text-[11px] text-slate-500">
                                                                    Laissez vide pour generer automatiquement les plages obligatoires (recommande). Format manuel: start-end, separes par virgule.
                                                                </p>
                                                            </div>
                                                        )}
                                                        <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                            <input name="includeLosersReplay" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                                            Perdants rejouent (classement complet)
                                                        </label>
                                                        <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                            <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                                            <span className="text-amber-700">Ecraser les matchs</span>
                                                        </label>
                                                        <div className="md:col-span-3 flex items-end gap-2">
                                                            <LoadingSubmitButton className={`${btnGhost} w-full disabled:opacity-60`} loadingLabel="Generation...">
                                                                {phaseParallelGroup
                                                                    ? `Generer tous les brackets lies (${phaseParallelGroup})`
                                                                    : 'Generer ce bracket'}
                                                            </LoadingSubmitButton>
                                                        </div>

                                                        {customBracketGenerationState.message && (
                                                            <p className={`md:col-span-10 text-[11px] ${customBracketGenerationState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                {customBracketGenerationState.message}
                                                            </p>
                                                        )}
                                                    </form>

                                                    {phase.type === 'PLACEMENT_BRACKET' && (() => {
                                                        const ranges = readPlacementRangesFromMatches(phaseMatches)
                                                        const labels = readPlacementLabels(phase.config)
                                                        const segments = readPlacementRankingSegments(phase.config)
                                                        const rankingRows = computePlacementPhaseRanking(phaseMatches)
                                                        const maxPlacementEnd = phaseMatches.reduce((max, match) => {
                                                            const parsed = parsePlacementBracketPos(match.bracketPos)
                                                            return parsed ? Math.max(max, parsed.end) : max
                                                        }, 0)
                                                        const rankingSegments = segments.length > 0
                                                            ? segments
                                                            : [{ start: 1, end: Math.max(2, maxPlacementEnd || rankingRows.at(-1)?.rank || 2), label: 'Classement global' }]
                                                        const segmentsText = segments.length > 0
                                                            ? segments.map((segment) => `${segment.start}-${segment.end}: ${segment.label}`).join('\n')
                                                            : '1-15: Bracket principal\n16-32: Bracket placement 2'

                                                        if (ranges.length === 0) {
                                                            return (
                                                                <p className="mt-2 text-[11px] text-slate-500">
                                                                    Generez d'abord le bracket de placement pour personnaliser les noms des sous-brackets.
                                                                </p>
                                                            )
                                                        }

                                                        return (
                                                            <div className="mt-3 space-y-3">
                                                                <div className="rounded-lg border border-slate-200 bg-white p-3">
                                                                    <div className="mb-2 flex items-center justify-between">
                                                                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                                            Classement global de la phase
                                                                        </p>
                                                                        <span className="text-[11px] text-slate-500">
                                                                            {rankingRows.length} place(s) resolue(s)
                                                                        </span>
                                                                    </div>

                                                                    <div className="space-y-3">
                                                                        {rankingSegments.map((segment) => {
                                                                            const rows = rankingRows.filter((row) => row.rank >= segment.start && row.rank <= segment.end)
                                                                            return (
                                                                                <div key={`ranking-segment-${phase.id}-${segment.start}-${segment.end}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                                                    <div className="mb-1 flex items-center justify-between gap-2">
                                                                                        <p className="text-xs font-semibold text-slate-700">
                                                                                            {segment.label}
                                                                                        </p>
                                                                                        <span className="text-[11px] text-slate-500">
                                                                                            Places {segment.start}-{segment.end}
                                                                                        </span>
                                                                                    </div>

                                                                                    {rows.length === 0 ? (
                                                                                        <p className="text-[11px] text-slate-500">
                                                                                            Aucune place finalisee sur ce segment pour le moment.
                                                                                        </p>
                                                                                    ) : (
                                                                                        <div className="overflow-x-auto">
                                                                                            <table className="min-w-full text-left text-[11px] text-slate-600">
                                                                                                <thead>
                                                                                                    <tr className="border-b border-slate-200 text-slate-500">
                                                                                                        <th className="px-1 py-1 font-semibold">Place</th>
                                                                                                        <th className="px-1 py-1 font-semibold">Equipe</th>
                                                                                                        <th className="px-1 py-1 font-semibold">Source</th>
                                                                                                    </tr>
                                                                                                </thead>
                                                                                                <tbody>
                                                                                                    {rows.map((row) => (
                                                                                                        <tr key={`ranking-row-${phase.id}-${row.rank}`} className="border-b border-slate-100 last:border-b-0">
                                                                                                            <td className="px-1 py-1 font-semibold text-slate-700">#{row.rank}</td>
                                                                                                            <td className="px-1 py-1">{row.teamName}</td>
                                                                                                            <td className="px-1 py-1 text-slate-500">{row.source}</td>
                                                                                                        </tr>
                                                                                                    ))}
                                                                                                </tbody>
                                                                                            </table>
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>

                                                            <div className="grid gap-3 xl:grid-cols-2">
                                                                <form action={placementLabelsAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                                    <input type="hidden" name="phaseId" value={phase.id} />

                                                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                                        Renommer les sous-brackets de placement
                                                                    </p>

                                                                    <div className="grid gap-2 md:grid-cols-2">
                                                                        {ranges.map((range) => (
                                                                            <div key={`placement-label-${phase.id}-${range.key}`}>
                                                                                <label className="mb-1 block text-xs text-slate-500">Range {range.start}-{range.end}</label>
                                                                                <input
                                                                                    name={`placementLabel_${range.start}_${range.end}`}
                                                                                    defaultValue={labels[range.key] || defaultPlacementLabel(range.start, range.end)}
                                                                                    className={`${inputCls} w-full`}
                                                                                    placeholder={defaultPlacementLabel(range.start, range.end)}
                                                                                />
                                                                            </div>
                                                                        ))}
                                                                    </div>

                                                                    <div className="flex items-center justify-between gap-2">
                                                                        {placementLabelsState.message && (
                                                                            <p className={`text-[11px] ${placementLabelsState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                                {placementLabelsState.message}
                                                                            </p>
                                                                        )}
                                                                        <div className="ml-auto">
                                                                            <LoadingSubmitButton className={`${btnGhost} disabled:opacity-60`} loadingLabel="Enregistrement...">
                                                                                Enregistrer les noms
                                                                            </LoadingSubmitButton>
                                                                        </div>
                                                                    </div>
                                                                </form>

                                                                <form action={placementSegmentsAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                                    <input type="hidden" name="phaseId" value={phase.id} />

                                                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                                        Associer des brackets pour le classement
                                                                    </p>

                                                                    <textarea
                                                                        name="segmentsText"
                                                                        rows={5}
                                                                        defaultValue={segmentsText}
                                                                        className={`${inputCls} min-h-28 w-full`}
                                                                        placeholder={'Ex:\n1-15: Bracket principal\n16-32: Bracket placement 2'}
                                                                    />
                                                                    <p className="text-[11px] text-slate-500">
                                                                        Un segment par ligne. Format: start-end: Nom du segment.
                                                                    </p>

                                                                    <div className="flex items-center justify-between gap-2">
                                                                        {placementSegmentsState.message && (
                                                                            <p className={`text-[11px] ${placementSegmentsState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                                {placementSegmentsState.message}
                                                                            </p>
                                                                        )}
                                                                        <div className="ml-auto">
                                                                            <LoadingSubmitButton className={`${btnGhost} disabled:opacity-60`} loadingLabel="Enregistrement...">
                                                                                Enregistrer les associations
                                                                            </LoadingSubmitButton>
                                                                        </div>
                                                                    </div>
                                                                </form>
                                                            </div>
                                                            </div>
                                                        )
                                                    })()}
                                                </StepSection>
                                            )}

                                            {(phase.type === 'CUSTOM' || phase.type === 'PLACEMENT_BRACKET') && !canGenerateThisPhase && phaseParallelGroup && (
                                                <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-3 text-xs text-cyan-800">
                                                    Cette phase est liee au groupe <span className="font-semibold">{phaseParallelGroup}</span>. Utilisez l'onglet de groupe parallele pour generer tous les brackets lies en une seule fois.
                                                </div>
                                            )}

                                            {phaseMatches.some((m) => m.roundNumber === 1) && (
                                                <StepSection
                                                    num={2}
                                                    title="Verifier/ajuster les équipes avant lancement"
                                                    desc="Les équipes du round 1 sont auto-assignees a la generation du bracket. Vous pouvez les corriger ici avant le debut des matchs."
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
                                                    <div key={`${pitch.pitchName}-${slot.slotStart}`} className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                                                        {/* Header minimaliste */}
                                                        <div className="flex items-center gap-2 mb-1 px-1">
                                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">{slot.label}</span>
                                                        </div>

                                                        <div className="flex flex-col gap-0.5">
                                                            {slot.matches.map((match) => {
                                                                const groupLabel = getMatchGroupLabel(match);
                                                                return (
                                                                    <div key={`slot-${match.id}`} className="group flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-slate-50 transition-colors">

                                                                        {/* Gauche : Équipes & Poule */}
                                                                        <div className="flex items-center gap-2 overflow-hidden">
                                                                            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 truncate">
                                                                                <span className="truncate max-w-[80px] md:max-w-[120px]">{match.homeTeam?.name || 'TBD'}</span>
                                                                                <span className="text-[10px] text-slate-300 font-normal italic">vs</span>
                                                                                <span className="truncate max-w-[80px] md:max-w-[120px]">{match.awayTeam?.name || 'TBD'}</span>
                                                                            </div>

                                                                            {groupLabel && (
                                                                                <span className="text-[9px] font-bold text-emerald-600/80 px-1 border-l border-emerald-100 ml-1">
                                                                                    {groupLabel}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                        {/* Droite : Phase & Heure (Focus uniquement sur l'essentiel) */}
                                                                        <div className="flex items-center gap-2 shrink-0">
                                                                            <span className="text-[10px] text-slate-400">
                                                                                {match.phase.name.split(' ')[0]} {match.roundNumber ? `• R${match.roundNumber}` : ''}
                                                                            </span>
                                                                            {match.scheduledAt && (
                                                                                <span className="text-[11px] font-bold text-slate-600">
                                                                                    {new Date(match.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                                                </span>
                                                                            )}
                                                                        </div>

                                                                    </div>
                                                                );
                                                            })}
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
                                                            {match.phase.name}
                                                            {getMatchGroupLabel(match) ? ` • ${getMatchGroupLabel(match)}` : ''}: {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
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
                            <div className="mt-3 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[auto_120px] md:items-center">
                                <p className="text-[11px] uppercase tracking-wider text-slate-500">Timer overlay poules (minutes)</p>
                                <input
                                    type="number"
                                    min={1}
                                    max={600}
                                    value={slotTimerMinutes}
                                    onChange={(event) => {
                                        const next = Number.parseInt(event.target.value, 10)
                                        if (!Number.isFinite(next)) return
                                        setSlotTimerMinutes(Math.min(600, Math.max(1, next)))
                                    }}
                                    className={`${inputCls} w-full`}
                                />
                            </div>
                            <div className="mt-2 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 md:grid-cols-[auto_120px_auto] md:items-center">
                                <p className="text-[11px] uppercase tracking-wider text-slate-500">Temps de battement (minutes)</p>
                                <input
                                    type="number"
                                    min={1}
                                    max={240}
                                    value={slotBreakMinutes}
                                    onChange={(event) => {
                                        const next = Number.parseInt(event.target.value, 10)
                                        if (!Number.isFinite(next)) return
                                        setSlotBreakMinutes(Math.min(240, Math.max(1, next)))
                                    }}
                                    className={`${inputCls} w-full`}
                                />
                                <form action={breakTimerAction} className="md:justify-self-end">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <input type="hidden" name="breakMinutes" value={String(slotBreakMinutes)} />
                                    <LoadingSubmitButton
                                        className="rounded-md border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50"
                                        loadingLabel="Bascule..."
                                    >
                                        Terminer timer vers battement
                                    </LoadingSubmitButton>
                                </form>
                            </div>
                            {slotLaunchState.message && (
                                <p className={`mt-2 rounded-md border px-2 py-1 text-[11px] ${slotLaunchState.success
                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                                    }`}>
                                    {slotLaunchState.message}
                                </p>
                            )}
                            {breakTimerState.message && (
                                <p className={`mt-2 rounded-md border px-2 py-1 text-[11px] ${breakTimerState.success
                                    ? 'border-amber-200 bg-amber-50 text-amber-700'
                                    : 'border-red-200 bg-red-50 text-red-700'
                                    }`}>
                                    {breakTimerState.message}
                                </p>
                            )}
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
                                    scheduleByTime.slots.map((slot) => {
                                        const startableMatches = slot.matches.filter((match) => match.status === 'SCHEDULED')
                                        const slotIso = new Date(slot.at).toISOString()
                                        const overlayParams = new URLSearchParams({
                                            timer: String(slotTimerMinutes * 60),
                                            startedAt: new Date().toISOString(),
                                        })

                                        return (
                                        <div key={`planning-time-${slot.at}`} className="rounded-xl border border-slate-200 bg-white p-3">
                                            <div className="mb-2 flex items-center justify-between">
                                                <p className="text-sm font-bold text-amber-700">{slot.label}</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[11px] text-slate-500">{slot.matches.length} match(s)</span>
                                                    <form action={slotLaunchAction}>
                                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                        <input type="hidden" name="slotAt" value={slotIso} />
                                                        <input type="hidden" name="timerMinutes" value={String(slotTimerMinutes)} />
                                                        <LoadingSubmitButton
                                                            disabled={startableMatches.length === 0}
                                                            className="rounded-md border border-emerald-300 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                                                            loadingLabel="Lancement..."
                                                        >
                                                            Lancer ({startableMatches.length})
                                                        </LoadingSubmitButton>
                                                    </form>
                                                    <Link
                                                        href={`/public/${orgSlug}/${tournament.slug}/overlay/pools?${overlayParams.toString()}`}
                                                        target="_blank"
                                                        className="rounded-md border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50"
                                                    >
                                                        Overlay timer
                                                    </Link>
                                                </div>
                                            </div>
                                            <div className="space-y-1.5">
                                                {slot.matches.map((match) => (
                                                    <div key={`planning-time-match-${match.id}`} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                                        {(() => {
                                                            const groupLabel = getMatchGroupLabel(match)
                                                            return groupLabel ? <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">{groupLabel}</p> : null
                                                        })()}
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
                                        )
                                    })
                                )}

                                {scheduleByTime.unscheduled.length > 0 && (
                                    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3">
                                        <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Matchs non planifies</p>
                                        <div className="space-y-1">
                                            {scheduleByTime.unscheduled.map((match) => (
                                                <p key={`planning-time-unscheduled-${match.id}`} className="text-xs text-slate-700">
                                                    {match.pitch.name}: {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'} ({match.phase.name}
                                                    {getMatchGroupLabel(match) ? ` • ${getMatchGroupLabel(match)}` : ''})
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
                                <LoadingSubmitButton
                                    className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                                    loadingLabel="Suppression..."
                                >
                                    Supprimer tous les matchs
                                </LoadingSubmitButton>
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
                                        className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${isActive
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
                            <StepSection num={1} title="Generation automatique round-robin" desc="Genere tous les matchs d'une phase en respectant les disponibilites des pistes et des équipes. Pour une phase de poules, la generation suit les placements de chaque poule.">
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
                                        <label className="mb-1 block text-xs text-slate-500">Battement général (min)</label>
                                        <input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} className={`${inputCls} w-full`} />
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                            <input name="confirmedOnly" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                            Confirmees uniquement
                                        </label>
                                        <LoadingSubmitButton
                                            className={`${btnGhost} w-full disabled:opacity-60`}
                                            disabled={tournament.registrations.length < 2 || tournament.pitches.length === 0}
                                            loadingLabel="Generation..."
                                        >
                                            Generer round-robin
                                        </LoadingSubmitButton>
                                    </div>
                                </form>
                                {(tournament.registrations.length < 2 || tournament.pitches.length === 0) && (
                                    <p className="text-[11px] text-amber-400">
                                        {tournament.registrations.length < 2 ? '⚠ Minimum 2 équipes inscrites requis. ' : ''}
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
                                        <LoadingSubmitButton
                                            className={`${btnPrimary} xl:col-span-1 disabled:opacity-60`}
                                            disabled={tournament.pitches.length === 0 || tournament.phases.length === 0}
                                            loadingLabel="Creation..."
                                        >
                                            Creer le match
                                        </LoadingSubmitButton>
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
                                                            className={`rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${allThisStatusSelected
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
                                                <LoadingSubmitButton
                                                    disabled={selectedCount === 0}
                                                    className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                                    loadingLabel="Suppression..."
                                                >
                                                    Supprimer la selection
                                                </LoadingSubmitButton>
                                            </form>
                                        </div>

                                        {matches.map((match) => (
                                            <div key={match.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                                                <div className="min-w-0">
                                                    {(() => {
                                                        const groupLabel = getMatchGroupLabel(match)
                                                        return groupLabel ? <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">{groupLabel}</p> : null
                                                    })()}
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
                                                        {match.scheduledAt ? ` • ${new Date(match.scheduledAt).toLocaleString('fr-FR', { timeZone: 'UTC' })}` : ''}
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
                                                    <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${match.status === 'FINISHED' ? 'bg-emerald-100 text-emerald-700'
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
                                                        <LoadingSubmitButton className={`${btnDanger} disabled:opacity-60`} loadingLabel="Suppression...">Suppr.</LoadingSubmitButton>
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
                                            ? new Date(m.scheduledAt).toLocaleString('fr-FR', { timeZone: 'UTC' })
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

            <aside className={`fixed bottom-4 right-4 z-40 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur transition-all ${isAdminPanelCollapsed ? 'w-[240px]' : 'w-[320px]'}`}>
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pilotage live</p>
                    <button
                        type="button"
                        onClick={() => setIsAdminPanelCollapsed((prev) => !prev)}
                        className="rounded-md border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-50"
                    >
                        {isAdminPanelCollapsed ? 'Ouvrir' : 'Reduire'}
                    </button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Timer admin</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <p className={`text-2xl font-black tabular-nums ${adminTimer?.isDone ? 'text-rose-600' : 'text-amber-700'}`}>
                            {adminTimer ? adminTimer.label : '--:--'}
                        </p>
                        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${requiredActionsCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {requiredActionsCount} action(s)
                        </span>
                    </div>
                    <p className="text-[11px] text-slate-600">
                        {adminTimer
                            ? (adminTimer.mode === 'BREAK' ? 'Temps de battement actif' : 'Timer de match actif')
                            : 'Aucun timer actif'}
                    </p>
                </div>

                {!isAdminPanelCollapsed && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actions requises</p>
                        <div className="mt-2 space-y-1.5 text-xs">
                            {liveWithoutScores.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('matches'); setMatchesStep(4) }}
                                    className="w-full rounded-md border border-amber-200 bg-amber-50 px-2 py-1.5 text-left text-amber-700 hover:bg-amber-100"
                                >
                                    Ajouter les scores: {liveWithoutScores.length} match(s) live
                                </button>
                            )}
                            {finishedWithoutScores.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => { setActiveTab('matches'); setMatchesStep(4) }}
                                    className="w-full rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-left text-rose-700 hover:bg-rose-100"
                                >
                                    Finaliser les scores: {finishedWithoutScores.length} match(s) termines
                                </button>
                            )}
                            {overdueScheduled.length > 0 && (
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('planning-time')}
                                    className="w-full rounded-md border border-sky-200 bg-sky-50 px-2 py-1.5 text-left text-sky-700 hover:bg-sky-100"
                                >
                                    Lancer les matchs en retard: {overdueScheduled.length}
                                </button>
                            )}
                            {liveWithoutScores.length === 0 && finishedWithoutScores.length === 0 && overdueScheduled.length === 0 && (
                                <p className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-emerald-700">
                                    Aucune action urgente.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </aside>

            {standingsOverlay && standingsOverlayPhase && standingsOverlayGroupConfig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={() => setStandingsOverlay(null)}>
                    <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-3 flex items-start justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500">Classements de phase</p>
                                <h3 className="text-lg font-bold text-slate-900">{standingsOverlayPhase.name}</h3>
                                <p className="text-xs text-slate-500">
                                    {standingsOverlay.mode === 'groups' ? 'Vue detaillee par poule' : 'Vue globale de la phase'}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setStandingsOverlay(null)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                                Fermer
                            </button>
                        </div>

                        {standingsOverlay.mode === 'groups' ? (
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {standingsOverlayByGroup.map((group) => (
                                    <div key={`overlay-group-${standingsOverlayPhase.id}-${group.groupIndex}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-teal-700">Poule {group.groupIndex}</p>
                                        {group.standings.length === 0 ? (
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
                                                    {group.standings.map((row, rank) => (
                                                        <tr key={`${group.groupIndex}-${row.teamId}`} className="border-t border-slate-200 text-slate-800">
                                                            <td className="px-1 py-0.5 font-semibold">{rank + 1}</td>
                                                            <td className="max-w-[130px] truncate px-1 py-0.5">{row.teamName}</td>
                                                            <td className="px-1 py-0.5 text-right font-bold">{row.points}</td>
                                                            <td className="px-1 py-0.5 text-right">{row.played}</td>
                                                            <td className={`px-1 py-0.5 text-right ${row.goalDiff > 0 ? 'text-emerald-600' : row.goalDiff < 0 ? 'text-red-600' : ''}`}>
                                                                {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        )}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                {standingsOverlayGlobal.length === 0 ? (
                                    <p className="text-xs text-slate-500">Aucune equipe classee pour cette phase.</p>
                                ) : (
                                    <table className="w-full text-[11px]">
                                        <thead>
                                            <tr className="text-slate-500">
                                                <th className="px-1 py-1 text-left">#</th>
                                                <th className="px-1 py-1 text-left">Equipe</th>
                                                <th className="px-1 py-1 text-left">Poule</th>
                                                <th className="px-1 py-1 text-right">Pts</th>
                                                <th className="px-1 py-1 text-right">J</th>
                                                <th className="px-1 py-1 text-right">GD</th>
                                                <th className="px-1 py-1 text-right">BP</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {standingsOverlayGlobal.map((row, index) => (
                                                <tr key={`overlay-global-${row.teamId}`} className="border-t border-slate-200 text-slate-800">
                                                    <td className="px-1 py-1 font-semibold">{index + 1}</td>
                                                    <td className="px-1 py-1">{row.teamName}</td>
                                                    <td className="px-1 py-1 text-slate-500">{row.groupIndex ? `Poule ${row.groupIndex}` : '-'}</td>
                                                    <td className="px-1 py-1 text-right font-bold">{row.points}</td>
                                                    <td className="px-1 py-1 text-right">{row.played}</td>
                                                    <td className={`px-1 py-1 text-right ${row.goalDiff > 0 ? 'text-emerald-600' : row.goalDiff < 0 ? 'text-red-600' : ''}`}>
                                                        {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                                                    </td>
                                                    <td className="px-1 py-1 text-right">{row.goalsFor}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
