"use client";

import { useActionState, useState, type ChangeEvent } from "react";
import { createOrganization, type FormState } from "@/lib/actions/organization/organization.actions";
import {
    FormButton,
    FormContainer,
    FormField,
    FormSelect,
    FormStatus
} from "@/components/dashboard/FormContainer";
import {
    Send,
    Trophy,
    Type,
    Link as LinkIcon,
    ImageIcon,
    Fingerprint,
    Globe
} from "lucide-react";
import { OrgType } from "@prisma/client";

const slugify = (value: string) =>
    value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-")
        .replace(/^-+|-+$/g, "");

export default function CreateOrganisationPage() {
    const [state, formAction, isPending] = useActionState(createOrganization, {
        success: false,
        message: "",
        errors: {}
    } as FormState);

    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [slugEdited, setSlugEdited] = useState(false);

    const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const nextName = e.target.value;
        setName(nextName);
        if (!slugEdited) {
            setSlug(slugify(nextName));
        }
    };

    const handleSlugChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSlug(e.target.value);
        setSlugEdited(true);
    };

    const typeOptions = Object.values(OrgType).map((type) => ({
        value: type,
        label: type.charAt(0) + type.slice(1).toLowerCase(),
    }));

    return (
        <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-4">
            <FormContainer
                title="Configuration"
                subtitle="Paramétrez l'identité de votre structure"
                action={formAction}
            >
                <div className="space-y-8">
                    {/* SECTION 1 : NOM & TYPE */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <FormField
                            label="Nom de l'organisation"
                            icon={Trophy}
                            name="name"
                            value={name}
                            onChange={handleNameChange}
                            placeholder="ex: Vortex Esport"
                            error={state?.errors?.name}
                            required
                        />

                        <FormSelect
                            label="Type de structure"
                            icon={Type}
                            name="type"
                            options={typeOptions}
                            defaultValue={OrgType.ESPORT}
                            error={state?.errors?.type}
                        />
                    </div>

                    {/* SECTION 2 : SLUG */}
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-gradient-to-r from-indigo-500/10 to-transparent rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity" />
                        <div className="relative p-5 rounded-2xl bg-slate-900/40 border border-slate-800/50 space-y-4">
                            <div className="flex items-center gap-2 text-indigo-400">
                                <Fingerprint size={16} className="animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">Identifiant Unique</span>
                            </div>

                            <FormField
                                label="URL personnalisée (Slug)"
                                icon={LinkIcon}
                                name="slug"
                                value={slug}
                                onChange={handleSlugChange}
                                placeholder="vortex-esport"
                                error={state?.errors?.slug}
                                required
                            />

                            <div className="flex items-center gap-2 px-1 text-slate-500">
                                <Globe size={12} />
                                <p className="text-[10px] font-medium italic">
                                    Aperçu : <span className="text-indigo-400/80 underline decoration-indigo-500/20 underline-offset-4 tracking-tight">app.tournoi.com/org/{slug || "..."}</span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* SECTION 3 : LOGO */}
                    <FormField
                        label="Lien du logo"
                        icon={ImageIcon}
                        name="logoUrl"
                        placeholder="https://image.com/logo.png"
                        error={state?.errors?.logoUrl}
                    />

                    {/* ACTIONS */}
                    <div className="pt-4 border-t border-slate-800/50 space-y-4">
                        <FormStatus state={state} />

                        <FormButton isPending={isPending} icon={Send}>
                            Lancer la structure
                        </FormButton>
                    </div>
                </div>
            </FormContainer>
        </div>
    );
}