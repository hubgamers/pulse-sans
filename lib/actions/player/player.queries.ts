import { prisma } from '@/lib/prisma'
import { cache } from 'react'

export const getPlayer = cache(async (id: string) => {
  return await prisma.player.findFirst({
    where: { id },
    include: {
        
    }
  })
})