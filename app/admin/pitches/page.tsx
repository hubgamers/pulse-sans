import { prisma } from "@/lib/prisma";
import { MapPinned } from "lucide-react";
import { createAdminPitch, deleteAdminPitch, updateAdminPitch } from "@/lib/actions/admin/crud.actions";

export default async function AdminPitchesPage() {
  const tournaments = await prisma.tournament.findMany({
    select: { id: true, name: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  const pitches = await prisma.pitch.findMany({
    orderBy: { name: "asc" },
    take: 120,
    select: {
      id: true,
      name: true,
      phaseId: true,
      tournamentId: true,
      tournament: {
        select: { name: true },
      },
      _count: {
        select: { matches: true },
      },
    },
  });

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Admin Pitches</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black">Gestion des terrains (Pitch)</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold mb-3">Créer un terrain</h2>
        <form action={createAdminPitch} className="grid gap-2 md:grid-cols-4">
          <input name="name" required placeholder="Nom du terrain" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="tournamentId" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Tournoi</option>
            {tournaments.map((tournament) => (
              <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
            ))}
          </select>
          <input name="phaseId" placeholder="Phase ID (optionnel)" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm font-semibold">Créer</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-slate-700">
          <MapPinned size={16} />
          <span>{pitches.length} terrain(s)</span>
        </div>
        <div className="divide-y divide-slate-800">
          {pitches.map((pitch) => (
            <div key={pitch.id} className="flex flex-col gap-2 px-4 py-3">
              <form action={updateAdminPitch} className="grid gap-2 md:grid-cols-6">
                <input type="hidden" name="id" value={pitch.id} />
                <input name="name" defaultValue={pitch.name} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select name="tournamentId" defaultValue={pitch.tournamentId} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {tournaments.map((tournament) => (
                    <option key={tournament.id} value={tournament.id}>{tournament.name}</option>
                  ))}
                </select>
                <input name="phaseId" defaultValue={pitch.phaseId || ""} placeholder="Phase ID" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Tournoi: {pitch.tournament.name}</span>
                  <span>Matchs: {pitch._count.matches}</span>
                </div>
                <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm">Mettre à jour</button>
              </form>
              <form action={deleteAdminPitch}>
                <input type="hidden" name="id" value={pitch.id} />
                <button className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-2 text-xs">Supprimer</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
