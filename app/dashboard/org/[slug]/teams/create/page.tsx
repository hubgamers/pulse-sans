import TeamCreateForm from "@/components/dashboard/teams/TeamCreateForm";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries";

export default async function DashboardOrgCreateTeam({
    params,
}: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await params;
    const org = await getOrganizationBySlug(slug);

    if (!org) {
        return <div className="text-slate-700">Organisation introuvable.</div>;
    }

    return <TeamCreateForm organizationId={org.id} organizationName={org.name} orgSlug={slug} />;
}