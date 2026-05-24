'use client'

import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useMemo, type Dispatch, type SetStateAction } from 'react'
import {
    createTournamentMatch,
    deleteAllTournamentMatches,
    deleteSelectedTournamentMatches,
    deleteTournamentMatch,
    generatePhaseRoundRobinMatches,
} from '@/lib/actions/tournament-management.actions'
import {
    Badge,
    Button,
    EmptyState,
    Field,
    Input,
    Label,
    Select,
    StatusAlert,
    TabButton,
    Tabs,
    buttonClassName,
} from '@/components/ui'
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
}

const MATCH_STATUS: SerializedMatch['status'][] = ['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED']

function getStatusVariant(status: SerializedMatch['status']) {
    if (status === 'FINISHED') return 'success'
    if (status === 'LIVE') return 'warning'
    if (status === 'CANCELLED') return 'danger'
    return 'default'
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
            <StatusAlert title="Planification et suivi des matchs">
                <div className="space-y-3">
                    <p>
                        Suivez les etapes dans l&apos;ordre pour garder une gestion simple: generer, ajouter,
                        controler, puis mettre a jour en masse.
                    </p>
                    <form
                        action={va(deleteAllTournamentMatches)}
                        onSubmit={(event) => {
                            const ok = window.confirm('Supprimer tous les matchs de ce tournoi ? Cette action est irreversible.')
                            if (!ok) event.preventDefault()
                        }}
                    >
                        <input type="hidden" name="tournamentId" value={tournament.id} />
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                        <LoadingSubmitButton
                            className={buttonClassName({ variant: 'danger', size: 'sm' })}
                            loadingLabel="Suppression..."
                        >
                            Supprimer tous les matchs
                        </LoadingSubmitButton>
                    </form>
                </div>
            </StatusAlert>

            <Tabs className="grid md:grid-cols-4">
                {[
                    { step: 1, label: 'Generer' },
                    { step: 2, label: 'Ajouter' },
                    { step: 3, label: 'Verifier' },
                    { step: 4, label: 'Mettre a jour' },
                ].map((item) => (
                    <TabButton
                        key={`matches-step-${item.step}`}
                        active={matchesStep === item.step}
                        onClick={() => setMatchesStep(item.step as 1 | 2 | 3 | 4)}
                        className="justify-start"
                    >
                        {item.step}. {item.label}
                    </TabButton>
                ))}
            </Tabs>

            {matchesStep === 1 && (
                <StepSection
                    num={1}
                    title="Generation automatique round-robin"
                    desc="Genere tous les matchs d'une phase en respectant les disponibilites des pistes et des equipes. Pour une phase de poules, la generation suit les placements de chaque poule."
                >
                    <form action={va(generatePhaseRoundRobinMatches)} className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                        <input type="hidden" name="tournamentId" value={tournament.id} />
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="tournamentSlug" value={tournament.slug} />

                        <Field className="xl:col-span-2">
                            <Label>Phase</Label>
                            <Select name="phaseId" required defaultValue="">
                                <option value="" disabled>Selectionner une phase</option>
                                {tournament.phases.map((phase) => (
                                    <option key={phase.id} value={phase.id}>{phase.name}</option>
                                ))}
                            </Select>
                        </Field>
                        <Field>
                            <Label>Heure de debut</Label>
                            <Input name="startAt" type="datetime-local" />
                        </Field>
                        <Field>
                            <Label>Duree max (min)</Label>
                            <Input name="maxDurationMinutes" type="number" min={5} max={600} defaultValue={30} />
                        </Field>
                        <Field>
                            <Label>Battement general (min)</Label>
                            <Input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} />
                        </Field>
                        <div className="flex flex-col gap-2">
                            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900">
                                <input name="confirmedOnly" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                                Confirmees uniquement
                            </label>
                            <LoadingSubmitButton
                                className={buttonClassName({ variant: 'secondary', className: 'w-full' })}
                                disabled={tournament.registrations.length < 2 || tournament.pitches.length === 0}
                                loadingLabel="Generation..."
                            >
                                Generer round-robin
                            </LoadingSubmitButton>
                        </div>
                    </form>
                    {(tournament.registrations.length < 2 || tournament.pitches.length === 0) && (
                        <StatusAlert variant="warning" className="mt-3 text-xs">
                            {tournament.registrations.length < 2 ? 'Minimum 2 equipes inscrites requis. ' : ''}
                            {tournament.pitches.length === 0 ? 'Ajoutez au moins une piste dans l\'onglet Inscriptions & Pistes.' : ''}
                        </StatusAlert>
                    )}
                </StepSection>
            )}

            {matchesStep === 2 && (
                <StepSection
                    num={2}
                    title="Creer des matchs manuellement"
                    desc="Creez un match individuel ou importez plusieurs matchs d'un coup via le mode groupe."
                    color="cyan"
                >
                    <Tabs className="mb-3 w-fit">
                        <TabButton active={matchCreateMode === 'single'} onClick={() => setMatchCreateMode('single')}>
                            Match unique
                        </TabButton>
                        <TabButton active={matchCreateMode === 'bulk'} onClick={() => setMatchCreateMode('bulk')}>
                            Ajout groupe
                        </TabButton>
                    </Tabs>

                    {matchCreateMode === 'single' && (
                        <form action={va(createTournamentMatch)} className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                            <input type="hidden" name="tournamentId" value={tournament.id} />
                            <input type="hidden" name="orgSlug" value={orgSlug} />
                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />

                            <Select name="phaseId" required defaultValue="">
                                <option value="" disabled>Phase</option>
                                {tournament.phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                            <Select name="pitchId" required defaultValue="">
                                <option value="" disabled>Piste</option>
                                {tournament.pitches.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </Select>
                            <Select name="homeTeamId" defaultValue="">
                                <option value="">Equipe domicile</option>
                                {tournament.registrations.map((r) => (
                                    <option key={`home-${r.id}`} value={r.teamId}>{r.team.name}</option>
                                ))}
                            </Select>
                            <Select name="awayTeamId" defaultValue="">
                                <option value="">Equipe exterieur</option>
                                {tournament.registrations.map((r) => (
                                    <option key={`away-${r.id}`} value={r.teamId}>{r.team.name}</option>
                                ))}
                            </Select>
                            <Input name="scheduledAt" type="datetime-local" />
                            <Input name="maxDurationMinutes" type="number" min={5} max={600} defaultValue={30} placeholder="Duree max (min)" />
                            <Input name="teamBreakMinutes" type="number" min={0} max={240} defaultValue={10} placeholder="Battement (min)" />
                            <Input name="roundNumber" type="number" min={1} placeholder="Round n" />
                            <Input name="bracketPos" placeholder="Position bracket (WB-R1-M1...)" />
                            <LoadingSubmitButton
                                className={buttonClassName({ className: 'xl:col-span-1' })}
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

            {matchesStep === 3 && (
                <StepSection
                    num={3}
                    title="Liste des matchs"
                    desc={`${matches.length} match(s) planifie(s) - cliquez sur Detail pour voir et modifier un match.`}
                    color="emerald"
                >
                    {matches.length === 0 ? (
                        <EmptyState
                            title="Aucun match planifie"
                            description="Utilisez la generation automatique ou la creation manuelle ci-dessus."
                        />
                    ) : (
                        <div className="space-y-2">
                            <div className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-2 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => setSelectedMatchIds(allSelected ? [] : allVisibleMatchIds)}
                                    >
                                        {allSelected ? 'Tout deselec.' : 'Tout selectionner'}
                                    </Button>
                                    {MATCH_STATUS.map((status) => {
                                        const ids = matchIdsByStatus.get(status) ?? []
                                        const hasAny = ids.length > 0
                                        const allThisStatusSelected = hasAny && ids.every((id) => selectedSet.has(id))
                                        return (
                                            <Button
                                                key={`select-status-${status}`}
                                                type="button"
                                                variant={allThisStatusSelected ? 'primary' : 'secondary'}
                                                size="sm"
                                                onClick={() => toggleSelectStatus(status)}
                                                disabled={!hasAny}
                                            >
                                                {status} ({ids.length})
                                            </Button>
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
                                        className={buttonClassName({ variant: 'danger', size: 'sm' })}
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
                                            return groupLabel ? (
                                                <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-700">
                                                    {groupLabel}
                                                </p>
                                            ) : null
                                        })()}
                                        <p className="truncate text-sm font-semibold">
                                            {match.homeTeam?.name || 'TBD'} vs {match.awayTeam?.name || 'TBD'}
                                            {match.result && (
                                                <span className="ml-2 text-emerald-600">
                                                    {match.result.homeScore} - {match.result.awayScore}
                                                </span>
                                            )}
                                        </p>
                                        <p className="truncate text-xs text-slate-500">
                                            {match.phase.name} - {match.pitch.name}
                                            {match.roundNumber ? ` - Round ${match.roundNumber}` : ''}
                                            {match.bracketPos ? ` - ${match.bracketPos}` : ''}
                                            {match.scheduledAt ? ` - ${new Date(match.scheduledAt).toLocaleString('fr-FR', { timeZone: 'UTC' })}` : ''}
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
                                        <Badge variant={getStatusVariant(match.status)}>{match.status}</Badge>
                                        <Link
                                            href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}/matches/${match.id}`}
                                            className={buttonClassName({ variant: 'secondary', size: 'sm' })}
                                        >
                                            Detail
                                        </Link>
                                        <form action={va(deleteTournamentMatch)}>
                                            <input type="hidden" name="tournamentId" value={tournament.id} />
                                            <input type="hidden" name="orgSlug" value={orgSlug} />
                                            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                                            <input type="hidden" name="matchId" value={match.id} />
                                            <LoadingSubmitButton
                                                className={buttonClassName({ variant: 'danger', size: 'sm' })}
                                                loadingLabel="Suppression..."
                                            >
                                                Suppr.
                                            </LoadingSubmitButton>
                                        </form>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </StepSection>
            )}

            {matchesStep === 4 && matches.length > 0 && (
                <StepSection
                    num={4}
                    title="Editeur global des scores et statuts"
                    desc="Modifiez plusieurs matchs a la fois et sauvegardez en une seule action."
                    color="amber"
                >
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
                <Button
                    type="button"
                    variant="secondary"
                    icon={<ChevronLeft size={16} />}
                    onClick={() => setMatchesStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
                    disabled={matchesStep === 1}
                >
                    Etape precedente
                </Button>
                <Button
                    type="button"
                    icon={<ChevronRight size={16} />}
                    onClick={() => setMatchesStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
                    disabled={matchesStep === 4}
                >
                    Etape suivante
                </Button>
            </div>
        </div>
    )
}
