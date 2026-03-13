"use client";

import { useActionState, useMemo, useState } from "react";
import { bulkSetGroupPlacements } from "@/lib/actions/tournament-management.actions";

type Placement = {
    teamId: string;
    groupIndex: number;
    slot: number;
};

type TeamOption = {
    id: string;
    name: string;
};

type Props = {
    tournamentId: string;
    orgSlug: string;
    tournamentSlug: string;
    phaseId: string;
    groupCount: number;
    teamsPerGroup: number;
    placements: Placement[];
    teamOptions: TeamOption[];
};

type ActionState = {
    success?: boolean;
    message: string;
};

const initialState: ActionState = { success: false, message: "" };

export default function GroupPlacementBoard({
    tournamentId,
    orgSlug,
    tournamentSlug,
    phaseId,
    groupCount,
    teamsPerGroup,
    placements,
    teamOptions,
}: Props) {
    const [state, formAction, isPending] = useActionState(bulkSetGroupPlacements, initialState);

    const initialMap = useMemo(() => {
        const map: Record<string, string> = {};
        for (const placement of placements) {
            map[`${placement.groupIndex}-${placement.slot}`] = placement.teamId;
        }
        return map;
    }, [placements]);

    const [assignments, setAssignments] = useState<Record<string, string>>(initialMap);

    const teamNameById = useMemo(() => new Map(teamOptions.map((team) => [team.id, team.name])), [teamOptions]);

    const assignedTeamIds = useMemo(() => new Set(Object.values(assignments).filter(Boolean)), [assignments]);
    const unassignedTeams = useMemo(
        () => teamOptions.filter((team) => !assignedTeamIds.has(team.id)),
        [teamOptions, assignedTeamIds]
    );

    const placementJson = useMemo(() => {
        const payload: Placement[] = [];
        for (const [slotKey, teamId] of Object.entries(assignments)) {
            if (!teamId) continue;
            const [groupRaw, slotRaw] = slotKey.split("-");
            const groupIndex = Number(groupRaw);
            const slot = Number(slotRaw);
            if (!Number.isInteger(groupIndex) || !Number.isInteger(slot)) continue;
            payload.push({ teamId, groupIndex, slot });
        }
        return JSON.stringify(payload);
    }, [assignments]);

    const assignTeamToSlot = (teamId: string, slotKey: string) => {
        if (!teamId) return;
        setAssignments((prev) => {
            const next: Record<string, string> = {};
            for (const [key, value] of Object.entries(prev)) {
                if (value === teamId) {
                    next[key] = "";
                } else {
                    next[key] = value;
                }
            }
            next[slotKey] = teamId;
            return next;
        });
    };

    const clearSlot = (slotKey: string) => {
        setAssignments((prev) => ({ ...prev, [slotKey]: "" }));
    };

    return (
        <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-3">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <p className="text-xs uppercase tracking-wider text-slate-400">Placement visuel (drag and drop)</p>
                <form action={formAction} className="flex items-center gap-2">
                    <input type="hidden" name="tournamentId" value={tournamentId} />
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
                    <input type="hidden" name="phaseId" value={phaseId} />
                    <input type="hidden" name="placementsJson" value={placementJson} />
                    <button
                        type="submit"
                        disabled={isPending}
                        className="rounded-md border border-indigo-500/40 px-3 py-1.5 text-xs text-indigo-200 hover:bg-indigo-500/10 disabled:opacity-60"
                    >
                        {isPending ? "Sauvegarde..." : "Sauvegarder placement"}
                    </button>
                </form>
            </div>

            {state.message && (
                <div
                    className={`rounded-md border px-3 py-2 text-xs ${state.success
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                            : "border-red-500/30 bg-red-500/10 text-red-300"
                        }`}
                >
                    {state.message}
                </div>
            )}

            <div className="rounded-md border border-slate-800 bg-slate-900/50 p-2">
                <p className="mb-2 text-[11px] uppercase tracking-wider text-slate-500">Equipes non placees</p>
                <div className="flex flex-wrap gap-2">
                    {unassignedTeams.length === 0 ? (
                        <span className="text-xs text-slate-500">Toutes les equipes sont placees.</span>
                    ) : (
                        unassignedTeams.map((team) => (
                            <div
                                key={`${phaseId}-pool-${team.id}`}
                                draggable
                                onDragStart={(event) => {
                                    event.dataTransfer.setData("text/plain", team.id);
                                    event.dataTransfer.effectAllowed = "move";
                                }}
                                className="cursor-grab rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200"
                            >
                                {team.name}
                            </div>
                        ))
                    )}
                </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: groupCount }, (_, groupIdx) => {
                    const groupIndex = groupIdx + 1;
                    return (
                        <div key={`${phaseId}-visual-group-${groupIndex}`} className="rounded-md border border-slate-800 bg-slate-900/50 p-2">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-cyan-300">Poule {groupIndex}</p>
                            <div className="space-y-2">
                                {Array.from({ length: teamsPerGroup }, (_, slotIdx) => {
                                    const slot = slotIdx + 1;
                                    const slotKey = `${groupIndex}-${slot}`;
                                    const teamId = assignments[slotKey] || "";
                                    const teamName = teamId ? teamNameById.get(teamId) || "Equipe" : "";

                                    return (
                                        <div
                                            key={`${phaseId}-slot-${slotKey}`}
                                            onDragOver={(event) => event.preventDefault()}
                                            onDrop={(event) => {
                                                event.preventDefault();
                                                const droppedTeamId = event.dataTransfer.getData("text/plain");
                                                assignTeamToSlot(droppedTeamId, slotKey);
                                            }}
                                            className="rounded-md border border-slate-700 bg-slate-950 p-2"
                                        >
                                            <p className="mb-1 text-[10px] uppercase tracking-wider text-slate-500">Place {slot}</p>
                                            {teamId ? (
                                                <div
                                                    draggable
                                                    onDragStart={(event) => {
                                                        event.dataTransfer.setData("text/plain", teamId);
                                                        event.dataTransfer.effectAllowed = "move";
                                                    }}
                                                    className="cursor-grab rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white"
                                                >
                                                    {teamName}
                                                </div>
                                            ) : (
                                                <div className="rounded border border-dashed border-slate-700 px-2 py-1 text-xs text-slate-500">Drop equipe ici</div>
                                            )}
                                            {teamId && (
                                                <button
                                                    type="button"
                                                    onClick={() => clearSlot(slotKey)}
                                                    className="mt-1 w-full rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-300 hover:bg-slate-900"
                                                >
                                                    Vider
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
