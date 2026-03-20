'use client'

import { useActionState, useMemo, useState } from 'react'
import type { PhaseType } from '@prisma/client'
import { Plus, Trash2 } from 'lucide-react'
import { updateTournamentPhaseFlow } from '@/lib/actions/tournament-management.actions'
import {
  PHASE_TYPE_OPTIONS,
  QUALIFICATION_RULE_OPTIONS,
  type QualificationRule,
} from '@/lib/tournament/phase-flow'

type RouteConfig = {
  toPhaseKey?: string
  rule?: 'TOP' | 'BOTTOM' | 'RANGE'
  countPerGroup?: number
  startRank?: number
  endRank?: number
  label?: string
}

type InitialPhase = {
  id: string
  name: string
  type: string
  order: number
  config: unknown
}

type RouteUI = {
  id: string
  toPhaseKey: string
  rule: QualificationRule
  countPerGroup?: number
  startRank?: number
  endRank?: number
  label?: string
}

type PhaseUI = {
  id: string
  key: string
  name: string
  type: PhaseType
  order: number
  parallelGroup: string
  routes: RouteUI[]
}

type Props = {
  tournamentId: string
  tournamentSlug: string
  orgSlug: string
  phases: InitialPhase[]
}

type PhaseFlowState = {
  success?: boolean
  message: string
}

