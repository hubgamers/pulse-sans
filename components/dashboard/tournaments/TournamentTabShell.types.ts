export type TabId = 'overview' | 'phases' | 'registrations' | 'pools' | 'bracket' | 'planning' | 'planning-time' | 'matches'

export type RouteConfig = {
    toPhaseKey?: string
    toPhaseId?: string | null
    rule?: 'TOP' | 'BOTTOM' | 'RANGE'
    countPerGroup?: number
    startRank?: number
    endRank?: number
    label?: string
}

export type GroupPlacement = { teamId: string; groupIndex: number; slot: number }
export type GroupConfig = {
    count: number
    teamsPerGroup: number
    placements: GroupPlacement[]
    preferredPitchIdByGroup: Record<number, string>
}

export type GroupStandingRow = {
    teamId: string
    teamName: string
    groupIndex?: number
    played: number
    wins: number
    draws: number
    losses: number
    goalsFor: number
    goalsAgainst: number
    goalDiff: number
    points: number
}

export type InlineActionState = {
    success?: boolean
    message: string
}

export type ActionLogPayload = {
    maxDurationMinutes?: unknown
    teamBreakMinutes?: unknown
}

export type TimerLogPayload = {
    timerMinutes?: unknown
    startedAt?: unknown
    timerKind?: unknown
    launchedStatus?: unknown
    slotAt?: unknown
}

export type PlacementRankingMatch = {
    bracketPos: string | null
    roundNumber: number | null
    status: 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED'
    homeTeamId: string | null
    awayTeamId: string | null
    homeTeamName: string
    awayTeamName: string
    homeScore: number | null
    awayScore: number | null
}

export type PlacementRankingRow = {
    rank: number
    teamName: string
    teamId: string | null
    source: string
}

export type TournamentActionLog = {
    id: string
    actionType: string
    message: string
    actorName: string | null
    payload?: unknown
    createdAt: string
}

export type PhaseData = {
    id: string
    name: string
    type: string
    order: number
    isCompleted: boolean
    config: unknown
}

export type PitchData = {
    id: string
    name: string
    phase: { id: string; name: string } | null
}

export type RegistrationData = {
    id: string
    teamId: string
    seed: number | null
    isConfirmed: boolean
    team: { id: string; name: string; slug: string }
}

export type SerializedMatch = {
    id: string
    status: string
    phaseId: string
    homeTeamId: string | null
    awayTeamId: string | null
    roundNumber: number | null
    bracketPos: string | null
    scheduledAt: string | null
    homeTeam: { id: string; name: string } | null
    awayTeam: { id: string; name: string } | null
    pitch: { id: string; name: string }
    phase: { id: string; name: string }
    result: { homeScore: number; awayScore: number; notes: string | null } | null
}

export type TournamentData = {
    id: string
    name: string
    slug: string
    description: string | null
    bannerUrl: string | null
    status: string
    isPublic: boolean
    maxTeams: number | null
    game: { name: string }
    phases: PhaseData[]
    pitches: PitchData[]
    registrations: RegistrationData[]
    actionLogs: TournamentActionLog[]
    _count: { registrations: number }
}
