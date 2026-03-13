'use server'

import { prisma } from '@/lib/prisma'
import { TeamSchema } from '@/lib/validations/team'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '../utils.actions'

export type TeamFormState = {
    success?: boolean
    message?: string
    errors?: {
        name?: string[]
        slug?: string[]
        logoUrl?: string[]
        organizationId?: string[]
    }
}

export async function createTeam(
    prevState: TeamFormState,
    formData: FormData
): Promise<TeamFormState> {
    void prevState
    await getAuthUser()
    const validated = TeamSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validated.success) {
        return {
            success: false,
            message: "Certains champs sont invalides.",
            errors: validated.error.flatten().fieldErrors,
        }
    }

    const { name, slug, organizationId, logoUrl } = validated.data

    try {
        await prisma.team.create({
            data: {
                name,
                slug,
                organizationId,
                logoUrl: logoUrl || null,
            }
        })
        revalidatePath(`/dashboard/org/${organizationId}/teams`)
        return { success: true, message: "Equipe creee avec succes." }
    } catch {
        return {
            success: false,
            message: "Erreur lors de la creation de l'equipe (slug peut-etre deja pris).",
            errors: { slug: ["Slug deja utilise dans cette organisation."] },
        }
    }
}