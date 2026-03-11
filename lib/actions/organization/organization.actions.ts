"use server";

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OrganizationSchema } from "@/lib/validations/organization";
import { getAuthUser } from "../utils.actions";
import { OrgRole } from "@prisma/client";

/**
 * Création d'une organisation
 */
export async function createOrganization(prevState: any, formData: FormData) {
  const user = await getAuthUser();

  const validated = OrganizationSchema.safeParse(
    Object.fromEntries(formData.entries())
  );

  if (!validated.success) {
    return {
      success: false,
      errors: validated.error.flatten().fieldErrors
    };
  }

  try {
    const { name, slug, type, logoUrl } = validated.data;

    await prisma.organization.create({
      data: {
        name,
        slug,
        type,
        logoUrl: logoUrl || null,
        ownerId: user.id, // Correspond à ton @map("owner_id")
        members: {
          create: {
            userId: user.id, // Correspond à ton @map("user_id")
            role: OrgRole.OWNER,
          },
        },
      },
    });
  } catch (error: any) {
    if (error.code === "P2002") {
      return { success: false, message: "Ce slug est déjà utilisé." };
    }
    return { success: false, message: "Erreur lors de la création." };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/org/${validated.data.slug}`);
}

/**
 * Ajout d'un membre
 */
export async function addMember(organizationId: string, targetUserId: string, role: OrgRole = OrgRole.MEMBER) {
  const user = await getAuthUser();

  // Sécurité : Seul ADMIN ou OWNER peut ajouter
  const requester = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId: user.id } }
  });

  if (!requester || (requester.role !== OrgRole.OWNER && requester.role !== OrgRole.ADMIN)) {
    return { error: "Permissions insuffisantes" };
  }

  try {
    const member = await prisma.organizationMember.create({
      data: { organizationId, userId: targetUserId, role }
    });
    revalidatePath(`/dashboard/org`);
    return { success: true, member };
  } catch (e) {
    return { error: "L'utilisateur est déjà membre" };
  }
}