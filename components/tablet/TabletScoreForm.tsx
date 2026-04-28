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
  const [homeScore, setHomeScore] = useState(0)
  const [awayScore, setAwayScore] = useState(0)
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
        setMessage('Score mis a jour')
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
      <div className="flex flex-col items-center">
        <button
          onClick={() => setSelectedMatch(null)}
          className="self-start mb-8 text-gray-400 text-xl flex items-center gap-2"
          type="button"
        >
          Retour
        </button>

        <div className="w-full bg-gray-900 rounded-2xl p-8 shadow-xl border border-gray-800 flex justify-between items-center text-center">
          <div className="flex flex-col items-center flex-1">
            <h2 className="text-3xl font-bold truncate max-w-50 mb-6">{selectedMatch.homeTeam?.name ?? 'TBD'}</h2>
            <button
              onClick={() => setHomeScore((score) => score + 1)}
              className="w-24 h-24 bg-blue-600 rounded-xl text-5xl font-black mb-4 active:bg-blue-500"
              type="button"
            >
              +
            </button>
            <span className="text-7xl font-mono mb-4 min-w-25">{homeScore}</span>
            <button
              onClick={() => setHomeScore((score) => Math.max(0, score - 1))}
              className="w-24 h-16 bg-gray-700 rounded-xl text-4xl mb-4 active:bg-gray-600"
              type="button"
            >
              -
            </button>
          </div>

          <div className="px-8 flex flex-col items-center">
            <span className="text-5xl font-bold text-gray-600">VS</span>
          </div>

          <div className="flex flex-col items-center flex-1">
            <h2 className="text-3xl font-bold truncate max-w-50 mb-6">{selectedMatch.awayTeam?.name ?? 'TBD'}</h2>
            <button
              onClick={() => setAwayScore((score) => score + 1)}
              className="w-24 h-24 bg-red-600 rounded-xl text-5xl font-black mb-4 active:bg-red-500"
              type="button"
            >
              +
            </button>
            <span className="text-7xl font-mono mb-4 min-w-25">{awayScore}</span>
            <button
              onClick={() => setAwayScore((score) => Math.max(0, score - 1))}
              className="w-24 h-16 bg-gray-700 rounded-xl text-4xl mb-4 active:bg-gray-600"
              type="button"
            >
              -
            </button>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center">
          <button
            disabled={isSubmitting}
            onClick={handleSubmit}
            className="px-16 py-6 bg-green-500 hover:bg-green-400 active:bg-green-600 text-3xl font-bold rounded-2xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            type="button"
          >
            {isSubmitting ? 'Enregistrement...' : 'Valider ce score'}
          </button>

          {message ? (
            <div className="mt-6 text-xl text-center rounded p-4 font-bold bg-gray-800">{message}</div>
          ) : null}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-300">Choisissez votre match</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {initialMatches.length === 0 ? (
          <p className="text-center col-span-3 text-gray-500">Aucun match en attente.</p>
        ) : (
          initialMatches.map((match) => (
            <button
              key={match.id}
              onClick={() => handleSelectMatch(match)}
              className="bg-gray-800 border-2 border-transparent hover:border-blue-500 rounded-xl p-6 text-left transition transform hover:scale-[1.02]"
              type="button"
            >
              <div className="text-sm text-gray-400 flex justify-between mb-2">
                <span>{match.pitch?.name ?? 'Terrain ?'}</span>
                <span>
                  {match.scheduledAt
                    ? new Date(match.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : ''}
                </span>
              </div>
              <div className="flex justify-between items-center text-xl font-bold">
                <span className="truncate">{match.homeTeam?.name ?? '?'}</span>
                <span className="text-gray-500 mx-2 text-sm text-center min-w-8">vs</span>
                <span className="truncate">{match.awayTeam?.name ?? '?'}</span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
