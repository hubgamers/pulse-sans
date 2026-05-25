"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2, Plus, Search, Shield, Trophy, Users2 } from "lucide-react";
import { getUserOrganizations } from "@/lib/actions/organization/organization.queries";
import { Badge, buttonClassName, Card, EmptyState, Input, Select } from "@/components/ui";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  type: string;
  userRole: string;
  _count: {
    members: number;
    teams: number;
    tournaments: number;
  };
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="bg-slate-50 p-4 shadow-none">
      <p className="text-xs uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </Card>
  );
}

export default function OrganizationList() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "members" | "teams">("name");

  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const data = await getUserOrganizations();
        setOrgs(data || []);
      } catch (error) {
        console.error("Failed to fetch orgs:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchOrgs();
  }, []);

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-lg border border-slate-200 bg-slate-50" />
        ))}
      </div>
    );
  }

  const filtered = orgs
    .filter((org) => org.name.toLowerCase().includes(query.toLowerCase()) || org.slug.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "members") return b._count.members - a._count.members;
      return b._count.teams - a._count.teams;
    });

  const totals = orgs.reduce(
    (acc, org) => {
      acc.members += org._count.members;
      acc.teams += org._count.teams;
      acc.tournaments += org._count.tournaments;
      return acc;
    },
    { members: 0, teams: 0, tournaments: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid gap-3 md:grid-cols-3">
        <StatTile label="Membres cumules" value={totals.members} />
        <StatTile label="Equipes actives" value={totals.teams} />
        <StatTile label="Tournois geres" value={totals.tournaments} />
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher une organisation"
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select value={sortBy} onChange={(event) => setSortBy(event.target.value as "name" | "members" | "teams")}>
            <option value="name">Tri: Nom</option>
            <option value="members">Tri: Membres</option>
            <option value="teams">Tri: Equipes</option>
          </Select>

          <Link href="/dashboard/org/create" className={buttonClassName()}>
            <Plus size={16} />
            Creer
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-slate-900">Mes organisations ({filtered.length})</h2>
        <span className="text-xs text-slate-500">Acces rapide a vos espaces</span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="Aucun resultat"
          description="Aucune organisation ne correspond a cette recherche."
          icon={<Building2 size={48} />}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((org) => (
            <Link
              key={org.id}
              href={`/dashboard/org/${org.slug}`}
              className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    {org.logoUrl ? (
                      <Image
                        src={org.logoUrl}
                        alt={org.name}
                        width={48}
                        height={48}
                        unoptimized
                        className="h-full w-full rounded-lg object-cover"
                      />
                    ) : (
                      <Building2 size={24} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{org.name}</h3>
                    <p className="text-xs uppercase tracking-wider text-slate-500">{org.type}</p>
                  </div>
                </div>
                <ArrowRight size={18} className="text-slate-300 transition-transform group-hover:translate-x-1 group-hover:text-slate-700" />
              </div>

              <div className="mb-3 flex items-center gap-2">
                <Badge variant="info">
                  <Shield size={12} /> {org.userRole}
                </Badge>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-lg bg-slate-50 p-2 text-center text-slate-700">
                  <Users2 className="mx-auto mb-1" size={14} />
                  {org._count.members}
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-center text-slate-700">
                  <Building2 className="mx-auto mb-1" size={14} />
                  {org._count.teams}
                </div>
                <div className="rounded-lg bg-slate-50 p-2 text-center text-slate-700">
                  <Trophy className="mx-auto mb-1" size={14} />
                  {org._count.tournaments}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
