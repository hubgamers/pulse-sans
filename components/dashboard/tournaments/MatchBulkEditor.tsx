"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { bulkUpdateTournamentMatches } from "@/lib/actions/tournament-management.actions";
import { Button, EmptyState, Field, Input, Label, Select, StatusAlert } from "@/components/ui";

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

function mapMatchesToRows(matches: MatchRow[]) {
    return matches.map((match) => ({
        matchId: match.id,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        notes: match.notes,
    }));
}

export default function MatchBulkEditor({ tournamentId, orgSlug, tournamentSlug, matches }: Props) {
    const router = useRouter();
    const [state, formAction, isPending] = useActionState(bulkUpdateTournamentMatches, initialState);
    const [sortBy, setSortBy] = useState<"default" | "status">("default");
    const [statusFilter, setStatusFilter] = useState<"ALL" | MatchStatus>("ALL");
    const [phaseFilter, setPhaseFilter] = useState<string>("ALL");

    const uniquePhases = useMemo(() => {
        const phasesSet = new Set(matches.map((m) => m.phaseName));
        return Array.from(phasesSet).sort();
    }, [matches]);

    const [rows, setRows] = useState(() => mapMatchesToRows(matches));

    const serverRowsSignature = useMemo(
        () => JSON.stringify(mapMatchesToRows(matches)),
        [matches]
    );

    const nextRows = useMemo(
        () => JSON.parse(serverRowsSignature) as ReturnType<typeof mapMatchesToRows>,
        [serverRowsSignature]
    );

    useEffect(() => {
        setRows(nextRows);
    }, [nextRows]);

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
                if (statusFilter !== "ALL") {
                    const currentStatus = rowMap.get(match.id)?.status ?? match.status;
                    if (currentStatus !== statusFilter) return false;
                }

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

    const resetRows = () => {
        setRows(nextRows);
        router.refresh();
    };

    return (
        <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                    <h3 className="text-lg font-bold">Edition rapide des matchs</h3>
                    <p className="text-xs text-slate-500">Modifie plusieurs statuts/scores puis sauvegarde en une fois.</p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <Field className="space-y-1">
                        <Label>Phase</Label>
                        <Select
                            value={phaseFilter}
                            onChange={(event) => setPhaseFilter(event.target.value)}
                            className="h-9 py-1 text-xs"
                        >
                            <option value="ALL">Toutes</option>
                            {uniquePhases.map((phase) => (
                                <option key={phase} value={phase}>
                                    {phase}
                                </option>
                            ))}
                        </Select>
                    </Field>
                    <Field className="space-y-1">
                        <Label>Statut</Label>
                        <Select
                            value={statusFilter}
                            onChange={(event) => setStatusFilter(event.target.value as "ALL" | MatchStatus)}
                            className="h-9 py-1 text-xs"
                        >
                            <option value="ALL">Tous</option>
                            <option value="LIVE">En direct</option>
                            <option value="SCHEDULED">Programme</option>
                            <option value="FINISHED">Termine</option>
                            <option value="CANCELLED">Annule</option>
                        </Select>
                    </Field>
                    <Field className="space-y-1">
                        <Label>Tri</Label>
                        <Select
                            value={sortBy}
                            onChange={(event) => setSortBy(event.target.value as "default" | "status")}
                            className="h-9 py-1 text-xs"
                        >
                            <option value="default">Ordre actuel</option>
                            <option value="status">Statut du match</option>
                        </Select>
                    </Field>
                    <form action={formAction} className="flex items-end gap-2">
                        <input type="hidden" name="tournamentId" value={tournamentId} />
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
                        <input type="hidden" name="updatesJson" value={updatesJson} />
                        <label className="flex min-h-8 items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs text-slate-700">
                            <input name="rerunPropagation" type="checkbox" className="h-4 w-4 accent-teal-600" />
                            Propagation complete
                        </label>
                        <Button type="submit" disabled={isPending || updates.length === 0} size="sm">
                            {isPending ? "Sauvegarde..." : `Sauvegarder (${updates.length})`}
                        </Button>
                    </form>
                    <Button onClick={resetRows} disabled={isPending} variant="secondary" size="sm">
                        Actualiser
                    </Button>
                </div>
            </div>

            {state.message && (
                <StatusAlert variant={state.success ? "success" : "danger"}>
                    {state.message}
                </StatusAlert>
            )}

            <div className="space-y-2">
                {displayedMatches.length === 0 && (
                    <EmptyState
                        title="Aucun match"
                        description="Aucun match ne correspond au filtre selectionne."
                        className="px-3 py-4"
                    />
                )}
                {displayedMatches.map((match) => {
                    const row = rowMap.get(match.id);
                    if (!row) return null;

                    return (
                        <div key={`bulk-${match.id}`} className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 md:grid-cols-12">
                            <div className="md:col-span-3">
                                <p className="text-xs font-semibold">{match.homeTeamName} vs {match.awayTeamName}</p>
                                <p className="text-[11px] text-slate-500">{match.phaseName} - {match.pitchName}</p>
                                <p className="text-[11px] text-slate-500">{match.scheduledAtLabel}</p>
                            </div>
                            <div className="md:col-span-2">
                                <Select
                                    value={row.status}
                                    onChange={(event) => updateRow(match.id, { status: event.target.value as MatchStatus })}
                                    className="h-9 py-1 text-xs"
                                >
                                    <option value="SCHEDULED">Programme</option>
                                    <option value="LIVE">En direct</option>
                                    <option value="FINISHED">Termine</option>
                                    <option value="CANCELLED">Annule</option>
                                </Select>
                            </div>
                            <div className="md:col-span-2">
                                <Input
                                    type="number"
                                    min={0}
                                    value={row.homeScore ?? ""}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        const patch: Partial<(typeof rows)[number]> = { homeScore: value === "" ? null : Number(value) };
                                        updateRow(match.id, patch);
                                    }}
                                    className="h-9 py-1 text-xs"
                                    placeholder="Domicile"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <Input
                                    type="number"
                                    min={0}
                                    value={row.awayScore ?? ""}
                                    onChange={(event) => {
                                        const value = event.target.value;
                                        const patch: Partial<(typeof rows)[number]> = { awayScore: value === "" ? null : Number(value) };
                                        updateRow(match.id, patch);
                                    }}
                                    className="h-9 py-1 text-xs"
                                    placeholder="Exterieur"
                                />
                            </div>
                            <div className="md:col-span-3">
                                <Input
                                    value={row.notes}
                                    onChange={(event) => updateRow(match.id, { notes: event.target.value })}
                                    className="h-9 py-1 text-xs"
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
