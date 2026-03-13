import { PhaseType } from '@prisma/client'
import { z } from 'zod'

export const PHASE_TYPE_OPTIONS: { value: PhaseType; label: string }[] = [
  { value: PhaseType.GROUP, label: 'Poule / Groupe' },
  { value: PhaseType.BRACKET_SINGLE, label: 'Bracket simple' },
  { value: PhaseType.BRACKET_DOUBLE, label: 'Bracket double' },
  { value: PhaseType.PLACEMENT_BRACKET, label: 'Bracket de placement' },
  { value: PhaseType.ROUND_SWISS, label: 'Ronde suisse' },
  { value: PhaseType.CUSTOM, label: 'Phase personnalisee' },
]

export const QUALIFICATION_RULE_OPTIONS = [
  { value: 'TOP', label: 'Top N' },
  { value: 'BOTTOM', label: 'Bottom N' },
  { value: 'RANGE', label: 'Plage [start-end]' },
] as const

export type QualificationRule = (typeof QUALIFICATION_RULE_OPTIONS)[number]['value']

export type PhaseRouteDraft = {
  toPhaseKey: string
  rule: QualificationRule
  countPerGroup?: number
  startRank?: number
  endRank?: number
  label?: string
}

export type PhaseDraft = {
  key: string
  name: string
  type: PhaseType
  order: number
  config?: Record<string, unknown>
  routes: PhaseRouteDraft[]
}

const PhaseTypeEnum = z.enum(['GROUP', 'BRACKET_SINGLE', 'BRACKET_DOUBLE', 'PLACEMENT_BRACKET', 'ROUND_SWISS', 'CUSTOM'])
const RuleEnum = z.enum(['TOP', 'BOTTOM', 'RANGE'])

const PositiveInt = z.number().int().positive()

export const PhaseRouteSchema = z
  .object({
    toPhaseKey: z.string().min(1, 'La phase cible est requise.'),
    rule: RuleEnum,
    countPerGroup: PositiveInt.optional(),
    startRank: PositiveInt.optional(),
    endRank: PositiveInt.optional(),
    label: z.string().max(80).optional(),
  })
  .superRefine((route, ctx) => {
    if ((route.rule === 'TOP' || route.rule === 'BOTTOM') && !route.countPerGroup) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'countPerGroup est obligatoire pour TOP/BOTTOM.',
      })
    }

    if (route.rule === 'RANGE') {
      if (!route.startRank || !route.endRank) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startRank et endRank sont obligatoires pour RANGE.',
        })
      } else if (route.startRank > route.endRank) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startRank doit etre <= endRank.',
        })
      }
    }
  })

export const PhaseDraftSchema = z.object({
  key: z
    .string()
    .min(2, 'Le code phase est requis.')
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Le code phase doit contenir uniquement a-z, 0-9 et -.'),
  name: z.string().min(2, 'Le nom de phase est requis.').max(100),
  type: PhaseTypeEnum,
  order: z.number().int().min(1).max(99),
  config: z.record(z.string(), z.unknown()).optional(),
  routes: z.array(PhaseRouteSchema),
})

export const PhaseFlowSchema = z.array(PhaseDraftSchema).min(1, 'Ajoutez au moins une phase.')

export function validatePhaseFlow(raw: unknown) {
  const parsed = PhaseFlowSchema.safeParse(raw)

  if (!parsed.success) return parsed

  const phases = parsed.data
  const keySet = new Set<string>()
  const orderSet = new Set<number>()

  for (const phase of phases) {
    if (keySet.has(phase.key)) {
      return {
        success: false as const,
        error: {
          message: `Code phase duplique: ${phase.key}`,
        },
      }
    }
    keySet.add(phase.key)

    if (orderSet.has(phase.order)) {
      return {
        success: false as const,
        error: {
          message: `Ordre de phase duplique: ${phase.order}`,
        },
      }
    }
    orderSet.add(phase.order)
  }

  for (const phase of phases) {
    for (const route of phase.routes) {
      if (!keySet.has(route.toPhaseKey)) {
        return {
          success: false as const,
          error: {
            message: `La phase cible ${route.toPhaseKey} n'existe pas.`,
          },
        }
      }
      if (route.toPhaseKey === phase.key) {
        return {
          success: false as const,
          error: {
            message: `La phase ${phase.key} ne peut pas se pointer elle-meme.`,
          },
        }
      }
    }
  }

  return { success: true as const, data: phases }
}

export type TournamentPhaseFlow = PhaseDraft[]
