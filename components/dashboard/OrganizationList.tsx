"use client";

import { useEffect, useState } from "react";
import { getUserOrganizations } from "@/lib/actions/organization/organization.queries";
import { Building2, Plus, ArrowRight, Search, Users2, Shield, Trophy } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

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
                    <div key={i} className="h-32 animate-pulse rounded-xl bg-white/5" />
                ))}
            </div>
        );
    }

    const filtered = orgs
        .filter((org) =>
            org.name.toLowerCase().includes(query.toLowerCase()) ||
            org.slug.toLowerCase().includes(query.toLowerCase())
        )
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
        { members: 0, teams: 0, tournaments: 0 }
    );

    return (
        <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Membres cumulés</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{totals.members}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Équipes actives</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{totals.teams}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Tournois gérés</p>
                    <p className="mt-2 text-2xl font-black text-slate-900">{totals.tournaments}</p>
                </div>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative w-full md:max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher une organisation"
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 px-10 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-teal-600 focus:outline-none"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as "name" | "members" | "teams")}
                        className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
                    >
                        <option value="name">Tri: Nom</option>
                        <option value="members">Tri: Membres</option>
                        <option value="teams">Tri: Équipes</option>
                    </select>

                    <Link href="/dashboard/org/create" className="flex items-center gap-2 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-medium text-slate-900 hover:bg-teal-600 transition-colors">
                        <Plus size={16} />
                        Créer
                    </Link>
                </div>
            </div>

            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">Mes Organisations ({filtered.length})</h2>
                <span className="text-xs text-slate-500">Accès rapide à vos espaces</span>
            </div>

            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-12 text-center">
                    <Building2 className="mb-4 text-slate-900/20" size={48} />
                    <p className="text-slate-900/60">Aucun résultat pour cette recherche.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filtered.map((org) => (
                        <Link
                            key={org.id}
                            href={`/dashboard/org/${org.slug}`}
                            className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
                        >
                            <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="flex items-center gap-4">
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal-600/20 text-teal-700">
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
                                        <h3 className="font-medium text-slate-900">{org.name}</h3>
                                        <p className="text-xs text-slate-900/40 uppercase tracking-wider">{org.type}</p>
                                    </div>
                                </div>
                                <ArrowRight size={18} className="text-slate-900/20 transition-transform group-hover:translate-x-1 group-hover:text-slate-900" />
                            </div>

                            <div className="mb-3 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2 py-1 text-[10px] font-semibold uppercase text-teal-700">
                                    <Shield size={12} /> {org.userRole}
                                </span>
                            </div>

                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="rounded-lg bg-slate-50/80 p-2 text-center text-slate-700">
                                    <Users2 className="mx-auto mb-1" size={14} />
                                    {org._count.members}
                                </div>
                                <div className="rounded-lg bg-slate-50/80 p-2 text-center text-slate-700">
                                    <Building2 className="mx-auto mb-1" size={14} />
                                    {org._count.teams}
                                </div>
                                <div className="rounded-lg bg-slate-50/80 p-2 text-center text-slate-700">
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