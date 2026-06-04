'use client'

import { useFormStatus } from 'react-dom'
import type { ComponentProps, Dispatch, ReactNode, SetStateAction } from 'react'
import type { SerializedMatch, TabId } from './TournamentTabShell.types'
import type { InlineActionState } from './TournamentTabShell.types'
import { Badge, Button, Card, StatusAlert } from '@/components/ui'

type TournamentTabShellAdminPanelProps = {
    isAdminPanelCollapsed: boolean
    setIsAdminPanelCollapsed: Dispatch<SetStateAction<boolean>>
    adminTimer: { mode: 'MATCH' | 'BREAK'; label: string; isDone: boolean } | null
    tournamentId: string
    orgSlug: string
    tournamentSlug: string
    stopTimerAction: ComponentProps<'form'>['action']
    stopTimerState: InlineActionState
    requiredActionsCount: number
    liveWithoutScores: SerializedMatch[]
    finishedWithoutScores: SerializedMatch[]
    overdueScheduled: SerializedMatch[]
    setActiveTab: (tab: TabId) => void
    setMatchesStep: (step: 1 | 2 | 3 | 4) => void
}

function ActionButton({
    children,
    variant,
    onClick,
}: {
    children: ReactNode
    variant: 'warning' | 'danger' | 'info'
    onClick: () => void
}) {
    const className = {
        warning: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
        danger: 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100',
        info: 'border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100',
    }[variant]

    return (
        <button
            type="button"
            onClick={onClick}
            className={`w-full rounded-md border px-2 py-1.5 text-left transition-colors ${className}`}
        >
            {children}
        </button>
    )
}

function StopTimerButton({ disabled }: { disabled: boolean }) {
    const { pending } = useFormStatus()

    return (
        <button
            type="submit"
            disabled={disabled || pending}
            className="rounded-md border border-rose-300 px-2 py-1 text-[11px] font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
        >
            {pending ? 'Arret...' : 'Arreter'}
        </button>
    )
}

export default function TournamentTabShellAdminPanel({
    isAdminPanelCollapsed,
    setIsAdminPanelCollapsed,
    adminTimer,
    tournamentId,
    orgSlug,
    tournamentSlug,
    stopTimerAction,
    stopTimerState,
    requiredActionsCount,
    liveWithoutScores,
    finishedWithoutScores,
    overdueScheduled,
    setActiveTab,
    setMatchesStep,
}: TournamentTabShellAdminPanelProps) {
    const hasUrgentActions = liveWithoutScores.length > 0 || finishedWithoutScores.length > 0 || overdueScheduled.length > 0

    return (
        <aside className={`fixed bottom-4 right-4 z-40 transition-all ${isAdminPanelCollapsed ? 'w-[240px]' : 'w-[320px]'}`}>
            <Card className="bg-white/95 p-3 shadow-xl backdrop-blur">
                <div className="mb-2 flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Pilotage live</p>
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="h-7 px-2 text-[11px]"
                        onClick={() => setIsAdminPanelCollapsed((prev) => !prev)}
                    >
                        {isAdminPanelCollapsed ? 'Ouvrir' : 'Reduire'}
                    </Button>
                </div>

                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Timer admin</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                        <p className={`text-2xl font-black tabular-nums ${adminTimer?.isDone ? 'text-rose-600' : 'text-amber-700'}`}>
                            {adminTimer ? adminTimer.label : '--:--'}
                        </p>
                        <Badge variant={requiredActionsCount > 0 ? 'danger' : 'success'}>
                            {requiredActionsCount} action(s)
                        </Badge>
                    </div>
                    <p className="text-[11px] text-slate-600">
                        {adminTimer
                            ? (adminTimer.mode === 'BREAK' ? 'Temps de battement actif' : 'Timer de match actif')
                            : 'Aucun timer actif'}
                    </p>
                    <form action={stopTimerAction} className="mt-2 flex items-center justify-between gap-2">
                        <input type="hidden" name="tournamentId" value={tournamentId} />
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
                        <span className="text-[11px] text-slate-500">Controle timer overlay</span>
                        <StopTimerButton disabled={!adminTimer} />
                    </form>
                    {stopTimerState.message && (
                        <StatusAlert variant={stopTimerState.success ? 'success' : 'danger'} className="mt-2 px-2 py-1.5 text-xs">
                            {stopTimerState.message}
                        </StatusAlert>
                    )}
                </div>

                {!isAdminPanelCollapsed && (
                    <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actions requises</p>
                        <div className="mt-2 space-y-1.5 text-xs">
                            {liveWithoutScores.length > 0 && (
                                <ActionButton
                                    variant="warning"
                                    onClick={() => { setActiveTab('matches'); setMatchesStep(4) }}
                                >
                                    Ajouter les scores: {liveWithoutScores.length} match(s) live
                                </ActionButton>
                            )}
                            {finishedWithoutScores.length > 0 && (
                                <ActionButton
                                    variant="danger"
                                    onClick={() => { setActiveTab('matches'); setMatchesStep(4) }}
                                >
                                    Finaliser les scores: {finishedWithoutScores.length} match(s) termines
                                </ActionButton>
                            )}
                            {overdueScheduled.length > 0 && (
                                <ActionButton variant="info" onClick={() => setActiveTab('planning-time')}>
                                    Lancer les matchs en retard: {overdueScheduled.length}
                                </ActionButton>
                            )}
                            {!hasUrgentActions && (
                                <StatusAlert variant="success" className="px-2 py-1.5 text-xs">
                                    Aucune action urgente.
                                </StatusAlert>
                            )}
                        </div>
                    </div>
                )}
            </Card>
        </aside>
    )
}
