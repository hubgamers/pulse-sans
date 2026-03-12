'use server'

import { prisma } from '@/lib/prisma'
import { TournamentSchema } from '@/lib/validations/tournament'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

export async function createTournament(formData: FormData) {
    const validated = TournamentSchema.safeParse(Object.fromEntries(formData.entries()))
    if (!validated.success) return { errors: validated.error.flatten().fieldErrors }

    const { name, slug, organizationId, gameId, status, description } = validated.data

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

    revalidatePath(`/dashboard/org/${organizationId}/tournaments`)
    redirect(`/dashboard/org/${organizationId}/tournaments/${tournament.slug}`)
}