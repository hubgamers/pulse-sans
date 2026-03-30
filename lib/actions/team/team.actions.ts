'use server'

import { prisma } from '@/lib/prisma'
import { TeamSchema, TeamUpdateSchema } from '@/lib/validations/team'
import { revalidatePath } from 'next/cache'
import { getAuthUser } from '../utils.actions'
import { redirect } from 'next/navigation'

export type TeamFormState = {
    success?: boolean
    message?: string
    errors?: {
        name?: string[]
        slug?: string[]
        logoUrl?: string[]
        organizationId?: string[]
        teamId?: string[]
        orgSlug?: string[]
    }
}

export async function createTeam(
    prevState: TeamFormState,
    formData: FormData
): Promise<TeamFormState> {
    void prevState
    await getAuthUser()
    const validated = TeamSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validated.success) {
        return {
            success: false,
            message: "Certains champs sont invalides.",
            errors: validated.error.flatten().fieldErrors,
        }
    }

    const { name, slug, organizationId, logoUrl } = validated.data
    const redirectPath = `/dashboard/org/${organizationId}/teams`

    try {
        await prisma.team.create({
            data: {
                name,
                slug,
                organizationId,
                logoUrl: logoUrl || null,
            }
        })
        revalidatePath(redirectPath)
    } catch {
        return {
            success: false,
            message: "Erreur lors de la creation de l'equipe (slug peut-etre deja pris).",
            errors: { slug: ["Slug deja utilise dans cette organisation."] },
        }
    }

    redirect(redirectPath)
}

export async function updateTeam(
    prevState: TeamFormState,
    formData: FormData
): Promise<TeamFormState> {
    void prevState
    const user = await getAuthUser()
    const validated = TeamUpdateSchema.safeParse(Object.fromEntries(formData.entries()))

    if (!validated.success) {
        return {
            success: false,
            message: 'Certains champs sont invalides.',
            errors: validated.error.flatten().fieldErrors,
        }
    }

    const { teamId, name, slug, logoUrl, organizationId, orgSlug } = validated.data

    try {
        const team = await prisma.team.findFirst({
            where: {
                id: teamId,
                organizationId,
                organization: {
                    members: {
                        some: { userId: user.id },
                    },
                },
            },
            select: { id: true },
        })

        if (!team) {
            return {
                success: false,
                message: "Equipe introuvable ou acces refuse.",
            }
        }

        await prisma.team.update({
            where: { id: teamId },
            data: {
                name,
                slug,
                logoUrl: logoUrl || null,
            },
        })

        revalidatePath(`/dashboard/org/${orgSlug}/teams`)
        return { success: true, message: 'Equipe mise a jour avec succes.' }
    } catch {
        return {
            success: false,
            message: "Erreur lors de la mise a jour de l'equipe.",
            errors: { slug: ['Slug deja utilise dans cette organisation.'] },
        }
    }
}

export type BulkImportTeamData = {
    teamName: string
    teamSlug?: string
    teamLogoUrl?: string
    players: {
        nickname: string
        number?: number
        role?: string
    }[]
}

export type BulkImportState = {
    success?: boolean
    message?: string
    createdTeams?: number
    createdPlayers?: number
    errors?: string[]
}

export async function bulkCreateTeamsWithPlayers(
    organizationId: string,
    teamsData: BulkImportTeamData[]
): Promise<BulkImportState> {
    await getAuthUser()

    if (!organizationId || !teamsData || teamsData.length === 0) {
        return {
            success: false,
            message: 'Donnees invalides',
            errors: ['Aucune equipe a importer'],
        }
    }

    const errors: string[] = []
    let createdTeams = 0
    let createdPlayers = 0

    const slugify = (value: string) =>
        value
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '')

    try {
        // Process each team
        for (const teamData of teamsData) {
            if (!teamData.teamName || teamData.teamName.trim().length === 0) {
                errors.push('Une equipe a un nom vide')
                continue
            }

            // Use provided slug or generate from teamName
            const teamSlug = teamData.teamSlug && teamData.teamSlug.trim().length > 0
                ? slugify(teamData.teamSlug)
                : slugify(teamData.teamName)

            if (teamSlug.length === 0) {
                errors.push(`Impossible de generer un slug pour "${teamData.teamName}"`)
                continue
            }

            try {
                // Check if team already exists
                const existingTeam = await prisma.team.findUnique({
                    where: {
                        organizationId_slug: {
                            organizationId,
                            slug: teamSlug,
                        },
                    },
                })

                if (existingTeam) {
                    errors.push(`Equipe "${teamData.teamName}" existe deja`)
                    continue
                }

                // Create team with optional logoUrl
                const team = await prisma.team.create({
                    data: {
                        name: teamData.teamName,
                        slug: teamSlug,
                        organizationId,
                        logoUrl: teamData.teamLogoUrl || null,
                    },
                })

                createdTeams++

                // Create players for this team
                if (teamData.players && teamData.players.length > 0) {
                    for (const player of teamData.players) {
                        if (player.nickname && player.nickname.trim().length > 0) {
                            await prisma.player.create({
                                data: {
                                    nickname: player.nickname,
                                    number: player.number || null,
                                    role: player.role || null,
                                    teamId: team.id,
                                },
                            })
                            createdPlayers++
                        }
                    }
                }
            } catch (error) {
                errors.push(`Erreur lors de la creation de "${teamData.teamName}": ${error instanceof Error ? error.message : 'Erreur inconnue'}`)
            }
        }

        revalidatePath('/admin/teams')

        return {
            success: errors.length === 0,
            message: `Import complet: ${createdTeams} équipe(s) créée(s), ${createdPlayers} joueur(s) créé(s)`,
            createdTeams,
            createdPlayers,
            errors: errors.length > 0 ? errors : undefined,
        }
    } catch (error) {
        return {
            success: false,
            message: 'Erreur lors de l\'import en masse',
            errors: [error instanceof Error ? error.message : 'Erreur inconnue'],
        }
    }
}