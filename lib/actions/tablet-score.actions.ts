'use server'

import { MatchStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export async function submitScoreFromTablet(matchId: string, homeScore: number, awayScore: number) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: { result: true },
    })

    if (!match) {
      throw new Error('Match introuvable')
    }

    const winnerId = homeScore > awayScore ? match.homeTeamId : homeScore < awayScore ? match.awayTeamId : null

    if (match.result) {
      await prisma.matchResult.update({
        where: { id: match.result.id },
        data: {
          homeScore,
          awayScore,
          winnerId,
        },
      })
    } else {
      await prisma.matchResult.create({
        data: {
          matchId,
          homeScore,
          awayScore,
          winnerId,
        },
      })
    }

    await prisma.match.update({
      where: { id: matchId },
      data: {
        status: MatchStatus.FINISHED,
        playedAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Tablet score error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue',
    }
  }
}
