import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getOrganizationBySlug } from '@/lib/actions/organization/organization.queries'
import { prisma } from '@/lib/prisma'
import {
    recordTournamentMatchResult,
    updateTournamentMatchStatus,
} from '@/lib/actions/tournament-management.actions'

export default async function TournamentMatchDetailsPage({
    params,
}: {
    params: Promise<{ slug: string; 't-slug': string; 'match-id': string }>
}) {
    const { slug, 't-slug': tournamentSlug, 'match-id': matchId } = await params
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
        select: {
            id: true,
            slug: true,
            name: true,
            game: { select: { name: true } },
        },
    })

    if (!tournament) {
        notFound()
    }

    const match = await prisma.match.findFirst({
        where: {
            id: matchId,
            phase: {
                tournamentId: tournament.id,
            },
        },
        include: {
            phase: { select: { id: true, name: true } },
            pitch: { select: { id: true, name: true } },
            homeTeam: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    players: {
                        orderBy: { nickname: 'asc' },
                        select: {
                            id: true,
                            nickname: true,
                            role: true,
                            number: true,
                            isActive: true,
                            user: { select: { username: true, display_name: true } },
                        },
                    },
                },
            },
            awayTeam: {
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    players: {
                        orderBy: { nickname: 'asc' },
                        select: {
                            id: true,
                            nickname: true,
                            role: true,
                            number: true,
                            isActive: true,
                            user: { select: { username: true, display_name: true } },
                        },
                    },
                },
            },
            result: true,
        },
    })

    if (!match) {
        notFound()
    }

    const updateStatusAction = async (formData: FormData) => {
        'use server'
        await updateTournamentMatchStatus(formData)
    }

    const saveResultAction = async (formData: FormData) => {
        'use server'
        await recordTournamentMatchResult(formData)
    }

    return (
        <div className="space-y-6 text-slate-900">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <p className="text-xs uppercase tracking-widest text-slate-500">{org.name}</p>
                    <h1 className="text-2xl md:text-3xl font-black">Detail du match</h1>
                    <p className="mt-2 text-sm text-slate-500">
                        {tournament.name} • {tournament.game.name}
                    </p>
                </div>
                <Link
                    href={`/dashboard/org/${orgSlug}/tournaments/${tournament.slug}`}
                    className="inline-flex items-center rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold hover:border-slate-500 hover:bg-white transition"
                >
                    Retour au tournoi
                </Link>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase text-slate-500">Phase</p>
                    <p className="mt-2 text-sm font-semibold">{match.phase.name}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase text-slate-500">Piste</p>
                    <p className="mt-2 text-sm font-semibold">{match.pitch.name}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase text-slate-500">Statut</p>
                    <p className="mt-2 text-sm font-semibold">{match.status}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase text-slate-500">Horaire</p>
                    <p className="mt-2 text-sm font-semibold">
                        {match.scheduledAt ? new Date(match.scheduledAt).toLocaleString('fr-FR', { timeZone: 'UTC' }) : 'Non planifie'}
                    </p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                    <p className="text-xs uppercase text-slate-500">Score</p>
                    <p className="mt-2 text-sm font-semibold">
                        {match.result ? `${match.result.homeScore} - ${match.result.awayScore}` : 'N/A'}
                    </p>
                </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
                {[match.homeTeam, match.awayTeam].map((team, idx) => (
                    <div key={team?.id || `tbd-${idx}`} className="rounded-xl border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-wider text-slate-500">{idx === 0 ? 'Equipe domicile' : 'Equipe exterieur'}</p>
                        <h2 className="mt-1 text-lg font-bold">{team?.name || 'TBD'}</h2>
                        <p className="text-xs text-slate-500">/{team?.slug || '-'}</p>

                        <div className="mt-3 space-y-2">
                            {team?.players.length ? (
                                team.players.map((player) => (
                                    <div key={player.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                                        <p className="text-sm font-semibold">{player.nickname}</p>
                                        <p className="text-xs text-slate-500">
                                            {player.role || 'Role libre'}
                                            {player.number ? ` • #${player.number}` : ''}
                                            {player.isActive ? ' • Actif' : ' • Inactif'}
                                        </p>
                                        {player.user && (
                                            <p className="text-xs text-slate-500">
                                                Compte: {player.user.display_name || player.user.username || 'User'}
                                            </p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <p className="text-sm text-slate-500">Aucun joueur sur cette equipe.</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid gap-3 md:grid-cols-2">
                <form action={updateStatusAction} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Mettre a jour le statut</h3>
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                    <input type="hidden" name="matchId" value={match.id} />

                    <select name="status" defaultValue={match.status} className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm">
                        <option value="SCHEDULED">SCHEDULED</option>
                        <option value="LIVE">LIVE</option>
                        <option value="FINISHED">FINISHED</option>
                        <option value="CANCELLED">CANCELLED</option>
                    </select>

                    <button type="submit" className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">
                        Sauvegarder statut
                    </button>
                </form>

                <form action={saveResultAction} className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Enregistrer resultat</h3>
                    <input type="hidden" name="tournamentId" value={tournament.id} />
                    <input type="hidden" name="orgSlug" value={orgSlug} />
                    <input type="hidden" name="tournamentSlug" value={tournament.slug} />
                    <input type="hidden" name="matchId" value={match.id} />

                    <div className="grid grid-cols-2 gap-2">
                        <input
                            name="homeScore"
                            type="number"
                            min={0}
                            defaultValue={match.result?.homeScore ?? 0}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                            placeholder="Score domicile"
                        />
                        <input
                            name="awayScore"
                            type="number"
                            min={0}
                            defaultValue={match.result?.awayScore ?? 0}
                            className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                            placeholder="Score exterieur"
                        />
                    </div>

                    <input
                        name="notes"
                        defaultValue={match.result?.notes || ''}
                        className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                        placeholder="Notes de match"
                    />

                    <button type="submit" className="rounded-lg border border-emerald-500/40 px-3 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10">
                        Sauvegarder resultat
                    </button>
                </form>
            </div>
        </div>
    )
}
