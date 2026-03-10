// lib/actions/organization.actions.ts
'use server'

import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

// ─────────────────────────────────────────
// SCHEMAS DE VALIDATION
// ─────────────────────────────────────────

const CreateOrgSchema = z.object({
  name: z.string().min(2, 'Le nom doit faire au moins 2 caractères').max(50),
  slug: z
    .string()
    .min(2)
    .max(30)
    .regex(/^[a-z0-9-]+$/, 'Slug invalide : minuscules, chiffres et tirets uniquement'),
  type: z.enum(['SPORT', 'ESPORT', 'MIXED']).default('MIXED'),
  logoUrl: z.string().url().optional().or(z.literal('')),
})

const UpdateOrgSchema = z.object({
  name: z.string().min(2).max(50).optional(),
  logoUrl: z.string().url().optional().or(z.literal('')),
  type: z.enum(['SPORT', 'ESPORT', 'MIXED']).optional(),
})

const AddMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['ADMIN', 'MODERATOR', 'MEMBER']).default('MEMBER'),
})

// ─────────────────────────────────────────
// HELPER — récupère l'utilisateur connecté
// ─────────────────────────────────────────

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    redirect('/login')
  }

  return user
}

// ─────────────────────────────────────────
// HELPER — vérifie le rôle dans une orga
// ─────────────────────────────────────────

async function assertOrgRole(
  organizationId: string,
  userId: string,
  roles: ('OWNER' | 'ADMIN' | 'MODERATOR' | 'MEMBER')[]
) {
  const member = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: { organizationId, userId },
    },
  })

  if (!member || !roles.includes(member.role)) {
    throw new Error('Permission refusée')
  }

  return member
}

// ─────────────────────────────────────────
// CREATE ORGANIZATION
// ─────────────────────────────────────────

export async function createOrganization(formData: FormData) {
  const user = await getAuthUser()

  const parsed = CreateOrgSchema.safeParse({
    name:    formData.get('name'),
    slug:    formData.get('slug'),
    type:    formData.get('type'),
    logoUrl: formData.get('logoUrl'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const { name, slug, type, logoUrl } = parsed.data

  // Vérifie que le slug n'est pas déjà pris
  const existing = await prisma.organization.findUnique({ where: { slug } })
  if (existing) {
    return { error: { slug: ['Ce slug est déjà utilisé'] } }
  }

  const org = await prisma.organization.create({
    data: {
      name,
      slug,
      type,
      logoUrl: logoUrl || null,
      ownerId: user.id,
      // Crée automatiquement le membre OWNER
      members: {
        create: {
          userId: user.id,
          role: 'OWNER',
        },
      },
    },
  })

  revalidatePath('/dashboard')
  redirect(`/dashboard/org/${org.slug}`)
}

// ─────────────────────────────────────────
// GET ORGANIZATION BY SLUG
// ─────────────────────────────────────────

export async function getOrganizationBySlug(slug: string) {
  const user = await getAuthUser()

  const org = await prisma.organization.findUnique({
    where: { slug },
    include: {
      owner: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
      members: {
        include: {
          user: {
            select: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
        orderBy: { joinedAt: 'asc' },
      },
      teams: {
        orderBy: { createdAt: 'desc' },
      },
      tournaments: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  })

  if (!org) return null

  // Vérifie que l'utilisateur est membre
  const isMember = org.members.some((m) => m.userId === user.id)
  if (!isMember) return null

  return org
}

// ─────────────────────────────────────────
// GET USER ORGANIZATIONS
// ─────────────────────────────────────────

export async function getUserOrganizations() {
  const user = await getAuthUser()

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: user.id },
    include: {
      organization: {
        include: {
          _count: {
            select: { members: true, teams: true, tournaments: true },
          },
        },
      },
    },
    orderBy: { joinedAt: 'asc' },
  })

  return memberships.map((m) => ({
    ...m.organization,
    role: m.role,
  }))
}

// ─────────────────────────────────────────
// UPDATE ORGANIZATION
// ─────────────────────────────────────────

export async function updateOrganization(
  organizationId: string,
  formData: FormData
) {
  const user = await getAuthUser()

  await assertOrgRole(organizationId, user.id, ['OWNER', 'ADMIN'])

  const parsed = UpdateOrgSchema.safeParse({
    name:    formData.get('name'),
    logoUrl: formData.get('logoUrl'),
    type:    formData.get('type'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: {
      ...parsed.data,
      logoUrl: parsed.data.logoUrl || null,
    },
  })

  revalidatePath(`/dashboard/org/${org.slug}`)
  return { success: true, org }
}

// ─────────────────────────────────────────
// ADD MEMBER
// ─────────────────────────────────────────

export async function addOrganizationMember(
  organizationId: string,
  formData: FormData
) {
  const user = await getAuthUser()

  await assertOrgRole(organizationId, user.id, ['OWNER', 'ADMIN'])

  const parsed = AddMemberSchema.safeParse({
    userId: formData.get('userId'),
    role:   formData.get('role'),
  })

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors }
  }

  // Vérifie que l'utilisateur cible existe
  const targetUser = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
  })

  if (!targetUser) {
    return { error: { userId: ['Utilisateur introuvable'] } }
  }

  // Vérifie qu'il n'est pas déjà membre
  const existingMember = await prisma.organizationMember.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: parsed.data.userId,
      },
    },
  })

  if (existingMember) {
    return { error: { userId: ['Cet utilisateur est déjà membre'] } }
  }

  const member = await prisma.organizationMember.create({
    data: {
      organizationId,
      userId: parsed.data.userId,
      role: parsed.data.role,
    },
    include: {
      user: {
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      },
    },
  })

  revalidatePath(`/dashboard/org`)
  return { success: true, member }
}

