'use client'

import { Clock, MapPin, Radio, Search, Users, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
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
  scheduledAt: Date | string | null
  status?: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED'
  homeTeam: TeamLite | null
  awayTeam: TeamLite | null
  pitch: PitchLite | null
  result: MatchResultLite | null
}

type SubmitResponse = {
  success: boolean
  error?: string
}

type SortMode = 'time' | 'pitch' | 'team' | 'status'

const SORT_OPTIONS: Array<{ value: SortMode; label: string; icon: typeof Clock }> = [
  { value: 'time', label: 'Heure', icon: Clock },
  { value: 'pitch', label: 'Terrain', icon: MapPin },
  { value: 'team', label: 'Equipe', icon: Users },
  { value: 'status', label: 'Live', icon: Radio },
]

function getMatchTime(match: TabletMatch) {
  if (!match.scheduledAt) return Number.POSITIVE_INFINITY
  const time = new Date(match.scheduledAt).getTime()
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time
}

function formatMatchTime(match: TabletMatch) {
  if (!match.scheduledAt) return '--:--'
  const time = new Date(match.scheduledAt)
  if (Number.isNaN(time.getTime())) return '--:--'
  return time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function normalize(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function statusPriority(match: TabletMatch) {
  if (match.status === 'LIVE') return 0
  if (match.status === 'SCHEDULED') return 1
  return 2
}

function getSearchText(match: TabletMatch) {
  return normalize(
    [
      match.homeTeam?.name,
      match.awayTeam?.name,
      match.pitch?.name,
      formatMatchTime(match),
      match.status === 'LIVE' ? 'live en cours' : 'programme prevu',
    ]
      .filter(Boolean)
      .join(' ')
  )
}

export default function TabletScoreForm({ initialMatches }: { initialMatches: TabletMatch[] }) {
  const router = useRouter()
  const [selectedMatch, setSelectedMatch] = useState<TabletMatch | null>(null)
  const [homeScore, setHomeScore] = useState<number>(0)
  const [awayScore, setAwayScore] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState('')
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<SortMode>('time')

  const visibleMatches = useMemo(() => {
    const normalizedQuery = normalize(query)

    return initialMatches
      .filter((match) => !normalizedQuery || getSearchText(match).includes(normalizedQuery))
      .sort((left, right) => {
        if (sortMode === 'pitch') {
          const byPitch = (left.pitch?.name ?? 'Terrain inconnu').localeCompare(right.pitch?.name ?? 'Terrain inconnu')
          if (byPitch !== 0) return byPitch
        }

        if (sortMode === 'team') {
          const leftName = left.homeTeam?.name ?? left.awayTeam?.name ?? ''
          const rightName = right.homeTeam?.name ?? right.awayTeam?.name ?? ''
          const byTeam = leftName.localeCompare(rightName)
          if (byTeam !== 0) return byTeam
        }

        if (sortMode === 'status') {
          const byStatus = statusPriority(left) - statusPriority(right)
          if (byStatus !== 0) return byStatus
        }

        return getMatchTime(left) - getMatchTime(right)
      })
  }, [initialMatches, query, sortMode])

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
      <div className="flex flex-col items-center max-w-4xl mx-auto p-4">
        <button
          onClick={() => setSelectedMatch(null)}
          className="self-start mb-8 min-h-12 px-4 text-gray-300 text-lg flex items-center gap-2 hover:text-white active:scale-95 transition"
          type="button"
        >
          Retour a la liste
        </button>

        <div className="w-full bg-gray-900 rounded-3xl p-5 sm:p-8 md:p-10 shadow-2xl border border-gray-800 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex flex-col items-center flex-1 w-full">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-blue-400 text-center min-h-16 flex items-center">
              {selectedMatch.homeTeam?.name ?? 'TBD'}
            </h2>

            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={homeScore}
              onChange={(event) => setHomeScore(Math.max(0, parseInt(event.target.value) || 0))}
              style={{ fontSize: '5rem' }}
              className="!w-32 !h-32 md:!w-40 md:!h-40 !bg-gray-800 !border-4 !border-blue-600 !rounded-3xl !text-white text-6xl font-mono text-center focus:outline-none focus:ring-4 focus:ring-blue-500/50 transition-all"
            />
            <p className="mt-4 text-gray-500 font-medium tracking-widest uppercase text-xs">Domicile</p>
          </div>

          <div className="flex items-center">
            <span className="text-4xl font-black text-gray-700 italic">VS</span>
          </div>

          <div className="flex flex-col items-center flex-1 w-full">
            <h2 className="text-xl sm:text-2xl font-bold mb-6 text-red-400 text-center min-h-16 flex items-center">
              {selectedMatch.awayTeam?.name ?? 'TBD'}
            </h2>
            <input
              type="number"
              inputMode="numeric"
              pattern="[0-9]*"
              value={awayScore}
              onChange={(event) => setAwayScore(Math.max(0, parseInt(event.target.value) || 0))}
              style={{ fontSize: '5rem' }}
              className="!w-32 !h-32 md:!w-40 md:!h-40 !bg-gray-800 !border-4 !border-red-600 !rounded-3xl !text-white text-6xl font-mono text-center focus:outline-none focus:ring-4 focus:ring-red-500/50 transition-all"
            />
            <p className="mt-4 text-gray-500 font-medium tracking-widest uppercase text-xs">Exterieur</p>
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
            <div
              className={`mt-6 text-lg text-center rounded-xl p-4 font-bold ${
                message.includes('Erreur')
                  ? 'bg-red-900/30 text-red-400 border border-red-800'
                  : 'bg-green-900/30 text-green-400 border border-green-800'
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-3 sm:p-4">
      <div className="sticky top-0 z-20 -mx-3 sm:mx-0 bg-gray-950/95 px-3 pb-4 pt-1 backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-200">
            Matchs
            <span className="ml-3 align-middle text-sm font-semibold text-gray-500">
              {visibleMatches.length}/{initialMatches.length}
            </span>
          </h2>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-500" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher equipe, terrain, heure..."
              className="!h-14 !w-full !rounded-2xl !border-gray-700 !bg-gray-900 !py-0 !pl-12 !pr-12 !text-base !text-white placeholder:!text-gray-500 focus:!border-blue-500"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="absolute right-2 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-800 hover:text-white active:scale-95"
                aria-label="Effacer la recherche"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            )}
          </label>

          <div className="grid grid-cols-4 gap-2 rounded-2xl bg-gray-900 p-1.5">
            {SORT_OPTIONS.map((option) => {
              const Icon = option.icon
              const isActive = sortMode === option.value

              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSortMode(option.value)}
                  className={`flex min-h-12 items-center justify-center gap-1.5 rounded-xl px-2 text-sm font-bold transition active:scale-95 sm:min-w-28 ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/40'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="hidden sm:inline">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {initialMatches.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
            <p className="text-gray-500 text-xl">Aucun match disponible pour le moment.</p>
          </div>
        ) : visibleMatches.length === 0 ? (
          <div className="col-span-full py-20 text-center bg-gray-900/50 rounded-3xl border border-dashed border-gray-800">
            <p className="text-gray-500 text-xl">Aucun match ne correspond a la recherche.</p>
          </div>
        ) : (
          visibleMatches.map((match) => (
            <button
              key={match.id}
              onClick={() => handleSelectMatch(match)}
              className="group min-h-40 bg-gray-900 border border-gray-800 hover:border-blue-500 rounded-2xl p-5 text-left transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.1)] active:scale-[0.98]"
              type="button"
            >
              <div className="mb-4 flex items-center justify-between gap-3 text-sm font-medium text-gray-400">
                <span className="inline-flex min-h-8 max-w-[65%] items-center gap-1.5 rounded-lg bg-gray-800 px-3">
                  <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{match.pitch?.name ?? 'Terrain inconnu'}</span>
                </span>
                <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-gray-800 px-3 font-mono">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                  {formatMatchTime(match)}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-lg sm:text-xl font-bold text-gray-200 truncate pr-2 group-hover:text-blue-400 transition-colors">
                    {match.homeTeam?.name ?? '?'}
                  </span>
                  <span className="text-gray-600 font-mono text-xl">
                    {match.result?.homeScore ?? 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-lg sm:text-xl font-bold text-gray-200 truncate pr-2 group-hover:text-red-400 transition-colors">
                    {match.awayTeam?.name ?? '?'}
                  </span>
                  <span className="text-gray-600 font-mono text-xl">
                    {match.result?.awayScore ?? 0}
                  </span>
                </div>
              </div>
              {match.status === 'LIVE' && (
                <div className="mt-4 inline-flex min-h-8 items-center rounded-full bg-green-500/10 px-3 text-xs font-black uppercase tracking-wider text-green-400">
                  Live
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
