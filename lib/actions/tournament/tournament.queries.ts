import { prisma } from '@/lib/prisma'
import { cache } from 'react'

export const getTournamentWithDetails = cache(async (slug: string) => {
    return await prisma.tournament.findFirst({
        where: { slug },
        include: {
            game: true,
            phases: {
                orderBy: { order: 'asc' },
                include: { matches: true }
            },
            registrations: { include: { team: true } },
            _count: { select: { registrations: true } }
        }
    })
})