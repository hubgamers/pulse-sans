import OrganizationMembersSettings from "@/components/dashboard/organization/OrganizationMembersSettings";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries";
import { getAuthUser } from "@/lib/actions/utils.actions";

export default async function DashboardOrgSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [org, authUser] = await Promise.all([getOrganizationBySlug(slug), getAuthUser()]);

  if (!org) {
    return <div className="text-slate-700">Organisation introuvable.</div>;
  }

  const myMembership = org.members.find((member) => member.userId === authUser.id);
  const canManageMembers = myMembership ? ["OWNER", "ADMIN"].includes(myMembership.role) : false;

  const members = org.members.map((member) => ({
    id: member.id,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
    user: {
      username: member.user.username || "",
      display_name: member.user.display_name || "",
    },
  }));

  return (
    <OrganizationMembersSettings
      organizationId={org.id}
      organizationName={org.name}
      orgSlug={slug}
      canManageMembers={canManageMembers}
      members={members}
    />
  );
}
