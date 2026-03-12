"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationSchema } from "@/lib/validations/organization";
import { getAuthUser } from "../utils.actions";
import { OrgRole } from "@prisma/client";

export type FormState = {
  success?: boolean;
  message: string;
  errors?: {
    name?: string[];
    slug?: string[];
    type?: string[];
    logoUrl?: string[];
    ownerId?: string[];
  };
};

export async function createOrganization(prevState: FormState, formData: FormData): Promise<FormState> {
  // 1. Authentification
  const user = await getAuthUser();
  void prevState;
  if (!user || !user.id) {
    return {
      success: false,
      message: "Session expirée ou utilisateur introuvable. Veuillez vous reconnecter."
    };
  }

  // 2. Préparation des données pour Zod
  // On récupère les champs du formulaire et on injecte l'ownerId manuellement
  const rawData = Object.fromEntries(formData.entries());
  const dataToValidate = {
    ...rawData,
    ownerId: user.id, // Correction : On injecte l'ID que Zod attend
  };

  // 3. Validation Zod
  const validated = OrganizationSchema.safeParse(dataToValidate);

  if (!validated.success) {
    console.error("❌ Erreur de validation Zod:", validated.error.flatten().fieldErrors);
    return {
      success: false,
      message: "Certains champs sont invalides.",
      errors: validated.error.flatten().fieldErrors,
    };
  }

  // 4. Extraction des données validées
  const { name, slug, type, logoUrl, ownerId } = validated.data;

  try {
    // 5. Création dans la base de données
    await prisma.organization.create({
      data: {
        name,
        slug,
        type,
        logoUrl: logoUrl || null,
        ownerId: ownerId, // Utilise l'ID validé par Zod
        members: {
          create: {
            userId: user.id,
            role: OrgRole.OWNER,
          },
        },
      },
    });

    console.log(`✅ Organisation "${name}" créée avec succès.`);

  } catch (error: unknown) {
    console.error("❌ Erreur Prisma lors de la création:", error);
    const code = typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined;

    // Gestion du doublon de Slug (Unique constraint)
    if (code === "P2002") {
      return {
        success: false,
        message: "Cette URL (slug) est déjà utilisée. Choisissez-en une autre.",
        errors: { slug: ["Ce lien est déjà pris."] }
      };
    }

    return {
      success: false,
      message: "Une erreur technique est survenue lors de la sauvegarde."
    };
  }

  // 6. Redirection et Revalidation (Hors du bloc try/catch)
  // On revalide le layout du dashboard pour afficher la nouvelle organisation
  revalidatePath("/dashboard", "layout");

  // Redirection vers la page de l'organisation créée
  redirect(`/dashboard/org/${slug}`);
}