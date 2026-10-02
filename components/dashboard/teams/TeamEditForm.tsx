"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import Link from "next/link";
import { Link as LinkIcon, Save, Shield } from "lucide-react";
import { updateTeam, type TeamFormState } from "@/lib/actions/team/team.actions";
import { buttonClassName, Button, Card, Field, FieldError, Input, Label } from "@/components/ui";
import TeamLogoPicker from "@/components/dashboard/teams/TeamLogoPicker";

type Props = {
  teamId: string;
  initialName: string;
  initialSlug: string;
  initialLogoUrl: string | null;
  organizationId: string;
  organizationName: string;
  orgSlug: string;
};

const initialState: TeamFormState = {
  success: false,
  message: "",
  errors: {},
};

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");

function FormFieldError({ error }: { error?: string[] }) {
  if (!error || error.length === 0) return null;
  return <FieldError>{error[0]}</FieldError>;
}

export default function TeamEditForm({
  teamId,
  initialName,
  initialSlug,
  initialLogoUrl,
  organizationId,
  organizationName,
  orgSlug,
}: Props) {
  const [state, formAction, isPending] = useActionState(updateTeam, initialState);
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [slugEdited, setSlugEdited] = useState(false);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl ?? "");

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const onSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSlug(event.target.value);
    setSlugEdited(true);
  };

  return (
    <div className="space-y-6 text-slate-900">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">{organizationName}</p>
        <h1 className="text-2xl font-black md:text-3xl">Modifier une equipe</h1>
        <p className="mt-2 text-sm text-slate-500">Mets a jour les informations de ton equipe.</p>
      </div>

      <Card className="p-5 md:p-7 ">
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="teamId" value={teamId} />
          <input type="hidden" name="organizationId" value={organizationId} />
          <input type="hidden" name="orgSlug" value={orgSlug} />
          <input type="hidden" name="logoUrl" value={logoUrl} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field>
              <Label className="inline-flex items-center gap-2">
                <Shield size={14} /> Nom de l&apos;equipe
              </Label>
              <Input name="name" value={name} onChange={onNameChange} required placeholder="Thunder Wolves" />
              <FormFieldError error={state.errors?.name} />
            </Field>

            <Field>
              <Label className="inline-flex items-center gap-2">
                <LinkIcon size={14} /> Slug
              </Label>
              <Input name="slug" value={slug} onChange={onSlugChange} required placeholder="thunder-wolves" />
              <p className="text-xs text-slate-500">URL: /dashboard/org/{orgSlug}/teams/{slug || "..."}</p>
              <FormFieldError error={state.errors?.slug} />
            </Field>
          </div>

          <TeamLogoPicker organizationId={organizationId} value={logoUrl} onChange={setLogoUrl} disabled={isPending} />
          <FormFieldError error={state.errors?.logoUrl} />

          {state.message && (
            <div
              className={
                "rounded-lg border px-4 py-3 text-sm " +
                (state.success ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700")
              }
            >
              {state.message}
            </div>
          )}

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Button type="submit" disabled={isPending} icon={<Save size={15} />}>
              {isPending ? "Mise a jour..." : "Enregistrer"}
            </Button>

            <Link href={`/dashboard/org/${orgSlug}/teams`} className={buttonClassName({ variant: "secondary" })}>
              Retour aux equipes
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
