"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageIcon, Link as LinkIcon, Save, Shield } from "lucide-react";
import { updateTeam, type TeamFormState } from "@/lib/actions/team/team.actions";
import { createClient } from "@/lib/supabase/client";
import { buttonClassName, Button, Card, Field, FieldError, Input, Label } from "@/components/ui";

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
  const [logoPreview, setLogoPreview] = useState(initialLogoUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const onNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setName(value);
    if (!slugEdited) setSlug(slugify(value));
  };

  const onSlugChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSlug(event.target.value);
    setSlugEdited(true);
  };

  const onLogoChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"];
    if (!allowedTypes.includes(file.type)) {
      setUploadError("Format non supporte. Utilisez PNG, JPEG, WEBP, SVG ou GIF.");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setUploadError("Le fichier doit faire moins de 2 Mo.");
      return;
    }

    setUploadError("");
    setUploading(true);
    setLogoPreview(URL.createObjectURL(file));

    const supabase = createClient();
    const ext = file.name.split(".").pop();
    const path = `teams/${organizationId}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("logos").upload(path, file, { upsert: true });

    if (error) {
      setUploadError(
        error.message.toLowerCase().includes("row-level security")
          ? "Upload bloque par la policy Supabase Storage (RLS). Voir la configuration SQL du bucket logos."
          : `Erreur lors de l upload : ${error.message}`,
      );
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from("logos").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    setUploading(false);
  };

  return (
    <div className="space-y-6 text-slate-900">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">{organizationName}</p>
        <h1 className="text-2xl font-black md:text-3xl">Modifier une equipe</h1>
        <p className="mt-2 text-sm text-slate-500">Mets a jour les informations de ton equipe.</p>
      </div>

      <Card className="p-5 md:p-7">
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

          <Field>
            <Label className="inline-flex items-center gap-2">
              <ImageIcon size={14} /> Logo (optionnel)
            </Label>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-500 transition hover:border-teal-500 hover:bg-teal-50/30">
              {logoPreview ? (
                <Image src={logoPreview} alt="Preview logo" width={80} height={80} className="h-20 w-20 rounded-lg object-contain" unoptimized />
              ) : (
                <ImageIcon size={32} className="text-slate-300" />
              )}
              <span>{uploading ? "Upload en cours..." : logoPreview ? "Changer le logo" : "Cliquer pour importer"}</span>
              <span className="text-xs text-slate-400">PNG, JPEG, WEBP, SVG - max 2 Mo</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                onChange={onLogoChange}
                disabled={uploading || isPending}
                className="hidden"
              />
            </label>
            {uploadError && <FieldError>{uploadError}</FieldError>}
            <FormFieldError error={state.errors?.logoUrl} />
          </Field>

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
            <Button type="submit" disabled={isPending || uploading} icon={<Save size={15} />}>
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
