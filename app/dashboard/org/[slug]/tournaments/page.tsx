import Link from "next/link";
import { Plus, Trophy } from "lucide-react";
import { Badge, buttonClassName, Card, EmptyState } from "@/components/ui";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries";
import { prisma } from "@/lib/prisma";

const statusVariant = {
  DRAFT: "default",
  REGISTRATION: "info",
  ONGOING: "warning",
  FINISHED: "success",
  CANCELLED: "danger",
} as const;

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
          <h1 className="text-2xl font-black md:text-3xl">Tournois de l&apos;organisation</h1>
        </div>
        <Link href={`/dashboard/org/${slug}/tournaments/create`} className={buttonClassName()}>
          <Plus size={16} /> Creer un tournoi
        </Link>
      </div>

      {tournaments.length === 0 ? (
        <EmptyState title="Aucun tournoi pour le moment." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((tournament) => (
            <Link key={tournament.id} href={`/dashboard/org/${slug}/tournaments/${tournament.slug}`}>
              <Card className="h-full p-4 transition-colors hover:bg-slate-50">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-teal-700">
                    <Trophy size={16} />
                    <Badge variant={statusVariant[tournament.status]}>{tournament.status}</Badge>
                  </div>
                </div>
                <p className="text-lg font-bold">{tournament.name}</p>
                <p className="mt-1 text-xs text-slate-500">/{tournament.slug}</p>
                <p className="mt-3 text-xs text-slate-500">
                  Mis a jour le {new Date(tournament.updatedAt).toLocaleDateString("fr-FR")}
                </p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
