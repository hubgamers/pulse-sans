'use client'

import { useState, useCallback, useMemo } from 'react'

type BracketMatch = {
  id: string
  phaseId: string
  roundNumber: number | null
  bracketPos: string | null
  homeTeamName: string
  awayTeamName: string
  homeScore: number | null
  awayScore: number | null
  status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED'
}

type TimeSlot = {
  id: string
  startTimeMs: number
  label: string
  selectedMatchIds: string[]
}

type PhaseData = {
  id: string
  name: string
}

type Props = {
  phases: PhaseData[]
  matches: BracketMatch[]
  currentConfig?: unknown
  onSave: (config: unknown) => Promise<void>
  isLoading?: boolean
}

// Helper to read interleaved config from phase config
function readInterleavedConfig(config: unknown): { timeSlots: TimeSlot[] } | null {
  if (!config || typeof config !== 'object') return null
  const raw = (config as { interleavedTimeSlots?: unknown }).interleavedTimeSlots
  if (!Array.isArray(raw)) return null

  const slots = raw
    .map((slot) => {
      if (!slot || typeof slot !== 'object') return null
      const s = slot as Record<string, unknown>
      return {
        id: typeof s.id === 'string' ? s.id : `slot-${Date.now()}`,
        startTimeMs: typeof s.startTimeMs === 'number' ? s.startTimeMs : 0,
        label: typeof s.label === 'string' ? s.label : '',
        selectedMatchIds: Array.isArray(s.selectedMatchIds) ? (s.selectedMatchIds as string[]) : [],
      }
    })
    .filter((s): s is TimeSlot => Boolean(s))

  return { timeSlots: slots }
}

// Group matches by phase
function groupMatchesByPhase(matches: BracketMatch[], phases: PhaseData[]): Map<string, BracketMatch[]> {
  const grouped = new Map<string, BracketMatch[]>()
  for (const phase of phases) {
    grouped.set(phase.id, matches.filter((m) => m.phaseId === phase.id))
  }
  return grouped
}

