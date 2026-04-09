'use client'

import { startTransition, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type StandingRow = {
    teamId: string
    teamName: string
    teamLogoUrl: string | null
    played: number
    wins: number
    draws: number
    losses: number
    points: number
    goalDiff: number
}

type FeaturedMatch = {
    id: string
    status: string
    label: string
    dateLabel: string
    timeLabel: string
    pitchName: string
    phaseName: string
    homeTeamName: string
    awayTeamName: string
    homeScore: number | null
    awayScore: number | null
    isActiveSlotLive?: boolean
}

type GroupCard = {
    key: string
    phaseName: string
    groupIndex: number
    qualificationRules: Array<{
        type: 'TOP' | 'BOTTOM' | 'RANGE'
        label: string
        priority: number
        countPerGroup?: number
        startRank?: number
        endRank?: number
    }>
    standings: StandingRow[]
    featuredMatches: FeaturedMatch[]
}

type Props = {
    cards: GroupCard[]
    rotationMs?: number
    refreshMs?: number
    timerSeconds?: number
    timerStartMs?: number | null
    timerMode?: 'MATCH' | 'BREAK'
    backgroundImageUrl?: string | null
    backgroundDim?: number
}

const CARDS_PER_SLIDE = 4

/**
 * UTILS: Styles dynamiques pour les règles de qualification et statuts
 */
function getQualificationRuleTone(ruleType: 'TOP' | 'BOTTOM' | 'RANGE') {
    if (ruleType === 'TOP') return { badge: 'border-teal-500/30 bg-teal-500/10 text-teal-300', dot: 'bg-teal-400', row: 'bg-teal-500/20 ring-1 ring-teal-500/30', text: 'text-teal-300' }
    if (ruleType === 'RANGE') return { badge: 'border-amber-500/30 bg-amber-500/10 text-amber-300', dot: 'bg-amber-400', row: 'bg-amber-500/20 ring-1 ring-amber-500/30', text: 'text-amber-300' }
    return { badge: 'border-rose-500/30 bg-rose-500/10 text-rose-300', dot: 'bg-rose-400', row: 'bg-rose-500/20 ring-1 ring-rose-500/30', text: 'text-rose-300' }
}

function getQualificationRuleForRank(card: GroupCard, rank: number) {
    const totalTeams = card.standings.length
    return card.qualificationRules.find((rule) => {
        if (rule.type === 'TOP' && rule.countPerGroup) return rank <= rule.countPerGroup
        if (rule.type === 'BOTTOM' && rule.countPerGroup) return rank > totalTeams - rule.countPerGroup
        if (rule.type === 'RANGE' && rule.startRank && rule.endRank) return rank >= rule.startRank && rank <= rule.endRank
        return false
    })
}

function getMatchStatusTone(status: string) {
    if (status === 'LIVE') return { badge: 'border-emerald-500/30 bg-emerald-500/20 text-emerald-300', score: 'text-emerald-300' }
    if (status === 'FINISHED') return { badge: 'border-sky-500/30 bg-sky-500/10 text-sky-400', score: 'text-sky-400' }
    return { badge: 'border-white/10 bg-white/5 text-slate-500', score: 'text-amber-400' }
}

function initialsFromTeamName(name: string): string {
    return name
        .trim()
        .split(/[\s-]+/) // Sépare par les espaces ET les tirets (ex: "Paris-SG")
        .map(word => word[0])
        .filter(Boolean)
        .slice(0, 6) // 3 lettres est souvent le standard (ex: PSG, RMD, LIV)
        .join('')
        .toUpperCase();
}

export default function PoolsOverlayCarousel({ cards, rotationMs = 20000, refreshMs = 10000, timerSeconds = 0, timerStartMs = null, timerMode = 'MATCH', backgroundImageUrl = null, backgroundDim = 0.55 }: Props) {
    const [activeSlide, setActiveSlide] = useState(0)
    const [refreshCycle, setRefreshCycle] = useState(0)
    const [lastSyncAt, setLastSyncAt] = useState(() => Date.now())
    const [nowMs, setNowMs] = useState(() => Date.now())
    const router = useRouter()

    // 1. Horloge temps réel pour le timer
    useEffect(() => {
        const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
        return () => window.clearInterval(interval)
    }, [])

    // 2. Logique du Timer de fin de match / slot
    const remainingTimerSeconds = useMemo(() => {
        if (!timerStartMs || timerSeconds <= 0) return null
        const endMs = timerStartMs + (timerSeconds * 1000)
        const diff = Math.ceil((endMs - nowMs) / 1000)
        return diff <= 0 ? 0 : diff
    }, [nowMs, timerStartMs, timerSeconds])

    const timerLabel = useMemo(() => {
        if (remainingTimerSeconds === null) return null
        const m = Math.floor(remainingTimerSeconds / 60)
        const s = remainingTimerSeconds % 60
        const pad = (n: number) => String(n).padStart(2, '0')
        return `${pad(m)}:${pad(s)}`
    }, [remainingTimerSeconds])

    // 3. Découpage des slides (4 cartes par vue)
    const slides = useMemo(() => {
        const nextSlides: Array<Array<GroupCard | null>> = []
        for (let i = 0; i < cards.length; i += CARDS_PER_SLIDE) {
            const slice: Array<GroupCard | null> = cards.slice(i, i + CARDS_PER_SLIDE)
            while (slice.length < CARDS_PER_SLIDE) slice.push(null)
            nextSlides.push(slice)
        }
        return nextSlides.length > 0 ? nextSlides : [[null, null, null, null]]
    }, [cards])

    // 4. Rotation automatique des slides
    useEffect(() => {
        if (slides.length <= 1) return
        const interval = window.setInterval(() => setActiveSlide((c) => (c + 1) % slides.length), rotationMs)
        return () => window.clearInterval(interval)
    }, [rotationMs, slides.length])

    // 5. Rafraîchissement des données via Next.js router
    useEffect(() => {
        const interval = window.setInterval(() => {
            if (document.visibilityState !== 'visible') return
            setLastSyncAt(Date.now())
            setRefreshCycle((c) => c + 1)
            startTransition(() => router.refresh())
        }, refreshMs)
        return () => window.clearInterval(interval)
    }, [refreshMs, router])

    const currentSlide = slides[activeSlide] || slides[0]
    const lastSyncLabel = useMemo(() => new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(lastSyncAt), [lastSyncAt])
    const rootStyle = useMemo(() => {
        if (!backgroundImageUrl) return undefined
        return {
            backgroundImage: `linear-gradient(rgba(2, 6, 23, ${backgroundDim}), rgba(2, 6, 23, ${backgroundDim})), url(${backgroundImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        }
    }, [backgroundDim, backgroundImageUrl])

    return (
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 p-6 font-sans text-white uppercase italic select-none" style={rootStyle}>

            {/* HEADER AREA */}
            <header className="mb-4 flex items-end justify-between border-b border-white/10 pb-4">
                <div className="flex flex-col">
                    <h1 className="text-4xl font-black tracking-tighter leading-none">
                        LIVE <span className="text-teal-400">SCOREBOARD</span>
                    </h1>
                    <p className="text-[10px] font-bold tracking-[0.4em] text-slate-500 not-italic uppercase mt-1">Actualisation {Math.round(refreshMs / 1000)}s</p>
                </div>

                <div className="text-right flex flex-col items-end gap-1">
                    {timerLabel && (
                        <div className={`flex items-center gap-2 text-sm font-black tracking-tighter ${remainingTimerSeconds === 0 ? 'text-rose-500 animate-pulse' : 'text-amber-400'}`}>
                            <span className="text-[9px] opacity-60 tracking-widest uppercase not-italic">{timerMode === 'BREAK' ? 'Temps de battement' : 'Fin de session'}</span>
                            <span className="text-2xl tabular-nums leading-none">{timerLabel}</span>
                        </div>
                    )}
                    <p className="text-[9px] text-slate-500 not-italic font-bold tracking-widest uppercase">Page {activeSlide + 1}/{slides.length} • Sync {lastSyncLabel}</p>
                    <div className="flex gap-1 mt-1">
                        {slides.map((_, i) => (
                            <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === activeSlide ? 'w-8 bg-teal-500' : 'w-2 bg-slate-800'}`} />
                        ))}
                    </div>
                </div>
            </header>

            {/* MAIN CONTENT GRID (2x2) */}
            <main className="grid h-[90%] grid-cols-2 grid-rows-2 gap-4">
                {currentSlide.map((card, idx) => {
                    if (!card) return <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.01]" />

                    return (
                        <article key={card.key} className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur-sm shadow-xl">
                            {/* Card Header */}
                            <div className="bg-white/5 px-3 py-1.5 flex justify-between items-center border-b border-white/5">
                                <h3 className="text-sm font-black text-teal-400 tracking-tight">POULE {card.groupIndex}</h3>
                                <span className="text-[8px] text-slate-500 not-italic font-bold tracking-widest">{card.phaseName}</span>
                            </div>

                            <div className="grid flex-1 grid-cols-[1.6fr_0.9fr] gap-3 p-2 overflow-hidden">

                                {/* LEFT: STANDINGS TABLE */}
                                <div className="overflow-hidden">
                                    <table className="w-full text-[12px] border-separate border-spacing-y-1">
                                        <thead>
                                            <tr className="text-slate-500 not-italic">
                                                <th className="px-1 py-1 text-left font-bold">#</th>
                                                <th className="px-1 py-1 text-left font-bold">LOGO</th>
                                                <th className="px-1 py-1 text-center font-bold">PTS</th>
                                                <th className="px-1 py-1 text-center font-bold">J</th>
                                                <th className="px-1 py-1 text-center font-bold">GD</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {card.standings.slice(0, 6).map((row, i) => {
                                                const rule = getQualificationRuleForRank(card, i + 1)
                                                const tone = rule ? getQualificationRuleTone(rule.type) : null
                                                const gdColor = row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-red-400' : 'text-slate-400'

                                                return (
                                                    <tr key={row.teamId} className={`${tone ? tone.row : 'bg-white/5'} transition-all`}>
                                                        <td className={`px-2 py-1 font-black ${tone ? tone.text : 'text-slate-500'}`}>{i + 1}</td>
                                                        <td className="px-1 py-1">
                                                            {row.teamLogoUrl ? (
                                                                <img
                                                                    src={row.teamLogoUrl}
                                                                    alt={`Logo ${row.teamName}`}
                                                                    className="h-13 w-13 object-contain block shrink-0"
                                                                />
                                                            ) : (
                                                                <div className="flex h-13 w-13 items-center justify-center rounded-md border border-white/10 bg-slate-800 text-[9px] font-black text-slate-200">
                                                                    {initialsFromTeamName(row.teamName)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className={`px-1 py-1 text-center font-black ${tone ? tone.text : 'text-white'}`}>{row.points}</td>
                                                        <td className="px-1 py-1 text-center font-bold text-slate-400">{row.played}</td>
                                                        <td className={`px-1 py-1 text-center font-bold tabular-nums ${gdColor}`}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* RIGHT: MATCHES LIST */}
                                <div className="flex flex-col gap-1 border-l border-white/5 pl-2 overflow-hidden">
                                    <p className="text-[7px] font-bold text-slate-500 tracking-widest not-italic uppercase mb-1">Matchs à suivre</p>
                                    <div className="grid gap-1">
                                        {card.featuredMatches.slice(0, 6).map((match) => {
                                            const tone = getMatchStatusTone(match.status)
                                            const isLive = match.status === 'LIVE'
                                            const isActiveSlotLive = Boolean(match.isActiveSlotLive)

                                            return (
                                                <div key={match.id} className={`rounded border px-2 py-1.5 transition-all ${isLive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950/40 border-white/5'} ${isActiveSlotLive ? 'ring-1 ring-amber-400/50 shadow-[0_0_8px_rgba(251,191,36,0.2)] animate-pulse' : ''}`}>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <p className="truncate text-[9px] font-black leading-none flex-1 tracking-tighter">
                                                            {match.homeTeamName} <span className="text-slate-600 font-normal mx-0.5">VS</span> {match.awayTeamName}
                                                        </p>
                                                        <span className={`text-[11px] font-black shrink-0 tabular-nums ${tone.score}`}>
                                                            {match.homeScore !== null ? `${match.homeScore}-${match.awayScore}` : match.timeLabel}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1 opacity-60">
                                                        <span className="text-[7px] font-bold text-slate-400 not-italic truncate w-24 uppercase tracking-tighter">{match.pitchName}</span>
                                                        <span className={`text-[7px] font-black uppercase ${isLive ? 'text-emerald-400' : 'text-slate-600'}`}>
                                                            {isLive ? (isActiveSlotLive ? '● DIRECT' : '● DIRECT') : match.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {card.featuredMatches.length === 0 && <div className="py-10 text-center text-[8px] opacity-20 italic">Aucune rencontre programmée</div>}
                                    </div>
                                </div>
                            </div>
                        </article>
                    )
                })}
            </main>

            {/* PROGRESS BAR FOOTER */}
            <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-900/50">
                <div
                    key={`${activeSlide}-${refreshCycle}`}
                    className="h-full bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.8)]"
                    style={{ animation: `progress ${rotationMs}ms linear forwards` }}
                />
            </div>

            <style jsx>{` @keyframes progress { from { width: 0%; } to { width: 100%; } } `}</style>
        </div>
    )
}