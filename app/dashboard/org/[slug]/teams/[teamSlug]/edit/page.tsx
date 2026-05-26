import TeamEditForm from "@/components/dashboard/teams/TeamEditForm";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries";

export default async function DashboardOrgEditTeamPage({
    params,
}: {
    params: Promise<{ slug: string; teamSlug: string }>;
}) {
    const { slug, teamSlug } = await params;
    const org = await getOrganizationBySlug(slug);

    if (!org) {
        return <div className="text-slate-700">Organisation introuvable.</div>;
    }

    const team = org.teams.find((item) => item.slug === teamSlug);

    if (!team) {
        return <div className="text-slate-700">Equipe introuvable.</div>;
    }

    return (
        <TeamEditForm
            teamId={team.id}
            initialName={team.name}
            initialSlug={team.slug}
            initialLogoUrl={team.logoUrl}
            organizationId={org.id}
            organizationName={org.name}
            orgSlug={org.slug}
        />
    );
}
