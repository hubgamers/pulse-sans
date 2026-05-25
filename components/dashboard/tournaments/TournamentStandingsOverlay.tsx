import type { GroupConfig, GroupStandingRow, PhaseData } from './TournamentTabShell.types'

type TournamentStandingsOverlayProps = {
    standingsOverlay: { phaseId: string; mode: 'groups' | 'global' } | null
    standingsOverlayPhase: PhaseData | null
    standingsOverlayGroupConfig: GroupConfig | null
    standingsOverlayByGroup: Array<{ groupIndex: number; standings: GroupStandingRow[] }>
    standingsOverlayGlobal: GroupStandingRow[]
    setStandingsOverlay: (value: { phaseId: string; mode: 'groups' | 'global' } | null) => void
}

export default function TournamentStandingsOverlay({
    standingsOverlay,
    standingsOverlayPhase,
    standingsOverlayGroupConfig,
    standingsOverlayByGroup,
    standingsOverlayGlobal,
    setStandingsOverlay,
}: TournamentStandingsOverlayProps) {
    if (!standingsOverlay || !standingsOverlayPhase || !standingsOverlayGroupConfig) {
        return null
    }

    return (
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
    )
}
