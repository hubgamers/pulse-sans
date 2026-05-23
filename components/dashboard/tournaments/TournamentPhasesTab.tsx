'use client'

import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import { closeTournamentPhase } from '@/lib/actions/tournament-management.actions'
import PhaseFlowEditor from './PhaseFlowEditor'
import type { InlineActionState, TournamentData } from './TournamentTabShell.types'
import { formatRouteRule, readParallelGroup, readRoutes, va } from './TournamentTabShell.utils'
import { EmptyState, LoadingSubmitButton, PhaseTypeBadge } from './TournamentTabShell.helpers'

type TournamentPhasesTabProps = {
    orgSlug: string
    tournament: TournamentData
    phasesStep: 1 | 2 | 3
    setPhasesStep: Dispatch<SetStateAction<1 | 2 | 3>>
    matchesByPhase: Map<string, { total: number; finished: number }>
    seededTeamsByPhase: Map<string, string[]>
    incomingQualifiersByPhase: Map<string, string[]>
    teamNameById: Map<string, string>
    resetTournamentAction: ComponentProps<'form'>['action']
    resetTournamentState: InlineActionState
    duplicateTournamentAction: ComponentProps<'form'>['action']
    duplicateTournamentState: InlineActionState
    setStandingsOverlay: (value: { phaseId: string; mode: 'groups' | 'global' } | null) => void
    inputCls: string
}

