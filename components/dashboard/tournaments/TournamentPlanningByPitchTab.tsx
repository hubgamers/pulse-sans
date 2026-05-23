'use client'

import type { SerializedMatch } from './TournamentTabShell.types'
import { EmptyState } from './TournamentTabShell.helpers'

type ScheduleByPitch = Array<{
    pitchName: string
    slots: Array<{ slotStart: number; label: string; matches: SerializedMatch[] }>
    unscheduled: SerializedMatch[]
}>

type TournamentPlanningByPitchTabProps = {
    matches: SerializedMatch[]
    scheduleByPitch: ScheduleByPitch
    getMatchGroupLabel: (match: SerializedMatch) => string | null
}

export default function TournamentPlanningByPitchTab({
    matches,
    scheduleByPitch,
    getMatchGroupLabel,
}: TournamentPlanningByPitchTabProps) {
    return (
<div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">Planning par piste et tranche horaire</p>
        <p className="mt-1">Visualisez les matchs par piste puis par horaire exact pour voir les matchs qui demarrent au meme moment.</p>
    </div>

    {matches.length === 0 ? (
        <EmptyState message="Aucun match disponible pour construire le planning." />
    ) : (
        <div className="grid gap-4 xl:grid-cols-2">
            {scheduleByPitch.map((pitch) => (
                <div key={`planning-${pitch.pitchName}`} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-teal-700">{pitch.pitchName}</p>
                        <span className="text-[11px] text-slate-500">{pitch.slots.length} horaire(s)</span>
                    </div>

                    {pitch.slots.length === 0 ? (
                        <p className="text-xs text-slate-500">Aucun match planifie sur cette piste.</p>
                    ) : (
                        <div className="space-y-2">
                            {pitch.slots.map((slot) => (
                                <div key={`${pitch.pitchName}-${slot.slotStart}`} className="rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
                                    {/* Header minimaliste */}
                                    <div className="flex items-center gap-2 mb-1 px-1">
                                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded uppercase">{slot.label}</span>
                                    </div>

                                    <div className="flex flex-col gap-0.5">
                                        {slot.matches.map((match) => {
                                            const groupLabel = getMatchGroupLabel(match);
                                            return (
                                                <div key={`slot-${match.id}`} className="group flex items-center justify-between gap-3 rounded px-2 py-1 hover:bg-slate-50 transition-colors">

                                                    {/* Gauche : Équipes & Poule */}
                                                    <div className="flex items-center gap-2 overflow-hidden">
                                                        <div className="flex items-center gap-1.5 text-xs font-medium text-slate-700 truncate">
                                                            <span className="truncate max-w-[80px] md:max-w-[120px]">{match.homeTeam?.name || 'TBD'}</span>
                                                            <span className="text-[10px] text-slate-300 font-normal italic">vs</span>
                                                            <span className="truncate max-w-[80px] md:max-w-[120px]">{match.awayTeam?.name || 'TBD'}</span>
                                                        </div>

                                                        {groupLabel && (
                                                            <span className="text-[9px] font-bold text-emerald-600/80 px-1 border-l border-emerald-100 ml-1">
                                                                {groupLabel}
                                                            </span>
                                                        )}
                                                    </div>

                                                    {/* Droite : Phase & Heure (Focus uniquement sur l'essentiel) */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <span className="text-[10px] text-slate-400">
                                                            {match.phase.name.split(' ')[0]} {match.roundNumber ? `• R${match.roundNumber}` : ''}
                                                        </span>
                                                        {match.scheduledAt && (
                                                            <span className="text-[11px] font-bold text-slate-600">
                                                                {new Date(match.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                                            </span>
                                                        )}
                                                    </div>

                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {pitch.unscheduled.length > 0 && (
                        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-2">
                            <p className="mb-1 text-[11px] uppercase tracking-wider text-slate-500">Non planifies</p>
                            <div className="space-y-1">
                                {pitch.unscheduled.map((match) => (
                                    <p key={`unscheduled-${match.id}`} className="text-xs text-slate-700">
                                        {match.phase.name}
                                        {getMatchGroupLabel(match) ? ` • ${getMatchGroupLabel(match)}` : ''}: {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                                    </p>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    )}
</div>

    )
}
