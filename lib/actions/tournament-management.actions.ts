'use server'

import { MatchStatus, OrgRole, PhaseType, Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getAuthUser } from './utils.actions'
import { validatePhaseFlow } from '@/lib/tournament/phase-flow'

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
  phaseIds: z.array(z.string().uuid()).optional(),
})

const UpdatePhaseFlowSchema = ManageTournamentBaseSchema.extend({
  phasesJson: z.string().min(2),
})

const DeletePitchSchema = ManageTournamentBaseSchema.extend({
  pitchId: z.string().uuid(),
})

const RegistrationSchema = ManageTournamentBaseSchema.extend({
  teamIds: z.array(z.string().uuid()).min(1),
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

const DeleteSelectedMatchesSchema = ManageTournamentBaseSchema.extend({
  matchIds: z.array(z.string().uuid()).min(1),
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

const BulkCreateMatchesSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  matchesJson: z.string().min(2),
  maxDurationMinutes: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 30 : Number(v)),
    z.number().int().min(5).max(600)
  ),
  teamBreakMinutes: z.preprocess(
    (v) => (v === '' || v === null || v === undefined ? 0 : Number(v)),
    z.number().int().min(0).max(240)
  ),
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
  startAt: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? undefined : date
  }, z.date().optional()),
  includeLosersReplay: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
  overwritePhaseMatches: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const BulkBracketSeedAssignSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  seedsJson: z.string().min(2),
})

const BracketSeedAssignItemSchema = z.object({
  matchId: z.string().uuid(),
  homeTeamId: z.string().uuid().optional().or(z.literal('')),
  awayTeamId: z.string().uuid().optional().or(z.literal('')),
})

const DEFAULT_EXISTING_MATCH_DURATION_MINUTES = 30

function toPitchResourceKey(pitchName: string) {
  const normalized = pitchName.trim().toLowerCase()
  return normalized.length > 0 ? normalized : pitchName
}

function uniquePitchResources(pitches: Array<{ id: string; name: string }>) {
  const resources = new Map<string, { id: string; key: string }>()
  for (const pitch of pitches) {
    const key = toPitchResourceKey(pitch.name)
    if (!resources.has(key)) {
      resources.set(key, { id: pitch.id, key })
    }
  }
  return Array.from(resources.values())
}

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

