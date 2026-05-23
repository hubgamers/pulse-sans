'use client'

import type { ChangeEvent, ComponentProps } from 'react'
import type { InlineActionState, OverlaySponsor, SerializedMatch, TabId, TournamentData } from './TournamentTabShell.types'
import { formatRouteRule, readParallelGroup, readRoutes } from './TournamentTabShell.utils'
import { EmptyState, LoadingSubmitButton, PhaseTypeBadge } from './TournamentTabShell.helpers'

type TournamentOverviewTabProps = {
    orgSlug: string
    tournament: TournamentData
    matches: SerializedMatch[]
    pitchCount: number
    groupPhaseCount: number
    bracketPhaseCount: number
    matchesByPhase: Map<string, { total: number; finished: number }>
    pendingQualifierPhases: Array<{ phaseId: string; phaseName: string; pending: number }>
    retryPropagationAction: ComponentProps<'form'>['action']
    retryPropagationState: InlineActionState
    overlayBackgroundAction: ComponentProps<'form'>['action']
    overlayBackgroundState: InlineActionState
    overlayBgUrl: string
    overlayBgPreview: string
    overlayBgUploading: boolean
    overlayBgUploadError: string
    overlaySponsors: OverlaySponsor[]
    overlaySponsorsAction: ComponentProps<'form'>['action']
    overlaySponsorsState: InlineActionState
    sponsorUploadId: string | null
    sponsorUploadError: string
    onOverlayBackgroundChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
    onSponsorLogoChange: (sponsorId: string, event: ChangeEvent<HTMLInputElement>) => Promise<void>
    addOverlaySponsor: () => void
    updateOverlaySponsor: (id: string, patch: Partial<OverlaySponsor>) => void
    removeOverlaySponsor: (id: string) => void
    setOverlayBgUrl: (value: string) => void
    setOverlayBgPreview: (value: string) => void
    setOverlayBgUploadError: (value: string) => void
    setActiveTab: (tab: TabId) => void
    inputCls: string
    btnPrimary: string
}

