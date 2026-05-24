import { acceptOrganizationInvitation } from "@/lib/actions/organization/organization.actions";
import { getAuthUser } from "@/lib/actions/utils.actions";
import { prisma } from "@/lib/prisma";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { MailCheck } from "lucide-react";

export default async function DashboardInvitationsPage() {
  const user = await getAuthUser();

  const invitations = user.email
    ? await prisma.organizationInvitation.findMany({
        where: {
          email: { equals: user.email, mode: "insensitive" },
          status: "PENDING",
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          role: true,
          token: true,
          createdAt: true,
          expiresAt: true,
          invitedByName: true,
          organization: {
            select: {
              name: true,
              slug: true,
              type: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6 text-slate-900">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">Acces organisations</p>
        <h1 className="mt-2 text-3xl font-black">Invitations</h1>
        <p className="mt-2 text-sm text-slate-500">
          Acceptez les invitations envoyees a votre email connecte pour rejoindre une organisation.
        </p>
      </div>

      {invitations.length === 0 ? (
        <EmptyState
          title="Aucune invitation en attente"
          description="Les prochaines invitations apparaitront ici."
          icon={<MailCheck size={36} />}
          className="bg-white"
        />
      ) : (
        <div className="space-y-3">
          {invitations.map((invitation) => (
            <Card key={invitation.id}>
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-bold">{invitation.organization.name}</p>
                    <Badge variant="info">{invitation.role}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Expire le {invitation.expiresAt.toLocaleDateString("fr-FR")}
                  </p>
                  {invitation.invitedByName && (
                    <p className="mt-1 text-xs text-slate-500">Invite par {invitation.invitedByName}</p>
                  )}
                </div>

                <form action={acceptOrganizationInvitation}>
                  <input type="hidden" name="token" value={invitation.token} />
                  <Button type="submit">
                    Accepter
                  </Button>
                </form>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
