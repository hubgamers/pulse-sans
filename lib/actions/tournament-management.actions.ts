'use server'

import { MatchStatus, OrgRole, PhaseType, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from './utils.actions'

type ActionState = {
  success?: boolean
  message: string
}

const ManageTournamentBaseSchema = z.object({
  tournamentId: z.string().uuid(),
  orgSlug: z.string().min(1),
  tournamentSlug: z.string().min(1),
})

const CreatePitchSchema = ManageTournamentBaseSchema.extend({
  name: z.string().min(2).max(80),
  phaseId: z.string().uuid().optional().or(z.literal('')),
})

const DeletePitchSchema = ManageTournamentBaseSchema.extend({
  pitchId: z.string().uuid(),
})

const RegistrationSchema = ManageTournamentBaseSchema.extend({
  teamId: z.string().uuid(),
  seed: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().positive().max(512).optional()
  ),
  isConfirmed: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const DeleteRegistrationSchema = ManageTournamentBaseSchema.extend({
  registrationId: z.string().uuid(),
})

const CreateMatchSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  pitchId: z.string().uuid(),
  homeTeamId: z.string().uuid().optional().or(z.literal('')),
  awayTeamId: z.string().uuid().optional().or(z.literal('')),
  bracketPos: z.string().max(20).optional().or(z.literal('')),
  roundNumber: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().positive().max(99).optional()
  ),
  scheduledAt: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? undefined : date
  }, z.date().optional()),
  maxDurationMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 30 : Number(value)),
    z.number().int().min(5).max(600)
  ),
  teamBreakMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 0 : Number(value)),
    z.number().int().min(0).max(240)
  ),
})

const MatchStatusSchema = ManageTournamentBaseSchema.extend({
  matchId: z.string().uuid(),
  status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED']),
})

const DeleteMatchSchema = ManageTournamentBaseSchema.extend({
  matchId: z.string().uuid(),
})

const GenerateMatchesSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  confirmedOnly: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
  startAt: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? undefined : date
  }, z.date().optional()),
  maxDurationMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 30 : Number(value)),
    z.number().int().min(5).max(600)
  ),
  teamBreakMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 0 : Number(value)),
    z.number().int().min(0).max(240)
  ),
})

const MatchResultSchema = ManageTournamentBaseSchema.extend({
  matchId: z.string().uuid(),
  homeScore: z.preprocess((value) => Number(value), z.number().int().min(0).max(999)),
  awayScore: z.preprocess((value) => Number(value), z.number().int().min(0).max(999)),
  notes: z.string().max(500).optional().or(z.literal('')),
})

const ConfigureGroupPhaseSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  groupCount: z.preprocess((value) => Number(value), z.number().int().min(1).max(64)),
  teamsPerGroup: z.preprocess((value) => Number(value), z.number().int().min(2).max(64)),
})

const AutoPlaceGroupTeamsSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  confirmedOnly: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const SetGroupPlacementSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  groupIndex: z.preprocess((value) => Number(value), z.number().int().min(1).max(64)),
  slot: z.preprocess((value) => Number(value), z.number().int().min(1).max(128)),
  teamId: z.string().uuid().optional().or(z.literal('')),
})

const BulkSetGroupPlacementsSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  placementsJson: z.string().min(2),
})

const GenerateGroupMatchesFromPlacementsSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  startAt: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? undefined : date
  }, z.date().optional()),
  maxDurationMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 30 : Number(value)),
    z.number().int().min(5).max(600)
  ),
  teamBreakMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 0 : Number(value)),
    z.number().int().min(0).max(240)
  ),
  overwritePhaseMatches: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const BulkMatchUpdateSchema = ManageTournamentBaseSchema.extend({
  updatesJson: z.string().min(2),
})

const BulkMatchUpdateItemSchema = z.object({
  matchId: z.string().uuid(),
  status: z.enum(['SCHEDULED', 'LIVE', 'FINISHED', 'CANCELLED']).optional(),
  homeScore: z.number().int().min(0).max(999).optional(),
  awayScore: z.number().int().min(0).max(999).optional(),
  notes: z.string().max(500).optional(),
})

const ClosePhaseSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  forceClose: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const GenerateCustomPlacementBracketSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  participantsCount: z.preprocess((value) => Number(value), z.number().int().min(4).max(64)),
  includeLosersReplay: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
  overwritePhaseMatches: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const DEFAULT_EXISTING_MATCH_DURATION_MINUTES = 30

type GroupPlacement = {
  teamId: string
  groupIndex: number
  slot: number
}

type GroupPhaseConfig = {
  count: number
  teamsPerGroup: number
  placements: GroupPlacement[]
}

async function assertOrganizerCanManageTournament(tournamentId: string) {
  const user = await getAuthUser()

  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    include: {
      organization: {
        include: {
          members: {
            where: { userId: user.id },
            select: { role: true },
            take: 1,
          },
        },
      },
    },
  })

  if (!tournament) throw new Error('Tournoi introuvable.')

  const membership = tournament.organization.members[0]
  if (!membership) throw new Error('Acces refuse a cette organisation.')

  const manageableRoles: OrgRole[] = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MODERATOR]
  const canManage = manageableRoles.includes(membership.role)
  if (!canManage) throw new Error('Permissions insuffisantes pour gerer ce tournoi.')

  return tournament
}

function revalidateTournamentPath(orgSlug: string, tournamentSlug: string) {
  revalidatePath(`/dashboard/org/${orgSlug}/tournaments/${tournamentSlug}`)
  revalidatePath(`/dashboard/org/${orgSlug}/tournaments`)
}

