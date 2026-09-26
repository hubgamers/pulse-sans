'use client'

import { startTransition, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { OverlaySponsor } from '../_lib/sponsors'

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
    sponsors?: OverlaySponsor[]
}

const CARDS_PER_SLIDE = 4

function getQualificationRuleTone(ruleType: 'TOP' | 'BOTTOM' | 'RANGE') {
    if (ruleType === 'TOP') return { badge: 'border-emerald-400/60 bg-emerald-500/30 text-emerald-300', dot: 'bg-emerald-400', row: 'bg-emerald-500/25 ring-2 ring-emerald-400/60', text: 'text-emerald-200 font-black' }
    if (ruleType === 'RANGE') return { badge: 'border-amber-400/60 bg-amber-500/30 text-amber-300', dot: 'bg-amber-400', row: 'bg-amber-500/25 ring-2 ring-amber-400/60', text: 'text-amber-200 font-black' }
    return { badge: 'border-rose-400/60 bg-rose-500/30 text-rose-300', dot: 'bg-rose-400', row: 'bg-rose-500/25 ring-2 ring-rose-400/60', text: 'text-rose-200 font-black' }
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
    if (status === 'LIVE') return { badge: 'border-emerald-400/60 bg-emerald-500/30 text-emerald-200', score: 'text-emerald-300' }
    if (status === 'FINISHED') return { badge: 'border-sky-400/60 bg-sky-500/30 text-sky-200', score: 'text-sky-300' }
    return { badge: 'border-slate-500/60 bg-slate-800/80 text-slate-300', score: 'text-amber-300' }
}

function initialsFromTeamName(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length <= 10) {
        return trimmed.toUpperCase();
    }
    const words = trimmed.split(/[\s-]+/).filter(Boolean);
    if (words.length > 1) {
        return words.map(word => word[0]).join('').slice(0, 5).toUpperCase();
    }
    return trimmed.slice(0, 4).toUpperCase();
}

