"use server";

import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/actions/utils.actions";

export type GlobalSearchResult = {
  id: string;
  type: "organization" | "tournament" | "team" | "player" | "match" | "help";
  title: string;
  subtitle: string;
  href: string;
};

export type DashboardNotification = {
  id: string;
  type: "match" | "member" | "tournament";
  message: string;
  time: string;
  read: boolean;
  href?: string;
};

function formatRelativeTime(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  return `Il y a ${diffDays} j`;
}

async function getAccessibleOrganizationIds(userId: string) {
  const memberships = await prisma.organizationMember.findMany({
    where: { userId },
    select: { organizationId: true },
  });

  return memberships.map((membership) => membership.organizationId);
}

export async function globalDashboardSearch(query: string): Promise<GlobalSearchResult[]> {
  const user = await getAuthUser();
  const term = query.trim();
  if (term.length < 2) return [];

  const helpTerms = ["aide", "doc", "documentation", "guide", "tournoi", "match", "bracket", "equipe", "organisation"];
  const helpResults: GlobalSearchResult[] = helpTerms.some((helpTerm) => helpTerm.includes(term.toLowerCase()) || term.toLowerCase().includes(helpTerm))
    ? [{
        id: "dashboard-help",
        type: "help",
        title: "Centre d'aide",
        subtitle: "Guide utilisateur HubGamers",
        href: "/dashboard/help",
      }]
    : [];

  const organizationIds = await getAccessibleOrganizationIds(user.id);
  if (organizationIds.length === 0) return helpResults;

  const [organizations, tournaments, teams, players, matches] = await Promise.all([
    prisma.organization.findMany({
      where: {
        id: { in: organizationIds },
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { slug: { contains: term, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true, type: true },
      take: 5,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.tournament.findMany({
      where: {
        organizationId: { in: organizationIds },
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { slug: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        organization: { select: { slug: true, name: true } },
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.team.findMany({
      where: {
        organizationId: { in: organizationIds },
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { slug: { contains: term, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        name: true,
        slug: true,
        organization: { select: { slug: true, name: true } },
      },
      take: 6,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.player.findMany({
      where: {
        team: { organizationId: { in: organizationIds } },
        nickname: { contains: term, mode: "insensitive" },
      },
      select: {
        id: true,
        nickname: true,
        team: {
          select: {
            name: true,
            slug: true,
            organization: { select: { slug: true, name: true } },
          },
        },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    }),
    prisma.match.findMany({
      where: {
        phase: { tournament: { organizationId: { in: organizationIds } } },
        OR: [
          { homeTeam: { name: { contains: term, mode: "insensitive" } } },
          { awayTeam: { name: { contains: term, mode: "insensitive" } } },
          { pitch: { name: { contains: term, mode: "insensitive" } } },
          { bracketPos: { contains: term, mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        homeTeam: { select: { name: true } },
        awayTeam: { select: { name: true } },
        pitch: { select: { name: true } },
        phase: {
          select: {
            name: true,
            tournament: {
              select: {
                slug: true,
                name: true,
                organization: { select: { slug: true } },
              },
            },
          },
        },
      },
      take: 5,
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  return [
    ...helpResults,
    ...organizations.map((org) => ({
      id: org.id,
      type: "organization" as const,
      title: org.name,
      subtitle: `Organisation ${org.type.toLowerCase()}`,
      href: `/dashboard/org/${org.slug}`,
    })),
    ...tournaments.map((tournament) => ({
      id: tournament.id,
      type: "tournament" as const,
      title: tournament.name,
      subtitle: `${tournament.organization.name} - ${tournament.status}`,
      href: `/dashboard/org/${tournament.organization.slug}/tournaments/${tournament.slug}`,
    })),
    ...teams.map((team) => ({
      id: team.id,
      type: "team" as const,
      title: team.name,
      subtitle: `Equipe - ${team.organization.name}`,
      href: `/dashboard/org/${team.organization.slug}/teams/${team.slug}/edit`,
    })),
    ...players.map((player) => ({
      id: player.id,
      type: "player" as const,
      title: player.nickname,
      subtitle: `${player.team.name} - ${player.team.organization.name}`,
      href: `/dashboard/org/${player.team.organization.slug}/teams/${player.team.slug}/edit`,
    })),
    ...matches.map((match) => {
      const home = match.homeTeam?.name ?? "A definir";
      const away = match.awayTeam?.name ?? "A definir";
      return {
        id: match.id,
        type: "match" as const,
        title: `${home} vs ${away}`,
        subtitle: `${match.phase.tournament.name} - ${match.pitch.name} - ${match.status}`,
        href: `/dashboard/org/${match.phase.tournament.organization.slug}/tournaments/${match.phase.tournament.slug}/matches/${match.id}`,
      };
    }),
  ].slice(0, 12);
}

export async function getDashboardNotifications(): Promise<DashboardNotification[]> {
  const user = await getAuthUser();
  const organizationIds = await getAccessibleOrganizationIds(user.id);
  const notifications: DashboardNotification[] = [];

  if (user.email) {
    const pendingInvitations = await prisma.organizationInvitation.findMany({
      where: {
        email: { equals: user.email, mode: "insensitive" },
        status: "PENDING",
        expiresAt: { gt: new Date() },
      },
      select: {
        id: true,
        createdAt: true,
        organization: { select: { name: true, slug: true } },
      },
      take: 5,
      orderBy: { createdAt: "desc" },
    });

    notifications.push(...pendingInvitations.map((invite) => ({
      id: `invite-${invite.id}`,
      type: "member" as const,
      message: `Invitation en attente pour ${invite.organization.name}`,
      time: formatRelativeTime(invite.createdAt),
      read: false,
      href: "/dashboard/invitations",
    })));
  }

  if (organizationIds.length === 0) return notifications;

  const tournaments = await prisma.tournament.findMany({
    where: {
      organizationId: { in: organizationIds },
      status: { in: ["DRAFT", "REGISTRATION", "ONGOING"] },
    },
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      updatedAt: true,
      organization: { select: { slug: true, name: true } },
      pitches: { select: { id: true } },
      registrations: { select: { id: true, isConfirmed: true } },
      phases: {
        select: {
          id: true,
          matches: {
            where: {
              OR: [
                { status: "LIVE", result: null },
                { status: "FINISHED", result: null },
                { status: "SCHEDULED", scheduledAt: { lt: new Date() } },
              ],
            },
            select: { id: true, status: true, scheduledAt: true },
            take: 10,
          },
        },
      },
    },
    take: 15,
    orderBy: { updatedAt: "desc" },
  });

  for (const tournament of tournaments) {
    const href = `/dashboard/org/${tournament.organization.slug}/tournaments/${tournament.slug}`;
    const matchesNeedingAttention = tournament.phases.flatMap((phase) => phase.matches);

    if (tournament.phases.length === 0) {
      notifications.push({
        id: `tournament-${tournament.id}-phases`,
        type: "tournament",
        message: `${tournament.name}: configurez les phases`,
        time: formatRelativeTime(tournament.updatedAt),
        read: false,
        href: `${href}?tab=phases`,
      });
    }

    if (tournament.registrations.length === 0) {
      notifications.push({
        id: `tournament-${tournament.id}-teams`,
        type: "tournament",
        message: `${tournament.name}: aucune equipe inscrite`,
        time: formatRelativeTime(tournament.updatedAt),
        read: false,
        href: `${href}?tab=registrations`,
      });
    }

    if (tournament.phases.length > 0 && tournament.pitches.length === 0) {
      notifications.push({
        id: `tournament-${tournament.id}-pitches`,
        type: "tournament",
        message: `${tournament.name}: ajoutez les pistes de jeu`,
        time: formatRelativeTime(tournament.updatedAt),
        read: false,
        href: `${href}?tab=registrations`,
      });
    }

    const matchesWithoutScores = matchesNeedingAttention.filter((match) => match.status === "LIVE" || match.status === "FINISHED");
    if (matchesWithoutScores.length > 0) {
      notifications.push({
        id: `tournament-${tournament.id}-scores`,
        type: "match",
        message: `${tournament.name}: ${matchesWithoutScores.length} score(s) a saisir`,
        time: formatRelativeTime(tournament.updatedAt),
        read: false,
        href: `${href}?tab=matches`,
      });
    }

    const overdueMatches = matchesNeedingAttention.filter((match) => match.status === "SCHEDULED");
    if (overdueMatches.length > 0) {
      notifications.push({
        id: `tournament-${tournament.id}-overdue`,
        type: "match",
        message: `${tournament.name}: ${overdueMatches.length} match(s) planifie(s) en retard`,
        time: formatRelativeTime(tournament.updatedAt),
        read: false,
        href: `${href}?tab=planning-time`,
      });
    }
  }

  return notifications.slice(0, 12);
}
