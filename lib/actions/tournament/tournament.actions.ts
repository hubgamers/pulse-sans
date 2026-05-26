'use server'

import { prisma } from '@/lib/prisma'
import { TournamentSchema } from '@/lib/validations/tournament'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createTournament(formData: FormData) {
    const validated = TournamentSchema.safeParse(Object.fromEntries(formData.entries()))
    if (!validated.success) return { errors: validated.error.flatten().fieldErrors }

    const { name, slug, organizationId, gameId, status, description } = validated.data

    const organization = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { slug: true },
    })

    if (!organization) return { errors: { organizationId: ['Organisation introuvable.'] } }

    const tournament = await prisma.tournament.create({
        data: {
            name,
            slug,
            organizationId,
            gameId,
            status,
            description,
        }
    })

    revalidatePath(`/dashboard/org/${organization.slug}/tournaments`)
    redirect(`/dashboard/org/${organization.slug}/tournaments/${tournament.slug}`)
}
