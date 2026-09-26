import OrganizationMediaLibrary from "@/components/dashboard/organization/OrganizationMediaLibrary";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries";

export default async function DashboardOrgMediaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const org = await getOrganizationBySlug(slug);

  if (!org) {
    return <div className="text-slate-700">Organisation introuvable.</div>;
  }

  return <OrganizationMediaLibrary organizationId={org.id} organizationName={org.name} />;
}
