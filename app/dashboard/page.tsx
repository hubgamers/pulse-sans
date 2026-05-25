"use client";

import Link from "next/link";
import { Building2, Plus, Trophy } from "lucide-react";
import OrganizationList from "@/components/dashboard/OrganizationList";
import { buttonClassName, Card, CardDescription, CardHeader, CardTitle } from "@/components/ui";

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-transparent p-6 text-slate-800 md:p-8">
      <section className="mx-auto max-w-7xl space-y-8">
        <Card className="p-6 md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.15em] text-teal-700">HubGamers</p>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Pilotez vos organisations et competitions
              </h1>
              <CardDescription className="mt-3 max-w-2xl">
                Centralisez vos structures, suivez vos equipes, et accedez rapidement aux actions essentielles de votre SaaS esport.
              </CardDescription>
            </div>

            <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-3 md:w-auto">
              <Link href="/dashboard/org/create" className={buttonClassName({ size: "lg" })}>
                <Plus size={16} /> Nouvelle org
              </Link>
              <Link href="/dashboard/orgs" className={buttonClassName({ variant: "secondary", size: "lg" })}>
                <Building2 size={16} /> Mes orgs
              </Link>
              <Link href="/dashboard" className={buttonClassName({ variant: "secondary", size: "lg" })}>
                <Trophy size={16} /> Vue tournois
              </Link>
            </div>
          </div>
        </Card>

        <Card className="p-5 md:p-7">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <CardTitle>Espace organisations</CardTitle>
            <Link href="/dashboard/org/create" className="text-sm font-semibold text-teal-700 hover:text-teal-600">
              Creer maintenant
            </Link>
          </CardHeader>
          <OrganizationList />
        </Card>
      </section>
    </div>
  );
}
