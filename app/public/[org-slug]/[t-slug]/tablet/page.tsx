import { MatchStatus } from '@prisma/client'
import TabletScoreForm from '@/components/tablet/TabletScoreForm'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'

interface TabletPageProps {
  params: Promise<{
    'org-slug': string
    't-slug': string
  }>
}

export default async function TabletPage({ params }: TabletPageProps) {
  const { 'org-slug': orgSlug, 't-slug': tSlug } = await params

  // Fetch the tournament
  const tournament = await prisma.tournament.findFirst({
    where: {
      slug: tSlug,
      organization: {
        slug: orgSlug
      }
    },
    include: {
      phases: {
        include: {
          matches: {
            where: {
              status: { in: [MatchStatus.SCHEDULED, MatchStatus.LIVE] }
            },
            include: {
              homeTeam: true,
              awayTeam: true,
              pitch: true,
              result: true
            },
            orderBy: {
              scheduledAt: 'asc'
            }
          }
        }
      }
    }
  })

  if (!tournament) {
    return notFound()
  }

  // Flatten matches from all phases
  const matches = tournament.phases.flatMap(p => p.matches)

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="py-6 text-center border-b border-gray-800 mb-8">
          <h1 className="text-3xl font-bold text-gray-100">{tournament.name}</h1>
          <p className="text-gray-400 mt-2">Saisie des Scores (Tablette)</p>
        </header>
        
        <TabletScoreForm initialMatches={matches} />
      </div>
    </div>
  )
}
