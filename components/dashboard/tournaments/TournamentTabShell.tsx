'use client'

import { useState, useEffect, useActionState, type ChangeEvent } from 'react'
import {
    configurePlacementBracketLabels,
    configurePlacementBracketRankingSegments,
    bulkCreateTournamentPitches,
    bulkDeleteTournamentPitches,
    duplicateTournamentForOrganization,
    generateLinkedBracketMatches,
    resetTournamentForReconfiguration,
    retryTournamentPropagation,
    startTournamentBreakTimer,
    startTournamentMatchesByScheduleSlot,
    updateTournamentOverlayBackground,
} from '@/lib/actions/tournament-management.actions'
import { createClient } from '@/lib/supabase/client'
import type {
    TabId,
    InlineActionState,
    SerializedMatch,
    TournamentData,
} from './TournamentTabShell.types'
import type { TournamentStatus } from '@prisma/client'
import {
    readPlanningDefaultsFromLogs,
    isTournamentStatus,
    STATUS_META,
} from './TournamentTabShell.utils'
import {
    useTournamentLiveAdmin,
    useTournamentPhaseCollections,
    useTournamentQualifiers,
    useTournamentScheduling,
    useTournamentStandingsOverlay,
} from './TournamentTabShell.hooks'
import TournamentTabShellHeader from './TournamentTabShellHeader'
import TournamentTabShellAdminPanel from './TournamentTabShellAdminPanel'
import TournamentStandingsOverlay from './TournamentStandingsOverlay'
import TournamentOverviewTab from './TournamentOverviewTab'
import TournamentPhasesTab from './TournamentPhasesTab'
import TournamentRegistrationsTab from './TournamentRegistrationsTab'
import TournamentPoolsTab from './TournamentPoolsTab'
import TournamentBracketTab from './TournamentBracketTab'
import TournamentPlanningByPitchTab from './TournamentPlanningByPitchTab'
import TournamentPlanningTimeTab from './TournamentPlanningTimeTab'
import TournamentMatchesTab from './TournamentMatchesTab'

// ─── Types ────────────────────────────────────────────────────────────────────

const INITIAL_INLINE_ACTION_STATE: InlineActionState = {
    success: false,
    message: '',
}

