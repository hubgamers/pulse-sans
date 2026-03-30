"use client";

import { useActionState } from "react";
import type { AddOrganizationMemberState } from "@/lib/actions/organization/organization.actions";
import { addOrganizationMember } from "@/lib/actions/organization/organization.actions";
import { Shield, UserPlus, Users2 } from "lucide-react";

type MemberRow = {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    username: string;
    display_name: string;
  };
};

type Props = {
  organizationId: string;
  organizationName: string;
  orgSlug: string;
  canManageMembers: boolean;
  members: MemberRow[];
};

const initialState: AddOrganizationMemberState = {
  success: false,
  message: "",
  errors: {},
};

const roleOptions = [
  { value: "MEMBER", label: "Membre" },
  { value: "MODERATOR", label: "Moderateur" },
  { value: "ADMIN", label: "Admin" },
] as const;

export default function OrganizationMembersSettings({
  organizationId,
  organizationName,
  orgSlug,
  canManageMembers,
  members,
}: Props) {
  const [state, formAction, isPending] = useActionState(addOrganizationMember, initialState);

  return (
    <div className="space-y-6 text-slate-900">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-slate-500">{organizationName}</p>
          <h1 className="text-2xl font-black md:text-3xl">Configuration des acces</h1>
          <p className="mt-2 text-sm text-slate-500">Ajoutez des membres a l'organisation et definissez leur role.</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-4 flex items-center gap-2 text-slate-700">
            <Users2 size={18} />
            <span>{members.length} membre(s) avec acces</span>
          </div>

          {members.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">
              Aucun membre pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {members.map((member) => (
                <div key={member.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3">
                  <div>
                    <p className="font-semibold">{member.user.display_name || member.user.username || "Utilisateur"}</p>
                    <p className="text-xs text-slate-500">@{member.user.username || "profil"}</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full border border-teal-300 bg-teal-50 px-2 py-1 text-[10px] font-semibold uppercase text-teal-700">
                    <Shield size={12} /> {member.role}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 text-lg font-bold">Ajouter un membre</h2>
          <p className="mb-4 text-sm text-slate-500">Saisissez son email (ou son pseudo) pour le retrouver plus facilement.</p>

          {!canManageMembers && (
            <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Seuls les roles OWNER et ADMIN peuvent ajouter des membres.
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="organizationId" value={organizationId} />
            <input type="hidden" name="orgSlug" value={orgSlug} />

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Email ou pseudo</label>
              <input
                name="identifier"
                placeholder="ex: alexi@hubgamers.gg"
                required
                disabled={!canManageMembers || isPending}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              />
              {state.errors?.identifier?.[0] && <p className="mt-1 text-xs text-red-500">{state.errors.identifier[0]}</p>}
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-widest text-slate-500">Role</label>
              <select
                name="role"
                defaultValue="MEMBER"
                disabled={!canManageMembers || isPending}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {state.errors?.role?.[0] && <p className="mt-1 text-xs text-red-500">{state.errors.role[0]}</p>}
            </div>

            {state.message && (
              <div
                className={"rounded-xl border px-4 py-3 text-sm " +
                  (state.success
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-red-200 bg-red-50 text-red-700")}
              >
                {state.message}
              </div>
            )}

            <button
              type="submit"
              disabled={!canManageMembers || isPending}
              className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-teal-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <UserPlus size={15} /> {isPending ? "Ajout..." : "Ajouter le membre"}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
