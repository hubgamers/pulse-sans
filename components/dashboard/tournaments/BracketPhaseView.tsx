import Link from 'next/link'

type BracketMatch = {
    id: string
    roundNumber: number | null
    bracketPos: string | null
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
    }
    matches: BracketMatch[]
}

type LaneKey = 'WB' | 'LB' | 'PLACEMENT' | 'OTHER'

type LaneRound = {
    round: number
    matches: BracketMatch[]
}

type LaneData = {
    key: LaneKey
    label: string
    rounds: LaneRound[]
}

type PlacementMatch = {
    start: number
    end: number
    match: BracketMatch
}

type PlacementBracketGroup = {
    start: number
    end: number
    rounds: LaneRound[]
}

function parseLane(match: BracketMatch): { lane: LaneKey; round: number } {
    const pos = match.bracketPos || ''
    const wbOrLb = pos.match(/^(WB|LB)-R(\d+)-M\d+$/)
    if (wbOrLb) {
        return {
            lane: wbOrLb[1] as LaneKey,
            round: Number(wbOrLb[2]),
        }
    }

    if (/^P\d+-P\d+$/.test(pos)) {
        return { lane: 'PLACEMENT', round: 1 }
    }

    return {
        lane: 'OTHER',
        round: match.roundNumber ?? 1,
    }
}

function buildLanes(matches: BracketMatch[]): LaneData[] {
    const laneMap = new Map<LaneKey, Map<number, BracketMatch[]>>()

    for (const match of matches) {
        const parsed = parseLane(match)
        const roundsMap = laneMap.get(parsed.lane) ?? new Map<number, BracketMatch[]>()
        const bucket = roundsMap.get(parsed.round) ?? []
        bucket.push(match)
        roundsMap.set(parsed.round, bucket)
        laneMap.set(parsed.lane, roundsMap)
    }

    const laneLabels: Record<LaneKey, string> = {
        WB: 'Winner Bracket',
        LB: 'Loser Bracket',
        PLACEMENT: 'Matchs de placement',
        OTHER: 'Autres matchs',
    }

    const orderedKeys: LaneKey[] = ['WB', 'LB', 'PLACEMENT', 'OTHER']

    return orderedKeys
        .filter((key) => laneMap.has(key))
        .map((key) => {
            const roundsMap = laneMap.get(key) ?? new Map<number, BracketMatch[]>()
            const rounds = Array.from(roundsMap.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([round, roundMatches]) => ({
                    round,
                    matches: roundMatches.sort((a, b) => (a.bracketPos || '').localeCompare(b.bracketPos || '')),
                }))

            return {
                key,
                label: laneLabels[key],
                rounds,
            }
        })
}

function statusPill(status: BracketMatch['status']) {
    if (status === 'FINISHED') return 'bg-emerald-600/20 text-emerald-300'
    if (status === 'LIVE') return 'bg-amber-600/20 text-amber-300'
    if (status === 'CANCELLED') return 'bg-red-600/20 text-red-300'
    return 'bg-slate-700 text-slate-300'
}

function parsePlacementMatch(match: BracketMatch): PlacementMatch | null {
    const pos = match.bracketPos || ''
    const parsed = pos.match(/^P(\d+)-(\d+)-R(\d+)-M(\d+)$/)
    if (!parsed) return null
    const start = Number(parsed[1])
    const end = Number(parsed[2])
    if (!Number.isInteger(start) || !Number.isInteger(end)) return null
    return { start, end, match }
}

function buildPlacementGroups(matches: BracketMatch[]): PlacementBracketGroup[] {
    const groups = new Map<string, Map<number, BracketMatch[]>>()

    for (const match of matches) {
        const parsed = parsePlacementMatch(match)
        if (!parsed) continue
        const key = `${parsed.start}-${parsed.end}`
        const roundsMap = groups.get(key) ?? new Map<number, BracketMatch[]>()
        const roundMatch = match.bracketPos?.match(/^P\d+-\d+-R(\d+)-M\d+$/)
        const round = roundMatch ? Number(roundMatch[1]) : 1
        const bucket = roundsMap.get(round) ?? []
        bucket.push(match)
        roundsMap.set(round, bucket)
        groups.set(key, roundsMap)
    }

    return Array.from(groups.entries())
        .map(([key, roundsMap]) => {
            const [startRaw, endRaw] = key.split('-')
            const start = Number(startRaw)
            const end = Number(endRaw)
            return {
                start,
                end,
                rounds: Array.from(roundsMap.entries())
                    .sort((a, b) => a[0] - b[0])
                    .map(([round, roundMatches]) => ({
                        round,
                        matches: roundMatches.sort((a, b) => (a.bracketPos || '').localeCompare(b.bracketPos || '')),
                    })),
            }
        })
        .sort((a, b) => {
            const sizeA = a.end - a.start
            const sizeB = b.end - b.start
            if (sizeB !== sizeA) return sizeB - sizeA
            return a.start - b.start
        })
}

