import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Trophy, ArrowRight } from "lucide-react";
import { TournamentStatus } from "@prisma/client";
import {
  createAdminTournament,
  deleteAdminTournament,
  updateAdminTournament,
} from "@/lib/actions/admin/crud.actions";

export default async function AdminTournamentsPage() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const games = await prisma.game.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 100,
  });

  const tournaments = await prisma.tournament.findMany({
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      updatedAt: true,
      organization: {
        select: {
          slug: true,
          name: true,
        },
      },
      game: {
        select: {
          name: true,
        },
      },
      _count: {
        select: {
          registrations: true,
        },
      },
      organizationId: true,
      gameId: true,
      description: true,
    },
  });

  const byStatus = tournaments.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Admin Tournaments</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black">Gestion des tournois</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold mb-3">Créer un tournoi</h2>
        <form action={createAdminTournament} className="grid gap-2 md:grid-cols-7">
          <input name="name" required placeholder="Nom" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="slug" required placeholder="slug" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="organizationId" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Organisation</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <select name="gameId" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Jeu</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>{game.name}</option>
            ))}
          </select>
          <select name="status" defaultValue={TournamentStatus.DRAFT} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {Object.values(TournamentStatus).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <input name="description" placeholder="Description" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm font-semibold">Créer</button>
        </form>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(byStatus).map(([status, count]) => (
          <div key={status} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500">{status}</p>
            <p className="mt-2 text-2xl font-black">{count}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-slate-700">
          <Trophy size={16} />
          <span>{tournaments.length} tournois</span>
        </div>
        <div className="divide-y divide-slate-800">
          {tournaments.map((tournament) => (
            <div key={tournament.id} className="flex flex-col gap-2 px-4 py-3">
              <form action={updateAdminTournament} className="grid gap-2 md:grid-cols-8">
                <input type="hidden" name="id" value={tournament.id} />
                <input name="name" defaultValue={tournament.name} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input name="slug" defaultValue={tournament.slug} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select name="organizationId" defaultValue={tournament.organizationId} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <select name="gameId" defaultValue={tournament.gameId} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
                <select name="status" defaultValue={tournament.status} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {Object.values(TournamentStatus).map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
                <input name="description" defaultValue={tournament.description || ""} placeholder="Description" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Inscriptions: {tournament._count.registrations}</span>
                  <span>{new Date(tournament.updatedAt).toLocaleDateString("fr-FR")}</span>
                  <Link href={`/dashboard/org/${tournament.organization.slug}/tournaments/${tournament.slug}`} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-700">
                    Ouvrir <ArrowRight size={12} />
                  </Link>
                </div>
                <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm">Mettre à jour</button>
              </form>
              <form action={deleteAdminTournament}>
                <input type="hidden" name="id" value={tournament.id} />
                <button className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-2 text-xs">Supprimer</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
