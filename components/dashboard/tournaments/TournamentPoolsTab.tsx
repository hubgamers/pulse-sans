'use client'

import Link from 'next/link'
import {
    autoPlaceGroupTeams,
    configureGroupPhase,
    configureGroupPitchAssignments,
    generateGroupMatchesFromPlacements,
} from '@/lib/actions/tournament-management.actions'
import GroupPlacementBoard from './GroupPlacementBoard'
import type { PhaseData, SerializedMatch, TournamentData } from './TournamentTabShell.types'
import { computeGroupStandings, readGroupConfig, va } from './TournamentTabShell.utils'
import { EmptyState, LoadingSubmitButton, PhaseTypeBadge, StepSection } from './TournamentTabShell.helpers'

type TournamentPoolsTabProps = {
    orgSlug: string
    tournament: TournamentData
    groupPhases: PhaseData[]
    matches: SerializedMatch[]
    teamNameById: Map<string, string>
    inputCls: string
    btnPrimary: string
    btnGhost: string
}

export default function TournamentPoolsTab({
    orgSlug,
    tournament,
    groupPhases,
    matches,
    teamNameById,
    inputCls,
    btnPrimary,
    btnGhost,
}: TournamentPoolsTabProps) {
    return (
<div className="space-y-4">
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500">
        <p className="font-semibold text-slate-800">Guide de gestion des poules</p>
        <p className="mt-1">Suivez les 4 etapes ci-dessous pour chaque phase de type poules. Commencez par configurer le nombre de poules, placez les équipes, generez les matchs, puis suivez les classements en direct.</p>
    </div>

    {groupPhases.length === 0 ? (
        <EmptyState message="Aucune phase de type poule." />
    ) : (
        groupPhases.map((phase) => {
            const groupConfig = readGroupConfig(phase.config)
            const availablePitches = tournament.pitches.filter(
                (pitch) => !pitch.phase || pitch.phase.id === phase.id
            )
            return (
                <div key={phase.id} className="space-y-4 rounded-2xl border border-slate-300 bg-white p-4">
                    {/* Phase header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-slate-500">Etape {phase.order}</p>
                            <p className="text-base font-bold">{phase.name}</p>
                        </div>
                        <PhaseTypeBadge type={phase.type} />
                    </div>

                    {/* Step 1: Configuration */}
                    <StepSection num={1} title="Configurer les poules" desc="Definissez le nombre de groupes et le nombre d'équipes par groupe.">
                        <form action={va(configureGroupPhase)} className="grid gap-2 md:grid-cols-3">
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <input type="hidden" name="phaseId" value={phase.id} />
                            <div>
                                <label className="mb-1 block text-xs text-slate-500">Nombre de poules</label>
                                <input
                                    name="groupCount" type="number" min={1} max={64}
                                    defaultValue={groupConfig.count}
                                    className={`${inputCls} w-full`}
                                    placeholder="Ex : 4"
                                />
                            </div>
                            <div>
                                <label className="mb-1.5 block text-xs font-medium text-slate-500">
                                    Équipes par poule
                                </label>                                                    <input
                                    name="teamsPerGroup" type="number" min={2} max={64}
                                    defaultValue={groupConfig.teamsPerGroup}
                                    className={`${inputCls} w-full`}
                                    placeholder="Ex : 4"
                                />
                            </div>
                            <div className="flex items-end">
                                <LoadingSubmitButton className={`${btnPrimary} w-full disabled:opacity-60`} loadingLabel="Enregistrement...">Enregistrer la configuration</LoadingSubmitButton>
                            </div>
                        </form>
                        <p className="text-[11px] text-slate-500">
                            Configuration actuelle : {groupConfig.count} poule(s) de {groupConfig.teamsPerGroup} equipe(s)
                        </p>
                    </StepSection>

                    {/* Step 2: Placement */}
                    <StepSection num={2} title="Placer les équipes" desc="Utilisez le placement automatique (seeding serpentin) ou placez les équipes manuellement en drag-and-drop." color="cyan">
                        <form action={va(autoPlaceGroupTeams)} className="flex flex-wrap items-center gap-2">
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <input type="hidden" name="phaseId" value={phase.id} />
                            <label className={`flex cursor-pointer items-center gap-2 ${inputCls}`}>
                                <input name="confirmedOnly" type="checkbox" className="h-4 w-4 accent-teal-600" />
                                Équipes confirmees uniquement
                            </label>
                            <LoadingSubmitButton className={`${btnGhost} disabled:opacity-60`} loadingLabel="Placement...">
                                ↺ Auto-placer (serpentin)
                            </LoadingSubmitButton>
                        </form>
                        <div className="mt-2">
                            <GroupPlacementBoard
                                tournamentId={tournament.id}
                                orgSlug={orgSlug}
                                tournamentSlug={tournament.slug}
                                phaseId={phase.id}
                                groupCount={groupConfig.count}
                                teamsPerGroup={groupConfig.teamsPerGroup}
                                placements={groupConfig.placements}
                                teamOptions={tournament.registrations.map((r) => ({ id: r.teamId, name: r.team.name }))}
                            />
                        </div>
                    </StepSection>

                    {/* Step 3: Generate matches */}
                    <StepSection num={3} title="Generer les matchs de poule" desc="Choisissez l'heure de debut, la duree max d'un match et le temps de recuperation entre deux matchs d'une equipe." color="emerald">
                        <form action={va(configureGroupPitchAssignments)} className="mb-3 grid gap-2 md:grid-cols-4">
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <input type="hidden" name="phaseId" value={phase.id} />

                            {Array.from({ length: groupConfig.count }, (_, index) => {
                                const groupIndex = index + 1
                                const selectName = `groupPitch_${groupIndex}`

                                return (
                                    <div key={`${phase.id}-group-pitch-${groupIndex}`}>
                                        <label className="mb-1 block text-xs text-slate-500">Poule {groupIndex} - Piste</label>
                                        <select
                                            name={selectName}
                                            defaultValue={groupConfig.preferredPitchIdByGroup[groupIndex] ?? ''}
                                            className={`${inputCls} w-full`}
                                        >
                                            <option value="">Rotation auto</option>
                                            {availablePitches.map((pitch) => (
                                                <option key={`${phase.id}-pitch-opt-${groupIndex}-${pitch.id}`} value={pitch.id}>
                                                    {pitch.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )
                            })}

                            <div className="md:col-span-4">
                                <LoadingSubmitButton
                                    className={`${btnGhost} border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60`}
                                    loadingLabel="Enregistrement..."
                                >
                                    Enregistrer les pistes par poule
                                </LoadingSubmitButton>
                            </div>
                        </form>

                        <form action={va(generateGroupMatchesFromPlacements)} className="grid gap-2 md:grid-cols-5">
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                            <input type="hidden" name="phaseId" value={phase.id} />
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
                            <label className={`flex cursor-pointer items-center gap-2 self-end ${inputCls}`}>
                                <input name="overwritePhaseMatches" type="checkbox" className="h-4 w-4 accent-amber-500" />
                                <span className="text-amber-200">Ecraser matchs</span>
                            </label>
                            <div className="flex items-end">
                                <LoadingSubmitButton
                                    className={`${btnGhost} w-full border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10 disabled:opacity-60`}
                                    loadingLabel="Generation..."
                                >
                                    Generer les matchs
                                </LoadingSubmitButton>
                            </div>
                        </form>
                    </StepSection>

                    {/* Step 4: Standings */}
                    <div className="mb-40 lg:mb-48">
                        <StepSection num={4} title="Classements en direct" desc="Mis a jour apres chaque enregistrement de score. Tiebreaker : Pts > Diff buts > Buts marques." color="amber">
                            <div className="mb-3 flex flex-wrap gap-2">
                                <Link
                                    href={`/public/${orgSlug}/${tournament.slug}/overlay/standings?phaseId=${phase.id}&mode=groups`}
                                    target="_blank"
                                    className="rounded-md border border-amber-300 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50"
                                >
                                    Overlay classement par poule
                                </Link>
                                <Link
                                    href={`/public/${orgSlug}/${tournament.slug}/overlay/standings?phaseId=${phase.id}&mode=global`}
                                    target="_blank"
                                    className="rounded-md border border-teal-300 px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-50"
                                >
                                    Overlay classement global
                                </Link>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                {Array.from({ length: groupConfig.count }, (_, i) => {
                                    const gIdx = i + 1
                                    const standings = computeGroupStandings(gIdx, groupConfig, phase.id, matches, teamNameById)
                                    return (
                                        <div key={`${phase.id}-standings-${gIdx}`} className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-300">Poule {gIdx}</p>
                                            {standings.length === 0 ? (
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
                                                        {standings.map((row, rank) => (
                                                            <tr key={row.teamId} className={`border-t border-slate-200 ${rank === 0 ? 'text-amber-200' : 'text-slate-800'}`}>
                                                                <td className="px-1 py-0.5 font-semibold">{rank + 1}</td>
                                                                <td className="px-1 py-0.5 truncate max-w-[80px]">{row.teamName}</td>
                                                                <td className="px-1 py-0.5 text-right font-bold">{row.points}</td>
                                                                <td className="px-1 py-0.5 text-right">{row.played}</td>
                                                                <td className={`px-1 py-0.5 text-right ${row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-red-400' : ''}`}>
                                                                    {row.goalDiff > 0 ? '+' : ''}{row.goalDiff}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </StepSection>
                    </div>
                </div>
            )
        })
    )}
</div>
    )
}
