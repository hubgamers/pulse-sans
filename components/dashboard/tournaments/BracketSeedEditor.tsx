'use client'

import { useActionState, useMemo, useState } from 'react'
import { bulkAssignBracketSeeds } from '@/lib/actions/tournament-management.actions'

type Row = {
    matchId: string
    bracketPos: string | null
    homeTeamId: string | null
    awayTeamId: string | null
}

type TeamOption = {
    id: string
    name: string
}

type ActionState = {
    success?: boolean
    message: string
}

type Props = {
    tournamentId: string
    orgSlug: string
    tournamentSlug: string
    phaseId: string
    rows: Row[]
    teamOptions: TeamOption[]
}

const initialState: ActionState = {
    success: false,
    message: '',
}

export default function BracketSeedEditor({
    tournamentId,
    orgSlug,
    tournamentSlug,
    phaseId,
    rows,
    teamOptions,
}: Props) {
    const [state, formAction, isPending] = useActionState(bulkAssignBracketSeeds, initialState)

    const [seedRows, setSeedRows] = useState(
        rows.map((row) => ({
            matchId: row.matchId,
            homeTeamId: row.homeTeamId,
            awayTeamId: row.awayTeamId,
        }))
    )

    const initialMap = useMemo(
        () => new Map(rows.map((r) => [r.matchId, { homeTeamId: r.homeTeamId, awayTeamId: r.awayTeamId }])),
        [rows]
    )

    const updates = useMemo(() => {
        return seedRows.filter((row) => {
            const initial = initialMap.get(row.matchId)
            if (!initial) return false
            return initial.homeTeamId !== row.homeTeamId || initial.awayTeamId !== row.awayTeamId
        })
    }, [seedRows, initialMap])

    const updatesJson = useMemo(
        () =>
            JSON.stringify(
                updates.map((row) => ({
                    matchId: row.matchId,
                    homeTeamId: row.homeTeamId || '',
                    awayTeamId: row.awayTeamId || '',
                }))
            ),
        [updates]
    )

    const updateRow = (matchId: string, patch: Partial<(typeof seedRows)[number]>) => {
        setSeedRows((prev) => prev.map((row) => (row.matchId === matchId ? { ...row, ...patch } : row)))
    }

    const byId = useMemo(() => new Map(rows.map((r) => [r.matchId, r])), [rows])

    return (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between">
                <div>
                    <h4 className="text-sm font-semibold">Affectation des equipes (Round 1)</h4>
                    <p className="text-[11px] text-slate-500">Auto-assigne a la generation, puis modifiable avant de lancer les matchs.</p>
                </div>
                <form action={formAction} className="flex items-center gap-2">
                    <input type="hidden" name="tournamentId" value={tournamentId} />
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
                    <input type="hidden" name="phaseId" value={phaseId} />
                    <input type="hidden" name="seedsJson" value={updatesJson} />
                    <button
                        type="submit"
                        disabled={isPending || updates.length === 0}
                        className="rounded-md bg-teal-700 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-teal-600 disabled:opacity-60"
                    >
                        {isPending ? 'Sauvegarde...' : `Sauvegarder (${updates.length})`}
                    </button>
                </form>
            </div>

            {state.message && (
                <div
                    className={`rounded-lg border px-3 py-2 text-xs ${
                        state.success
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-red-500/30 bg-red-500/10 text-red-300'
                    }`}
                >
                    {state.message}
                </div>
            )}

            <div className="space-y-2">
                {seedRows.map((row) => {
                    const source = byId.get(row.matchId)
                    if (!source) return null
                    return (
                        <div key={`seed-${row.matchId}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-12">
                            <div className="md:col-span-2">
                                <p className="text-xs font-semibold text-teal-700">{source.bracketPos || 'R1'}</p>
                            </div>
                            <div className="md:col-span-5">
                                <select
                                    value={row.homeTeamId ?? ''}
                                    onChange={(event) => updateRow(row.matchId, { homeTeamId: event.target.value || null })}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                >
                                    <option value="">Equipe domicile</option>
                                    {teamOptions.map((team) => (
                                        <option key={`seed-home-${row.matchId}-${team.id}`} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-5">
                                <select
                                    value={row.awayTeamId ?? ''}
                                    onChange={(event) => updateRow(row.matchId, { awayTeamId: event.target.value || null })}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                >
                                    <option value="">Equipe exterieur</option>
                                    {teamOptions.map((team) => (
                                        <option key={`seed-away-${row.matchId}-${team.id}`} value={team.id}>
                                            {team.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
