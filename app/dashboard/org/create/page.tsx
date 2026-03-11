"use client";

import { useActionState, useEffect, useState } from "react";
import { createOrganization } from "@/lib/actions/organization/organization.actions";
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
    ImageIcon
} from "lucide-react";
import { OrgType } from "@prisma/client";

export default function CreateOrganisationPage() {
    // Initialisation du hook useActionState avec ton action serveur
    const [state, formAction, isPending] = useActionState(createOrganization, {
        message: "",
        errors: {}
    });

    // États locaux pour la gestion dynamique du slug
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");

    // Génère automatiquement un slug à partir du nom
    useEffect(() => {
        const generatedSlug = name
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, "") // Enlever les caractères spéciaux
            .replace(/[\s_-]+/g, "-") // Remplacer les espaces et underscores par des tirets
            .replace(/^-+|-+$/g, ""); // Nettoyer les tirets aux extrémités
        setSlug(generatedSlug);
    }, [name]);

    // Transformation de l'enum Prisma OrgType en options pour le select
    // On transforme ["SPORT", "ESPORT", ...] en [{value: "SPORT", label: "Sport"}, ...]
    const typeOptions = Object.values(OrgType).map((type) => ({
        value: type,
        label: type.charAt(0) + type.slice(1).toLowerCase(),
    }));

    return (
        <div className="min-h-screen bg-[#05070a] flex items-center justify-center p-6">
            <FormContainer
                title="Configuration"
                subtitle="Créez votre espace de compétition"
                action={formAction}
            >
                {/* Nom de l'organisation */}
                <FormField
                    label="Nom de l'organisation"
                    icon={Trophy}
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="ex: Vortex Esport"
                    error={state?.errors?.name}
                    required
                />

                {/* Slug (ID unique dans l'URL) */}
                <FormField
                    label="Slug (URL unique)"
                    icon={LinkIcon}
                    name="slug"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="vortex-esport"
                    error={state?.errors?.slug}
                    required
                />

                {/* Type d'organisation (Enum Prisma) */}
                <FormSelect
                    label="Type de structure"
                    icon={Type}
                    name="type"
                    options={typeOptions}
                    defaultValue={OrgType.ESPORT} // Défaut sur Esport
                    error={state?.errors?.type}
                />

                {/* URL du Logo */}
                <FormField
                    label="URL du Logo"
                    icon={ImageIcon}
                    name="logoUrl"
                    placeholder="https://imgur.com/votre-logo.png"
                    error={state?.errors?.logoUrl}
                />

                {/* Message d'erreur global ou succès */}
                <FormStatus state={state} />

                {/* Bouton de soumission */}
                <FormButton isPending={isPending} icon={Send}>
                    Créer l'organisation
                </FormButton>
            </FormContainer>
        </div>
    );
}