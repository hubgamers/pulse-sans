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

const ResetTournamentSchema = ManageTournamentBaseSchema.extend({
  resetRegistrations: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
  resetPitches: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const DuplicateTournamentSchema = ManageTournamentBaseSchema.extend({
  targetName: z.string().min(3).max(100),
  targetSlug: z.string().min(2).max(80),
  includePitches: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const UpdateTournamentOverlayBackgroundSchema = ManageTournamentBaseSchema.extend({
  bannerUrl: z.string().url().optional().or(z.literal('')),
})

const OverlaySponsorSchema = z.object({
  id: z.string().min(1).max(80),
  name: z.string().min(1).max(80),
  logoUrl: z.string().url(),
})

const UpdateTournamentOverlaySponsorsSchema = ManageTournamentBaseSchema.extend({
  sponsorsJson: z.string().max(12000),
})

const UpdateTournamentTabletAccessSchema = ManageTournamentBaseSchema.extend({
  tabletRequiresReferee: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const BulkCreatePitchSchema = ManageTournamentBaseSchema.extend({
  pitchNames: z.string().min(2),
  phaseIds: z.array(z.string().uuid()).optional(),
})

const BulkDeletePitchSchema = ManageTournamentBaseSchema.extend({
  pitchIds: z.array(z.string().uuid()).min(1),
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

const UpdateRegistrationConfirmationSchema = ManageTournamentBaseSchema.extend({
  registrationId: z.string().uuid(),
  isConfirmed: z.preprocess((value) => {
    if (value === true || value === 'true' || value === 'on' || value === 1 || value === '1') return true
    if (value === false || value === 'false' || value === 0 || value === '0') return false
    return value
  }, z.boolean()),
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

const StartMatchesByScheduleSlotSchema = ManageTournamentBaseSchema.extend({
  slotAt: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return undefined
    const date = new Date(String(value))
    return Number.isNaN(date.getTime()) ? undefined : date
  }, z.date()),
  timerMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 30 : Number(value)),
    z.number().int().min(1).max(600)
  ),
})

const StartTournamentBreakTimerSchema = ManageTournamentBaseSchema.extend({
  breakMinutes: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? 5 : Number(value)),
    z.number().int().min(1).max(240)
  ),
})

const StopTournamentTimerSchema = ManageTournamentBaseSchema

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

const ConfigureGroupPitchAssignmentsSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
})

const ConfigurePlacementBracketLabelsSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
})

const ConfigurePlacementBracketRankingSegmentsSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  segmentsText: z.string().max(1000).optional(),
})

const ConfigureInterleavedTimeSlotsSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  timeSlotsJson: z.string().min(2),
})

const ConfigureGroupInterleavedTimeSlotsSchema = ManageTournamentBaseSchema.extend({
  sourcePhaseId: z.string().uuid(),
  timeSlotsJson: z.string().min(2),
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
  rerunPropagation: z.preprocess((value) => value === 'on' || value === true, z.boolean()).optional(),
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
  homeScore: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().min(0).max(999).optional()
  ),
  awayScore: z.preprocess(
    (value) => (value === '' || value === null || value === undefined ? undefined : Number(value)),
    z.number().int().min(0).max(999).optional()
  ),
  notes: z.string().max(500).optional(),
})

const ClosePhaseSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  forceClose: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const RetryTournamentPropagationSchema = ManageTournamentBaseSchema.extend({
  force: z.preprocess((value) => value === 'on' || value === true, z.boolean()).optional(),
})

