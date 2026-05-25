import { notFound } from 'next/navigation'
import {
    formatMatchDateLabel,
    getPublicTournamentBySlugs,
} from '@/lib/actions/tournament/public.queries'
import {
    buildOverlayBackgroundStyle,
    readOverlayBackgroundConfig,
    type OverlayBackgroundSearchParams,
} from '../../_lib/background'
import { OverlaySponsorStrip, readOverlaySponsors } from '../../_lib/sponsors'

export const dynamic = 'force-dynamic'

type OverlaySearchParams = OverlayBackgroundSearchParams & {
    range?: string | string[]
}

function firstParam(value: string | string[] | undefined) {
    if (Array.isArray(value)) return value[0]
    return value
}

function readPlacementLabels(config: unknown): Record<string, string> {
    if (!config || typeof config !== 'object') return {}
    const raw = (config as { placementLabels?: unknown }).placementLabels
    if (!raw || typeof raw !== 'object') return {}

    return Object.fromEntries(
        Object.entries(raw as Record<string, unknown>)
            .filter(([key, value]) => /^\d+-\d+$/.test(key) && typeof value === 'string' && value.trim().length > 0)
            .map(([key, value]) => [key, (value as string).trim()])
    )
}

function readPlacementRangesFromMatches(matches: Array<{ bracketPos: string | null }>) {
    const ranges = new Set<string>()
    for (const match of matches) {
        const parsed = match.bracketPos?.match(/^P(\d+)-(\d+)-R\d+-M\d+$/)
        if (!parsed) continue
        ranges.add(`${Number(parsed[1])}-${Number(parsed[2])}`)
    }

    return Array.from(ranges)
        .map((key) => {
            const [start, end] = key.split('-').map(Number)
            return { key, start, end, size: end - start + 1 }
        })
        .sort((a, b) => b.size - a.size || a.start - b.start)
}

export default async function TournamentBracketOverlayPage({
    params,
    searchParams,
}: {
    params: Promise<{ 'org-slug': string; 't-slug': string; 'phase-id': string }>
    searchParams: Promise<OverlaySearchParams>
}) {
    const { 'org-slug': orgSlug, 't-slug': tournamentSlug, 'phase-id': phaseId } = await params
    const query = await searchParams

    const payload = await getPublicTournamentBySlugs(orgSlug, tournamentSlug)
    if (!payload) notFound()

    const { tournament, matches } = payload
    const background = readOverlayBackgroundConfig(query, tournament.bannerUrl)
    const backgroundStyle = buildOverlayBackgroundStyle(background.backgroundUrl, background.dim)
    const sponsors = readOverlaySponsors(tournament.sponsorConfig)
    const phase = tournament.phases.find((item) => item.id === phaseId)
    if (!phase || phase.type !== 'PLACEMENT_BRACKET') notFound()

    const phaseMatches = matches.filter((match) => match.phase.id === phaseId)
    const ranges = readPlacementRangesFromMatches(phaseMatches)
    if (ranges.length === 0) {
        return (
            <main className="min-h-screen bg-transparent text-slate-900" style={backgroundStyle}>
                <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-6">
                    <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Overlay bracket placement</p>
                        <h1 className="mt-2 text-3xl font-black">{phase.name}</h1>
                        <p className="mt-2 text-sm text-slate-500">Aucun sous-bracket de placement detecte pour cette phase.</p>
                    </section>
                </div>
                <OverlaySponsorStrip sponsors={sponsors} variant="light" />
            </main>
        )
    }

    const placementLabels = readPlacementLabels(phase.config)
    const requestedRange = firstParam(query.range)
    const selectedRange = ranges.find((item) => item.key === requestedRange) ?? ranges[0]

    const rangeMatches = phaseMatches
        .filter((match) => match.bracketPos?.startsWith(`P${selectedRange.key}-`))
        .sort((a, b) => {
            const aRound = a.roundNumber ?? 0
            const bRound = b.roundNumber ?? 0
            if (aRound !== bRound) return aRound - bRound
            return (a.bracketPos ?? '').localeCompare(b.bracketPos ?? '')
        })

    const title = placementLabels[selectedRange.key] ?? `Bracket ${selectedRange.key}`

    return (
        <main className="min-h-screen bg-transparent text-slate-900" style={backgroundStyle}>
            <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-6">
                <section className="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.2em] text-teal-700">Overlay bracket placement</p>
                    <h1 className="mt-2 text-3xl font-black">{title}</h1>
                    <p className="mt-1 text-sm text-slate-500">{tournament.name} · {phase.name}</p>

                    <div className="mt-4 flex flex-wrap gap-2">
                        {ranges.map((range) => {
                            const label = placementLabels[range.key] ?? `Bracket ${range.key}`
                            const isActive = range.key === selectedRange.key
                            return (
                                <a
                                    key={`range-${range.key}`}
                                    href={`/public/${orgSlug}/${tournamentSlug}/overlay/bracket/${phase.id}?range=${range.key}`}
                                    className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${isActive
                                        ? 'border-teal-500 bg-teal-50 text-teal-700'
                                        : 'border-slate-300 bg-white text-slate-700 hover:border-slate-500'
                                        }`}
                                >
                                    {label}
                                </a>
                            )
                        })}
                    </div>

                    {rangeMatches.length === 0 ? (
                        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                            Aucun match trouve pour ce bracket.
                        </p>
                    ) : (
                        <div className="mt-6 grid gap-3 md:grid-cols-2">
                            {rangeMatches.map((match) => (
                                <div key={match.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                    <p className="text-[11px] uppercase tracking-wider text-slate-500">
                                        {match.bracketPos ?? 'Match'} · {match.status} · {formatMatchDateLabel(match.scheduledAt)}
                                    </p>
                                    <p className="mt-1 text-base font-bold text-slate-900">
                                        {match.homeTeam?.name ?? 'TBD'} {match.result?.homeScore ?? 0}
                                        {' - '}
                                        {match.result?.awayScore ?? 0} {match.awayTeam?.name ?? 'TBD'}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-500">{match.pitch.name}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>
            <OverlaySponsorStrip sponsors={sponsors} variant="light" />
        </main>
    )
}