function readGroupPhaseConfig(config: unknown): GroupPhaseConfig {
  const raw = config && typeof config === 'object' ? (config as Record<string, unknown>) : {}
  const rawGroups = raw.groups && typeof raw.groups === 'object' ? (raw.groups as Record<string, unknown>) : {}

  const count =
    typeof rawGroups.count === 'number' && Number.isInteger(rawGroups.count) && rawGroups.count > 0
      ? rawGroups.count
      : 2
  const teamsPerGroup =
    typeof rawGroups.teamsPerGroup === 'number' &&
    Number.isInteger(rawGroups.teamsPerGroup) &&
    rawGroups.teamsPerGroup > 0
      ? rawGroups.teamsPerGroup
      : 4

  const placementsRaw = Array.isArray(rawGroups.placements) ? rawGroups.placements : []
  const placements: GroupPlacement[] = placementsRaw
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const candidate = item as Record<string, unknown>
      if (typeof candidate.teamId !== 'string') return null
      if (typeof candidate.groupIndex !== 'number' || !Number.isInteger(candidate.groupIndex)) return null
      if (typeof candidate.slot !== 'number' || !Number.isInteger(candidate.slot)) return null
      return {
        teamId: candidate.teamId,
        groupIndex: candidate.groupIndex,
        slot: candidate.slot,
      }
    })
    .filter((item): item is GroupPlacement => Boolean(item))

  return { count, teamsPerGroup, placements }
}

function withGroupConfig(
  currentConfig: unknown,
  groupConfig: GroupPhaseConfig
): Prisma.InputJsonValue {
  const base: Prisma.InputJsonObject =
    currentConfig && typeof currentConfig === 'object'
      ? ({ ...(currentConfig as Record<string, unknown>) } as Prisma.InputJsonObject)
      : {}
  return {
    ...base,
    groups: groupConfig,
  } as Prisma.InputJsonValue
}

async function assertGroupPhaseBelongsTournament(phaseId: string, tournamentId: string) {
  const phase = await prisma.phase.findUnique({
    where: { id: phaseId },
    select: { id: true, type: true, tournamentId: true, config: true },
  })

  if (!phase || phase.tournamentId !== tournamentId) {
    throw new Error('Phase invalide pour ce tournoi.')
  }

  if (phase.type !== 'GROUP') {
    throw new Error('Cette action est reservee aux phases de type poule.')
  }

  return phase
}

// --------------- Route / qualifier helpers ---------------

type PhaseRouteConfig = {
  toPhaseKey?: string
  toPhaseId?: string | null
  rule: 'TOP' | 'BOTTOM' | 'RANGE'
  countPerGroup?: number
  startRank?: number
  endRank?: number
  label?: string
}

function readRoutesFromConfig(config: unknown): PhaseRouteConfig[] {
  if (!config || typeof config !== 'object') return []
  const raw = config as Record<string, unknown>
  if (!Array.isArray(raw.routes)) return []
  return raw.routes.filter(
    (r): r is PhaseRouteConfig => r !== null && typeof r === 'object'
  )
}

function computeGroupStandingsForPhase(
  groupIndex: number,
  groupConfig: GroupPhaseConfig,
  phaseId: string,
  matches: Array<{
    phaseId: string
    homeTeamId: string | null
    awayTeamId: string | null
    result: { homeScore: number; awayScore: number } | null
  }>
): string[] {
  const teamIds = groupConfig.placements
    .filter((p) => p.groupIndex === groupIndex)
    .sort((a, b) => a.slot - b.slot)
    .map((p) => p.teamId)

  const uniqueTeamIds = [...new Set(teamIds)]

  type Row = { teamId: string; points: number; gd: number; gf: number }
  const rows = new Map<string, Row>(
    uniqueTeamIds.map((tid) => [tid, { teamId: tid, points: 0, gd: 0, gf: 0 }])
  )

  const groupTeamSet = new Set(uniqueTeamIds)

  for (const match of matches) {
    if (
      match.phaseId !== phaseId ||
      !match.result ||
      !match.homeTeamId ||
      !match.awayTeamId
    ) continue
    if (!groupTeamSet.has(match.homeTeamId) || !groupTeamSet.has(match.awayTeamId)) continue

    const home = rows.get(match.homeTeamId)
    const away = rows.get(match.awayTeamId)
    if (!home || !away) continue

    const hs = match.result.homeScore
    const as_ = match.result.awayScore

    home.gf += hs
    home.gd += hs - as_
    away.gf += as_
    away.gd += as_ - hs

    if (hs > as_) {
      home.points += 3
    } else if (hs < as_) {
      away.points += 3
    } else {
      home.points += 1
      away.points += 1
    }
  }

  return Array.from(rows.values())
    .sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      if (b.gf !== a.gf) return b.gf - a.gf
      return a.teamId.localeCompare(b.teamId)
    })
    .map((r) => r.teamId)
}

