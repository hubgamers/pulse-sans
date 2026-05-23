'use client'

import type { ComponentProps } from 'react'
import {
    addTournamentRegistration,
    createTournamentPitch,
    removeTournamentRegistration,
    updateTournamentRegistrationConfirmation,
} from '@/lib/actions/tournament-management.actions'
import type { InlineActionState, TournamentData } from './TournamentTabShell.types'
import { va } from './TournamentTabShell.utils'
import { LoadingSubmitButton, StepSection } from './TournamentTabShell.helpers'

type PitchGroup = {
    name: string
    pitchIds: string[]
    hasGlobal: boolean
    phaseNames: string[]
}

type TournamentRegistrationsTabProps = {
    orgSlug: string
    tournament: TournamentData
    availableTeams: Array<{ id: string; name: string; slug: string }>
    pitchGroups: PitchGroup[]
    bulkPitchCreateAction: ComponentProps<'form'>['action']
    bulkPitchCreateState: InlineActionState
    bulkPitchDeleteAction: ComponentProps<'form'>['action']
    bulkPitchDeleteState: InlineActionState
    inputCls: string
    btnPrimary: string
    btnDanger: string
}

export default function TournamentRegistrationsTab({
    orgSlug,
    tournament,
    availableTeams,
    pitchGroups,
    bulkPitchCreateAction,
    bulkPitchCreateState,
    bulkPitchDeleteAction,
    bulkPitchDeleteState,
    inputCls,
    btnPrimary,
    btnDanger,
}: TournamentRegistrationsTabProps) {
    return (
<div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">Avant de commencer</p>
        <p className="mt-1">Suivez ces etapes pour preparer votre tournoi : inscrivez les équipes, confirmez leur participation, puis configurez les pistes de jeu disponibles.</p>
    </div>

    <div className="grid gap-4 xl:grid-cols-2">
        {/* Step 1: Inscriptions */}
        <StepSection num={1} title="Inscrire les équipes" desc="Ajoutez les équipes participantes et confirmez leur inscription.">
            <form action={va(addTournamentRegistration)} className="grid gap-2 md:grid-cols-2">
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <select
                    name="teamIds"
                    className="w-full rounded-lg border border-slate-200 bg-white p-1 text-sm text-slate-700 outline-none transition-all focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 md:col-span-2 min-h-40 scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent shadow-sm"
                    required
                    multiple
                    size={Math.min(10, Math.max(4, availableTeams.length))}
                >
                    {availableTeams.map((team) => (
                        <option
                            key={team.id}
                            value={team.id}
                            className="py-2 px-3 bg-white text-slate-600 checked:bg-teal-500 checked:text-white hover:bg-teal-50 cursor-pointer border-b border-slate-50 last:border-0"
                        >
                            {team.name}
                        </option>
                    ))}
                </select>
                <p className="md:col-span-2 text-xs text-slate-500">
                    Multi-selection: maintenez Ctrl (Windows) ou Cmd (Mac), puis cliquez sur les équipes a inscrire.
                </p>
                <input type="number" name="seed" min={1} placeholder="Seed (optionnel)" className={inputCls} />
                <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                    <input name="isConfirmed" type="checkbox" className="h-4 w-4 accent-teal-600" />
                    Confirmer directement
                </label>
                <LoadingSubmitButton
                    className={`${btnPrimary} md:col-span-2 disabled:opacity-60`}
                    disabled={availableTeams.length === 0}
                    loadingLabel="Ajout en cours..."
                >
                    {availableTeams.length === 0 ? 'Toutes les équipes sont inscrites' : 'Ajouter les équipes'}
                </LoadingSubmitButton>
            </form>

            <div className="mt-2 space-y-1.5">
                {tournament.registrations.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-4">Aucune equipe inscrite.</p>
                ) : (
                    tournament.registrations.sort((a, b) => {
                        return a.team.name.localeCompare(b.team.name);
                    }).map((reg) => (
                        <div key={reg.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex items-center gap-2">
                                <div className={`h-2 w-2 rounded-full ${reg.isConfirmed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                                <p className="text-sm font-semibold">{reg.team.name}</p>
                                <span className="text-xs text-slate-500">
                                    {reg.seed ? `seed ${reg.seed}` : ''}
                                    {!reg.isConfirmed ? ' • en attente' : ''}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <form action={va(updateTournamentRegistrationConfirmation)}>
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <input type="hidden" name="registrationId" value={reg.id} />
                                    <input type="hidden" name="isConfirmed" value={reg.isConfirmed ? 'false' : 'true'} />
                                    <LoadingSubmitButton
                                        className={`rounded-md border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-60 ${reg.isConfirmed
                                            ? 'border-amber-300 text-amber-700 hover:bg-amber-50'
                                            : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50'
                                            }`}
                                        loadingLabel={reg.isConfirmed ? 'Deconfirmation...' : 'Confirmation...'}
                                    >
                                        {reg.isConfirmed ? 'Deconfirmer' : 'Confirmer'}
                                    </LoadingSubmitButton>
                                </form>

                                <form action={va(removeTournamentRegistration)}>
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <input type="hidden" name="registrationId" value={reg.id} />
                                    <LoadingSubmitButton className={`${btnDanger} disabled:opacity-60`} loadingLabel="Retrait...">Retirer</LoadingSubmitButton>
                                </form>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </StepSection>

        {/* Step 2: Pistes */}
        <StepSection num={2} title="Configurer les pistes" desc="Demandez a l'organisateur les phases concernees : une piste peut etre rattachee a plusieurs phases." color="cyan">
            <form action={va(createTournamentPitch)} className="grid gap-2 md:grid-cols-3">
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                <input name="name" className={inputCls} placeholder="Nom de la piste" required />
                <select
                    name="phaseIds"
                    className={`${inputCls} md:col-span-2 min-h-28`}
                    multiple
                    size={Math.min(8, Math.max(3, tournament.phases.length))}
                >
                    {tournament.phases.map((phase) => (
                        <option key={phase.id} value={phase.id}>{phase.name}</option>
                    ))}
                </select>
                <p className="md:col-span-2 text-xs text-slate-500">
                    Aucune phase selectionnee = piste disponible pour toutes les phases. Multi-selection via Ctrl/Cmd + clic.
                </p>
                <LoadingSubmitButton className={`${btnPrimary} disabled:opacity-60`} loadingLabel="Ajout...">Ajouter</LoadingSubmitButton>
            </form>

            <div className="grid gap-2 md:grid-cols-2">
                <form action={bulkPitchCreateAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Ajout massif</p>
                    <textarea
                        name="pitchNames"
                        rows={5}
                        className={`${inputCls} min-h-28 w-full`}
                        placeholder={'Ex: Piste A\nPiste B\nPiste C'}
                        required
                    />
                    <select
                        name="phaseIds"
                        className={`${inputCls} min-h-24 w-full`}
                        multiple
                        size={Math.min(6, Math.max(3, tournament.phases.length))}
                    >
                        {tournament.phases.map((phase) => (
                            <option key={`bulk-create-phase-${phase.id}`} value={phase.id}>{phase.name}</option>
                        ))}
                    </select>
                    <p className="text-[11px] text-slate-500">Un nom par ligne (ou separe par virgule). Sans phase selectionnee = pistes globales.</p>
                    <LoadingSubmitButton className={`${btnPrimary} w-full disabled:opacity-60`} loadingLabel="Ajout massif...">
                        Ajouter en masse
                    </LoadingSubmitButton>

                    {bulkPitchCreateState.message && (
                        <p className={`text-[11px] ${bulkPitchCreateState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                            {bulkPitchCreateState.message}
                        </p>
                    )}
                </form>

                <form action={bulkPitchDeleteAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Suppression massive</p>
                    <select
                        name="pitchIds"
                        className={`${inputCls} min-h-40 w-full`}
                        multiple
                        size={Math.min(10, Math.max(4, tournament.pitches.length))}
                        required
                    >
                        {tournament.pitches.map((pitch) => (
                            <option key={`bulk-delete-pitch-${pitch.id}`} value={pitch.id}>
                                {pitch.name} • {pitch.phase?.name || 'Toutes phases'}
                            </option>
                        ))}
                    </select>
                    <p className="text-[11px] text-slate-500">Multi-selection via Ctrl/Cmd + clic. Les pistes deja liees a des matchs seront ignorees.</p>
                    <LoadingSubmitButton
                        className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                        loadingLabel="Suppression massive..."
                    >
                        Supprimer la selection
                    </LoadingSubmitButton>

                    {bulkPitchDeleteState.message && (
                        <p className={`text-[11px] ${bulkPitchDeleteState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                            {bulkPitchDeleteState.message}
                        </p>
                    )}
                </form>
            </div>

            <div className="mt-2 space-y-1.5">
                {tournament.pitches.length === 0 ? (
                    <p className="text-center text-xs text-slate-500 py-4">Aucune piste configuree. Ajoutez au moins une piste avant de generer des matchs.</p>
                ) : (
                    pitchGroups.map((pitchGroup) => (
                        <div key={`pitch-group-${pitchGroup.name}`} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div>
                                <p className="text-sm font-semibold">{pitchGroup.name}</p>
                                <p className="text-xs text-slate-500">
                                    Phases : {pitchGroup.hasGlobal ? 'Toutes' : pitchGroup.phaseNames.join(', ')}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                    {pitchGroup.pitchIds.length} association(s)
                                </p>
                            </div>
                            <form action={bulkPitchDeleteAction}>
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                {pitchGroup.pitchIds.map((pitchId) => (
                                    <input key={`del-pitch-group-${pitchGroup.name}-${pitchId}`} type="hidden" name="pitchIds" value={pitchId} />
                                ))}
                                <LoadingSubmitButton className={`${btnDanger} disabled:opacity-60`} loadingLabel="Suppression...">Supprimer le groupe</LoadingSubmitButton>
                            </form>
                        </div>
                    ))
                )}
            </div>
        </StepSection>
    </div>
</div>
    )
}
