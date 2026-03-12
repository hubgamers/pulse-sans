'use server'

import { prisma } from "@/lib/prisma"
import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { NavigationContext, NavigationItem as PrismaNavigationItem } from "@prisma/client";
import z from "zod"

// On définit le type de retour pour useActionState
export type FormState = {
    message: string;
    errors?: Record<string, string[]>;
}

export type NavigationItem = PrismaNavigationItem & {
    children: PrismaNavigationItem[];
};

const CreateNavItemSchema = z.object({
    name: z.string().min(2, "Le nom est trop court"),
    label: z.string().min(2, "Le label est trop court"),
    href: z.string().startsWith('/', "L'URL doit commencer par /"), // Plus flexible que .url() pour les liens internes
    icon: z.string().min(1, "L'icône est requise"),
    order: z.number().min(1, "L'ordre doit être au moins 1"),
    context: z.nativeEnum(NavigationContext),
})

async function getAuthUser() {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error || !user) {
        redirect('/login')
    }

    // Optionnel : Vérifier ici si user.role === 'ADMIN'

    return user
}

export async function createNavItem(
    prevState: FormState,
    formData: FormData
): Promise<FormState> {
    await getAuthUser()
    void prevState

    // Conversion manuelle car FormData renvoie des strings
    const rawData = {
        name: formData.get('name'),
        label: formData.get('label'),
        href: formData.get('href'),
        icon: formData.get('icon'),
        order: Number(formData.get('order')), // Conversion en nombre
        context: formData.get('context'),
    }

    const parsed = CreateNavItemSchema.safeParse(rawData)

    if (!parsed.success) {
        return {
            message: "Champs invalides. Veuillez corriger les erreurs.",
            errors: parsed.error.flatten((issue) => issue.message).fieldErrors,
        }
    }

    const { name, label, href, icon, order, context } = parsed.data

    try {
        await prisma.navigationItem.create({
            data: {
                name,
                label,
                href,
                icon,
                order,
                context
            },
        })
    } catch (error) {
        console.error("Erreur création NavigationItem:", error)
        return { message: "Erreur lors de l'enregistrement en base de données." }
    }

    revalidatePath('/admin/settings')
    // Optionnel : redirect('/admin/settings') si vous voulez quitter la page
    return { message: "Élément de navigation créé avec succès !", errors: {} }
}

/**
 * Récupère les items de navigation selon le contexte (ADMIN ou USER)
 * @param context - NavigationContext (Enum Prisma)
 */
export async function findNavigationItems(
    context: NavigationContext
): Promise<NavigationItem[]> {
    // 1. Sécurité : Vérifier si l'utilisateur est authentifié
    await getAuthUser()

    // 2. Récupération filtrée
    const items = await prisma.navigationItem.findMany({
        where: {
            context: context,
            isActive: true, // Optionnel : ne récupérer que ce qui est actif
            parentId: null, // Optionnel : si tu veux gérer les menus parents en premier
        },
        include: {
            children: {
                orderBy: {
                    order: 'asc'
                }
            }
        },
        orderBy: {
            order: 'asc',
        },
    })

    return items
}