async function propagateQualifiersToNextPhase(
  tx: Prisma.TransactionClient,
  phase: { id: string; type: PhaseType; config: unknown }
): Promise<void> {
  const routes = readRoutesFromConfig(phase.config)
  if (routes.length === 0) return

  for (const route of routes) {
    const toPhaseId = typeof route.toPhaseId === 'string' ? route.toPhaseId : null
    if (!toPhaseId) continue

    let qualifierIds: string[] = []

    if (phase.type === PhaseType.GROUP) {
      const groupConfig = readGroupPhaseConfig(phase.config)
      const matches = await tx.match.findMany({
        where: { phaseId: phase.id },
        select: {
          phaseId: true,
          homeTeamId: true,
          awayTeamId: true,
          result: { select: { homeScore: true, awayScore: true } },
        },
      })

      const groupStandings: string[][] = []
      for (let g = 0; g < groupConfig.count; g += 1) {
        groupStandings.push(
          computeGroupStandingsForPhase(g, groupConfig, phase.id, matches)
        )
      }

      if (route.rule === 'TOP' && route.countPerGroup) {
        for (let rank = 0; rank < route.countPerGroup; rank += 1) {
          for (const group of groupStandings) {
            if (group[rank]) qualifierIds.push(group[rank])
          }
        }
      } else if (route.rule === 'BOTTOM' && route.countPerGroup) {
        for (let rank = 0; rank < route.countPerGroup; rank += 1) {
          for (const group of groupStandings) {
            const idx = group.length - 1 - rank
            if (idx >= 0 && group[idx]) qualifierIds.push(group[idx])
          }
        }
      } else if (route.rule === 'RANGE' && route.startRank && route.endRank) {
        for (let rank = route.startRank - 1; rank < route.endRank; rank += 1) {
          for (const group of groupStandings) {
            if (group[rank]) qualifierIds.push(group[rank])
          }
        }
      }
    } else if (
      phase.type === PhaseType.BRACKET_SINGLE ||
      phase.type === PhaseType.BRACKET_DOUBLE ||
      phase.type === PhaseType.PLACEMENT_BRACKET ||
      phase.type === PhaseType.CUSTOM
    ) {
      // Extract winners from finished matches, highest round first
      const matches = await tx.match.findMany({
        where: { phaseId: phase.id, status: MatchStatus.FINISHED },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          result: { select: { homeScore: true, awayScore: true } },
        },
        orderBy: [{ roundNumber: 'desc' }, { bracketPos: 'asc' }],
      })

      for (const match of matches) {
        if (!match.result) continue
        const winnerId =
          match.result.homeScore >= match.result.awayScore
            ? match.homeTeamId
            : match.awayTeamId
        if (winnerId && !qualifierIds.includes(winnerId)) {
          qualifierIds.push(winnerId)
        }
      }
    }

    if (qualifierIds.length === 0) continue

    // Fill first-round seed slots in the target bracket phase
    const slotMatches = await tx.match.findMany({
      where: { phaseId: toPhaseId, roundNumber: 1 },
      select: { id: true, homeTeamId: true, awayTeamId: true, bracketPos: true },
      orderBy: { bracketPos: 'asc' },
    })

    let qualIdx = 0
    for (const slot of slotMatches) {
      if (qualIdx >= qualifierIds.length) break
      const data: { homeTeamId?: string; awayTeamId?: string } = {}
      if (!slot.homeTeamId && qualifierIds[qualIdx]) {
        data.homeTeamId = qualifierIds[qualIdx]
        qualIdx += 1
      }
      if (!slot.awayTeamId && qualifierIds[qualIdx]) {
        data.awayTeamId = qualifierIds[qualIdx]
        qualIdx += 1
      }
      if (Object.keys(data).length > 0) {
        await tx.match.update({ where: { id: slot.id }, data })
      }
    }
  }
}

async function assertPreviousRoutingPhaseCompleted(
  phaseId: string,
  tournamentId: string
): Promise<void> {
  const allPhases = await prisma.phase.findMany({
    where: { tournamentId },
    select: { id: true, name: true, order: true, isCompleted: true, config: true },
    orderBy: { order: 'asc' },
  })

  const targetPhase = allPhases.find((p) => p.id === phaseId)
  if (!targetPhase) return

  const blockingPhase = allPhases.find((p) => {
    if (p.order >= targetPhase.order || p.isCompleted) return false
    const routes = readRoutesFromConfig(p.config)
    return routes.some((r) => r.toPhaseId === phaseId)
  })

  if (blockingPhase) {
    throw new Error(
      `La phase "${blockingPhase.name}" (etape ${blockingPhase.order}) doit etre cloturee avant de generer des matchs ici.`
    )
  }
}

// --------------- Round-robin helpers ---------------

function buildRoundRobinPairings(teamIds: string[]) {
  const teams = [...teamIds]
  const hasBye = teams.length % 2 !== 0
  if (hasBye) teams.push('BYE')

  const rounds = teams.length - 1
  const half = teams.length / 2
  const pairings: Array<{ round: number; homeTeamId: string; awayTeamId: string }> = []

  for (let round = 0; round < rounds; round += 1) {
    for (let i = 0; i < half; i += 1) {
      const home = teams[i]
      const away = teams[teams.length - 1 - i]

      if (home !== 'BYE' && away !== 'BYE') {
        pairings.push({
          round: round + 1,
          homeTeamId: home,
          awayTeamId: away,
        })
      }
    }

    const fixed = teams[0]
    const rotated = [fixed, teams[teams.length - 1], ...teams.slice(1, teams.length - 1)]
    teams.splice(0, teams.length, ...rotated)
  }

  return pairings
}

