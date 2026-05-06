'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { submitScoreFromTablet } from '../../lib/actions/tablet-score.actions'

type TeamLite = {
  id: string
  name: string
}

type PitchLite = {
  name: string
}

type MatchResultLite = {
  homeScore: number
  awayScore: number
}

type TabletMatch = {
  id: string
  scheduledAt: Date | null
  homeTeam: TeamLite | null
  awayTeam: TeamLite | null
  pitch: PitchLite | null
  result: MatchResultLite | null
}

type SubmitResponse = {
  success: boolean
  error?: string
}

export default function TabletScoreForm({ initialMatches }: { initialMatches: TabletMatch[] }) {
  const router = useRouter()
  const [selectedMatch, setSelectedMatch] = useState<TabletMatch | null>(null)
  const [homeScore, setHomeScore] = useState<number>(0)
  const [awayScore, setAwayScore] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')

  const handleSelectMatch = (match: TabletMatch) => {
    setSelectedMatch(match)
    setHomeScore(match.result?.homeScore ?? 0)
    setAwayScore(match.result?.awayScore ?? 0)
    setMessage('')
  }

  const handleSubmit = async () => {
    if (!selectedMatch) return

    setIsSubmitting(true)
    setMessage('')

    try {
      const res = (await submitScoreFromTablet(selectedMatch.id, homeScore, awayScore)) as SubmitResponse

      if (res.success) {
        setMessage('Score mis à jour ✅')
        setTimeout(() => {
          setSelectedMatch(null)
          router.refresh()
        }, 1200)
      } else {
        setMessage(`Erreur: ${res.error ?? 'inconnue'}`)
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue'
      setMessage(`Erreur: ${errorMessage}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (selectedMatch) {
    return (
      <div className="flex flex-col items-center max-w-4xl mx-auto p-4">
        <button
          onClick={() => setSelectedMatch(null)}
          className="self-start mb-8 text-gray-400 text-xl flex items-center gap-2 hover:text-white transition-colors"
          type="button"
        >
          ← Retour à la liste
        </button>

        <div className="w-full bg-gray-900 rounded-3xl p-10 shadow-2xl border border-gray-800 flex flex-col md:flex-row justify-between items-center gap-8">
          {/* ÉQUIPE DOMICILE */}
          <div className="flex flex-col items-center flex-1 w-full">
            <h2 className="text-2xl font-bold mb-6 text-blue-400 text-center h-16 flex items-center">
              {selectedMatch.homeTeam?.name ?? 'TBD'}
            </h2>
            
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={homeScore}
              onChange={(e) => setHomeScore(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ fontSize: '5rem' }}
              className="w-32 h-32 md:w-40 md:h-40 bg-gray-800 border-4 border-blue-600 rounded-3xl text-6xl font-mono text-center focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all"
            />
            <p className="mt-4 text-gray-500 font-medium tracking-widest uppercase text-xs">Domicile</p>
          </div>

          <div className="flex items-center">
            <span className="text-4xl font-black text-gray-700 italic">VS</span>
          </div>

          {/* ÉQUIPE EXTÉRIEUR */}
          <div className="flex flex-col items-center flex-1 w-full">
            <h2 className="text-2xl font-bold mb-6 text-red-400 text-center h-16 flex items-center">
              {selectedMatch.awayTeam?.name ?? 'TBD'}
            </h2>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={awayScore}
              onChange={(e) => setAwayScore(Math.max(0, parseInt(e.target.value) || 0))}
              style={{ fontSize: '5rem' }}
              className="w-32 h-32 md:w-40 md:h-40 bg-gray-800 border-4 border-red-600 rounded-3xl text-6xl font-mono text-center focus:outline-none focus:ring-4 focus:ring-red-500/50 transition-all"
            />
            <p className="mt-4 text-gray-500 font-medium tracking-widest uppercase text-xs">Extérieur</p>
          </div>
        </div>

        <div className="mt-12 w-full max-w-md">
          <button
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="w-full py-6 bg-green-600 hover:bg-green-500 active:bg-green-700 text-2xl font-black rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            type="button"
          >
            {isSubmitting ? 'Enregistrement...' : 'VALIDER LE SCORE'}
          </button>

          {message && (
            <div className={`mt-6 text-lg text-center rounded-xl p-4 font-bold ${message.includes('Erreur') ? 'bg-red-900/30 text-red-400 border border-red-800' : 'bg-green-900/30 text-green-400 border border-green-800'
              }`}>
              {message}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-8 text-center text-gray-400 uppercase tracking-widest">
        Matchs en cours
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialMatches.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
            <p className="text-gray-500 text-xl">Aucun match disponible pour le moment.</p>
          </div>
        ) : (
          initialMatches.map((match) => (
            <button
              key={match.id}
              onClick={() => handleSelectMatch(match)}
              className="group bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-2xl p-6 text-left transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] active:scale-95"
              type="button"
            >
              <div className="text-xs text-gray-500 flex justify-between mb-4 font-medium italic">
                <span className="bg-gray-800 px-2 py-1 rounded">{match.pitch?.name ?? 'Terrain inconnu'}</span>
                <span>
                  {match.scheduledAt
                    ? new Date(match.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '--:--'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-200 truncate pr-2 group-hover:text-blue-400 transition-colors">
                    {match.homeTeam?.name ?? '?'}
                  </span>
                  <span className="text-gray-600 font-mono text-xl">
                    {match.result?.homeScore ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-bold text-gray-200 truncate pr-2 group-hover:text-red-400 transition-colors">
                    {match.awayTeam?.name ?? '?'}
                  </span>
                  <span className="text-gray-600 font-mono text-xl">
                    {match.result?.awayScore ?? 0}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}