import Link from "next/link";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries";
import { prisma } from "@/lib/prisma";
import { Trophy, Plus } from "lucide-react";

export default async function DashboardOrgTournaments({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const org = await getOrganizationBySlug(slug);

    if (!org) {
        return <div className="text-slate-700">Organisation introuvable.</div>;
    }

    const tournaments = await prisma.tournament.findMany({
        where: { organizationId: org.id },
        orderBy: { updatedAt: "desc" },
        select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            updatedAt: true,
        },
    });

    return (
        <div className="space-y-6 text-slate-900">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{org.name}</p>
                    <h1 className="text-2xl md:text-3xl font-black">Tournois de l&apos;organisation</h1>
                </div>
                <Link href={`/dashboard/org/${slug}/tournaments/create`} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold hover:bg-teal-600 transition">
                    <Plus size={16} /> Créer un tournoi
                </Link>
            </div>

            {tournaments.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-slate-500">
                    Aucun tournoi pour le moment.
                </div>
            ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {tournaments.map((tournament) => (
                        <Link
                            key={tournament.id}
                            href={`/dashboard/org/${slug}/tournaments/${tournament.slug}`}
                            className="rounded-xl border border-slate-200 bg-white p-4 hover:bg-white transition"
                        >
                            <div className="mb-2 flex items-center gap-2 text-amber-300">
                                <Trophy size={16} />
                                <span className="text-xs uppercase">{tournament.status}</span>
                            </div>
                            <p className="text-lg font-bold">{tournament.name}</p>
                            <p className="text-xs text-slate-500 mt-1">/{tournament.slug}</p>
                            <p className="text-xs text-slate-500 mt-3">
                                Mis à jour le {new Date(tournament.updatedAt).toLocaleDateString("fr-FR")}
                            </p>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}