"use client";

import { useEffect, useState } from "react";
import { getUserOrganizations } from "@/lib/actions/organization/organization.queries";
import { Building2, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

// On définit le type basé sur ton modèle Prisma
interface Organization {
    id: string;
    name: string;
    slug: string;
    logoUrl: string | null;
    type: string;
}

export default function OrganizationList() {
    const [orgs, setOrgs] = useState<Organization[]>([]);
    const [loading, setLoading] = useState(true);

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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-white">Mes Organisations</h2>
                <button className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors">
                    <Plus size={16} />
                    Créer
                </button>
            </div>

            {orgs.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-white/10 p-12 text-center">
                    <Building2 className="mb-4 text-white/20" size={48} />
                    <p className="text-white/60">Vous ne faites partie d&apos;aucune organisation.</p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {orgs.map((org) => (
                        <Link
                            key={org.id}
                            href={`/dashboard/org/${org.slug}`}
                            className="group relative flex items-center justify-between overflow-hidden rounded-xl border border-white/10 bg-white/5 p-4 transition-all hover:bg-white/10"
                        >
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400">
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
                                    <h3 className="font-medium text-white">{org.name}</h3>
                                    <p className="text-xs text-white/40 uppercase tracking-wider">{org.type}</p>
                                </div>
                            </div>
                            <ArrowRight size={18} className="text-white/20 transition-transform group-hover:translate-x-1 group-hover:text-white" />
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}