export async function createTournamentPitch(
  formData: FormData
): Promise<ActionState> {
  const parsed = CreatePitchSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour la piste.' }

  const { tournamentId, orgSlug, tournamentSlug, name, phaseId } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    await prisma.pitch.create({
      data: {
        name,
        tournamentId,
        phaseId: phaseId || null,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Piste ajoutee.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur piste.' }
  }
}

export async function deleteTournamentPitch(formData: FormData) {
  const parsed = DeletePitchSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  const { tournamentId, orgSlug, tournamentSlug, pitchId } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const linkedMatches = await prisma.match.count({ where: { pitchId } })
    if (linkedMatches > 0) return

    await prisma.pitch.delete({ where: { id: pitchId } })
    revalidateTournamentPath(orgSlug, tournamentSlug)
  } catch {
    return
  }
}

export async function addTournamentRegistration(
  formData: FormData
): Promise<ActionState> {
  const parsed = RegistrationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour inscription.' }

  const { tournamentId, orgSlug, tournamentSlug, teamId, seed, isConfirmed } = parsed.data

  try {
    const tournament = await assertOrganizerCanManageTournament(tournamentId)

    const team = await prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true, organizationId: true },
    })

    if (!team || team.organizationId !== tournament.organizationId) {
      return { success: false, message: "Equipe invalide pour cette organisation." }
    }

    await prisma.tournamentRegistration.create({
      data: {
        tournamentId,
        teamId,
        seed,
        isConfirmed,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Equipe inscrite au tournoi.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur inscription.' }
  }
}

export async function removeTournamentRegistration(formData: FormData) {
  const parsed = DeleteRegistrationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  const { tournamentId, registrationId, orgSlug, tournamentSlug } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    await prisma.tournamentRegistration.delete({ where: { id: registrationId } })

    revalidateTournamentPath(orgSlug, tournamentSlug)
  } catch {
    return
  }
}

export async function createTournamentMatch(
  formData: FormData
): Promise<ActionState> {
  const parsed = CreateMatchSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour match.' }

  const {
    tournamentId,
    orgSlug,
    tournamentSlug,
    phaseId,
    pitchId,
    homeTeamId,
    awayTeamId,
    bracketPos,
    roundNumber,
    scheduledAt,
    maxDurationMinutes,
    teamBreakMinutes,
  } = parsed.data

  if (homeTeamId && awayTeamId && homeTeamId === awayTeamId) {
    return { success: false, message: 'Une equipe ne peut pas jouer contre elle-meme.' }
  }

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const [phase, pitch] = await Promise.all([
      prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, tournamentId: true } }),
      prisma.pitch.findUnique({ where: { id: pitchId }, select: { id: true, tournamentId: true } }),
    ])

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (!pitch || pitch.tournamentId !== tournamentId) {
      return { success: false, message: 'Piste invalide pour ce tournoi.' }
    }

    if (scheduledAt) {
      const newStart = scheduledAt.getTime()
      const newEnd = newStart + maxDurationMinutes * 60 * 1000
      const breakMs = teamBreakMinutes * 60 * 1000

      const existingMatches = await prisma.match.findMany({
        where: {
          phase: { tournamentId },
          scheduledAt: { not: null },
          status: { not: MatchStatus.CANCELLED },
        },
        select: {
          id: true,
          pitchId: true,
          homeTeamId: true,
          awayTeamId: true,
          scheduledAt: true,
        },
      })

      const hasPitchConflict = existingMatches.some((existingMatch) => {
        if (existingMatch.pitchId !== pitchId || !existingMatch.scheduledAt) return false
        const existingStart = existingMatch.scheduledAt.getTime()
        const existingEnd = existingStart + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60 * 1000
        return newStart < existingEnd && existingStart < newEnd
      })

      if (hasPitchConflict) {
        return {
          success: false,
          message: 'Conflit de planning: la piste est deja occupee sur ce creneau.',
        }
      }

      const involvedTeamIds = [homeTeamId, awayTeamId].filter(Boolean) as string[]
      const hasTeamConflict = existingMatches.some((existingMatch) => {
        if (!existingMatch.scheduledAt) return false

        const existingTeamIds = [existingMatch.homeTeamId, existingMatch.awayTeamId].filter(Boolean) as string[]
        const sharedTeam = involvedTeamIds.some((teamId) => existingTeamIds.includes(teamId))
        if (!sharedTeam) return false

        const existingStart = existingMatch.scheduledAt.getTime()
        const existingEnd = existingStart + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60 * 1000
        const newWindowStart = newStart - breakMs
        const newWindowEnd = newEnd + breakMs

        return newWindowStart < existingEnd && existingStart < newWindowEnd
      })

      if (hasTeamConflict) {
        return {
          success: false,
          message: 'Conflit de planning: une equipe n\'a pas assez de temps de battement.',
        }
      }
    }

    await prisma.match.create({
      data: {
        phaseId,
        pitchId,
        homeTeamId: homeTeamId || null,
        awayTeamId: awayTeamId || null,
        bracketPos: bracketPos || null,
        roundNumber,
        scheduledAt,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Match planifie.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur match.' }
  }
}

export async function updateTournamentMatchStatus(
  formData: FormData
): Promise<ActionState> {
  const parsed = MatchStatusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Statut invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, matchId, status } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    await prisma.match.update({
      where: { id: matchId },
      data: { status: status as MatchStatus },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Statut match mis a jour.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur statut match.' }
  }
}

export async function recordTournamentMatchResult(
  formData: FormData
): Promise<ActionState> {
  const parsed = MatchResultSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Resultat invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, matchId, homeScore, awayScore, notes } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const match = await prisma.match.findUnique({
      where: { id: matchId },
      select: { id: true, homeTeamId: true, awayTeamId: true },
    })

    if (!match) return { success: false, message: 'Match introuvable.' }

    let winnerId: string | null = null
    if (homeScore > awayScore) winnerId = match.homeTeamId ?? null
    if (awayScore > homeScore) winnerId = match.awayTeamId ?? null

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
          notes: notes || null,
          winnerId,
        },
        create: {
          matchId,
          homeScore,
          awayScore,
          notes: notes || null,
          winnerId,
        },
      })
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Resultat enregistre.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur resultat.' }
  }
}

export async function deleteTournamentMatch(formData: FormData) {
  const parsed = DeleteMatchSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return

  const { tournamentId, orgSlug, tournamentSlug, matchId } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    await prisma.match.delete({ where: { id: matchId } })

    revalidateTournamentPath(orgSlug, tournamentSlug)
  } catch {
    return
  }
}

