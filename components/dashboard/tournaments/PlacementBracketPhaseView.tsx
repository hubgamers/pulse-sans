'use client'

import Link from 'next/link'
import { startTransition, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { configureInterleavedTimeSlots } from '@/lib/actions/tournament-management.actions'
import MatchResultModal from './MatchResultModal'

type BracketMatch = {
    id: string
    roundNumber: number | null
    bracketPos: string | null
    scheduledAt: string | null
    pitchName: string | null
    status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED'
    homeTeamName: string
    awayTeamName: string
    homeScore: number | null
    awayScore: number | null
}

type Props = {
    tournamentId: string
    orgSlug: string
    tournamentSlug: string
    phase: {
        id: string
        name: string
        type: string
        order: number
        config?: unknown
    }
    matches: BracketMatch[]
    timer?: {
        timerSeconds: number
        timerStartMs: number
        timerMode: 'MATCH' | 'BREAK'
    } | null
    fullscreen?: boolean
    showFullscreenLink?: boolean
}

type DisplayPlayer = {
    name: string
    score: number | null
}

type DisplayMatch = {
    id: string
    matchId: string
    scheduledAt: string | null
    pitchName: string | null
    players: DisplayPlayer[]
}

type BracketRoundData = {
    title: string
    matches: DisplayMatch[]
    color?: string
}

type PlacementTree = {
    title: string
    start: number
    end: number
    rounds: BracketRoundData[]
}

type PlacementTreeWithSize = PlacementTree & {
    totalMatches: number
    isCompact: boolean
}

type FullscreenBracketState = {
    key: string
    title: string
    rounds: BracketRoundData[]
    matchWidth: string
}

type FullscreenOverlayState =
    | { mode: 'board' }
    | ({ mode: 'bracket' } & FullscreenBracketState)

const FULLSCREEN_ZOOM_STEPS = [0.7, 0.85, 1, 1.15, 1.3, 1.5] as const

type RankingEntry = {
    place: number
    teamName: string | null
}

type RankingSegment = {
    start: number
    end: number
    label: string
}

type InterleavedTimeSlot = {
    id: string
    startTimeMs: number
    label: string
    selectedMatchIds: string[]
}

const WINNER_COLORS = ['text-sky-400', 'text-yellow-500', 'text-orange-500', 'text-[#ccff00]']
const ROTATION_BASE_START_MS = Date.UTC(2000, 0, 1, 0, 0, 0)

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

function readRotationMode(config: unknown): 'sequential' | 'interleaved' {
    if (!config || typeof config !== 'object') return 'sequential'
    const mode = (config as { rotationMode?: unknown }).rotationMode
    return mode === 'interleaved' ? 'interleaved' : 'sequential'
}

function createRotationSlot(
    index: number,
    selectedMatchIds: string[] = [],
    overrides?: { id?: string; startTimeMs?: number; label?: string }
): InterleavedTimeSlot {
    return {
        id: overrides?.id?.trim() ? overrides.id : `rotation-${index + 1}`,
        startTimeMs: typeof overrides?.startTimeMs === 'number' && Number.isFinite(overrides.startTimeMs)
            ? overrides.startTimeMs
            : ROTATION_BASE_START_MS + (index * 60_000),
        label: overrides?.label?.trim() ? overrides.label.trim() : `R${index + 1}`,
        selectedMatchIds,
    }
}

function readInterleavedTimeSlots(config: unknown): InterleavedTimeSlot[] {
    if (!config || typeof config !== 'object') return []
    const raw = (config as { interleavedTimeSlots?: unknown }).interleavedTimeSlots
    if (!Array.isArray(raw)) return []

    return raw
        .map((slot, index) => {
            if (!slot || typeof slot !== 'object') return null
            const entry = slot as Record<string, unknown>
            const selectedMatchIds = Array.isArray(entry.selectedMatchIds)
                ? entry.selectedMatchIds.filter((item): item is string => typeof item === 'string')
                : []

            return {
                id: typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : `rotation-${index + 1}`,
                startTimeMs: typeof entry.startTimeMs === 'number' ? entry.startTimeMs : ROTATION_BASE_START_MS + (index * 60_000),
                label: typeof entry.label === 'string' && entry.label.trim().length > 0 ? entry.label.trim() : `R${index + 1}`,
                selectedMatchIds,
            }
        })
        .filter((slot): slot is InterleavedTimeSlot => Boolean(slot))
}

function buildDefaultInterleavedTimeSlots(matches: BracketMatch[]): InterleavedTimeSlot[] {
    const roundMap = new Map<number, { ids: string[]; earliestStartMs: number | null }>()

    for (const match of matches) {
        const round = Math.max(1, match.roundNumber ?? 1)
        const current = roundMap.get(round) ?? { ids: [], earliestStartMs: null }
        current.ids.push(match.id)

        if (match.scheduledAt) {
            const parsed = new Date(match.scheduledAt)
            if (!Number.isNaN(parsed.getTime())) {
                current.earliestStartMs = current.earliestStartMs === null
                    ? parsed.getTime()
                    : Math.min(current.earliestStartMs, parsed.getTime())
            }
        }

        roundMap.set(round, current)
    }

    const orderedRounds = Array.from(roundMap.keys()).sort((a, b) => a - b)
    if (orderedRounds.length === 0) {
        return [createRotationSlot(0)]
    }

    const firstKnownStartMs = orderedRounds
        .map((round) => roundMap.get(round)?.earliestStartMs ?? null)
        .find((value): value is number => value !== null)

    const fallbackStartMs = firstKnownStartMs ?? Date.now()

    return orderedRounds.map((round, index) => {
        const current = roundMap.get(round)
        return createRotationSlot(
            index,
            [...(current?.ids ?? [])],
            { startTimeMs: current?.earliestStartMs ?? (fallbackStartMs + index * 30 * 60_000) }
        )
    })
}

function normalizeInterleavedTimeSlots(config: unknown, matches: BracketMatch[]): InterleavedTimeSlot[] {
    const storedSlots = readInterleavedTimeSlots(config)
    if (storedSlots.length === 0) {
        return buildDefaultInterleavedTimeSlots(matches)
    }

    const validMatchIds = new Set(matches.map((match) => match.id))
    return [...storedSlots]
        .sort((a, b) => a.startTimeMs - b.startTimeMs || a.label.localeCompare(b.label))
        .map((slot, index) => createRotationSlot(
            index,
            slot.selectedMatchIds.filter((matchId) => validMatchIds.has(matchId)),
            { id: slot.id, startTimeMs: slot.startTimeMs, label: slot.label }
        ))
}

function serializeInterleavedTimeSlots(slots: InterleavedTimeSlot[]): string {
    return JSON.stringify(
        slots.map((slot) => ({
            id: slot.id,
            startTimeMs: slot.startTimeMs,
            label: slot.label,
            selectedMatchIds: [...slot.selectedMatchIds].sort(),
        }))
    )
}

function formatDateTimeLocal(ms: number): string {
    const date = new Date(ms)
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    const hours = String(date.getHours()).padStart(2, '0')
    const minutes = String(date.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day}T${hours}:${minutes}`
}

function parseDateTimeLocal(value: string): number | null {
    if (!value) return null
    const parsed = new Date(value)
    const time = parsed.getTime()
    return Number.isNaN(time) ? null : time
}

function buildRotationLookup(slots: InterleavedTimeSlot[]): Map<string, string> {
    const lookup = new Map<string, string>()
    for (const slot of slots) {
        for (const matchId of slot.selectedMatchIds) {
            lookup.set(matchId, slot.id)
        }
    }
    return lookup
}

function buildRotationLabelLookup(slots: InterleavedTimeSlot[]): Map<string, string> {
    const lookup = new Map<string, string>()
    for (const slot of slots) {
        for (const matchId of slot.selectedMatchIds) {
            lookup.set(matchId, slot.label)
        }
    }
    return lookup
}

function readPlacementRankingSegments(config: unknown): RankingSegment[] {
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
        .filter((item): item is RankingSegment => Boolean(item))
        .sort((a, b) => a.start - b.start || a.end - b.end)
}

function resolveMatchWinnerLoser(match: BracketMatch): { winner: string | null; loser: string | null } {
    if (match.homeScore === null || match.awayScore === null) return { winner: null, loser: null }
    if (match.homeScore === match.awayScore) return { winner: null, loser: null }
    if (match.homeScore > match.awayScore) return { winner: match.homeTeamName || null, loser: match.awayTeamName || null }
    return { winner: match.awayTeamName || null, loser: match.homeTeamName || null }
}

function buildPlacementRanking(matches: BracketMatch[]): Map<number, string | null> {
    const ranking = new Map<number, string | null>()

    const wbParsed = matches
        .map((match) => {
            const parsed = parseWinnerMatch(match)
            return parsed ? { ...parsed, match } : null
        })
        .filter((item): item is { round: number; matchNo: number; match: BracketMatch } => Boolean(item))

    const wbFinalRound = wbParsed.reduce((max, item) => Math.max(max, item.round), 0)
    const wbFinal = wbParsed.find((item) => item.round === wbFinalRound && item.matchNo === 1)?.match
    if (wbFinal) {
        const { winner, loser } = resolveMatchWinnerLoser(wbFinal)
        ranking.set(1, winner)
        ranking.set(2, loser)
    }

    const placementParsed = matches
        .map((match) => {
            const parsed = parsePlacementMatch(match)
            return parsed ? { ...parsed, match } : null
        })
        .filter((item): item is { start: number; end: number; round: number; matchNo: number; match: BracketMatch } => Boolean(item))

    const ranges = Array.from(new Set(placementParsed.map((item) => `${item.start}-${item.end}`))).map((key) => {
        const [start, end] = key.split('-').map(Number)
        return { start, end }
    })

    const children = new Set<string>()
    for (const range of ranges) {
        for (const maybeParent of ranges) {
            if (range.start === maybeParent.start && range.end === maybeParent.end) continue
            if (range.start >= maybeParent.start && range.end <= maybeParent.end) {
                children.add(`${range.start}-${range.end}`)
                break
            }
        }
    }

    const rootRanges = ranges
        .filter((range) => !children.has(`${range.start}-${range.end}`))
        .sort((a, b) => a.start - b.start)

    const resolveRangeRanking = (start: number, end: number): RankingEntry[] => {
        const size = end - start + 1
        const entries = placementParsed.filter((item) => item.start === start && item.end === end)
        if (entries.length === 0 || size < 2) return []

        const finalRound = entries.reduce((max, item) => Math.max(max, item.round), 0)
        const finalMatch = entries.find((item) => item.round === finalRound && item.matchNo === 1)?.match

        const output: RankingEntry[] = []
        if (finalMatch) {
            const { winner, loser } = resolveMatchWinnerLoser(finalMatch)
            output.push({ place: start, teamName: winner })
            output.push({ place: start + 1, teamName: loser })
        }

        for (let round = finalRound - 1; round >= 1; round -= 1) {
            const childStart = start + size / 2 ** round
            const childEnd = start + size / 2 ** (round - 1) - 1
            if (!Number.isInteger(childStart) || !Number.isInteger(childEnd) || childEnd < childStart) continue
            output.push(...resolveRangeRanking(childStart, childEnd))
        }

        return output
    }

    for (const range of rootRanges) {
        const entries = resolveRangeRanking(range.start, range.end)
        for (const entry of entries) {
            if (!ranking.has(entry.place)) {
                ranking.set(entry.place, entry.teamName)
            }
        }
    }

    return ranking
}

function formatRemainingTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0')
    const seconds = (totalSeconds % 60).toString().padStart(2, '0')
    return `${minutes}:${seconds}`
}

function parseWinnerMatch(match: BracketMatch): { round: number; matchNo: number } | null {
    const parsed = match.bracketPos?.match(/^WB-R(\d+)-M(\d+)$/)
    if (!parsed) return null
    return { round: match.roundNumber ?? Number(parsed[1]), matchNo: Number(parsed[2]) }
}

function parsePlacementMatch(match: BracketMatch): { start: number; end: number; round: number; matchNo: number } | null {
    const parsed = match.bracketPos?.match(/^P(\d+)-(\d+)-R(\d+)-M(\d+)$/)
    if (!parsed) return null
    return { start: Number(parsed[1]), end: Number(parsed[2]), round: Number(parsed[3]), matchNo: Number(parsed[4]) }
}

function toDisplayMatch(match: BracketMatch): DisplayMatch {
    return {
        id: match.id,
        matchId: match.id,
        scheduledAt: match.scheduledAt ?? null,
        pitchName: match.pitchName ?? null,
        players: [
            { name: match.homeTeamName || 'A DEFINIR', score: match.homeScore },
            { name: match.awayTeamName || 'A DEFINIR', score: match.awayScore },
        ],
    }
}

function buildWinnerTitle(roundIndex: number, totalRounds: number): string {
    if (roundIndex === totalRounds - 1) return 'FINALE'
    const denominator = 2 ** (totalRounds - roundIndex - 1)
    return `1/${denominator}`
}

function buildWinnerData(matches: BracketMatch[]): BracketRoundData[] {
    const grouped = new Map<number, { matchNo: number; match: BracketMatch }[]>()

    matches.forEach((m) => {
        const p = parseWinnerMatch(m)
        if (!p) return
        if (!grouped.has(p.round)) grouped.set(p.round, [])
        const roundMatches = grouped.get(p.round)
        if (!roundMatches) return
        roundMatches.push({ matchNo: p.matchNo, match: m })
    })

    const sortedRounds = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0])
    return sortedRounds.map(([, items], index) => ({
        title: buildWinnerTitle(index, sortedRounds.length),
        color: WINNER_COLORS[index] || 'text-white',
        matches: items.sort((a, b) => a.matchNo - b.matchNo).map((i) => toDisplayMatch(i.match)),
    }))
}

function buildPlacementTrees(matches: BracketMatch[], placementLabels: Record<string, string>): PlacementTree[] {
    const ranges = new Set<string>()

    matches.forEach((m) => {
        const p = parsePlacementMatch(m)
        if (p) ranges.add(`${p.start}-${p.end}`)
    })

    return Array.from(ranges)
        .map((rangeKey) => {
            const [start, end] = rangeKey.split('-').map(Number)
            const roundsMap = new Map<number, { matchNo: number; match: BracketMatch }[]>()

            matches.forEach((m) => {
                const p = parsePlacementMatch(m)
                if (p && p.start === start && p.end === end) {
                    if (!roundsMap.has(p.round)) roundsMap.set(p.round, [])
                    const placementRoundMatches = roundsMap.get(p.round)
                    if (!placementRoundMatches) return
                    placementRoundMatches.push({ matchNo: p.matchNo, match: m })
                }
            })

            const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => a[0] - b[0])
            const key = `${start}-${end}`
            return {
                title: placementLabels[key] || (start === end ? `PLACE ${start}` : `PLACE ${start} A ${end}`),
                start,
                end,
                rounds: sortedRounds.map(([, items], idx) => ({
                    title: idx === sortedRounds.length - 1 ? (start === end - 1 ? 'FINALE' : `R${idx + 1}`) : `R${idx + 1}`,
                    matches: items.sort((a, b) => a.matchNo - b.matchNo).map((i) => toDisplayMatch(i.match)),
                })),
            }
        })
        .sort((a, b) => a.start - b.start)
}

function countTreeMatches(tree: PlacementTree): number {
    return tree.rounds.reduce((total, round) => total + round.matches.length, 0)
}

const MatchBox = ({
    match,
    players,
    isFinal,
    width,
    orgSlug,
    tournamentSlug,
    rotationLabel,
    selectedRotationId,
    rotationOptions,
    onAssignRotation,
    rotationDisabled,
    onOpenMatch,
}: {
    match: DisplayMatch
    players: DisplayPlayer[]
    isFinal: boolean
    width: string
    orgSlug: string
    tournamentSlug: string
    rotationLabel?: string | null
    selectedRotationId?: string | null
    rotationOptions?: InterleavedTimeSlot[]
    onAssignRotation?: (matchId: string, rotationId: string) => void
    rotationDisabled?: boolean
    onOpenMatch?: (matchId: string) => void
}) => (
    <div className={`relative flex flex-col bg-slate-950 border ${isFinal ? 'border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'border-white/10'} rounded overflow-hidden ${width} z-10`}>
        <button
            type="button"
            onClick={() => onOpenMatch?.(match.matchId)}
            className="group relative flex flex-col text-left hover:border-teal-400/60"
        >
            <div className="absolute right-1 top-1 flex items-center gap-1">
                {rotationLabel && (
                    <span className="rounded border border-fuchsia-500/40 bg-fuchsia-500/10 px-1 py-0.5 text-[6px] font-black uppercase tracking-wider text-fuchsia-200">
                        {rotationLabel}
                    </span>
                )}
            </div>
            {match.scheduledAt && (
                <div className="px-2 pt-0.5 text-[6px] font-semibold text-teal-400 opacity-80 tracking-wide">
                    {new Date(match.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })}
                    {match.pitchName && <span className="ml-1 opacity-60">· {match.pitchName}</span>}
                </div>
            )}
            {!match.scheduledAt && match.pitchName && (
                <div className="px-2 pt-0.5 text-[6px] text-slate-500 opacity-70 tracking-wide">{match.pitchName}</div>
            )}
            {players.map((p, i) => (
                <div key={i} className={`flex justify-between items-center px-2 py-1 h-4 ${i === 0 ? 'border-b border-white/5' : ''}`}>
                    <span className={`text-[7px] font-bold uppercase italic truncate ${p.score !== null ? 'text-white' : 'text-slate-500'}`}>
                        {p.name}
                    </span>
                    <span className="text-[7px] font-black text-yellow-400 ml-1">{p.score ?? ''}</span>
                </div>
            ))}
        </button>

        {rotationOptions && onAssignRotation && (
            <div className="border-t border-white/5 bg-white/[0.03] px-2 py-1.5">
                <label className="mb-1 block text-[6px] font-black uppercase tracking-widest text-white/45">Rotation</label>
                <select
                    value={selectedRotationId ?? ''}
                    onChange={(event) => onAssignRotation(match.matchId, event.target.value)}
                    disabled={rotationDisabled}
                    className="w-full rounded border border-white/10 bg-slate-900 px-1.5 py-1 text-[7px] font-semibold text-slate-100 outline-none transition hover:border-fuchsia-400/50 focus:border-fuchsia-400/70 disabled:opacity-50"
                >
                    <option value="">Non assigne</option>
                    {rotationOptions.map((rotation) => (
                        <option key={rotation.id} value={rotation.id}>{rotation.label}</option>
                    ))}
                </select>
            </div>
        )}
    </div>
)

const BracketRound = ({
    round,
    roundIdx,
    isLast,
    matchWidth,
    orgSlug,
    tournamentSlug,
    rotationLookup,
    rotationLabelLookup,
    rotationOptions,
    onAssignRotation,
    rotationDisabled,
    onOpenMatch,
}: {
    round: BracketRoundData
    roundIdx: number
    isLast: boolean
    matchWidth: string
    orgSlug: string
    tournamentSlug: string
    rotationLookup?: Map<string, string>
    rotationLabelLookup?: Map<string, string>
    rotationOptions?: InterleavedTimeSlot[]
    onAssignRotation?: (matchId: string, rotationId: string) => void
    rotationDisabled?: boolean
    onOpenMatch?: (matchId: string) => void
}) => {
    const roundMatches = round.matches

    return (
        <div className="flex flex-col flex-1 h-full min-w-0 relative">
            <div className={`text-[7px] font-black text-center mb-2 uppercase tracking-widest opacity-60 ${round.color || 'text-slate-400'}`}>
                {round.title}
            </div>

            <div className="flex flex-col justify-around flex-grow relative">
                {roundMatches.map((match, idx) => {
                    const isTop = idx % 2 === 0
                    return (
                        <div key={match.id} className="relative flex items-center justify-center w-full py-2">
                            {roundIdx > 0 && <div className="absolute left-0 w-2 h-[1px] bg-white/20 -translate-x-full" />}

                            <MatchBox
                                match={match}
                                players={match.players}
                                isFinal={isLast && roundMatches.length === 1}
                                width={matchWidth}
                                orgSlug={orgSlug}
                                tournamentSlug={tournamentSlug}
                                rotationLabel={rotationLabelLookup?.get(match.matchId) ?? null}
                                selectedRotationId={rotationLookup?.get(match.matchId) ?? ''}
                                rotationOptions={rotationOptions}
                                onAssignRotation={onAssignRotation}
                                rotationDisabled={rotationDisabled}
                                onOpenMatch={onOpenMatch}
                            />

                            {!isLast && (
                                <div className="absolute right-0 translate-x-full flex items-center h-full w-2">
                                    <div className={`w-full h-[1px] ${round.color ? 'bg-current opacity-50' : 'bg-white/20'}`} />

                                    {roundMatches.length > 1 && (
                                        <div
                                            className={`absolute right-0 w-[1px] ${round.color ? 'bg-current opacity-50' : 'bg-white/20'}`}
                                            style={{
                                                height: '100%',
                                                top: isTop ? '50%' : 'auto',
                                                bottom: !isTop ? '50%' : 'auto',
                                            }}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

const BracketCard = ({
    title,
    rounds,
    className = '',
    matchWidth = 'w-[80px]',
    orgSlug,
    tournamentSlug,
    rotationLookup,
    rotationLabelLookup,
    rotationOptions,
    onAssignRotation,
    rotationDisabled,
    onOpenMatch,
    onExpand,
    expanded = false,
    expandAccent = false,
}: {
    title?: string
    rounds: BracketRoundData[]
    className?: string
    matchWidth?: string
    orgSlug: string
    tournamentSlug: string
    rotationLookup?: Map<string, string>
    rotationLabelLookup?: Map<string, string>
    rotationOptions?: InterleavedTimeSlot[]
    onAssignRotation?: (matchId: string, rotationId: string) => void
    rotationDisabled?: boolean
    onOpenMatch?: (matchId: string) => void
    onExpand?: () => void
    expanded?: boolean
    expandAccent?: boolean
}) => (
    <div className={`flex flex-col bg-white/[0.02] border border-white/5 rounded p-2 ${expanded ? 'overflow-visible' : 'overflow-hidden'} h-full ${className}`}>
        {(title || onExpand) && (
            <div className="mb-2 flex items-center justify-between gap-2">
                {title ? (
                    <div className="flex min-w-0 items-center gap-2">
                        <div className="h-2.5 w-0.5 bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
                        <h3 className="truncate text-[8px] font-black uppercase italic tracking-wider text-white/80">{title}</h3>
                    </div>
                ) : <div />}
                {onExpand && (
                    <button
                        type="button"
                        onClick={onExpand}
                        className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[7px] font-black uppercase tracking-[0.18em] transition ${expandAccent
                            ? 'border-teal-300/40 bg-teal-400/12 text-teal-100 shadow-[0_0_18px_rgba(45,212,191,0.18)] hover:border-teal-200 hover:bg-teal-300/18'
                            : 'border-white/10 bg-white/[0.05] text-white/70 hover:border-teal-300/50 hover:bg-teal-400/10 hover:text-teal-100'
                        }`}
                    >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" />
                        </svg>
                        Agrandir
                    </button>
                )}
            </div>
        )}
        <div className="flex flex-1 h-full">
            {rounds.length > 0 ? (
                rounds.map((round, i) => (
                    <BracketRound
                        key={i}
                        round={round}
                        roundIdx={i}
                        isLast={i === rounds.length - 1}
                        matchWidth={matchWidth}
                        orgSlug={orgSlug}
                        tournamentSlug={tournamentSlug}
                        rotationLookup={rotationLookup}
                        rotationLabelLookup={rotationLabelLookup}
                        rotationOptions={rotationOptions}
                        onAssignRotation={onAssignRotation}
                        rotationDisabled={rotationDisabled}
                        onOpenMatch={onOpenMatch}
                    />
                ))
            ) : (
                <div className="flex-1 flex items-center justify-center opacity-10 text-[8px] italic uppercase">Non genere</div>
            )}
        </div>
    </div>
)

export default function PlacementBracketPhaseView({
    tournamentId,
    orgSlug,
    tournamentSlug,
    phase,
    matches,
    timer = null,
    fullscreen = false,
    showFullscreenLink = true,
}: Props) {
    const [nowMs, setNowMs] = useState(() => Date.now())
    const [isSavingTimeSlots, setIsSavingTimeSlots] = useState(false)
    const [rotationSaveMessage, setRotationSaveMessage] = useState<{ success: boolean; message: string } | null>(null)
    const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null)
    const [fullscreenOverlay, setFullscreenOverlay] = useState<FullscreenOverlayState | null>(null)
    const [fullscreenZoom, setFullscreenZoom] = useState<number>(1)
    const router = useRouter()

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setNowMs(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timerId)
        }
    }, [])

    const remainingTimerSeconds = useMemo(() => {
        if (!timer || timer.timerSeconds <= 0) return null
        const endMs = timer.timerStartMs + (timer.timerSeconds * 1000)
        const diff = Math.ceil((endMs - nowMs) / 1000)
        return diff <= 0 ? 0 : diff
    }, [nowMs, timer])

    const timerLabel = useMemo(() => {
        if (remainingTimerSeconds === null) return null
        return formatRemainingTime(remainingTimerSeconds)
    }, [remainingTimerSeconds])

    const winnerData = buildWinnerData(matches)
    const placementLabels = useMemo(() => readPlacementLabels(phase.config), [phase.config])
    const rankingSegments = useMemo(() => readPlacementRankingSegments(phase.config), [phase.config])
    const rankingByPlace = useMemo(() => buildPlacementRanking(matches), [matches])
    const placementTrees = buildPlacementTrees(matches, placementLabels)
    const sizedPlacementTrees: PlacementTreeWithSize[] = placementTrees
        .map((tree) => {
            const totalMatches = countTreeMatches(tree)
            return {
                ...tree,
                totalMatches,
                isCompact: totalMatches <= 1,
            }
        })
        .sort((a, b) => b.totalMatches - a.totalMatches || a.start - b.start)

    const compactPlacementTrees = sizedPlacementTrees.filter((tree) => tree.isCompact)
    const mainPlacementTrees = sizedPlacementTrees.filter((tree) => !tree.isCompact)
    const rankingPlaces = Array.from(rankingByPlace.keys()).sort((a, b) => a - b)
    const defaultSegments = rankingPlaces.length > 0
        ? [{ start: rankingPlaces[0], end: rankingPlaces[rankingPlaces.length - 1], label: 'Classement global' }]
        : []
    const segmentsToDisplay = rankingSegments.length > 0 ? rankingSegments : defaultSegments
    const rotationMode = useMemo(() => readRotationMode(phase.config), [phase.config])
    const initialRotationSlots = useMemo(() => normalizeInterleavedTimeSlots(phase.config, matches), [phase.config, matches])
    const [rotationSlots, setRotationSlots] = useState<InterleavedTimeSlot[]>(initialRotationSlots)
    const initialRotationSignature = useMemo(() => serializeInterleavedTimeSlots(initialRotationSlots), [initialRotationSlots])
    const [serverRotationSignature, setServerRotationSignature] = useState(initialRotationSignature)
    const rotationSignature = useMemo(() => serializeInterleavedTimeSlots(rotationSlots), [rotationSlots])
    const hasUnsavedRotationChanges = rotationMode === 'interleaved' && rotationSignature !== serverRotationSignature
    const rotationLookup = useMemo(() => buildRotationLookup(rotationSlots), [rotationSlots])
    const rotationLabelLookup = useMemo(() => buildRotationLabelLookup(rotationSlots), [rotationSlots])
    const selectedMatch = useMemo(() => {
        if (!selectedMatchId) return null
        return matches.find((match) => match.id === selectedMatchId) ?? null
    }, [matches, selectedMatchId])

    useEffect(() => {
        const isDirty = rotationSignature !== serverRotationSignature
        if (isDirty) return
        if (rotationSignature === initialRotationSignature && serverRotationSignature === initialRotationSignature) return

        setRotationSlots(initialRotationSlots)
        setServerRotationSignature(initialRotationSignature)
    }, [initialRotationSignature, initialRotationSlots, rotationSignature, serverRotationSignature])

    useEffect(() => {
        const refreshId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return
            if (hasUnsavedRotationChanges) return
            startTransition(() => {
                router.refresh()
            })
        }, 10000)

        return () => {
            window.clearInterval(refreshId)
        }
    }, [hasUnsavedRotationChanges, router])

    useEffect(() => {
        if (!selectedMatchId) return
        if (matches.some((match) => match.id === selectedMatchId)) return
        setSelectedMatchId(null)
    }, [matches, selectedMatchId])

    useEffect(() => {
        if (!fullscreenOverlay) return

        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'

        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                setFullscreenOverlay(null)
            }
        }

        window.addEventListener('keydown', onKeyDown)
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [fullscreenOverlay])

    const handleAssignRotation = (matchId: string, rotationId: string) => {
        setRotationSaveMessage(null)
        setRotationSlots((currentSlots) => currentSlots.map((slot) => {
            const withoutMatch = slot.selectedMatchIds.filter((id) => id !== matchId)
            if (slot.id !== rotationId) {
                return { ...slot, selectedMatchIds: withoutMatch }
            }

            return {
                ...slot,
                selectedMatchIds: withoutMatch.includes(matchId) ? withoutMatch : [...withoutMatch, matchId],
            }
        }))
    }

    const handleAddRotation = () => {
        setRotationSaveMessage(null)
        setRotationSlots((currentSlots) => {
            const nextIndex = currentSlots.length
            const lastStartMs = currentSlots.length > 0
                ? currentSlots[currentSlots.length - 1].startTimeMs
                : Date.now()

            return [
                ...currentSlots,
                createRotationSlot(nextIndex, [], { startTimeMs: lastStartMs + 30 * 60_000 }),
            ]
        })
    }

    const handleResetRotationsByRound = () => {
        setRotationSlots(buildDefaultInterleavedTimeSlots(matches))
        setRotationSaveMessage(null)
    }

    const handleRotationLabelChange = (rotationId: string, value: string) => {
        setRotationSaveMessage(null)
        setRotationSlots((currentSlots) => currentSlots.map((slot) => {
            if (slot.id !== rotationId) return slot
            return { ...slot, label: value }
        }))
    }

    const handleRotationStartTimeChange = (rotationId: string, value: string) => {
        const nextStartMs = parseDateTimeLocal(value)
        if (nextStartMs === null) return

        setRotationSaveMessage(null)
        setRotationSlots((currentSlots) => currentSlots.map((slot) => {
            if (slot.id !== rotationId) return slot
            return { ...slot, startTimeMs: nextStartMs }
        }))
    }

    const handleClearRotations = () => {
        setRotationSlots((currentSlots) => currentSlots.map((slot, index) => createRotationSlot(index)))
        setRotationSaveMessage(null)
    }

    const handleSaveTimeSlots = async () => {
        setIsSavingTimeSlots(true)
        setRotationSaveMessage(null)
        try {
            const nextRotationSignature = rotationSignature
            const formData = new FormData()
            formData.set('tournamentId', tournamentId)
            formData.set('orgSlug', orgSlug)
            formData.set('tournamentSlug', tournamentSlug)
            formData.set('phaseId', phase.id)
            formData.set('timeSlotsJson', JSON.stringify(rotationSlots.map((slot, index) => ({
                id: slot.id,
                startTimeMs: slot.startTimeMs,
                label: slot.label || `R${index + 1}`,
                selectedMatchIds: slot.selectedMatchIds,
            }))))
            
            const response = await configureInterleavedTimeSlots(formData)
            setRotationSaveMessage({ success: response.success === true, message: response.message })
            if (response.success) {
                setServerRotationSignature(nextRotationSignature)
                startTransition(() => {
                    router.refresh()
                })
            }
        } catch (error) {
            console.error('Erreur lors de la sauvegarde des creneaux:', error)
            setRotationSaveMessage({ success: false, message: 'Erreur lors de la sauvegarde des rotations.' })
        } finally {
            setIsSavingTimeSlots(false)
        }
    }

    const handleMatchSaved = () => {
        setSelectedMatchId(null)
        startTransition(() => {
            router.refresh()
        })
    }

    const openFullscreenBoard = () => {
        setFullscreenZoom(1)
        setFullscreenOverlay({ mode: 'board' })
    }

    const openFullscreenBracket = (key: string, title: string, rounds: BracketRoundData[], matchWidth = 'w-[180px]') => {
        setFullscreenZoom(1)
        setFullscreenOverlay({ mode: 'bracket', key, title, rounds, matchWidth })
    }

    const closeFullscreenBracket = () => {
        setFullscreenOverlay(null)
    }

    const zoomStepIndex = FULLSCREEN_ZOOM_STEPS.findIndex((step) => step === fullscreenZoom)
    const canZoomOut = zoomStepIndex > 0
    const canZoomIn = zoomStepIndex >= 0 && zoomStepIndex < FULLSCREEN_ZOOM_STEPS.length - 1

    const handleZoomOut = () => {
        if (!canZoomOut) return
        setFullscreenZoom(FULLSCREEN_ZOOM_STEPS[zoomStepIndex - 1])
    }

    const handleZoomIn = () => {
        if (!canZoomIn) return
        setFullscreenZoom(FULLSCREEN_ZOOM_STEPS[zoomStepIndex + 1])
    }

    const renderBracketBoard = ({ isOverlay = false }: { isOverlay?: boolean }) => (
        <div className={`${isOverlay ? 'min-h-full min-w-[1400px]' : (fullscreen ? 'h-[calc(100vh-220px)]' : 'h-[720px]')} w-full bg-[#030712] text-slate-200 p-4 flex flex-col overflow-hidden relative rounded-[28px] border border-slate-900/40 shadow-sm`}>
            <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-50" />

            {!isOverlay && (
                <div className="absolute right-4 top-4 z-20">
                    <button
                        type="button"
                        onClick={openFullscreenBoard}
                        className="inline-flex items-center gap-2 rounded-xl border border-teal-300/35 bg-teal-400/12 px-4 py-2 text-sm font-semibold text-teal-100 shadow-[0_0_24px_rgba(45,212,191,0.16)] transition hover:border-teal-200 hover:bg-teal-300/18"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 3H5a2 2 0 00-2 2v3M16 3h3a2 2 0 012 2v3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3" />
                        </svg>
                        Agrandir toute la vue
                    </button>
                </div>
            )}

            <main className="flex-1 flex gap-4 min-h-0 relative z-10 px-2 overflow-hidden">
                <div className="w-[30%] flex flex-col h-full">
                    <BracketCard
                        rounds={winnerData}
                        className="h-full border-none bg-transparent"
                        matchWidth="w-[100px]"
                        orgSlug={orgSlug}
                        tournamentSlug={tournamentSlug}
                        onExpand={() => openFullscreenBracket('winner', 'Bracket principal', winnerData)}
                        expandAccent
                        rotationLookup={rotationMode === 'interleaved' ? rotationLookup : undefined}
                        rotationLabelLookup={rotationMode === 'interleaved' ? rotationLabelLookup : undefined}
                        rotationOptions={rotationMode === 'interleaved' ? rotationSlots : undefined}
                        onAssignRotation={rotationMode === 'interleaved' ? handleAssignRotation : undefined}
                        rotationDisabled={isSavingTimeSlots}
                        onOpenMatch={setSelectedMatchId}
                    />
                </div>

                <div className="flex-1 min-h-0 overflow-hidden">
                    {sizedPlacementTrees.length > 0 ? (
                        <div className="h-full flex flex-col gap-3">
                            {compactPlacementTrees.length > 0 && (
                                <div className="rounded border border-white/10 bg-white/[0.015] p-2">
                                    <div className="text-[8px] font-black uppercase tracking-widest text-white/60 mb-2">Phases courtes</div>
                                    <div className="flex flex-wrap gap-2">
                                        {compactPlacementTrees.map((tree) => (
                                            <BracketCard
                                                key={`${tree.start}-${tree.end}`}
                                                title={tree.title}
                                                rounds={tree.rounds}
                                                className="w-[180px] h-[108px]"
                                                matchWidth="w-[80px]"
                                                orgSlug={orgSlug}
                                                tournamentSlug={tournamentSlug}
                                                onExpand={() => openFullscreenBracket(`placement-${tree.start}-${tree.end}`, tree.title, tree.rounds, 'w-[160px]')}
                                                rotationLookup={rotationMode === 'interleaved' ? rotationLookup : undefined}
                                                rotationLabelLookup={rotationMode === 'interleaved' ? rotationLabelLookup : undefined}
                                                rotationOptions={rotationMode === 'interleaved' ? rotationSlots : undefined}
                                                onAssignRotation={rotationMode === 'interleaved' ? handleAssignRotation : undefined}
                                                rotationDisabled={isSavingTimeSlots}
                                                onOpenMatch={setSelectedMatchId}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex-1 min-h-0">
                                {mainPlacementTrees.length > 0 ? (
                                    <div className="h-full grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 auto-rows-fr">
                                        {mainPlacementTrees.map((tree) => (
                                            <BracketCard
                                                key={`${tree.start}-${tree.end}`}
                                                title={tree.title}
                                                rounds={tree.rounds}
                                                className={tree.totalMatches >= 4 ? 'min-h-[170px]' : 'min-h-[140px]'}
                                                orgSlug={orgSlug}
                                                tournamentSlug={tournamentSlug}
                                                onExpand={() => openFullscreenBracket(`placement-${tree.start}-${tree.end}`, tree.title, tree.rounds)}
                                                rotationLookup={rotationMode === 'interleaved' ? rotationLookup : undefined}
                                                rotationLabelLookup={rotationMode === 'interleaved' ? rotationLabelLookup : undefined}
                                                rotationOptions={rotationMode === 'interleaved' ? rotationSlots : undefined}
                                                onAssignRotation={rotationMode === 'interleaved' ? handleAssignRotation : undefined}
                                                rotationDisabled={isSavingTimeSlots}
                                                onOpenMatch={setSelectedMatchId}
                                            />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="h-full flex items-center justify-center opacity-40 text-[10px] font-bold uppercase tracking-widest">
                                        Aucun grand bracket de placement
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center opacity-40 text-[10px] font-bold uppercase tracking-widest">
                            Aucun bracket de placement genere
                        </div>
                    )}
                </div>
            </main>

            <footer className="mt-4 flex justify-between items-end relative z-10 border-t border-white/5 pt-3">
                <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className={`text-[8px] font-mono uppercase ${remainingTimerSeconds === 0 ? 'text-rose-400' : 'text-slate-500'}`}>
                            {timerLabel
                                ? `${timer?.timerMode === 'BREAK' ? 'Temps de battement' : 'Fin de session'} ${timerLabel}`
                                : 'Status: Live'}
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-end">
                    <span className="text-[8px] text-yellow-500 font-black uppercase tracking-widest mb-1">Tableau Officiel</span>
                    <h2 className="text-2xl font-black italic text-white leading-none uppercase tracking-tighter">{phase.name}</h2>
                </div>
            </footer>
        </div>
    )

    return (
        <div className="space-y-5 rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] p-4 md:p-5">
            <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="text-center flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Admin placement bracket</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{phase.name}</h3>
                        <p className="mt-2 text-sm text-slate-500">Meme affichage que l'editeur externe, avec edition des scores depuis chaque match.</p>
                    </div>
                    {showFullscreenLink && (
                        <Link
                            href={`/tournaments/${orgSlug}/${tournamentSlug}/bracket/placement?phaseId=${phase.id}`}
                            target="_blank"
                            className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-teal-300 hover:bg-teal-50 transition"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            Admin plein écran
                        </Link>
                    )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {matches.length} match(s)
                    </span>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                        Cliquer sur un match pour modifier le score
                    </span>
                    {rotationMode === 'interleaved' && (
                        <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                            Mode entrelacer actif
                        </span>
                    )}
                </div>
            </div>

            {rotationMode === 'interleaved' && matches.length > 0 && (
                <div className="rounded-[22px] border border-fuchsia-200 bg-white px-5 py-4 shadow-sm">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-wider text-fuchsia-700">Rotations de jeu</p>
                            <p className="mt-1 text-sm text-slate-600">
                                L’affectation se fait directement sur chaque match du bracket admin. Chaque carte peut etre placee sur une rotation R1, R2, R3...
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                type="button"
                                onClick={handleResetRotationsByRound}
                                disabled={isSavingTimeSlots}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Repartir par round
                            </button>
                            <button
                                type="button"
                                onClick={handleClearRotations}
                                disabled={isSavingTimeSlots}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Tout desassigner
                            </button>
                            <button
                                type="button"
                                onClick={handleAddRotation}
                                disabled={isSavingTimeSlots}
                                className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-xs font-semibold text-fuchsia-700 hover:bg-fuchsia-100 disabled:opacity-50"
                            >
                                Ajouter une rotation
                            </button>
                            <button
                                type="button"
                                onClick={handleSaveTimeSlots}
                                disabled={isSavingTimeSlots}
                                className="rounded-lg border border-fuchsia-600 bg-fuchsia-600 px-3 py-2 text-xs font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50"
                            >
                                {isSavingTimeSlots ? 'Enregistrement...' : 'Enregistrer les rotations'}
                            </button>
                        </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {rotationSlots.map((slot) => (
                            <span key={slot.id} className="rounded-full border border-fuchsia-200 bg-fuchsia-50 px-3 py-1 text-[11px] font-semibold text-fuchsia-700">
                                {slot.label} · {slot.selectedMatchIds.length} match(s)
                            </span>
                        ))}
                        {hasUnsavedRotationChanges && (
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold text-amber-700">
                                Modifications non enregistrees
                            </span>
                        )}
                    </div>

                    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                        {rotationSlots.map((slot, index) => (
                            <div key={`rotation-editor-${slot.id}`} className="rounded-lg border border-fuchsia-200 bg-fuchsia-50/60 p-3">
                                <p className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-fuchsia-700">Rotation {index + 1}</p>
                                <div className="space-y-2">
                                    <label className="block text-[11px] font-semibold text-slate-700">
                                        Nom
                                        <input
                                            type="text"
                                            value={slot.label}
                                            onChange={(event) => handleRotationLabelChange(slot.id, event.target.value)}
                                            disabled={isSavingTimeSlots}
                                            className="mt-1 w-full rounded border border-fuchsia-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-fuchsia-400 disabled:opacity-50"
                                            placeholder={`R${index + 1}`}
                                        />
                                    </label>
                                    <label className="block text-[11px] font-semibold text-slate-700">
                                        Tranche horaire
                                        <input
                                            type="datetime-local"
                                            value={formatDateTimeLocal(slot.startTimeMs)}
                                            onChange={(event) => handleRotationStartTimeChange(slot.id, event.target.value)}
                                            disabled={isSavingTimeSlots}
                                            className="mt-1 w-full rounded border border-fuchsia-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800 outline-none transition focus:border-fuchsia-400 disabled:opacity-50"
                                        />
                                    </label>
                                </div>
                            </div>
                        ))}
                    </div>

                    {rotationSaveMessage && (
                        <p className={`mt-3 text-xs ${rotationSaveMessage.success ? 'text-emerald-700' : 'text-red-700'}`}>
                            {rotationSaveMessage.message}
                        </p>
                    )}
                </div>
            )}

            {matches.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                    Aucun match de bracket de placement dans cette phase.
                </div>
            ) : (
                renderBracketBoard({})
            )}

            {fullscreenOverlay && (
                <div className="fixed inset-0 z-[999] h-full bg-slate-950/92 backdrop-blur-sm" onClick={closeFullscreenBracket}>
                    <div className="flex h-full flex-col p-4 md:p-6" onClick={(event) => event.stopPropagation()}>
                        <div className="mb-4 flex flex-col gap-4 rounded-[24px] border border-white/10 bg-white/[0.04] px-5 py-4 text-slate-200 shadow-[0_24px_80px_rgba(2,6,23,0.45)] lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex-1">
                                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Vue agrandie</p>
                                <h3 className="mt-2 text-xl font-black tracking-tight text-white">{fullscreenOverlay.mode === 'board' ? phase.name : fullscreenOverlay.title}</h3>
                                <p className="mt-2 text-xs text-slate-400">{fullscreenOverlay.mode === 'board'
                                    ? 'Toute la zone sombre s’ouvre dans une surcouche scrollable sans quitter la page. Cliquer sur le fond ou appuyer sur Echap la ferme.'
                                    : 'Le bracket s&apos;ouvre dans une surcouche scrollable sans quitter la page. Cliquer sur le fond ou appuyer sur Echap le ferme.'}
                                </p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <div className="inline-flex items-center rounded-xl border border-white/10 bg-white/[0.05] p-1">
                                    <button
                                        type="button"
                                        onClick={handleZoomOut}
                                        disabled={!canZoomOut}
                                        className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                        -
                                    </button>
                                    <div className="min-w-[72px] px-2 text-center text-xs font-black uppercase tracking-[0.18em] text-slate-300">
                                        {Math.round(fullscreenZoom * 100)}%
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleZoomIn}
                                        disabled={!canZoomIn}
                                        className="rounded-lg px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setFullscreenZoom(1)}
                                    disabled={fullscreenZoom === 1}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                    Reset zoom
                                </button>
                                <button
                                    type="button"
                                    onClick={closeFullscreenBracket}
                                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 py-2 text-sm font-semibold text-white transition hover:border-rose-300/40 hover:bg-rose-400/10"
                                >
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Fermer
                                </button>
                            </div>
                        </div>

                        <div className="relative min-h-0 flex-1 overflow-auto rounded-[28px] border border-slate-900/40 bg-[#030712] p-4 shadow-[0_28px_120px_rgba(15,23,42,0.55)] md:p-6">
                            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,_#1e293b_0%,_transparent_70%)] opacity-50" />
                            <div className="relative z-10 inline-flex min-h-full min-w-full">
                                <div style={{ zoom: fullscreenZoom }} className="min-h-full min-w-full origin-top-left">
                                    {fullscreenOverlay.mode === 'board' ? (
                                        renderBracketBoard({ isOverlay: true })
                                    ) : (
                                        <BracketCard
                                            key={fullscreenOverlay.key}
                                            title={fullscreenOverlay.title}
                                            rounds={fullscreenOverlay.rounds}
                                            className="min-h-full min-w-max border-white/10 bg-white/[0.03] p-4"
                                            matchWidth={fullscreenOverlay.matchWidth}
                                            orgSlug={orgSlug}
                                            tournamentSlug={tournamentSlug}
                                            expanded
                                            rotationLookup={rotationMode === 'interleaved' ? rotationLookup : undefined}
                                            rotationLabelLookup={rotationMode === 'interleaved' ? rotationLabelLookup : undefined}
                                            rotationOptions={rotationMode === 'interleaved' ? rotationSlots : undefined}
                                            onAssignRotation={rotationMode === 'interleaved' ? handleAssignRotation : undefined}
                                            rotationDisabled={isSavingTimeSlots}
                                            onOpenMatch={setSelectedMatchId}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {segmentsToDisplay.length > 0 && (
                <div className="rounded-[18px] border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Classement lie des brackets</p>
                        <span className="text-[11px] text-slate-500">Genere a partir des resultats enregistres</span>
                    </div>

                    <div className="grid gap-3 lg:grid-cols-2">
                        {segmentsToDisplay.map((segment) => (
                            <div key={`ranking-segment-${segment.start}-${segment.end}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                <p className="text-xs font-semibold text-slate-700">{segment.label}</p>
                                <p className="mb-2 text-[11px] text-slate-500">Places {segment.start} a {segment.end}</p>
                                <div className="space-y-1">
                                    {Array.from({ length: segment.end - segment.start + 1 }, (_, index) => {
                                        const place = segment.start + index
                                        const teamName = rankingByPlace.get(place)
                                        return (
                                            <div key={`ranking-place-${segment.start}-${segment.end}-${place}`} className="flex items-center justify-between rounded border border-slate-200 bg-white px-2 py-1">
                                                <span className="text-[11px] font-semibold text-slate-600">#{place}</span>
                                                <span className="text-[11px] text-slate-800">{teamName || '-'}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedMatch && (
                <MatchResultModal
                    match={{
                        id: selectedMatch.id,
                        phaseId: phase.id,
                        roundNumber: selectedMatch.roundNumber,
                        bracketPos: selectedMatch.bracketPos,
                        status: selectedMatch.status,
                        homeTeamId: null,
                        homeTeamName: selectedMatch.homeTeamName,
                        awayTeamId: null,
                        awayTeamName: selectedMatch.awayTeamName,
                        homeScore: selectedMatch.homeScore,
                        awayScore: selectedMatch.awayScore,
                    }}
                    orgSlug={orgSlug}
                    tournamentSlug={tournamentSlug}
                    tournamentId={tournamentId}
                    onClose={() => setSelectedMatchId(null)}
                    onSuccess={handleMatchSaved}
                />
            )}
        </div>
    )
}