const GenerateCustomPlacementBracketSchema = ManageTournamentBaseSchema.extend({
  phaseId: z.string().uuid(),
  participantsCount: z.preprocess((value) => Number(value), z.number().int().min(2).max(64)),
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
  includeLosersReplay: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
  overwritePhaseMatches: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
  placementRanges: z.string().max(300).optional(),
  placementOffset: z.preprocess((value) => {
    if (value === '' || value === null || value === undefined) return 0
    const num = Number(value)
    return Number.isNaN(num) ? 0 : num
  }, z.number().int().min(0)).optional(),
  rotationMode: z.enum(['sequential', 'interleaved']).optional().default('sequential'),
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

function comparePitchNames(a: string, b: string) {
  return a.localeCompare(b, 'fr', { numeric: true, sensitivity: 'base' })
}

function uniquePitchResources(
  pitches: Array<{ id: string; name: string; phaseId?: string | null }>,
  preferredPhaseId?: string | null
) {
  const candidates = preferredPhaseId
    ? pitches.filter((pitch) => pitch.phaseId === preferredPhaseId || pitch.phaseId === null)
    : pitches

  const hasPhaseSpecificPitches = preferredPhaseId
    ? pitches.some((pitch) => pitch.phaseId === preferredPhaseId)
    : false

  const scopedPitches = hasPhaseSpecificPitches && preferredPhaseId
    ? candidates.filter((pitch) => pitch.phaseId === preferredPhaseId)
    : candidates

  const resources = new Map<string, { id: string; key: string; phaseId?: string | null }>()

  for (const pitch of scopedPitches) {
    const key = toPitchResourceKey(pitch.name)
    if (!resources.has(key)) {
      resources.set(key, { id: pitch.id, key, phaseId: pitch.phaseId })
    }
  }

  return Array.from(resources.values()).sort((a, b) => comparePitchNames(a.key, b.key))
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
  preferredPitchIdByGroup: Record<number, string>
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

  const preferredPitchIdByGroupRaw =
    rawGroups.preferredPitchIdByGroup && typeof rawGroups.preferredPitchIdByGroup === 'object'
      ? (rawGroups.preferredPitchIdByGroup as Record<string, unknown>)
      : {}

  const preferredPitchIdByGroup = Object.fromEntries(
    Object.entries(preferredPitchIdByGroupRaw)
      .filter(([groupIndex, pitchId]) => Number.isInteger(Number(groupIndex)) && Number(groupIndex) > 0 && typeof pitchId === 'string' && pitchId.length > 0)
      .map(([groupIndex, pitchId]) => [Number(groupIndex), pitchId as string])
  ) as Record<number, string>

  return { count, teamsPerGroup, placements, preferredPitchIdByGroup }
}

function resolvePreferredPitchKeyByGroup(params: {
  groupsWithTeams: Array<{ groupIndex: number }>
  groupConfig: GroupPhaseConfig
  pitches: Array<{ id: string; name: string }>
  pitchResources: Array<{ id: string; key: string }>
}) {
  const { groupsWithTeams, groupConfig, pitches, pitchResources } = params

  const preferredPitchKeyByGroup = new Map<number, string>()
  const pitchById = new Map(pitches.map((pitch) => [pitch.id, pitch]))

  for (const group of groupsWithTeams) {
    const preferredPitchId = groupConfig.preferredPitchIdByGroup[group.groupIndex]
    if (!preferredPitchId) continue
    const preferredPitch = pitchById.get(preferredPitchId)
    if (!preferredPitch) continue
    preferredPitchKeyByGroup.set(group.groupIndex, toPitchResourceKey(preferredPitch.name))
  }

  for (let index = 0; index < groupsWithTeams.length; index += 1) {
    const group = groupsWithTeams[index]
    if (preferredPitchKeyByGroup.has(group.groupIndex)) continue
    preferredPitchKeyByGroup.set(group.groupIndex, pitchResources[index % pitchResources.length].key)
  }

  return preferredPitchKeyByGroup
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

function sanitizeTournamentSlug(raw: string) {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function resetPhaseRuntimeConfig(config: unknown): Prisma.InputJsonValue {
  const base: Record<string, unknown> =
    config && typeof config === 'object'
      ? { ...(config as Record<string, unknown>) }
      : {}

  const groups = base.groups && typeof base.groups === 'object'
    ? (base.groups as Record<string, unknown>)
    : null

  if (groups) {
    base.groups = {
      ...groups,
      placements: [],
    }
  }

  delete base.rotationMode
  delete base.interleavedTimeSlots

  return base as Prisma.InputJsonValue
}

function remapInterleavedTimeSlotsInConfig(
  config: unknown,
  matchIdByOldId: Map<string, string>
): Prisma.InputJsonValue {
  const base: Record<string, unknown> =
    config && typeof config === 'object'
      ? { ...(config as Record<string, unknown>) }
      : {}

  const rawSlots = base.interleavedTimeSlots
  if (!Array.isArray(rawSlots)) {
    return base as Prisma.InputJsonValue
  }

  base.interleavedTimeSlots = rawSlots
    .map((slot) => {
      if (!slot || typeof slot !== 'object') return null
      const entry = slot as Record<string, unknown>
      const selectedMatchIds = Array.isArray(entry.selectedMatchIds)
        ? entry.selectedMatchIds
            .filter((item): item is string => typeof item === 'string')
            .map((matchId) => matchIdByOldId.get(matchId))
            .filter((matchId): matchId is string => typeof matchId === 'string')
        : []

      return {
        ...entry,
        selectedMatchIds,
      }
    })
    .filter((slot) => slot !== null)

  return base as Prisma.InputJsonValue
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

function readParallelGroupFromConfig(config: unknown): string | null {
  if (!config || typeof config !== 'object') return null
  const raw = config as Record<string, unknown>
  const value = typeof raw.parallelGroup === 'string' ? raw.parallelGroup.trim() : ''
  return value.length > 0 ? value : null
}

function routePlacementPriority(route: PhaseRouteConfig) {
  if (route.rule === 'TOP') return 0
  if (route.rule === 'RANGE') return 1
  if (route.rule === 'BOTTOM') return 2
  return 3
}

function routePlacementRank(route: PhaseRouteConfig) {
  if (route.rule === 'TOP') return route.countPerGroup ?? 0
  if (route.rule === 'RANGE') return route.startRank ?? 0
  if (route.rule === 'BOTTOM') return route.countPerGroup ?? 0
  return 0
}

async function resolveLinkedBracketRouteOrder(
  tournamentId: string,
  targetPhaseIds: string[]
): Promise<Map<string, number>> {
  if (targetPhaseIds.length === 0) return new Map()

  const targetSet = new Set(targetPhaseIds)
  const sourcePhases = await prisma.phase.findMany({
    where: {
      tournamentId,
      type: PhaseType.GROUP,
    },
    select: {
      order: true,
      config: true,
    },
    orderBy: { order: 'asc' },
  })

  const routeOrders = new Map<string, { sourceOrder: number; routeIndex: number; priority: number; rank: number }>()

  for (const sourcePhase of sourcePhases) {
    const routes = readRoutesFromConfig(sourcePhase.config)
    routes.forEach((route, routeIndex) => {
      if (!route.toPhaseId || !targetSet.has(route.toPhaseId)) return

      const candidate = {
        sourceOrder: sourcePhase.order,
        routeIndex,
        priority: routePlacementPriority(route),
        rank: routePlacementRank(route),
      }
      const current = routeOrders.get(route.toPhaseId)
      if (
        !current ||
        candidate.sourceOrder < current.sourceOrder ||
        (candidate.sourceOrder === current.sourceOrder && candidate.priority < current.priority) ||
        (candidate.sourceOrder === current.sourceOrder && candidate.priority === current.priority && candidate.rank < current.rank) ||
        (candidate.sourceOrder === current.sourceOrder && candidate.priority === current.priority && candidate.rank === current.rank && candidate.routeIndex < current.routeIndex)
      ) {
        routeOrders.set(route.toPhaseId, candidate)
      }
    })
  }

  return new Map(
    Array.from(routeOrders.entries())
      .sort(([, a], [, b]) =>
        a.sourceOrder - b.sourceOrder ||
        a.priority - b.priority ||
        a.rank - b.rank ||
        a.routeIndex - b.routeIndex
      )
      .map(([phaseId], index) => [phaseId, index])
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

function collectGroupQualifierIdsByRoute(
  groupStandings: string[][],
  route: PhaseRouteConfig
): string[] {
  const rankBuckets: string[][] = []

  // =========================================================
  // TOP
  // =========================================================

  if (route.rule === 'TOP' && route.countPerGroup) {
    for (
      let rank = 0;
      rank < route.countPerGroup;
      rank += 1
    ) {
      const bucket: string[] = []

      for (const group of groupStandings) {
        if (group[rank]) {
          bucket.push(group[rank])
        }
      }

      rankBuckets.push(bucket)
    }
  }

  // =========================================================
  // BOTTOM
  // =========================================================

  else if (
    route.rule === 'BOTTOM' &&
    route.countPerGroup
  ) {
    for (
      let rank = 0;
      rank < route.countPerGroup;
      rank += 1
    ) {
      const bucket: string[] = []

      for (const group of groupStandings) {
        const idx = group.length - 1 - rank

        if (idx >= 0 && group[idx]) {
          bucket.push(group[idx])
        }
      }

      rankBuckets.push(bucket)
    }
  }

  // =========================================================
  // RANGE
  // =========================================================

  else if (
    route.rule === 'RANGE' &&
    route.startRank &&
    route.endRank
  ) {
    for (
      let rank = route.startRank - 1;
      rank < route.endRank;
      rank += 1
    ) {
      const bucket: string[] = []

      for (const group of groupStandings) {
        if (group[rank]) {
          bucket.push(group[rank])
        }
      }

      rankBuckets.push(bucket)
    }
  }

  // =========================================================
  // FALLBACK
  // =========================================================

  if (rankBuckets.length !== 2) {
    return rankBuckets.flat()
  }

  const [higherRank, lowerRank] = rankBuckets

  const ordered: string[] = []

  const pairCount = Math.min(
    higherRank.length,
    lowerRank.length
  )

  // =========================================================
  // SPLIT-HALF CROSS PAIRING
  //
  // For 8 groups:
  // 1A vs 2E
  // 2A vs 1E
  // 1B vs 2F
  // 2B vs 1F
  // =========================================================

  const pairedIndexes = new Set<number>()

  if (pairCount > 1 && pairCount % 2 === 0) {
    const splitOffset = pairCount / 2

    for (
      let index = 0;
      index < splitOffset;
      index += 1
    ) {
      const oppositeIndex = index + splitOffset

      const higherA = higherRank[index]
      const higherB = higherRank[oppositeIndex]

      const lowerA = lowerRank[index]
      const lowerB = lowerRank[oppositeIndex]

      pairedIndexes.add(index)
      pairedIndexes.add(oppositeIndex)

      // Match 1
      if (higherA) {
        ordered.push(higherA)
      }

      if (lowerB) {
        ordered.push(lowerB)
      }

      if (lowerA) {
        ordered.push(lowerA)
      }

      // Match 2
      if (higherB) {
        ordered.push(higherB)
      }
    }
  } else {
    for (
      let index = 0;
      index < pairCount;
      index += 2
    ) {
      const higherA = higherRank[index]
      const higherB = higherRank[index + 1]

      const lowerA = lowerRank[index]
      const lowerB = lowerRank[index + 1]

      pairedIndexes.add(index)
      pairedIndexes.add(index + 1)

      // Match 1
      if (higherA) {
        ordered.push(higherA)
      }

      if (lowerB) {
        ordered.push(lowerB)
      }

      // Match 2
      if (higherB) {
        ordered.push(higherB)
      }

      if (lowerA) {
        ordered.push(lowerA)
      }
    }
  }

  // =========================================================
  // REMAINING HIGHER
  // =========================================================

  if (higherRank.length > pairedIndexes.size) {
    for (
      let index = 0;
      index < higherRank.length;
      index += 1
    ) {
      if (pairedIndexes.has(index)) continue

      const teamId = higherRank[index]

      if (teamId) {
        ordered.push(teamId)
      }
    }
  }

  // =========================================================
  // REMAINING LOWER
  // =========================================================

  if (lowerRank.length > pairedIndexes.size) {
    for (
      let index = 0;
      index < lowerRank.length;
      index += 1
    ) {
      if (pairedIndexes.has(index)) continue

      const teamId = lowerRank[index]

      if (teamId) {
        ordered.push(teamId)
      }
    }
  }

  return ordered
}

function compareRoundOneBracketPos(a: string | null, b: string | null): number {
  const parse = (value: string | null) => {
    if (!value) {
      return { laneOrder: 99, matchNo: Number.POSITIVE_INFINITY, raw: '' }
    }

    const wbOrLb = value.match(/^(WB|LB)-R1-M(\d+)$/)
    if (wbOrLb) {
      const laneOrder = wbOrLb[1] === 'WB' ? 0 : 1
      return { laneOrder, matchNo: Number(wbOrLb[2]), raw: value }
    }

    const placement = value.match(/^P\d+-\d+-R1-M(\d+)$/)
    if (placement) {
      return { laneOrder: 2, matchNo: Number(placement[1]), raw: value }
    }

    const fallback = value.match(/-M(\d+)$/)
    if (fallback) {
      return { laneOrder: 3, matchNo: Number(fallback[1]), raw: value }
    }

    return { laneOrder: 98, matchNo: Number.POSITIVE_INFINITY, raw: value }
  }

  const left = parse(a)
  const right = parse(b)

  if (left.laneOrder !== right.laneOrder) return left.laneOrder - right.laneOrder
  if (left.matchNo !== right.matchNo) return left.matchNo - right.matchNo
  return left.raw.localeCompare(right.raw)
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
          computeGroupStandingsForPhase(g + 1, groupConfig, phase.id, matches)
        )
      }

      qualifierIds = collectGroupQualifierIdsByRoute(groupStandings, route)
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
    slotMatches.sort((a, b) => compareRoundOneBracketPos(a.bracketPos, b.bracketPos))

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

async function resolveIncomingQualifierIdsForTargetPhase(params: {
  tournamentId: string
  targetPhaseId: string
}): Promise<{ hasRouting: boolean; teamIds: string[] }> {
  const { tournamentId, targetPhaseId } = params

  const phases = await prisma.phase.findMany({
    where: { tournamentId },
    select: { id: true, type: true, config: true, isCompleted: true, order: true },
    orderBy: { order: 'asc' },
  })

  const sources = phases
    .map((phase) => ({
      ...phase,
      routes: readRoutesFromConfig(phase.config).filter((route) => route.toPhaseId === targetPhaseId),
    }))
    .filter((phase) => phase.routes.length > 0)

  if (sources.length === 0) {
    return { hasRouting: false, teamIds: [] }
  }

  const qualifierIds: string[] = []

  for (const source of sources) {
    if (!source.isCompleted) continue

    if (source.type === PhaseType.GROUP) {
      const groupConfig = readGroupPhaseConfig(source.config)
      const matches = await prisma.match.findMany({
        where: { phaseId: source.id },
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
          computeGroupStandingsForPhase(g + 1, groupConfig, source.id, matches)
        )
      }

      for (const route of source.routes) {
        const orderedForRoute = collectGroupQualifierIdsByRoute(groupStandings, route)
        for (const teamId of orderedForRoute) {
          if (teamId && !qualifierIds.includes(teamId)) qualifierIds.push(teamId)
        }
      }

      continue
    }

    if (
      source.type === PhaseType.BRACKET_SINGLE ||
      source.type === PhaseType.BRACKET_DOUBLE ||
      source.type === PhaseType.PLACEMENT_BRACKET ||
      source.type === PhaseType.CUSTOM
    ) {
      const matches = await prisma.match.findMany({
        where: { phaseId: source.id, status: MatchStatus.FINISHED },
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
        if (winnerId && !qualifierIds.includes(winnerId)) qualifierIds.push(winnerId)
      }
    }
  }

  return { hasRouting: true, teamIds: qualifierIds }
}

async function resolveExpectedIncomingQualifierCountForTargetPhase(params: {
  tournamentId: string
  targetPhaseId: string
}): Promise<{ hasRouting: boolean; expectedCount: number | null; isDeterministic: boolean }> {
  const { tournamentId, targetPhaseId } = params

  const phases = await prisma.phase.findMany({
    where: { tournamentId },
    select: { id: true, type: true, config: true, isCompleted: true },
  })

  const sources = phases
    .map((phase) => ({
      ...phase,
      routes: readRoutesFromConfig(phase.config).filter((route) => route.toPhaseId === targetPhaseId),
    }))
    .filter((phase) => phase.routes.length > 0)

  if (sources.length === 0) {
    return { hasRouting: false, expectedCount: null, isDeterministic: false }
  }

  let expectedCount = 0
  let isDeterministic = true

  for (const source of sources) {
    // Deterministic expected counts can be inferred from group route config
    // even before the source phase is completed.
    if (source.type !== PhaseType.GROUP) {
      isDeterministic = false
      continue
    }

    const groupConfig = readGroupPhaseConfig(source.config)
    for (const route of source.routes) {
      if (route.rule === 'TOP' || route.rule === 'BOTTOM') {
        if (!route.countPerGroup) {
          isDeterministic = false
          continue
        }
        expectedCount += groupConfig.count * route.countPerGroup
        continue
      }

      if (route.rule === 'RANGE') {
        if (!route.startRank || !route.endRank || route.endRank < route.startRank) {
          isDeterministic = false
          continue
        }
        expectedCount += groupConfig.count * (route.endRank - route.startRank + 1)
        continue
      }

      isDeterministic = false
    }
  }

  return {
    hasRouting: true,
    expectedCount: isDeterministic ? expectedCount : null,
    isDeterministic,
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

function isPowerOfTwo(value: number) {
  return value > 0 && (value & (value - 1)) === 0
}

function defaultPlacementRootRanges(normalizedSize: number, rounds: number) {
  return Array.from({ length: Math.max(0, rounds - 1) }, (_, idx) => {
    const round = idx + 1
    return {
      start: normalizedSize / 2 ** round + 1,
      end: normalizedSize / 2 ** (round - 1),
      wbRound: round,
    }
  })
}

function parsePlacementRootRanges(params: {
  value: string | undefined
  normalizedSize: number
  rounds: number
  offset?: number
}): { ranges: Array<{ start: number; end: number; wbRound: number | null }> } | { error: string } {
  const { value, normalizedSize, rounds, offset = 0 } = params
  const requiredRoots = defaultPlacementRootRanges(normalizedSize, rounds)
  const shiftedRoots = requiredRoots.map((item) => ({
    start: item.start + offset,
    end: item.end + offset,
    wbRound: item.wbRound,
  }))
  const requiredByKey = new Map(shiftedRoots.map((item) => [`${item.start}-${item.end}`, item.wbRound]))

  if (!value || value.trim().length === 0) {
    return { ranges: shiftedRoots }
  }

  const tokens = value
    .split(/[\n,;]+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)

  if (tokens.length === 0) {
    return { ranges: shiftedRoots }
  }

  const unique = new Map<string, { start: number; end: number }>()
  for (const token of tokens) {
    const parsed = token.match(/^(\d+)\s*-\s*(\d+)$/)
    if (!parsed) {
      return { error: `Format de plage invalide: "${token}". Utilisez le format 5-8, 3-4.` }
    }

    const rawStart = Number(parsed[1])
    const rawEnd = Number(parsed[2])
    if (!Number.isInteger(rawStart) || !Number.isInteger(rawEnd) || rawStart < 1 || rawEnd < rawStart) {
      return { error: `Plage invalide: "${token}".` }
    }

    let start = rawStart
    let end = rawEnd

    if (offset > 0) {
      const relativeStart = rawStart - offset
      const relativeEnd = rawEnd - offset
      if (relativeStart >= 1 && relativeEnd <= normalizedSize) {
        start = rawStart
        end = rawEnd
      } else if (rawStart >= 1 && rawEnd <= normalizedSize) {
        start = rawStart + offset
        end = rawEnd + offset
      }
    }

    if (end > normalizedSize + offset) {
      return {
        error: `La plage "${token}" depasse le nombre de participants normalise (${normalizedSize + offset}).`,
      }
    }

    const size = end - start + 1
    if (!isPowerOfTwo(size) || size < 2) {
      return {
        error: `La plage "${token}" doit contenir 2, 4, 8... places (puissance de 2).`,
      }
    }

    unique.set(`${start}-${end}`, { start, end })
  }

  const ranges = Array.from(unique.values()).sort((a, b) => {
    const sizeDiff = b.end - b.start - (a.end - a.start)
    if (sizeDiff !== 0) return sizeDiff
    return a.start - b.start
  })

  for (let i = 0; i < ranges.length; i += 1) {
    for (let j = i + 1; j < ranges.length; j += 1) {
      const left = ranges[i]
      const right = ranges[j]
      if (left.start <= right.end && right.start <= left.end) {
        return { error: `Les plages ${left.start}-${left.end} et ${right.start}-${right.end} se chevauchent.` }
      }
    }
  }

  for (const root of shiftedRoots) {
    const key = `${root.start}-${root.end}`
    if (!unique.has(key)) {
      return {
        error: `Configuration incomplete: ajoutez la plage obligatoire ${key} pour la propagation des perdants (ou laissez le champ vide pour une generation automatique).`,
      }
    }
  }

  return {
    ranges: ranges.map((range) => ({
      ...range,
      wbRound: requiredByKey.get(`${range.start}-${range.end}`) ?? null,
    })),
  }
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

async function resolvePlacementOffsetForPhase(
  tx: Prisma.TransactionClient,
  phaseId: string,
  normalizedSize: number
) {
  const placementMatches = await tx.match.findMany({
    where: {
      phaseId,
      bracketPos: { startsWith: 'P' },
    },
    select: { bracketPos: true },
  })

  let maxPlacementEnd = 0
  for (const match of placementMatches) {
    const parsed = parsePlacementBracketCoordinate(match.bracketPos)
    if (!parsed) continue
    maxPlacementEnd = Math.max(maxPlacementEnd, parsed.end)
  }

  if (maxPlacementEnd <= 0) return 0

  const offset = maxPlacementEnd - normalizedSize
  return Number.isInteger(offset) && offset > 0 ? offset : 0
}

export async function propagateWinnerToNextBracketMatch(
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
        const placementOffset = await resolvePlacementOffsetForPhase(tx, source.phaseId, normalizedSize)
        const rangeStart = normalizedSize / 2 ** parsed.round + 1 + placementOffset
        const rangeEnd = normalizedSize / 2 ** (parsed.round - 1) + placementOffset
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
  if (teamIds.length === 4) {
    const [a, b, c, d] = teamIds
    return [
      { round: 1, homeTeamId: a, awayTeamId: b },
      { round: 1, homeTeamId: c, awayTeamId: d },
      { round: 2, homeTeamId: a, awayTeamId: c },
      { round: 2, homeTeamId: b, awayTeamId: d },
      { round: 3, homeTeamId: a, awayTeamId: d },
      { round: 3, homeTeamId: b, awayTeamId: c },
    ]
  }

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
  groupIndex?: number
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
  preferredPitchKeyByGroup?: Map<number, string>
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
    preferredPitchKeyByGroup,
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
      const preferredPitchKey =
        typeof pairing.groupIndex === 'number'
          ? preferredPitchKeyByGroup?.get(pairing.groupIndex)
          : undefined
      const candidatePitches = preferredPitchKey
        ? pitchResources.filter((pitch) => pitch.key === preferredPitchKey)
        : pitchResources

      for (const pitch of candidatePitches) {
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
      pitchAvailableAt.set(bestPitchKey, matchEnd + teamBreakMs)
    }
    teamAvailableAt.set(pairing.homeTeamId, matchEnd)
    teamAvailableAt.set(pairing.awayTeamId, matchEnd)

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

type BracketSkeletonMatch = {
  phaseId: string
  roundNumber: number
  bracketPos: string
  homeTeamId?: string | null
  awayTeamId?: string | null
  pitchResources?: Array<{ id: string; key: string }>
}

function buildBracketSkeleton(params: {
  phaseId: string
  phaseType: string
  effectiveParticipantsCount: number
  seededTeamIds: Array<string>
  includeLosersReplay: boolean
  placementRanges?: string | null
  placementOffset?: number
  pitchResources: Array<{ id: string; key: string }>
  roundDurationMs: number
}): { skeleton: BracketSkeletonMatch[] } | { error: string } {
  const {
    phaseId,
    phaseType,
    effectiveParticipantsCount,
    seededTeamIds,
    includeLosersReplay,
    placementRanges,
    placementOffset = 0,
    pitchResources,
    roundDurationMs,
  } = params

  const rounds = Math.ceil(
    Math.log2(effectiveParticipantsCount)
  )

  const normalizedSize = 2 ** rounds

  const skeleton: BracketSkeletonMatch[] = []

  // =========================================================
  // WINNERS BRACKET
  // =========================================================

  for (
    let round = 1;
    round <= rounds;
    round += 1
  ) {
    const matchesInRound =
      normalizedSize / 2 ** round

    for (
      let matchNo = 1;
      matchNo <= matchesInRound;
      matchNo += 1
    ) {
      skeleton.push({
        phaseId,
        roundNumber: round,
        bracketPos: `WB-R${round}-M${matchNo}`,
        pitchResources,
      })
    }
  }

  // =========================================================
  // LOSERS BRACKET
  // =========================================================

  if (
    phaseType !== 'PLACEMENT_BRACKET' &&
    phaseType !== 'BRACKET_SINGLE' &&
    includeLosersReplay
  ) {
    for (
      let round = 1;
      round <= rounds;
      round += 1
    ) {
      const matchesInRound = Math.max(
        1,
        normalizedSize / 2 ** (round + 1)
      )

      for (
        let matchNo = 1;
        matchNo <= matchesInRound;
        matchNo += 1
      ) {
        skeleton.push({
          phaseId,
          roundNumber: rounds + round,
          bracketPos: `LB-R${round}-M${matchNo}`,
          pitchResources,
        })
      }
    }
  }

  // =========================================================
  // PLACEMENT MATCHES
  // =========================================================

  if (
    phaseType === 'PLACEMENT_BRACKET' &&
    normalizedSize >= 4
  ) {
    const parsedRanges = parsePlacementRootRanges({
      value: placementRanges ?? undefined,
      normalizedSize,
      rounds,
      offset: placementOffset,
    })

    if ('error' in parsedRanges) {
      return {
        error: parsedRanges.error,
      }
    }

    const pitchCursorRef = {
      value: 0,
    }

    let dynamicOffsetCursor = rounds * 2

    for (const range of parsedRanges.ranges) {
      const stageOffset = range.wbRound
        ? rounds + range.wbRound
        : dynamicOffsetCursor

      skeleton.push(
        ...buildPlacementRangeSkeleton({
          phaseId,
          rangeStart: range.start,
          rangeEnd: range.end,
          pitches: pitchResources,
          pitchCursorRef,
          baseStartMs: null,
          roundDurationMs,
          stageOffset,
        })
      )

      if (!range.wbRound) {
        dynamicOffsetCursor += Math.max(
          1,
          Math.log2(range.end - range.start + 1)
        )
      }
    }
  } else if (phaseType !== 'BRACKET_SINGLE' && normalizedSize >= 4) {
    for (
      let place = 3;
      place <= normalizedSize;
      place += 2
    ) {
      skeleton.push({
        phaseId,
        roundNumber: rounds + 10,
        bracketPos: `P${place}-P${place + 1}`,
        pitchResources,
      })
    }
  }

  // =========================================================
  // FIRST ROUND
  // =========================================================

  const firstRoundMatches = skeleton
    .filter(
      (m) =>
        m.roundNumber === 1 &&
        m.bracketPos.startsWith('WB-R1-')
    )
    .sort((a, b) => {
      const matchA = Number(
        a.bracketPos.split('-M')[1] ?? 0
      )

      const matchB = Number(
        b.bracketPos.split('-M')[1] ?? 0
      )

      return matchA - matchB
    })

  // =========================================================
  // DIRECT SEED INJECTION
  // =========================================================

  for (
    let i = 0;
    i < firstRoundMatches.length;
    i += 1
  ) {
    const slot = firstRoundMatches[i]

    slot.homeTeamId =
      seededTeamIds[i * 2] ?? null

    slot.awayTeamId =
      seededTeamIds[i * 2 + 1] ?? null
  }

  // =========================================================
  // UNIQUE
  // =========================================================

  return {
    skeleton: Array.from(
      new Map(
        skeleton.map((item) => [
          `${item.phaseId}:${item.bracketPos}`,
          item,
        ])
      ).values()
    ),
  }
}

function scheduleBracketMatches(params: {
  matches: Array<{
    phaseId: string
    roundNumber: number
    bracketPos: string
    homeTeamId?: string | null
    awayTeamId?: string | null
    pitchResources?: Array<{ id: string; key: string }>
  }>
  pitchResources: Array<{ id: string; key: string }>
  startTimeMs: number
  roundDurationMs: number
  pitchSchedules: Map<string, Array<{ start: number; end: number }>>
  rotationMode?: 'sequential' | 'interleaved'
}) {
  const { matches, pitchResources, startTimeMs, roundDurationMs, pitchSchedules, rotationMode = 'sequential' } = params
  const scheduledCountByPhase = new Map<string, number>()

  const bracketMap = new Map(matches.map((match) => [`${match.phaseId}:${match.bracketPos}`, match]))

  function findEarliestPitchSlot(pitchKey: string, earliestStart: number) {
    const intervals = [...(pitchSchedules.get(pitchKey) ?? [])].sort((a, b) => a.start - b.start)
    let candidateStart = earliestStart

    for (const interval of intervals) {
      const candidateEnd = candidateStart + roundDurationMs
      if (candidateEnd <= interval.start) {
        break
      }
      if (candidateStart >= interval.end) {
        continue
      }
      candidateStart = interval.end
    }

    return candidateStart
  }

  function reservePitchSlot(pitchKey: string, start: number, end: number) {
    const intervals = [...(pitchSchedules.get(pitchKey) ?? []), { start, end }].sort((a, b) => a.start - b.start)
    pitchSchedules.set(pitchKey, intervals)
  }

  function getDependencies(phaseId: string, bracketPos: string) {
    const direct = parseBracketCoordinate(bracketPos)
    if (direct && direct.round > 1) {
      return [
        `${phaseId}:${direct.lane}-R${direct.round - 1}-M${direct.matchNo * 2 - 1}`,
        `${phaseId}:${direct.lane}-R${direct.round - 1}-M${direct.matchNo * 2}`,
      ].filter((key) => bracketMap.has(key))
    }

    const placement = parsePlacementBracketCoordinate(bracketPos)
    if (placement && placement.round > 1) {
      return [
        `${phaseId}:P${placement.start}-${placement.end}-R${placement.round - 1}-M${placement.matchNo * 2 - 1}`,
        `${phaseId}:P${placement.start}-${placement.end}-R${placement.round - 1}-M${placement.matchNo * 2}`,
      ].filter((key) => bracketMap.has(key))
    }

    return []
  }

  const scheduled: Array<{
    phaseId: string
    pitchId: string
    roundNumber: number
    bracketPos: string
    homeTeamId?: string | null
    awayTeamId?: string | null
    scheduledAt: Date
  }> = []

  const scheduledEndByBracketPos = new Map<string, number>()
  const pending = [...matches].sort((a, b) => a.roundNumber - b.roundNumber || a.bracketPos.localeCompare(b.bracketPos))

  while (pending.length > 0) {
    let bestPendingIndex = -1
    let bestPitch = pitchResources[0]
    let bestStart = Number.POSITIVE_INFINITY

    for (let index = 0; index < pending.length; index += 1) {
      const match = pending[index]
      const matchPitchResources = match.pitchResources ?? pitchResources
      const dependencies = getDependencies(match.phaseId, match.bracketPos)
      const dependencyEndTimes = dependencies.map((key) => scheduledEndByBracketPos.get(key))
      if (dependencyEndTimes.some((value) => value === undefined)) {
        continue
      }

      const dependencyReadyAt = dependencyEndTimes.length > 0
        ? Math.max(...(dependencyEndTimes as number[]))
        : startTimeMs
      const stageFloor = startTimeMs + (match.roundNumber - 1) * roundDurationMs

      for (const pitch of matchPitchResources) {
        const candidateStart = findEarliestPitchSlot(pitch.key, Math.max(stageFloor, dependencyReadyAt))

        const currentBestPhaseCount = scheduledCountByPhase.get(pending[bestPendingIndex]?.phaseId ?? '') ?? 0
        const candidatePhaseCount = scheduledCountByPhase.get(match.phaseId) ?? 0
        const isBetterTime = candidateStart < bestStart
        const isSameTime = candidateStart === bestStart
        const isBetterRound = isSameTime && match.roundNumber < (pending[bestPendingIndex]?.roundNumber ?? Number.POSITIVE_INFINITY)
        const isBetterRotation = rotationMode === 'interleaved' && isSameTime &&
          match.roundNumber === (pending[bestPendingIndex]?.roundNumber ?? match.roundNumber) &&
          candidatePhaseCount < currentBestPhaseCount
        if (isBetterTime || isBetterRound || isBetterRotation) {
          bestStart = candidateStart
          bestPitch = pitch
          bestPendingIndex = index
        }
      }
    }

    if (bestPendingIndex === -1) {
      const fallback = pending.shift()
      if (!fallback) break
      const fallbackPitchResources = fallback.pitchResources ?? pitchResources
      const stageFloor = startTimeMs + (fallback.roundNumber - 1) * roundDurationMs
      let fallbackPitch = fallbackPitchResources[0]
      let fallbackStart = Number.POSITIVE_INFINITY

      for (const pitch of fallbackPitchResources) {
        const candidateStart = findEarliestPitchSlot(pitch.key, stageFloor)
        if (candidateStart < fallbackStart) {
          fallbackStart = candidateStart
          fallbackPitch = pitch
        }
      }

      const matchEnd = fallbackStart + roundDurationMs
      reservePitchSlot(fallbackPitch.key, fallbackStart, matchEnd)
      scheduledEndByBracketPos.set(`${fallback.phaseId}:${fallback.bracketPos}`, matchEnd)
      scheduled.push({
        phaseId: fallback.phaseId,
        pitchId: fallbackPitch.id,
        roundNumber: fallback.roundNumber,
        bracketPos: fallback.bracketPos,
        ...(fallback.homeTeamId !== undefined ? { homeTeamId: fallback.homeTeamId } : {}),
        ...(fallback.awayTeamId !== undefined ? { awayTeamId: fallback.awayTeamId } : {}),
        scheduledAt: new Date(fallbackStart),
      })
      continue
    }

    const match = pending.splice(bestPendingIndex, 1)[0]
    const matchEnd = bestStart + roundDurationMs
    reservePitchSlot(bestPitch.key, bestStart, matchEnd)
    scheduledEndByBracketPos.set(`${match.phaseId}:${match.bracketPos}`, matchEnd)
    scheduledCountByPhase.set(match.phaseId, (scheduledCountByPhase.get(match.phaseId) ?? 0) + 1)

    scheduled.push({
      phaseId: match.phaseId,
      pitchId: bestPitch.id,
      roundNumber: match.roundNumber,
      bracketPos: match.bracketPos,
      ...(match.homeTeamId !== undefined ? { homeTeamId: match.homeTeamId } : {}),
      ...(match.awayTeamId !== undefined ? { awayTeamId: match.awayTeamId } : {}),
      scheduledAt: new Date(bestStart),
    })
  }

  return scheduled
}

function buildInterleavedTimeSlotsFromMatches(matches: Array<{ id: string; scheduledAt: Date | null }>) {
  const byStartMs = new Map<number, string[]>()

  for (const match of matches) {
    if (!match.scheduledAt) continue
    const startMs = match.scheduledAt.getTime()
    const bucket = byStartMs.get(startMs) ?? []
    bucket.push(match.id)
    byStartMs.set(startMs, bucket)
  }

  return Array.from(byStartMs.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([startTimeMs, selectedMatchIds], index) => ({
      id: `rotation-${index + 1}`,
      startTimeMs,
      label: `R${index + 1}`,
      selectedMatchIds,
    }))
}

async function applyInterleavedPhasePitchAssignments(params: {
  tx: Prisma.TransactionClient
  tournamentId: string
  phaseId: string
  matchTimeById: Map<string, Date>
}) {
  const { tx, tournamentId, phaseId, matchTimeById } = params
  const matchIds = Array.from(matchTimeById.keys())

  if (matchIds.length === 0) return

  const matches = await tx.match.findMany({
    where: {
      phaseId,
      id: { in: matchIds },
    },
    select: {
      id: true,
      pitchId: true,
      scheduledAt: true,
      roundNumber: true,
      bracketPos: true,
    },
  })

  if (matches.length === 0) return

  const pitches = await tx.pitch.findMany({
    where: {
      tournamentId,
      OR: [{ phaseId }, { phaseId: null }],
    },
    select: { id: true, name: true, phaseId: true },
    orderBy: { name: 'asc' },
  })

  const pitchResources = uniquePitchResources(pitches, phaseId)
  if (pitchResources.length === 0) return

  const matchesByTime = new Map<number, typeof matches>()

  for (const match of matches) {
    const targetScheduledAt = matchTimeById.get(match.id) ?? match.scheduledAt
    if (!targetScheduledAt) continue
    const key = targetScheduledAt.getTime()
    const bucket = matchesByTime.get(key) ?? []
    bucket.push(match)
    matchesByTime.set(key, bucket)
  }

  const pitchAssignments = new Map<string, string>()

  for (const [startTimeMs, bucket] of Array.from(matchesByTime.entries()).sort((a, b) => a[0] - b[0])) {
    const orderedMatches = [...bucket].sort((a, b) => {
      if ((a.roundNumber ?? 0) !== (b.roundNumber ?? 0)) {
        return (a.roundNumber ?? 0) - (b.roundNumber ?? 0)
      }
      return (a.bracketPos ?? '').localeCompare(b.bracketPos ?? '')
    })

    const usedPitchIds = new Set<string>()
    for (const match of orderedMatches) {
      const assignedPitch = pitchResources.find((pitch) => !usedPitchIds.has(pitch.id))
      if (!assignedPitch) continue
      usedPitchIds.add(assignedPitch.id)
      pitchAssignments.set(match.id, assignedPitch.id)
    }
  }

  for (const match of matches) {
    const targetScheduledAt = matchTimeById.get(match.id) ?? match.scheduledAt
    const nextPitchId = pitchAssignments.get(match.id) ?? match.pitchId

    await tx.match.update({
      where: { id: match.id },
      data: {
        scheduledAt: targetScheduledAt ?? null,
        ...(nextPitchId ? { pitchId: nextPitchId } : {}),
      },
    })
  }
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
    const startedAt = new Date()

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

export async function updateTournamentOverlayBackground(
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateTournamentOverlayBackgroundSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'URL de fond invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, bannerUrl } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const normalizedBannerUrl = bannerUrl && bannerUrl.trim().length > 0 ? bannerUrl.trim() : null

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { bannerUrl: normalizedBannerUrl },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'TOURNAMENT_OVERLAY_BACKGROUND_UPDATED',
      message: normalizedBannerUrl
        ? 'Image de fond overlay mise a jour.'
        : 'Image de fond overlay supprimee.',
      payload: {
        bannerUrl: normalizedBannerUrl,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    revalidatePath(`/public/${orgSlug}/${tournamentSlug}`)
    revalidatePath(`/public/${orgSlug}/${tournamentSlug}/overlay`)

    return {
      success: true,
      message: normalizedBannerUrl
        ? 'Image de fond enregistree.'
        : 'Image de fond supprimee.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur mise a jour image de fond.',
    }
  }
}

export async function updateTournamentOverlaySponsors(
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateTournamentOverlaySponsorsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Sponsors invalides.' }

  const { tournamentId, orgSlug, tournamentSlug, sponsorsJson } = parsed.data

  let rawSponsors: unknown
  try {
    rawSponsors = JSON.parse(sponsorsJson)
  } catch {
    return { success: false, message: 'Format des sponsors invalide.' }
  }

  const normalized = z.array(OverlaySponsorSchema).max(12).safeParse(rawSponsors)
  if (!normalized.success) return { success: false, message: 'Un sponsor contient des donnees invalides.' }

  const sponsors = normalized.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    if (sponsors.length > 0) {
      await prisma.$executeRaw`
        UPDATE "public"."tournaments"
        SET "sponsor_config" = ${JSON.stringify({ sponsors })}::jsonb
        WHERE "id" = ${tournamentId}
      `
    } else {
      await prisma.$executeRaw`
        UPDATE "public"."tournaments"
        SET "sponsor_config" = NULL
        WHERE "id" = ${tournamentId}
      `
    }

    await recordTournamentAction({
      tournamentId,
      actionType: 'TOURNAMENT_OVERLAY_SPONSORS_UPDATED',
      message: sponsors.length > 0
        ? `${sponsors.length} sponsor(s) overlay mis a jour.`
        : 'Sponsors overlay supprimes.',
      payload: { sponsorCount: sponsors.length },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    revalidatePath(`/public/${orgSlug}/${tournamentSlug}`)
    revalidatePath(`/public/${orgSlug}/${tournamentSlug}/overlay`)

    return {
      success: true,
      message: sponsors.length > 0 ? 'Sponsors enregistres.' : 'Sponsors supprimes.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur mise a jour sponsors.',
    }
  }
}

export async function updateTournamentTabletAccess(
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateTournamentTabletAccessSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Configuration tablette invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, tabletRequiresReferee } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    await prisma.tournament.update({
      where: { id: tournamentId },
      data: { tabletRequiresReferee },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'TOURNAMENT_TABLET_ACCESS_UPDATED',
      message: tabletRequiresReferee
        ? 'Tablette reservee aux arbitres de l organisation.'
        : 'Tablette ouverte a toute personne avec le lien.',
      payload: { tabletRequiresReferee },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    revalidatePath(`/public/${orgSlug}/${tournamentSlug}/tablet`)

    return {
      success: true,
      message: tabletRequiresReferee
        ? 'Tablette reservee aux arbitres.'
        : 'Tablette accessible avec le lien public.',
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur configuration tablette.',
    }
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

export async function bulkCreateTournamentPitches(
  formData: FormData
): Promise<ActionState> {
  const rawPhaseIds = formData
    .getAll('phaseIds')
    .map((value) => String(value).trim())
    .filter(Boolean)
  const fallbackPhaseId = String(formData.get('phaseId') ?? '').trim()
  const phaseIds = rawPhaseIds.length > 0 ? rawPhaseIds : fallbackPhaseId ? [fallbackPhaseId] : []

  const parsed = BulkCreatePitchSchema.safeParse({
    ...Object.fromEntries(formData),
    phaseIds,
  })
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour ajout massif de pistes.' }

  const { tournamentId, orgSlug, tournamentSlug } = parsed.data
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

    const rawNames = parsed.data.pitchNames
      .split(/[\n,;]+/)
      .map((name) => name.trim())
      .filter((name) => name.length >= 2)

    const uniqueNames: string[] = []
    const seen = new Set<string>()
    for (const name of rawNames) {
      const key = name.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      uniqueNames.push(name)
    }

    if (uniqueNames.length === 0) {
      return { success: false, message: 'Ajoutez au moins un nom de piste valide.' }
    }

    const targetPhaseIds = uniquePhaseIds.length > 0 ? uniquePhaseIds : [null]
    const existing = await prisma.pitch.findMany({
      where: {
        tournamentId,
        name: { in: uniqueNames },
        ...(uniquePhaseIds.length > 0
          ? { phaseId: { in: uniquePhaseIds } }
          : { phaseId: null }),
      },
      select: { name: true, phaseId: true },
    })

    const existingKeys = new Set(existing.map((pitch) => `${pitch.name.toLowerCase()}::${pitch.phaseId ?? '__ALL__'}`))

    const rows = uniqueNames.flatMap((name) =>
      targetPhaseIds
        .filter((phaseId) => !existingKeys.has(`${name.toLowerCase()}::${phaseId ?? '__ALL__'}`))
        .map((phaseId) => ({
          name,
          tournamentId,
          phaseId,
        }))
    )

    if (rows.length === 0) {
      return { success: false, message: 'Toutes ces pistes existent deja sur les phases selectionnees.' }
    }

    await prisma.pitch.createMany({ data: rows })

    await recordTournamentAction({
      tournamentId,
      actionType: 'PITCH_BULK_CREATE',
      message: `${rows.length} association(s) de piste ajoutee(s) en masse.`,
      payload: {
        pitchNames: uniqueNames,
        phaseIds: targetPhaseIds,
        createdCount: rows.length,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${rows.length} association(s) de piste ajoutee(s).` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur ajout massif de pistes.' }
  }
}

export async function bulkDeleteTournamentPitches(
  formData: FormData
): Promise<ActionState> {
  const rawPitchIds = formData
    .getAll('pitchIds')
    .map((value) => String(value).trim())
    .filter(Boolean)

  const parsed = BulkDeletePitchSchema.safeParse({
    ...Object.fromEntries(formData),
    pitchIds: rawPitchIds,
  })
  if (!parsed.success) return { success: false, message: 'Selection invalide pour suppression massive.' }

  const { tournamentId, orgSlug, tournamentSlug, pitchIds } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const pitches = await prisma.pitch.findMany({
      where: {
        tournamentId,
        id: { in: pitchIds },
      },
      select: { id: true, name: true, phaseId: true },
    })

    if (pitches.length === 0) {
      return { success: false, message: 'Aucune piste valide selectionnee.' }
    }

    const counts = await prisma.match.groupBy({
      by: ['pitchId'],
      where: { pitchId: { in: pitches.map((pitch) => pitch.id) } },
      _count: { _all: true },
    })
    const countByPitchId = new Map(counts.map((item) => [item.pitchId, item._count._all]))

    const blocked = pitches.filter((pitch) => (countByPitchId.get(pitch.id) ?? 0) > 0)
    const deletableIds = pitches
      .filter((pitch) => (countByPitchId.get(pitch.id) ?? 0) === 0)
      .map((pitch) => pitch.id)

    if (deletableIds.length > 0) {
      await prisma.pitch.deleteMany({ where: { id: { in: deletableIds } } })
    }

    await recordTournamentAction({
      tournamentId,
      actionType: 'PITCH_BULK_DELETE',
      message: `${deletableIds.length} piste(s) supprimee(s) en masse.${blocked.length > 0 ? ` ${blocked.length} ignoree(s) car des matchs y sont lies.` : ''}`,
      payload: {
        deletedPitchIds: deletableIds,
        blockedPitchIds: blocked.map((pitch) => pitch.id),
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)

    if (deletableIds.length === 0) {
      return { success: false, message: 'Aucune piste supprimee. Des matchs sont lies aux pistes selectionnees.' }
    }

    if (blocked.length > 0) {
      return { success: true, message: `${deletableIds.length} piste(s) supprimee(s). ${blocked.length} piste(s) ignoree(s) car deja utilisee(s) par des matchs.` }
    }

    return { success: true, message: `${deletableIds.length} piste(s) supprimee(s).` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur suppression massive de pistes.' }
  }
}

export async function resetTournamentForReconfiguration(
  formData: FormData
): Promise<ActionState> {
  const parsed = ResetTournamentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Parametres invalides pour reinitialisation.' }

  const { tournamentId, orgSlug, tournamentSlug, resetPitches, resetRegistrations } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const [phaseIds, existingPitchIds] = await Promise.all([
      prisma.phase.findMany({ where: { tournamentId }, select: { id: true, config: true } }),
      prisma.pitch.findMany({ where: { tournamentId }, select: { id: true } }),
    ])

    const phaseIdList = phaseIds.map((phase) => phase.id)
    const pitchIdList = existingPitchIds.map((pitch) => pitch.id)

    const deletedMatchesResult = phaseIdList.length > 0
      ? await prisma.match.deleteMany({ where: { phaseId: { in: phaseIdList } } })
      : { count: 0 }

    const deletedRegistrationsResult = resetRegistrations
      ? await prisma.tournamentRegistration.deleteMany({ where: { tournamentId } })
      : { count: 0 }

    const deletedPitchesResult = resetPitches && pitchIdList.length > 0
      ? await prisma.pitch.deleteMany({ where: { id: { in: pitchIdList } } })
      : { count: 0 }

    await prisma.$transaction(async (tx) => {
      for (const phase of phaseIds) {
        await tx.phase.update({
          where: { id: phase.id },
          data: {
            isCompleted: false,
            config: resetPhaseRuntimeConfig(phase.config),
          },
        })
      }

      await tx.tournament.update({
        where: { id: tournamentId },
        data: { status: 'DRAFT' },
      })
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'TOURNAMENT_RESET',
      message: 'Tournoi reinitialise pour une nouvelle configuration.',
      payload: {
        resetPitches,
        resetRegistrations,
        deletedMatches: deletedMatchesResult.count,
        deletedPitches: deletedPitchesResult.count,
        deletedRegistrations: deletedRegistrationsResult.count,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: `Tournoi reinitialise. Matchs supprimes: ${deletedMatchesResult.count}, pistes supprimees: ${deletedPitchesResult.count}, inscriptions supprimees: ${deletedRegistrationsResult.count}.`,
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur reinitialisation tournoi.' }
  }
}

export async function duplicateTournamentForOrganization(
  formData: FormData
): Promise<ActionState> {
  const parsed = DuplicateTournamentSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Parametres invalides pour duplication.' }

  const { tournamentId, orgSlug, tournamentSlug, targetName, includePitches } = parsed.data
  const targetSlug = sanitizeTournamentSlug(parsed.data.targetSlug)

  if (targetSlug.length < 2) {
    return { success: false, message: 'Slug de duplication invalide.' }
  }

  try {
    const sourceTournament = await assertOrganizerCanManageTournament(tournamentId)

    const slugExists = await prisma.tournament.findFirst({
      where: {
        organizationId: sourceTournament.organizationId,
        slug: targetSlug,
      },
      select: { id: true },
    })

    if (slugExists) {
      return { success: false, message: 'Ce slug existe deja dans l\'organisation.' }
    }

    const sourcePhases = await prisma.phase.findMany({
      where: { tournamentId },
      select: { id: true, name: true, type: true, order: true, config: true },
      orderBy: { order: 'asc' },
    })

    const sourcePitches = includePitches
      ? await prisma.pitch.findMany({
          where: { tournamentId },
          select: { id: true, name: true, phaseId: true },
        })
      : []

    const sourceBracketMatches = includePitches
      ? await prisma.match.findMany({
          where: {
            phase: {
              tournamentId,
              type: { in: [PhaseType.BRACKET_SINGLE, PhaseType.BRACKET_DOUBLE, PhaseType.PLACEMENT_BRACKET, PhaseType.CUSTOM] },
            },
          },
          select: {
            id: true,
            phaseId: true,
            pitchId: true,
            roundNumber: true,
            bracketPos: true,
            scheduledAt: true,
            homeTeamId: true,
            awayTeamId: true,
          },
          orderBy: [{ phaseId: 'asc' }, { roundNumber: 'asc' }, { bracketPos: 'asc' }],
        })
      : []

    const createdTournament = await prisma.$transaction(async (tx) => {
      const duplicatedTournament = await tx.tournament.create({
        data: {
          organizationId: sourceTournament.organizationId,
          gameId: sourceTournament.gameId,
          name: targetName,
          slug: targetSlug,
          description: sourceTournament.description,
          isPublic: sourceTournament.isPublic,
          tabletRequiresReferee: sourceTournament.tabletRequiresReferee,
          maxTeams: sourceTournament.maxTeams,
          status: 'DRAFT',
          startDate: null,
          endDate: null,
          bannerUrl: sourceTournament.bannerUrl,
        },
      })

      const newPhaseIdByOldId = new Map<string, string>()

      for (const sourcePhase of sourcePhases) {
        const sourceConfig =
          sourcePhase.config && typeof sourcePhase.config === 'object'
            ? (sourcePhase.config as Record<string, unknown>)
            : {}

        const createdPhase = await tx.phase.create({
          data: {
            tournamentId: duplicatedTournament.id,
            name: sourcePhase.name,
            type: sourcePhase.type,
            order: sourcePhase.order,
            isCompleted: false,
            config: resetPhaseRuntimeConfig({
              ...sourceConfig,
              routes: [],
            }),
          },
        })

        newPhaseIdByOldId.set(sourcePhase.id, createdPhase.id)
      }

      for (const sourcePhase of sourcePhases) {
        const newPhaseId = newPhaseIdByOldId.get(sourcePhase.id)
        if (!newPhaseId) continue

        const sourceConfig =
          sourcePhase.config && typeof sourcePhase.config === 'object'
            ? (sourcePhase.config as Record<string, unknown>)
            : {}

        const sourceRoutes = readRoutesFromConfig(sourcePhase.config)
        const remappedRoutes = sourceRoutes.map((route) => ({
          ...route,
          toPhaseId: route.toPhaseId && newPhaseIdByOldId.has(route.toPhaseId)
            ? newPhaseIdByOldId.get(route.toPhaseId) ?? null
            : null,
        }))

        await tx.phase.update({
          where: { id: newPhaseId },
          data: {
            config: {
              ...sourceConfig,
              routes: remappedRoutes,
            },
          },
        })
      }

      if (includePitches && sourcePitches.length > 0) {
        const newPitchIdByOldId = new Map<string, string>()
        const newMatchIdByOldId = new Map<string, string>()

        for (const pitch of sourcePitches) {
          const createdPitch = await tx.pitch.create({
            data: {
              tournamentId: duplicatedTournament.id,
              name: pitch.name,
              phaseId: pitch.phaseId ? newPhaseIdByOldId.get(pitch.phaseId) ?? null : null,
            },
            select: { id: true },
          })
          newPitchIdByOldId.set(pitch.id, createdPitch.id)
        }

        for (const match of sourceBracketMatches) {
          const newPhaseId = newPhaseIdByOldId.get(match.phaseId)
          const newPitchId = newPitchIdByOldId.get(match.pitchId)
          if (!newPhaseId || !newPitchId) continue

          const createdMatch = await tx.match.create({
            data: {
              phaseId: newPhaseId,
              pitchId: newPitchId,
              status: MatchStatus.SCHEDULED,
              roundNumber: match.roundNumber,
              bracketPos: match.bracketPos,
              scheduledAt: match.scheduledAt,
              homeTeamId: match.homeTeamId,
              awayTeamId: match.awayTeamId,
            },
            select: { id: true },
          })
          newMatchIdByOldId.set(match.id, createdMatch.id)
        }

        if (newMatchIdByOldId.size > 0) {
          for (const sourcePhase of sourcePhases) {
            const newPhaseId = newPhaseIdByOldId.get(sourcePhase.id)
            if (!newPhaseId) continue

            const duplicatedPhase = await tx.phase.findUnique({
              where: { id: newPhaseId },
              select: { config: true },
            })

            await tx.phase.update({
              where: { id: newPhaseId },
              data: {
                config: remapInterleavedTimeSlotsInConfig(
                  duplicatedPhase?.config,
                  newMatchIdByOldId
                ),
              },
            })
          }
        }
      }

      return duplicatedTournament
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'TOURNAMENT_DUPLICATE',
      message: `Tournoi duplique sous le slug ${targetSlug}.`,
      payload: {
        newTournamentId: createdTournament.id,
        newTournamentSlug: createdTournament.slug,
        includePitches,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    revalidatePath(`/dashboard/org/${orgSlug}/tournaments`)

    return {
      success: true,
      message: `Tournoi duplique avec succes (${createdTournament.name} / ${createdTournament.slug}).`,
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur duplication tournoi.' }
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
      return { success: false, message: 'Une ou plusieurs équipes sont introuvables.' }
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
          message: `Il reste ${remainingSlots} place(s). Selectionnez moins d'équipes.`,
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
      message: result.count > 1 ? `${result.count} équipes inscrites au tournoi.` : 'Equipe inscrite au tournoi.',
      payload: {
        teamIds: uniqueTeamIds,
        insertedCount: result.count,
        isConfirmed,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: result.count > 1 ? `${result.count} équipes inscrites au tournoi.` : 'Equipe inscrite au tournoi.',
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

export async function updateTournamentRegistrationConfirmation(
  formData: FormData
): Promise<ActionState> {
  const parsed = UpdateRegistrationConfirmationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour confirmation.' }

  const { tournamentId, registrationId, orgSlug, tournamentSlug, isConfirmed } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const registration = await prisma.tournamentRegistration.findUnique({
      where: { id: registrationId },
      select: { id: true, tournamentId: true, teamId: true, isConfirmed: true },
    })

    if (!registration || registration.tournamentId !== tournamentId) {
      return { success: false, message: 'Inscription introuvable.' }
    }

    if (registration.isConfirmed === isConfirmed) {
      return { success: true, message: isConfirmed ? 'Equipe deja confirmee.' : 'Equipe deja non confirmee.' }
    }

    await prisma.tournamentRegistration.update({
      where: { id: registrationId },
      data: { isConfirmed },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: isConfirmed ? 'REGISTRATION_CONFIRM' : 'REGISTRATION_UNCONFIRM',
      message: isConfirmed ? 'Equipe confirmee.' : 'Equipe deconfirmee.',
      payload: { registrationId, teamId: registration.teamId, isConfirmed },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: isConfirmed ? 'Equipe confirmee.' : 'Equipe deconfirmee.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur confirmation equipe.' }
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

export async function startTournamentMatchesByScheduleSlot(
  formData: FormData
): Promise<ActionState> {
  const parsed = StartMatchesByScheduleSlotSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Creneau invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, slotAt, timerMinutes } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const startedAt = new Date()

    const scheduledMatches = await prisma.match.findMany({
      where: {
        phase: { tournamentId },
        scheduledAt: slotAt,
        status: MatchStatus.SCHEDULED,
      },
      select: { id: true },
    })

    if (scheduledMatches.length === 0) {
      return { success: false, message: 'Aucun match planifie a lancer pour ce creneau.' }
    }

    const matchIds = scheduledMatches.map((match) => match.id)

    await prisma.match.updateMany({
      where: { id: { in: matchIds } },
      data: { status: MatchStatus.LIVE },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_BULK_UPDATE',
      message: `${matchIds.length} match(s) lances pour le creneau ${slotAt.toISOString()}.`,
      payload: {
        updatedCount: matchIds.length,
        slotAt: slotAt.toISOString(),
        startedAt: startedAt.toISOString(),
        launchedStatus: 'LIVE',
        timerKind: 'MATCH',
        timerMinutes,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${matchIds.length} match(s) lances pour ce creneau.` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur lancement creneau.' }
  }
}

export async function startTournamentBreakTimer(
  formData: FormData
): Promise<ActionState> {
  const parsed = StartTournamentBreakTimerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Temps de battement invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, breakMinutes } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const startedAt = new Date()

    await recordTournamentAction({
      tournamentId,
      actionType: 'TIMER_CONTROL',
      message: `Timer de battement lance (${breakMinutes} min).`,
      payload: {
        startedAt: startedAt.toISOString(),
        timerMinutes: breakMinutes,
        timerKind: 'BREAK',
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `Timer de battement lance pour ${breakMinutes} min.` }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur timer de battement.' }
  }
}

export async function stopTournamentTimer(
  formData: FormData
): Promise<ActionState> {
  const parsed = StopTournamentTimerSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Tournoi invalide.' }

  const { tournamentId, orgSlug, tournamentSlug } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const stoppedAt = new Date()

    await recordTournamentAction({
      tournamentId,
      actionType: 'TIMER_CONTROL',
      message: 'Timer arrete.',
      payload: {
        stoppedAt: stoppedAt.toISOString(),
        timerKind: 'STOP',
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Timer arrete.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur arret timer.' }
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

    let propagationMessage = 'Propagation tentee.'
    try {
      const propagation = await rerunTournamentPropagationForTournament(tournamentId, true)
      propagationMessage = `Propagation relancee (${propagation.finishedBracketMatches} match(s), ${propagation.completedPhases} phase(s)).`
    } catch (error) {
      propagationMessage = `Resultat enregistre. Relance propagation impossible: ${
        error instanceof Error ? error.message : 'Erreur inconnue'
      }`
      revalidateTournamentPath(orgSlug, tournamentSlug)
      return { success: true, message: propagationMessage }
    }

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `Resultat enregistre. ${propagationMessage}` }
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
        select: { id: true, name: true, phaseId: true },
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

    const pitchResources = uniquePitchResources(pitches, phase.id)

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
      if (startAt && existingMatch.scheduledAt.getTime() >= startDate.getTime()) continue
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
        .sort((a, b) => a.groupIndex - b.groupIndex)

      if (groupsWithTeams.length === 0) {
        return { success: false, message: 'Aucune poule avec au moins 2 équipes placees.' }
      }

      const preferredPitchKeyByGroup = resolvePreferredPitchKeyByGroup({
        groupsWithTeams,
        groupConfig,
        pitches,
        pitchResources,
      })

      for (const group of groupsWithTeams) {
        const pairings = buildRoundRobinPairings(group.teamIds)
        pairings.forEach((pairing, pairingIndex) => {
          pairingsToSchedule.push({
            ...pairing,
            bracketPos: `G${group.groupIndex}-R${pairing.round}-M${pairingIndex + 1}`,
            groupIndex: group.groupIndex,
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
        preferredPitchKeyByGroup,
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
          fixedPitchPerGroup: Boolean(preferredPitchKeyByGroup),
        },
      })

      revalidateTournamentPath(orgSlug, tournamentSlug)
      return {
        success: true,
        message: `${matchesToCreate.length} match(s) generes (une piste fixe par poule).`,
      }
    } else {
      const teamIds = registrations.map((registration) => registration.teamId)
      if (teamIds.length < 2) {
        return { success: false, message: 'Au moins 2 équipes sont requises.' }
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
          preferredPitchIdByGroup: Object.fromEntries(
            Object.entries(existing.preferredPitchIdByGroup).filter(([groupIndex]) => Number(groupIndex) <= groupCount)
          ) as Record<number, string>,
        }),
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Configuration des poules enregistree.' }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur configuration poules.' }
  }
}

export async function configurePlacementBracketLabels(
  formData: FormData
): Promise<ActionState> {
  const parsed = ConfigurePlacementBracketLabelsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Configuration des libelles invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const phase = await prisma.phase.findUnique({
      where: { id: phaseId },
      select: { id: true, tournamentId: true, type: true, config: true },
    })

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (phase.type !== 'PLACEMENT_BRACKET') {
      return { success: false, message: 'Cette action est reservee aux phases de placement.' }
    }

    const labels: Record<string, string> = {}
    for (const [key, value] of formData.entries()) {
      if (!key.startsWith('placementLabel_')) continue
      const rawRange = key.slice('placementLabel_'.length)
      const match = rawRange.match(/^(\d+)_(\d+)$/)
      if (!match) continue

      const start = Number(match[1])
      const end = Number(match[2])
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) continue

      const normalizedLabel = String(value ?? '').trim().slice(0, 80)
      if (normalizedLabel.length === 0) continue
      labels[`${start}-${end}`] = normalizedLabel
    }

    const baseConfig: Prisma.InputJsonObject =
      phase.config && typeof phase.config === 'object'
        ? ({ ...(phase.config as Record<string, unknown>) } as Prisma.InputJsonObject)
        : {}

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        config: {
          ...baseConfig,
          placementLabels: labels,
        } as Prisma.InputJsonValue,
      },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'PLACEMENT_LABELS_UPDATE',
      message: `${Object.keys(labels).length} libelle(s) de placement mis a jour.`,
      payload: {
        phaseId,
        labels,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Libelles de placement enregistres.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur configuration des libelles.',
    }
  }
}

export async function configurePlacementBracketRankingSegments(
  formData: FormData
): Promise<ActionState> {
  const parsed = ConfigurePlacementBracketRankingSegmentsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Configuration des segments invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, segmentsText } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const phase = await prisma.phase.findUnique({
      where: { id: phaseId },
      select: { id: true, tournamentId: true, type: true, config: true },
    })

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (phase.type !== 'PLACEMENT_BRACKET') {
      return { success: false, message: 'Cette action est reservee aux phases de placement.' }
    }

    const rawItems = (segmentsText ?? '')
      .split(/[\n;]+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0)

    const segments: Array<{ start: number; end: number; label: string }> = []
    for (const item of rawItems) {
      const match = item.match(/^(\d+)\s*-\s*(\d+)(?:\s*:\s*(.+))?$/)
      if (!match) {
        return {
          success: false,
          message: `Segment invalide: "${item}". Format attendu: 1-15 ou 16-32: Nom.`,
        }
      }

      const start = Number(match[1])
      const end = Number(match[2])
      if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start) {
        return { success: false, message: `Segment invalide: "${item}".` }
      }

      const label = (match[3] ?? `${start}-${end}`).trim().slice(0, 80)
      segments.push({ start, end, label })
    }

    segments.sort((a, b) => a.start - b.start || a.end - b.end)
    for (let i = 1; i < segments.length; i += 1) {
      const prev = segments[i - 1]
      const cur = segments[i]
      if (cur.start <= prev.end) {
        return {
          success: false,
          message: `Segments en chevauchement: ${prev.start}-${prev.end} et ${cur.start}-${cur.end}.`,
        }
      }
    }

    const baseConfig: Prisma.InputJsonObject =
      phase.config && typeof phase.config === 'object'
        ? ({ ...(phase.config as Record<string, unknown>) } as Prisma.InputJsonObject)
        : {}

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        config: {
          ...baseConfig,
          placementRankingSegments: segments,
        } as Prisma.InputJsonValue,
      },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'PLACEMENT_SEGMENTS_UPDATE',
      message: `${segments.length} segment(s) de classement mis a jour.`,
      payload: {
        phaseId,
        segments,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Segments de classement enregistres.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur configuration des segments.',
    }
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

    const incomingQualifiers = await resolveIncomingQualifierIdsForTargetPhase({
      tournamentId,
      targetPhaseId: phaseId,
    })

    let registrations: Array<{ teamId: string; seed: number | null; registeredAt: Date }>

    if (incomingQualifiers.hasRouting) {
      if (incomingQualifiers.teamIds.length === 0) {
        return { success: false, message: 'Aucune equipe qualifiee a placer pour cette phase.' }
      }

      const qualifierOrder = new Map(incomingQualifiers.teamIds.map((teamId, index) => [teamId, index]))
      registrations = await prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
          teamId: { in: incomingQualifiers.teamIds },
          ...(confirmedOnly ? { isConfirmed: true } : {}),
        },
        select: { teamId: true, seed: true, registeredAt: true },
      })

      registrations.sort((a, b) => (qualifierOrder.get(a.teamId) ?? 0) - (qualifierOrder.get(b.teamId) ?? 0))
    } else {
      registrations = await prisma.tournamentRegistration.findMany({
        where: {
          tournamentId,
          ...(confirmedOnly ? { isConfirmed: true } : {}),
        },
        select: { teamId: true, seed: true, registeredAt: true },
        orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }],
      })

      // UX safeguard: if "confirmed only" is requested but none are confirmed yet,
      // fallback to all registrations so auto-placement still works in first setup.
      if (confirmedOnly && registrations.length === 0) {
        registrations = await prisma.tournamentRegistration.findMany({
          where: { tournamentId },
          select: { teamId: true, seed: true, registeredAt: true },
          orderBy: [{ seed: 'asc' }, { registeredAt: 'asc' }],
        })
      }
    }

    if (registrations.length === 0) {
      return { success: false, message: 'Aucune equipe inscrite a placer.' }
    }

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
    if (placements.length === 0) {
      return { success: false, message: 'Aucune equipe n\'a pu etre placee. Verifiez la configuration des poules.' }
    }

    return {
      success: true,
      message: confirmedOnly
        ? `${placements.length} equipe(s) placee(s) automatiquement.`
        : `${placements.length} equipe(s) placee(s) automatiquement.`,
    }
  } catch (error) {
    return { success: false, message: error instanceof Error ? error.message : 'Erreur auto placement.' }
  }
}

export async function configureGroupPitchAssignments(
  formData: FormData
): Promise<ActionState> {
  const parsed = ConfigureGroupPitchAssignmentsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Configuration des pistes par poule invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)
    const phase = await assertGroupPhaseBelongsTournament(phaseId, tournamentId)
    const groupConfig = readGroupPhaseConfig(phase.config)

    const preferredPitchIdByGroup: Record<number, string> = {}
    const selectedPitchIds = new Set<string>()

    for (let groupIndex = 1; groupIndex <= groupConfig.count; groupIndex += 1) {
      const rawValue = String(formData.get(`groupPitch_${groupIndex}`) ?? '').trim()
      if (!rawValue) continue
      preferredPitchIdByGroup[groupIndex] = rawValue
      selectedPitchIds.add(rawValue)
    }

    if (selectedPitchIds.size > 0) {
      const allowedPitches = await prisma.pitch.findMany({
        where: {
          id: { in: Array.from(selectedPitchIds) },
          tournamentId,
          OR: [{ phaseId }, { phaseId: null }],
        },
        select: { id: true },
      })

      if (allowedPitches.length !== selectedPitchIds.size) {
        return { success: false, message: 'Une ou plusieurs pistes selectionnees sont invalides pour cette phase.' }
      }
    }

    await prisma.phase.update({
      where: { id: phaseId },
      data: {
        config: withGroupConfig(phase.config, {
          ...groupConfig,
          preferredPitchIdByGroup,
        }),
      },
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'GROUP_PITCH_ASSIGNMENTS_UPDATE',
      message: 'Pistes preferees par poule mises a jour.',
      payload: {
        phaseId,
        preferredPitchIdByGroup,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: 'Pistes par poule enregistrees.' }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur configuration pistes par poule.',
    }
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

      const incomingQualifiers = await resolveIncomingQualifierIdsForTargetPhase({
        tournamentId,
        targetPhaseId: phaseId,
      })
      if (incomingQualifiers.hasRouting && !incomingQualifiers.teamIds.includes(teamId)) {
        return { success: false, message: 'Cette equipe n\'est pas qualifiee pour cette phase.' }
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
        return { success: false, message: 'Certaines équipes ne sont pas inscrites au tournoi.' }
      }

      const incomingQualifiers = await resolveIncomingQualifierIdsForTargetPhase({
        tournamentId,
        targetPhaseId: phaseId,
      })
      if (incomingQualifiers.hasRouting) {
        const qualifiedIds = new Set(incomingQualifiers.teamIds)
        const allQualified = placements.every((placement) => qualifiedIds.has(placement.teamId))
        if (!allQualified) {
          return { success: false, message: 'Certaines equipes ne sont pas qualifiees pour cette phase.' }
        }
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
      .sort((a, b) => a.groupIndex - b.groupIndex)

    if (groupsWithTeams.length === 0) {
      return { success: false, message: 'Aucune poule avec au moins 2 équipes placees.' }
    }

    const pitchResources = uniquePitchResources(pitches, phase.id)

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
      if (startAt && existingMatch.scheduledAt.getTime() >= startDate.getTime()) continue
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
    const preferredPitchKeyByGroup = resolvePreferredPitchKeyByGroup({
      groupsWithTeams,
      groupConfig,
      pitches,
      pitchResources,
    })

    for (const group of groupsWithTeams) {
      const pairings = buildRoundRobinPairings(group.teamIds)

      pairings.forEach((pairing, pairingIndex) => {
        pairingsToSchedule.push({
          ...pairing,
          bracketPos: `G${group.groupIndex}-R${pairing.round}-M${pairingIndex + 1}`,
          groupIndex: group.groupIndex,
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
      preferredPitchKeyByGroup,
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
        fixedPitchPerGroup: true,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${matchesToCreate.length} match(s) de poules generes (une piste fixe par poule).` }
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

  const { tournamentId, orgSlug, tournamentSlug, updatesJson, rerunPropagation = false } = parsed.data

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
        result: { select: { homeScore: true, awayScore: true } },
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

      const hasScoreUpdate = update.homeScore !== undefined || update.awayScore !== undefined

      if (hasScoreUpdate) {
        const homeScore = update.homeScore ?? match.result?.homeScore
        const awayScore = update.awayScore ?? match.result?.awayScore

        if (homeScore === undefined || awayScore === undefined) {
          return {
            success: false,
            message: 'Pour modifier un score, renseignez les 2 scores (ou gardez l\'autre score deja existant).',
          }
        }

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

        // Any score update implies a finished match.
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

    let propagationMessage = finishedWithScores.length > 0
      ? ` Propagation directe appliquee sur ${finishedWithScores.length} score(s).`
      : ''

    if (rerunPropagation) {
      try {
        const propagation = await rerunTournamentPropagationForTournament(tournamentId, true)
        propagationMessage = ` Propagation complete relancee (${propagation.finishedBracketMatches} match(s), ${propagation.completedPhases} phase(s)).`
      } catch (error) {
        propagationMessage = ` Propagation complete non relancee: ${error instanceof Error ? error.message : 'Erreur inconnue'}`
      }
    }

    await recordTournamentAction({
      tournamentId,
      actionType: 'MATCH_BULK_UPDATE',
      message: `${updates.length} match(s) mis a jour en masse.${propagationMessage}`,
      payload: { updatedCount: updates.length, rerunPropagation },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `${updates.length} match(s) mis a jour.${propagationMessage}` }
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

export async function rerunTournamentPropagationForTournament(
  tournamentId: string,
  force = false
): Promise<{
  finishedBracketMatches: number
  completedPhases: number
  routedBracketTargets: Array<{ phaseId: string; hasRouting: boolean; teamIds: string[] }>
}> {
  const phases = await prisma.phase.findMany({
    where: { tournamentId },
    select: { id: true, type: true, isCompleted: true, config: true },
    orderBy: { order: 'asc' },
  })

  const bracketPhaseIds = phases
    .filter(
      (phase) =>
        phase.type === PhaseType.BRACKET_SINGLE ||
        phase.type === PhaseType.BRACKET_DOUBLE ||
        phase.type === PhaseType.PLACEMENT_BRACKET ||
        phase.type === PhaseType.CUSTOM
    )
    .map((phase) => phase.id)

  const finishedBracketMatches = bracketPhaseIds.length > 0
    ? await prisma.match.findMany({
      where: {
        phaseId: { in: bracketPhaseIds },
        status: MatchStatus.FINISHED,
        result: { isNot: null },
      },
      select: {
        phaseId: true,
        bracketPos: true,
        roundNumber: true,
        homeTeamId: true,
        awayTeamId: true,
        result: { select: { homeScore: true, awayScore: true } },
        phase: { select: { type: true } },
      },
      orderBy: [{ roundNumber: 'asc' }, { bracketPos: 'asc' }],
    })
    : []

  const completedPhases = phases.filter((phase) => phase.isCompleted)

  const routedBracketTargets = await Promise.all(
    phases
      .filter(
        (phase) =>
          phase.type === PhaseType.BRACKET_SINGLE ||
          phase.type === PhaseType.BRACKET_DOUBLE ||
          phase.type === PhaseType.PLACEMENT_BRACKET ||
          phase.type === PhaseType.CUSTOM
      )
      .map(async (phase) => {
        const incoming = await resolveIncomingQualifierIdsForTargetPhase({
          tournamentId,
          targetPhaseId: phase.id,
        })
        return {
          phaseId: phase.id,
          hasRouting: incoming.hasRouting,
          teamIds: incoming.teamIds,
        }
      })
  )

  for (const phase of completedPhases) {
    await prisma.$transaction(async (tx) => {
      await propagateQualifiersToNextPhase(tx, {
        id: phase.id,
        type: phase.type,
        config: phase.config,
      })
    })
  }

  // Recovery step: reconcile round-1 bracket seeding from routing qualifiers.
  // This intentionally overwrites non-finished round-1 slots to fix stale assignments.
  for (const target of routedBracketTargets) {
    if (!target.hasRouting) continue

    await prisma.$transaction(async (tx) => {
      if (force) {
        await tx.match.updateMany({
          where: {
            phaseId: target.phaseId,
            status: { notIn: [MatchStatus.FINISHED, MatchStatus.CANCELLED] },
          },
          data: {
            homeTeamId: null,
            awayTeamId: null,
          },
        })
      }

      const roundOneMatches = await tx.match.findMany({
        where: {
          phaseId: target.phaseId,
          roundNumber: 1,
        },
        select: {
          id: true,
          status: true,
          bracketPos: true,
          homeTeamId: true,
          awayTeamId: true,
        },
        orderBy: { bracketPos: 'asc' },
      })
      roundOneMatches.sort((a, b) => compareRoundOneBracketPos(a.bracketPos, b.bracketPos))

      if (roundOneMatches.length === 0) return

      const lockedTeamIds = new Set<string>()
      for (const match of roundOneMatches) {
        if (match.status !== MatchStatus.FINISHED && match.status !== MatchStatus.CANCELLED) continue
        if (match.homeTeamId) lockedTeamIds.add(match.homeTeamId)
        if (match.awayTeamId) lockedTeamIds.add(match.awayTeamId)
      }

      const queue = target.teamIds.filter((teamId) => !lockedTeamIds.has(teamId))

      for (const match of roundOneMatches) {
        if (match.status === MatchStatus.FINISHED || match.status === MatchStatus.CANCELLED) continue

        const nextHome = queue.shift() ?? null
        const nextAway = queue.shift() ?? null

        if (match.homeTeamId === nextHome && match.awayTeamId === nextAway) continue

        await tx.match.update({
          where: { id: match.id },
          data: {
            homeTeamId: nextHome,
            awayTeamId: nextAway,
          },
        })
      }
    })
  }

  for (const match of finishedBracketMatches) {
    if (!match.result) continue
    const winnerId =
      match.result.homeScore >= match.result.awayScore
        ? match.homeTeamId
        : match.awayTeamId
    const loserId =
      winnerId === null
        ? null
        : winnerId === match.homeTeamId
          ? match.awayTeamId
          : match.homeTeamId

    await prisma.$transaction(async (tx) => {
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
  }

  return {
    finishedBracketMatches: finishedBracketMatches.length,
    completedPhases: completedPhases.length,
    routedBracketTargets,
  }
}

export async function retryTournamentPropagation(
  formData: FormData
): Promise<ActionState> {
  const parsed = RetryTournamentPropagationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Donnees invalides pour relance propagation.' }

  const { tournamentId, orgSlug, tournamentSlug, force = false } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const propagation = await rerunTournamentPropagationForTournament(tournamentId, force)

    await recordTournamentAction({
      tournamentId,
      actionType: 'PROPAGATION_RETRY',
      message: `Relance manuelle de propagation executee (${propagation.finishedBracketMatches} match(s) bracket, ${propagation.completedPhases} phase(s) cloturees).`,
      payload: {
        finishedBracketMatches: propagation.finishedBracketMatches,
        completedPhases: propagation.completedPhases,
        routedTargets: propagation.routedBracketTargets.filter((target) => target.hasRouting).length,
        forced: force,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: `${force ? 'Propagation forcee relancee' : 'Propagation relancee'}. Verification appliquee sur ${propagation.finishedBracketMatches} match(s) de bracket, ${propagation.completedPhases} phase(s) cloturees et ${propagation.routedBracketTargets.filter((target) => target.hasRouting).length} bracket(s) re-seedes.`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur relance propagation.',
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
    maxDurationMinutes,
    teamBreakMinutes,
    includeLosersReplay,
    overwritePhaseMatches,
    placementRanges,
    placementOffset = 0,
    rotationMode,
  } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const phase = await prisma.phase.findUnique({
      where: { id: phaseId },
      select: { id: true, type: true, tournamentId: true, config: true },
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

    const [pitches, registrations, incomingQualifiers, expectedIncomingQualifiers] = await Promise.all([
      prisma.pitch.findMany({
        where: {
          tournamentId,
          OR: [{ phaseId }, { phaseId: null }],
        },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.tournamentRegistration.findMany({
        where: { tournamentId },
        select: { teamId: true, isConfirmed: true, seed: true, registeredAt: true },
        orderBy: [{ isConfirmed: 'desc' }, { seed: 'asc' }, { registeredAt: 'asc' }],
      }),
      resolveIncomingQualifierIdsForTargetPhase({
        tournamentId,
        targetPhaseId: phaseId,
      }),
      resolveExpectedIncomingQualifierCountForTargetPhase({
        tournamentId,
        targetPhaseId: phaseId,
      }),
    ])

    if (pitches.length === 0) {
      return { success: false, message: 'Ajoutez au moins une piste associee au tournoi/phase.' }
    }

    const pitchResources = uniquePitchResources(pitches, phase.id)

    const existing = await prisma.match.count({ where: { phaseId } })
    if (existing > 0 && !overwritePhaseMatches) {
      return { success: false, message: 'Des matchs existent deja (active overwrite pour regenerer).' }
    }

    if (
      incomingQualifiers.hasRouting &&
      expectedIncomingQualifiers.hasRouting &&
      expectedIncomingQualifiers.isDeterministic &&
      expectedIncomingQualifiers.expectedCount !== null &&
      incomingQualifiers.teamIds.length > 0 &&
      incomingQualifiers.teamIds.length !== expectedIncomingQualifiers.expectedCount
    ) {
      return {
        success: false,
        message: `Generation bloquee: ${incomingQualifiers.teamIds.length} qualifie(s) resolu(s) alors que les routes attendent ${expectedIncomingQualifiers.expectedCount}. Verifiez les routes et les placements de poules avant de generer le bracket.`,
      }
    }

    const effectiveParticipantsCount = incomingQualifiers.hasRouting
      ? Math.max(participantsCount, incomingQualifiers.teamIds.length)
      : participantsCount

    const rounds = Math.ceil(Math.log2(effectiveParticipantsCount))
    const normalizedSize = 2 ** rounds
    const hasExplicitStartAt = Boolean(startAt)
    const startDate = startAt ?? new Date()
    const baseStartMs = startDate.getTime()
    const roundDurationMs = (maxDurationMinutes + teamBreakMinutes) * 60 * 1000

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

    const effectiveExistingMatches = hasExplicitStartAt
      ? []
      : overwritePhaseMatches
        ? existingScheduledMatches.filter((match) => match.phaseId !== phaseId)
        : existingScheduledMatches

    const pitchSchedules = new Map<string, Array<{ start: number; end: number }>>(
      pitchResources.map((pitch) => [pitch.key, []])
    )

    for (const existingMatch of effectiveExistingMatches) {
      if (!existingMatch.scheduledAt) continue
      const resourceKey = toPitchResourceKey(existingMatch.pitch.name)
      if (!pitchSchedules.has(resourceKey)) continue
      const existingStart = existingMatch.scheduledAt.getTime()
      const existingEnd = existingStart + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60 * 1000
      const intervals = pitchSchedules.get(resourceKey) ?? []
      intervals.push({ start: existingStart, end: existingEnd })
      pitchSchedules.set(resourceKey, intervals)
    }

    const fallbackSeededTeamIds = registrations.map((r) => r.teamId)
    const seededTeamIds = (incomingQualifiers.hasRouting
      ? incomingQualifiers.teamIds
      : fallbackSeededTeamIds
    ).slice(0, effectiveParticipantsCount)

    const skeletonResult = buildBracketSkeleton({
      phaseId,
      phaseType: phase.type,
      effectiveParticipantsCount,
      seededTeamIds,
      includeLosersReplay,
      placementRanges,
      placementOffset,
      pitchResources,
      roundDurationMs,
    })
    if ('error' in skeletonResult) return { success: false, message: skeletonResult.error }
    const { skeleton: uniqueSkeleton } = skeletonResult

    const scheduledSkeleton = scheduleBracketMatches({
      matches: uniqueSkeleton,
      pitchResources,
      startTimeMs: baseStartMs,
      roundDurationMs,
      pitchSchedules,
    })

    await prisma.$transaction(async (tx) => {
      if (existing > 0 && overwritePhaseMatches) {
        await tx.match.deleteMany({ where: { phaseId } })
      }
      await tx.match.createMany({ data: scheduledSkeleton })

      if (rotationMode === 'interleaved') {
        const phaseMatches = await tx.match.findMany({
          where: { phaseId },
          select: { id: true, scheduledAt: true },
        })

        const interleavedTimeSlots = buildInterleavedTimeSlotsFromMatches(phaseMatches)
        const phaseConfig = phase.config && typeof phase.config === 'object'
          ? { ...(phase.config as Record<string, unknown>) }
          : {}

        await tx.phase.update({
          where: { id: phaseId },
          data: {
            config: {
              ...phaseConfig,
              rotationMode: 'interleaved',
              interleavedTimeSlots,
            } as Prisma.InputJsonValue,
          },
        })
      }
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'BRACKET_GENERATE',
      message: `${scheduledSkeleton.length} match(s) de bracket generes. ${Math.min(seededTeamIds.length, normalizedSize)} equipe(s) assignee(s) automatiquement.`,
      payload: {
        phaseId,
        participantsCount: effectiveParticipantsCount,
        requestedParticipantsCount: participantsCount,
        startAt: startAt ? startAt.toISOString() : null,
        maxDurationMinutes,
        teamBreakMinutes,
        includeLosersReplay,
        overwritePhaseMatches,
        placementRanges: placementRanges?.trim() || null,
        rotationMode,
        generatedCount: scheduledSkeleton.length,
        autoAssignedTeams: Math.min(seededTeamIds.length, normalizedSize),
        seedSource: incomingQualifiers.hasRouting ? 'ROUTES' : 'REGISTRATIONS',
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return {
      success: true,
      message: `${scheduledSkeleton.length} match(s) de bracket personnalise generes (${Math.min(seededTeamIds.length, normalizedSize)} equipe(s) assignee(s), ${effectiveParticipantsCount} participant(s) retenu(s)).`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur generation bracket personnalise.',
    }
  }
}

export async function generateLinkedBracketMatches(
  formData: FormData
): Promise<ActionState> {
  const baseParsed = ManageTournamentBaseSchema.safeParse(Object.fromEntries(formData))
  if (!baseParsed.success) return { success: false, message: 'Donnees invalides pour generation liee.' }

  const { tournamentId, orgSlug, tournamentSlug } = baseParsed.data
  const sourcePhaseId = String(formData.get('phaseId') ?? '').trim()
  if (!sourcePhaseId) {
    return { success: false, message: 'Phase source manquante pour generation liee.' }
  }

  const includeLinkedRaw = formData.get('includeLinked')
  const includeLinked = includeLinkedRaw === 'on' || includeLinkedRaw === 'true' || includeLinkedRaw === '1'

  if (!includeLinked) {
    return generateCustomPlacementBracketMatches(formData)
  }

  const rotationMode: 'sequential' | 'interleaved' =
    formData.get('rotationMode') === 'interleaved' ? 'interleaved' : 'sequential'

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const sourcePhase = await prisma.phase.findUnique({
      where: { id: sourcePhaseId },
      select: { id: true, name: true, tournamentId: true, type: true, config: true, order: true },
    })

    if (!sourcePhase || sourcePhase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase source invalide pour generation liee.' }
    }

    const sourceGroup = readParallelGroupFromConfig(sourcePhase.config)
    if (!sourceGroup) {
      return generateCustomPlacementBracketMatches(formData)
    }

    const candidatePhases = await prisma.phase.findMany({
      where: {
        tournamentId,
        type: { in: [PhaseType.CUSTOM, PhaseType.BRACKET_SINGLE, PhaseType.BRACKET_DOUBLE, PhaseType.PLACEMENT_BRACKET] },
      },
      select: { id: true, name: true, type: true, config: true, order: true },
      orderBy: { order: 'asc' },
    })

    const linkedPhasesByPhaseOrder = candidatePhases.filter(
      (phase) => readParallelGroupFromConfig(phase.config) === sourceGroup
    )

    const routeOrderByPhaseId = await resolveLinkedBracketRouteOrder(
      tournamentId,
      linkedPhasesByPhaseOrder.map((phase) => phase.id)
    )
    const linkedPhases = [...linkedPhasesByPhaseOrder].sort((a, b) => {
      const routeOrderA = routeOrderByPhaseId.get(a.id)
      const routeOrderB = routeOrderByPhaseId.get(b.id)
      if (routeOrderA !== undefined || routeOrderB !== undefined) {
        return (routeOrderA ?? Number.MAX_SAFE_INTEGER) - (routeOrderB ?? Number.MAX_SAFE_INTEGER) || a.order - b.order
      }
      return a.order - b.order
    })

    const requestedParticipantsCount = Number(String(formData.get('participantsCount') ?? '0')) || 0
    const overwritePhaseMatches = formData.get('overwritePhaseMatches') === 'on' || formData.get('overwritePhaseMatches') === 'true'
    const includeLosersReplay = formData.get('includeLosersReplay') === 'on' || formData.get('includeLosersReplay') === 'true'
    const startAtRaw = formData.get('startAt')
    const hasExplicitStartAt = typeof startAtRaw === 'string' && startAtRaw.trim().length > 0
    const parsedStartAt = startAtRaw ? new Date(String(startAtRaw)) : new Date()
    const startAt = Number.isNaN(parsedStartAt.getTime()) ? new Date() : parsedStartAt
    const maxDurationMinutes = Math.max(5, Number(formData.get('maxDurationMinutes') ?? '30') || 30)
    const teamBreakMinutes = Math.max(0, Number(formData.get('teamBreakMinutes') ?? '0') || 0)
    const placementRanges = formData.get('placementRanges') ? String(formData.get('placementRanges')) : undefined
    const roundDurationMs = (maxDurationMinutes + teamBreakMinutes) * 60 * 1000
    const baseStartMs = startAt.getTime()

    if (rotationMode === 'interleaved') {
      const linkedPhaseIds = linkedPhases.map((p) => p.id)

      const [pitches, registrations, existingScheduledMatches] = await Promise.all([
        prisma.pitch.findMany({
          where: {
            tournamentId,
            OR: [...linkedPhaseIds.map((id) => ({ phaseId: id })), { phaseId: null }],
          },
          select: { id: true, name: true, phaseId: true },
          orderBy: { name: 'asc' },
        }),
        prisma.tournamentRegistration.findMany({
          where: { tournamentId },
          select: { teamId: true, isConfirmed: true, seed: true, registeredAt: true },
          orderBy: [{ isConfirmed: 'desc' }, { seed: 'asc' }, { registeredAt: 'asc' }],
        }),
        prisma.match.findMany({
          where: {
            phase: { tournamentId },
            scheduledAt: { not: null },
            status: { not: MatchStatus.CANCELLED },
          },
          select: { phaseId: true, scheduledAt: true, pitch: { select: { name: true } } },
        }),
      ])

      if (pitches.length === 0) {
        return { success: false, message: 'Ajoutez au moins une piste associee au tournoi/phase.' }
      }

      const pitchResources = uniquePitchResources(pitches, linkedPhaseIds[0])
      const linkedPhaseIdSet = new Set(linkedPhaseIds)

      const effectiveExistingMatches = hasExplicitStartAt
        ? []
        : overwritePhaseMatches
          ? existingScheduledMatches.filter((m) => !linkedPhaseIdSet.has(m.phaseId))
          : existingScheduledMatches

      const pitchSchedules = new Map<string, Array<{ start: number; end: number }>>(
        pitchResources.map((pitch) => [pitch.key, []])
      )
      for (const existingMatch of effectiveExistingMatches) {
        if (!existingMatch.scheduledAt) continue
        const resourceKey = toPitchResourceKey(existingMatch.pitch.name)
        if (!pitchSchedules.has(resourceKey)) continue
        const existingStart = existingMatch.scheduledAt.getTime()
        const existingEnd = existingStart + DEFAULT_EXISTING_MATCH_DURATION_MINUTES * 60 * 1000
        const intervals = pitchSchedules.get(resourceKey) ?? []
        intervals.push({ start: existingStart, end: existingEnd })
        pitchSchedules.set(resourceKey, intervals)
      }

      const allSkeletons: BracketSkeletonMatch[] = []
      let phasePlacementOffset = 0

      for (const phase of linkedPhases) {
        const [incomingQualifiers, expectedIncomingQualifiers] = await Promise.all([
          resolveIncomingQualifierIdsForTargetPhase({ tournamentId, targetPhaseId: phase.id }),
          resolveExpectedIncomingQualifierCountForTargetPhase({ tournamentId, targetPhaseId: phase.id }),
        ])

        const autoParticipantsCount =
          (expectedIncomingQualifiers.expectedCount && expectedIncomingQualifiers.expectedCount > 0
            ? expectedIncomingQualifiers.expectedCount
            : 0) ||
          (incomingQualifiers.teamIds.length > 0 ? incomingQualifiers.teamIds.length : 0) ||
          (requestedParticipantsCount > 0 ? requestedParticipantsCount : 8)

        const effectiveParticipantsCount = incomingQualifiers.hasRouting
          ? Math.max(autoParticipantsCount, incomingQualifiers.teamIds.length)
          : autoParticipantsCount

        const fallbackSeededTeamIds = registrations.map((r) => r.teamId)
        const seededTeamIds = (incomingQualifiers.hasRouting
          ? incomingQualifiers.teamIds
          : fallbackSeededTeamIds).slice(0, effectiveParticipantsCount)

        const phaseRounds = Math.ceil(Math.log2(effectiveParticipantsCount))
        const phaseNormalizedSize = 2 ** phaseRounds
        const phasePitchResources = uniquePitchResources(
          pitches.filter((pitch) => pitch.phaseId === phase.id || pitch.phaseId === null),
          phase.id
        )

        const skeletonResult = buildBracketSkeleton({
          phaseId: phase.id,
          phaseType: phase.type,
          effectiveParticipantsCount,
          seededTeamIds,
          includeLosersReplay,
          placementRanges,
          placementOffset: phasePlacementOffset,
          pitchResources: phasePitchResources,
          roundDurationMs,
        })

        if ('error' in skeletonResult) {
          return { success: false, message: `Erreur structure bracket "${phase.name}": ${skeletonResult.error}` }
        }

        allSkeletons.push(...skeletonResult.skeleton)
        phasePlacementOffset += phaseNormalizedSize
      }

      const scheduledSkeleton = scheduleBracketMatches({
        matches: allSkeletons,
        pitchResources,
        startTimeMs: baseStartMs,
        roundDurationMs,
        pitchSchedules,
        rotationMode: 'interleaved',
      })

      await prisma.$transaction(async (tx) => {
        if (overwritePhaseMatches) {
          await tx.match.deleteMany({ where: { phaseId: { in: linkedPhaseIds } } })
        }
        await tx.match.createMany({ data: scheduledSkeleton })

        const generatedMatches = await tx.match.findMany({
          where: { phaseId: { in: linkedPhaseIds } },
          select: { id: true, phaseId: true, scheduledAt: true },
        })

        // Store rotation mode in each phase config for group-level interleaved time slot management
        for (const phase of linkedPhases) {
          const phaseConfig = phase.config && typeof phase.config === 'object' ? { ...(phase.config as Record<string, unknown>) } : {}
          const phaseTimeSlots = buildInterleavedTimeSlotsFromMatches(
            generatedMatches
              .filter((match) => match.phaseId === phase.id)
              .map((match) => ({ id: match.id, scheduledAt: match.scheduledAt }))
          )

          await tx.phase.update({
            where: { id: phase.id },
            data: {
              config: {
                ...phaseConfig,
                rotationMode: 'interleaved',
                interleavedTimeSlots: phaseTimeSlots,
              } as Prisma.InputJsonValue,
            },
          })
        }
      })

      await recordTournamentAction({
        tournamentId,
        actionType: 'BRACKET_GENERATE',
        message: `Generation liee entrelacee: ${scheduledSkeleton.length} match(s) pour le groupe "${sourceGroup}" (${linkedPhases.length} brackets).`,
        payload: {
          group: sourceGroup,
          phases: linkedPhaseIds,
          rotationMode,
          startAt: startAt.toISOString(),
          maxDurationMinutes,
          teamBreakMinutes,
          generatedCount: scheduledSkeleton.length,
        },
      })

      revalidateTournamentPath(orgSlug, tournamentSlug)
      return {
        success: true,
        message: `${scheduledSkeleton.length} match(s) generes en mode entrelacer pour ${linkedPhases.length} bracket(s) du groupe "${sourceGroup}".`,
      }
    }

    // ── Sequential mode ────────────────────────────────────────────────────────
    let generatedCount = 0
    let placementOffset = 0

    for (const phase of linkedPhases) {
      const linkedFormData = new FormData()
      linkedFormData.set('tournamentId', tournamentId)
      linkedFormData.set('orgSlug', orgSlug)
      linkedFormData.set('tournamentSlug', tournamentSlug)
      linkedFormData.set('phaseId', phase.id)

      const [incomingQualifiers, expectedIncomingQualifiers] = await Promise.all([
        resolveIncomingQualifierIdsForTargetPhase({
          tournamentId,
          targetPhaseId: phase.id,
        }),
        resolveExpectedIncomingQualifierCountForTargetPhase({
          tournamentId,
          targetPhaseId: phase.id,
        }),
      ])

      const autoParticipantsCount =
        (expectedIncomingQualifiers.expectedCount && expectedIncomingQualifiers.expectedCount > 0
          ? expectedIncomingQualifiers.expectedCount
          : 0) ||
        (incomingQualifiers.teamIds.length > 0 ? incomingQualifiers.teamIds.length : 0) ||
        (requestedParticipantsCount > 0 ? requestedParticipantsCount : 8)

      const effectiveParticipantsCount = incomingQualifiers.hasRouting
        ? Math.max(autoParticipantsCount, incomingQualifiers.teamIds.length)
        : autoParticipantsCount

      const phaseRounds = Math.ceil(Math.log2(effectiveParticipantsCount))
      const phaseNormalizedSize = 2 ** phaseRounds

      linkedFormData.set('participantsCount', String(autoParticipantsCount))
      linkedFormData.set('placementOffset', String(placementOffset))

      const passThroughFields = [
        'startAt',
        'maxDurationMinutes',
        'teamBreakMinutes',
        'includeLosersReplay',
        'overwritePhaseMatches',
        'placementRanges',
        'rotationMode',
      ]

      for (const field of passThroughFields) {
        const value = formData.get(field)
        if (value !== null) {
          linkedFormData.set(field, String(value))
        }
      }

      const result = await generateCustomPlacementBracketMatches(linkedFormData)
      if (!result.success) {
        return {
          success: false,
          message: `Generation liee interrompue sur "${phase.name}": ${result.message}`,
        }
      }

      generatedCount += 1
      placementOffset += phaseNormalizedSize
    }

    return {
      success: true,
      message: `${generatedCount} phase(s) de bracket liees generees pour le groupe "${sourceGroup}".`,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur generation liee des brackets.',
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
        skippedLines.push(`${lineLabel}: les deux équipes sont identiques`)
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

export async function configureInterleavedTimeSlots(
  formData: FormData
): Promise<ActionState> {
  const parsed = ConfigureInterleavedTimeSlotsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Configuration entrelacee invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, phaseId, timeSlotsJson } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const phase = await prisma.phase.findUnique({
      where: { id: phaseId },
      select: { id: true, tournamentId: true, type: true, config: true },
    })

    if (!phase || phase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase invalide pour ce tournoi.' }
    }

    if (phase.type !== 'PLACEMENT_BRACKET') {
      return { success: false, message: 'Cette action est reservee aux phases de placement.' }
    }

    // Parse and validate the time slots JSON
    let rawTimeSlots: unknown
    try {
      rawTimeSlots = JSON.parse(timeSlotsJson)
    } catch {
      return { success: false, message: 'Format JSON des creneaux invalide.' }
    }

    if (!Array.isArray(rawTimeSlots)) {
      return { success: false, message: 'La liste des creneaux est invalide.' }
    }

    // Validate time slots structure
    const timeSlotSchema = z.object({
      id: z.string().min(1),
      startTimeMs: z.number().int().positive(),
      label: z.string().min(1).max(100),
      selectedMatchIds: z.array(z.string().uuid()),
    })

    const validationResult = z.array(timeSlotSchema).safeParse(rawTimeSlots)
    if (!validationResult.success) {
      return { success: false, message: 'Un ou plusieurs creneaux sont mal formes.' }
    }

    const timeSlots = validationResult.data

    // Verify that all match IDs exist in this phase
    if (timeSlots.length > 0) {
      const allMatchIds = new Set<string>()
      for (const slot of timeSlots) {
        slot.selectedMatchIds.forEach((id) => allMatchIds.add(id))
      }

      if (allMatchIds.size > 0) {
        const existingMatches = await prisma.match.findMany({
          where: {
            phaseId,
            id: { in: Array.from(allMatchIds) },
          },
          select: { id: true },
        })

        const existingIds = new Set(existingMatches.map((m) => m.id))
        const invalidIds = Array.from(allMatchIds).filter((id) => !existingIds.has(id))

        if (invalidIds.length > 0) {
          return { success: false, message: 'Un ou plusieurs matchs ne valident pas pour cette phase.' }
        }
      }
    }

    // Verify no duplicate match assignments across slots
    const allAssignedMatchIds: string[] = []
    for (const slot of timeSlots) {
      allAssignedMatchIds.push(...slot.selectedMatchIds)
    }
    const uniqueMatches = new Set(allAssignedMatchIds)
    if (uniqueMatches.size !== allAssignedMatchIds.length) {
      return { success: false, message: 'Un match est assigne multiple fois au meme creneau.' }
    }

    // Update phase config with interleaved time slots
    const baseConfig: Prisma.InputJsonObject =
      phase.config && typeof phase.config === 'object'
        ? ({ ...(phase.config as Record<string, unknown>) } as Prisma.InputJsonObject)
        : {}

    const matchTimeById = new Map<string, Date>()
    for (const slot of timeSlots) {
      if (slot.selectedMatchIds.length === 0) continue
      const scheduledAt = new Date(slot.startTimeMs)
      slot.selectedMatchIds.forEach((matchId) => {
        matchTimeById.set(matchId, scheduledAt)
      })
    }

    await prisma.$transaction(async (tx) => {
      await tx.phase.update({
        where: { id: phaseId },
        data: {
          config: {
            ...baseConfig,
            interleavedTimeSlots: timeSlots,
          } as Prisma.InputJsonValue,
        },
      })

      await applyInterleavedPhasePitchAssignments({
        tx,
        tournamentId,
        phaseId,
        matchTimeById,
      })
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'INTERLEAVED_TIME_SLOTS_UPDATE',
      message: `${timeSlots.length} creneau(x) entrelace(s) configure(s).`,
      payload: {
        phaseId,
        slotCount: timeSlots.length,
        totalAssignedMatches: allAssignedMatchIds.length,
        scheduledMatchesUpdated: allAssignedMatchIds.length,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `Configuration des ${timeSlots.length} creneau(x) entrelace(s) enregistree.` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur configuration des creneaux entrelaces.',
    }
  }
}

/**
 * Configure interleaved time slots for all phases in a parallel bracket group
 */
export async function configureGroupInterleavedTimeSlots(
  formData: FormData
): Promise<ActionState> {
  const parsed = ConfigureGroupInterleavedTimeSlotsSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { success: false, message: 'Configuration entrelacee groupe invalide.' }

  const { tournamentId, orgSlug, tournamentSlug, sourcePhaseId, timeSlotsJson } = parsed.data

  try {
    await assertOrganizerCanManageTournament(tournamentId)

    const sourcePhase = await prisma.phase.findUnique({
      where: { id: sourcePhaseId },
      select: { id: true, tournamentId: true, type: true, config: true },
    })

    if (!sourcePhase || sourcePhase.tournamentId !== tournamentId) {
      return { success: false, message: 'Phase source invalide pour ce tournoi.' }
    }

    if (sourcePhase.type !== 'PLACEMENT_BRACKET' && sourcePhase.type !== 'CUSTOM') {
      return { success: false, message: 'Cette action est reservee aux phases de brackets personnalises/placement.' }
    }

    // Find parallel group
    const sourceConfig = sourcePhase.config && typeof sourcePhase.config === 'object' ? sourcePhase.config as Record<string, unknown> : {}
    const parallelGroup = typeof sourceConfig.parallelGroup === 'string' ? sourceConfig.parallelGroup : null

    if (!parallelGroup) {
      return { success: false, message: 'Aucun groupe parallele trouve pour cette phase.' }
    }

    // Find all linked phases in the same group
    const linkedPhases = await prisma.phase.findMany({
      where: {
        tournamentId,
        config: {
          path: ['parallelGroup'],
          equals: parallelGroup,
        },
      },
      select: { id: true, config: true },
    })

    if (linkedPhases.length === 0) {
      return { success: false, message: 'Aucune phase associee au groupe trouve.' }
    }

    // Parse and validate time slots JSON
    let rawTimeSlots: unknown
    try {
      rawTimeSlots = JSON.parse(timeSlotsJson)
    } catch {
      return { success: false, message: 'Format JSON des creneaux invalide.' }
    }

    if (!Array.isArray(rawTimeSlots)) {
      return { success: false, message: 'La liste des creneaux est invalide.' }
    }

    // Validate time slots structure
    const timeSlotSchema = z.object({
      id: z.string().min(1),
      startTimeMs: z.number().int().positive(),
      label: z.string().min(1).max(100),
      selectedMatchIds: z.array(z.string().uuid()),
    })

    const validationResult = z.array(timeSlotSchema).safeParse(rawTimeSlots)
    if (!validationResult.success) {
      return { success: false, message: 'Un ou plusieurs creneaux sont mal formes.' }
    }

    const timeSlots = validationResult.data

    // Verify no duplicate match assignments across slots
    const allAssignedMatchIds: string[] = []
    for (const slot of timeSlots) {
      allAssignedMatchIds.push(...slot.selectedMatchIds)
    }
    const uniqueMatches = new Set(allAssignedMatchIds)
    if (uniqueMatches.size !== allAssignedMatchIds.length) {
      return { success: false, message: 'Un match est assigne multiple fois au meme creneau.' }
    }

    await prisma.$transaction(async (tx) => {
      for (const phase of linkedPhases) {
        const baseConfig: Prisma.InputJsonObject =
          phase.config && typeof phase.config === 'object'
            ? ({ ...(phase.config as Record<string, unknown>) } as Prisma.InputJsonObject)
            : {}

        await tx.phase.update({
          where: { id: phase.id },
          data: {
            config: {
              ...baseConfig,
              interleavedTimeSlots: timeSlots,
            } as Prisma.InputJsonValue,
          },
        })
      }

      for (const phase of linkedPhases) {
        const phaseMatchTimeById = new Map<string, Date>()
        const phaseMatchIds = new Set<string>()

        const existingMatches = await tx.match.findMany({
          where: { phaseId: phase.id },
          select: { id: true },
        })

        existingMatches.forEach((match) => phaseMatchIds.add(match.id))

        for (const slot of timeSlots) {
          slot.selectedMatchIds.forEach((matchId) => {
            if (!phaseMatchIds.has(matchId)) return
            phaseMatchTimeById.set(matchId, new Date(slot.startTimeMs))
          })
        }

        await applyInterleavedPhasePitchAssignments({
          tx,
          tournamentId,
          phaseId: phase.id,
          matchTimeById: phaseMatchTimeById,
        })
      }
    })

    await recordTournamentAction({
      tournamentId,
      actionType: 'GROUP_INTERLEAVED_TIME_SLOTS_UPDATE',
      message: `${timeSlots.length} creneau(x) entrelace(s) configure(s) pour le groupe "${parallelGroup}" (${linkedPhases.length} phases).`,
      payload: {
        parallelGroup,
        phaseCount: linkedPhases.length,
        slotCount: timeSlots.length,
        totalAssignedMatches: allAssignedMatchIds.length,
      },
    })

    revalidateTournamentPath(orgSlug, tournamentSlug)
    return { success: true, message: `Configuration des ${timeSlots.length} creneau(x) entrelace(s) enregistree pour ${linkedPhases.length} bracket(s).` }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Erreur configuration des creneaux groups entrelaces.',
    }
  }
}