export async function generatePhaseRoundRobinMatches(
  formData: FormData
): Promise<ActionState> {
  const parsed = GenerateMatchesSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour la generation.' }

  const {
    tournamentId,
    orgSlug,
    tournamentSlug,
    phaseId,
    confirmedOnly,
    startAt,
    maxDurationMinutes,
    teamBreakMinutes,
  } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    await assertPreviousRoutingPhaseCompleted(phaseId, tournamentId)

    const [phase, pitches, registrations, existingMatches] = await Promise.all([
      prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, tournamentId: true } }),
      prisma.pitch.findMany({ where: { tournamentId }, select: { id: true }, orderBy: { name: 'asc' } }),
      prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
          ...(confirmedOnly ? { isConfirmed: true } : {}),
        },
        select: { teamId: true },
        orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }],
      }),
      prisma.match.count({ where: { phaseId } }),
    ])

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (existingMatches > 0) {
      return { success: false, message: 'Des matchs existent deja dans cette phase.' }
    }

    if (pitches.length === 0) {
      return { success: false, message: 'Ajoutez au moins une piste avant generation.' }
    }

    const teamIds = registrations.map((registration) => registration.teamId)
    if (teamIds.length < 2) {
      return { success: false, message: 'Au moins 2 equipes sont requises.' }
    }

    const pairings = buildRoundRobinPairings(teamIds)

    const startDate = startAt ?? new Date()
    const matchDurationMs = maxDurationMinutes * 60 * 1000
    const teamBreakMs = teamBreakMinutes * 60 * 1000

    const pitchAvailableAt = new Map<string, number>(
      pitches.map((pitch) => [pitch.id, startDate.getTime()])
    )
    const teamAvailableAt = new Map<string, number>(
      teamIds.map((teamId) => [teamId, startDate.getTime()])
    )

    const matchesToCreate = pairings.map((pairing) => {
      const homeReadyAt = teamAvailableAt.get(pairing.homeTeamId) ?? startDate.getTime()
      const awayReadyAt = teamAvailableAt.get(pairing.awayTeamId) ?? startDate.getTime()

      let selectedPitchId = pitches[0]?.id
      let selectedStart = Number.POSITIVE_INFINITY

      for (const pitch of pitches) {
        const pitchReadyAt = pitchAvailableAt.get(pitch.id) ?? startDate.getTime()
        const candidateStart = Math.max(startDate.getTime(), pitchReadyAt, homeReadyAt, awayReadyAt)

        if (candidateStart < selectedStart) {
          selectedStart = candidateStart
          selectedPitchId = pitch.id
        }
      }

      const matchEnd = selectedStart + matchDurationMs
      pitchAvailableAt.set(selectedPitchId, matchEnd)
      teamAvailableAt.set(pairing.homeTeamId, matchEnd + teamBreakMs)
      teamAvailableAt.set(pairing.awayTeamId, matchEnd + teamBreakMs)

      return {
        phaseId,
        pitchId: selectedPitchId,
        homeTeamId: pairing.homeTeamId,
        awayTeamId: pairing.awayTeamId,
        roundNumber: pairing.round,
        scheduledAt: new Date(selectedStart),
      }
    })

    await prisma.match.createMany({ data: matchesToCreate })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${pairings.length} match(s) generes.` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur generation.' }
  }
}

export async function configureGroupPhase(
  formData: FormData
): Promise<ActionState> {
  const parsed = ConfigureGroupPhaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Configuration de poules invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, groupCount, teamsPerGroup } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const phase = await assertGroupPhaseBelongsTournament(phaseId, tournamentId)

    const existing = readGroupPhaseConfig(phase.config)
    const filteredPlacements = existing.placements.filter(
      (placement) => placement.groupIndex <= groupCount && placement.slot <= teamsPerGroup
    )

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        config: withGroupConfig(phase.config, {
          count: groupCount,
          teamsPerGroup,
          placements: filteredPlacements,
        }),
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Configuration des poules enregistree.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur configuration poules.' }
  }
}

export async function autoPlaceGroupTeams(
  formData: FormData
): Promise<ActionState> {
  const parsed = AutoPlaceGroupTeamsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour auto placement.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, confirmedOnly } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const phase = await assertGroupPhaseBelongsTournament(phaseId, tournamentId)

    const groupConfig = readGroupPhaseConfig(phase.config)

    const registrations = await prisma.tournamentRegistration.findMany({
      where: {
        tournamentId,
        ...(confirmedOnly ? { isConfirmed: true } : {}),
      },
      select: { teamId: true, seed: true, registeredAt: true },
      orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }],
    })

    const maxTeams = groupConfig.count * groupConfig.teamsPerGroup
    const selectedTeams = registrations.slice(0, maxTeams)

    const slotsByGroup = new Map<number, number>()
    const placements: GroupPlacement[] = []

    selectedTeams.forEach((registration, index) => {
      const cycle = Math.floor(index / groupConfig.count)
      const offset = index % groupConfig.count
      const groupIndex = cycle % 2 === 0 ? offset + 1 : groupConfig.count - offset
      const currentSlot = (slotsByGroup.get(groupIndex) ?? 0) + 1

      if (currentSlot <= groupConfig.teamsPerGroup) {
        slotsByGroup.set(groupIndex, currentSlot)
        placements.push({
          teamId: registration.teamId,
          groupIndex,
          slot: currentSlot,
        })
      }
    })

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        config: withGroupConfig(phase.config, {
          ...groupConfig,
          placements,
        }),
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${placements.length} equipe(s) placee(s) automatiquement.` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur auto placement.' }
  }
}

