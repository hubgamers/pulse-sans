import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Building2, ArrowRight } from "lucide-react";
import { OrgType } from "@prisma/client";
import {
  createAdminOrganization,
  deleteAdminOrganization,
  updateAdminOrganization,
} from "@/lib/actions/admin/crud.actions";

export default async function AdminOrganizationsPage() {
  const owners = await prisma.user.findMany({
    select: { id: true, username: true, display_name: true },
    take: 100,
    orderBy: { createdAt: "desc" },
  });

  const organizations = await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      name: true,
      slug: true,
      type: true,
      logoUrl: true,
      ownerId: true,
      createdAt: true,
      owner: {
        select: {
          username: true,
          display_name: true,
        },
      },
      _count: {
        select: {
          members: true,
          teams: true,
          tournaments: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Admin Organizations</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black">Gestion des organisations</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold mb-3">Créer une organisation</h2>
        <form action={createAdminOrganization} className="grid gap-2 md:grid-cols-6">
          <input name="name" required placeholder="Nom" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="slug" required placeholder="slug" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="type" defaultValue={OrgType.MIXED} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value={OrgType.SPORT}>SPORT</option>
            <option value={OrgType.ESPORT}>ESPORT</option>
            <option value={OrgType.MIXED}>MIXED</option>
          </select>
          <input name="logoUrl" placeholder="logo URL" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="ownerId" required className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">Owner</option>
            {owners.map((owner) => (
              <option key={owner.id} value={owner.id}>
                {owner.display_name} (@{owner.username})
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm font-semibold">Créer</button>
        </form>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-slate-700">
          <Building2 size={16} />
          <span>{organizations.length} organisations</span>
        </div>
        <div className="divide-y divide-slate-800">
          {organizations.map((org) => (
            <div key={org.id} className="flex flex-col gap-2 px-4 py-3">
              <form action={updateAdminOrganization} className="grid gap-2 md:grid-cols-8">
                <input type="hidden" name="id" value={org.id} />
                <input name="name" defaultValue={org.name} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <input name="slug" defaultValue={org.slug} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select name="type" defaultValue={org.type} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value={OrgType.SPORT}>SPORT</option>
                  <option value={OrgType.ESPORT}>ESPORT</option>
                  <option value={OrgType.MIXED}>MIXED</option>
                </select>
                <input name="logoUrl" defaultValue={org.logoUrl || ""} placeholder="logo URL" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                <select name="ownerId" required defaultValue={org.ownerId} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                  <option value="">Owner</option>
                  {owners.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.display_name} (@{owner.username})
                    </option>
                  ))}
                </select>
                <div className="text-xs text-slate-500 flex items-center gap-2 md:col-span-2">
                  <span>M: {org._count.members}</span>
                  <span>E: {org._count.teams}</span>
                  <span>T: {org._count.tournaments}</span>
                  <span>{new Date(org.createdAt).toLocaleDateString("fr-FR")}</span>
                  <Link href={`/dashboard/org/${org.slug}`} className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-700">
                    Ouvrir <ArrowRight size={12} />
                  </Link>
                </div>
                <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm">Mettre à jour</button>
              </form>
              <form action={deleteAdminOrganization}>
                <input type="hidden" name="id" value={org.id} />
                <button className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-2 text-xs">Supprimer</button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
