'use client'

import type { ComponentProps, Dispatch, SetStateAction } from 'react'
import BracketPhaseView from './BracketPhaseView'
import BracketSeedEditor from './BracketSeedEditor'
import type { InlineActionState, PhaseData, SerializedMatch, TournamentData } from './TournamentTabShell.types'
import {
    computePlacementPhaseRanking,
    defaultPlacementLabel,
    parsePlacementBracketPos,
    readParallelGroup,
    readPlacementLabels,
    readPlacementRangesFromMatches,
    readPlacementRankingSegments,
} from './TournamentTabShell.utils'
import { EmptyState, LoadingSubmitButton, PhaseTypeBadge, StepSection } from './TournamentTabShell.helpers'

type BracketParallelGroup = {
    key: string
    group: string
    phases: PhaseData[]
    leaderPhase: PhaseData
}

type TournamentBracketTabProps = {
    orgSlug: string
    tournament: TournamentData
    matches: SerializedMatch[]
    bracketPhases: PhaseData[]
    bracketParallelGroups: BracketParallelGroup[]
    activeBracketPhaseId: string
    setActiveBracketPhaseId: Dispatch<SetStateAction<string>>
    seededTeamsByPhase: Map<string, string[]>
    incomingQualifiersByPhase: Map<string, string[]>
    expectedIncomingQualifierCountByPhase: Map<string, number>
    planningDefaults: { matchMinutes: number; breakMinutes: number }
    bracketTimerContext: { timerSeconds: number; timerStartMs: number; timerMode: 'MATCH' | 'BREAK' } | null
    customBracketGenerationAction: ComponentProps<'form'>['action']
    customBracketGenerationState: InlineActionState
    placementLabelsAction: ComponentProps<'form'>['action']
    placementLabelsState: InlineActionState
    placementSegmentsAction: ComponentProps<'form'>['action']
    placementSegmentsState: InlineActionState
    inputCls: string
    btnGhost: string
}