// ─────────────────────────────────────────
// UPDATE MEMBER ROLE
// ─────────────────────────────────────────

export async function updateMemberRole(
  organizationId: string,
  targetUserId: string,
  newRole: 'ADMIN' | 'MODERATOR' | 'MEMBER'
) {
  const user = await getAuthUser()

  // Seul le OWNER peut changer les rôles
  await assertOrgRole(organizationId, user.id, ['OWNER'])

  // On ne peut pas changer le rôle du OWNER lui-même
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerId: true },
  })

  if (org?.ownerId === targetUserId) {
    return { error: 'Impossible de modifier le rôle du propriétaire' }
  }

  const member = await prisma.organizationMember.update({
    where: {
      organizationId_userId: { organizationId, userId: targetUserId },
    },
    data: { role: newRole },
  })

  revalidatePath(`/dashboard/org`)
  return { success: true, member }
}

// ─────────────────────────────────────────
// REMOVE MEMBER
// ─────────────────────────────────────────

export async function removeOrganizationMember(
  organizationId: string,
  targetUserId: string
) {
  const user = await getAuthUser()

  // Un membre peut quitter lui-même, sinon OWNER/ADMIN requis
  if (user.id !== targetUserId) {
    await assertOrgRole(organizationId, user.id, ['OWNER', 'ADMIN'])
  }

  // On ne peut pas retirer le OWNER
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerId: true, slug: true },
  })

  if (org?.ownerId === targetUserId) {
    return { error: 'Impossible de retirer le propriétaire' }
  }

  await prisma.organizationMember.delete({
    where: {
      organizationId_userId: { organizationId, userId: targetUserId },
    },
  })

  revalidatePath(`/dashboard/org/${org?.slug}`)

  // Si l'utilisateur se retire lui-même, redirige vers le dashboard
  if (user.id === targetUserId) {
    redirect('/dashboard')
  }

  return { success: true }
}

// ─────────────────────────────────────────
// DELETE ORGANIZATION
// ─────────────────────────────────────────

export async function deleteOrganization(organizationId: string) {
  const user = await getAuthUser()

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { ownerId: true },
  })

  if (!org || org.ownerId !== user.id) {
    return { error: 'Seul le propriétaire peut supprimer cette organisation' }
  }

  await prisma.organization.delete({
    where: { id: organizationId },
  })

  revalidatePath('/dashboard')
  redirect('/dashboard')
}