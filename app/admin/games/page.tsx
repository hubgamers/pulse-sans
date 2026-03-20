import { prisma } from "@/lib/prisma";
import { Gamepad2 } from "lucide-react";
import Link from "next/link";
import { createAdminGame, deleteAdminGame, updateAdminGame } from "@/lib/actions/admin/crud.actions";

export default async function AdminGamesPage() {
  const games = await prisma.game.findMany({
    orderBy: { updatedAt: "desc" },
    take: 100,
    select: {
      id: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: {
          tournaments: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Admin Games</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black">Catalogue des jeux</h1>
        <Link href="/admin/pitches" className="mt-3 inline-flex text-sm text-teal-700 hover:text-teal-700">
          Gérer les terrains (Pitch)
        </Link>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold mb-3">Créer un jeu</h2>
        <form action={createAdminGame} className="grid gap-2 md:grid-cols-3">
          <input name="name" required placeholder="Nom du jeu" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="logoUrl" placeholder="Logo URL" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm font-semibold">Créer</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-slate-700">
          <Gamepad2 size={16} />
          <span>{games.length} jeux</span>
        </div>
        <div className="divide-y divide-slate-800">
          {games.map((game) => (
            <div key={game.id} className="flex flex-col gap-2 px-4 py-3">
              <form action={updateAdminGame} className="grid gap-2 md:grid-cols-5">
                <input type="hidden" name="id" value={game.id} />
                <input name="name" defaultValue={game.name} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input name="logoUrl" placeholder="Logo URL" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Tournois liés: {game._count.tournaments}</span>
                  <span>Maj: {new Date(game.updatedAt).toLocaleDateString("fr-FR")}</span>
                </div>
                <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm">Mettre à jour</button>
              </form>
              <form action={deleteAdminGame}>
                <input type="hidden" name="id" value={game.id} />
                <button className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-2 text-xs">Supprimer</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
