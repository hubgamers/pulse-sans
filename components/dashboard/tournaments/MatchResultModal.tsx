'use client'

import { useState } from 'react'
import { recordTournamentMatchResult } from '@/lib/actions/tournament-management.actions'

type BracketMatch = {
    id: string
    phaseId: string
    roundNumber: number | null
    bracketPos: string | null
    status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED'
    homeTeamId: string | null
    homeTeamName: string
    awayTeamId: string | null
    awayTeamName: string
    homeScore: number | null
    awayScore: number | null
}

type Props = {
    match: BracketMatch
    orgSlug: string
    tournamentSlug: string
    tournamentId: string
    onClose: () => void
    onSuccess: () => void
}

export default function MatchResultModal({
    match,
    orgSlug,
    tournamentSlug,
    tournamentId,
    onClose,
    onSuccess,
}: Props) {
    const [homeScore, setHomeScore] = useState<number | string>(match.homeScore ?? '')
    const [awayScore, setAwayScore] = useState<number | string>(match.awayScore ?? '')
    const [notes, setNotes] = useState('')
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsLoading(true)
        setError(null)
        setSuccess(false)

        try {
            const formData = new FormData()
            formData.append('tournamentId', tournamentId)
            formData.append('orgSlug', orgSlug)
            formData.append('tournamentSlug', tournamentSlug)
            formData.append('matchId', match.id)
            formData.append('homeScore', String(homeScore))
            formData.append('awayScore', String(awayScore))
            formData.append('notes', notes)

            const result = await recordTournamentMatchResult(formData)

            if (result.success) {
                setSuccess(true)
                setTimeout(() => {
                    onSuccess()
                }, 1000)
            } else {
                setError(result.message || 'Erreur lors de la sauvegarde')
            }
        } catch {
            setError('Erreur lors de la sauvegarde du résultat')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-md rounded-2xl border border-slate-600 bg-gradient-to-br from-slate-800 to-slate-900 shadow-2xl">
                {/* Header */}
                <div className="border-b border-slate-600 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                                {match.bracketPos || 'Match'}
                            </p>
                            <h2 className="mt-1 text-lg font-bold text-white">Résultat du Match</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="rounded-lg p-2 text-slate-400 hover:bg-slate-700/50 hover:text-slate-200 transition"
                        >
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="space-y-6 px-6 py-5">
                    {/* Teams Display */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Équipes en présence
                        </label>
                        <div className="space-y-2">
                            <div className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2">
                                <p className="text-sm font-semibold text-slate-200">{match.homeTeamName}</p>
                            </div>
                            <div className="rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2">
                                <p className="text-sm font-semibold text-slate-200">{match.awayTeamName}</p>
                            </div>
                        </div>
                    </div>

                    {/* Score Input */}
                    <div className="space-y-3">
                        <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Résultats
                        </label>
                        <div className="grid grid-cols-5 gap-2 items-end">
                            <div className="col-span-2">
                                <label htmlFor="homeScore" className="block text-xs text-slate-400 mb-1.5">
                                    {match.homeTeamName}
                                </label>
                                <input
                                    id="homeScore"
                                    type="number"
                                    min="0"
                                    max="999"
                                    value={homeScore}
                                    onChange={(e) => setHomeScore(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-center text-lg font-bold text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                                    placeholder="0"
                                />
                            </div>
                            <div className="text-center text-xl font-bold text-slate-400">-</div>
                            <div className="col-span-2">
                                <label htmlFor="awayScore" className="block text-xs text-slate-400 mb-1.5">
                                    {match.awayTeamName}
                                </label>
                                <input
                                    id="awayScore"
                                    type="number"
                                    min="0"
                                    max="999"
                                    value={awayScore}
                                    onChange={(e) => setAwayScore(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                    className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-center text-lg font-bold text-white placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-2">
                        <label htmlFor="notes" className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Remarques (optionnel)
                        </label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="w-full rounded-lg border border-slate-600 bg-slate-900/50 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:border-teal-400 focus:outline-none focus:ring-1 focus:ring-teal-400"
                            placeholder="Ajouter une remarque..."
                            rows={3}
                        />
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="rounded-lg border border-red-900/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                            {error}
                        </div>
                    )}

                    {/* Success Message */}
                    {success && (
                        <div className="rounded-lg border border-emerald-900/50 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
                            Résultat enregistré avec succès !
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500 hover:bg-slate-700/50 transition"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading || homeScore === '' || awayScore === ''}
                            className="flex-1 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:shadow-teal-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                        >
                            {isLoading ? 'Sauvegarde...' : 'Enregistrer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}
