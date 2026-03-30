import Link from 'next/link'
import PlacementBracketPhaseView from './PlacementBracketPhaseView'

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
    return 'bg-slate-700 text-slate-700'
}

function renderMatchCard(match: BracketMatch, orgSlug: string, tournamentSlug: string, showArrow: boolean) {
    return (
        <div key={`${match.id}-wrapper`} className="relative">
            <Link
                href={`/dashboard/org/${orgSlug}/tournaments/${tournamentSlug}/matches/${match.id}`}
                className="block rounded-md border border-slate-200 bg-white p-2 hover:bg-slate-50"
            >
                <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-[10px] text-slate-500">{match.bracketPos || 'N/A'}</span>
                    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusPill(match.status)}`}>
                        {match.status}
                    </span>
                </div>
                {match.scheduledAt && (
                    <p className="mb-1 text-[10px] font-medium text-teal-600">
                        {new Date(match.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {match.pitchName && <span className="ml-1 text-slate-400">· {match.pitchName}</span>}
                    </p>
                )}
                {!match.scheduledAt && match.pitchName && (
                    <p className="mb-1 text-[10px] text-slate-400">{match.pitchName}</p>
                )}
                <p className="text-xs text-slate-800">{match.homeTeamName}</p>
                <p className="text-xs text-slate-800">{match.awayTeamName}</p>
                {match.homeScore !== null && match.awayScore !== null && (
                    <p className="mt-1 text-[11px] font-semibold text-emerald-300">{match.homeScore} - {match.awayScore}</p>
                )}
            </Link>

            {showArrow && (
                <>
                    <span className="pointer-events-none absolute -right-4 top-1/2 hidden h-px w-4 -translate-y-1/2 bg-teal-300 md:block" />
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
        <div key={`${phase.id}-lane-${lane.key}`} className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="mb-2 flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-teal-700">{lane.label}</p>
                <span className="text-[10px] text-slate-500">{lane.rounds.reduce((acc, r) => acc + r.matches.length, 0)} match(s)</span>
            </div>

            <div className="overflow-x-auto">
                <div className="flex min-w-max items-start gap-4 pb-1">
                    {lane.rounds.map((roundColumn, colIdx) => {
                        const showArrow = colIdx < lane.rounds.length - 1
                        return (
                            <div key={`${phase.id}-${lane.key}-round-${roundColumn.round}`} className="w-72 shrink-0 space-y-2 rounded-md border border-slate-200 bg-white p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Round {roundColumn.round}</p>
                                {roundColumn.matches.map((match) => renderMatchCard(match, orgSlug, tournamentSlug, showArrow))}
                            </div>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}

export default function BracketPhaseView({ tournamentId, orgSlug, tournamentSlug, phase, matches, timer = null }: Props) {
    if (phase.type === 'PLACEMENT_BRACKET') {
        return (
            <PlacementBracketPhaseView
                tournamentId={tournamentId}
                orgSlug={orgSlug}
                tournamentSlug={tournamentSlug}
                phase={phase}
                matches={matches}
                timer={timer}
            />
        )
    }

    const lanes = buildLanes(matches)
    return (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
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
                <div className="space-y-4">
                    {lanes.map((lane) => renderLane(lane, phase, orgSlug, tournamentSlug))}
                </div>
            )}
        </div>
    )
}