function renderMatchCard(match: BracketMatch, orgSlug: string, tournamentSlug: string, showArrow: boolean) {
    return (
        <div key={`${match.id}-wrapper`} className="relative">
            <Link
                href={`/dashboard/org/${orgSlug}/tournaments/${tournamentSlug}/matches/${match.id}`}
                className="block rounded-md border border-slate-800 bg-slate-900/60 p-2 hover:bg-slate-900"
            >
                <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-slate-500">{match.bracketPos || 'N/A'}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusPill(match.status)}`}>
                        {match.status}
                    </span>
                </div>
                <p className="text-xs text-slate-200">{match.homeTeamName}</p>
                <p className="text-xs text-slate-200">{match.awayTeamName}</p>
                {match.homeScore !== null && match.awayScore !== null && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-300">{match.homeScore} - {match.awayScore}</p>
                )}
            </Link>

            {showArrow && (
                <>
                    <span className="pointer-events-none absolute -right-4 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-cyan-500/60 md:block" />
                    <span className="pointer-events-none absolute -right-[18px] top-1/2 hidden -translate-y-1/2 border-y-4 border-y-transparent border-l-4 border-l-cyan-400 md:block" />
                </>
            )}
        </div>
    )
}

function renderLane(
    lane: LaneData,
    phase: Props['phase'],
    orgSlug: string,
    tournamentSlug: string
) {
    return (
        <div key={`${phase.id}-lane-${lane.key}`} className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">{lane.label}</p>
                <span className="text-[10px] text-slate-500">{lane.rounds.reduce((acc, r) => acc + r.matches.length, 0)} match(s)</span>
            </div>

            <div className="overflow-x-auto">
                <div className="flex min-w-max items-start gap-4 pb-1">
                    {lane.rounds.map((roundColumn, colIdx) => {
                        const showArrow = colIdx < lane.rounds.length - 1
                        return (
                            <div key={`${phase.id}-${lane.key}-round-${roundColumn.round}`} className="w-72 shrink-0 space-y-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-300">Round {roundColumn.round}</p>
                                {roundColumn.matches.map((match) => renderMatchCard(match, orgSlug, tournamentSlug, showArrow))}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default function BracketPhaseView({ orgSlug, tournamentSlug, phase, matches }: Props) {
    const lanes = buildLanes(matches)
    const wbLane = lanes.find((lane) => lane.key === 'WB')
    const lbLane = lanes.find((lane) => lane.key === 'LB')
    const otherLane = lanes.find((lane) => lane.key === 'OTHER')
    const placementGroups = buildPlacementGroups(matches)

    return (
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3">
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500">Etape {phase.order} • {phase.type}</p>
                    <h3 className="text-sm font-semibold">{phase.name}</h3>
                </div>
                <span className="text-xs text-slate-500">{matches.length} match(s)</span>
            </div>

            {matches.length === 0 ? (
                <p className="text-xs text-slate-500">Aucun match de bracket dans cette phase.</p>
            ) : (
                phase.type === 'PLACEMENT_BRACKET' ? (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">Bracket principal</p>
                            <div className="grid gap-3 xl:grid-cols-2">
                                {wbLane ? renderLane(wbLane, phase, orgSlug, tournamentSlug) : <p className="text-xs text-slate-500">Aucun Winner Bracket.</p>}
                                {lbLane ? renderLane(lbLane, phase, orgSlug, tournamentSlug) : <p className="text-xs text-slate-500">Aucun Loser Bracket.</p>}
                            </div>
                        </div>

                        {placementGroups.length > 0 && (
                            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2">
                                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-amber-300">Brackets de classement</p>
                                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                                    {placementGroups.map((placement) => (
                                        <div key={`placement-${placement.start}-${placement.end}`} className="rounded-md border border-slate-800 bg-slate-950 p-2">
                                            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-lime-300">
                                                {placement.end - placement.start >= 1 ? `PLACE ${placement.start} A ${placement.end}` : `PLACE ${placement.start}`}
                                            </p>
                                            <div className="overflow-x-auto">
                                                <div className="flex min-w-max items-start gap-3">
                                                    {placement.rounds.map((roundColumn, colIdx) => (
                                                        <div key={`placement-${placement.start}-${placement.end}-r${roundColumn.round}`} className="w-64 shrink-0 space-y-2 rounded-md border border-slate-800 bg-slate-900/40 p-2">
                                                            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Round {roundColumn.round}</p>
                                                            {roundColumn.matches.map((match) => renderMatchCard(match, orgSlug, tournamentSlug, colIdx < placement.rounds.length - 1))}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {otherLane ? renderLane(otherLane, phase, orgSlug, tournamentSlug) : null}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {lanes.map((lane) => renderLane(lane, phase, orgSlug, tournamentSlug))}
                    </div>
                )
            )}
        </div>
    )
}
