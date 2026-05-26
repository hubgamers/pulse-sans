import { MatchStatus, OrgRole } from '@prisma/client'
import TabletScoreForm from '@/components/tablet/TabletScoreForm'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

interface TabletPageProps {
  params: Promise<{
    'org-slug': string
    't-slug': string
  }>
}

export default async function TabletPage({ params }: TabletPageProps) {
  const { 'org-slug': orgSlug, 't-slug': tSlug } = await params

  // Fetch tournament with matches
  const tournament = await prisma.tournament.findFirst({
    where: {
      slug: tSlug,
      organization: {
        slug: orgSlug,
      },
    },
    include: {
      phases: {
        include: {
          matches: {
            where: {
              status: {
                in: [MatchStatus.SCHEDULED, MatchStatus.LIVE, MatchStatus.FINISHED],
              },
            },
            include: {
              homeTeam: true,
              awayTeam: true,
              pitch: true,
              result: true,
            },
            orderBy: {
              scheduledAt: 'asc',
            },
          },
        },
      },
      organization: {
        select: {
          id: true,
        },
      },
    },
  })

  if (!tournament) {
    return notFound()
  }

  if (tournament.tabletRequiresReferee) {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return <TabletAccessRequired />

    const membership = await prisma.organizationMember.findFirst({
      where: {
        organizationId: tournament.organization.id,
        userId: user.id,
        role: { in: [OrgRole.OWNER, OrgRole.ADMIN, OrgRole.MODERATOR, OrgRole.REFEREE] },
      },
      select: { id: true },
    })

    if (!membership) {
      return <TabletAccessRequired />
    }
  }

  // Flatten matches
  const matches = tournament.phases.flatMap((p) => p.matches)

  return (
    <div className="min-h-screen bg-gray-950 text-white font-sans">
      <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-10 py-4 sm:py-8">

        {/* HEADER */}
        <header className="text-center border-b border-gray-800 pb-4 sm:pb-6 mb-6 sm:mb-10">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-100">
            {tournament.name}
          </h1>
          <p className="text-gray-400 mt-1 sm:mt-2 text-sm sm:text-base">
            Saisie des scores en temps réel
          </p>
        </header>

        {/* CONTENT */}
        <div className="w-full">
          <TabletScoreForm initialMatches={matches} />
        </div>

      </div>
    </div>
  )
}

function TabletAccessRequired() {
  return (
    <div className="min-h-screen bg-gray-950 px-4 py-16 text-center text-white">
      <div className="mx-auto max-w-md rounded-3xl border border-red-900/60 bg-red-950/20 p-6">
        <h1 className="text-2xl font-black">Acces arbitre requis</h1>
        <p className="mt-3 text-sm text-red-100/80">
          Vous devez etre connecte et disposer des acces arbitre de l&apos;organisation pour utiliser cette tablette de score.
        </p>
        <Link
          href="/auth"
          className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-white px-5 text-sm font-black text-gray-950 transition hover:bg-red-100 active:scale-95"
        >
          Se connecter
        </Link>
      </div>
    </div>
  )
}