export async function setGroupPlacement(
  formData: FormData
): Promise<ActionState> {
  const parsed = SetGroupPlacementSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Placement manuel invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, groupIndex, slot, teamId } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const phase = await assertGroupPhaseBelongsTournament(phaseId, tournamentId)

    const groupConfig = readGroupPhaseConfig(phase.config)
    if (groupIndex > groupConfig.count || slot > groupConfig.teamsPerGroup) {
      return { success: false, message: 'Case de poule invalide.' }
    }

    if (teamId) {
      const registration = await prisma.tournamentRegistration.findFirst({
        where: { tournamentId, teamId },
        select: { id: true },
      })
      if (!registration) {
        return { success: false, message: 'Equipe non inscrite au tournoi.' }
      }
    }

    let placements = groupConfig.placements.filter((placement) => {
      if (placement.groupIndex === groupIndex && placement.slot === slot) return false
      if (teamId && placement.teamId === teamId) return false
      return true
    })

    if (teamId) {
      placements = [...placements, { teamId, groupIndex, slot }]
    }

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        config: withGroupConfig(phase.config, {
          ...groupConfig,
          placements,
        }),
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Placement manuel enregistre.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur placement manuel.' }
  }
}

export async function bulkSetGroupPlacements(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState
  const parsed = BulkSetGroupPlacementsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour le placement visuel.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, placementsJson } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const phase = await assertGroupPhaseBelongsTournament(phaseId, tournamentId)
    const groupConfig = readGroupPhaseConfig(phase.config)

    let rawPlacements: unknown
    try {
      rawPlacements = JSON.parse(placementsJson)
    } catch {
      return { success: false, message: 'Format de placements invalide.' }
    }

    if (!Array.isArray(rawPlacements)) {
      return { success: false, message: 'La liste de placements est invalide.' }
    }

    const placements: GroupPlacement[] = []
    const usedSlots = new Set<string>()
    const usedTeams = new Set<string>()

    for (const item of rawPlacements) {
      if (!item || typeof item !== 'object') {
        return { success: false, message: 'Un placement est mal forme.' }
      }
      const candidate = item as Record<string, unknown>
      if (typeof candidate.teamId !== 'string') {
        return { success: false, message: 'teamId manquant dans un placement.' }
      }
      if (typeof candidate.groupIndex !== 'number' || !Number.isInteger(candidate.groupIndex)) {
        return { success: false, message: 'groupIndex invalide dans un placement.' }
      }
      if (typeof candidate.slot !== 'number' || !Number.isInteger(candidate.slot)) {
        return { success: false, message: 'slot invalide dans un placement.' }
      }

      const normalized: GroupPlacement = {
        teamId: candidate.teamId,
        groupIndex: candidate.groupIndex,
        slot: candidate.slot,
      }

      if (normalized.groupIndex < 1 || normalized.groupIndex > groupConfig.count) {
        return { success: false, message: `Poule ${normalized.groupIndex} hors limites.` }
      }
      if (normalized.slot < 1 || normalized.slot > groupConfig.teamsPerGroup) {
        return { success: false, message: `Slot ${normalized.slot} hors limites.` }
      }

      const slotKey = `${normalized.groupIndex}-${normalized.slot}`
      if (usedSlots.has(slotKey)) {
        return { success: false, message: 'Un slot est utilise plusieurs fois.' }
      }
      if (usedTeams.has(normalized.teamId)) {
        return { success: false, message: 'Une equipe est placee plusieurs fois.' }
      }

      usedSlots.add(slotKey)
      usedTeams.add(normalized.teamId)
      placements.push(normalized)
    }

    if (placements.length > 0) {
      const registrations = await prisma.tournamentRegistration.findMany({
        where: { tournamentId, teamId: { in: placements.map((p) => p.teamId) } },
        select: { teamId: true },
      })
      const registeredIds = new Set(registrations.map((registration) => registration.teamId))
      const allRegistered = placements.every((placement) => registeredIds.has(placement.teamId))
      if (!allRegistered) {
        return { success: false, message: 'Certaines equipes ne sont pas inscrites au tournoi.' }
      }
    }

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        config: withGroupConfig(phase.config, {
          ...groupConfig,
          placements,
        }),
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Placements visuels enregistres.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur de sauvegarde visuelle.' }
  }
}

