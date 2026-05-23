'use client'

import Link from 'next/link'
import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import type { InlineActionState, SerializedMatch, TournamentData } from './TournamentTabShell.types'
import { EmptyState, LoadingSubmitButton } from './TournamentTabShell.helpers'

type ScheduleByTime = {
    slots: Array<{ at: number; label: string; matches: SerializedMatch[] }>
    unscheduled: SerializedMatch[]
}

type TournamentPlanningTimeTabProps = {
    orgSlug: string
    tournament: TournamentData
    matches: SerializedMatch[]
    scheduleByTime: ScheduleByTime
    slotTimerMinutes: number
    setSlotTimerMinutes: Dispatch<SetStateAction<number>>
    slotBreakMinutes: number
    setSlotBreakMinutes: Dispatch<SetStateAction<number>>
    slotLaunchAction: ComponentProps<'form'>['action']
    slotLaunchState: InlineActionState
    breakTimerAction: ComponentProps<'form'>['action']
    breakTimerState: InlineActionState
    getMatchGroupLabel: (match: SerializedMatch) => string | null
    inputCls: string
}

export default function TournamentPlanningTimeTab({
    orgSlug,
    tournament,
    matches,
    scheduleByTime,
    slotTimerMinutes,
    setSlotTimerMinutes,
    slotBreakMinutes,
    setSlotBreakMinutes,
    slotLaunchAction,
    slotLaunchState,
    breakTimerAction,
    breakTimerState,
    getMatchGroupLabel,
    inputCls,
}: TournamentPlanningTimeTabProps) {
    return (
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
    )
}
