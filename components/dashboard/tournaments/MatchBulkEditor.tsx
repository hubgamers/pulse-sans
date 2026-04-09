"use client";

import { useActionState, useMemo, useState } from "react";
import { bulkUpdateTournamentMatches } from "@/lib/actions/tournament-management.actions";

type MatchStatus = "SCHEDULED" | "LIVE" | "FINISHED" | "CANCELLED";

type MatchRow = {
    id: string;
    phaseName: string;
    pitchName: string;
    homeTeamName: string;
    awayTeamName: string;
    status: MatchStatus;
    homeScore: number | null;
    awayScore: number | null;
    notes: string;
    scheduledAtLabel: string;
};

type ActionState = {
    success?: boolean;
    message: string;
};

type Props = {
    tournamentId: string;
    orgSlug: string;
    tournamentSlug: string;
    matches: MatchRow[];
};

const initialState: ActionState = {
    success: false,
    message: "",
};

const matchStatusOrder: Record<MatchStatus, number> = {
    LIVE: 0,
    SCHEDULED: 1,
    FINISHED: 2,
    CANCELLED: 3,
};

export default function MatchBulkEditor({ tournamentId, orgSlug, tournamentSlug, matches }: Props) {
    const [state, formAction, isPending] = useActionState(bulkUpdateTournamentMatches, initialState);
    const [sortBy, setSortBy] = useState<"default" | "status">("default");
    const [statusFilter, setStatusFilter] = useState<"ALL" | MatchStatus>("ALL");
    const [phaseFilter, setPhaseFilter] = useState<string>("ALL");

    // Extract unique phases from matches
    const uniquePhases = useMemo(() => {
        const phasesSet = new Set(matches.map((m) => m.phaseName));
        return Array.from(phasesSet).sort();
    }, [matches]);

    const [rows, setRows] = useState(
        matches.map((match) => ({
            matchId: match.id,
            status: match.status,
            homeScore: match.homeScore,
            awayScore: match.awayScore,
            notes: match.notes,
        }))
    );

    const initialMap = useMemo(
        () =>
            new Map(
                matches.map((match) => [
                    match.id,
                    {
                        status: match.status,
                        homeScore: match.homeScore,
                        awayScore: match.awayScore,
                        notes: match.notes,
                    },
                ])
            ),
        [matches]
    );

    const updates = useMemo(() => {
        return rows.filter((row) => {
            const initial = initialMap.get(row.matchId);
            if (!initial) return false;
            return (
                initial.status !== row.status ||
                initial.homeScore !== row.homeScore ||
                initial.awayScore !== row.awayScore ||
                initial.notes !== row.notes
            );
        });
    }, [rows, initialMap]);

    const updatesJson = useMemo(() => JSON.stringify(updates), [updates]);

    const rowMap = useMemo(() => new Map(rows.map((row) => [row.matchId, row])), [rows]);

    const displayedMatches = useMemo(() => {
        const indexedMatches = matches
            .map((match, index) => ({ match, index }))
            .filter(({ match }) => {
                // Apply status filter
                if (statusFilter !== "ALL") {
                    const currentStatus = rowMap.get(match.id)?.status ?? match.status;
                    if (currentStatus !== statusFilter) return false;
                }
                
                // Apply phase filter
                if (phaseFilter !== "ALL" && match.phaseName !== phaseFilter) {
                    return false;
                }
                
                return true;
            });

        if (sortBy === "default") {
            return indexedMatches.map(({ match }) => match);
        }

        return indexedMatches
            .sort((a, b) => {
                const aStatus = rowMap.get(a.match.id)?.status ?? a.match.status;
                const bStatus = rowMap.get(b.match.id)?.status ?? b.match.status;
                const statusDiff = matchStatusOrder[aStatus] - matchStatusOrder[bStatus];

                if (statusDiff !== 0) return statusDiff;
                return a.index - b.index;
            })
            .map(({ match }) => match);
    }, [matches, rowMap, sortBy, statusFilter, phaseFilter]);

    const updateRow = (matchId: string, patch: Partial<(typeof rows)[number]>) => {
        setRows((prev) => prev.map((row) => (row.matchId === matchId ? { ...row, ...patch } : row)));
    };

    return (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                    <h3 className="text-lg font-bold">Edition rapide des matchs</h3>
                    <p className="text-xs text-slate-500">Modifie plusieurs statuts/scores puis sauvegarde en une fois.</p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Phase</span>
                        <select
                            value={phaseFilter}
                            onChange={(event) => setPhaseFilter(event.target.value)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700"
                        >
                            <option value="ALL">Toutes</option>
                            {uniquePhases.map((phase) => (
                                <option key={phase} value={phase}>
                                    {phase}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Statut</span>
                        <select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as "ALL" | MatchStatus)}
                            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700"
                        >
                            <option value="ALL">Tous</option>
                            <option value="LIVE">En direct</option>
                            <option value="SCHEDULED">Programmé</option>
                            <option value="FINISHED">Terminé</option>
                            <option value="CANCELLED">Annulé</option>
                        </select>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-slate-500">
                        <span>Tri</span>
                        <select
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value as "default" | "status")}
                            className="rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700"
                        >
                            <option value="default">Ordre actuel</option>
                            <option value="status">Statut du match</option>
                        </select>
                    </label>
                    <form action={formAction} className="flex items-center gap-2">
                        <input type="hidden" name="tournamentId" value={tournamentId} />
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
                        <input type="hidden" name="updatesJson" value={updatesJson} />
                        <button
                            type="submit"
                            disabled={isPending || updates.length === 0}
                            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold hover:bg-teal-600 disabled:opacity-60"
                        >
                            {isPending ? "Sauvegarde..." : `Sauvegarder (${updates.length})`}
                        </button>
                    </form>
                </div>
            </div>

            {state.message && (
                <div
                    className={`rounded-lg border px-3 py-2 text-sm ${state.success
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/30 bg-red-500/10 text-red-300"
                        }`}
                >
                    {state.message}
                </div>
            )}

            <div className="space-y-2">
                {displayedMatches.length === 0 && (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
                        Aucun match ne correspond au filtre sélectionné.
                    </div>
                )}
                {displayedMatches.map((match) => {
                    const row = rowMap.get(match.id);
                    if (!row) return null;

                    return (
                        <div key={`bulk-${match.id}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-12">
                            <div className="md:col-span-3">
                                <p className="text-xs font-semibold">{match.homeTeamName} vs {match.awayTeamName}</p>
                                <p className="text-[11px] text-slate-500">{match.phaseName} • {match.pitchName}</p>
                                <p className="text-[11px] text-slate-500">{match.scheduledAtLabel}</p>
                            </div>
                            <div className="md:col-span-2">
                                <select
                                    value={row.status}
                                    onChange={(event) => updateRow(match.id, { status: event.target.value as MatchStatus })}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                >
                                    <option value="SCHEDULED">Programmé</option>
                                    <option value="LIVE">En direct</option>
                                    <option value="FINISHED">Terminé</option>
                                    <option value="CANCELLED">Annulé</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={row.homeScore ?? ""}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        const patch: Partial<(typeof rows)[number]> = { homeScore: value === "" ? null : Number(value) };
                                        if (value !== "") patch.status = "FINISHED";
                                        updateRow(match.id, patch);
                                    }}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                    placeholder="Domicile"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={row.awayScore ?? ""}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        const patch: Partial<(typeof rows)[number]> = { awayScore: value === "" ? null : Number(value) };
                                        if (value !== "") patch.status = "FINISHED";
                                        updateRow(match.id, patch);
                                    }}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                    placeholder="Extérieur"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <input
                                    value={row.notes}
                                    onChange={(event) => updateRow(match.id, { notes: event.target.value })}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                    placeholder="Notes"
                                />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