const initialState: PhaseFlowState = {
  success: false,
  message: '',
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

function readRoutes(config: unknown): RouteUI[] {
  if (!config || typeof config !== 'object') return []
  const raw = (config as { routes?: unknown }).routes
  if (!Array.isArray(raw)) return []
  return raw
    .filter((route) => route && typeof route === 'object')
    .map((route) => {
      const item = route as RouteConfig
      return {
        id: createId(),
        toPhaseKey: typeof item.toPhaseKey === 'string' ? item.toPhaseKey : '',
        rule: item.rule ?? 'TOP',
        countPerGroup: item.countPerGroup,
        startRank: item.startRank,
        endRank: item.endRank,
        label: item.label,
      }
    })
}

function readKey(config: unknown, phaseName: string, fallbackOrder: number) {
  if (config && typeof config === 'object') {
    const raw = (config as { key?: unknown }).key
    if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim()
  }
  return slugify(phaseName) || `phase-${fallbackOrder}`
}

function readParallelGroup(config: unknown) {
  if (!config || typeof config !== 'object') return ''
  const raw = (config as { parallelGroup?: unknown }).parallelGroup
  return typeof raw === 'string' ? raw.trim() : ''
}

function toPhaseType(value: string): PhaseType {
  if (value === 'GROUP') return 'GROUP'
  if (value === 'BRACKET_SINGLE') return 'BRACKET_SINGLE'
  if (value === 'BRACKET_DOUBLE') return 'BRACKET_DOUBLE'
  if (value === 'PLACEMENT_BRACKET') return 'PLACEMENT_BRACKET'
  if (value === 'ROUND_SWISS') return 'ROUND_SWISS'
  return 'CUSTOM'
}

export default function PhaseFlowEditor({ tournamentId, tournamentSlug, orgSlug, phases }: Props) {
  const [state, formAction, isPending] = useActionState(updateTournamentPhaseFlow, initialState)
  const [flow, setFlow] = useState<PhaseUI[]>(
    [...phases]
      .sort((a, b) => a.order - b.order)
      .map((phase, idx) => ({
        id: phase.id,
        key: readKey(phase.config, phase.name, idx + 1),
        name: phase.name,
        type: toPhaseType(phase.type),
        order: phase.order,
        parallelGroup: readParallelGroup(phase.config),
        routes: readRoutes(phase.config),
      }))
  )

  const phasesJson = useMemo(
    () =>
      JSON.stringify(
        flow.map((phase) => ({
          key: phase.key.trim(),
          name: phase.name.trim(),
          type: phase.type,
          order: Number(phase.order),
          config: phase.parallelGroup.trim() ? { parallelGroup: phase.parallelGroup.trim() } : undefined,
          routes: phase.routes.map((route) => ({
            toPhaseKey: route.toPhaseKey,
            rule: route.rule,
            countPerGroup: route.countPerGroup,
            startRank: route.startRank,
            endRank: route.endRank,
            label: route.label,
          })),
        }))
      ),
    [flow]
  )

  const addPhase = () => {
    const next = flow.length + 1
    setFlow((prev) => [
      ...prev,
      {
        id: createId(),
        key: `phase-${next}`,
        name: `Phase ${next}`,
        type: 'GROUP',
        order: next,
        parallelGroup: '',
        routes: [],
      },
    ])
  }

  const updatePhase = (phaseId: string, patch: Partial<PhaseUI>) => {
    setFlow((prev) => prev.map((phase) => (phase.id === phaseId ? { ...phase, ...patch } : phase)))
  }

  const removePhase = (phaseId: string) => {
    setFlow((prev) => {
      const removed = prev.find((phase) => phase.id === phaseId)
      if (!removed) return prev
      return prev
        .filter((phase) => phase.id !== phaseId)
        .map((phase) => ({
          ...phase,
          routes: phase.routes.filter((route) => route.toPhaseKey !== removed.key),
        }))
    })
  }

  const addRoute = (phaseId: string) => {
    setFlow((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase
        const fallbackTarget = prev.find((candidate) => candidate.id !== phaseId)?.key ?? ''
        return {
          ...phase,
          routes: [
            ...phase.routes,
            { id: createId(), toPhaseKey: fallbackTarget, rule: 'TOP', countPerGroup: 2 },
          ],
        }
      })
    )
  }

  const updateRoute = (phaseId: string, routeId: string, patch: Partial<RouteUI>) => {
    setFlow((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase
        return {
          ...phase,
          routes: phase.routes.map((route) => (route.id === routeId ? { ...route, ...patch } : route)),
        }
      })
    )
  }

  const removeRoute = (phaseId: string, routeId: string) => {
    setFlow((prev) =>
      prev.map((phase) =>
        phase.id === phaseId ? { ...phase, routes: phase.routes.filter((route) => route.id !== routeId) } : phase
      )
    )
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">Modifier la structure des phases</p>
          <p className="text-xs text-slate-500">
            Vous pouvez ajouter, retirer et reconfigurer les phases apres creation du tournoi.
          </p>
        </div>
        <button
          type="button"
          onClick={addPhase}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50"
        >
          <Plus size={12} /> Ajouter phase
        </button>
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="tournamentId" value={tournamentId} />
        <input type="hidden" name="orgSlug" value={orgSlug} />
        <input type="hidden" name="tournamentSlug" value={tournamentSlug} />
        <input type="hidden" name="phasesJson" value={phasesJson} />

        <div className="space-y-3">
          {flow.map((phase) => (
            <div key={phase.id} className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">{phase.name || 'Nouvelle phase'}</p>
                <button
                  type="button"
                  onClick={() => removePhase(phase.id)}
                  className="inline-flex items-center gap-1 text-[11px] text-red-300 hover:text-red-200"
                >
                  <Trash2 size={12} /> Supprimer
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-5">
                <input
                  value={phase.key}
                  onChange={(e) => updatePhase(phase.id, { key: slugify(e.target.value) })}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                  placeholder="Code"
                />
                <input
                  value={phase.name}
                  onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                  placeholder="Nom"
                />
                <select
                  value={phase.type}
                  onChange={(e) => updatePhase(phase.id, { type: e.target.value as PhaseType })}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                >
                  {PHASE_TYPE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={phase.order}
                  onChange={(e) => updatePhase(phase.id, { order: Number(e.target.value) || 1 })}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                  placeholder="Ordre"
                />
                <input
                  value={phase.parallelGroup}
                  onChange={(e) => updatePhase(phase.id, { parallelGroup: slugify(e.target.value) })}
                  className="rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                  placeholder="Groupe parallele"
                />
              </div>

              <div className="mt-3 space-y-2 rounded-md border border-slate-200 bg-slate-50 p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] uppercase tracking-wider text-slate-500">Regles sortantes</p>
                  <button
                    type="button"
                    onClick={() => addRoute(phase.id)}
                    className="rounded-md border border-slate-300 px-2 py-1 text-[10px] hover:bg-slate-50"
                  >
                    + Regle
                  </button>
                </div>

                {phase.routes.length === 0 && <p className="text-[11px] text-slate-500">Aucune regle.</p>}

                {phase.routes.map((route) => (
                  <div key={route.id} className="grid gap-2 md:grid-cols-12">
                    <select
                      value={route.toPhaseKey}
                      onChange={(e) => updateRoute(phase.id, route.id, { toPhaseKey: e.target.value })}
                      className="md:col-span-3 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-[11px]"
                    >
                      <option value="">Vers phase</option>
                      {flow
                        .filter((candidate) => candidate.id !== phase.id)
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.key}>
                            {candidate.name} ({candidate.key})
                          </option>
                        ))}
                    </select>
                    <select
                      value={route.rule}
                      onChange={(e) => updateRoute(phase.id, route.id, { rule: e.target.value as QualificationRule })}
                      className="md:col-span-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-[11px]"
                    >
                      {QUALIFICATION_RULE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min={1}
                      value={route.countPerGroup ?? ''}
                      onChange={(e) => updateRoute(phase.id, route.id, { countPerGroup: Number(e.target.value) || undefined })}
                      className="md:col-span-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-[11px]"
                      placeholder="N/poule"
                    />
                    <input
                      type="number"
                      min={1}
                      value={route.startRank ?? ''}
                      onChange={(e) => updateRoute(phase.id, route.id, { startRank: Number(e.target.value) || undefined })}
                      className="md:col-span-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-[11px]"
                      placeholder="Start"
                    />
                    <input
                      type="number"
                      min={1}
                      value={route.endRank ?? ''}
                      onChange={(e) => updateRoute(phase.id, route.id, { endRank: Number(e.target.value) || undefined })}
                      className="md:col-span-2 rounded-md border border-slate-300 bg-slate-50 px-2 py-1.5 text-[11px]"
                      placeholder="End"
                    />
                    <button
                      type="button"
                      onClick={() => removeRoute(phase.id, route.id)}
                      className="md:col-span-1 rounded-md border border-red-500/30 px-2 py-1.5 text-[11px] text-red-300 hover:bg-red-500/10"
                    >
                      X
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {state.message && (
          <p className={`text-xs ${state.success ? 'text-emerald-300' : 'text-red-300'}`}>{state.message}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg border border-teal-600/40 px-3 py-2 text-sm font-medium text-teal-700 hover:bg-teal-600/10 disabled:opacity-60"
        >
          {isPending ? 'Enregistrement...' : 'Enregistrer les phases'}
        </button>
      </form>
    </div>
  )
}
