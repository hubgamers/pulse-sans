"use client";

import { useActionState } from "react";
import type { AddOrganizationMemberState } from "@/lib/actions/organization/organization.actions";
import { inviteOrganizationMember } from "@/lib/actions/organization/organization.actions";
import { Shield, UserPlus, Users2 } from "lucide-react";
import { Badge, Button, Card, EmptyState, Field, FieldError, Input, Label, Select } from "@/components/ui";

type MemberRow = {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    username: string;
    display_name: string;
  };
};

type InvitationRow = {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  expiresAt: string;
  invitedByName: string | null;
};

type Props = {
  organizationId: string;
  organizationName: string;
  orgSlug: string;
  canManageMembers: boolean;
  members: MemberRow[];
  invitations: InvitationRow[];
};

const initialState: AddOrganizationMemberState = {
  success: false,
  message: "",
  errors: {},
};

const roleOptions = [
  { value: "MEMBER", label: "Membre" },
  { value: "REFEREE", label: "Arbitre" },
  { value: "MODERATOR", label: "Moderateur" },
  { value: "ADMIN", label: "Admin" },
] as const;

export default function OrganizationMembersSettings({
  organizationId,
  organizationName,
  orgSlug,
  canManageMembers,
  members,
  invitations,
}: Props) {
  const [state, formAction, isPending] = useActionState(inviteOrganizationMember, initialState);

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{organizationName}</p>
          <h1 className="text-2xl font-black md:text-3xl">Configuration des acces</h1>
          <p className="mt-2 text-sm text-slate-500">Ajoutez des membres a votre organisation et definissez leur role.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <Card className="bg-slate-50">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Users2 size={18} />
            <span>{members.length} membre(s) avec acces</span>
          </div>

          {members.length === 0 ? (
            <EmptyState title="Aucun membre pour le moment." className="bg-white p-5" />
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3">
                  <div>
                    <p className="font-semibold">{member.user.display_name || member.user.username || "Utilisateur"}</p>
                    <p className="text-xs text-slate-500">@{member.user.username || "profil"}</p>
                  </div>
                  <Badge variant="info">
                    <Shield size={12} /> {member.role}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 text-lg font-bold">Inviter un membre</h2>
          <p className="mb-4 text-sm text-slate-500">Creez une invitation par email avec un role defini. Elle reste valable 14 jours.</p>

          {!canManageMembers && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Seuls les roles OWNER et ADMIN peuvent ajouter des membres.
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="orgSlug" value={orgSlug} />

            <Field>
              <Label>Email</Label>
              <Input
                name="email"
                placeholder="ex: alexi@hubgamers.gg"
                type="email"
                required
                disabled={!canManageMembers || isPending}
              />
              {(state.errors?.email?.[0] || state.errors?.identifier?.[0]) && (
                <FieldError>{state.errors.email?.[0] || state.errors.identifier?.[0]}</FieldError>
              )}
            </Field>

            <Field>
              <Label>Role</Label>
              <Select
                name="role"
                defaultValue="MEMBER"
                disabled={!canManageMembers || isPending}
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {state.errors?.role?.[0] && <FieldError>{state.errors.role[0]}</FieldError>}
            </Field>

            {state.message && (
              <div
                className={"rounded-lg border px-4 py-3 text-sm " +
                  (state.success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700")}
              >
                {state.message}
              </div>
            )}

            <Button
              type="submit"
              disabled={!canManageMembers || isPending}
              icon={<UserPlus size={15} />}
            >
              {isPending ? "Invitation..." : "Inviter le membre"}
            </Button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">Invitations en attente</h3>
              <span className="text-xs text-slate-500">{invitations.length}</span>
            </div>

            {invitations.length === 0 ? (
              <EmptyState title="Aucune invitation en attente." className="p-4 text-left" />
            ) : (
              <div className="space-y-2">
                {invitations.map((invitation) => (
                  <div key={invitation.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{invitation.email}</p>
                        <p className="text-xs text-slate-500">
                          Expire le {new Date(invitation.expiresAt).toLocaleDateString("fr-FR")}
                          {invitation.invitedByName ? ` - par ${invitation.invitedByName}` : ""}
                        </p>
                      </div>
                      <Badge variant="info" className="shrink-0">
                        <Shield size={12} /> {invitation.role}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