export default function TournamentPhasesTab({
    orgSlug,
    tournament,
    phasesStep,
    setPhasesStep,
    matchesByPhase,
    seededTeamsByPhase,
    incomingQualifiersByPhase,
    teamNameById,
    resetTournamentAction,
    resetTournamentState,
    duplicateTournamentAction,
    duplicateTournamentState,
    setStandingsOverlay,
    inputCls,
}: TournamentPhasesTabProps) {
    return (
<div className="space-y-4">
    <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-3">
        {[
            { step: 1, label: 'Structurer les phases' },
            { step: 2, label: 'Verifier la progression' },
            { step: 3, label: 'Cloturer les phases' },
        ].map((item) => {
            const isActive = phasesStep === item.step
            return (
                <button
                    key={`phase-step-${item.step}`}
                    type="button"
                    onClick={() => setPhasesStep(item.step as 1 | 2 | 3)}
                    className={`rounded-lg border px-3 py-2 text-left text-sm font-medium transition ${isActive
                        ? 'border-teal-600 bg-teal-50 text-teal-700'
                        : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
                        }`}
                >
                    {item.step}. {item.label}
                </button>
            )
        })}
    </div>

    {phasesStep === 1 && (
        <PhaseFlowEditor
            tournamentId={tournament.id}
            tournamentSlug={tournament.slug}
            orgSlug={orgSlug}
            phases={tournament.phases.map((phase) => ({
                id: phase.id,
                name: phase.name,
                type: phase.type,
                order: phase.order,
                config: phase.config,
            }))}
        />
    )}

    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">
            {phasesStep === 1 ? 'Etape 1: Structure des phases' : phasesStep === 2 ? 'Etape 2: Controle de progression' : 'Etape 3: Cloture des phases'}
        </p>
        <p className="mt-1">
            {phasesStep === 1
                ? 'Definissez le flow (ordre, types et routes de qualification) avec le formulaire ci-dessus.'
                : phasesStep === 2
                    ? 'Verifiez les stats de matchs, les routes de qualification et les équipes en attente avant de cloturer.'
                    : 'Cloturez chaque phase pour propager les qualifies vers la suite du tournoi. Utilisez Forcer la cloture si necessaire.'}
        </p>
    </div>

    <div className="grid gap-3 lg:grid-cols-2">
        <form
            action={resetTournamentAction}
            className="space-y-2 rounded-lg border border-red-200 bg-white p-3"
            onSubmit={(event) => {
                const ok = window.confirm('Reinitialiser ce tournoi ? Les matchs seront supprimes et les phases decloturees. Cette action est irreversible.')
                if (!ok) event.preventDefault()
            }}
        >
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-red-700">Reinitialisation tournoi</p>
            <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                <input name="resetRegistrations" type="checkbox" defaultChecked className="h-4 w-4 accent-red-600" />
                Supprimer aussi les inscriptions
            </label>
            <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                <input name="resetPitches" type="checkbox" defaultChecked className="h-4 w-4 accent-red-600" />
                Supprimer aussi les pistes
            </label>
            <LoadingSubmitButton
                className="w-full rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                loadingLabel="Reinitialisation..."
            >
                Reinitialiser le tournoi
            </LoadingSubmitButton>
            {resetTournamentState.message && (
                <p className={`text-[11px] ${resetTournamentState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {resetTournamentState.message}
                </p>
            )}
        </form>

        <form action={duplicateTournamentAction} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Duplication tournoi</p>
            <input
                name="targetName"
                defaultValue={`${tournament.name} (copie)`}
                className={inputCls}
                placeholder="Nom du tournoi duplique"
                required
            />
            <input
                name="targetSlug"
                defaultValue={`${tournament.slug}-copie`}
                className={inputCls}
                placeholder="slug-tournoi-copie"
                required
            />
            <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                <input name="includePitches" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                Dupliquer aussi les pistes
            </label>
            <LoadingSubmitButton
                className="w-full rounded-md border border-teal-300 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50 transition-colors disabled:opacity-60"
                loadingLabel="Duplication..."
            >
                Dupliquer ce tournoi
            </LoadingSubmitButton>
            {duplicateTournamentState.message && (
                <p className={`text-[11px] ${duplicateTournamentState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {duplicateTournamentState.message}
                </p>
            )}
        </form>
    </div>

    {(phasesStep === 2 || phasesStep === 3) && tournament.phases.length === 0 ? (
        <EmptyState message="Aucune phase configuree. Creez un tournoi avec des phases depuis le formulaire de creation." />
    ) : (phasesStep === 2 || phasesStep === 3) && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tournament.phases.map((phase) => {
                const stats = matchesByPhase.get(phase.id) ?? { total: 0, finished: 0 }
                const pct = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0
                const routes = readRoutes(phase.config)
                const parallelGroup = readParallelGroup(phase.config)
                const isGroupPhase = phase.type === 'GROUP'
                const seededTeams = seededTeamsByPhase.get(phase.id) ?? []
                const incomingQualifiers = incomingQualifiersByPhase.get(phase.id) ?? []
                const waitingQualifierCount = Math.max(0, incomingQualifiers.length - seededTeams.length)
                return (
                    <div key={phase.id} className={`rounded-xl border p-4 ${phase.isCompleted ? 'border-emerald-500/30 bg-emerald-950/20' : 'border-slate-200 bg-white'}`}>
                        <div className="mb-3 flex items-start justify-between gap-2">
                            <div>
                                <span className="text-[10px] uppercase tracking-widest text-slate-500">Etape {phase.order}</span>
                                <p className="text-base font-bold leading-tight">{phase.name}</p>
                                {parallelGroup && (
                                    <p className="mt-1 text-[11px] text-teal-700">Groupe parallele: {parallelGroup}</p>
                                )}
                            </div>
                            <PhaseTypeBadge type={phase.type} />
                        </div>

                        {/* Progress */}
                        <div className="mb-3">
                            <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                                <span>{stats.finished}/{stats.total} matchs</span>
                                <span>{pct}%</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                <div
                                    className={`h-full rounded-full transition-all ${phase.isCompleted ? 'bg-emerald-500' : 'bg-teal-600'}`}
                                    style={{ width: `${pct}%` }}
                                />
                            </div>
                        </div>

                        {isGroupPhase && (
                            <div className="mb-3 grid gap-2 sm:grid-cols-2">
                                <button
                                    type="button"
                                    onClick={() => setStandingsOverlay({ phaseId: phase.id, mode: 'groups' })}
                                    className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-left text-[11px] font-medium text-slate-700 hover:bg-slate-50"
                                >
                                    Voir classement par poule
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setStandingsOverlay({ phaseId: phase.id, mode: 'global' })}
                                    className="rounded-lg border border-teal-300 bg-teal-50 px-2 py-1.5 text-left text-[11px] font-medium text-teal-700 hover:bg-teal-100"
                                >
                                    Voir classement global phase
                                </button>
                            </div>
                        )}

                        {/* Routes */}
                        {routes.length > 0 && (
                            <div className="mb-3 space-y-1 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                <p className="text-[10px] uppercase tracking-wider text-slate-500">Qualifications sortantes</p>
                                {routes.map((route, i) => (
                                    <div key={i} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700">
                                        <span>{formatRouteRule(route)}</span>
                                        <span className="ml-1 text-slate-500">→ {route.toPhaseKey || 'inconnue'}{route.label ? ` (${route.label})` : ''}</span>
                                    </div>
                                ))}
                            </div>
                        )}

                        {(seededTeams.length > 0 || waitingQualifierCount > 0) && (
                            <div className="mb-3 space-y-2 rounded-lg border border-teal-600/30 bg-teal-50 p-2">
                                {seededTeams.length > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-teal-700">Équipes placees sur cette phase</p>
                                        <div className="mt-1 flex flex-wrap gap-1">
                                            {seededTeams.map((teamId) => (
                                                <span key={`${phase.id}-seeded-${teamId}`} className="rounded-md bg-slate-900 px-2 py-0.5 text-[11px] text-white">
                                                    {teamNameById.get(teamId) ?? teamId}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {waitingQualifierCount > 0 && (
                                    <div>
                                        <p className="text-[10px] uppercase tracking-wider text-amber-700">Qualifiees detectees (a placer)</p>
                                        <p className="mt-1 text-[11px] text-amber-700">
                                            {waitingQualifierCount} place(s) d'entree encore vide(s) pour {incomingQualifiers.length} qualifiee(s) detectee(s).
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {phasesStep === 3 && (
                            <form action={va(closeTournamentPhase)} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
                                <input type="hidden" name="tournamentId" value={tournament.id} />
                                <input type="hidden" name="orgSlug" value={orgSlug} />
                                <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                <input type="hidden" name="phaseId" value={phase.id} />
                                {phase.isCompleted ? (
                                    <p className="text-center text-[11px] font-semibold text-emerald-700">✓ Phase cloturee - qualifies propages</p>
                                ) : (
                                    <>
                                        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-slate-500 hover:text-slate-800">
                                            <input name="forceClose" type="checkbox" className="h-3.5 w-3.5 accent-teal-600" />
                                            Forcer la cloture (matchs non termines)
                                        </label>
                                        <LoadingSubmitButton
                                            className="w-full rounded-md border border-teal-600/40 px-2 py-1.5 text-[11px] font-medium text-teal-700 hover:bg-teal-600/10 transition-colors disabled:opacity-60"
                                            loadingLabel="Cloture en cours..."
                                        >
                                            Cloturer et propager les qualifies →
                                        </LoadingSubmitButton>
                                    </>
                                )}
                            </form>
                        )}
                    </div>
                )
            })}
        </div>
    )}

    <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <button
            type="button"
            onClick={() => setPhasesStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
            disabled={phasesStep === 1}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
            Etape precedente
        </button>
        <button
            type="button"
            onClick={() => setPhasesStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)}
            disabled={phasesStep === 3}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-40"
        >
            Etape suivante
        </button>
    </div>
</div>
    )
}
