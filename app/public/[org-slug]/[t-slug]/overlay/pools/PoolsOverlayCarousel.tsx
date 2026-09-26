'use client'

import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { DotLottiePlayer } from '@dotlottie/react-player'
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

type FullscreenEvent =
    | { type: 'TIMER_START'; mode: 'MATCH' | 'BREAK' }
    | { type: 'TIMER_END'; mode: 'MATCH' | 'BREAK' }
    | { type: 'SCORE_UPDATE'; matches: FeaturedMatch[] }
    | null

const CARDS_PER_SLIDE = 4

function getQualificationRuleTone(ruleType: 'TOP' | 'BOTTOM' | 'RANGE') {
    if (ruleType === 'TOP') {
        return {
            row: 'bg-emerald-500/20 border-l-4 border-emerald-400 shadow-[inset_0_0_12px_rgba(52,211,153,0.15)]',
            text: 'text-emerald-300 font-black drop-shadow'
        }
    }
    if (ruleType === 'RANGE') {
        return {
            row: 'bg-amber-500/20 border-l-4 border-amber-400 shadow-[inset_0_0_12px_rgba(251,191,36,0.15)]',
            text: 'text-amber-300 font-black drop-shadow'
        }
    }
    return {
        row: 'bg-rose-500/20 border-l-4 border-rose-400 shadow-[inset_0_0_12px_rgba(251,113,133,0.15)]',
        text: 'text-rose-300 font-black drop-shadow'
    }
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

function initialsFromTeamName(name: string): string {
    const trimmed = name.trim()
    if (trimmed.length <= 10) return trimmed.toUpperCase()
    const words = trimmed.split(/[\s-]+/).filter(Boolean)
    if (words.length > 1) {
        return words.map(word => word[0]).join('').slice(0, 5).toUpperCase()
    }
    return trimmed.slice(0, 4).toUpperCase()
}

function getTeamLogo(cards: GroupCard[], teamName: string): string | null {
    for (const card of cards) {
        const team = card.standings.find((s) => s.teamName === teamName)
        if (team?.teamLogoUrl) return team.teamLogoUrl
    }
    return null
}

export default function PoolsOverlayCarousel({
    cards,
    rotationMs = 20000,
    refreshMs = 10000,
    timerSeconds = 0,
    timerStartMs = null,
    timerMode = 'MATCH',
    backgroundImageUrl = null,
    backgroundDim = 0.4,
    sponsors = []
}: Props) {
    const [activeSlide, setActiveSlide] = useState(0)
    const [refreshCycle, setRefreshCycle] = useState(0)
    const [nowMs, setNowMs] = useState(() => Date.now())
    const [fullscreenEvent, setFullscreenEvent] = useState<FullscreenEvent>(null)

    const router = useRouter()
    const prevScoresRef = useRef<Map<string, string>>(new Map())
    const timerEndedRef = useRef(false)
    const timerStartedRef = useRef<number | null>(null)

    useEffect(() => {
        if (!timerStartMs) return
        const interval = window.setInterval(() => setNowMs(Date.now()), 1000)
        return () => window.clearInterval(interval)
    }, [timerStartMs])

    const remainingTimerSeconds = useMemo(() => {
        if (!timerStartMs || timerSeconds <= 0) return null
        const endMs = timerStartMs + (timerSeconds * 1000)
        const diff = Math.ceil((endMs - nowMs) / 1000)
        return diff <= 0 ? 0 : diff
    }, [nowMs, timerStartMs, timerSeconds])

    // Détection Début & Fin du Timer
    useEffect(() => {
        if (timerStartMs && timerSeconds > 0) {
            // Nouveau timer démarré
            if (timerStartedRef.current !== timerStartMs) {
                timerStartedRef.current = timerStartMs
                timerEndedRef.current = false
                setFullscreenEvent({ type: 'TIMER_START', mode: timerMode })
            }
        }

        if (remainingTimerSeconds === 0 && !timerEndedRef.current) {
            timerEndedRef.current = true
            setFullscreenEvent({ type: 'TIMER_END', mode: timerMode })
        }
    }, [remainingTimerSeconds, timerStartMs, timerSeconds, timerMode])

    // Détection des Scores mis à jour
    useEffect(() => {
        const currentScores = new Map<string, string>()
        const updatedMatches: FeaturedMatch[] = []

        cards.forEach((card) => {
            card.featuredMatches.forEach((m) => {
                const key = m.id
                const scoreValue = `${m.homeScore ?? '-'}-${m.awayScore ?? '-'}`
                currentScores.set(key, scoreValue)

                if (prevScoresRef.current.has(key)) {
                    const prevValue = prevScoresRef.current.get(key)
                    if (prevValue !== scoreValue && (m.homeScore !== null || m.awayScore !== null)) {
                        updatedMatches.push(m)
                    }
                }
            })
        })

        if (prevScoresRef.current.size > 0 && updatedMatches.length > 0) {
            setFullscreenEvent({ type: 'SCORE_UPDATE', matches: updatedMatches })
        }

        prevScoresRef.current = currentScores
    }, [cards])

    // Auto-close overlay (6s)
    useEffect(() => {
        if (!fullscreenEvent) return
        const timeout = setTimeout(() => {
            setFullscreenEvent(null)
        }, 6000)
        return () => window.clearInterval(timeout)
    }, [fullscreenEvent])

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
            setRefreshCycle((c) => c + 1)
            startTransition(() => router.refresh())
        }, refreshMs)
        return () => window.clearInterval(interval)
    }, [refreshMs, router])

    const currentSlide = slides[activeSlide] || slides[0]

    const rootStyle = useMemo(() => {
        if (!backgroundImageUrl) return { backgroundColor: '#070a12' }
        return {
            backgroundImage: `radial-gradient(circle at center, rgba(15, 23, 42, ${backgroundDim}) 0%, rgba(7, 10, 18, 0.95) 100%), url(${backgroundImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
        }
    }, [backgroundDim, backgroundImageUrl])

    return (
        <div className="relative h-screen w-screen overflow-hidden bg-[#070a12] p-4 font-sans text-white uppercase italic select-none flex flex-col gap-3" style={rootStyle}>

            {/* OVERLAY PLEIN ÉCRAN ANIMÉ SANS SCROLLBAR */}
            <AnimatePresence>
                {fullscreenEvent && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.05 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => setFullscreenEvent(null)}
                        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-3xl cursor-pointer overflow-hidden p-6"
                    >
                        {/* Animation Lottie de fond */}
                        <div className="absolute inset-0 pointer-events-none opacity-40 flex items-center justify-center">
                            {/* AJOUT FUTUR BG ANIME LOTTIE */}
                        </div>

                        {/* OVERLAY DE DÉBUT DE TIMER */}
                        {fullscreenEvent.type === 'TIMER_START' && (
                            <motion.div
                                initial={{ y: 20 }}
                                animate={{ y: 0 }}
                                className="flex flex-col items-center gap-6 text-center z-10"
                            >
                                <span className="px-6 py-2 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/40 text-[#ccff00] text-sm font-black tracking-widest not-italic shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                                    NOTIFICATION
                                </span>

                                <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-emerald-400 to-[#ccff00] tracking-tighter drop-shadow-[0_10px_35px_rgba(204,255,0,0.5)]">
                                    {fullscreenEvent.mode === 'MATCH' ? 'DÉBUT DES MATCHS !' : 'DÉBUT DE LA PAUSE !'}
                                </h1>

                                <p className="text-slate-300 font-bold text-xl not-italic tracking-wide">
                                    {fullscreenEvent.mode === 'MATCH'
                                        ? 'Les équipes sont priées de se rendre sur leurs terrains respectifs'
                                        : 'Profitez de la pause avant la prochaine session'}
                                </p>
                            </motion.div>
                        )}

                        {/* OVERLAY DE FIN DE TIMER */}
                        {fullscreenEvent.type === 'TIMER_END' && (
                            <motion.div
                                initial={{ y: 20 }}
                                animate={{ y: 0 }}
                                className="flex flex-col items-center gap-6 text-center z-10"
                            >
                                <span className="px-6 py-2 rounded-full bg-rose-500/10 border border-rose-500/40 text-rose-400 text-sm font-black tracking-widest not-italic shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                                    NOTIFICATION
                                </span>

                                <h1 className="text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 tracking-tighter drop-shadow-[0_10px_35px_rgba(244,63,94,0.5)]">
                                    {fullscreenEvent.mode === 'MATCH' ? 'FIN DU TEMPS !' : 'PAUSE TERMINÉE !'}
                                </h1>

                                <p className="text-slate-300 font-bold text-xl not-italic tracking-wide">
                                    Veuillez valider vos feuilles de matchs auprès de la table de marque
                                </p>
                            </motion.div>
                        )}

                        {/* OVERLAY DE SCORE UPDATE */}
                        {fullscreenEvent.type === 'SCORE_UPDATE' && (
                            <motion.div
                                initial={{ y: 20, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                className="flex flex-col items-center gap-3 text-center w-full max-w-6xl z-10 h-full justify-center overflow-hidden"
                            >
                                <div className="flex items-center gap-3 px-5 py-1.5 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/50 shadow-[0_0_25px_rgba(204,255,0,0.25)] shrink-0">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#ccff00] animate-ping" />
                                    <span className="text-[#ccff00] text-xs font-black tracking-widest not-italic">
                                        ÉVOLUTION DES SCORES ({fullscreenEvent.matches.length})
                                    </span>
                                </div>

                                <div className="flex flex-col gap-2 w-full flex-1 justify-center min-h-0 overflow-hidden">
                                    {fullscreenEvent.matches.map((match) => {
                                        const homeLogo = getTeamLogo(cards, match.homeTeamName)
                                        const awayLogo = getTeamLogo(cards, match.awayTeamName)

                                        return (
                                            <div
                                                key={match.id}
                                                className="flex flex-1 max-h-[120px] min-h-[50px] items-center justify-between gap-3 w-full bg-slate-900/90 px-4 py-2 rounded-xl border-2 border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                                            >
                                                <div className="flex items-center justify-end gap-3 flex-1 min-w-0">
                                                    <span className="text-lg md:text-2xl font-black text-white text-right truncate tracking-tight">
                                                        {match.homeTeamName}
                                                    </span>
                                                    {homeLogo ? (
                                                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-white/10 p-1 flex items-center justify-center shrink-0 border border-slate-700 shadow-md backdrop-blur-md">
                                                            <img src={homeLogo} alt={match.homeTeamName} className="h-full w-full object-contain filter drop-shadow-md" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-sm md:text-base font-black text-white shrink-0 shadow-md">
                                                            {initialsFromTeamName(match.homeTeamName)}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="flex flex-col items-center gap-0.5 shrink-0 px-2">
                                                    <span className="text-[9px] text-slate-400 font-extrabold not-italic tracking-wider uppercase">
                                                        {match.pitchName || 'TERRAIN'}
                                                    </span>
                                                    <motion.div
                                                        initial={{ scale: 0.95 }}
                                                        animate={{ scale: 1 }}
                                                        transition={{ type: "spring", stiffness: 300, damping: 15 }}
                                                        className="flex items-center gap-3 bg-slate-950 px-4 py-1.5 rounded-lg border border-[#ccff00]/40 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
                                                    >
                                                        <span className="text-3xl md:text-4xl font-black text-[#ccff00] font-mono leading-none">{match.homeScore ?? 0}</span>
                                                        <span className="text-lg text-slate-600 font-bold leading-none">-</span>
                                                        <span className="text-3xl md:text-4xl font-black text-[#ccff00] font-mono leading-none">{match.awayScore ?? 0}</span>
                                                    </motion.div>
                                                </div>

                                                <div className="flex items-center justify-start gap-3 flex-1 min-w-0">
                                                    {awayLogo ? (
                                                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-lg bg-white/10 p-1 flex items-center justify-center shrink-0 border border-slate-700 shadow-md backdrop-blur-md">
                                                            <img src={awayLogo} alt={match.awayTeamName} className="h-full w-full object-contain filter drop-shadow-md" />
                                                        </div>
                                                    ) : (
                                                        <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-sm md:text-base font-black text-white shrink-0 shadow-md">
                                                            {initialsFromTeamName(match.awayTeamName)}
                                                        </div>
                                                    )}
                                                    <span className="text-lg md:text-2xl font-black text-white text-left truncate tracking-tight">
                                                        {match.awayTeamName}
                                                    </span>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* TOP BAR */}
            <div className="flex h-14 w-full items-center justify-between gap-4 shrink-0 px-2">
                <div className="flex h-full items-center gap-2 overflow-hidden flex-1">
                    {sponsors.slice(0, 6).map((sponsor) => (
                        <div key={sponsor.id} className="flex h-full w-28 items-center justify-center rounded-xl bg-slate-900/80 px-2 border border-slate-800 backdrop-blur-md shadow-lg">
                            <img src={sponsor.logoUrl} alt={sponsor.name} className="max-h-7 max-w-full object-contain filter drop-shadow" />
                        </div>
                    ))}
                </div>

                {timerLabel && (
                    <div className={`flex items-center gap-3 px-5 py-2 rounded-2xl border-2 backdrop-blur-xl shadow-2xl shrink-0 transition-colors duration-500 ${remainingTimerSeconds === 0
                            ? 'bg-rose-950/90 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.4)]'
                            : timerMode === 'BREAK'
                                ? 'bg-amber-950/90 border-amber-500/80 shadow-[0_0_25px_rgba(245,158,11,0.25)]'
                                : 'bg-slate-900/90 border-[#ccff00]/60 shadow-[0_0_25px_rgba(204,255,0,0.2)]'
                        }`}>
                        <div className="flex flex-col text-right">
                            <span className="text-[9px] font-black tracking-widest uppercase not-italic text-slate-400">
                                {timerMode === 'BREAK' ? 'Temps de pause' : 'Session en cours'}
                            </span>
                            <span className={`text-xs font-black tracking-wider ${remainingTimerSeconds === 0 ? 'text-rose-400 animate-pulse' : timerMode === 'BREAK' ? 'text-amber-400' : 'text-[#ccff00]'
                                }`}>
                                {remainingTimerSeconds === 0 ? 'TERMINÉ' : timerMode === 'BREAK' ? 'PAUSE' : 'MATCH'}
                            </span>
                        </div>

                        <div className="h-8 w-px bg-slate-700/80" />

                        <div className="flex items-center gap-2">
                            <span className={`h-3 w-3 rounded-full ${remainingTimerSeconds === 0
                                    ? 'bg-rose-500 animate-ping'
                                    : timerMode === 'BREAK'
                                        ? 'bg-amber-400 animate-pulse'
                                        : 'bg-[#ccff00] animate-pulse shadow-[0_0_8px_#ccff00]'
                                }`} />
                            <h1 className={`text-3xl font-black font-mono tracking-tighter tabular-nums not-italic leading-none ${remainingTimerSeconds === 0 ? 'text-rose-500 animate-pulse' : 'text-white'
                                }`}>
                                {timerLabel}
                            </h1>
                        </div>
                    </div>
                )}
            </div>

            {/* GRID DES POULES */}
            <main className="grid flex-1 grid-cols-2 grid-rows-2 gap-3 h-full min-h-0">
                <AnimatePresence mode="wait">
                    {currentSlide.map((card, idx) => {
                        if (!card) return <div key={`empty-${idx}`} className="rounded-2xl border border-dashed border-slate-800/40 bg-slate-900/10" />

                        return (
                            <motion.article
                                key={card.key}
                                initial={{ opacity: 0, y: 15 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -15 }}
                                transition={{ duration: 0.35, delay: idx * 0.05 }}
                                className="flex flex-col h-full overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/80 backdrop-blur-xl shadow-2xl"
                            >
                                <div className="bg-gradient-to-r from-slate-900 via-slate-900/90 to-slate-950 px-3 py-2 flex justify-between items-center border-b border-slate-800 shrink-0">
                                    <h3 className="text-xs font-black text-[#ccff00] tracking-wider flex items-center gap-2">
                                        <span className="inline-block h-2 w-2 bg-[#ccff00] rounded-full shadow-[0_0_8px_#ccff00]" />
                                        POULE {card.groupIndex}
                                    </h3>

                                    <span className="text-[9px] text-slate-300 not-italic font-extrabold tracking-widest bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/80">
                                        {card.phaseName}
                                    </span>
                                </div>

                                <div className="grid flex-1 grid-cols-[1.4fr_1fr] gap-2 p-2.5 overflow-hidden items-stretch min-h-0">
                                    {/* CLASSEMENT */}
                                    <div className="flex flex-col h-full overflow-hidden">
                                        <table className="w-full h-full text-[11px] border-separate border-spacing-y-1">
                                            <thead>
                                                <tr className="text-slate-400 not-italic font-extrabold text-[9px] uppercase tracking-wider">
                                                    <th className="px-1.5 py-0.5 text-left w-5">#</th>
                                                    <th className="px-1.5 py-0.5 text-left">ÉQUIPE</th>
                                                    <th className="px-1.5 py-0.5 text-center w-8">PTS</th>
                                                    <th className="px-1.5 py-0.5 text-center w-6">J</th>
                                                    <th className="px-1.5 py-0.5 text-center w-8">GD</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {card.standings.slice(0, 5).map((row, i) => {
                                                    const rule = getQualificationRuleForRank(card, i + 1)
                                                    const tone = rule ? getQualificationRuleTone(rule.type) : null
                                                    const gdColor = row.goalDiff > 0 ? 'text-emerald-400 font-extrabold' : row.goalDiff < 0 ? 'text-rose-400 font-extrabold' : 'text-slate-400 font-bold'

                                                    return (
                                                        <tr key={row.teamId} className={`${tone ? tone.row : 'bg-slate-900/60'} rounded border border-slate-800/40`}>
                                                            <td className={`px-1.5 py-0.5 font-black text-[11px] ${tone ? tone.text : 'text-slate-400'}`}>{i + 1}</td>
                                                            <td className="px-1.5 py-0.5 flex items-center gap-2 overflow-hidden">
                                                                {row.teamLogoUrl ? (
                                                                    <div className="h-20 w-20 rounded bg-white/10 p-0.5 flex items-center justify-center shrink-0 border border-slate-700/60 shadow">
                                                                        <img src={row.teamLogoUrl} alt={row.teamName} className="h-full w-full object-contain filter drop-shadow" />
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex h-20 w-20 items-center justify-center rounded bg-slate-800 border border-slate-700 text-[14px] font-black text-white shrink-0 shadow">
                                                                        {initialsFromTeamName(row.teamName)}
                                                                    </div>
                                                                )}
                                                                <span className="font-black text-slate-100 text-[14px] tracking-tight truncate">{row.teamName}</span>
                                                            </td>
                                                            <td className={`px-1.5 py-0.5 text-center font-black text-[14px] ${tone ? tone.text : 'text-white'}`}>{row.points}</td>
                                                            <td className="px-1.5 py-0.5 text-center font-bold text-slate-400 text-[14px]">{row.played}</td>
                                                            <td className={`px-1.5 py-0.5 text-center tabular-nums text-[14px] ${gdColor}`}>{row.goalDiff > 0 ? `+${row.goalDiff}` : row.goalDiff}</td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* MATCHS */}
                                    <div className="flex flex-col gap-1 border-l border-slate-800/80 pl-2.5 h-full justify-between overflow-hidden">
                                        <p className="text-[8px] font-extrabold text-slate-400 tracking-widest not-italic uppercase shrink-0">MATCHS ({card.featuredMatches.length})</p>
                                        <div className="grid grid-cols-1 gap-1 flex-1 min-h-0 overflow-hidden justify-between">
                                            {card.featuredMatches.slice(0, 6).map((match) => {
                                                const isLive = match.status === 'LIVE'
                                                const isFinished = match.status === 'FINISHED'
                                                const isNextMatch = Boolean(match.isActiveSlotLive)

                                                return (
                                                    <div
                                                        key={match.id}
                                                        className={`
                                                            relative flex flex-col justify-center bg-slate-900/80 border-l-2 rounded-r-md px-2 py-1 shadow-sm backdrop-blur-md transition-all
                                                            ${isLive ? 'border-l-emerald-400 bg-emerald-950/20 shadow-[0_0_10px_rgba(52,211,153,0.2)]' : ''}
                                                            ${isFinished ? 'border-l-sky-400' : ''}
                                                            ${isNextMatch ? 'border-l-amber-400 bg-amber-950/20' : ''}
                                                            ${!isLive && !isFinished && !isNextMatch ? 'border-slate-800' : ''}
                                                        `}
                                                    >
                                                        <div className="flex items-center justify-between text-[7.5px] font-bold border-b border-white/5 pb-0.5 mb-0.5">
                                                            <span className="text-slate-400 font-extrabold max-w-[60%] ">
                                                                {match.pitchName || match.phaseName}
                                                            </span>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                <span className={`font-black uppercase tracking-tighter ${isLive ? 'text-emerald-400' : isFinished ? 'text-sky-300' : isNextMatch ? 'text-amber-300' : 'text-slate-400'}`}>
                                                                    {isLive ? 'DIRECT' : isFinished ? 'TERMINE' : isNextMatch ? 'PROCHAIN' : match.timeLabel}
                                                                </span>
                                                                <div className={`w-1.5 h-1.5 rounded-full ${isLive ? 'bg-emerald-400 animate-ping' : isFinished ? 'bg-sky-400' : isNextMatch ? 'bg-amber-400 animate-pulse' : 'bg-[#ccff00]'}`} />
                                                            </div>
                                                        </div>

                                                        <div className="flex flex-col gap-0.5 text-[9px] font-black">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-200  pr-1">{match.homeTeamName}</span>
                                                                <span className={`tabular-nums px-1 rounded text-[8.5px] font-mono ${isLive ? 'text-emerald-300 bg-emerald-950/60' : isFinished ? 'text-sky-300 bg-sky-950/60' : 'text-white bg-black/40'}`}>
                                                                    {match.homeScore ?? '-'}
                                                                </span>
                                                            </div>
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-slate-200  pr-1">{match.awayTeamName}</span>
                                                                <span className={`tabular-nums px-1 rounded text-[8.5px] font-mono ${isLive ? 'text-emerald-300 bg-emerald-950/60' : isFinished ? 'text-sky-300 bg-sky-950/60' : 'text-white bg-black/40'}`}>
                                                                    {match.awayScore ?? '-'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </motion.article>
                        )
                    })}
                </AnimatePresence>
            </main>

            {/* PROGRESS BAR */}
            <div className="h-1.5 w-full rounded-full bg-slate-900/80 overflow-hidden shrink-0 border border-slate-800">
                <motion.div
                    key={`${activeSlide}-${refreshCycle}`}
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: rotationMs / 1000, ease: 'linear' }}
                    className="h-full bg-[#ccff00] shadow-[0_0_12px_rgba(204,255,0,0.8)]"
                />
            </div>
        </div>
    )
}