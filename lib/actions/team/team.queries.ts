import { prisma } from '@/lib/prisma'
import { cache } from 'react'

export const getTeamBySlug = cache(async (orgId: string, slug: string) => {
    return await prisma.team.findUnique({
        where: { organizationId_slug: { organizationId: orgId, slug } },
        include: {
            players: { include: { user: true } },
            _count: { select: { players: true } }
        }
    })
})