export default function TournamentBracketTab({
    orgSlug,
    tournament,
    matches,
    bracketPhases,
    bracketParallelGroups,
    activeBracketPhaseId,
    setActiveBracketPhaseId,
    seededTeamsByPhase,
    incomingQualifiersByPhase,
    expectedIncomingQualifierCountByPhase,
    planningDefaults,
    bracketTimerContext,
    customBracketGenerationAction,
    customBracketGenerationState,
    placementLabelsAction,
    placementLabelsState,
    placementSegmentsAction,
    placementSegmentsState,
    inputCls,
    btnGhost,
}: TournamentBracketTabProps) {
    return (
<div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">Visualisation bracket</p>
        <p className="mt-1">Les colonnes representent les rounds. Cliquez sur un match pour voir son detail et mettre a jour le score. Pour les phases <em>Personnalisees</em>, generez d'abord la structure du bracket ci-dessous.</p>
    </div>

    {bracketPhases.length === 0 ? (
        <EmptyState message="Aucune phase bracket ou personnalisee." />
    ) : (
        <div className="space-y-6">
            <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2">
                {bracketPhases.map((phase) => (
                    <button
                        key={`bracket-tab-${phase.id}`}
                        type="button"
                        onClick={() => setActiveBracketPhaseId(phase.id)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${(activeBracketPhaseId || bracketPhases[0]?.id) === phase.id
                                ? 'border-teal-600 bg-teal-50 text-teal-700'
                                : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                            }`}
                    >
                        {phase.name}
                    </button>
                ))}
                {bracketParallelGroups.map((group) => (
                    <button
                        key={`bracket-group-tab-${group.group}`}
                        type="button"
                        onClick={() => setActiveBracketPhaseId(group.key)}
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition ${activeBracketPhaseId === group.key
                                ? 'border-cyan-600 bg-cyan-50 text-cyan-700'
                                : 'border-cyan-300 bg-white text-cyan-700 hover:bg-cyan-50'
                            }`}
                    >
                        Groupe {group.group}
                    </button>
                ))}
            </div>

            {activeBracketPhaseId.startsWith('group:') && (() => {
                const groupName = activeBracketPhaseId.slice('group:'.length)
                const group = bracketParallelGroups.find((item) => item.group === groupName)
                if (!group) return null

                const leaderPhase = group.leaderPhase

                return (
                    <StepSection
                        num={1}
                        title={`Generer les brackets lies (${group.group})`}
                        desc="Un seul formulaire pour generer tous les brackets et matchs de ce groupe parallele."
                        color="cyan"
                    >
                        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-600">
                            Phases incluses: {group.phases.map((phase) => phase.name).join(' • ')}
                        </div>
                        <div className="mb-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {group.phases.map((phase) => {
                                const resolvedCount = (incomingQualifiersByPhase.get(phase.id) ?? []).length
                                const expectedCount = expectedIncomingQualifierCountByPhase.get(phase.id) ?? 0
                                const placedCount = (seededTeamsByPhase.get(phase.id) ?? []).length
                                const waitingPropagation = expectedCount > 0 && resolvedCount === 0

                                return (
                                    <div key={`linked-group-phase-${phase.id}`} className="rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600">
                                        <p className="font-semibold text-slate-900">{phase.name}</p>
                                        <p className="mt-1">Equipes attendues via routes: <span className="font-semibold text-slate-900">{expectedCount}</span></p>
                                        <p>Qualifiees resolues maintenant: <span className="font-semibold text-slate-900">{resolvedCount}</span></p>
                                        <p>Equipes deja placees: <span className="font-semibold text-slate-900">{placedCount}</span></p>
                                        {waitingPropagation && (
                                            <p className="mt-1 text-[11px] text-amber-700">
                                                En attente de propagation/seed depuis la phase precedente. La structure peut etre generee maintenant, puis alimentee ensuite.
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        <form action={customBracketGenerationAction} className="grid gap-2 md:grid-cols-10">
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <input type="hidden" name="phaseId" value={leaderPhase.id} />
                            <input type="hidden" name="includeLinked" value="on" />

                            <div>
                                <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                                <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-slate-500">Duree max (min)</label>
                                <input
                                    name="maxDurationMinutes"
                                    type="number"
                                    min={5}
                                    max={600}
                                    defaultValue={planningDefaults.matchMinutes}
                                    className={`${inputCls} w-full`}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-slate-500">Battement général (min)</label>
                                <input
                                    name="teamBreakMinutes"
                                    type="number"
                                    min={0}
                                    max={240}
                                    defaultValue={planningDefaults.breakMinutes}
                                    className={`${inputCls} w-full`}
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs text-slate-500">Roulement des brackets</label>
                                <select name="rotationMode" defaultValue="sequential" className={`${inputCls} w-full`}>
                                    <option value="sequential">Sequentiel (bracket par bracket)</option>
                                    <option value="interleaved">Entrelacer (alterner les brackets)</option>
                                </select>
                            </div>
                            <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                <input name="includeLosersReplay" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                Perdants rejouent (classement complet)
                            </label>
                            <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                <span className="text-amber-700">Ecraser les matchs</span>
                            </label>
                            <div className="md:col-span-3 flex items-end gap-2">
                                <LoadingSubmitButton className={`${btnGhost} w-full disabled:opacity-60`} loadingLabel="Generation...">
                                    Generer tous les brackets lies ({group.group})
                                </LoadingSubmitButton>
                            </div>

                            {customBracketGenerationState.message && (
                                <p className={`md:col-span-10 text-[11px] ${customBracketGenerationState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                    {customBracketGenerationState.message}
                                </p>
                            )}
                        </form>
                    </StepSection>
                )
            })()}

            {(bracketPhases.find((phase) => phase.id === (activeBracketPhaseId || bracketPhases[0]?.id)) ? [bracketPhases.find((phase) => phase.id === (activeBracketPhaseId || bracketPhases[0]?.id)) as PhaseData] : []).map((phase) => {
                const phaseMatches = matches
                    .filter((m) => m.phaseId === phase.id)
                    .map((m) => ({
                        id: m.id,
                        homeTeamId: m.homeTeamId,
                        awayTeamId: m.awayTeamId,
                        roundNumber: m.roundNumber,
                        bracketPos: m.bracketPos,
                        scheduledAt: m.scheduledAt,
                        pitchName: m.pitch?.name ?? null,
                        status: m.status as 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED',
                        homeTeamName: m.homeTeam?.name || 'TBD',
                        awayTeamName: m.awayTeam?.name || 'TBD',
                        homeScore: m.result?.homeScore ?? null,
                        awayScore: m.result?.awayScore ?? null,
                    }))
                const phaseParallelGroup = readParallelGroup(phase.config)
                const canGenerateThisPhase = !phaseParallelGroup
                const incomingQualifierCount = (incomingQualifiersByPhase.get(phase.id) ?? []).length
                const expectedCount = Math.max(expectedIncomingQualifierCountByPhase.get(phase.id) ?? 0, 0)
                const defaultParticipantsCount = Math.max(incomingQualifierCount, expectedCount, 8)

                return (
                    <div key={phase.id} className="space-y-3 rounded-2xl border border-slate-300 bg-white p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-slate-500">Etape {phase.order}</p>
                                <p className="text-base font-bold">{phase.name}</p>
                            </div>
                            <PhaseTypeBadge type={phase.type} />
                        </div>

                        <BracketPhaseView
                            tournamentId={tournament.id}
                            orgSlug={orgSlug}
                            tournamentSlug={tournament.slug}
                            phase={{ id: phase.id, name: phase.name, type: phase.type, order: phase.order, config: phase.config }}
                            matches={phaseMatches}
                            timer={bracketTimerContext}
                        />

                        {(phase.type === 'CUSTOM' || phase.type === 'PLACEMENT_BRACKET') && canGenerateThisPhase && (
                            <StepSection num={1} title="Generer la structure du bracket personnalise" desc="Definissez le nombre de participants. Pour un bracket a placement, vous pouvez aussi configurer les plages de classement.">
                                <form action={customBracketGenerationAction} className="grid gap-2 md:grid-cols-10">
                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                    <input type="hidden" name="phaseId" value={phase.id} />
                                    {phaseParallelGroup && <input type="hidden" name="includeLinked" value="on" />}
                                    <div>
                                        <label className="mb-1 block text-xs text-slate-500">Participants</label>
                                        <input
                                            name="participantsCount"
                                            type="number"
                                            min={4}
                                            max={64}
                                            defaultValue={defaultParticipantsCount}
                                            className={`${inputCls} w-full`}
                                        />
                                        {(incomingQualifierCount > 0 || expectedCount > 0) && (
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                {incomingQualifierCount > 0 ? (
                                                    <>{incomingQualifierCount} equipe(s) qualifiee(s) detectee(s) pour cette phase.</>
                                                ) : (
                                                    <>Aucune equipe qualifiee detectee pour le moment.</>
                                                )}
                                                {expectedCount > 0 && (
                                                    <>{' '}Attendu: {expectedCount} equipe(s) via les routes de poules.</>
                                                )}
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-slate-500">Heure de debut</label>
                                        <input name="startAt" type="datetime-local" className={`${inputCls} w-full`} />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-slate-500">Duree max (min)</label>
                                        <input
                                            name="maxDurationMinutes"
                                            type="number"
                                            min={5}
                                            max={600}
                                            defaultValue={planningDefaults.matchMinutes}
                                            className={`${inputCls} w-full`}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-xs text-slate-500">Battement général (min)</label>
                                        <input
                                            name="teamBreakMinutes"
                                            type="number"
                                            min={0}
                                            max={240}
                                            defaultValue={planningDefaults.breakMinutes}
                                            className={`${inputCls} w-full`}
                                        />
                                    </div>
                                    {phase.type === 'PLACEMENT_BRACKET' && (
                                        <div className="md:col-span-2">
                                            <label className="mb-1 block text-xs text-slate-500">Plages de classement</label>
                                            <input
                                                name="placementRanges"
                                                className={`${inputCls} w-full`}
                                                placeholder="Optionnel. Ex: 25-32, 21-24, 19-20"
                                            />
                                            <p className="mt-1 text-[11px] text-slate-500">
                                                Laissez vide pour generer automatiquement les plages obligatoires (recommande). Format manuel: start-end, separes par virgule.
                                            </p>
                                        </div>
                                    )}
                                    <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                        <input name="includeLosersReplay" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                        Perdants rejouent (classement complet)
                                    </label>
                                    <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                        <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                        <span className="text-amber-700">Ecraser les matchs</span>
                                    </label>
                                    <div className="md:col-span-3 flex items-end gap-2">
                                        <LoadingSubmitButton className={`${btnGhost} w-full disabled:opacity-60`} loadingLabel="Generation...">
                                            {phaseParallelGroup
                                                ? `Generer tous les brackets lies (${phaseParallelGroup})`
                                                : 'Generer ce bracket'}
                                        </LoadingSubmitButton>
                                    </div>

                                    {customBracketGenerationState.message && (
                                        <p className={`md:col-span-10 text-[11px] ${customBracketGenerationState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                            {customBracketGenerationState.message}
                                        </p>
                                    )}
                                </form>

                                {phase.type === 'PLACEMENT_BRACKET' && (() => {
                                    const ranges = readPlacementRangesFromMatches(phaseMatches)
                                    const labels = readPlacementLabels(phase.config)
                                    const segments = readPlacementRankingSegments(phase.config)
                                    const rankingRows = computePlacementPhaseRanking(phaseMatches)
                                    const maxPlacementEnd = phaseMatches.reduce((max, match) => {
                                        const parsed = parsePlacementBracketPos(match.bracketPos)
                                        return parsed ? Math.max(max, parsed.end) : max
                                    }, 0)
                                    const rankingSegments = segments.length > 0
                                        ? segments
                                        : [{ start: 1, end: Math.max(2, maxPlacementEnd || rankingRows.at(-1)?.rank || 2), label: 'Classement global' }]
                                    const segmentsText = segments.length > 0
                                        ? segments.map((segment) => `${segment.start}-${segment.end}: ${segment.label}`).join('\n')
                                        : '1-15: Bracket principal\n16-32: Bracket placement 2'

                                    if (ranges.length === 0) {
                                        return (
                                            <p className="mt-2 text-[11px] text-slate-500">
                                                Generez d'abord le bracket de placement pour personnaliser les noms des sous-brackets.
                                            </p>
                                        )
                                    }

                                    return (
                                        <div className="mt-3 space-y-3">
                                            <div className="rounded-lg border border-slate-200 bg-white p-3">
                                                <div className="mb-2 flex items-center justify-between">
                                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                        Classement global de la phase
                                                    </p>
                                                    <span className="text-[11px] text-slate-500">
                                                        {rankingRows.length} place(s) resolue(s)
                                                    </span>
                                                </div>

                                                <div className="space-y-3">
                                                    {rankingSegments.map((segment) => {
                                                        const rows = rankingRows.filter((row) => row.rank >= segment.start && row.rank <= segment.end)
                                                        return (
                                                            <div key={`ranking-segment-${phase.id}-${segment.start}-${segment.end}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                                                <div className="mb-1 flex items-center justify-between gap-2">
                                                                    <p className="text-xs font-semibold text-slate-700">
                                                                        {segment.label}
                                                                    </p>
                                                                    <span className="text-[11px] text-slate-500">
                                                                        Places {segment.start}-{segment.end}
                                                                    </span>
                                                                </div>

                                                                {rows.length === 0 ? (
                                                                    <p className="text-[11px] text-slate-500">
                                                                        Aucune place finalisee sur ce segment pour le moment.
                                                                    </p>
                                                                ) : (
                                                                    <div className="overflow-x-auto">
                                                                        <table className="min-w-full text-left text-[11px] text-slate-600">
                                                                            <thead>
                                                                                <tr className="border-b border-slate-200 text-slate-500">
                                                                                    <th className="px-1 py-1 font-semibold">Place</th>
                                                                                    <th className="px-1 py-1 font-semibold">Equipe</th>
                                                                                    <th className="px-1 py-1 font-semibold">Source</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {rows.map((row) => (
                                                                                    <tr key={`ranking-row-${phase.id}-${row.rank}`} className="border-b border-slate-100 last:border-b-0">
                                                                                        <td className="px-1 py-1 font-semibold text-slate-700">#{row.rank}</td>
                                                                                        <td className="px-1 py-1">{row.teamName}</td>
                                                                                        <td className="px-1 py-1 text-slate-500">{row.source}</td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            <div className="grid gap-3 xl:grid-cols-2">
                                                <form action={placementLabelsAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                    <input type="hidden" name="phaseId" value={phase.id} />

                                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                        Renommer les sous-brackets de placement
                                                    </p>

                                                    <div className="grid gap-2 md:grid-cols-2">
                                                        {ranges.map((range) => (
                                                            <div key={`placement-label-${phase.id}-${range.key}`}>
                                                                <label className="mb-1 block text-xs text-slate-500">Range {range.start}-{range.end}</label>
                                                                <input
                                                                    name={`placementLabel_${range.start}_${range.end}`}
                                                                    defaultValue={labels[range.key] || defaultPlacementLabel(range.start, range.end)}
                                                                    className={`${inputCls} w-full`}
                                                                    placeholder={defaultPlacementLabel(range.start, range.end)}
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2">
                                                        {placementLabelsState.message && (
                                                            <p className={`text-[11px] ${placementLabelsState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                {placementLabelsState.message}
                                                            </p>
                                                        )}
                                                        <div className="ml-auto">
                                                            <LoadingSubmitButton className={`${btnGhost} disabled:opacity-60`} loadingLabel="Enregistrement...">
                                                                Enregistrer les noms
                                                            </LoadingSubmitButton>
                                                        </div>
                                                    </div>
                                                </form>

                                                <form action={placementSegmentsAction} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                                                    <input type="hidden" name="tournamentId" value={tournament.id} />
                                                    <input type="hidden" name="orgSlug" value={orgSlug} />
                                                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                                    <input type="hidden" name="phaseId" value={phase.id} />

                                                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
                                                        Associer des brackets pour le classement
                                                    </p>

                                                    <textarea
                                                        name="segmentsText"
                                                        rows={5}
                                                        defaultValue={segmentsText}
                                                        className={`${inputCls} min-h-28 w-full`}
                                                        placeholder={'Ex:\n1-15: Bracket principal\n16-32: Bracket placement 2'}
                                                    />
                                                    <p className="text-[11px] text-slate-500">
                                                        Un segment par ligne. Format: start-end: Nom du segment.
                                                    </p>

                                                    <div className="flex items-center justify-between gap-2">
                                                        {placementSegmentsState.message && (
                                                            <p className={`text-[11px] ${placementSegmentsState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                                                                {placementSegmentsState.message}
                                                            </p>
                                                        )}
                                                        <div className="ml-auto">
                                                            <LoadingSubmitButton className={`${btnGhost} disabled:opacity-60`} loadingLabel="Enregistrement...">
                                                                Enregistrer les associations
                                                            </LoadingSubmitButton>
                                                        </div>
                                                    </div>
                                                </form>
                                            </div>
                                        </div>
                                    )
                                })()}
                            </StepSection>
                        )}

                        {(phase.type === 'CUSTOM' || phase.type === 'PLACEMENT_BRACKET') && !canGenerateThisPhase && phaseParallelGroup && (
                            <div className="rounded-lg border border-cyan-300 bg-cyan-50 p-3 text-xs text-cyan-800">
                                Cette phase est liee au groupe <span className="font-semibold">{phaseParallelGroup}</span>. Utilisez l'onglet de groupe parallele pour generer tous les brackets lies en une seule fois.
                            </div>
                        )}

                        {phaseMatches.some((m) => m.roundNumber === 1) && (
                            <StepSection
                                num={2}
                                title="Verifier/ajuster les équipes avant lancement"
                                desc="Les équipes du round 1 sont auto-assignees a la generation du bracket. Vous pouvez les corriger ici avant le debut des matchs."
                                color="amber"
                            >
                                <BracketSeedEditor
                                    tournamentId={tournament.id}
                                    orgSlug={orgSlug}
                                    tournamentSlug={tournament.slug}
                                    phaseId={phase.id}
                                    rows={phaseMatches
                                        .filter((m) => m.roundNumber === 1)
                                        .sort((a, b) => (a.bracketPos || '').localeCompare(b.bracketPos || ''))
                                        .map((m) => ({
                                            matchId: m.id,
                                            bracketPos: m.bracketPos,
                                            homeTeamId: m.homeTeamId,
                                            awayTeamId: m.awayTeamId,
                                        }))}
                                    teamOptions={tournament.registrations.map((r) => ({ id: r.teamId, name: r.team.name }))}
                                />
                            </StepSection>
                        )}
                    </div>
                )
            })}
        </div>
    )}
</div>
    )
}
