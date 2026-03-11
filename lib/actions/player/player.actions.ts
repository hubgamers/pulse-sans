'use server'

import { prisma } from '@/lib/prisma'
import { PlayerSchema } from '@/lib/validations/player'
import { revalidatePath } from 'next/cache'

export async function addPlayerToTeam(formData: FormData) {
    const validated = PlayerSchema.safeParse(Object.fromEntries(formData.entries()))
    if (!validated.success) return { errors: validated.error.flatten().fieldErrors }

    const player = await prisma.player.create({
        data: validated.data
    })

    revalidatePath(`/dashboard/teams/${validated.data.teamId}`)
    return { success: true, player }
}