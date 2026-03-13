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

const groupByRound = (matches: BracketMatch[]) => {
    const map = new Map<number, BracketMatch[]>()
    for (const match of matches) {
        const round = match.roundNumber ?? 1
        const current = map.get(round) ?? []
        current.push(match)
        map.set(round, current)
    }
    return Array.from(map.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([round, roundMatches]) => ({
            round,
            matches: roundMatches.sort((a, b) => (a.bracketPos || '').localeCompare(b.bracketPos || '')),
        }))
}

export default function BracketPhaseView({ orgSlug, tournamentSlug, phase, matches }: Props) {
    const rounds = groupByRound(matches)

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
                <div className="overflow-x-auto">
                    <div className="flex min-w-max gap-3 pb-1">
                        {rounds.map((roundColumn) => (
                            <div key={`${phase.id}-round-${roundColumn.round}`} className="w-64 shrink-0 space-y-2 rounded-md border border-slate-800 bg-slate-950 p-2">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-cyan-300">Round {roundColumn.round}</p>
                                {roundColumn.matches.map((match) => (
                                    <Link
                                        key={match.id}
                                        href={`/dashboard/org/${orgSlug}/tournaments/${tournamentSlug}/matches/${match.id}`}
                                        className="block rounded-md border border-slate-800 bg-slate-900/60 p-2 hover:bg-slate-900"
                                    >
                                        <div className="mb-1 flex items-center justify-between">
                                            <span className="text-[10px] text-slate-500">{match.bracketPos || 'N/A'}</span>
                                            <span className="text-[10px] text-slate-400">{match.status}</span>
                                        </div>
                                        <p className="text-xs text-slate-200">{match.homeTeamName}</p>
                                        <p className="text-xs text-slate-200">{match.awayTeamName}</p>
                                        {match.homeScore !== null && match.awayScore !== null && (
                                            <p className="mt-1 text-[11px] font-semibold text-emerald-300">{match.homeScore} - {match.awayScore}</p>
                                        )}
                                    </Link>
                                ))}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
