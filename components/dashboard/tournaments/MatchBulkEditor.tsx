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

export default function MatchBulkEditor({ tournamentId, orgSlug, tournamentSlug, matches }: Props) {
    const [state, formAction, isPending] = useActionState(bulkUpdateTournamentMatches, initialState);

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
                {matches.map((match) => {
                    const row = rows.find((item) => item.matchId === match.id);
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
                                    <option value="SCHEDULED">SCHEDULED</option>
                                    <option value="LIVE">LIVE</option>
                                    <option value="FINISHED">FINISHED</option>
                                    <option value="CANCELLED">CANCELLED</option>
                                </select>
                            </div>
                            <div className="md:col-span-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={row.homeScore ?? ""}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        updateRow(match.id, { homeScore: value === "" ? null : Number(value) });
                                    }}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                    placeholder="Home"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <input
                                    type="number"
                                    min={0}
                                    value={row.awayScore ?? ""}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        updateRow(match.id, { awayScore: value === "" ? null : Number(value) });
                                    }}
                                    className="w-full rounded-md border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                                    placeholder="Away"
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
