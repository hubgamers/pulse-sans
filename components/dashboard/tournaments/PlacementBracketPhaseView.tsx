'use client'

import Link from 'next/link'
import { startTransition, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

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

type RankingEntry = {
    place: number
    teamName: string | null
}

type RankingSegment = {
    start: number
    end: number
    label: string
}

const WINNER_COLORS = ['text-sky-400', 'text-yellow-500', 'text-orange-500', 'text-[#ccff00]']

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
}: {
    match: DisplayMatch
    players: DisplayPlayer[]
    isFinal: boolean
    width: string
    orgSlug: string
    tournamentSlug: string
}) => (
    <Link
        href={`/dashboard/org/${orgSlug}/tournaments/${tournamentSlug}/matches/${match.matchId}`}
        className={`group relative flex flex-col bg-slate-950 border ${isFinal ? 'border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'border-white/10'} rounded overflow-hidden ${width} z-10 hover:border-teal-400/60`}
    >
        {match.scheduledAt && (
            <div className="px-2 pt-0.5 text-[6px] font-semibold text-teal-400 opacity-80 tracking-wide">
                {new Date(match.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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
    </Link>
)

const BracketRound = ({
    round,
    roundIdx,
    isLast,
    matchWidth,
    orgSlug,
    tournamentSlug,
}: {
    round: BracketRoundData
    roundIdx: number
    isLast: boolean
    matchWidth: string
    orgSlug: string
    tournamentSlug: string
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
}: {
    title?: string
    rounds: BracketRoundData[]
    className?: string
    matchWidth?: string
    orgSlug: string
    tournamentSlug: string
}) => (
    <div className={`flex flex-col bg-white/[0.02] border border-white/5 rounded p-2 overflow-hidden ${className}`}>
        {title && (
            <div className="flex items-center gap-2 mb-2">
                <div className="h-2.5 w-0.5 bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
                <h3 className="text-[8px] font-black text-white/80 uppercase italic tracking-wider">{title}</h3>
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
                    />
                ))
            ) : (
                <div className="flex-1 flex items-center justify-center opacity-10 text-[8px] italic uppercase">Non genere</div>
            )}
        </div>
    </div>
)

export default function PlacementBracketPhaseView({ orgSlug, tournamentSlug, phase, matches, timer = null }: Props) {
    const [nowMs, setNowMs] = useState(() => Date.now())
    const router = useRouter()

    useEffect(() => {
        const timerId = window.setInterval(() => {
            setNowMs(Date.now())
        }, 1000)

        return () => {
            window.clearInterval(timerId)
        }
    }, [])

    useEffect(() => {
        const refreshId = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return
            startTransition(() => {
                router.refresh()
            })
        }, 10000)

        return () => {
            window.clearInterval(refreshId)
        }
    }, [router])

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

    return (
        <div className="space-y-5 rounded-[30px] border border-slate-200 bg-[linear-gradient(180deg,_#f8fafc_0%,_#eef2f7_100%)] p-4 md:p-5">
            <div className="rounded-[26px] border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="text-center flex-1">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-slate-400">Admin placement bracket</p>
                        <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">{phase.name}</h3>
                        <p className="mt-2 text-sm text-slate-500">Meme affichage que l'editeur externe, avec edition des scores depuis chaque match.</p>
                    </div>
                    <Link
                        href={`/tournaments/${orgSlug}/${tournamentSlug}/bracket/placement`}
                        target="_blank"
                        className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:border-teal-300 hover:bg-teal-50 transition"
                    >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        Ouvrir l'editeur plein ecran
                    </Link>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700">
                        {matches.length} match(s)
                    </span>
                    <span className="rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
                        Cliquer sur un match pour modifier le score
                    </span>
                </div>
            </div>

            {matches.length === 0 ? (
                <div className="rounded-[26px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
                    Aucun match de bracket de placement dans cette phase.
                </div>
            ) : (
                <div className="h-[720px] w-full bg-[#030712] text-slate-200 p-4 flex flex-col overflow-hidden relative rounded-[28px] border border-slate-900/40 shadow-sm">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-50" />

                    <main className="flex-1 flex gap-4 min-h-0 relative z-10 px-2 overflow-hidden">
                        <div className="w-[30%] flex flex-col h-full">
                            <BracketCard
                                rounds={winnerData}
                                className="h-full border-none bg-transparent"
                                matchWidth="w-[100px]"
                                orgSlug={orgSlug}
                                tournamentSlug={tournamentSlug}
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
                                                        matchWidth="w-[64px]"
                                                        orgSlug={orgSlug}
                                                        tournamentSlug={tournamentSlug}
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
        </div>
    )
}
