'use server'

import { prisma } from '@/lib/prisma'
import { TeamSchema } from '@/lib/validations/team'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '../utils.actions'

export async function createTeam(formData: FormData) {
    await getAuthUser()
    const validated = TeamSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validated.success) return { errors: validated.error.flatten().fieldErrors }

    const { name, slug, organizationId, logoUrl } = validated.data

    try {
        const team = await prisma.team.create({
            data: {
                name,
                slug,
                organizationId,
                logoUrl: logoUrl || null,
            }
        })
        revalidatePath(`/dashboard/org/${organizationId}/teams`)
        return { success: true, team }
    } catch {
        return { error: "Erreur lors de la création de l'équipe (slug peut-être déjà pris)" }
    }
}