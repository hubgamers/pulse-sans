'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthUser } from './utils.actions'
import { OrgRole } from '@prisma/client'
import { validatePhaseFlow } from '@/lib/tournament/phase-flow'

const TournamentStatusEnum = z.enum(['DRAFT', 'REGISTRATION', 'ONGOING', 'FINISHED', 'CANCELLED'])

const toOptionalInt = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined
  return Number(value)
}, z.number().int().positive().max(512).optional())

const toOptionalDate = z.preprocess((value) => {
  if (value === '' || value === null || value === undefined) return undefined
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? undefined : parsed
  }
  return undefined
}, z.date().optional())

const TournamentSchemaBase = z.object({
  name: z.string().min(3, 'Le nom doit faire au moins 3 caractères').max(100),
  slug: z.string().min(2, 'Le slug est requis').max(80),
  organizationId: z.string().uuid('Organization invalide'),
  gameId: z.string().uuid('Jeu invalide'),
  description: z.string().max(500).optional().or(z.literal('')),
  status: TournamentStatusEnum.default('DRAFT'),
  phasesJson: z.string().min(2, 'La configuration des phases est requise.'),
  maxTeams: toOptionalInt,
  startDate: toOptionalDate,
  endDate: toOptionalDate,
  isPublic: z.preprocess((value) => value === 'on' || value === true, z.boolean()),
})

const CreateTournamentSchema = TournamentSchemaBase.refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
  message: 'La date de fin doit être après la date de début.',
  path: ['endDate'],
})

const UpdateTournamentSchema = TournamentSchemaBase.partial()
  .omit({ organizationId: true, phasesJson: true })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: 'La date de fin doit être après la date de début.',
    path: ['endDate'],
  })

export type TournamentFormState = {
  message?: string | null
  errors?: {
    name?: string[]
    slug?: string[]
    organizationId?: string[]
    gameId?: string[]
    description?: string[]
    status?: string[]
    phasesJson?: string[]
    maxTeams?: string[]
    startDate?: string[]
    endDate?: string[]
    isPublic?: string[]
    _form?: string[]
  }
}

export async function createTournament(
  prevState: TournamentFormState,
  formData: FormData
): Promise<TournamentFormState> {
  void prevState
  const user = await getAuthUser()

  const parsed = CreateTournamentSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      message: 'Champs invalides. Veuillez corriger les erreurs.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const {
    name,
    slug,
    organizationId,
    gameId,
    description,
    status,
    phasesJson,
    maxTeams,
    startDate,
    endDate,
    isPublic,
  } = parsed.data

  try {
    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId,
        userId: user.id,
      },
      select: { role: true },
    })

    if (!membership) {
      return { message: "Vous n'êtes pas membre de cette organisation." }
    }

    const canManageTournament = [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MODERATOR].includes(membership.role)

    if (!canManageTournament) {
      return { message: 'Permissions insuffisantes pour créer un tournoi.' }
    }

    const existingSlug = await prisma.tournament.findFirst({
      where: { organizationId, slug },
      select: { id: true },
    })

    if (existingSlug) {
      return {
        message: 'Ce slug est déjà utilisé dans votre organisation.',
        errors: { slug: ['Ce slug est déjà utilisé.'] },
      }
    }

    let rawFlow: unknown
    try {
      rawFlow = JSON.parse(phasesJson)
    } catch {
      return {
        message: 'Le graphe de phases est invalide (JSON).',
        errors: { phasesJson: ['Impossible de lire les phases.'] },
      }
    }

    const validatedFlow = validatePhaseFlow(rawFlow)
    if (!validatedFlow.success) {
      const flowErrorMessage =
        'flatten' in validatedFlow.error
          ? validatedFlow.error.flatten().formErrors[0] || 'Configuration des phases invalide.'
          : validatedFlow.error.message

      return {
        message: flowErrorMessage,
        errors: { phasesJson: [flowErrorMessage] },
      }
    }

    const phaseFlow = [...validatedFlow.data].sort((a, b) => a.order - b.order)

    const tournament = await prisma.$transaction(async (tx) => {
      const createdTournament = await tx.tournament.create({
        data: {
          name,
          slug,
          organizationId,
          gameId,
          description: description || null,
          status,
          maxTeams: maxTeams ?? null,
          startDate: startDate ?? null,
          endDate: endDate ?? null,
          isPublic,
        },
      })

      const phaseIdByKey = new Map<string, string>()

      for (const phase of phaseFlow) {
        const createdPhase = await tx.phase.create({
          data: {
            name: phase.name,
            type: phase.type,
            order: phase.order,
            config: {
              ...(phase.config ?? {}),
              key: phase.key,
              routes: [],
            },
            tournamentId: createdTournament.id,
          },
        })

        phaseIdByKey.set(phase.key, createdPhase.id)
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

      return createdTournament
    })

    revalidatePath(`/dashboard/org/${organizationId}/tournaments`)
    redirect(`/dashboard/org/${organizationId}/tournaments/${tournament.slug}`)
  } catch (error) {
    console.error(error)
    return { message: "Erreur lors de la création du tournoi." }
  }
}

export async function getUserTournaments() {
  const user = await getAuthUser()

  return prisma.tournament.findMany({
    where: {
      organization: {
        members: {
          some: { userId: user.id },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getTournamentById(id: string) {
  return prisma.tournament.findUnique({ where: { id } })
}

export async function updateTournament(
  tournamentId: string,
  prevState: TournamentFormState,
  formData: FormData
): Promise<TournamentFormState> {
  void prevState
  await getAuthUser()

  const parsed = UpdateTournamentSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      message: 'Champs invalides. Veuillez corriger les erreurs.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  try {
    await prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        ...parsed.data,
        description: parsed.data.description === '' ? null : parsed.data.description,
      },
    })

    revalidatePath(`/dashboard/org/*/tournaments/${tournamentId}`)
    return { message: 'Tournoi mis à jour avec succès.' }
  } catch (error) {
    console.error(error)
    return { message: 'Erreur lors de la mise à jour du tournoi.' }
  }
}

export async function deleteTournament(tournamentId: string) {
  await getAuthUser()

  try {
    await prisma.tournament.delete({
      where: { id: tournamentId },
    })
  } catch (error) {
    console.error(error)
    return { error: 'Erreur lors de la suppression du tournoi.' }
  }

  revalidatePath('/dashboard')
  redirect('/dashboard')
}
