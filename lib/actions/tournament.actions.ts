'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { getAuthUser } from './utils.actions'



// ─────────────────────────────────────────
// HELPER — check tournament ownership
// ─────────────────────────────────────────
async function assertTournamentOrganizer(tournamentId: string, userId: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
    select: { organizer_id: true },
  })

  if (!tournament) {
    throw new Error('Tournoi non trouvé')
  }

  if (tournament.organizer_id !== userId) {
    throw new Error("Permission refusée : vous n'êtes pas l'organisateur")
  }

  return tournament
}

// ─────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────
const TournamentFormatEnum = z.enum([
  'SINGLE_ELIM',
  'DOUBLE_ELIM',
  'SWISS',
  'POULES',
  'FFA',
])

const CreateTournamentSchema = z.object({
  name: z.string().min(3, 'Le nom doit faire au moins 3 caractères').max(100),
  game_name: z.string().min(2, 'Le nom du jeu est requis').max(50),
  format_type: TournamentFormatEnum,
  max_participants: z.coerce
    .number()
    .int()
    .min(2, 'Il faut au moins 2 participants'),
  // FormData envoie tout en string, on transforme la string JSON en objet
  format_settings: z.string().transform((str, ctx) => {
    try {
      return JSON.parse(str)
    } catch (e) {
      ctx.addIssue({ code: 'custom', message: 'Format des settings invalide' })
      return z.NEVER
    }
  }),
})

export type TournamentFormState = {
  message?: string | null
  errors?: {
    name?: string[]
    game_name?: string[]
    format_type?: string[]
    max_participants?: string[]
    format_settings?: string[]
    _form?: string[]
  }
}

// ─────────────────────────────────────────
// CREATE TOURNAMENT
// ─────────────────────────────────────────
export async function createTournament(
  prevState: TournamentFormState,
  formData: FormData
): Promise<TournamentFormState> {
  const user = await getAuthUser()

  const parsed = CreateTournamentSchema.safeParse({
    name: formData.get('name'),
    game_name: formData.get('game_name'),
    format_type: formData.get('format_type'),
    max_participants: formData.get('max_participants'),
    format_settings: formData.get('format_settings'),
  })

  if (!parsed.success) {
    return {
      message: 'Champs invalides. Veuillez corriger les erreurs.',
      errors: parsed.error.flatten().fieldErrors,
    }
  }

  const {
    name,
    game_name,
    format_type,
    max_participants,
    format_settings,
  } = parsed.data

  let tournament
  try {
    tournament = await prisma.tournament.create({
      data: {
        name,
        game_name,
        format_type,
        max_participants,
        format_settings,
        organizer_id: user.id,
        status: 'SETUP', // Statut par défaut à la création
      },
    })
  } catch (e) {
    console.error(e)
    return { message: "Erreur lors de la création du tournoi." }
  }

  revalidatePath('/dashboard/competition')
  redirect(`/dashboard/competition/${tournament.id}`)
}

// ─────────────────────────────────────────
// GET USER'S TOURNAMENTS
// ─────────────────────────────────────────
export async function getUserTournaments() {
  const user = await getAuthUser()

  const tournaments = await prisma.tournament.findMany({
    where: { organizer_id: user.id },
    orderBy: { createdAt: 'desc' },
  })

  return tournaments
}

// ─────────────────────────────────────────
// GET TOURNAMENT BY ID
// ─────────────────────────────────────────
export async function getTournamentById(id: string) {
  const tournament = await prisma.tournament.findUnique({
    where: { id },
    // Inclure d'autres données si nécessaire (participants, etc.)
  })

  return tournament
}

// ─────────────────────────────────────────
// UPDATE TOURNAMENT
// ─────────────────────────────────────────
const UpdateTournamentSchema = CreateTournamentSchema.partial()

export async function updateTournament(
  tournamentId: string,
  prevState: TournamentFormState,
  formData: FormData
): Promise<TournamentFormState> {
  const user = await getAuthUser()
  await assertTournamentOrganizer(tournamentId, user.id)

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
      data: parsed.data,
    })

    revalidatePath(`/dashboard/competition/${tournamentId}`)
    revalidatePath('/dashboard/competition')
    return { message: 'Tournoi mis à jour avec succès.' }
  } catch (e) {
    console.error(e)
    return { message: 'Erreur lors de la mise à jour du tournoi.' }
  }
}

// ─────────────────────────────────────────
// DELETE TOURNAMENT
// ─────────────────────────────────────────
export async function deleteTournament(tournamentId: string) {
  const user = await getAuthUser()
  await assertTournamentOrganizer(tournamentId, user.id)

  try {
    await prisma.tournament.delete({
      where: { id: tournamentId },
    })
  } catch (e) {
    console.error(e)
    return { error: 'Erreur lors de la suppression du tournoi.' }
  }

  revalidatePath('/dashboard/competition')
  redirect('/dashboard/competition')
}