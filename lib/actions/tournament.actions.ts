'use server'

import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthUser } from './utils.actions'

const TournamentStatusEnum = z.enum(['DRAFT', 'REGISTRATION', 'ONGOING', 'FINISHED', 'CANCELLED'])

const CreateTournamentSchema = z.object({
  name: z.string().min(3, 'Le nom doit faire au moins 3 caractères').max(100),
  slug: z.string().min(2, 'Le slug est requis').max(80),
  organizationId: z.string().uuid('Organization invalide'),
  gameId: z.string().uuid('Jeu invalide'),
  description: z.string().max(500).optional().or(z.literal('')),
  status: TournamentStatusEnum.default('DRAFT'),
})

const UpdateTournamentSchema = CreateTournamentSchema.partial().omit({ organizationId: true })

export type TournamentFormState = {
  message?: string | null
  errors?: {
    name?: string[]
    slug?: string[]
    organizationId?: string[]
    gameId?: string[]
    description?: string[]
    status?: string[]
    _form?: string[]
  }
}

export async function createTournament(
  prevState: TournamentFormState,
  formData: FormData
): Promise<TournamentFormState> {
  void prevState
  await getAuthUser()

  const parsed = CreateTournamentSchema.safeParse(Object.fromEntries(formData))

  if (!parsed.success) {
    return {
      message: 'Champs invalides. Veuillez corriger les erreurs.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const { name, slug, organizationId, gameId, description, status } = parsed.data

  try {
    const tournament = await prisma.tournament.create({
      data: {
        name,
        slug,
        organizationId,
        gameId,
        description: description || null,
        status,
      },
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