function formatTime(ms: number): string {
  const date = new Date(ms)
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

function getMatchLabel(match: BracketMatch): string {
  const homeTeam = match.homeTeamName || 'TBD'
  const awayTeam = match.awayTeamName || 'TBD'
  return `${homeTeam} vs ${awayTeam}`
}

export default function InterleavedTimeSlotManager({
  phases,
  matches,
  currentConfig,
  onSave,
  isLoading = false,
}: Props) {
  const existingConfig = useMemo(() => readInterleavedConfig(currentConfig), [currentConfig])
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(existingConfig?.timeSlots ?? [])
  const [newSlotTime, setNewSlotTime] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const matchesByPhase = useMemo(() => groupMatchesByPhase(matches, phases), [matches, phases])

  const unassignedMatches = useMemo(() => {
    const assignedIds = new Set(timeSlots.flatMap((s) => s.selectedMatchIds))
    return matches.filter((m) => !assignedIds.has(m.id))
  }, [matches, timeSlots])

  const handleAddTimeSlot = useCallback(() => {
    if (!newSlotTime) return
    const [hours, minutes] = newSlotTime.split(':').map(Number)
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return

    const date = new Date()
    date.setHours(hours, minutes, 0, 0)
    const slotId = `slot-${Date.now()}`

    setTimeSlots((prev) => [
      ...prev,
      {
        id: slotId,
        startTimeMs: date.getTime(),
        label: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
        selectedMatchIds: [],
      },
    ])
    setNewSlotTime('')
  }, [newSlotTime])

  const handleDeleteSlot = useCallback((slotId: string) => {
    setTimeSlots((prev) => prev.filter((s) => s.id !== slotId))
  }, [])

  const handleToggleMatch = useCallback(
    (slotId: string, matchId: string) => {
      setTimeSlots((prev) =>
        prev.map((slot) => {
          if (slot.id !== slotId) return slot
          const isSelected = slot.selectedMatchIds.includes(matchId)
          return {
            ...slot,
            selectedMatchIds: isSelected
              ? slot.selectedMatchIds.filter((id) => id !== matchId)
              : [...slot.selectedMatchIds, matchId],
          }
        })
      )
    },
    []
  )

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    try {
      const newConfig = {
        ...currentConfig,
        interleavedTimeSlots: timeSlots.map((slot) => ({
          id: slot.id,
          startTimeMs: slot.startTimeMs,
          label: slot.label,
          selectedMatchIds: slot.selectedMatchIds,
        })),
      }
      await onSave(newConfig)
    } finally {
      setIsSaving(false)
    }
  }, [currentConfig, timeSlots, onSave])

  const sortedSlots = [...timeSlots].sort((a, b) => a.startTimeMs - b.startTimeMs)

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="border-b border-slate-200 pb-3">
        <h3 className="text-sm font-bold text-slate-900">Configuration des tranches horaires (Mode Entrelacer)</h3>
        <p className="mt-1 text-xs text-slate-600">
          Definissez les horaires et selectionnez les matchs qui se joueront dans chaque tranche horaire.
        </p>
      </div>

      {/* Add New Time Slot */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nouvelle tranche horaire</label>
          <input
            type="time"
            value={newSlotTime}
            onChange={(e) => setNewSlotTime(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-sm focus:border-teal-400 focus:outline-none"
            disabled={isLoading || isSaving}
          />
        </div>
        <button
          onClick={handleAddTimeSlot}
          disabled={!newSlotTime || isLoading || isSaving}
          className="rounded bg-emerald-600 px-3 py-1 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          Ajouter
        </button>
      </div>

      {/* Time Slots List */}
      <div className="space-y-3">
        {sortedSlots.length === 0 ? (
          <div className="rounded border border-dashed border-slate-300 bg-slate-50 p-3 text-center text-xs text-slate-500">
            Aucune tranche horaire. Creez-en une pour commencer.
          </div>
        ) : (
          sortedSlots.map((slot) => {
            const slotMatches = matches.filter((m) => slot.selectedMatchIds.includes(m.id))
            return (
              <div key={slot.id} className="rounded border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded bg-teal-500" />
                    <span className="text-sm font-bold text-slate-900">{slot.label}</span>
                    <span className="text-xs text-slate-500">({slotMatches.length} match(s))</span>
                  </div>
                  <button
                    onClick={() => handleDeleteSlot(slot.id)}
                    disabled={isLoading || isSaving}
                    className="text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>

                {/* Match Selection for This Slot */}
                <div className="space-y-1.5">
                  {matches.length === 0 ? (
                    <p className="text-xs text-slate-500">Aucun match disponible</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto">
                      {phases.map((phase) => {
                        const phaseMatches = matchesByPhase.get(phase.id) ?? []
                        if (phaseMatches.length === 0) return null
                        return (
                          <div key={phase.id}>
                            <p className="text-[11px] font-semibold uppercase text-slate-600 mb-1">{phase.name}</p>
                            <div className="ml-2 space-y-1">
                              {phaseMatches.map((match) => {
                                const isSelected = slot.selectedMatchIds.includes(match.id)
                                return (
                                  <label
                                    key={match.id}
                                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-white/60"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => handleToggleMatch(slot.id, match.id)}
                                      disabled={isLoading || isSaving}
                                      className="h-3 w-3 accent-teal-600"
                                    />
                                    <span className={`text-xs ${isSelected ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                                      {getMatchLabel(match)}
                                    </span>
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Unassigned Matches Summary */}
      {unassignedMatches.length > 0 && (
        <div className="rounded border border-amber-200 bg-amber-50 p-2">
          <p className="text-xs font-semibold text-amber-900">
            {unassignedMatches.length} match(s) non assigné(s) à une tranche horaire
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
        <button
          onClick={handleSave}
          disabled={isLoading || isSaving}
          className="rounded bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {isSaving ? 'Enregistrement...' : 'Enregistrer la configuration'}
        </button>
      </div>
    </div>
  )
}
