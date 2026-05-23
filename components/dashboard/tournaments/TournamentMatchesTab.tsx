'use client'

import Link from 'next/link'
import { useMemo, type Dispatch, type SetStateAction } from 'react'
import {
    createTournamentMatch,
    deleteAllTournamentMatches,
    deleteSelectedTournamentMatches,
    deleteTournamentMatch,
    generatePhaseRoundRobinMatches,
} from '@/lib/actions/tournament-management.actions'
import MatchBulkCreateForm from './MatchBulkCreateForm'
import MatchBulkEditor from './MatchBulkEditor'
import type { SerializedMatch, TournamentData } from './TournamentTabShell.types'
import { va } from './TournamentTabShell.utils'
import { LoadingSubmitButton, StepSection } from './TournamentTabShell.helpers'

type TournamentMatchesTabProps = {
    orgSlug: string
    tournament: TournamentData
    matches: SerializedMatch[]
    matchesStep: 1 | 2 | 3 | 4
    setMatchesStep: Dispatch<SetStateAction<1 | 2 | 3 | 4>>
    matchCreateMode: 'single' | 'bulk'
    setMatchCreateMode: Dispatch<SetStateAction<'single' | 'bulk'>>
    selectedMatchIds: string[]
    setSelectedMatchIds: Dispatch<SetStateAction<string[]>>
    getMatchGroupLabel: (match: SerializedMatch) => string | null
    inputCls: string
    btnPrimary: string
    btnGhost: string
    btnDanger: string
}

