import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organization/organization.queries'
import { prisma } from '@/lib/prisma'
import BracketPhaseView from '@/components/dashboard/tournaments/BracketPhaseView'

export default async function TournamentBracketPage({
    params,
}: {
    params: Promise<{ slug: string; 't-slug': string }>
}) {
    const { slug, 't-slug': tournamentSlug } = await params
    const org = await getOrganizationBySlug(slug)

    if (!org) {
        return <div className="text-slate-700">Organisation introuvable.</div>
    }

    const orgSlug = org.slug

    const tournament = await prisma.tournament.findFirst({
        where: {
            organizationId: org.id,
            slug: tournamentSlug,
        },
        include: {
            phases: {
                orderBy: { order: 'asc' },
                where: {
                    type: { in: ['BRACKET_SINGLE', 'BRACKET_DOUBLE', 'PLACEMENT_BRACKET', 'CUSTOM'] },
                },
            },
        },
    })

    if (!tournament) {
        notFound()
    }

    const matches = await prisma.match.findMany({
        where: {
            phase: {
                tournamentId: tournament.id,
            },
        },
        include: {
            homeTeam: { select: { id: true, name: true } },
            awayTeam: { select: { id: true, name: true } },
            pitch: { select: { name: true } },
            result: true,
        },
        orderBy: [{ roundNumber: 'asc' }, { createdAt: 'asc' }],
    })

    return (
        <div className="space-y-6 text-slate-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{org.name}</p>
                    <h1 className="text-2xl md:text-3xl font-black">Visualisation des brackets</h1>
                    <p className="mt-2 text-sm text-slate-500">{tournament.name}</p>
                </div>
                <Link
                    href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}`}
                    className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-white transition"
                >
                    Retour tournoi
                </Link>
            </div>

            {tournament.phases.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                    Aucune phase de bracket ou de placement configuree.
                </div>
            ) : (
                <div className="space-y-4">
                    {tournament.phases.map((phase) => (
                        <BracketPhaseView
                            key={`bracket-page-${phase.id}`}
                            tournamentId={tournament.id}
                            orgSlug={orgSlug}
                            tournamentSlug={tournament.slug}
                            phase={{
                                id: phase.id,
                                name: phase.name,
                                type: phase.type,
                                order: phase.order,
                                config: phase.config,
                            }}
                            matches={matches
                                .filter((match) => match.phaseId === phase.id)
                                .map((match) => ({
                                    id: match.id,
                                    roundNumber: match.roundNumber,
                                    bracketPos: match.bracketPos,
                                    scheduledAt: match.scheduledAt ? match.scheduledAt.toISOString() : null,
                                    pitchName: match.pitch?.name ?? null,
                                    status: match.status,
                                    homeTeamName: match.homeTeam?.name || 'TBD',
                                    awayTeamName: match.awayTeam?.name || 'TBD',
                                    homeScore: match.result?.homeScore ?? null,
                                    awayScore: match.result?.awayScore ?? null,
                                }))}
                        />
                    ))}
                </div>
            )}
        </div>
    )
}