export async function generateGroupMatchesFromPlacements(
  formData: FormData
): Promise<ActionState> {
  const parsed = GenerateGroupMatchesFromPlacementsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour generation des poules.' }

  const {
    tournamentId,
    orgSlug,
    tournamentSlug,
    phaseId,
    startAt,
    maxDurationMinutes,
    teamBreakMinutes,
    overwritePhaseMatches,
  } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    await assertPreviousRoutingPhaseCompleted(phaseId, tournamentId)
    const phase = await assertGroupPhaseBelongsTournament(phaseId, tournamentId)
    const groupConfig = readGroupPhaseConfig(phase.config)

    const existingMatchesCount = await prisma.match.count({ where: { phaseId } })
    if (existingMatchesCount > 0 && !overwritePhaseMatches) {
      return { success: false, message: 'Des matchs existent deja. Activez overwrite pour regenerer.' }
    }

    const pitches = await prisma.pitch.findMany({
      where: {
        tournamentId,
        OR: [{ phaseId }, { phaseId: null }],
      },
      select: { id: true },
      orderBy: { name: 'asc' },
    })

    if (pitches.length === 0) {
      return { success: false, message: 'Ajoutez au moins une piste associee au tournoi/phase.' }
    }

    const placementGroups = new Map<number, GroupPlacement[]>()
    for (const placement of groupConfig.placements) {
      const current = placementGroups.get(placement.groupIndex) ?? []
      current.push(placement)
      placementGroups.set(placement.groupIndex, current)
    }

    const groupsWithTeams = Array.from(placementGroups.entries())
      .map(([groupIndex, placements]) => ({
        groupIndex,
        teamIds: placements.sort((a, b) => a.slot - b.slot).map((item) => item.teamId),
      }))
      .filter((group) => group.teamIds.length >= 2)

    if (groupsWithTeams.length === 0) {
      return { success: false, message: 'Aucune poule avec au moins 2 equipes placees.' }
    }

    const startDate = startAt ?? new Date()
    const matchDurationMs = maxDurationMinutes * 60 * 1000
    const teamBreakMs = teamBreakMinutes * 60 * 1000

    const pitchAvailableAt = new Map<string, number>(
      pitches.map((pitch) => [pitch.id, startDate.getTime()])
    )
    const allTeamIds = groupsWithTeams.flatMap((group) => group.teamIds)
    const teamAvailableAt = new Map<string, number>(
      allTeamIds.map((teamId) => [teamId, startDate.getTime()])
    )

    const matchesToCreate: Array<{
      phaseId: string
      pitchId: string
      homeTeamId: string
      awayTeamId: string
      roundNumber: number
      bracketPos: string
      scheduledAt: Date
    }> = []

    for (const group of groupsWithTeams) {
      const pairings = buildRoundRobinPairings(group.teamIds)

      pairings.forEach((pairing, pairingIndex) => {
        const homeReadyAt = teamAvailableAt.get(pairing.homeTeamId) ?? startDate.getTime()
        const awayReadyAt = teamAvailableAt.get(pairing.awayTeamId) ?? startDate.getTime()

        let selectedPitchId = pitches[0]?.id
        let selectedStart = Number.POSITIVE_INFINITY

        for (const pitch of pitches) {
          const pitchReadyAt = pitchAvailableAt.get(pitch.id) ?? startDate.getTime()
          const candidateStart = Math.max(startDate.getTime(), pitchReadyAt, homeReadyAt, awayReadyAt)

          if (candidateStart < selectedStart) {
            selectedStart = candidateStart
            selectedPitchId = pitch.id
          }
        }

        const matchEnd = selectedStart + matchDurationMs
        pitchAvailableAt.set(selectedPitchId, matchEnd)
        teamAvailableAt.set(pairing.homeTeamId, matchEnd + teamBreakMs)
        teamAvailableAt.set(pairing.awayTeamId, matchEnd + teamBreakMs)

        matchesToCreate.push({
          phaseId,
          pitchId: selectedPitchId,
          homeTeamId: pairing.homeTeamId,
          awayTeamId: pairing.awayTeamId,
          roundNumber: pairing.round,
          bracketPos: `G${group.groupIndex}-R${pairing.round}-M${pairingIndex + 1}`,
          scheduledAt: new Date(selectedStart),
        })
      })
    }

    await prisma.$transaction(async (tx) => {
      if (existingMatchesCount > 0 && overwritePhaseMatches) {
        await tx.match.deleteMany({ where: { phaseId } })
      }
      await tx.match.createMany({ data: matchesToCreate })
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${matchesToCreate.length} match(s) de poules generes.` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur generation poules.' }
  }
}

export async function bulkUpdateTournamentMatches(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState
  const parsed = BulkMatchUpdateSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour la mise a jour globale.' }

  const { tournamentId, orgSlug, tournamentSlug, updatesJson } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    let rawUpdates: unknown
    try {
      rawUpdates = JSON.parse(updatesJson)
    } catch {
      return { success: false, message: 'Format JSON des mises a jour invalide.' }
    }

    if (!Array.isArray(rawUpdates)) {
      return { success: false, message: 'La liste des mises a jour est invalide.' }
    }

    const normalizedUpdatesResult = z.array(BulkMatchUpdateItemSchema).safeParse(rawUpdates)
    if (!normalizedUpdatesResult.success) {
      return { success: false, message: 'Certaines lignes de mise a jour sont invalides.' }
    }

    const updates = normalizedUpdatesResult.data
    if (updates.length === 0) {
      return { success: false, message: 'Aucune modification a sauvegarder.' }
    }

    const matchIds = updates.map((update) => update.matchId)
    const matches = await prisma.match.findMany({
      where: {
        id: { in: matchIds },
        phase: { tournamentId },
      },
      select: {
        id: true,
        homeTeamId: true,
        awayTeamId: true,
      },
    })

    if (matches.length !== matchIds.length) {
      return { success: false, message: 'Un ou plusieurs matchs sont invalides pour ce tournoi.' }
    }

    const matchById = new Map(matches.map((match) => [match.id, match]))

    await prisma.$transaction(async (tx) => {
      for (const update of updates) {
        const match = matchById.get(update.matchId)
        if (!match) continue

        if (update.homeScore !== undefined && update.awayScore !== undefined) {
          const homeScore = update.homeScore
          const awayScore = update.awayScore
          let winnerId: string | null = null
          if (homeScore > awayScore) winnerId = match.homeTeamId ?? null
          if (awayScore > homeScore) winnerId = match.awayTeamId ?? null

          await tx.match.update({
            where: { id: update.matchId },
            data: {
              status: MatchStatus.FINISHED,
              playedAt: new Date(),
            },
          })

          await tx.matchResult.upsert({
            where: { matchId: update.matchId },
            update: {
              homeScore,
              awayScore,
              notes: update.notes ?? null,
              winnerId,
            },
            create: {
              matchId: update.matchId,
              homeScore,
              awayScore,
              notes: update.notes ?? null,
              winnerId,
            },
          })
        } else if (update.status) {
          await tx.match.update({
            where: { id: update.matchId },
            data: {
              status: update.status as MatchStatus,
              ...(update.status === 'FINISHED' ? { playedAt: new Date() } : {}),
            },
          })
        }
      }
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${updates.length} match(s) mis a jour.` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors de la sauvegarde globale.',
    }
  }
}