async function recordTournamentAction(params: {
  tournamentId: string
  actionType: string
  message: string
  payload?: Prisma.InputJsonValue
}) {
  try {
    const user = await getAuthUser()
    const metadata =
      user.user_metadata && typeof user.user_metadata === 'object'
        ? (user.user_metadata as Record<string, unknown>)
        : null
    const actorName =
      (typeof metadata?.display_name === 'string' && metadata.display_name) ||
      (typeof metadata?.username === 'string' && metadata.username) ||
      user.email ||
      user.id

    await prisma.tournamentActionLog.create({
      data: {
        tournamentId: params.tournamentId,
        actionType: params.actionType,
        message: params.message,
        payload: params.payload,
        actorId: user.id,
        actorName,
      },
    })
  } catch {
    // Audit logging must never block tournament operations.
  }
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

function parseBracketCoordinate(bracketPos: string | null) {
  if (!bracketPos) return null
  const m = bracketPos.match(/^(WB|LB)-R(\d+)-M(\d+)$/)
  if (!m) return null
  const lane = m[1] as 'WB' | 'LB'
  const round = Number(m[2])
  const matchNo = Number(m[3])
  if (!Number.isInteger(round) || !Number.isInteger(matchNo) || round < 1 || matchNo < 1) return null
  return { lane, round, matchNo }
}

function parsePlacementBracketCoordinate(bracketPos: string | null) {
  if (!bracketPos) return null
  const m = bracketPos.match(/^P(\d+)-(\d+)-R(\d+)-M(\d+)$/)
  if (!m) return null
  const start = Number(m[1])
  const end = Number(m[2])
  const round = Number(m[3])
  const matchNo = Number(m[4])
  if (!Number.isInteger(start) || !Number.isInteger(end) || !Number.isInteger(round) || !Number.isInteger(matchNo)) return null
  return { start, end, round, matchNo, size: end - start + 1 }
}

function buildPlacementRangeSkeleton(params: {
  phaseId: string
  rangeStart: number
  rangeEnd: number
  pitches: Array<{ id: string }>
  pitchCursorRef: { value: number }
  baseStartMs: number | null
  roundDurationMs: number
  stageOffset: number
}): Array<{
  phaseId: string
  pitchId: string
  roundNumber: number
  bracketPos: string
  scheduledAt?: Date | null
}> {
  const { phaseId, rangeStart, rangeEnd, pitches, pitchCursorRef, baseStartMs, roundDurationMs, stageOffset } = params
  const size = rangeEnd - rangeStart + 1
  const rounds = Math.log2(size)
  if (!Number.isInteger(rounds) || size < 2) return []

  const skeleton: Array<{
    phaseId: string
    pitchId: string
    roundNumber: number
    bracketPos: string
    scheduledAt?: Date | null
  }> = []

  for (let round = 1; round <= rounds; round += 1) {
    const matchesInRound = size / 2 ** round
    for (let matchNo = 1; matchNo <= matchesInRound; matchNo += 1) {
      skeleton.push({
        phaseId,
        pitchId: pitches[pitchCursorRef.value % pitches.length].id,
        roundNumber: stageOffset + round,
        bracketPos: `P${rangeStart}-${rangeEnd}-R${round}-M${matchNo}`,
        ...(baseStartMs !== null ? { scheduledAt: new Date(baseStartMs + (stageOffset + round - 1) * roundDurationMs) } : {}),
      })
      pitchCursorRef.value += 1
    }
  }

  for (let round = 1; round < rounds; round += 1) {
    const childStart = rangeStart + size / 2 ** round
    const childEnd = rangeStart + size / 2 ** (round - 1) - 1
    skeleton.push(
      ...buildPlacementRangeSkeleton({
        phaseId,
        rangeStart: childStart,
        rangeEnd: childEnd,
        pitches,
        pitchCursorRef,
        baseStartMs,
        roundDurationMs,
        stageOffset: stageOffset + round,
      })
    )
  }

  return skeleton
}

async function assignTeamToBracketSlot(
  tx: Prisma.TransactionClient,
  params: {
    phaseId: string
    targetBracketPos: string
    side: 'homeTeamId' | 'awayTeamId'
    teamId: string | null
    sourceHomeTeamId: string | null
    sourceAwayTeamId: string | null
  }
) {
  if (!params.teamId) return

  const target = await tx.match.findFirst({
    where: {
      phaseId: params.phaseId,
      bracketPos: params.targetBracketPos,
    },
    select: {
      id: true,
      status: true,
      homeTeamId: true,
      awayTeamId: true,
    },
  })

  if (!target) return
  if (target.status === MatchStatus.FINISHED || target.status === MatchStatus.CANCELLED) return

  const currentValue = params.side === 'homeTeamId' ? target.homeTeamId : target.awayTeamId
  if (
    currentValue &&
    currentValue !== params.sourceHomeTeamId &&
    currentValue !== params.sourceAwayTeamId &&
    currentValue !== params.teamId
  ) {
    return
  }

  if (currentValue === params.teamId) return

  await tx.match.update({
    where: { id: target.id },
    data: {
      [params.side]: params.teamId,
    },
  })
}

async function propagateWinnerToNextBracketMatch(
  tx: Prisma.TransactionClient,
  source: {
    phaseId: string
    phaseType: PhaseType
    bracketPos: string | null
    homeTeamId: string | null
    awayTeamId: string | null
    winnerId: string | null
    loserId: string | null
  }
) {
  const parsed = parseBracketCoordinate(source.bracketPos)
  if (parsed) {
    if (source.winnerId) {
      const nextRound = parsed.round + 1
      const nextMatchNo = Math.ceil(parsed.matchNo / 2)
      const nextBracketPos = `${parsed.lane}-R${nextRound}-M${nextMatchNo}`
      await assignTeamToBracketSlot(tx, {
        phaseId: source.phaseId,
        targetBracketPos: nextBracketPos,
        side: parsed.matchNo % 2 === 1 ? 'homeTeamId' : 'awayTeamId',
        teamId: source.winnerId,
        sourceHomeTeamId: source.homeTeamId,
        sourceAwayTeamId: source.awayTeamId,
      })
    }

    if (source.phaseType === PhaseType.PLACEMENT_BRACKET && source.loserId && parsed.lane === 'WB') {
      const wbRounds = await tx.match.aggregate({
        where: { phaseId: source.phaseId, bracketPos: { startsWith: 'WB-R' } },
        _max: { roundNumber: true },
      })
      const totalWbRounds = wbRounds._max.roundNumber ?? 0
      if (parsed.round < totalWbRounds) {
        const normalizedSize = 2 ** totalWbRounds
        const rangeStart = normalizedSize / 2 ** parsed.round + 1
        const rangeEnd = normalizedSize / 2 ** (parsed.round - 1)
        await assignTeamToBracketSlot(tx, {
          phaseId: source.phaseId,
          targetBracketPos: `P${rangeStart}-${rangeEnd}-R1-M${Math.ceil(parsed.matchNo / 2)}`,
          side: parsed.matchNo % 2 === 1 ? 'homeTeamId' : 'awayTeamId',
          teamId: source.loserId,
          sourceHomeTeamId: source.homeTeamId,
          sourceAwayTeamId: source.awayTeamId,
        })
      }
    }
    return
  }

  const placement = parsePlacementBracketCoordinate(source.bracketPos)
  if (!placement) return

  if (source.winnerId && placement.round < Math.log2(placement.size)) {
    await assignTeamToBracketSlot(tx, {
      phaseId: source.phaseId,
      targetBracketPos: `P${placement.start}-${placement.end}-R${placement.round + 1}-M${Math.ceil(placement.matchNo / 2)}`,
      side: placement.matchNo % 2 === 1 ? 'homeTeamId' : 'awayTeamId',
      teamId: source.winnerId,
      sourceHomeTeamId: source.homeTeamId,
      sourceAwayTeamId: source.awayTeamId,
    })
  }

  if (source.loserId && placement.round < Math.log2(placement.size)) {
    const childStart = placement.start + placement.size / 2 ** placement.round
    const childEnd = placement.start + placement.size / 2 ** (placement.round - 1) - 1
    await assignTeamToBracketSlot(tx, {
      phaseId: source.phaseId,
      targetBracketPos: `P${childStart}-${childEnd}-R1-M${Math.ceil(placement.matchNo / 2)}`,
      side: placement.matchNo % 2 === 1 ? 'homeTeamId' : 'awayTeamId',
      teamId: source.loserId,
      sourceHomeTeamId: source.homeTeamId,
      sourceAwayTeamId: source.awayTeamId,
    })
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

type SchedulablePairing = {
  homeTeamId: string
  awayTeamId: string
  round: number
  bracketPos?: string
}

function scheduleRoundRobinMatches(params: {
  phaseId: string
  pairings: SchedulablePairing[]
  pitchResources: Array<{ id: string; key: string }>
  startTimeMs: number
  matchDurationMs: number
  teamBreakMs: number
  pitchAvailableAt: Map<string, number>
  teamAvailableAt: Map<string, number>
}) {
  const {
    phaseId,
    pairings,
    pitchResources,
    startTimeMs,
    matchDurationMs,
    teamBreakMs,
    pitchAvailableAt,
    teamAvailableAt,
  } = params

  const pending = [...pairings]
  const scheduled: Array<{
    phaseId: string
    pitchId: string
    homeTeamId: string
    awayTeamId: string
    roundNumber: number
    bracketPos?: string
    scheduledAt: Date
  }> = []

  while (pending.length > 0) {
    let bestPairingIndex = 0
    let bestPitchId = pitchResources[0]?.id
    let bestPitchKey = pitchResources[0]?.key
    let bestStart = Number.POSITIVE_INFINITY

    for (let pairingIndex = 0; pairingIndex < pending.length; pairingIndex += 1) {
      const pairing = pending[pairingIndex]
      const homeReadyAt = teamAvailableAt.get(pairing.homeTeamId) ?? startTimeMs
      const awayReadyAt = teamAvailableAt.get(pairing.awayTeamId) ?? startTimeMs

      for (const pitch of pitchResources) {
        const pitchReadyAt = pitchAvailableAt.get(pitch.key) ?? startTimeMs
        const candidateStart = Math.max(startTimeMs, pitchReadyAt, homeReadyAt, awayReadyAt)

        if (
          candidateStart < bestStart ||
          (candidateStart === bestStart && pairing.round < (pending[bestPairingIndex]?.round ?? Number.POSITIVE_INFINITY))
        ) {
          bestStart = candidateStart
          bestPitchId = pitch.id
          bestPitchKey = pitch.key
          bestPairingIndex = pairingIndex
        }
      }
    }

    const pairing = pending.splice(bestPairingIndex, 1)[0]
    const matchEnd = bestStart + matchDurationMs

    if (bestPitchKey) {
      pitchAvailableAt.set(bestPitchKey, matchEnd)
    }
    teamAvailableAt.set(pairing.homeTeamId, matchEnd + teamBreakMs)
    teamAvailableAt.set(pairing.awayTeamId, matchEnd + teamBreakMs)

    scheduled.push({
      phaseId,
      pitchId: bestPitchId,
      homeTeamId: pairing.homeTeamId,
      awayTeamId: pairing.awayTeamId,
      roundNumber: pairing.round,
      ...(pairing.bracketPos ? { bracketPos: pairing.bracketPos } : {}),
      scheduledAt: new Date(bestStart),
    })
  }

  return scheduled
}

export async function createTournamentPitch(
  formData: FormData
): Promise<ActionState> {
  const rawPhaseIds = formData
    .getAll('phaseIds')
    .map((value) => String(value).trim())
    .filter(Boolean)
  const fallbackPhaseId = String(formData.get('phaseId') ?? '').trim()
  const phaseIds = rawPhaseIds.length > 0 ? rawPhaseIds : fallbackPhaseId ? [fallbackPhaseId] : []

  const parsed = CreatePitchSchema.safeParse({
    ...Object.fromEntries(formData),
    phaseIds,
  })
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour la piste.' }

  const { tournamentId, orgSlug, tournamentSlug, name } = parsed.data
  const uniquePhaseIds = [...new Set(parsed.data.phaseIds ?? [])]

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    if (uniquePhaseIds.length > 0) {
      const phases = await prisma.phase.findMany({
        where: {
          tournamentId,
          id: { in: uniquePhaseIds },
        },
        select: { id: true },
      })

      if (phases.length !== uniquePhaseIds.length) {
        return { success: false, message: 'Une ou plusieurs phases selectionnees sont invalides.' }
      }
    }

    const existing = await prisma.pitch.findMany({
      where: {
        tournamentId,
        name,
        ...(uniquePhaseIds.length > 0
          ? { phaseId: { in: uniquePhaseIds } }
          : { phaseId: null }),
      },
      select: { phaseId: true },
    })

    const existingPhaseKeys = new Set(existing.map((pitch) => pitch.phaseId ?? '__ALL__'))
    const targetPhaseIds = uniquePhaseIds.length > 0 ? uniquePhaseIds : [null]
    const rows = targetPhaseIds
      .filter((phaseId) => !existingPhaseKeys.has(phaseId ?? '__ALL__'))
      .map((phaseId) => ({
        name,
        tournamentId,
        phaseId,
      }))

    if (rows.length === 0) {
      return { success: false, message: 'Cette piste est deja associee aux phases selectionnees.' }
    }

    await prisma.pitch.createMany({
      data: rows,
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'PITCH_CREATE',
      message: rows.length > 1 ? `${rows.length} associations de piste creees (${name}).` : `Piste creee (${name}).`,
      payload: {
        name,
        createdCount: rows.length,
        phaseIds: targetPhaseIds,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: rows.length > 1 ? `${rows.length} associations de piste ajoutees.` : 'Piste ajoutee.',
    }
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

    const pitch = await prisma.pitch.findUnique({
      where: { id: pitchId },
      select: { id: true, name: true, phaseId: true, tournamentId: true },
    })
    if (!pitch || pitch.tournamentId !== tournamentId) return

    const linkedMatches = await prisma.match.count({ where: { pitchId } })
    if (linkedMatches > 0) return

    await prisma.pitch.delete({ where: { id: pitchId } })

    await recordTournamentAction({
      tournamentId,
      actionType: 'PITCH_DELETE',
      message: `Piste supprimee (${pitch.name}).`,
      payload: { pitchId: pitch.id, name: pitch.name, phaseId: pitch.phaseId },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
  } catch {
    return
  }
}

export async function updateTournamentPhaseFlow(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState
  const parsed = UpdatePhaseFlowSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour les phases.' }

  const { tournamentId, orgSlug, tournamentSlug, phasesJson } = parsed.data

  let rawFlow: unknown
  try {
    rawFlow = JSON.parse(phasesJson)
  } catch {
    return { success: false, message: 'Le JSON des phases est invalide.' }
  }

  const validatedFlow = validatePhaseFlow(rawFlow)
  if (!validatedFlow.success) {
    return {
      success: false,
      message: 'flatten' in validatedFlow.error
        ? validatedFlow.error.flatten().formErrors[0] || 'Configuration des phases invalide.'
        : validatedFlow.error.message,
    }
  }

  const phaseFlow = [...validatedFlow.data].sort((a, b) => a.order - b.order)

  try {
    const tournament = await assertOrganizerCanManageTournament(tournamentId)

    await prisma.$transaction(async (tx) => {
      const existingPhases = await tx.phase.findMany({
        where: { tournamentId },
        include: {
          _count: { select: { matches: true } },
        },
      })

      const existingByKey = new Map<string, (typeof existingPhases)[number]>()
      for (const phase of existingPhases) {
        const config = phase.config && typeof phase.config === 'object'
          ? (phase.config as Record<string, unknown>)
          : {}
        const key = typeof config.key === 'string' ? config.key : ''
        if (key) existingByKey.set(key, phase)
      }

      const flowKeys = new Set(phaseFlow.map((phase) => phase.key))
      const phasesToDelete = existingPhases.filter((phase) => {
        const config = phase.config && typeof phase.config === 'object'
          ? (phase.config as Record<string, unknown>)
          : {}
        const key = typeof config.key === 'string' ? config.key : ''
        return key ? !flowKeys.has(key) : false
      })

      const blockedDelete = phasesToDelete.find((phase) => phase._count.matches > 0)
      if (blockedDelete) {
        throw new Error(`Impossible de supprimer la phase "${blockedDelete.name}": des matchs existent deja.`)
      }

      if (phasesToDelete.length > 0) {
        const idsToDelete = phasesToDelete.map((phase) => phase.id)
        await tx.pitch.updateMany({
          where: { tournamentId, phaseId: { in: idsToDelete } },
          data: { phaseId: null },
        })
        await tx.phase.deleteMany({ where: { id: { in: idsToDelete } } })
      }

      const phaseIdByKey = new Map<string, string>()

      for (const phase of phaseFlow) {
        const existing = existingByKey.get(phase.key)
        if (existing) {
          const existingConfig = existing.config && typeof existing.config === 'object'
            ? (existing.config as Record<string, unknown>)
            : {}
          await tx.phase.update({
            where: { id: existing.id },
            data: {
              name: phase.name,
              type: phase.type,
              order: phase.order,
              config: {
                ...existingConfig,
                ...(phase.config ?? {}),
                key: phase.key,
                routes: [],
              },
            },
          })
          phaseIdByKey.set(phase.key, existing.id)
          continue
        }

        const created = await tx.phase.create({
          data: {
            tournamentId,
            name: phase.name,
            type: phase.type,
            order: phase.order,
            config: {
              ...(phase.config ?? {}),
              key: phase.key,
              routes: [],
            },
          },
        })
        phaseIdByKey.set(phase.key, created.id)
      }

      for (const phase of phaseFlow) {
        const phaseId = phaseIdByKey.get(phase.key)
        if (!phaseId) continue

        const resolvedRoutes = phase.routes.map((route) => ({
          ...route,
          toPhaseId: phaseIdByKey.get(route.toPhaseKey) || null,
        }))

        await tx.phase.update({
          where: { id: phaseId },
          data: {
            config: {
              ...(phase.config ?? {}),
              key: phase.key,
              routes: resolvedRoutes,
            },
          },
        })
      }
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    revalidatePath(`/public/${orgSlug}/${tournament.slug}`)
    await recordTournamentAction({
      tournamentId,
      actionType: 'PHASE_FLOW_UPDATE',
      message: 'Structure des phases mise a jour.',
      payload: { phaseCount: phaseFlow.length },
    })
    return { success: true, message: 'Structure des phases mise a jour.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors de la mise a jour des phases.',
    }
  }
}

export async function addTournamentRegistration(
  formData: FormData
): Promise<ActionState> {
  const rawTeamIds = formData
    .getAll('teamIds')
    .map((value) => String(value).trim())
    .filter(Boolean)
  const fallbackTeamId = String(formData.get('teamId') ?? '').trim()
  const teamIds = rawTeamIds.length > 0 ? rawTeamIds : fallbackTeamId ? [fallbackTeamId] : []

  const parsed = RegistrationSchema.safeParse({
    ...Object.fromEntries(formData),
    teamIds,
  })
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour inscription.' }

  const { tournamentId, orgSlug, tournamentSlug, seed, isConfirmed } = parsed.data
  const uniqueTeamIds = [...new Set(parsed.data.teamIds)]

  try {
    const tournament = await assertOrganizerCanManageTournament(tournamentId)

    const teams = await prisma.team.findMany({
      where: { id: { in: uniqueTeamIds } },
      select: { id: true, organizationId: true },
    })

    if (teams.length !== uniqueTeamIds.length) {
      return { success: false, message: 'Une ou plusieurs equipes sont introuvables.' }
    }

    const hasForeignTeam = teams.some((team) => team.organizationId !== tournament.organizationId)
    if (hasForeignTeam) {
      return { success: false, message: "Equipe invalide pour cette organisation." }
    }

    if (tournament.maxTeams) {
      const currentCount = await prisma.tournamentRegistration.count({ where: { tournamentId } })
      const remainingSlots = Math.max(0, tournament.maxTeams - currentCount)
      if (uniqueTeamIds.length > remainingSlots) {
        return {
          success: false,
          message: `Il reste ${remainingSlots} place(s). Selectionnez moins d'equipes.`,
        }
      }
    }

    const rows = uniqueTeamIds.map((teamId, index) => ({
      tournamentId,
      teamId,
      seed: typeof seed === 'number' ? seed + index : null,
      isConfirmed,
    }))

    const result = await prisma.tournamentRegistration.createMany({
      data: rows,
      skipDuplicates: true,
    })

    if (result.count === 0) {
      return { success: false, message: 'Aucune nouvelle equipe ajoutee (deja inscrites).' }
    }

    await recordTournamentAction({
      tournamentId,
      actionType: 'REGISTRATION_ADD',
      message: result.count > 1 ? `${result.count} equipes inscrites au tournoi.` : 'Equipe inscrite au tournoi.',
      payload: {
        teamIds: uniqueTeamIds,
        insertedCount: result.count,
        isConfirmed,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: result.count > 1 ? `${result.count} equipes inscrites au tournoi.` : 'Equipe inscrite au tournoi.',
    }
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

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: { id: true, teamId: true, tournamentId: true },
    })
    if (!registration || registration.tournamentId !== tournamentId) return

    await prisma.tournamentRegistration.delete({ where: { id: registrationId } })

    await recordTournamentAction({
      tournamentId,
      actionType: 'REGISTRATION_REMOVE',
      message: 'Inscription d\'equipe retiree.',
      payload: { registrationId, teamId: registration.teamId },
    })

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
      prisma.pitch.findUnique({ where: { id: pitchId }, select: { id: true, tournamentId: true, name: true } }),
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

      const selectedPitchKey = toPitchResourceKey(pitch.name)

      const existingMatches = await prisma.match.findMany({
        where: {
          phase: { tournamentId },
          scheduledAt: { not: null },
          status: { not: MatchStatus.CANCELLED },
        },
        select: {
          id: true,
          pitchId: true,
          pitch: { select: { name: true } },
          homeTeamId: true,
          awayTeamId: true,
          scheduledAt: true,
        },
      })

      const hasPitchConflict = existingMatches.some((existingMatch) => {
        if (!existingMatch.scheduledAt) return false
        const existingPitchKey = toPitchResourceKey(existingMatch.pitch.name)
        if (existingPitchKey !== selectedPitchKey) return false
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

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_CREATE',
      message: 'Creation manuelle d\'un match.',
      payload: {
        phaseId,
        pitchId,
        homeTeamId: homeTeamId || null,
        awayTeamId: awayTeamId || null,
        roundNumber: roundNumber ?? null,
        bracketPos: bracketPos || null,
        scheduledAt: scheduledAt ? scheduledAt.toISOString() : null,
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
      select: {
        id: true,
        phaseId: true,
        bracketPos: true,
        homeTeamId: true,
        awayTeamId: true,
        phase: { select: { type: true } },
      },
    })

    if (!match) return { success: false, message: 'Match introuvable.' }

    let winnerId: string | null = null
    if (homeScore > awayScore) winnerId = match.homeTeamId ?? null
    if (awayScore > homeScore) winnerId = match.awayTeamId ?? null
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

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_DELETE',
      message: 'Suppression d\'un match.',
      payload: { matchId },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
  } catch {
    return
  }
}

export async function deleteSelectedTournamentMatches(formData: FormData): Promise<ActionState> {
  const parsed = DeleteSelectedMatchesSchema.safeParse({
    ...Object.fromEntries(formData),
    matchIds: formData.getAll('matchIds').map((value) => String(value).trim()).filter(Boolean),
  })
  if (!parsed.success) return { success: false, message: 'Selection invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, matchIds } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const deleted = await prisma.match.deleteMany({
      where: {
        id: { in: matchIds },
        phase: { tournamentId },
      },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_BULK_DELETE',
      message: `${deleted.count} match(s) supprimes via selection multiple.`,
      payload: { requestedCount: matchIds.length, deletedCount: deleted.count, matchIds },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: deleted.count > 0 ? `${deleted.count} match(s) supprimes.` : 'Aucun match supprime.',
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur suppression selection.' }
  }
}

export async function deleteAllTournamentMatches(formData: FormData): Promise<ActionState> {
  const parsed = ManageTournamentBaseSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour suppression globale.' }

  const { tournamentId, orgSlug, tournamentSlug } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const deleted = await prisma.match.deleteMany({
      where: {
        phase: { tournamentId },
      },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_DELETE_ALL',
      message: `${deleted.count} match(s) supprimes sur le tournoi.`,
      payload: { deletedCount: deleted.count },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: deleted.count > 0 ? `${deleted.count} match(s) supprimes.` : 'Aucun match a supprimer.',
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur suppression globale.' }
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
      prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, tournamentId: true, type: true, config: true } }),
      prisma.pitch.findMany({
        where: {
          tournamentId,
          OR: [{ phaseId }, { phaseId: null }],
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
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

    const pitchResources = uniquePitchResources(pitches)

    const existingScheduledMatches = await prisma.match.findMany({
      where: {
        phase: { tournamentId },
        scheduledAt: { not: null },
        status: { not: MatchStatus.CANCELLED },
      },
      select: {
        scheduledAt: true,
        pitch: { select: { name: true } },
      },
    })

    const startDate = startAt ?? new Date()
    const matchDurationMs = maxDurationMinutes * 60 * 1000
    const teamBreakMs = teamBreakMinutes * 60 * 1000

    const pitchAvailableAt = new Map<string, number>(
      pitchResources.map((pitch) => [pitch.key, startDate.getTime()])
    )

    for (const existingMatch of existingScheduledMatches) {
      if (!existingMatch.scheduledAt) continue
      const resourceKey = toPitchResourceKey(existingMatch.pitch.name)
      if (!pitchAvailableAt.has(resourceKey)) continue
      const existingEnd = existingMatch.scheduledAt.getTime() + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60 * 1000
      const prev = pitchAvailableAt.get(resourceKey) ?? startDate.getTime()
      if (existingEnd > prev) {
        pitchAvailableAt.set(resourceKey, existingEnd)
      }
    }

    const teamAvailableAt = new Map<string, number>(
      registrations.map((registration) => [registration.teamId, startDate.getTime()])
    )

    const pairingsToSchedule: SchedulablePairing[] = []

    if (phase.type === PhaseType.GROUP) {
      const groupConfig = readGroupPhaseConfig(phase.config)
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

      for (const group of groupsWithTeams) {
        const pairings = buildRoundRobinPairings(group.teamIds)
        pairings.forEach((pairing, pairingIndex) => {
          pairingsToSchedule.push({
            ...pairing,
            bracketPos: `G${group.groupIndex}-R${pairing.round}-M${pairingIndex + 1}`,
          })
        })
      }
    } else {
      const teamIds = registrations.map((registration) => registration.teamId)
      if (teamIds.length < 2) {
        return { success: false, message: 'Au moins 2 equipes sont requises.' }
      }

      const pairings = buildRoundRobinPairings(teamIds)
      pairingsToSchedule.push(...pairings)
    }

    const matchesToCreate = scheduleRoundRobinMatches({
      phaseId,
      pairings: pairingsToSchedule,
      pitchResources,
      startTimeMs: startDate.getTime(),
      matchDurationMs,
      teamBreakMs,
      pitchAvailableAt,
      teamAvailableAt,
    })

    await prisma.match.createMany({ data: matchesToCreate })

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_AUTO_GENERATE',
      message: `${matchesToCreate.length} match(s) generes automatiquement.`,
      payload: {
        phaseId,
        generatedCount: matchesToCreate.length,
        maxDurationMinutes,
        teamBreakMinutes,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${matchesToCreate.length} match(s) generes.` }
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
      select: { id: true, name: true },
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

    const pitchResources = uniquePitchResources(pitches)

    const existingScheduledMatches = await prisma.match.findMany({
      where: {
        phase: { tournamentId },
        scheduledAt: { not: null },
        status: { not: MatchStatus.CANCELLED },
      },
      select: {
        phaseId: true,
        scheduledAt: true,
        pitch: { select: { name: true } },
      },
    })

    const effectiveExistingMatches = overwritePhaseMatches
      ? existingScheduledMatches.filter((match) => match.phaseId !== phaseId)
      : existingScheduledMatches

    const startDate = startAt ?? new Date()
    const matchDurationMs = maxDurationMinutes * 60 * 1000
    const teamBreakMs = teamBreakMinutes * 60 * 1000

    const pitchAvailableAt = new Map<string, number>(
      pitchResources.map((pitch) => [pitch.key, startDate.getTime()])
    )

    for (const existingMatch of effectiveExistingMatches) {
      if (!existingMatch.scheduledAt) continue
      const resourceKey = toPitchResourceKey(existingMatch.pitch.name)
      if (!pitchAvailableAt.has(resourceKey)) continue
      const existingEnd = existingMatch.scheduledAt.getTime() + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60 * 1000
      const prev = pitchAvailableAt.get(resourceKey) ?? startDate.getTime()
      if (existingEnd > prev) {
        pitchAvailableAt.set(resourceKey, existingEnd)
      }
    }

    const allTeamIds = groupsWithTeams.flatMap((group) => group.teamIds)
    const teamAvailableAt = new Map<string, number>(
      allTeamIds.map((teamId) => [teamId, startDate.getTime()])
    )

    const pairingsToSchedule: SchedulablePairing[] = []

    for (const group of groupsWithTeams) {
      const pairings = buildRoundRobinPairings(group.teamIds)

      pairings.forEach((pairing, pairingIndex) => {
        pairingsToSchedule.push({
          ...pairing,
          bracketPos: `G${group.groupIndex}-R${pairing.round}-M${pairingIndex + 1}`,
        })
      })
    }

    const matchesToCreate = scheduleRoundRobinMatches({
      phaseId,
      pairings: pairingsToSchedule,
      pitchResources,
      startTimeMs: startDate.getTime(),
      matchDurationMs,
      teamBreakMs,
      pitchAvailableAt,
      teamAvailableAt,
    })

    await prisma.$transaction(async (tx) => {
      if (existingMatchesCount > 0 && overwritePhaseMatches) {
        await tx.match.deleteMany({ where: { phaseId } })
      }
      await tx.match.createMany({ data: matchesToCreate })
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'GROUP_MATCH_GENERATE',
      message: `${matchesToCreate.length} match(s) de poules generes.`,
      payload: {
        phaseId,
        overwritePhaseMatches,
        generatedCount: matchesToCreate.length,
        maxDurationMinutes,
        teamBreakMinutes,
      },
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
        phaseId: true,
        bracketPos: true,
        phase: { select: { type: true } },
        homeTeamId: true,
        awayTeamId: true,
      },
    })

    if (matches.length !== matchIds.length) {
      return { success: false, message: 'Un ou plusieurs matchs sont invalides pour ce tournoi.' }
    }

    const matchById = new Map(matches.map((match) => [match.id, match]))
    const ops: Prisma.PrismaPromise<unknown>[] = []
    const finishedWithScores: Array<{
      matchId: string
      phaseId: string
      phaseType: PhaseType
      bracketPos: string | null
      homeTeamId: string | null
      awayTeamId: string | null
      winnerId: string | null
      loserId: string | null
    }> = []

    for (const update of updates) {
      const match = matchById.get(update.matchId)
      if (!match) continue

      if (update.homeScore !== undefined && update.awayScore !== undefined) {
        const homeScore = update.homeScore
        const awayScore = update.awayScore
        let winnerId: string | null = null
        if (homeScore > awayScore) winnerId = match.homeTeamId ?? null
        if (awayScore > homeScore) winnerId = match.awayTeamId ?? null
        const loserId =
          winnerId === null
            ? null
            : winnerId === match.homeTeamId
              ? match.awayTeamId ?? null
              : match.homeTeamId ?? null

        finishedWithScores.push({
          matchId: update.matchId,
          phaseId: match.phaseId,
          phaseType: match.phase.type,
          bracketPos: match.bracketPos,
          homeTeamId: match.homeTeamId,
          awayTeamId: match.awayTeamId,
          winnerId,
          loserId,
        })

        ops.push(
          prisma.match.update({
            where: { id: update.matchId },
            data: {
              status: MatchStatus.FINISHED,
              playedAt: new Date(),
            },
          })
        )

        ops.push(
          prisma.matchResult.upsert({
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
        )
      } else if (update.status) {
        ops.push(
          prisma.match.update({
            where: { id: update.matchId },
            data: {
              status: update.status as MatchStatus,
              ...(update.status === 'FINISHED' ? { playedAt: new Date() } : {}),
            },
          })
        )
      }
    }

    // Execute in chunks to avoid long-lived transactions in dev/hot-reload sessions.
    const CHUNK_SIZE = 120
    for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
      const chunk = ops.slice(i, i + CHUNK_SIZE)
      await prisma.$transaction(chunk)
    }

    for (const item of finishedWithScores) {
      await prisma.$transaction(async (tx) => {
        await propagateWinnerToNextBracketMatch(tx, {
          phaseId: item.phaseId,
          phaseType: item.phaseType,
          bracketPos: item.bracketPos,
          homeTeamId: item.homeTeamId,
          awayTeamId: item.awayTeamId,
          winnerId: item.winnerId,
          loserId: item.loserId,
        })
      })
    }

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_BULK_UPDATE',
      message: `${updates.length} match(s) mis a jour en masse.`,
      payload: { updatedCount: updates.length },
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

    await recordTournamentAction({
      tournamentId,
      actionType: 'PHASE_CLOSE',
      message: `Phase cloturee: ${phase.name}.`,
      payload: {
        phaseId,
        phaseName: phase.name,
        forceClose,
        nextPhaseId: nextPhase?.id ?? null,
        tournamentFinished: allCompleted,
      },
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
    startAt,
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

    const [pitches, registrations] = await Promise.all([
      prisma.pitch.findMany({
        where: {
          tournamentId,
          OR: [{ phaseId }, { phaseId: null }],
        },
        select: { id: true },
        orderBy: { name: 'asc' },
      }),
      prisma.tournamentRegistration.findMany({
        where: { tournamentId },
        select: { teamId: true, isConfirmed: true, seed: true, registeredAt: true },
        orderBy: [{ isConfirmed: 'desc' }, { seed: 'asc' }, { registeredAt: 'asc' }],
      }),
    ])

    if (pitches.length === 0) {
      return { success: false, message: 'Ajoutez au moins une piste associee au tournoi/phase.' }
    }

    const existing = await prisma.match.count({ where: { phaseId } })
    if (existing > 0 && !overwritePhaseMatches) {
      return { success: false, message: 'Des matchs existent deja (active overwrite pour regenerer).' }
    }

    const rounds = Math.ceil(Math.log2(participantsCount))
    const normalizedSize = 2 ** rounds
    const baseStartMs = startAt ? startAt.getTime() : null
    const roundDurationMs = 30 * 60 * 1000

    const skeleton: Array<{
      phaseId: string
      pitchId: string
      roundNumber: number
      bracketPos: string
      homeTeamId?: string | null
      awayTeamId?: string | null
      scheduledAt?: Date | null
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
          ...(baseStartMs !== null ? { scheduledAt: new Date(baseStartMs + (round - 1) * roundDurationMs) } : {}),
        })
        pitchCursor += 1
      }
    }

    if (phase.type !== 'PLACEMENT_BRACKET' && includeLosersReplay) {
      for (let round = 1; round <= rounds; round += 1) {
        const matchesInRound = Math.max(1, normalizedSize / 2 ** (round + 1))
        for (let matchNo = 1; matchNo <= matchesInRound; matchNo += 1) {
          skeleton.push({
            phaseId,
            pitchId: pitches[pitchCursor % pitches.length].id,
            roundNumber: rounds + round,
            bracketPos: `LB-R${round}-M${matchNo}`,
            ...(baseStartMs !== null ? { scheduledAt: new Date(baseStartMs + (rounds + round - 1) * roundDurationMs) } : {}),
          })
          pitchCursor += 1
        }
      }
    }

    if (phase.type === 'PLACEMENT_BRACKET' && normalizedSize >= 4) {
      const pitchCursorRef = { value: pitchCursor }
      for (let round = 1; round < rounds; round += 1) {
        const rangeStart = normalizedSize / 2 ** round + 1
        const rangeEnd = normalizedSize / 2 ** (round - 1)
        skeleton.push(
          ...buildPlacementRangeSkeleton({
            phaseId,
            rangeStart,
            rangeEnd,
            pitches,
            pitchCursorRef,
            baseStartMs,
            roundDurationMs,
            stageOffset: rounds + round,
          })
        )
      }
      pitchCursor = pitchCursorRef.value
    } else if (normalizedSize >= 4) {
      for (let place = 3; place <= normalizedSize; place += 2) {
        skeleton.push({
          phaseId,
          pitchId: pitches[pitchCursor % pitches.length].id,
          roundNumber: rounds + 10,
          bracketPos: `P${place}-P${place + 1}`,
          ...(baseStartMs !== null ? { scheduledAt: new Date(baseStartMs + (rounds + 9) * roundDurationMs) } : {}),
        })
        pitchCursor += 1
      }
    }

    const seededTeamIds = registrations
      .map((r) => r.teamId)
      .slice(0, participantsCount)

    const firstRoundMatches = skeleton
      .filter((m) => m.roundNumber === 1 && m.bracketPos.startsWith('WB-R1-'))
      .sort((a, b) => a.bracketPos.localeCompare(b.bracketPos))

    for (let i = 0; i < firstRoundMatches.length; i += 1) {
      const slot = firstRoundMatches[i]
      const home = seededTeamIds[i * 2] ?? null
      const away = seededTeamIds[i * 2 + 1] ?? null
      slot.homeTeamId = home
      slot.awayTeamId = away
    }

    await prisma.$transaction(async (tx) => {
      if (existing > 0 && overwritePhaseMatches) {
        await tx.match.deleteMany({ where: { phaseId } })
      }
      await tx.match.createMany({ data: skeleton })
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'BRACKET_GENERATE',
      message: `${skeleton.length} match(s) de bracket generes. ${Math.min(seededTeamIds.length, normalizedSize)} equipe(s) assignee(s) automatiquement.`,
      payload: {
        phaseId,
        participantsCount,
        startAt: startAt ? startAt.toISOString() : null,
        includeLosersReplay,
        overwritePhaseMatches,
        generatedCount: skeleton.length,
        autoAssignedTeams: Math.min(seededTeamIds.length, normalizedSize),
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${skeleton.length} match(s) de bracket personnalise generes (${Math.min(seededTeamIds.length, normalizedSize)} equipe(s) assignee(s)).` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur generation bracket personnalise.',
    }
  }
}

// ─── Bulk create matches ───────────────────────────────────────────────────────

type BulkMatchInput = {
  scheduledAt: string | null
  pitchName: string
  homeTeamName: string
  awayTeamName: string
}

export async function bulkCreateTournamentMatches(
  formData: FormData
): Promise<ActionState & { created?: number; skippedLines?: string[] }> {
  const parsed = BulkCreateMatchesSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour la creation groupee.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, matchesJson, maxDurationMinutes, teamBreakMinutes } =
    parsed.data

  let inputs: BulkMatchInput[]
  try {
    const raw = JSON.parse(matchesJson)
    if (!Array.isArray(raw)) throw new Error()
    inputs = raw as BulkMatchInput[]
  } catch {
    return { success: false, message: 'Format JSON invalide.' }
  }

  if (inputs.length === 0) return { success: false, message: 'Aucun match a creer.' }
  if (inputs.length > 200) return { success: false, message: 'Maximum 200 matchs par import.' }

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const [phase, pitches, registrations] = await Promise.all([
      prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, tournamentId: true } }),
      prisma.pitch.findMany({
        where: { tournamentId },
        select: { id: true, name: true, phaseId: true },
      }),
      prisma.tournamentRegistration.findMany({
        where: { tournamentId },
        select: { teamId: true, team: { select: { id: true, name: true } } },
      }),
    ])

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    // Group pitches by normalised name — a logical pitch may have one DB row per phase
    const pitchGroupsByName = new Map<string, typeof pitches>()
    for (const p of pitches) {
      const key = p.name.toLowerCase().trim()
      if (!pitchGroupsByName.has(key)) pitchGroupsByName.set(key, [])
      pitchGroupsByName.get(key)!.push(p)
    }

    // Pick the most relevant pitch row for the target phase:
    // 1. same phaseId  2. phaseId null (available for all)  3. any
    function bestPitchInGroup(group: typeof pitches) {
      return (
        group.find((p) => p.phaseId === phaseId) ??
        group.find((p) => p.phaseId === null) ??
        group[0]
      )
    }

    const teamByName = new Map(
      registrations.map((r) => [r.team.name.toLowerCase().trim(), r.team])
    )

    function resolveTeam(query: string) {
      const key = query.toLowerCase().trim()
      if (!key) return null
      const exact = teamByName.get(key)
      if (exact) return exact
      for (const [name, team] of teamByName) {
        if (name.includes(key)) return team
      }
      return null
    }

    function resolvePitch(query: string) {
      const key = query.toLowerCase().trim()
      if (!key) return null
      const exactGroup = pitchGroupsByName.get(key)
      if (exactGroup) return bestPitchInGroup(exactGroup)
      for (const [name, group] of pitchGroupsByName) {
        if (name.includes(key)) return bestPitchInGroup(group)
      }
      return null
    }

    const skippedLines: string[] = []
    const toCreate: Array<{
      phaseId: string
      pitchId: string
      homeTeamId: string | null
      awayTeamId: string | null
      scheduledAt: Date | null
    }> = []

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i]
      const lineLabel = `Ligne ${i + 1}`

      const pitch = resolvePitch(input.pitchName)
      if (!pitch) {
        skippedLines.push(`${lineLabel}: piste introuvable "${input.pitchName}"`)
        continue
      }

      const homeTeam = input.homeTeamName ? resolveTeam(input.homeTeamName) : null
      const awayTeam = input.awayTeamName ? resolveTeam(input.awayTeamName) : null

      if (input.homeTeamName && !homeTeam) {
        skippedLines.push(`${lineLabel}: equipe domicile introuvable "${input.homeTeamName}"`)
        continue
      }
      if (input.awayTeamName && !awayTeam) {
        skippedLines.push(`${lineLabel}: equipe exterieur introuvable "${input.awayTeamName}"`)
        continue
      }

      if (homeTeam && awayTeam && homeTeam.id === awayTeam.id) {
        skippedLines.push(`${lineLabel}: les deux equipes sont identiques`)
        continue
      }

      let scheduledAt: Date | null = null
      if (input.scheduledAt) {
        const d = new Date(input.scheduledAt)
        scheduledAt = Number.isNaN(d.getTime()) ? null : d
      }

      toCreate.push({
        phaseId,
        pitchId: pitch.id,
        homeTeamId: homeTeam?.id ?? null,
        awayTeamId: awayTeam?.id ?? null,
        scheduledAt,
      })
    }

    if (toCreate.length === 0) {
      return {
        success: false,
        message: 'Aucun match valide a creer.',
        skippedLines,
      }
    }

    // Check pitch conflicts for scheduled matches
    const scheduledInputs = toCreate.filter((m) => m.scheduledAt !== null)
    if (scheduledInputs.length > 0) {
      const existingMatches = await prisma.match.findMany({
        where: {
          phase: { tournamentId },
          scheduledAt: { not: null },
          status: { not: MatchStatus.CANCELLED },
        },
        select: {
          pitchId: true,
          pitch: { select: { name: true } },
          homeTeamId: true,
          awayTeamId: true,
          scheduledAt: true,
        },
      })

      for (let i = 0; i < toCreate.length; i++) {
        const m = toCreate[i]
        if (!m.scheduledAt) continue
        const newStart = m.scheduledAt.getTime()
        const newEnd = newStart + maxDurationMinutes * 60_000
        const breakMs = teamBreakMinutes * 60_000

        const hasPitchConflict = existingMatches.some((ex) => {
          if (!ex.scheduledAt || ex.pitchId !== m.pitchId) return false
          const exStart = ex.scheduledAt.getTime()
          const exEnd = exStart + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60_000
          return newStart < exEnd && exStart < newEnd
        })

        if (hasPitchConflict) {
          skippedLines.push(`Ligne ${i + 1}: conflit de piste sur ce creneau`)
          toCreate.splice(i, 1)
          i--
          continue
        }

        const involvedTeamIds = [m.homeTeamId, m.awayTeamId].filter(Boolean) as string[]
        if (involvedTeamIds.length > 0) {
          const hasTeamConflict = existingMatches.some((ex) => {
            if (!ex.scheduledAt) return false
            const exTeamIds = [ex.homeTeamId, ex.awayTeamId].filter(Boolean) as string[]
            if (!involvedTeamIds.some((id) => exTeamIds.includes(id))) return false
            const exStart = ex.scheduledAt.getTime()
            const exEnd = exStart + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60_000
            return (newStart - breakMs) < exEnd && exStart < (newEnd + breakMs)
          })

          if (hasTeamConflict) {
            skippedLines.push(`Ligne ${i + 1}: conflit d'equipe (temps de battement insuffisant)`)
            toCreate.splice(i, 1)
            i--
            continue
          }
        }
      }
    }

    if (toCreate.length === 0) {
      return {
        success: false,
        message: 'Aucun match valide apres verification des conflits.',
        skippedLines,
      }
    }

    await prisma.match.createMany({ data: toCreate })

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_BULK_CREATE',
      message: `${toCreate.length} match(s) crees via ajout groupe.`,
      payload: {
        phaseId,
        createdCount: toCreate.length,
        skippedCount: skippedLines.length,
        maxDurationMinutes,
        teamBreakMinutes,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)

    const skippedMsg = skippedLines.length > 0 ? ` (${skippedLines.length} ligne(s) ignoree(s))` : ''
    return {
      success: true,
      message: `${toCreate.length} match(s) crees avec succes.${skippedMsg}`,
      created: toCreate.length,
      skippedLines,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors de la creation groupee.',
    }
  }
}

export async function bulkAssignBracketSeeds(
  prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  void prevState
  const parsed = BulkBracketSeedAssignSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour l\'affectation du bracket.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, seedsJson } = parsed.data

  let rawSeeds: unknown
  try {
    rawSeeds = JSON.parse(seedsJson)
  } catch {
    return { success: false, message: 'Format JSON invalide pour les seeds.' }
  }

  if (!Array.isArray(rawSeeds)) {
    return { success: false, message: 'Liste des seeds invalide.' }
  }

  const normalized = z.array(BracketSeedAssignItemSchema).safeParse(rawSeeds)
  if (!normalized.success) {
    return { success: false, message: 'Certaines lignes de seed sont invalides.' }
  }

  const seeds = normalized.data
  if (seeds.length === 0) return { success: false, message: 'Aucune modification a sauvegarder.' }

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const [phase, tournamentTeams, matchesToSeed] = await Promise.all([
      prisma.phase.findUnique({ where: { id: phaseId }, select: { id: true, tournamentId: true } }),
      prisma.tournamentRegistration.findMany({ where: { tournamentId }, select: { teamId: true } }),
      prisma.match.findMany({
        where: {
          id: { in: seeds.map((s) => s.matchId) },
          phaseId,
          roundNumber: 1,
        },
        select: { id: true },
      }),
    ])

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (matchesToSeed.length !== seeds.length) {
      return { success: false, message: 'Certains matchs ne sont pas valides pour le seed round 1.' }
    }

    const allowedTeamIds = new Set(tournamentTeams.map((t) => t.teamId))

    const usedTeamIds: string[] = []
    for (const row of seeds) {
      const home = row.homeTeamId || null
      const away = row.awayTeamId || null

      if (home && !allowedTeamIds.has(home)) {
        return { success: false, message: 'Equipe domicile invalide dans la selection.' }
      }
      if (away && !allowedTeamIds.has(away)) {
        return { success: false, message: 'Equipe exterieur invalide dans la selection.' }
      }
      if (home && away && home === away) {
        return { success: false, message: 'Une equipe ne peut pas etre des deux cotes du meme match.' }
      }

      if (home) usedTeamIds.push(home)
      if (away) usedTeamIds.push(away)
    }

    const uniqueUsed = new Set(usedTeamIds)
    if (uniqueUsed.size !== usedTeamIds.length) {
      return { success: false, message: 'Une meme equipe est assignee plusieurs fois au round 1.' }
    }

    await prisma.$transaction(
      seeds.map((row) =>
        prisma.match.update({
          where: { id: row.matchId },
          data: {
            homeTeamId: row.homeTeamId || null,
            awayTeamId: row.awayTeamId || null,
          },
        })
      )
    )

    await recordTournamentAction({
      tournamentId,
      actionType: 'BRACKET_SEED_UPDATE',
      message: `${seeds.length} match(s) de round 1 re-seedes.`,
      payload: { phaseId, updatedMatches: seeds.length },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Seed du bracket mis a jour.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur lors de l\'affectation du bracket.',
    }
  }
}
