"use client";
import OrganizationList from "@/components/dashboard/OrganizationList";
import Link from "next/link";
import { Building2, Plus, Trophy } from "lucide-react";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-transparent p-6 md:p-8 text-slate-800">
      <section className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-teal-700">HubGamers</p>
              <h1 className="mt-2 text-3xl md:text-4xl font-bold tracking-tight text-slate-900">Pilotez vos organisations et competitions</h1>
              <p className="mt-3 max-w-2xl text-slate-500">
                Centralisez vos structures, suivez vos équipes, et accédez rapidement aux actions essentielles de votre SaaS esport.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full md:w-auto">
              <Link href="/dashboard/org/create" className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-teal-600 transition">
                <Plus size={16} /> Nouvelle org
              </Link>
              <Link href="/dashboard/orgs" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition">
                <Building2 size={16} /> Mes orgs
              </Link>
              <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition">
                <Trophy size={16} /> Vue tournois
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 md:p-7 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Espace organisations</h2>
            <Link href="/dashboard/org/create" className="text-sm text-teal-700 hover:text-teal-600">Creer maintenant</Link>
          </div>
          <section>
            <OrganizationList />
          </section>
        </div>
      </section>
    </div>
  );
}