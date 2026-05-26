"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationSchema } from "@/lib/validations/organization";
import { getAuthUser } from "../utils.actions";
import { OrgRole } from "@prisma/client";
import { z } from "zod";
import { randomBytes } from "crypto";

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

const AddOrganizationMemberSchema = z.object({
  organizationId: z.string().uuid("Organisation invalide."),
  orgSlug: z.string().min(1, "Slug organisation manquant."),
  identifier: z.string().trim().min(3, "L'email ou le pseudo est requis."),
  role: z.enum(["ADMIN", "MODERATOR", "REFEREE", "MEMBER"]).default("MEMBER"),
});

const InviteOrganizationMemberSchema = z.object({
  organizationId: z.string().uuid("Organisation invalide."),
  orgSlug: z.string().min(1, "Slug organisation manquant."),
  email: z.string().trim().email("Email invalide."),
  role: z.enum(["ADMIN", "MODERATOR", "REFEREE", "MEMBER"]).default("MEMBER"),
});

export type AddOrganizationMemberState = {
  success?: boolean;
  message?: string;
  errors?: {
    identifier?: string[];
    email?: string[];
    role?: string[];
    organizationId?: string[];
    orgSlug?: string[];
  };
};

export async function addOrganizationMember(
  prevState: AddOrganizationMemberState,
  formData: FormData,
): Promise<AddOrganizationMemberState> {
  void prevState;
  const user = await getAuthUser();

  const validated = AddOrganizationMemberSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validated.success) {
    return {
      success: false,
      message: "Certains champs sont invalides.",
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { organizationId, orgSlug, identifier, role } = validated.data;

  try {
    const requesterMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: user.id,
      },
      select: {
        role: true,
      },
    });

    if (!requesterMembership) {
      return {
        success: false,
        message: "Vous n'etes pas membre de cette organisation.",
      };
    }

    const canManageMembers =
      requesterMembership.role === OrgRole.OWNER || requesterMembership.role === OrgRole.ADMIN;
    if (!canManageMembers) {
      return {
        success: false,
        message: "Permissions insuffisantes pour ajouter des membres.",
      };
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const emailLike = normalizedIdentifier.includes("@");
    const guessedUsername = emailLike
      ? normalizedIdentifier.split("@")[0]?.trim() || ""
      : normalizedIdentifier;

    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [
          {
            username: {
              equals: normalizedIdentifier,
              mode: "insensitive",
            },
          },
          {
            username: {
              equals: guessedUsername,
              mode: "insensitive",
            },
          },
        ],
      },
      select: {
        id: true,
        username: true,
      },
    });

    if (!targetUser) {
      return {
        success: false,
        message: "Aucun utilisateur trouve avec cet email ou pseudo.",
        errors: {
          identifier: ["Utilisateur introuvable. Essayez son pseudo exact."],
        },
      };
    }

    const existingMember = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: targetUser.id,
      },
      select: { id: true },
    });

    if (existingMember) {
      return {
        success: false,
        message: "Cet utilisateur a deja acces a l'organisation.",
        errors: {
          identifier: ["Ce membre est deja dans l'organisation."],
        },
      };
    }

    await prisma.organizationMember.create({
      data: {
        organizationId,
        userId: targetUser.id,
        role: role as OrgRole,
      },
    });

    revalidatePath(`/dashboard/org/${orgSlug}/members`);
    revalidatePath(`/dashboard/org/${orgSlug}/settings`);

    return {
      success: true,
      message: `@${targetUser.username} a ete ajoute avec le role ${role}.`,
    };
  } catch {
    return {
      success: false,
      message: "Erreur lors de l'ajout du membre.",
    };
  }
}

export async function inviteOrganizationMember(
  prevState: AddOrganizationMemberState,
  formData: FormData,
): Promise<AddOrganizationMemberState> {
  void prevState;
  const user = await getAuthUser();

  const validated = InviteOrganizationMemberSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!validated.success) {
    return {
      success: false,
      message: "Certains champs sont invalides.",
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { organizationId, orgSlug, email, role } = validated.data;
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const requesterMembership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: user.id,
      },
      select: {
        role: true,
      },
    });

    if (!requesterMembership) {
      return {
        success: false,
        message: "Vous n'etes pas membre de cette organisation.",
      };
    }

    const canManageMembers =
      requesterMembership.role === OrgRole.OWNER || requesterMembership.role === OrgRole.ADMIN;
    if (!canManageMembers) {
      return {
        success: false,
        message: "Permissions insuffisantes pour inviter des membres.",
      };
    }

    const guessedUsername = normalizedEmail.split("@")[0]?.trim() || normalizedEmail;
    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: guessedUsername,
          mode: "insensitive",
        },
      },
      select: { id: true },
    });

    if (existingUser) {
      const existingMember = await prisma.organizationMember.findFirst({
        where: {
          organizationId,
          userId: existingUser.id,
        },
        select: { id: true },
      });

      if (existingMember) {
        return {
          success: false,
          message: "Cet utilisateur a deja acces a l'organisation.",
          errors: { identifier: ["Ce membre est deja dans l'organisation."] },
        };
      }
    }

    const existingInvitation = await prisma.organizationInvitation.findFirst({
      where: {
        organizationId,
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    if (existingInvitation) {
      return {
        success: false,
        message: "Une invitation active existe deja pour cet email.",
        errors: { identifier: ["Invitation deja envoyee."] },
      };
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);

    await prisma.organizationInvitation.create({
      data: {
        organizationId,
        email: normalizedEmail,
        role: role as OrgRole,
        token: randomBytes(32).toString("hex"),
        expiresAt,
        invitedById: user.id,
        invitedByName: user.user_metadata?.full_name || user.email || null,
      },
    });

    revalidatePath(`/dashboard/org/${orgSlug}/members`);
    revalidatePath(`/dashboard/org/${orgSlug}/settings`);

    return {
      success: true,
      message: `Invitation creee pour ${normalizedEmail}. Elle expire dans 14 jours.`,
    };
  } catch {
    return {
      success: false,
      message: "Erreur lors de la creation de l'invitation.",
    };
  }
}

export async function acceptOrganizationInvitation(formData: FormData) {
  const user = await getAuthUser();
  const token = String(formData.get("token") || "");

  if (!token || !user.email) {
    return;
  }

  const invitation = await prisma.organizationInvitation.findFirst({
    where: {
      token,
      status: "PENDING",
      email: {
        equals: user.email,
        mode: "insensitive",
      },
      expiresAt: { gt: new Date() },
    },
    select: {
      id: true,
      role: true,
      organizationId: true,
      organization: { select: { slug: true } },
    },
  });

  if (!invitation) {
    revalidatePath("/dashboard/invitations");
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.organizationMember.upsert({
      where: {
        organizationId_userId: {
          organizationId: invitation.organizationId,
          userId: user.id,
        },
      },
      create: {
        organizationId: invitation.organizationId,
        userId: user.id,
        role: invitation.role,
      },
      update: {
        role: invitation.role,
      },
    });

    await tx.organizationInvitation.update({
      where: { id: invitation.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
      },
    });
  });

  revalidatePath("/dashboard", "layout");
  revalidatePath("/dashboard/invitations");
  redirect(`/dashboard/org/${invitation.organization.slug}`);
}
