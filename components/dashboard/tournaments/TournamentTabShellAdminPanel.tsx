import type { Dispatch, SetStateAction } from 'react'
import type { SerializedMatch, TabId } from './TournamentTabShell.types'

type TournamentTabShellAdminPanelProps = {
    isAdminPanelCollapsed: boolean
    setIsAdminPanelCollapsed: Dispatch<SetStateAction<boolean>>
    adminTimer: { mode: 'MATCH' | 'BREAK'; label: string; isDone: boolean } | null
    requiredActionsCount: number
    liveWithoutScores: SerializedMatch[]
    finishedWithoutScores: SerializedMatch[]
    overdueScheduled: SerializedMatch[]
    setActiveTab: (tab: TabId) => void
    setMatchesStep: (step: 1 | 2 | 3 | 4) => void
}

export default function TournamentTabShellAdminPanel({
    isAdminPanelCollapsed,
    setIsAdminPanelCollapsed,
    adminTimer,
    requiredActionsCount,
    liveWithoutScores,
    finishedWithoutScores,
    overdueScheduled,
    setActiveTab,
    setMatchesStep,
}: TournamentTabShellAdminPanelProps) {
    return (
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
    )
}
