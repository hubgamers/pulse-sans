"use server"
import { prisma } from "@/lib/prisma";
import { cache } from "react";
import { getAuthUser } from "@/lib/actions/utils.actions";

/**
 * Récupère les organisations dont l'utilisateur est membre
 */
export async function getUserOrganizations() {
    const user = await getAuthUser();

    const memberships = await prisma.organizationMember.findMany({
        where: { userId: user.id },
        include: {
            organization: {
                include: {
                    _count: { select: { members: true, teams: true, tournaments: true } },
                },
            },
        },
        orderBy: { joinedAt: "asc" },
    });

    return memberships.map((m) => ({
        ...m.organization,
        userRole: m.role,
    }));
}

/**
 * Récupère une organisation spécifique par son slug ou son id
 */
export const getOrganizationBySlug = cache(async (slug: string) => {
    const user = await getAuthUser();
    const normalized = slug.trim();
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);

    return await prisma.organization.findFirst({
        where: {
            ...(isUuid
                ? { OR: [{ id: normalized }, { slug: normalized }] }
                : { slug: normalized }),
            members: { some: { userId: user.id } }
        },
        include: {
            owner: { select: { id: true, username: true, display_name: true, avatar_url: true } },
            members: {
                include: {
                    user: { select: { id: true, username: true, display_name: true, avatar_url: true } },
                },
                orderBy: { joinedAt: "asc" },
            },
            teams: { orderBy: { updatedAt: "desc" } },
            _count: { select: { members: true, teams: true, tournaments: true } }
        },
    });
});