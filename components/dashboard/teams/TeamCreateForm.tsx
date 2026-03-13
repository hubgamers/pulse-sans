"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { createTeam, type TeamFormState } from "@/lib/actions/team/team.actions";
import { Link as LinkIcon, Shield, ImageIcon, Save } from "lucide-react";

type Props = {
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

const FieldError = ({ error }: { error?: string[] }) => {
    if (!error || error.length === 0) return null;
    return <p className="mt-1 text-xs text-red-400">{error[0]}</p>;
};

export default function TeamCreateForm({ organizationId, organizationName, orgSlug }: Props) {
    const [state, formAction, isPending] = useActionState(createTeam, initialState);
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugEdited, setSlugEdited] = useState(false);

    const onNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setName(value);
        if (!slugEdited) setSlug(slugify(value));
    };

    const onSlugChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSlug(e.target.value);
        setSlugEdited(true);
    };

    return (
        <div className="space-y-6 text-white">
            <div>
                <p className="text-xs uppercase tracking-widest text-slate-400">{organizationName}</p>
                <h1 className="text-2xl md:text-3xl font-black">Creer une equipe</h1>
                <p className="mt-2 text-sm text-slate-400">Ajoute une nouvelle equipe a ton organisation.</p>
            </div>

            <form action={formAction} className="space-y-5 rounded-2xl border border-slate-800 bg-slate-950/60 p-5 md:p-7">
                <input type="hidden" name="organizationId" value={organizationId} />

                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                            <Shield size={14} /> Nom de l&apos;equipe
                        </label>
                        <input
                            name="name"
                            value={name}
                            onChange={onNameChange}
                            required
                            placeholder="Thunder Wolves"
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <FieldError error={state.errors?.name} />
                    </div>

                    <div>
                        <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                            <LinkIcon size={14} /> Slug
                        </label>
                        <input
                            name="slug"
                            value={slug}
                            onChange={onSlugChange}
                            required
                            placeholder="thunder-wolves"
                            className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                        />
                        <p className="mt-1 text-xs text-slate-500">URL: /dashboard/org/{orgSlug}/teams/{slug || "..."}</p>
                        <FieldError error={state.errors?.slug} />
                    </div>
                </div>

                <div>
                    <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-400">
                        <ImageIcon size={14} /> Logo URL (optionnel)
                    </label>
                    <input
                        name="logoUrl"
                        placeholder="https://cdn.example.com/team-logo.png"
                        className="w-full rounded-xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm focus:border-indigo-500 focus:outline-none"
                    />
                    <FieldError error={state.errors?.logoUrl} />
                </div>

                {state.message && (
                    <div
                        className={`rounded-xl border px-4 py-3 text-sm ${state.success
                                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                                : "border-red-500/30 bg-red-500/10 text-red-300"
                            }`}
                    >
                        {state.message}
                    </div>
                )}

                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <button
                        type="submit"
                        disabled={isPending}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold hover:bg-indigo-500 transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <Save size={15} /> {isPending ? "Creation..." : "Creer l'equipe"}
                    </button>

                    <a
                        href={`/dashboard/org/${orgSlug}/teams`}
                        className="inline-flex items-center justify-center rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold hover:bg-slate-900/60"
                    >
                        Retour aux equipes
                    </a>
                </div>
            </form>
        </div>
    );
}
