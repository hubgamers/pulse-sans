import { prisma } from "@/lib/prisma";
import { Shield, Users2 } from "lucide-react";
import { Role } from "@prisma/client";
import { createAdminUser, deleteAdminUser, updateAdminUser } from "@/lib/actions/admin/crud.actions";

export default async function AdminUsersPage() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      username: true,
      display_name: true,
      country: true,
      roles: true,
      createdAt: true,
      _count: {
        select: {
          orgs: true,
          players: true,
        },
      },
    },
  });

  const adminCount = users.filter((u) => u.roles.includes("ADMIN")).length;

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Admin Users</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black">Gestion des utilisateurs</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Utilisateurs listés</p>
          <p className="mt-2 text-3xl font-black">{users.length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Admins</p>
          <p className="mt-2 text-3xl font-black">{adminCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Membres standard</p>
          <p className="mt-2 text-3xl font-black">{users.length - adminCount}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold mb-3">Créer un utilisateur (profil interne)</h2>
        <form action={createAdminUser} className="grid gap-2 md:grid-cols-5">
          <input name="username" required placeholder="username" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="display_name" required placeholder="Nom affiché" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="country" placeholder="Pays" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="role" defaultValue={Role.USER} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value={Role.USER}>USER</option>
            <option value={Role.ADMIN}>ADMIN</option>
          </select>
          <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm font-semibold">Créer</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-slate-700">
          <Users2 size={16} />
          <span>Derniers utilisateurs</span>
        </div>
        <div className="divide-y divide-slate-800">
          {users.map((user) => (
            <div key={user.id} className="flex flex-col gap-2 px-4 py-3">
              <form action={updateAdminUser} className="grid gap-2 md:grid-cols-7">
                <input type="hidden" name="id" value={user.id} />
                <div className="md:col-span-2">
                  <p className="font-semibold">@{user.username}</p>
                  <p className="text-xs text-slate-500">Créé le {new Date(user.createdAt).toLocaleDateString("fr-FR")}</p>
                </div>
                <input name="display_name" defaultValue={user.display_name} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input name="country" defaultValue={user.country || ""} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select
                  name="role"
                  defaultValue={user.roles.includes(Role.ADMIN) ? Role.ADMIN : Role.USER}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value={Role.USER}>USER</option>
                  <option value={Role.ADMIN}>ADMIN</option>
                </select>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>Orgs: {user._count.orgs}</span>
                  <span>Players: {user._count.players}</span>
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2 py-1 uppercase text-teal-700">
                    <Shield size={12} /> {user.roles.join(", ") || "USER"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm">Mettre à jour</button>
                </div>
              </form>
              <form action={deleteAdminUser}>
                <input type="hidden" name="id" value={user.id} />
                <button className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-2 text-xs">Supprimer</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
