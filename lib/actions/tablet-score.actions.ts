'use server'

import { MatchStatus, OrgRole } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { propagateWinnerToNextBracketMatch } from '@/lib/actions/tournament-management.actions'

const TABLET_ALLOWED_ROLES: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MODERATOR, OrgRole.REFEREE]

export async function submitScoreFromTablet(matchId: string, homeScore: number, awayScore: number) {
  try {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        result: true,
        phase: {
          select: {
            tournamentId: true,
            type: true,
            tournament: {
              select: {
                tabletRequiresReferee: true,
                organizationId: true,
              },
            },
          },
        },
      },
    })

    if (!match) {
      throw new Error('Match introuvable')
    }

    if (match.phase.tournament.tabletRequiresReferee) {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        throw new Error('Connexion arbitre requise pour modifier les scores.')
      }

      const membership = await prisma.organizationMember.findFirst({
        where: {
          organizationId: match.phase.tournament.organizationId,
          userId: user.id,
          role: { in: TABLET_ALLOWED_ROLES },
        },
        select: { id: true },
      })

      if (!membership) {
        throw new Error('Role arbitre requis pour modifier les scores de cette tablette.')
      }
    }

    const winnerId = homeScore > awayScore ? match.homeTeamId : homeScore < awayScore ? match.awayTeamId : null
    const loserId =
      winnerId === null
        ? null
        : winnerId === match.homeTeamId
          ? match.awayTeamId ?? null
          : match.homeTeamId ?? null

    await prisma.$transaction(async (tx) => {
      await tx.match.update({
        where: { id: matchId },
        data: {
          status: MatchStatus.FINISHED,
          playedAt: new Date(),
        },
      })

      await tx.matchResult.upsert({
        where: { matchId },
        update: {
          homeScore,
          awayScore,
          winnerId,
        },
        create: {
          matchId,
          homeScore,
          awayScore,
          winnerId,
        },
      })

      await propagateWinnerToNextBracketMatch(tx, {
        phaseId: match.phaseId,
        phaseType: match.phase.type,
        bracketPos: match.bracketPos,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        winnerId,
        loserId,
      })
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
