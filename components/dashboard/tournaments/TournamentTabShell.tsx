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
    deleteTournamentMatch,
    deleteTournamentPitch,
    generateCustomPlacementBracketMatches,
    generateGroupMatchesFromPlacements,
    generatePhaseRoundRobinMatches,
    removeTournamentRegistration,
} from '@/lib/actions/tournament-management.actions'
import GroupPlacementBoard from './GroupPlacementBoard'
import MatchBulkEditor from './MatchBulkEditor'
import BracketPhaseView from './BracketPhaseView'

// Next.js server actions can return arbitrary values, but the React HTML form
// `action` prop typing requires `void | Promise<void>`. This wrapper silences
// the mismatch while preserving the server action's behaviour at runtime.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function va<T extends (fd: FormData) => Promise<any>>(action: T) {
    return (fd: FormData): void => { void action(fd) }
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TabId = 'overview' | 'phases' | 'registrations' | 'pools' | 'bracket' | 'matches'

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
    DRAFT: { label: 'Brouillon', cls: 'bg-slate-700 text-slate-200' },
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
        indigo: 'border-indigo-500/40 bg-indigo-600/20 text-indigo-300',
        cyan: 'border-cyan-500/40 bg-cyan-600/20 text-cyan-300',
        emerald: 'border-emerald-500/40 bg-emerald-600/20 text-emerald-300',
        amber: 'border-amber-500/40 bg-amber-600/20 text-amber-300',
    }[color]

    return (
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
            <div className="flex items-start gap-3 pb-1 border-b border-slate-800">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${colorCls}`}>
                    {num}
                </div>
                <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    {desc && <p className="mt-0.5 text-xs text-slate-400">{desc}</p>}
                </div>
            </div>
            {children}
        </div>
    )
}

function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/40 p-8 text-center text-sm text-slate-400">
            {message}
        </div>
    )
}

function PhaseTypeBadge({ type }: { type: string }) {
    const cls = type === 'GROUP' ? 'text-cyan-300 bg-cyan-600/10'
        : type === 'BRACKET_SINGLE' ? 'text-amber-300 bg-amber-600/10'
        : type === 'BRACKET_DOUBLE' ? 'text-orange-300 bg-orange-600/10'
        : type === 'PLACEMENT_BRACKET' ? 'text-rose-300 bg-rose-600/10'
        : type === 'ROUND_SWISS' ? 'text-purple-300 bg-purple-600/10'
        : 'text-slate-300 bg-slate-600/10'
    return (
        <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
            {formatPhaseType(type)}
        </span>
    )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TournamentTabShell({ orgSlug, tournament, availableTeams, matches }: Props) {
    const [activeTab, setActiveTab] = useState<TabId>('overview')

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

    const tabs = [
        { id: 'overview' as TabId, label: "Vue d'ensemble" },
        { id: 'phases' as TabId, label: 'Phases', badge: tournament.phases.length },
        { id: 'registrations' as TabId, label: 'Inscriptions & Pistes', badge: tournament.registrations.length },
        ...(groupPhases.length > 0 ? [{ id: 'pools' as TabId, label: 'Poules', badge: groupPhases.length }] : []),
        ...(bracketPhases.length > 0 ? [{ id: 'bracket' as TabId, label: 'Bracket', badge: bracketPhases.length }] : []),
        { id: 'matches' as TabId, label: 'Matchs', badge: matches.length },
    ]

    const statusMeta = STATUS_META[tournament.status] ?? { label: tournament.status, cls: 'bg-slate-700 text-slate-300' }

    const inputCls = 'rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'
    const btnPrimary = 'rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-50 transition-colors'
    const btnGhost = 'rounded-lg border border-indigo-500/40 px-3 py-2 text-sm text-indigo-200 hover:bg-indigo-500/10 transition-colors'
    const btnDanger = 'rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 transition-colors'

    // ── Header ────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-0">
            {/* Page header */}
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">{tournament.game.name}</p>
                    <h1 className="text-2xl font-black md:text-3xl">{tournament.name}</h1>
                    {tournament.description && (
                        <p className="mt-1 max-w-xl text-sm text-slate-400">{tournament.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
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
                            className="rounded-xl border border-cyan-500/40 px-3 py-2 text-xs font-medium text-cyan-200 hover:bg-cyan-500/10 transition"
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
                        className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-medium hover:border-slate-500 transition"
                    >
                        Page bracket
                    </Link>
                    <Link
                        href={`/dashboard/org/${orgSlug}/tournaments`}
                        className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-slate-900/60 transition"
                    >
                        ← Retour
                    </Link>
                </div>
            </div>

            {/* Tab bar */}
            <div className="flex overflow-x-auto border-b border-slate-800">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex shrink-0 items-center gap-1.5 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                            activeTab === tab.id
                                ? 'border-indigo-500 text-white'
                                : 'border-transparent text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        {tab.label}
                        {tab.badge !== undefined && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                                activeTab === tab.id ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
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
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                <p className="text-xs uppercase text-slate-500">Phases</p>
                                <p className="mt-2 text-2xl font-black">{tournament.phases.length}</p>
                                <p className="text-xs text-slate-500">{tournament.phases.filter((p) => p.isCompleted).length} completee(s)</p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                <p className="text-xs uppercase text-slate-500">Equipes</p>
                                <p className="mt-2 text-2xl font-black">{tournament._count.registrations}</p>
                                <p className="text-xs text-slate-500">
                                    {tournament.registrations.filter((r) => r.isConfirmed).length} confirmees
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                <p className="text-xs uppercase text-slate-500">Matchs</p>
                                <p className="mt-2 text-2xl font-black">{matches.length}</p>
                                <p className="text-xs text-slate-500">
                                    {matches.filter((m) => m.status === 'FINISHED').length} termines
                                </p>
                            </div>
                            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                                <p className="text-xs uppercase text-slate-500">Pistes</p>
                                <p className="mt-2 text-2xl font-black">{tournament.pitches.length}</p>
                                <p className="text-xs text-slate-500">terrain(s) disponible(s)</p>
                            </div>
                        </div>

                        {/* Phase flow */}
                        {tournament.phases.length === 0 ? (
                            <EmptyState message="Aucune phase configuree." />
                        ) : (
                            <div className="space-y-3">
                                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">Progression du tournoi</h2>
                                <div className="flex flex-col gap-0">
                                    {tournament.phases.map((phase, idx) => {
                                        const stats = matchesByPhase.get(phase.id) ?? { total: 0, finished: 0 }
                                        const pct = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0
                                        const routes = readRoutes(phase.config)
                                        return (
                                            <div key={phase.id} className="relative flex gap-4">
                                                {/* Connector line */}
                                                <div className="flex flex-col items-center">
                                                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                                                        phase.isCompleted
                                                            ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                                                            : 'border-slate-600 bg-slate-900 text-slate-400'
                                                    }`}>
                                                        {phase.isCompleted ? '✓' : phase.order}
                                                    </div>
                                                    {idx < tournament.phases.length - 1 && (
                                                        <div className="w-0.5 flex-1 bg-slate-800 my-1" style={{ minHeight: '24px' }} />
                                                    )}
                                                </div>
                                                <div className="mb-4 flex-1 rounded-xl border border-slate-800 bg-slate-950/60 p-3">
                                                    <div className="mb-2 flex items-center gap-2">
                                                        <p className="text-sm font-semibold">{phase.name}</p>
                                                        <PhaseTypeBadge type={phase.type} />
                                                        {phase.isCompleted && (
                                                            <span className="ml-auto text-[10px] font-semibold text-emerald-300">Terminee</span>
                                                        )}
                                                    </div>
                                                    <p className="mb-2 text-xs text-slate-500">
                                                        {stats.finished}/{stats.total} matchs termines
                                                    </p>
                                                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${phase.isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                    {routes.length > 0 && (
                                                        <div className="mt-2 flex flex-wrap gap-1">
                                                            {routes.map((route, i) => (
                                                                <span key={i} className="rounded-md bg-slate-800 px-2 py-0.5 text-[10px] text-slate-300">
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
                    </div>
                )}

                {/* ── Phases ─────────────────────────────────────────────────────── */}
                {activeTab === 'phases' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
                            <p className="font-semibold text-slate-200">Gestion du cycle de vie des phases</p>
                            <p className="mt-1">Cloturez chaque phase apres ses matchs pour propager les qualifies vers la phase suivante et mettre a jour le statut du tournoi. Utilisez <em>Forcer la cloture</em> si certains matchs ne sont pas termines.</p>
                        </div>

                        {tournament.phases.length === 0 ? (
                            <EmptyState message="Aucune phase configuree. Creez un tournoi avec des phases depuis le formulaire de creation." />
                        ) : (
                            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                                {tournament.phases.map((phase) => {
                                    const stats = matchesByPhase.get(phase.id) ?? { total: 0, finished: 0 }
                                    const pct = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0
                                    const routes = readRoutes(phase.config)
                                    return (
                                        <div key={phase.id} className={`rounded-xl border p-4 ${phase.isCompleted ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-slate-800 bg-slate-950/70'}`}>
                                            <div className="mb-3 flex items-start justify-between gap-2">
                                                <div>
                                                    <span className="text-[10px] uppercase tracking-widest text-slate-500">Etape {phase.order}</span>
                                                    <p className="text-base font-bold leading-tight">{phase.name}</p>
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
                                                        className={`h-full rounded-full transition-all ${phase.isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>

                                            {/* Routes */}
                                            {routes.length > 0 && (
                                                <div className="mb-3 space-y-1 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                                                    <p className="text-[10px] uppercase tracking-wider text-slate-400">Qualifications sortantes</p>
                                                    {routes.map((route, i) => (
                                                        <div key={i} className="rounded-md border border-slate-800 bg-slate-950 px-2 py-1 text-[11px] text-slate-300">
                                                            <span>{formatRouteRule(route)}</span>
                                                            <span className="ml-1 text-slate-500">→ {route.toPhaseKey || 'inconnue'}{route.label ? ` (${route.label})` : ''}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Close form */}
                                            <form action={va(closeTournamentPhase)} className="space-y-2 rounded-lg border border-slate-800 bg-slate-900/50 p-2">
                                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                <input type="hidden" name="phaseId" value={phase.id} />
                                                {phase.isCompleted ? (
                                                    <p className="text-center text-[11px] font-semibold text-emerald-300">✓ Phase cloturee — qualifies propages</p>
                                                ) : (
                                                    <>
                                                        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-400 hover:text-slate-200">
                                                            <input name="forceClose" type="checkbox" className="h-3.5 w-3.5 accent-indigo-500" />
                                                            Forcer la cloture (matchs non termines)
                                                        </label>
                                                        <button type="submit" className="w-full rounded-md border border-indigo-500/40 px-2 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-indigo-500/10 transition-colors">
                                                            Cloturer et propager les qualifies →
                                                        </button>
                                                    </>
                                                )}
                                            </form>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Inscriptions & Pistes ──────────────────────────────────────── */}
                {activeTab === 'registrations' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
                            <p className="font-semibold text-slate-200">Avant de commencer</p>
                            <p className="mt-1">Suivez ces etapes pour preparer votre tournoi : inscrivez les equipes, confirmez leur participation, puis configurez les pistes de jeu disponibles.</p>
                        </div>

                        <div className="grid gap-4 xl:grid-cols-2">
                            {/* Step 1: Inscriptions */}
                            <StepSection num={1} title="Inscrire les equipes" desc="Ajoutez les equipes participantes et confirmez leur inscription.">
                                <form action={va(addTournamentRegistration)} className="grid gap-2 md:grid-cols-2">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <select name="teamId" className={`${inputCls} md:col-span-2`} required defaultValue="">
                                        <option value="" disabled>Selectionner une equipe</option>
                                        {availableTeams.map((team) => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                    <input type="number" name="seed" min={1} placeholder="Seed (optionnel)" className={inputCls} />
                                    <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                        <input name="isConfirmed" type="checkbox" className="h-4 w-4 accent-indigo-500" />
                                        Confirmer directement
                                    </label>
                                    <button
                                        type="submit"
                                        className={`${btnPrimary} md:col-span-2`}
                                        disabled={availableTeams.length === 0}
                                    >
                                        {availableTeams.length === 0 ? 'Toutes les equipes sont inscrites' : 'Ajouter l\'equipe'}
                                    </button>
                                </form>

                                <div className="mt-2 space-y-1.5">
                                    {tournament.registrations.length === 0 ? (
                                        <p className="text-center text-xs text-slate-500 py-4">Aucune equipe inscrite.</p>
                                    ) : (
                                        tournament.registrations.map((reg) => (
                                            <div key={reg.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
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
                            <StepSection num={2} title="Configurer les pistes" desc="Les pistes (terrains / tables / postes) servent a planifier quand et ou se jouent les matchs." color="cyan">
                                <form action={va(createTournamentPitch)} className="grid gap-2 md:grid-cols-3">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <input name="name" className={inputCls} placeholder="Nom de la piste" required />
                                    <select name="phaseId" className={inputCls} defaultValue="">
                                        <option value="">Toutes phases</option>
                                        {tournament.phases.map((phase) => (
                                            <option key={phase.id} value={phase.id}>{phase.name}</option>
                                        ))}
                                    </select>
                                    <button type="submit" className={btnPrimary}>Ajouter</button>
                                </form>

                                <div className="mt-2 space-y-1.5">
                                    {tournament.pitches.length === 0 ? (
                                        <p className="text-center text-xs text-slate-500 py-4">Aucune piste configuree. Ajoutez au moins une piste avant de generer des matchs.</p>
                                    ) : (
                                        tournament.pitches.map((pitch) => (
                                            <div key={pitch.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
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
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
                            <p className="font-semibold text-slate-200">Guide de gestion des poules</p>
                            <p className="mt-1">Suivez les 4 etapes ci-dessous pour chaque phase de type poules. Commencez par configurer le nombre de poules, placez les equipes, generez les matchs, puis suivez les classements en direct.</p>
                        </div>

                        {groupPhases.length === 0 ? (
                            <EmptyState message="Aucune phase de type poule." />
                        ) : (
                            groupPhases.map((phase) => {
                                const groupConfig = readGroupConfig(phase.config)
                                return (
                                    <div key={phase.id} className="space-y-4 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
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
                                                    <input name="confirmedOnly" type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-500" />
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
                                                        <div key={`${phase.id}-standings-${gIdx}`} className="rounded-lg border border-slate-800 bg-slate-900/50 p-2">
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
                                                                            <tr key={row.teamId} className={`border-t border-slate-800 ${rank === 0 ? 'text-amber-200' : 'text-slate-200'}`}>
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
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
                            <p className="font-semibold text-slate-200">Visualisation bracket</p>
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
                                            roundNumber: m.roundNumber,
                                            bracketPos: m.bracketPos,
                                            status: m.status as 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED',
                                            homeTeamName: m.homeTeam?.name || 'TBD',
                                            awayTeamName: m.awayTeam?.name || 'TBD',
                                            homeScore: m.result?.homeScore ?? null,
                                            awayScore: m.result?.awayScore ?? null,
                                        }))

                                    return (
                                        <div key={phase.id} className="space-y-3 rounded-2xl border border-slate-700 bg-slate-950/40 p-4">
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
                                                    <form action={va(generateCustomPlacementBracketMatches)} className="grid gap-2 md:grid-cols-5">
                                                        <input type="hidden" name="tournamentId" value={tournament.id} />
                                                        <input type="hidden" name="orgSlug" value={orgSlug} />
                                                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                        <input type="hidden" name="phaseId" value={phase.id} />
                                                        <div>
                                                            <label className="mb-1 block text-xs text-slate-500">Participants</label>
                                                            <input name="participantsCount" type="number" min={4} max={64} defaultValue={8} className={`${inputCls} w-full`} />
                                                        </div>
                                                        <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                                            <input name="includeLosersReplay" type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-500" />
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
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ── Matchs ─────────────────────────────────────────────────────── */}
                {activeTab === 'matches' && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3 text-xs text-slate-400">
                            <p className="font-semibold text-slate-200">Planification et suivi des matchs</p>
                            <p className="mt-1">Etape 1 : generez les matchs automatiquement (round-robin) ou creez-les manuellement. Etape 2 : mettez a jour les scores et statuts dans l'editeur global en bas de page.</p>
                        </div>

                        {/* Step 1: Auto generation */}
                        <StepSection num={1} title="Generation automatique round-robin" desc="Genere tous les matchs d'une phase en respectant les disponibilites des pistes et des equipes.">
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
                                        <input name="confirmedOnly" type="checkbox" defaultChecked className="h-4 w-4 accent-indigo-500" />
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

                        {/* Step 2: Manual match creation */}
                        <StepSection num={2} title="Creer un match manuellement" desc="Planifiez un match specifique sur une piste donnee, avec les equipes et la position dans le bracket." color="cyan">
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
                        </StepSection>

                        {/* Step 3: Match list */}
                        <StepSection num={3} title="Liste des matchs" desc={`${matches.length} match(s) planifie(s) — cliquez sur Detail pour voir et modifier un match.`} color="emerald">
                            {matches.length === 0 ? (
                                <p className="text-center text-xs text-slate-500 py-4">Aucun match planifie. Utilisez la generation automatique ou la creation manuelle ci-dessus.</p>
                            ) : (
                                <div className="space-y-2">
                                    {matches.map((match) => (
                                        <div key={match.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-900/40 px-3 py-2">
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
                                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${
                                                    match.status === 'FINISHED' ? 'bg-emerald-600/20 text-emerald-300'
                                                    : match.status === 'LIVE' ? 'bg-amber-600/20 text-amber-300'
                                                    : match.status === 'CANCELLED' ? 'bg-red-600/20 text-red-300'
                                                    : 'bg-slate-700 text-slate-300'
                                                }`}>
                                                    {match.status}
                                                </span>
                                                <Link
                                                    href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}/matches/${match.id}`}
                                                    className="rounded-lg border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800 transition-colors"
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

                        {/* Step 4: Bulk editor */}
                        {matches.length > 0 && (
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
                    </div>
                )}

            </div>
        </div>
    )
}
