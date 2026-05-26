import Link from 'next/link'
import { getOrganizationBySlug } from '@/lib/actions/organization/organization.queries'
import { prisma } from '@/lib/prisma'
import TournamentCreateForm from '@/components/dashboard/tournaments/TournamentCreateForm'

export default async function DashboardOrgCreateTournament({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    const org = await getOrganizationBySlug(slug)

    if (!org) {
        return <div className="text-slate-700">Organisation introuvable.</div>
    }

    const games = await prisma.game.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
    })

    if (games.length === 0) {
        return (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 text-slate-800">
                <h1 className="text-xl font-black">Impossible de creer un tournoi</h1>
                <p className="text-sm text-slate-500">Aucun jeu n'est configure. Ajoutez d'abord un jeu depuis l'administration.</p>
                <Link
                    href={`/dashboard/org/${org.slug}/tournaments`}
                    className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm hover:bg-white"
                >
                    Retour aux tournois
                </Link>
            </div>
        )
    }

    return <TournamentCreateForm organizationId={org.id} orgSlug={org.slug} games={games} />
}
