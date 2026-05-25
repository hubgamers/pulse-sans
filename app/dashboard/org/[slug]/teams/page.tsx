import Image from "next/image";
import Link from "next/link";
import { PencilLine, Plus, Users2 } from "lucide-react";
import TeamBulkImporter from "@/components/dashboard/teams/TeamBulkImporter";
import { buttonClassName, Card, EmptyState } from "@/components/ui";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries";

export default async function DashboardOrgTeams({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);

  if (!org) {
    return <div className="text-slate-700">Organisation introuvable.</div>;
  }

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{org.name}</p>
          <h1 className="text-2xl font-black md:text-3xl">Equipes de l&apos;organisation</h1>
        </div>
        <Link href={`/dashboard/org/${slug}/teams/create`} className={buttonClassName()}>
          <Plus size={16} /> Creer une equipe
        </Link>
      </div>

      <TeamBulkImporter organizationId={org.id} />

      {org.teams.length === 0 ? (
        <EmptyState title="Aucune equipe pour le moment." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {org.teams.map((team) => (
            <Card key={team.id} className="flex items-center gap-4 p-4">
              {team.logoUrl ? (
                <Image
                  src={team.logoUrl}
                  alt={`${team.name} logo`}
                  width={48}
                  height={48}
                  className="h-12 w-12 flex-shrink-0 rounded-lg border border-slate-100 object-contain"
                  unoptimized
                />
              ) : (
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-100">
                  <Users2 size={20} className="text-slate-400" />
                </div>
              )}
              <div>
                <p className="text-lg font-bold">{team.name}</p>
                <p className="mt-0.5 text-xs text-slate-500">/{team.slug}</p>
                <Link
                  href={`/dashboard/org/${slug}/teams/${team.slug}/edit`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-600"
                >
                  <PencilLine size={12} /> Modifier
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