type Props = {
    orgSlug: string
    tournament: TournamentData
    availableTeams: Array<{ id: string; name: string; slug: string }>
    matches: SerializedMatch[]
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TournamentTabShell({ orgSlug, tournament, availableTeams, matches }: Props) {
    const planningDefaults = readPlanningDefaultsFromLogs(tournament.actionLogs)
    const [nowMs, setNowMs] = useState(() => Date.now())
    const [isAdminPanelCollapsed, setIsAdminPanelCollapsed] = useState(false)
    const [activeTab, setActiveTab] = useState<TabId>('overview')
    const [activeBracketPhaseId, setActiveBracketPhaseId] = useState(() =>
        tournament.phases.find((phase) => ['BRACKET_SINGLE', 'BRACKET_DOUBLE', 'PLACEMENT_BRACKET', 'CUSTOM'].includes(phase.type))?.id ?? ''
    )
    const [phasesStep, setPhasesStep] = useState<1 | 2 | 3>(1)
    const [matchesStep, setMatchesStep] = useState<1 | 2 | 3 | 4>(1)
    const [matchCreateMode, setMatchCreateMode] = useState<'single' | 'bulk'>('single')
    const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([])
    const [standingsOverlay, setStandingsOverlay] = useState<{ phaseId: string; mode: 'groups' | 'global' } | null>(null)
    const [slotTimerMinutes, setSlotTimerMinutes] = useState(planningDefaults.matchMinutes)
    const [slotBreakMinutes, setSlotBreakMinutes] = useState(planningDefaults.breakMinutes)
    const [overlayBgUrl, setOverlayBgUrl] = useState(tournament.bannerUrl ?? '')
    const [overlayBgPreview, setOverlayBgPreview] = useState(tournament.bannerUrl ?? '')
    const [overlayBgUploading, setOverlayBgUploading] = useState(false)
    const [overlayBgUploadError, setOverlayBgUploadError] = useState('')
    const [bulkPitchCreateState, bulkPitchCreateAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => bulkCreateTournamentPitches(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [bulkPitchDeleteState, bulkPitchDeleteAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => bulkDeleteTournamentPitches(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [resetTournamentState, resetTournamentAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => resetTournamentForReconfiguration(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [duplicateTournamentState, duplicateTournamentAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => duplicateTournamentForOrganization(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [slotLaunchState, slotLaunchAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => startTournamentMatchesByScheduleSlot(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [breakTimerState, breakTimerAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => startTournamentBreakTimer(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [placementLabelsState, placementLabelsAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => configurePlacementBracketLabels(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [placementSegmentsState, placementSegmentsAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => configurePlacementBracketRankingSegments(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [customBracketGenerationState, customBracketGenerationAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => generateLinkedBracketMatches(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [overlayBackgroundState, overlayBackgroundAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => updateTournamentOverlayBackground(formData),
        INITIAL_INLINE_ACTION_STATE
    )
    const [retryPropagationState, retryPropagationAction] = useActionState(
        async (_: InlineActionState, formData: FormData) => retryTournamentPropagation(formData),
        INITIAL_INLINE_ACTION_STATE
    )

    const onOverlayBackgroundChange = async (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        const allowedTypes = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']
        if (!allowedTypes.includes(file.type)) {
            setOverlayBgUploadError('Format non supporte. Utilisez PNG, JPEG, WEBP, SVG ou GIF.')
            return
        }
        if (file.size > 8 * 1024 * 1024) {
            setOverlayBgUploadError('Le fichier doit faire moins de 8 Mo.')
            return
        }

        setOverlayBgUploadError('')
        setOverlayBgUploading(true)
        setOverlayBgPreview(URL.createObjectURL(file))

        const supabase = createClient()
        const ext = file.name.split('.').pop() ?? 'png'
        const path = `tournaments/${tournament.id}/overlay-bg-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('logos').upload(path, file, { upsert: true })

        if (error) {
            if (error.message.toLowerCase().includes('row-level security')) {
                setOverlayBgUploadError('Upload bloque par la policy Supabase Storage (RLS). Verifiez le bucket logos.')
            } else {
                setOverlayBgUploadError('Erreur lors de l upload : ' + error.message)
            }
            setOverlayBgUploading(false)
            return
        }

        const { data } = supabase.storage.from('logos').getPublicUrl(path)
        setOverlayBgUrl(data.publicUrl)
        setOverlayBgPreview(data.publicUrl)
        setOverlayBgUploading(false)
    }

    useEffect(() => {
        const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
        return () => window.clearInterval(interval)
    }, [])

    const {
        bracketPhases,
        groupPhases,
        bracketParallelGroups,
        bracketSubTabKeys,
        pitchGroups,
        matchesByPhase,
        teamNameById,
        getMatchGroupLabel,
    } = useTournamentPhaseCollections(tournament, matches)
    const activeBracketTabId = bracketSubTabKeys.length === 0
        ? ''
        : bracketSubTabKeys.includes(activeBracketPhaseId)
            ? activeBracketPhaseId
            : bracketSubTabKeys[0]

    const {
        seededTeamsByPhase,
        incomingQualifiersByPhase,
        pendingQualifierPhases,
        expectedIncomingQualifierCountByPhase,
    } = useTournamentQualifiers(tournament, matches, teamNameById)

    const { scheduleByPitch, scheduleByTime } = useTournamentScheduling(tournament, matches)

    const {
        standingsOverlayPhase,
        standingsOverlayGroupConfig,
        standingsOverlayByGroup,
        standingsOverlayGlobal,
    } = useTournamentStandingsOverlay(standingsOverlay, tournament, matches, teamNameById)

    const tabs = [
        { id: 'overview' as TabId, label: "Vue d'ensemble" },
        { id: 'phases' as TabId, label: 'Configuration', badge: tournament.phases.length },
        { id: 'registrations' as TabId, label: 'Équipes & Pistes', badge: tournament.registrations.length },
        ...(groupPhases.length > 0 ? [{ id: 'pools' as TabId, label: 'Poules', badge: groupPhases.length }] : []),
        ...(bracketPhases.length > 0 ? [{ id: 'bracket' as TabId, label: 'Brackets', badge: bracketPhases.length }] : []),
        { id: 'planning' as TabId, label: 'Planning pistes', badge: matches.filter((m) => Boolean(m.scheduledAt)).length },
        { id: 'planning-time' as TabId, label: 'Planning horaire', badge: scheduleByTime.slots.length },
        { id: 'matches' as TabId, label: 'Matchs', badge: matches.length },
    ]

    const statusMeta = isTournamentStatus(tournament.status)
        ? STATUS_META[tournament.status as TournamentStatus]
        : { label: tournament.status, cls: 'bg-slate-700 text-slate-700' }

    const inputCls = 'rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-teal-600'
    const btnPrimary = 'rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-600 disabled:opacity-50 transition-colors'
    const btnGhost = 'rounded-lg border border-teal-600/40 px-3 py-2 text-sm text-teal-700 hover:bg-teal-600/10 transition-colors'
    const btnDanger = 'rounded-lg border border-red-500/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 transition-colors'

    const {
        bracketTimerContext,
        adminTimer,
        liveWithoutScores,
        finishedWithoutScores,
        overdueScheduled,
        requiredActionsCount,
    } = useTournamentLiveAdmin(tournament, matches, nowMs)

    return (
        <div className="space-y-0">
            <TournamentTabShellHeader
                orgSlug={orgSlug}
                tournament={tournament}
                tabs={tabs}
                activeTab={activeTab}
                setActiveTab={setActiveTab}
                statusMeta={statusMeta}
            />

            {/* Tab content */}
            <div className="pt-6">

                {/* ── Vue d'ensemble ─────────────────────────────────────────────── */}
                {activeTab === 'overview' && (
                    <TournamentOverviewTab
                        orgSlug={orgSlug}
                        tournament={tournament}
                        matches={matches}
                        pitchCount={pitchGroups.length}
                        groupPhaseCount={groupPhases.length}
                        bracketPhaseCount={bracketPhases.length}
                        matchesByPhase={matchesByPhase}
                        pendingQualifierPhases={pendingQualifierPhases}
                        retryPropagationAction={retryPropagationAction}
                        retryPropagationState={retryPropagationState}
                        overlayBackgroundAction={overlayBackgroundAction}
                        overlayBackgroundState={overlayBackgroundState}
                        overlayBgUrl={overlayBgUrl}
                        overlayBgPreview={overlayBgPreview}
                        overlayBgUploading={overlayBgUploading}
                        overlayBgUploadError={overlayBgUploadError}
                        onOverlayBackgroundChange={onOverlayBackgroundChange}
                        setOverlayBgUrl={setOverlayBgUrl}
                        setOverlayBgPreview={setOverlayBgPreview}
                        setOverlayBgUploadError={setOverlayBgUploadError}
                        setActiveTab={setActiveTab}
                        inputCls={inputCls}
                        btnPrimary={btnPrimary}
                    />
                )}
                {/* ── Phases ─────────────────────────────────────────────────────── */}
                {activeTab === 'phases' && (
                    <TournamentPhasesTab
                        orgSlug={orgSlug}
                        tournament={tournament}
                        phasesStep={phasesStep}
                        setPhasesStep={setPhasesStep}
                        matchesByPhase={matchesByPhase}
                        seededTeamsByPhase={seededTeamsByPhase}
                        incomingQualifiersByPhase={incomingQualifiersByPhase}
                        teamNameById={teamNameById}
                        resetTournamentAction={resetTournamentAction}
                        resetTournamentState={resetTournamentState}
                        duplicateTournamentAction={duplicateTournamentAction}
                        duplicateTournamentState={duplicateTournamentState}
                        setStandingsOverlay={setStandingsOverlay}
                        inputCls={inputCls}
                    />
                )}
                {/* ── Inscriptions & Pistes ──────────────────────────────────────── */}
                {activeTab === 'registrations' && (
                    <TournamentRegistrationsTab
                        orgSlug={orgSlug}
                        tournament={tournament}
                        availableTeams={availableTeams}
                        pitchGroups={pitchGroups}
                        bulkPitchCreateAction={bulkPitchCreateAction}
                        bulkPitchCreateState={bulkPitchCreateState}
                        bulkPitchDeleteAction={bulkPitchDeleteAction}
                        bulkPitchDeleteState={bulkPitchDeleteState}
                        inputCls={inputCls}
                        btnPrimary={btnPrimary}
                        btnDanger={btnDanger}
                    />
                )}
                {/* ── Poules ─────────────────────────────────────────────────────── */}
                {activeTab === 'pools' && (
                    <TournamentPoolsTab
                        orgSlug={orgSlug}
                        tournament={tournament}
                        groupPhases={groupPhases}
                        matches={matches}
                        teamNameById={teamNameById}
                        inputCls={inputCls}
                        btnPrimary={btnPrimary}
                        btnGhost={btnGhost}
                    />
                )}
                {/* ── Bracket ────────────────────────────────────────────────────── */}
                {activeTab === 'bracket' && (
                    <TournamentBracketTab
                        orgSlug={orgSlug}
                        tournament={tournament}
                        matches={matches}
                        bracketPhases={bracketPhases}
                        bracketParallelGroups={bracketParallelGroups}
                        activeBracketPhaseId={activeBracketTabId}
                        setActiveBracketPhaseId={setActiveBracketPhaseId}
                        seededTeamsByPhase={seededTeamsByPhase}
                        incomingQualifiersByPhase={incomingQualifiersByPhase}
                        expectedIncomingQualifierCountByPhase={expectedIncomingQualifierCountByPhase}
                        planningDefaults={planningDefaults}
                        bracketTimerContext={bracketTimerContext}
                        customBracketGenerationAction={customBracketGenerationAction}
                        customBracketGenerationState={customBracketGenerationState}
                        placementLabelsAction={placementLabelsAction}
                        placementLabelsState={placementLabelsState}
                        placementSegmentsAction={placementSegmentsAction}
                        placementSegmentsState={placementSegmentsState}
                        inputCls={inputCls}
                        btnGhost={btnGhost}
                    />
                )}
                {/* ── Matchs ─────────────────────────────────────────────────────── */}
                {activeTab === 'planning' && (
                    <TournamentPlanningByPitchTab
                        matches={matches}
                        scheduleByPitch={scheduleByPitch}
                        getMatchGroupLabel={getMatchGroupLabel}
                    />
                )}

                {activeTab === 'planning-time' && (
                    <TournamentPlanningTimeTab
                        orgSlug={orgSlug}
                        tournament={tournament}
                        matches={matches}
                        scheduleByTime={scheduleByTime}
                        slotTimerMinutes={slotTimerMinutes}
                        setSlotTimerMinutes={setSlotTimerMinutes}
                        slotBreakMinutes={slotBreakMinutes}
                        setSlotBreakMinutes={setSlotBreakMinutes}
                        slotLaunchAction={slotLaunchAction}
                        slotLaunchState={slotLaunchState}
                        breakTimerAction={breakTimerAction}
                        breakTimerState={breakTimerState}
                        getMatchGroupLabel={getMatchGroupLabel}
                        inputCls={inputCls}
                    />
                )}
                {/* ── Matchs ─────────────────────────────────────────────────────── */}
                {activeTab === 'matches' && (
                    <TournamentMatchesTab
                        orgSlug={orgSlug}
                        tournament={tournament}
                        matches={matches}
                        matchesStep={matchesStep}
                        setMatchesStep={setMatchesStep}
                        matchCreateMode={matchCreateMode}
                        setMatchCreateMode={setMatchCreateMode}
                        selectedMatchIds={selectedMatchIds}
                        setSelectedMatchIds={setSelectedMatchIds}
                        getMatchGroupLabel={getMatchGroupLabel}
                        inputCls={inputCls}
                        btnPrimary={btnPrimary}
                        btnGhost={btnGhost}
                        btnDanger={btnDanger}
                    />
                )}

            </div>

            <TournamentTabShellAdminPanel
                isAdminPanelCollapsed={isAdminPanelCollapsed}
                setIsAdminPanelCollapsed={setIsAdminPanelCollapsed}
                adminTimer={adminTimer}
                requiredActionsCount={requiredActionsCount}
                liveWithoutScores={liveWithoutScores}
                finishedWithoutScores={finishedWithoutScores}
                overdueScheduled={overdueScheduled}
                setActiveTab={setActiveTab}
                setMatchesStep={setMatchesStep}
            />

            <TournamentStandingsOverlay
                standingsOverlay={standingsOverlay}
                standingsOverlayPhase={standingsOverlayPhase}
                standingsOverlayGroupConfig={standingsOverlayGroupConfig}
                standingsOverlayByGroup={standingsOverlayByGroup}
                standingsOverlayGlobal={standingsOverlayGlobal}
                setStandingsOverlay={setStandingsOverlay}
            />
        </div>
    )
}