export default function TournamentMatchesTab({
    orgSlug,
    tournament,
    matches,
    matchesStep,
    setMatchesStep,
    matchCreateMode,
    setMatchCreateMode,
    selectedMatchIds,
    setSelectedMatchIds,
    getMatchGroupLabel,
    inputCls,
    btnPrimary,
    btnGhost,
    btnDanger,
}: TournamentMatchesTabProps) {
    const allVisibleMatchIds = useMemo(() => matches.map((m) => m.id), [matches])
    const matchIdsByStatus = useMemo(() => {
        const map = new Map<string, string[]>()
        for (const match of matches) {
            const bucket = map.get(match.status) ?? []
            bucket.push(match.id)
            map.set(match.status, bucket)
        }
        return map
    }, [matches])
    const selectedSet = useMemo(() => new Set(selectedMatchIds), [selectedMatchIds])
    const selectedCount = selectedMatchIds.length
    const allSelected = allVisibleMatchIds.length > 0 && allVisibleMatchIds.every((id) => selectedSet.has(id))

    const toggleSelectStatus = (status: string) => {
        const ids = matchIdsByStatus.get(status) ?? []
        if (ids.length === 0) return
        setSelectedMatchIds((prev) => {
            const prevSet = new Set(prev)
            const allStatusSelected = ids.every((id) => prevSet.has(id))
            if (allStatusSelected) {
                return prev.filter((id) => !ids.includes(id))
            }
            const merged = new Set(prev)
            ids.forEach((id) => merged.add(id))
            return Array.from(merged)
        })
    }

    return (
<div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">Planification et suivi des matchs</p>
        <p className="mt-1">Suivez les etapes dans l'ordre pour garder une gestion simple: generer, ajouter, controler, puis mettre a jour en masse.</p>
        <form
            action={va(deleteAllTournamentMatches)}
            className="mt-3"
            onSubmit={(event) => {
                const ok = window.confirm('Supprimer tous les matchs de ce tournoi ? Cette action est irreversible.')
                if (!ok) event.preventDefault()
            }}
        >
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
            <LoadingSubmitButton
                className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 transition-colors disabled:opacity-60"
                loadingLabel="Suppression..."
            >
                Supprimer tous les matchs
            </LoadingSubmitButton>
        </form>
    </div>

    <div className="grid gap-2 rounded-xl border border-slate-200 bg-white p-2 md:grid-cols-4">
        {[
            { step: 1, label: 'Generer' },
            { step: 2, label: 'Ajouter' },
            { step: 3, label: 'Verifier' },
            { step: 4, label: 'Mettre a jour' },
        ].map((item) => {
            const isActive = matchesStep === item.step
            return (
                <button
                    key={`matches-step-${item.step}`}
                    type="button"
                    onClick={() => setMatchesStep(item.step as 1 | 2 | 3 | 4)}
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

    {/* Step 1: Auto generation */}
    {matchesStep === 1 && (
        <StepSection num={1} title="Generation automatique round-robin" desc="Genere tous les matchs d'une phase en respectant les disponibilites des pistes et des équipes. Pour une phase de poules, la generation suit les placements de chaque poule.">
            <form action={va(generatePhaseRoundRobinMatches)} className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
                <input type="hidden" name="tournamentId" value={tournament.id} />
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="tournamentSlug" value={tournament.slug} />

                <div className="xl:col-span-2">
                    <label className="mb-1 block text-xs text-slate-500">Phase</label>
                    <select name="phaseId" required defaultValue="" className={`${inputCls} w-full`}>
                        <option value="" disabled>Selectionner une phase</option>
                        {tournament.phases.map((phase) => (
                            <option key={phase.id} value={phase.id}>{phase.name}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                    <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-slate-500">Duree max (min)</label>
                    <input name="maxDurationMinutes" type="number" min={5} max={600} defaultValue={30} className={`${inputCls} w-full`} />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-slate-500">Battement général (min)</label>
                    <input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} className={`${inputCls} w-full`} />
                </div>
                <div className="flex flex-col gap-2">
                    <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                        <input name="confirmedOnly" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                        Confirmees uniquement
                    </label>
                    <LoadingSubmitButton
                        className={`${btnGhost} w-full disabled:opacity-60`}
                        disabled={tournament.registrations.length < 2 || tournament.pitches.length === 0}
                        loadingLabel="Generation..."
                    >
                        Generer round-robin
                    </LoadingSubmitButton>
                </div>
            </form>
            {(tournament.registrations.length < 2 || tournament.pitches.length === 0) && (
                <p className="text-[11px] text-amber-400">
                    {tournament.registrations.length < 2 ? '⚠ Minimum 2 équipes inscrites requis. ' : ''}
                    {tournament.pitches.length === 0 ? '⚠ Ajoutez au moins une piste dans l\'onglet Inscriptions & Pistes.' : ''}
                </p>
            )}
        </StepSection>
    )}

    {/* Step 2: Manual match creation */}
    {matchesStep === 2 && (
        <StepSection num={2} title="Creer des matchs manuellement" desc="Creez un match individuel ou importez plusieurs matchs d'un coup via le mode groupe." color="cyan">
            {/* Mode toggle */}
            <div className="mb-3 flex gap-2 border-b border-slate-200 pb-2">
                <button
                    type="button"
                    onClick={() => setMatchCreateMode('single')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${matchCreateMode === 'single' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Match unique
                </button>
                <button
                    type="button"
                    onClick={() => setMatchCreateMode('bulk')}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${matchCreateMode === 'bulk' ? 'bg-teal-700 text-white' : 'text-slate-500 hover:text-slate-800'}`}
                >
                    Ajout groupé (plusieurs matchs)
                </button>
            </div>

            {matchCreateMode === 'single' && (
                <form action={va(createTournamentMatch)} className="grid gap-2 md:grid-cols-3 xl:grid-cols-5">
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />

                    <select name="phaseId" className={inputCls} required defaultValue="">
                        <option value="" disabled>Phase</option>
                        {tournament.phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select name="pitchId" className={inputCls} required defaultValue="">
                        <option value="" disabled>Piste</option>
                        {tournament.pitches.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <select name="homeTeamId" className={inputCls} defaultValue="">
                        <option value="">Equipe domicile</option>
                        {tournament.registrations.map((r) => (
                            <option key={`home-${r.id}`} value={r.teamId}>{r.team.name}</option>
                        ))}
                    </select>
                    <select name="awayTeamId" className={inputCls} defaultValue="">
                        <option value="">Equipe exterieur</option>
                        {tournament.registrations.map((r) => (
                            <option key={`away-${r.id}`} value={r.teamId}>{r.team.name}</option>
                        ))}
                    </select>
                    <input name="scheduledAt" type="datetime-local" className={inputCls} />
                    <input name="maxDurationMinutes" type="number" min={5} max={600} defaultValue={30} placeholder="Duree max (min)" className={inputCls} />
                    <input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} placeholder="Battement (min)" className={inputCls} />
                    <input name="roundNumber" type="number" min={1} placeholder="Round n°" className={inputCls} />
                    <input name="bracketPos" placeholder="Position bracket (WB-R1-M1…)" className={inputCls} />
                    <LoadingSubmitButton
                        className={`${btnPrimary} xl:col-span-1 disabled:opacity-60`}
                        disabled={tournament.pitches.length === 0 || tournament.phases.length === 0}
                        loadingLabel="Creation..."
                    >
                        Creer le match
                    </LoadingSubmitButton>
                </form>
            )}

            {matchCreateMode === 'bulk' && (
                <MatchBulkCreateForm
                    tournamentId={tournament.id}
                    orgSlug={orgSlug}
                    tournamentSlug={tournament.slug}
                    phases={tournament.phases.map((p) => ({ id: p.id, name: p.name }))}
                    pitches={Array.from(
                        new Map(tournament.pitches.map((p) => [p.name, { id: p.id, name: p.name }])).values()
                    )}
                    teams={tournament.registrations.map((r) => ({ teamId: r.teamId, name: r.team.name }))}
                />
            )}
        </StepSection>
    )}

    {/* Step 3: Match list */}
    {matchesStep === 3 && (
        <StepSection num={3} title="Liste des matchs" desc={`${matches.length} match(s) planifie(s) — cliquez sur Detail pour voir et modifier un match.`} color="emerald">
            {matches.length === 0 ? (
                <p className="text-center text-xs text-slate-500 py-4">Aucun match planifie. Utilisez la generation automatique ou la creation manuelle ci-dessus.</p>
            ) : (
                <div className="space-y-2">
                    <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 md:flex-row md:items-center md:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedMatchIds(allSelected ? [] : allVisibleMatchIds)}
                                className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-800 hover:bg-slate-800"
                            >
                                {allSelected ? 'Tout deselec.' : 'Tout selectionner'}
                            </button>
                            {(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED'] as const).map((status) => {
                                const ids = matchIdsByStatus.get(status) ?? []
                                const hasAny = ids.length > 0
                                const allThisStatusSelected = hasAny && ids.every((id) => selectedSet.has(id))
                                return (
                                    <button
                                        key={`select-status-${status}`}
                                        type="button"
                                        onClick={() => toggleSelectStatus(status)}
                                        disabled={!hasAny}
                                        className={`rounded-md border px-2 py-1 text-xs transition-colors disabled:opacity-40 ${allThisStatusSelected
                                            ? 'border-teal-600/60 bg-teal-700/20 text-teal-700'
                                            : 'border-slate-300 text-slate-700 hover:bg-slate-800'
                                            }`}
                                    >
                                        {status} ({ids.length})
                                    </button>
                                )
                            })}
                        </div>

                        <form action={va(deleteSelectedTournamentMatches)} className="flex items-center gap-2">
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            {selectedMatchIds.map((id) => (
                                <input key={`selected-${id}`} type="hidden" name="matchIds" value={id} />
                            ))}
                            <LoadingSubmitButton
                                disabled={selectedCount === 0}
                                className="rounded-md border border-red-300 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
                                loadingLabel="Suppression..."
                            >
                                Supprimer la selection
                            </LoadingSubmitButton>
                        </form>
                    </div>

                    {matches.map((match) => (
                        <div key={match.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="min-w-0">
                                {(() => {
                                    const groupLabel = getMatchGroupLabel(match)
                                    return groupLabel ? <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">{groupLabel}</p> : null
                                })()}
                                <p className="truncate text-sm font-semibold">
                                    {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                                    {match.result && (
                                        <span className="ml-2 text-emerald-300">{match.result.homeScore} - {match.result.awayScore}</span>
                                    )}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                    {match.phase.name} • {match.pitch.name}
                                    {match.roundNumber ? ` • Round ${match.roundNumber}` : ''}
                                    {match.bracketPos ? ` • ${match.bracketPos}` : ''}
                                    {match.scheduledAt ? ` • ${new Date(match.scheduledAt).toLocaleString('fr-FR', { timeZone: 'UTC' })}` : ''}
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <input
                                    type="checkbox"
                                    checked={selectedSet.has(match.id)}
                                    onChange={(event) => {
                                        const checked = event.target.checked
                                        setSelectedMatchIds((prev) => {
                                            if (checked) {
                                                if (prev.includes(match.id)) return prev
                                                return [...prev, match.id]
                                            }
                                            return prev.filter((id) => id !== match.id)
                                        })
                                    }}
                                    className="h-4 w-4 accent-teal-600"
                                    aria-label={`Selectionner le match ${match.id}`}
                                />
                                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${match.status === 'FINISHED' ? 'bg-emerald-100 text-emerald-700'
                                    : match.status === 'LIVE' ? 'bg-amber-100 text-amber-700'
                                        : match.status === 'CANCELLED' ? 'bg-red-100 text-red-700'
                                            : 'bg-slate-100 text-slate-700'
                                    }`}>
                                    {match.status}
                                </span>
                                <Link
                                    href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}/matches/${match.id}`}
                                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs hover:bg-slate-800 transition-colors"
                                >
                                    Detail →
                                </Link>
                                <form action={va(deleteTournamentMatch)}>
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <input type="hidden" name="matchId" value={match.id} />
                                    <LoadingSubmitButton className={`${btnDanger} disabled:opacity-60`} loadingLabel="Suppression...">Suppr.</LoadingSubmitButton>
                                </form>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </StepSection>
    )}

    {/* Step 4: Bulk editor */}
    {matchesStep === 4 && matches.length > 0 && (
        <StepSection num={4} title="Editeur global des scores et statuts" desc="Modifiez plusieurs matchs a la fois et sauvegardez en une seule action." color="amber">
            <MatchBulkEditor
                tournamentId={tournament.id}
                orgSlug={orgSlug}
                tournamentSlug={tournament.slug}
                matches={matches.map((m) => ({
                    id: m.id,
                    phaseName: m.phase.name,
                    pitchName: m.pitch.name,
                    homeTeamName: m.homeTeam?.name || 'TBD',
                    awayTeamName: m.awayTeam?.name || 'TBD',
                    status: m.status as 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED',
                    homeScore: m.result?.homeScore ?? null,
                    awayScore: m.result?.awayScore ?? null,
                    notes: m.result?.notes || '',
                    scheduledAtLabel: m.scheduledAt
                        ? new Date(m.scheduledAt).toLocaleString('fr-FR', { timeZone: 'UTC' })
                        : 'Non planifie',
                }))}
            />
        </StepSection>
    )}

    <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
        <button
            type="button"
            onClick={() => setMatchesStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
            disabled={matchesStep === 1}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
            Etape precedente
        </button>
        <button
            type="button"
            onClick={() => setMatchesStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
            disabled={matchesStep === 4}
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-40"
        >
            Etape suivante
        </button>
    </div>
</div>
    )
}