export default function TournamentOverviewTab({
    orgSlug,
    tournament,
    matches,
    pitchCount,
    groupPhaseCount,
    bracketPhaseCount,
    matchesByPhase,
    pendingQualifierPhases,
    retryPropagationAction,
    retryPropagationState,
    overlayBackgroundAction,
    overlayBackgroundState,
    overlayBgUrl,
    overlayBgPreview,
    overlayBgUploading,
    overlayBgUploadError,
    overlaySponsors,
    overlaySponsorsAction,
    overlaySponsorsState,
    sponsorUploadId,
    sponsorUploadError,
    onOverlayBackgroundChange,
    onSponsorLogoChange,
    addOverlaySponsor,
    updateOverlaySponsor,
    removeOverlaySponsor,
    setOverlayBgUrl,
    setOverlayBgPreview,
    setOverlayBgUploadError,
    setActiveTab,
    inputCls,
    btnPrimary,
}: TournamentOverviewTabProps) {
    const completeSponsors = overlaySponsors
        .map((sponsor) => ({
            id: sponsor.id,
            name: sponsor.name.trim(),
            logoUrl: sponsor.logoUrl.trim(),
        }))
        .filter((sponsor) => sponsor.name && sponsor.logoUrl)

    return (
<div className="space-y-6">
    {/* Stats grid */}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Phases</p>
            <p className="mt-2 text-2xl font-black">{tournament.phases.length}</p>
            <p className="text-xs text-slate-500">{tournament.phases.filter((p) => p.isCompleted).length} completee(s)</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Équipes</p>
            <p className="mt-2 text-2xl font-black">{tournament._count.registrations}</p>
            <p className="text-xs text-slate-500">
                {tournament.registrations.filter((r) => r.isConfirmed).length} confirmees
            </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Matchs</p>
            <p className="mt-2 text-2xl font-black">{matches.length}</p>
            <p className="text-xs text-slate-500">
                {matches.filter((m) => m.status === 'FINISHED').length} termines
            </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs uppercase text-slate-500">Pistes</p>
            <p className="mt-2 text-2xl font-black">{pitchCount}</p>
            <p className="text-xs text-slate-500">terrain(s) disponible(s)</p>
        </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Parcours recommande</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
            <button type="button" onClick={() => setActiveTab('phases')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                <p className="text-xs font-semibold text-teal-700">Etape 1</p>
                <p className="text-sm font-semibold">Configurer les phases</p>
            </button>
            <button type="button" onClick={() => setActiveTab('registrations')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                <p className="text-xs font-semibold text-teal-700">Etape 2</p>
                <p className="text-sm font-semibold">Inscrire équipes et pistes</p>
            </button>
            <button type="button" onClick={() => setActiveTab(groupPhaseCount > 0 ? 'pools' : 'matches')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                <p className="text-xs font-semibold text-teal-700">Etape 3</p>
                <p className="text-sm font-semibold">Generer et organiser les matchs</p>
            </button>
            <button type="button" onClick={() => setActiveTab(bracketPhaseCount > 0 ? 'bracket' : 'planning')} className="rounded-lg border border-slate-300 px-3 py-2 text-left hover:bg-slate-50">
                <p className="text-xs font-semibold text-teal-700">Etape 4</p>
                <p className="text-sm font-semibold">Suivre bracket et planning</p>
            </button>
        </div>
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Maintenance propagation</h2>
            <p className="mt-1 text-xs text-slate-500">
                Utilisez ce bouton si des qualifiees restent en attente apres une reinitialisation, une modification de score ou un incident de propagation.
            </p>
        </div>

        <form action={retryPropagationAction} className="space-y-3">
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
            <input type="hidden" name="force" value="on" />

            <LoadingSubmitButton
                className={`${btnPrimary} w-full md:w-auto disabled:opacity-60`}
                loadingLabel="Relance forcee..."
            >
                Forcer la propagation des equipes
            </LoadingSubmitButton>

            {retryPropagationState.message && (
                <p className={`text-xs ${retryPropagationState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {retryPropagationState.message}
                </p>
            )}
        </form>

        {pendingQualifierPhases.length > 0 ? (
            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700">
                    Equipes en attente de qualification: {pendingQualifierPhases.reduce((sum, item) => sum + item.pending, 0)}
                </p>
                <div className="mt-2 flex flex-wrap gap-1">
                    {pendingQualifierPhases.map((item) => (
                        <span key={item.phaseId} className="rounded-md bg-white px-2 py-0.5 text-[11px] text-amber-800 border border-amber-300">
                            {item.phaseName}: {item.pending}
                        </span>
                    ))}
                </div>
            </div>
        ) : (
            <p className="mt-3 text-xs text-emerald-700">Aucune equipe en attente de qualification detectee.</p>
        )}
    </div>

    <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Overlay public</h2>
            <p className="mt-1 text-xs text-slate-500">Importez une image de fond qui sera reprise automatiquement dans les overlays publics.</p>
        </div>

        <form action={overlayBackgroundAction} className="space-y-3">
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
            <input type="hidden" name="bannerUrl" value={overlayBgUrl} />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-slate-500">Image de fond overlay</label>
                <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 bg-white p-4 text-xs text-slate-500 transition hover:border-teal-500 hover:bg-teal-50/30">
                    {overlayBgPreview ? (
                        <img src={overlayBgPreview} alt="Apercu fond overlay" className="h-24 w-full rounded object-cover" />
                    ) : (
                        <span>Aucune image selectionnee</span>
                    )}
                    <span>{overlayBgUploading ? 'Upload en cours...' : 'Cliquer pour importer une image'}</span>
                    <span className="text-[11px] text-slate-400">PNG, JPEG, WEBP, SVG, GIF - max 8 Mo</span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        onChange={onOverlayBackgroundChange}
                        disabled={overlayBgUploading}
                        className="hidden"
                    />
                </label>
                {overlayBgUploadError && <p className="mt-2 text-xs text-red-700">{overlayBgUploadError}</p>}
            </div>

            <div className="grid gap-2 md:grid-cols-[1fr_auto_auto]">
                <input
                    value={overlayBgUrl}
                    onChange={(event) => {
                        setOverlayBgUrl(event.target.value)
                        setOverlayBgPreview(event.target.value)
                    }}
                    className={inputCls}
                    placeholder="https://..."
                />
                <button
                    type="button"
                    onClick={() => {
                        setOverlayBgUrl('')
                        setOverlayBgPreview('')
                        setOverlayBgUploadError('')
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                    Retirer
                </button>
                <LoadingSubmitButton
                    className={`${btnPrimary} w-full disabled:opacity-60`}
                    disabled={overlayBgUploading}
                    loadingLabel="Enregistrement..."
                >
                    Sauvegarder
                </LoadingSubmitButton>
            </div>

            {overlayBackgroundState.message && (
                <p className={`text-xs ${overlayBackgroundState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {overlayBackgroundState.message}
                </p>
            )}
        </form>

        <form action={overlaySponsorsAction} className="mt-5 space-y-3 border-t border-slate-200 pt-4">
            <input type="hidden" name="tournamentId" value={tournament.id} />
            <input type="hidden" name="orgSlug" value={orgSlug} />
            <input type="hidden" name="tournamentSlug" value={tournament.slug} />
            <input type="hidden" name="sponsorsJson" value={JSON.stringify(completeSponsors)} />

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Sponsors overlay</h3>
                    <p className="mt-1 text-xs text-slate-500">Les logos apparaissent automatiquement sur les overlays publics, hors tablette.</p>
                </div>
                <button
                    type="button"
                    onClick={addOverlaySponsor}
                    disabled={overlaySponsors.length >= 12}
                    className="rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                    Ajouter un sponsor
                </button>
            </div>

            {overlaySponsors.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-xs text-slate-500">
                    Aucun sponsor configure.
                </div>
            ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                    {overlaySponsors.map((sponsor, index) => (
                        <div key={sponsor.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                            <div className="flex items-start gap-3">
                                <label className="flex h-20 w-28 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-2 text-center text-[11px] text-slate-500 hover:border-teal-500">
                                    {sponsor.logoUrl ? (
                                        <img src={sponsor.logoUrl} alt={sponsor.name || `Sponsor ${index + 1}`} className="max-h-16 max-w-full object-contain" />
                                    ) : (
                                        <span>{sponsorUploadId === sponsor.id ? 'Upload...' : 'Logo'}</span>
                                    )}
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                        onChange={(event) => onSponsorLogoChange(sponsor.id, event)}
                                        disabled={sponsorUploadId === sponsor.id}
                                        className="hidden"
                                    />
                                </label>

                                <div className="min-w-0 flex-1 space-y-2">
                                    <input
                                        value={sponsor.name}
                                        onChange={(event) => updateOverlaySponsor(sponsor.id, { name: event.target.value })}
                                        className={inputCls}
                                        placeholder="Nom du sponsor"
                                    />
                                    <input
                                        value={sponsor.logoUrl}
                                        onChange={(event) => updateOverlaySponsor(sponsor.id, { logoUrl: event.target.value })}
                                        className={inputCls}
                                        placeholder="https://.../logo.png"
                                    />
                                </div>

                                <button
                                    type="button"
                                    onClick={() => removeOverlaySponsor(sponsor.id)}
                                    className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                                >
                                    Retirer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {sponsorUploadError && <p className="text-xs text-red-700">{sponsorUploadError}</p>}

            <div className="flex flex-wrap items-center gap-3">
                <LoadingSubmitButton
                    className={`${btnPrimary} disabled:opacity-60`}
                    disabled={Boolean(sponsorUploadId)}
                    loadingLabel="Enregistrement..."
                >
                    Sauvegarder les sponsors
                </LoadingSubmitButton>
                <p className="text-xs text-slate-500">{completeSponsors.length}/{overlaySponsors.length} sponsor(s) pret(s)</p>
            </div>

            {overlaySponsorsState.message && (
                <p className={`text-xs ${overlaySponsorsState.success ? 'text-emerald-700' : 'text-red-700'}`}>
                    {overlaySponsorsState.message}
                </p>
            )}
        </form>
    </div>

    {/* Phase flow */}
    {tournament.phases.length === 0 ? (
        <EmptyState message="Aucune phase configuree." />
    ) : (
        <div className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Progression du tournoi</h2>
            <div className="flex flex-col gap-0">
                {tournament.phases.map((phase, idx) => {
                    const stats = matchesByPhase.get(phase.id) ?? { total: 0, finished: 0 }
                    const pct = stats.total > 0 ? Math.round((stats.finished / stats.total) * 100) : 0
                    const routes = readRoutes(phase.config)
                    const parallelGroup = readParallelGroup(phase.config)
                    return (
                        <div key={phase.id} className="relative flex gap-4">
                            {/* Connector line */}
                            <div className="flex flex-col items-center">
                                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${phase.isCompleted
                                    ? 'border-emerald-500 bg-emerald-600/20 text-emerald-300'
                                    : 'border-slate-300 bg-slate-50 text-slate-500'
                                    }`}>
                                    {phase.isCompleted ? '✓' : phase.order}
                                </div>
                                {idx < tournament.phases.length - 1 && (
                                    <div className="w-0.5 flex-1 bg-slate-800 my-1" style={{ minHeight: '24px' }} />
                                )}
                            </div>
                            <div className="mb-4 flex-1 rounded-xl border border-slate-200 bg-white p-3">
                                <div className="mb-2 flex items-center gap-2">
                                    <p className="text-sm font-semibold">{phase.name}</p>
                                    <PhaseTypeBadge type={phase.type} />
                                    {parallelGroup && (
                                        <span className="rounded-md border border-teal-300 bg-teal-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-700">
                                            Simultane: {parallelGroup}
                                        </span>
                                    )}
                                    {phase.isCompleted && (
                                        <span className="ml-auto text-[10px] font-semibold bg-emerald-500 text-white px-2 py-0.5 rounded-md">Terminée</span>
                                    )}
                                </div>
                                <p className="mb-2 text-xs text-slate-500">
                                    {stats.finished}/{stats.total} matchs terminés
                                </p>
                                <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                                    <div
                                        className={`h-full rounded-full transition-all ${phase.isCompleted ? 'bg-emerald-500' : 'bg-teal-600'}`}
                                        style={{ width: `${pct}%` }}
                                    />
                                </div>
                                {routes.length > 0 && (
                                    <div className="mt-2 flex flex-wrap gap-1">
                                        {routes.map((route, i) => (
                                            <span
                                                key={i}
                                                className="rounded-md border border-slate-700 px-2 py-0.5 text-[10px] font-medium text-dark antialiased"
                                            >
                                                {formatRouteRule(route)} → {route.toPhaseKey || 'phase cible'}
                                                {route.label ? ` (${route.label})` : ''}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )}

    <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Historique des actions</h2>
            <span className="text-[11px] text-slate-500">{tournament.actionLogs.length} entree(s)</span>
        </div>

        {tournament.actionLogs.length === 0 ? (
            <p className="text-xs text-slate-500">Aucune action enregistree pour le moment.</p>
        ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto pr-1">
                {tournament.actionLogs.map((log) => (
                    <div key={log.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-3">
                            <p className="text-xs text-slate-800">{log.message}</p>
                            <span className="shrink-0 rounded-md bg-slate-900 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                                {log.actionType}
                            </span>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500">
                            {new Date(log.createdAt).toLocaleString('fr-FR', { timeZone: 'UTC' })}
                            {log.actorName ? ` • ${log.actorName}` : ''}
                        </p>
                    </div>
                ))}
            </div>
        )}
    </div>
</div>
    )
}
