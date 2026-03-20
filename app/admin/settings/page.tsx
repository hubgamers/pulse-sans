import { prisma } from "@/lib/prisma";
import { NavigationContext } from "@prisma/client";
import { Settings2 } from "lucide-react";
import { createAdminNavItem, deleteAdminNavItem, updateAdminNavItem } from "@/lib/actions/admin/crud.actions";

export default async function AdminSettingsPage() {
  const navItems = await prisma.navigationItem.findMany({
    orderBy: [{ context: "asc" }, { order: "asc" }],
    select: {
      id: true,
      name: true,
      label: true,
      href: true,
      icon: true,
      context: true,
      order: true,
      isActive: true,
      requiredRole: true,
    },
  });

  const grouped = {
    [NavigationContext.ADMIN_SaaS]: navItems.filter((i) => i.context === NavigationContext.ADMIN_SaaS),
    [NavigationContext.USER_DASHBOARD]: navItems.filter((i) => i.context === NavigationContext.USER_DASHBOARD),
    [NavigationContext.ORGANIZATION]: navItems.filter((i) => i.context === NavigationContext.ORGANIZATION),
  };

  return (
    <div className="space-y-6 text-slate-900">
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Admin Settings</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black">Paramètres de navigation</h1>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <h2 className="text-sm font-semibold mb-3">Créer un item de navigation</h2>
        <form action={createAdminNavItem} className="grid gap-2 md:grid-cols-8">
          <input name="name" required placeholder="name unique" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="label" required placeholder="label" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="href" required placeholder="/route" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input name="icon" placeholder="icon" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <input type="number" name="order" defaultValue={0} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <select name="context" defaultValue={NavigationContext.USER_DASHBOARD} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            {Object.values(NavigationContext).map((context) => (
              <option key={context} value={context}>{context}</option>
            ))}
          </select>
          <input name="requiredRole" placeholder="ADMIN/USER" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
          <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm font-semibold">Créer</button>
        </form>
      </div>

      {Object.entries(grouped).map(([context, items]) => (
        <div key={context} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 text-slate-700">
            <span className="inline-flex items-center gap-2"><Settings2 size={16} /> {context}</span>
            <span className="text-xs text-slate-500">{items.length} élément(s)</span>
          </div>
          <div className="divide-y divide-slate-800">
            {items.map((item) => (
              <div key={item.id} className="flex flex-col gap-2 px-4 py-3">
                <form action={updateAdminNavItem} className="grid gap-2 md:grid-cols-8">
                  <input type="hidden" name="id" value={item.id} />
                  <input name="label" defaultValue={item.label} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input name="href" defaultValue={item.href} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input name="icon" defaultValue={item.icon || ""} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <input type="number" name="order" defaultValue={item.order} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <select name="context" defaultValue={item.context} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    {Object.values(NavigationContext).map((ctx) => (
                      <option key={ctx} value={ctx}>{ctx}</option>
                    ))}
                  </select>
                  <input name="requiredRole" defaultValue={item.requiredRole || ""} placeholder="Role" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" />
                  <select name="isActive" defaultValue={String(item.isActive)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
                    <option value="true">Actif</option>
                    <option value="false">Inactif</option>
                  </select>
                  <button className="rounded-lg bg-teal-700 hover:bg-teal-600 px-3 py-2 text-sm">Mettre à jour</button>
                </form>
                <form action={deleteAdminNavItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button className="rounded-lg bg-rose-700 hover:bg-rose-600 px-3 py-2 text-xs">Supprimer</button>
                </form>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
