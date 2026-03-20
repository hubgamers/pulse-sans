"use client"

import { useActionState, useMemo, useState, type ChangeEvent } from 'react'
import type { Game, PhaseType, TournamentStatus } from '@prisma/client'
import { createTournament, type TournamentFormState } from '@/lib/actions/tournament.actions'
import {
  PHASE_TYPE_OPTIONS,
  QUALIFICATION_RULE_OPTIONS,
  type PhaseRouteDraft,
  type QualificationRule,
} from '@/lib/tournament/phase-flow'
import { CalendarDays, CheckCircle2, Eye, GitBranch, Link as LinkIcon, Plus, Trash2, Trophy, Users } from 'lucide-react'

const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')

const statusOptions: { value: TournamentStatus; label: string }[] = [
  { value: 'DRAFT', label: 'Brouillon' },
  { value: 'REGISTRATION', label: 'Inscriptions' },
  { value: 'ONGOING', label: 'En cours' },
]

type RouteUI = PhaseRouteDraft & { id: string }
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
  organizationId: string
  orgSlug: string
  games: Pick<Game, 'id' | 'name'>[]
}

const initialState: TournamentFormState = {
  message: null,
  errors: {},
}

const createId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`

const createRoute = (toPhaseKey = ''): RouteUI => ({
  id: createId(),
  toPhaseKey,
  rule: 'TOP',
  countPerGroup: 2,
})

const createPhase = (index: number): PhaseUI => ({
  id: createId(),
  key: `phase-${index}`,
  name: `Phase ${index}`,
  type: 'GROUP',
  order: index,
  parallelGroup: '',
  routes: [],
})

const FieldError = ({ error }: { error?: string[] }) => {
  if (!error || error.length === 0) return null
  return <p className="mt-1 text-xs text-red-400">{error[0]}</p>
}

export default function TournamentCreateForm({ organizationId, orgSlug, games }: Props) {
  const [state, formAction, isPending] = useActionState(createTournament, initialState)
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [phases, setPhases] = useState<PhaseUI[]>([
    {
      id: createId(),
      key: 'poule-a',
      name: 'Poule A',
      type: 'GROUP',
      order: 1,
      parallelGroup: '',
      routes: [createRoute('bracket-a')],
    },
    {
      id: createId(),
      key: 'bracket-a',
      name: 'Bracket A',
      type: 'BRACKET_SINGLE',
      order: 2,
      parallelGroup: '',
      routes: [],
    },
  ])

  const phaseJson = useMemo(
    () =>
      JSON.stringify(
        phases.map((phase) => ({
          key: phase.key.trim(),
          name: phase.name.trim(),
          type: phase.type,
          order: Number(phase.order),
          config: phase.parallelGroup.trim()
            ? { parallelGroup: phase.parallelGroup.trim() }
            : undefined,
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
    [phases]
  )

  const onNameChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setName(value)
    if (!slugEdited) {
      setSlug(slugify(value))
    }
  }

  const onSlugChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSlug(e.target.value)
    setSlugEdited(true)
  }

  const addPhase = () => {
    setPhases((prev) => [...prev, createPhase(prev.length + 1)])
  }

  const updatePhase = (phaseId: string, patch: Partial<PhaseUI>) => {
    setPhases((prev) => prev.map((phase) => (phase.id === phaseId ? { ...phase, ...patch } : phase)))
  }

  const removePhase = (phaseId: string) => {
    setPhases((prev) => {
      const phaseToRemove = prev.find((phase) => phase.id === phaseId)
      if (!phaseToRemove) return prev

      return prev
        .filter((phase) => phase.id !== phaseId)
        .map((phase) => ({
          ...phase,
          routes: phase.routes.filter((route) => route.toPhaseKey !== phaseToRemove.key),
        }))
    })
  }

  const addRoute = (phaseId: string) => {
    setPhases((prev) =>
      prev.map((phase) => {
        if (phase.id !== phaseId) return phase
        const fallbackTarget = prev.find((p) => p.id !== phaseId)?.key ?? ''
        return { ...phase, routes: [...phase.routes, createRoute(fallbackTarget)] }
      })
    )
  }

  const updateRoute = (phaseId: string, routeId: string, patch: Partial<RouteUI>) => {
    setPhases((prev) =>
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
    setPhases((prev) =>
      prev.map((phase) =>
        phase.id === phaseId ? { ...phase, routes: phase.routes.filter((route) => route.id !== routeId) } : phase
      )
    )
  }

  const applyPresetSimpleBracket = () => {
    setPhases([
      {
        id: createId(),
        key: 'bracket',
        name: 'Bracket principal',
        type: 'BRACKET_SINGLE',
        order: 1,
        parallelGroup: '',
        routes: [],
      },
    ])
  }

  const applyPresetGroupToBracket = () => {
    setPhases([
      {
        id: createId(),
        key: 'poules',
        name: 'Phase de poules',
        type: 'GROUP',
        order: 1,
        parallelGroup: '',
        routes: [createRoute('bracket-final')],
      },
      {
        id: createId(),
        key: 'bracket-final',
        name: 'Bracket final',
        type: 'BRACKET_SINGLE',
        order: 2,
        parallelGroup: '',
        routes: [],
      },
    ])
  }

  const canContinueStep1 = name.trim().length >= 3 && slug.trim().length >= 3
  const canContinueStep2 = games.length > 0

  return (
    <div className="space-y-6 text-slate-900">
      <div>
        <p className="text-xs uppercase tracking-widest text-slate-500">/{orgSlug}</p>
        <h1 className="text-2xl md:text-3xl font-black">Nouveau tournoi</h1>
        <p className="mt-2 text-sm text-slate-500">
          Assistant de creation en 4 etapes pour configurer le tournoi sans vous perdre.
        </p>
      </div>

      <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:grid-cols-4">
        {[
          { step: 1, label: 'Identite' },
          { step: 2, label: 'Reglages' },
          { step: 3, label: 'Phases' },
          { step: 4, label: 'Validation' },
        ].map((item) => {
          const isActive = currentStep === item.step
          const isDone = currentStep > item.step
          return (
            <button
              key={item.step}
              type="button"
              onClick={() => setCurrentStep(item.step as 1 | 2 | 3 | 4)}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition ${
                isActive
                  ? 'border-teal-600 bg-teal-50 text-teal-700'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
              }`}
            >
              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${isDone ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                {isDone ? <CheckCircle2 size={13} /> : item.step}
              </span>
              <span className="text-xs font-semibold uppercase tracking-wider">{item.label}</span>
            </button>
          )
        })}
      </div>

      <form action={formAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-5 md:p-7">
        <input type="hidden" name="organizationId" value={organizationId} />
        <input type="hidden" name="phasesJson" value={phaseJson} />

        <section className={currentStep === 1 ? 'space-y-6' : 'hidden'}>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <Trophy size={14} /> Nom du tournoi
              </label>
              <input
                name="name"
                value={name}
                onChange={onNameChange}
                placeholder="Spring Clash 2026"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
                required
              />
              <FieldError error={state.errors?.name} />
            </div>

            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <LinkIcon size={14} /> Slug
              </label>
              <input
                name="slug"
                value={slug}
                onChange={onSlugChange}
                placeholder="spring-clash-2026"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
                required
              />
              <p className="mt-1 text-xs text-slate-500">URL: /dashboard/org/{orgSlug}/tournaments/{slug || '...'}</p>
              <FieldError error={state.errors?.slug} />
            </div>
          </div>

          <div>
            <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
              Description
            </label>
            <textarea
              name="description"
              rows={3}
              placeholder="Theme, regles, format BO3/BO5..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
            />
            <FieldError error={state.errors?.description} />
          </div>
        </section>

        <section className={currentStep === 2 ? 'space-y-6' : 'hidden'}>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Jeu
              </label>
              <select
                name="gameId"
                defaultValue={games[0]?.id ?? ''}
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
                required
              >
                {games.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.name}
                  </option>
                ))}
              </select>
              <FieldError error={state.errors?.gameId} />
            </div>

            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                Statut initial
              </label>
              <select
                name="status"
                defaultValue="DRAFT"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <FieldError error={state.errors?.status} />
            </div>

            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <Users size={14} /> Capacite max
              </label>
              <input
                name="maxTeams"
                type="number"
                min={2}
                max={512}
                placeholder="16"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
              />
              <FieldError error={state.errors?.maxTeams} />
            </div>

            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <Eye size={14} /> Visibilite
              </label>
              <label className="flex h-[46px] items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-4 text-sm">
                <input name="isPublic" type="checkbox" defaultChecked className="h-4 w-4 accent-teal-600" />
                Public
              </label>
              <FieldError error={state.errors?.isPublic} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} /> Debut
              </label>
              <input
                name="startDate"
                type="date"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
              />
              <FieldError error={state.errors?.startDate} />
            </div>

            <div>
              <label className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <CalendarDays size={14} /> Fin
              </label>
              <input
                name="endDate"
                type="date"
                className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-sm focus:border-teal-600 focus:outline-none"
              />
              <FieldError error={state.errors?.endDate} />
            </div>
          </div>
        </section>

        <section className={currentStep === 3 ? 'space-y-6' : 'hidden'}>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 md:p-5 space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-slate-500">
                <GitBranch size={14} /> Constructeur de phases
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Commencez par un modele simple, puis adaptez seulement si necessaire.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Pour des phases simultanees (ex: Bracket A et Bracket B), utilisez le meme ordre et le meme groupe parallele.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={applyPresetGroupToBracket}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
              >
                Modele poules + bracket
              </button>
              <button
                type="button"
                onClick={applyPresetSimpleBracket}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
              >
                Modele bracket direct
              </button>
              <button
                type="button"
                onClick={addPhase}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
              >
                <Plus size={14} /> Ajouter phase
              </button>
            </div>
          </div>

          <FieldError error={state.errors?.phasesJson} />

          <div className="space-y-4">
            {phases.map((phase) => (
              <div key={phase.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-sm font-bold">{phase.name || 'Nouvelle phase'}</h3>
                  <button
                    type="button"
                    onClick={() => removePhase(phase.id)}
                    className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-500"
                  >
                    <Trash2 size={13} /> Supprimer
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-5">
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Code phase</label>
                    <input
                      value={phase.key}
                      onChange={(e) => updatePhase(phase.id, { key: slugify(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                      placeholder="poule-a"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Nom</label>
                    <input
                      value={phase.name}
                      onChange={(e) => updatePhase(phase.id, { name: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                      placeholder="Poule A"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Type</label>
                    <select
                      value={phase.type}
                      onChange={(e) => updatePhase(phase.id, { type: e.target.value as PhaseType })}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                    >
                      {PHASE_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Ordre</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={phase.order}
                      onChange={(e) => updatePhase(phase.id, { order: Number(e.target.value) || 1 })}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] uppercase tracking-wider text-slate-500">Groupe parallele</label>
                    <input
                      value={phase.parallelGroup}
                      onChange={(e) => updatePhase(phase.id, { parallelGroup: slugify(e.target.value) })}
                      className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm"
                      placeholder="bracket-ab"
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Regles de qualification sortantes</p>
                    <button
                      type="button"
                      onClick={() => addRoute(phase.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-[11px] font-semibold hover:bg-slate-50"
                    >
                      <Plus size={12} /> Ajouter regle
                    </button>
                  </div>

                  {phase.routes.length === 0 && <p className="text-xs text-slate-500">Aucune regle pour cette phase.</p>}

                  {phase.routes.map((route) => (
                    <div key={route.id} className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 md:grid-cols-12">
                      <div className="md:col-span-3">
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Vers phase</label>
                        <select
                          value={route.toPhaseKey}
                          onChange={(e) => updateRoute(phase.id, route.id, { toPhaseKey: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                        >
                          <option value="">Choisir</option>
                          {phases
                            .filter((candidate) => candidate.id !== phase.id)
                            .map((candidate) => (
                              <option key={candidate.id} value={candidate.key}>
                                {candidate.name} ({candidate.key})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Regle</label>
                        <select
                          value={route.rule}
                          onChange={(e) => updateRoute(phase.id, route.id, { rule: e.target.value as QualificationRule })}
                          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                        >
                          {QUALIFICATION_RULE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {(route.rule === 'TOP' || route.rule === 'BOTTOM') && (
                        <div className="md:col-span-2">
                          <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">N / poule</label>
                          <input
                            type="number"
                            min={1}
                            value={route.countPerGroup ?? 1}
                            onChange={(e) => updateRoute(phase.id, route.id, { countPerGroup: Number(e.target.value) || 1 })}
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                          />
                        </div>
                      )}

                      {route.rule === 'RANGE' && (
                        <>
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Start</label>
                            <input
                              type="number"
                              min={1}
                              value={route.startRank ?? 1}
                              onChange={(e) => updateRoute(phase.id, route.id, { startRank: Number(e.target.value) || 1 })}
                              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">End</label>
                            <input
                              type="number"
                              min={1}
                              value={route.endRank ?? 2}
                              onChange={(e) => updateRoute(phase.id, route.id, { endRank: Number(e.target.value) || 2 })}
                              className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                            />
                          </div>
                        </>
                      )}

                      <div className="md:col-span-2">
                        <label className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">Label</label>
                        <input
                          value={route.label ?? ''}
                          onChange={(e) => updateRoute(phase.id, route.id, { label: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-2 text-xs"
                          placeholder="Ex: Winners"
                        />
                      </div>

                      <div className="md:col-span-1 md:flex md:items-end">
                        <button
                          type="button"
                          onClick={() => removeRoute(phase.id, route.id)}
                          className="w-full rounded-lg border border-red-300 px-2 py-2 text-[11px] text-red-600 hover:bg-red-50"
                        >
                          X
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        </section>

        <section className={currentStep === 4 ? 'space-y-4' : 'hidden'}>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Recapitulatif</p>
            <ul className="mt-3 space-y-1 text-sm text-slate-700">
              <li>Nom: {name || 'Non renseigne'}</li>
              <li>Slug: {slug || 'Non renseigne'}</li>
              <li>Phases configurees: {phases.length}</li>
              <li>Jeu, dates et visibilite: configures a l'etape 2</li>
            </ul>
          </div>
          <p className="text-xs text-slate-500">
            Vous pourrez modifier ces parametres ensuite depuis l'ecran de gestion du tournoi.
          </p>
        </section>

        {state.message && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${state.errors && Object.keys(state.errors).length > 0
            ? 'border-red-300 bg-red-50 text-red-700'
            : 'border-emerald-300 bg-emerald-50 text-emerald-700'
            }`}>
            {state.message}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <button
            type="button"
            onClick={() => setCurrentStep((s) => Math.max(1, s - 1) as 1 | 2 | 3 | 4)}
            disabled={currentStep === 1}
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Etape precedente
          </button>

          {currentStep < 4 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => Math.min(4, s + 1) as 1 | 2 | 3 | 4)}
              disabled={(currentStep === 1 && !canContinueStep1) || (currentStep === 2 && !canContinueStep2)}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              Etape suivante
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending || games.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-600 transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? 'Creation en cours...' : 'Creer le tournoi'}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