export async function closeTournamentPhase(
  formData: FormData
): Promise<ActionState> {
  const parsed = ClosePhaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour cloture de phase.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, forceClose } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const phase = await prisma.phase.findUnique({
      where: { id: phaseId },
      include: {
        matches: {
          select: { status: true },
        },
        tournament: {
          select: {
            id: true,
            phases: {
              select: { id: true, order: true, isCompleted: true, name: true },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    })

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (!forceClose) {
      const unfinishedMatchExists = phase.matches.some(
        (match) => match.status !== MatchStatus.FINISHED && match.status !== MatchStatus.CANCELLED
      )

      if (unfinishedMatchExists) {
        return {
          success: false,
          message: 'Impossible de cloturer: des matchs ne sont pas termines (active forceClose si necessaire).',
        }
      }
    }

    const orderedPhases = phase.tournament.phases
    const currentIndex = orderedPhases.findIndex((item) => item.id === phaseId)
    const nextPhase = currentIndex >= 0 ? orderedPhases[currentIndex + 1] : null

    const completedCount = orderedPhases.filter((item) => item.isCompleted).length + (phase.isCompleted ? 0 : 1)
    const allCompleted = completedCount >= orderedPhases.length

    await prisma.$transaction(async (tx) => {
      await tx.phase.update({
        where: { id: phaseId },
        data: { isCompleted: true },
      })

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: allCompleted ? 'FINISHED' : 'ONGOING' },
      })

      // Propagate qualifiers to the next phase's bracket seed slots
      await propagateQualifiersToNextPhase(tx, {
        id: phase.id,
        type: phase.type,
        config: phase.config,
      })
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    if (allCompleted) {
      return { success: true, message: 'Phase cloturee. Les qualifies ont ete places. Tournoi termine.' }
    }

    if (nextPhase) {
      return {
        success: true,
        message: `Phase cloturee. Les qualifies ont ete places dans "${nextPhase.name}".`,
      }
    }

    return { success: true, message: 'Phase cloturee. Les qualifies ont ete propagés.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors de la cloture de phase.',
    }
  }
}

export async function generateCustomPlacementBracketMatches(
  formData: FormData
): Promise<ActionState> {
  const parsed = GenerateCustomPlacementBracketSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour bracket personnalise.' }

  const {
    tournamentId,
    orgSlug,
    tournamentSlug,
    phaseId,
    participantsCount,
    includeLosersReplay,
    overwritePhaseMatches,
  } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const phase = await prisma.phase.findUnique({
      where: { id: phaseId },
      select: { id: true, type: true, tournamentId: true },
    })

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (
      phase.type !== 'CUSTOM' &&
      phase.type !== 'BRACKET_DOUBLE' &&
      phase.type !== 'BRACKET_SINGLE' &&
      phase.type !== 'PLACEMENT_BRACKET'
    ) {
      return {
        success: false,
        message: 'Cette generation est reservee aux phases bracket/custom/placement.',
      }
    }

    const pitches = await prisma.pitch.findMany({
      where: {
        tournamentId,
        OR: [{ phaseId }, { phaseId: null }],
      },
      select: { id: true },
      orderBy: { name: 'asc' },
    })

    if (pitches.length === 0) {
      return { success: false, message: 'Ajoutez au moins une piste associee au tournoi/phase.' }
    }

    const existing = await prisma.match.count({ where: { phaseId } })
    if (existing > 0 && !overwritePhaseMatches) {
      return { success: false, message: 'Des matchs existent deja (active overwrite pour regenerer).' }
    }

    const rounds = Math.ceil(Math.log2(participantsCount))
    const normalizedSize = 2 ** rounds

    const skeleton: Array<{
      phaseId: string
      pitchId: string
      roundNumber: number
      bracketPos: string
    }> = []

    let pitchCursor = 0
    for (let round = 1; round <= rounds; round += 1) {
      const matchesInRound = normalizedSize / 2 ** round
      for (let matchNo = 1; matchNo <= matchesInRound; matchNo += 1) {
        skeleton.push({
          phaseId,
          pitchId: pitches[pitchCursor % pitches.length].id,
          roundNumber: round,
          bracketPos: `WB-R${round}-M${matchNo}`,
        })
        pitchCursor += 1
      }
    }

    if (includeLosersReplay) {
      for (let round = 1; round <= rounds; round += 1) {
        const matchesInRound = Math.max(1, normalizedSize / 2 ** (round + 1))
        for (let matchNo = 1; matchNo <= matchesInRound; matchNo += 1) {
          skeleton.push({
            phaseId,
            pitchId: pitches[pitchCursor % pitches.length].id,
            roundNumber: rounds + round,
            bracketPos: `LB-R${round}-M${matchNo}`,
          })
          pitchCursor += 1
        }
      }
    }

    if (normalizedSize >= 4) {
      for (let place = 3; place <= normalizedSize; place += 2) {
        skeleton.push({
          phaseId,
          pitchId: pitches[pitchCursor % pitches.length].id,
          roundNumber: rounds + 10,
          bracketPos: `P${place}-P${place + 1}`,
        })
        pitchCursor += 1
      }
    }

    await prisma.$transaction(async (tx) => {
      if (existing > 0 && overwritePhaseMatches) {
        await tx.match.deleteMany({ where: { phaseId } })
      }
      await tx.match.createMany({ data: skeleton })
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${skeleton.length} match(s) de bracket personnalise generes.` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur generation bracket personnalise.',
    }
  }
}
