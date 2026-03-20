'use client'

import { startTransition, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'

type StandingRow = {
    teamId: string
    teamName: string
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
}

const CARDS_PER_SLIDE = 4

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

export default function PoolsOverlayCarousel({ cards, rotationMs = 20000, refreshMs = 10000 }: Props) {
    const [activeSlide, setActiveSlide] = useState(0)
    const [refreshCycle, setRefreshCycle] = useState(0)
    const [lastSyncAt, setLastSyncAt] = useState(() => Date.now())
    const router = useRouter()

    const slides = useMemo(() => {
        const nextSlides: Array<Array<GroupCard | null>> = []
        for (let i = 0; i < cards.length; i += CARDS_PER_SLIDE) {
            const slice = cards.slice(i, i + CARDS_PER_SLIDE)
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

    return (
        <div className="relative aspect-video w-full overflow-hidden bg-slate-950 p-6 font-sans text-white uppercase italic">

            {/* HEADER */}
            <header className="mb-4 flex items-end justify-between border-b border-white/10 pb-4">
                <div>
                    <h1 className="text-4xl font-black tracking-tighter">
                        LIVE <span className="text-teal-400">SCOREBOARD</span>
                    </h1>
                    <p className="text-[10px] font-bold tracking-[0.4em] text-slate-500 not-italic uppercase">Actualisation {Math.round(refreshMs / 1000)}s</p>
                </div>

                <div className="text-right">
                    <p className="text-[9px] text-slate-500 not-italic font-bold tracking-widest uppercase mb-1">Page {activeSlide + 1}/{slides.length} • Sync {lastSyncLabel}</p>
                    <div className="flex gap-1 justify-end">
                        {slides.map((_, i) => (
                            <div key={i} className={`h-1 rounded-full transition-all duration-500 ${i === activeSlide ? 'w-8 bg-teal-500' : 'w-2 bg-slate-800'}`} />
                        ))}
                    </div>
                </div>
            </header>

            {/* MAIN GRID */}
            <main className="grid h-[85%] grid-cols-2 grid-rows-2 gap-4">
                {currentSlide.map((card, idx) => {
                    if (!card) return <div key={idx} className="rounded-xl border border-white/5 bg-white/[0.01]" />

                    return (
                        <article key={card.key} className="flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-900/40 backdrop-blur-sm">
                            <div className="bg-white/5 px-3 py-1.5 flex justify-between items-center border-b border-white/5">
                                <h3 className="text-sm font-black text-teal-400 tracking-tight">POULE {card.groupIndex}</h3>
                                <span className="text-[8px] text-slate-500 not-italic font-bold tracking-widest">{card.phaseName}</span>
                            </div>

                            <div className="grid flex-1 grid-cols-[1.2fr_1fr] gap-3 p-2 overflow-hidden">

                                {/* LEFT: STANDINGS TABLE */}
                                <div className="overflow-hidden">
                                    <table className="w-full text-[11px] border-separate border-spacing-y-0.5">
                                        <thead>
                                            <tr className="text-slate-500 not-italic">
                                                <th className="px-1 py-1 text-left font-bold">#</th>
                                                <th className="px-1 py-1 text-left font-bold">EQUIPE</th>
                                                <th className="px-1 py-1 text-right font-bold">PTS</th>
                                                <th className="px-1 py-1 text-right font-bold">J</th>
                                                <th className="px-1 py-1 text-right font-bold">GD</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {card.standings.slice(0, 6).map((row, i) => {
                                                const rule = getQualificationRuleForRank(card, i + 1)
                                                const tone = rule ? getQualificationRuleTone(rule.type) : null
                                                const gdColor = row.goalDiff > 0 ? 'text-emerald-400' : row.goalDiff < 0 ? 'text-red-400' : 'text-slate-400'

                                                return (
                                                    <tr key={row.teamId} className={`${tone ? tone.row : 'bg-white/5'} transition-colors`}>
                                                        <td className={`px-2 py-1 font-black ${tone ? tone.text : 'text-slate-500'}`}>{i + 1}</td>
                                                        <td className="px-1 py-1 truncate max-w-[100px] font-black tracking-wide leading-none">{row.teamName}</td>
                                                        <td className={`px-1 py-1 text-right font-black ${tone ? tone.text : 'text-white'}`}>{row.points}</td>
                                                        <td className="px-1 py-1 text-right font-bold text-slate-400">{row.played}</td>
                                                        <td className={`px-1 py-1 text-right font-bold ${gdColor}`}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* RIGHT: MATCHES (MAX 6) */}
                                <div className="flex flex-col gap-1 border-l border-white/5 pl-2 overflow-hidden">
                                    <p className="text-[7px] font-bold text-slate-500 tracking-widest not-italic uppercase mb-1">Matchs à suivre</p>
                                    <div className="grid gap-1">
                                        {card.featuredMatches.slice(0, 6).map((match) => {
                                            const tone = getMatchStatusTone(match.status)
                                            const isLive = match.status === 'LIVE'
                                            return (
                                                <div key={match.id} className={`rounded border px-2 py-1 ${isLive ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-950/40 border-white/5'}`}>
                                                    <div className="flex items-center justify-between gap-1">
                                                        <p className="truncate text-[9px] font-black leading-none flex-1 tracking-tighter">
                                                            {match.homeTeamName} <span className="text-slate-600 font-normal mx-0.5">VS</span> {match.awayTeamName}
                                                        </p>
                                                        <span className={`text-[10px] font-black shrink-0 ${tone.score}`}>
                                                            {match.homeScore !== null ? `${match.homeScore}-${match.awayScore}` : match.timeLabel}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between mt-0.5 opacity-70">
                                                        <span className="text-[7px] font-bold text-slate-400 not-italic truncate w-20 uppercase">{match.pitchName}</span>
                                                        <span className={`text-[7px] font-black uppercase ${isLive ? 'text-emerald-400 animate-pulse' : 'text-slate-600'}`}>
                                                            {isLive ? '● LIVE' : match.label}
                                                        </span>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        {card.featuredMatches.length === 0 && <div className="py-10 text-center text-[8px] opacity-20 italic">Aucun match</div>}
                                    </div>
                                </div>
                            </div>
                        </article>
                    )
                })}
            </main>

            {/* PROGRESS FOOTER */}
            <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-900/50">
                <div key={`${activeSlide}-${refreshCycle}`} className="h-full bg-teal-500 shadow-[0_0_12px_rgba(20,184,166,0.8)]" style={{ animation: `progress ${rotationMs}ms linear forwards` }} />
            </div>

            <style jsx>{` @keyframes progress { from { width: 0%; } to { width: 100%; } } `}</style>
        </div>
    )
}