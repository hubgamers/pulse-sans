import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Users2, ArrowRight } from "lucide-react";
import { createAdminTeam, deleteAdminTeam, updateAdminTeam } from "@/lib/actions/admin/crud.actions";

export default async function AdminTeamsPage() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const teams = await prisma.team.findMany({
    orderBy: { updatedAt: "desc" },
    take: 80,
    select: {
      id: true,
      name: true,
      slug: true,
      updatedAt: true,
      organization: {
        select: {
          slug: true,
          name: true,
        },
      },
      _count: {
        select: {
          players: true,
        },
      },
      organizationId: true,
      logoUrl: true,
    },
  });

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Admin Teams</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black">Gestion des équipes</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold mb-3">Créer une équipe</h2>
        <form action={createAdminTeam} className="grid gap-2 md:grid-cols-5">
          <input name="name" required placeholder="Nom" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="slug" required placeholder="slug" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="organizationId" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Organisation</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>{org.name}</option>
            ))}
          </select>
          <input name="logoUrl" placeholder="logo URL" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm font-semibold">Créer</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-slate-700">
          <Users2 size={16} />
          <span>{teams.length} équipes</span>
        </div>
        <div className="divide-y divide-slate-800">
          {teams.map((team) => (
            <div key={team.id} className="flex flex-col gap-2 px-4 py-3">
              <form action={updateAdminTeam} className="grid gap-2 md:grid-cols-7">
                <input type="hidden" name="id" value={team.id} />
                <input name="name" defaultValue={team.name} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input name="slug" defaultValue={team.slug} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select name="organizationId" defaultValue={team.organizationId} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>{org.name}</option>
                  ))}
                </select>
                <input name="logoUrl" defaultValue={team.logoUrl || ""} placeholder="logo URL" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Joueurs: {team._count.players}</span>
                  <span>{new Date(team.updatedAt).toLocaleDateString("fr-FR")}</span>
                  <Link href={`/dashboard/org/${team.organization.slug}/teams`} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-700">
                    Ouvrir <ArrowRight size={12} />
                  </Link>
                </div>
                <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm">Mettre à jour</button>
              </form>
              <form action={deleteAdminTeam}>
                <input type="hidden" name="id" value={team.id} />
                <button className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-2 text-xs">Supprimer</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