export default function PoolsOverlayCarousel({ cards, rotationMs = 20000, refreshMs = 10000, timerSeconds = 0, timerStartMs = null, timerMode = 'MATCH', backgroundImageUrl = null, backgroundDim = 0.4, sponsors = [] }: Props) {
    const [activeSlide, setActiveSlide] = useState(0)
    const [refreshCycle, setRefreshCycle] = useState(0)
    const [lastSyncAt, setLastSyncAt] = useState(() => Date.now())
    const [nowMs, setNowMs] = useState(() => Date.now())
    const router = useRouter()

    useEffect(() => {
        const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
        return () => window.clearInterval(interval)
    }, [])

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

    const slides = useMemo(() => {
        const nextSlides: Array<Array<GroupCard | null>> = []
        for (let i = 0; i < cards.length; i += CARDS_PER_SLIDE) {
            const slice: Array<GroupCard | null> = cards.slice(i, i + CARDS_PER_SLIDE)
            while (slice.length < CARDS_PER_SLIDE) slice.push(null)
            nextSlides.push(slice)
        }
        return nextSlides.length > 0 ? nextSlides : [[null, null, null, null]]
    }, [cards])

    useEffect(() => {
        if (slides.length <= 1) return
        const interval = window.setInterval(() => setActiveSlide((c) => (c + 1) % slides.length), rotationMs)
        return () => window.clearInterval(interval)
    }, [rotationMs, slides.length])

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
        if (!backgroundImageUrl) return { backgroundColor: '#090d16' }
        return {
            backgroundImage: `linear-gradient(rgba(9, 13, 22, ${backgroundDim}), rgba(9, 13, 22, ${backgroundDim})), url(${backgroundImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        }
    }, [backgroundDim, backgroundImageUrl])

    return (
        <div className="relative aspect-video w-full overflow-hidden bg-[#090d16] p-6 font-sans text-white uppercase italic select-none" style={rootStyle}>

            {/* HEADER AREA */}
            {/*<header className="mb-4 flex items-center justify-center border-b-2 border-slate-700 pb-4">
                <div className="flex flex-col">
                    {timerLabel && (
                        <div className={`flex flex-col items-center gap-2 text-sm font-black tracking-tighter ${remainingTimerSeconds === 0 ? 'text-rose-400 animate-pulse' : 'text-[#ccff00]'}`}>
                            <span className="text-[10px] text-slate-300 tracking-widest uppercase not-italic font-bold">{timerMode === 'BREAK' ? 'Temps de battement' : 'Session en cours'}</span>
                            <h1 className="text-5xl font-black tracking-tighter leading-none">{timerLabel}</h1>
                        </div>
                    )}
                </div>

               <div className="text-right flex flex-col items-end gap-1">
                    <p className="text-[10px] text-slate-300 not-italic font-extrabold tracking-widest uppercase">Page {activeSlide + 1}/{slides.length} • Sync {lastSyncLabel}</p>
                    <div className="flex gap-1.5 mt-1">
                        {slides.map((_, i) => (
                            <div key={i} className={`h-1.5 rounded-full transition-all duration-500 ${i === activeSlide ? 'w-8 bg-[#ccff00]' : 'w-2 bg-slate-700'}`} />
                        ))}
                    </div>
                </div>
            </header>*/}

            {sponsors.length > 0 && (
                <div className="absolute left-6 right-6 top-4 flex items-center justify-center gap-2">
                    {sponsors.slice(0, 6).map((sponsor) => (
                        <div key={sponsor.id} className="flex h-full w-full items-center justify-center rounded-lg px-2 bg-slate-900/60 border border-slate-700/50 backdrop-blur-sm">
                            <img src={sponsor.logoUrl} alt={sponsor.name} className="max-h-20 max-w-full object-contain filter drop-shadow" />
                        </div>
                    ))}
                </div>
            )}

            {/* MAIN CONTENT GRID (2x2) */}
            <main className="grid h-[90%] grid-cols-2 grid-rows-2 gap-4">
                {currentSlide.map((card, idx) => {
                    if (!card) return <div key={idx} className="rounded-xl border-2 border-dashed border-slate-800 bg-slate-900/20" />

                    return (
                        <article key={card.key} className="flex flex-col overflow-hidden rounded-xl border-2 border-slate-700 bg-slate-900/85 backdrop-blur-md shadow-2xl">
                            <div className="bg-slate-800/90 px-3.5 py-2 flex justify-between items-center border-b-2 border-slate-700">
                                <h3 className="text-sm font-black text-[#ccff00] tracking-tight">POULE {card.groupIndex}</h3>
                                <span className="text-[9px] text-slate-300 not-italic font-extrabold tracking-widest">{card.phaseName}</span>
                            </div>

                            <div className="grid flex-1 grid-cols-[1.6fr_0.9fr] gap-3 p-2.5 overflow-hidden">

                                {/* LEFT: STANDINGS TABLE */}
                                <div className="overflow-hidden">
                                    <table className="w-full text-[12px] border-separate border-spacing-y-1">
                                        <thead>
                                            <tr className="text-slate-300 not-italic font-extrabold">
                                                <th className="px-1.5 py-1 text-left">Rang</th>
                                                <th className="px-1.5 py-1 text-left">ÉQUIPE</th>
                                                <th className="px-1.5 py-1 text-center">PTS</th>
                                                <th className="px-1.5 py-1 text-center">J</th>
                                                <th className="px-1.5 py-1 text-center">GD</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {card.standings.slice(0, 6).map((row, i) => {
                                                const rule = getQualificationRuleForRank(card, i + 1)
                                                const tone = rule ? getQualificationRuleTone(rule.type) : null
                                                const gdColor = row.goalDiff > 0 ? 'text-emerald-400 font-extrabold' : row.goalDiff < 0 ? 'text-rose-400 font-extrabold' : 'text-slate-300 font-bold'

                                                return (
                                                    <tr key={row.teamId} className={`${tone ? tone.row : 'bg-slate-800/70'} transition-all`}>
                                                        <td className={`px-2 py-1 font-black ${tone ? tone.text : 'text-slate-200'}`}>{i + 1}</td>
                                                        <td className="px-1.5 py-1">
                                                            {row.teamLogoUrl ? (
                                                                <img src={row.teamLogoUrl} alt={row.teamName} className="h-13 w-13 object-contain block shrink-0 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]" />
                                                            ) : (
                                                                <div className="flex h-13 w-13 items-center justify-center rounded-md border border-slate-600 bg-slate-800 text-[8px] font-black text-white shadow-md">
                                                                    {initialsFromTeamName(row.teamName)}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className={`px-1.5 py-1 text-center font-black ${tone ? tone.text : 'text-white'}`}>{row.points}</td>
                                                        <td className="px-1.5 py-1 text-center font-extrabold text-slate-300">{row.played}</td>
                                                        <td className={`px-1.5 py-1 text-center tabular-nums ${gdColor}`}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* RIGHT: MATCHES LIST */}
                                <div className="flex flex-col gap-1 border-l-2 border-slate-700/80 pl-2.5 overflow-hidden">
                                    <p className="text-[8px] font-extrabold text-slate-300 tracking-widest not-italic uppercase mb-1">Matchs à suivre</p>
                                    <div className="grid gap-1.5">
                                        {card.featuredMatches.slice(0, 6).map((match) => {
                                            const tone = getMatchStatusTone(match.status)
                                            const isLive = match.status === 'LIVE'
                                            const isActiveSlotLive = Boolean(match.isActiveSlotLive)

                                            return (
                                                <div key={match.id} className={`rounded-lg border-2 px-2.5 py-1.5 transition-all ${isLive ? 'bg-emerald-950/40 border-emerald-500/80 shadow-md' : 'bg-slate-950/60 border-slate-700/80'} ${isActiveSlotLive ? 'ring-2 ring-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.4)] animate-pulse' : ''}`}>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <p className="truncate text-[10px] font-black leading-none flex-1 tracking-tighter text-white">
                                                            {initialsFromTeamName(match.homeTeamName)} <span className="text-slate-400 font-bold mx-0.5">VS</span> {initialsFromTeamName(match.awayTeamName)}
                                                        </p>
                                                        <span className={`text-[11px] font-black shrink-0 tabular-nums ${tone.score}`}>
                                                            {match.homeScore !== null ? `${match.homeScore}-${match.awayScore}` : match.timeLabel}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-1.5">
                                                        <span className="text-[8px] font-extrabold text-slate-300 not-italic truncate w-24 uppercase tracking-tighter">{match.pitchName}</span>
                                                        <span className={`text-[8px] font-black uppercase ${isLive ? 'text-emerald-400 font-extrabold' : 'text-slate-400'}`}>
                                                            {isLive ? '● DIRECT' : match.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            </div>
                        </article>
                    )
                })}
            </main>

            {/* PROGRESS BAR FOOTER */}
            <div className="absolute bottom-0 left-0 h-1.5 w-full bg-slate-800">
                <div
                    key={`${activeSlide}-${refreshCycle}`}
                    className="h-full bg-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.9)]"
                    style={{ animation: `progress ${rotationMs}ms linear forwards` }}
                />
            </div>

            <style jsx>{` @keyframes progress { from { width: 0%; } to { width: 100%; } } `}</style>
        </div>
    )
}