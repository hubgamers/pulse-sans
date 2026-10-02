'use client';

import React, { startTransition, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

// --- Types ---
type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED' | 'CANCELLED';

type PlacementPhase = {
  id: string;
  name: string;
  type: string;
  order: number;
};

type PlacementMatch = {
  id: string;
  phaseId: string;
  roundNumber: number | null;
  bracketPos: string | null;
  scheduledAt: string | null;
  pitchName: string | null;
  status: MatchStatus;
  homeTeamId: string | null;
  homeTeamName: string;
  awayTeamId: string | null;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
};

type DisplayPlayer = {
  name: string;
  score: number | null;
};

type DisplayMatch = {
  id: string;
  players: DisplayPlayer[];
  info: string;
  isLive?: boolean;
  isFinished?: boolean;
  scheduledAt: string | null;
  pitchName: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeScore: number | null;
  awayScore: number | null;
};

type BracketRoundData = {
  title: string;
  matches: DisplayMatch[];
  color?: string;
};

type PlacementTree = {
  title: string;
  start: number;
  end: number;
  rounds: BracketRoundData[];
};

type PlacementTreeWithSize = PlacementTree & {
  totalMatches: number;
  isCompact: boolean;
};

type FullscreenEvent =
  | { type: 'TIMER_START'; mode: 'MATCH' | 'BREAK' }
  | { type: 'TIMER_END'; mode: 'MATCH' | 'BREAK' }
  | { type: 'SCORE_UPDATE'; matches: DisplayMatch[] }
  | null;

type AppProps = {
  orgSlug?: string;
  tournamentSlug?: string;
  tournamentId?: string;
  initialPhaseId?: string | null;
  phases?: PlacementPhase[];
  matches?: PlacementMatch[];
  timerSeconds?: number;
  timerStartMs?: number | null;
  timerMode?: 'MATCH' | 'BREAK';
  backgroundImageUrl?: string | null;
  backgroundDim?: number;
};

// Utilisation de la couleur personnalisée pour les gagnants
const WINNER_COLORS = ['text-sky-400', 'text-orange-500', 'text-[#ccff00]', 'text-[#ccff00]'];

function formatRemainingTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function initialsFromTeamName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 10) return trimmed.toUpperCase();
  const words = trimmed.split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) {
    return words.map(word => word[0]).join('').slice(0, 5).toUpperCase();
  }
  return trimmed.slice(0, 4).toUpperCase();
}

// --- Logic Helpers ---

function parseWinnerMatch(match: PlacementMatch): { round: number; matchNo: number } | null {
  const parsed = match.bracketPos?.match(/^WB-R(\d+)-M(\d+)$/);
  if (!parsed) return null;
  return { round: match.roundNumber ?? Number(parsed[1]), matchNo: Number(parsed[2]) };
}

function parsePlacementMatch(match: PlacementMatch): { start: number; end: number; round: number; matchNo: number } | null {
  const parsed = match.bracketPos?.match(/^P(\d+)-(\d+)-R(\d+)-M(\d+)$/);
  if (!parsed) return null;
  return { start: Number(parsed[1]), end: Number(parsed[2]), round: Number(parsed[3]), matchNo: Number(parsed[4]) };
}

function toDisplayMatch(match: PlacementMatch): DisplayMatch {
  return {
    id: match.id,
    scheduledAt: match.scheduledAt ?? null,
    pitchName: match.pitchName ?? null,
    homeTeamName: match.homeTeamName || 'À DÉFINIR',
    awayTeamName: match.awayTeamName || 'À DÉFINIR',
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    players: [
      { name: match.homeTeamName || 'À DÉFINIR', score: match.homeScore },
      { name: match.awayTeamName || 'À DÉFINIR', score: match.awayScore },
    ],
    info: `M${match.bracketPos?.split('-M')[1] || ''}`,
    isLive: match.status === 'LIVE',
    isFinished: match.status === 'FINISHED',
  };
}

function buildWinnerTitle(roundIndex: number, totalRounds: number): string {
  if (roundIndex === totalRounds - 1) return 'FINALE';
  const denominator = 2 ** (totalRounds - roundIndex - 1);
  return `1/${denominator}`;
}

function buildWinnerData(matches: PlacementMatch[]): BracketRoundData[] {
  const grouped = new Map<number, { matchNo: number; match: PlacementMatch }[]>();
  matches.forEach((m) => {
    const p = parseWinnerMatch(m);
    if (!p) return;
    if (!grouped.has(p.round)) grouped.set(p.round, []);
    const roundMatches = grouped.get(p.round);
    if (!roundMatches) return;
    roundMatches.push({ matchNo: p.matchNo, match: m });
  });
  const sortedRounds = Array.from(grouped.entries()).sort((a, b) => a[0] - b[0]);
  return sortedRounds.map(([round, items], index) => ({
    title: buildWinnerTitle(index, sortedRounds.length),
    color: WINNER_COLORS[index] || 'text-white',
    matches: items.sort((a, b) => a.matchNo - b.matchNo).map((i) => toDisplayMatch(i.match)),
  }));
}

function buildPlacementTrees(matches: PlacementMatch[]): PlacementTree[] {
  const ranges = new Set<string>();
  matches.forEach((m) => {
    const p = parsePlacementMatch(m);
    if (p) ranges.add(`${p.start}-${p.end}`);
  });

  return Array.from(ranges).map((rangeKey) => {
    const [start, end] = rangeKey.split('-').map(Number);
    const roundsMap = new Map<number, { matchNo: number; match: PlacementMatch }[]>();
    matches.forEach((m) => {
      const p = parsePlacementMatch(m);
      if (p && p.start === start && p.end === end) {
        if (!roundsMap.has(p.round)) roundsMap.set(p.round, []);
        const placementRoundMatches = roundsMap.get(p.round);
        if (!placementRoundMatches) return;
        placementRoundMatches.push({ matchNo: p.matchNo, match: m });
      }
    });
    const sortedRounds = Array.from(roundsMap.entries()).sort((a, b) => a[0] - b[0]);
    return {
      title: start === end ? `PLACE ${start}` : `PLACES ${start}-${end}`,
      start, end,
      rounds: sortedRounds.map(([r, items], idx) => ({
        title: idx === sortedRounds.length - 1 ? (start === end - 1 ? `FINALE` : `R${idx + 1}`) : `R${idx + 1}`,
        matches: items.sort((a, b) => a.matchNo - b.matchNo).map((i) => toDisplayMatch(i.match)),
      }))
    };
  }).sort((a, b) => a.start - b.start);
}

function countTreeMatches(tree: PlacementTree): number {
  return tree.rounds.reduce((total, round) => total + round.matches.length, 0);
}

// --- UI Components ---

const MatchBox = ({ players, isFinal, width, scheduledAt, pitchName, isLive, isFinished, isNextMatch }: { players: DisplayPlayer[]; isFinal: boolean; width: string; scheduledAt: string | null; pitchName: string | null; isLive?: boolean; isFinished?: boolean; isNextMatch?: boolean; }) => {
  const scores = players.map(p => p.score ?? -1);
  const highImg = Math.max(...scores);

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.25 }}
      className={`
        relative flex flex-col bg-slate-900/95 border-l-2 rounded-sm overflow-hidden ${width} z-10 backdrop-blur-md transition-all ml-4 shadow-lg
        ${isFinal ? 'border-[#ccff00] shadow-[0_0_15px_rgba(204,255,0,0.2)]' : 'border-slate-700'}
        ${isLive ? 'border-l-emerald-400 bg-slate-900/95 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : ''}
        ${isFinished ? 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]' : ''}
        ${isNextMatch ? 'border-l-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.3)]' : ''}
      `}
    >
      {/* Header : Piste à gauche, Heure/Statut à droite */}
      {(scheduledAt || pitchName) && (
        <div className={`
          flex flex-col items-center justify-between px-1.5 py-1 border-b border-white/10
          ${isLive
            ? 'bg-emerald-500/20'
            : isNextMatch
              ? 'bg-amber-500/20'
              : 'bg-slate-800/80'}
        `}>
          {pitchName ? (
            <span className="text-[10px] font-black text-white uppercase tracking-wider bg-black/60 px-1.5 py-0.5 rounded mb-0.5 shadow-sm">
              {pitchName}
            </span>
          ) : <span />}

          <div className="flex items-center gap-1.5">
            <span className={`
              text-[10px] font-black tracking-tighter uppercase
              ${isLive
                ? 'text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                : isNextMatch
                  ? 'text-amber-300 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                  : 'text-slate-200'}
            `}>
              {isLive
                ? 'EN DIRECT'
                : isNextMatch
                  ? 'PROCHAIN'
                  : (scheduledAt &&
                    new Date(scheduledAt).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: 'Europe/Paris'
                    }))
              }
            </span>

            <span className={`
              w-1.5 h-1.5 rounded-full shadow-sm
              ${isLive
                ? 'bg-emerald-400 animate-ping'
                : isNextMatch
                  ? 'bg-amber-400 animate-pulse'
                  : 'bg-[#ccff00]'}
            `} />
          </div>
        </div>
      )}

      {/* Liste des joueurs/équipes */}
      <div className="flex flex-col">
        {players.map((p, i) => {
          const isWinner = p.score !== null && p.score === highImg && scores[0] !== scores[1];

          return (
            <div
              key={i}
              className={`flex min-h-6 justify-between items-center gap-1 px-2 py-1.5 transition-colors ${i === 0 ? 'border-b border-white/10' : ''} ${isWinner ? 'bg-[#ccff00]/15' : 'bg-slate-900/60'}`}
            >
              <span className={`min-w-0 flex-1 text-[clamp(0.45rem,0.65vw,0.5625rem)] leading-tight font-black uppercase italic wrap-break-word tracking-tight ${isWinner ? 'text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.9)] font-extrabold' : p.name !== 'TBD' ? 'text-slate-200' : 'text-slate-500'}`}>
                {p.name}
              </span>

              <div className="flex items-center gap-1">
                {isWinner && (
                  <motion.div 
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    className="w-1 h-3 bg-[#ccff00] shadow-[0_0_5px_rgba(204,255,0,0.8)]" 
                  />
                )}

                <AnimatePresence mode="popLayout">
                  <motion.span 
                    key={p.score ?? 'none'}
                    initial={{ scale: 1.4, color: '#ccff00' }}
                    animate={{ scale: 1, color: isWinner ? '#ccff00' : isLive ? '#6ee7b7' : '#ffffff' }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    className={`text-[11px] font-black tabular-nums px-1 rounded ${isWinner ? 'bg-black/40' : ''}`}
                  >
                    {p.score ?? '-'}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};

const BracketRound = ({ round, roundIdx, isLast, matchWidth, upcomingMatchIds }: { round: BracketRoundData; roundIdx: number; isLast: boolean; matchWidth: string; upcomingMatchIds: Set<string>; }) => {
  const matches = round.matches;

  return (
    <div className="flex flex-col flex-1 h-full min-w-0 relative">
      <div className={`text-[7px] font-black text-center mb-2 uppercase tracking-widest opacity-60 ${round.color || 'text-slate-400'}`}>
        {round.title}
      </div>

      <div className="flex flex-col flex-grow relative w-full">
        {matches.map((match, idx) => {
          const isNextMatch = upcomingMatchIds.has(match.id);
          const isTop = idx % 2 === 0;
          const isOddLast = isTop && idx === matches.length - 1;

          return (
            <div key={match.id} className="relative flex items-center flex-1 w-full">
              {roundIdx > 0 && (
                <div className="absolute left-0 top-1/2 w-4 h-[1px] -translate-y-1/2 bg-white/20" />
              )}

              <MatchBox
                players={match.players}
                isFinal={isLast && matches.length === 1}
                width={matchWidth}
                scheduledAt={match.scheduledAt}
                pitchName={match.pitchName}
                isLive={match.isLive}
                isFinished={match.isFinished}
                isNextMatch={isNextMatch}
              />

              {!isLast && (
                <div className={`relative flex-1 self-stretch min-w-[8px] ${round.color || 'text-white'}`}>
                  <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2 bg-current opacity-50" />
                  {!isOddLast && matches.length > 1 && (
                    <div
                      className="absolute right-0 w-[1px] bg-current opacity-50"
                      style={{
                        top: isTop ? '50%' : '0',
                        bottom: isTop ? '0' : '50%'
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const BracketCard = ({ title, rounds, className = '', matchWidth = 'w-[80px]', upcomingMatchIds }: { title?: string; rounds: BracketRoundData[]; className?: string; matchWidth?: string; upcomingMatchIds: Set<string>; }) => (
  <motion.div 
    layout
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
    className={`flex flex-col bg-white/[0.02] border border-white/5 rounded p-2 overflow-hidden ${className}`}
  >
    {title && (
      <div className="flex items-center gap-2 mb-2">
        <div className="h-2.5 w-0.5 bg-[#ccff00] shadow-[0_0_5px_rgba(204,255,0,0.5)]"></div>
        <h3 className="text-[8px] font-black text-white/80 uppercase italic tracking-wider">{title}</h3>
      </div>
    )}
    <div className="flex flex-1 h-full">
      {rounds.length > 0 ? (
        rounds.map((r, i) => (
          <BracketRound
            key={i}
            round={r}
            roundIdx={i}
            isLast={i === rounds.length - 1}
            matchWidth={matchWidth}
            upcomingMatchIds={upcomingMatchIds}
          />
        ))
      ) : (
        <div className="flex-1 flex items-center justify-center opacity-10 text-[8px] italic uppercase">Non généré</div>
      )}
    </div>
  </motion.div>
);

// --- Main App ---

export default function App({ initialPhaseId = null, phases = [], matches = [], timerSeconds = 0, timerStartMs = null, timerMode = 'MATCH', backgroundImageUrl = null, backgroundDim = 0.55 }: AppProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [fullscreenEvent, setFullscreenEvent] = useState<FullscreenEvent>(null);

  const router = useRouter();
  const prevScoresRef = useRef<Map<string, string>>(new Map());
  const timerEndedRef = useRef(false);
  const timerStartedRef = useRef<number | null>(null);

  useEffect(() => {
    if (!timerStartMs) return;
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [timerStartMs]);

  useEffect(() => {
    const refreshId = window.setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      startTransition(() => {
        router.refresh();
      });
    }, 10000);

    return () => {
      window.clearInterval(refreshId);
    };
  }, [router]);

  const remainingTimerSeconds = useMemo(() => {
    if (!timerStartMs || timerSeconds <= 0) return null;
    const endMs = timerStartMs + (timerSeconds * 1000);
    const diff = Math.ceil((endMs - nowMs) / 1000);
    return diff <= 0 ? 0 : diff;
  }, [nowMs, timerStartMs, timerSeconds]);

  // Détection Début & Fin du Timer
  useEffect(() => {
    if (timerStartMs && timerSeconds > 0) {
      if (timerStartedRef.current !== timerStartMs) {
        timerStartedRef.current = timerStartMs;
        timerEndedRef.current = false;
        setFullscreenEvent({ type: 'TIMER_START', mode: timerMode });
      }
    }

    if (remainingTimerSeconds === 0 && !timerEndedRef.current) {
      timerEndedRef.current = true;
      setFullscreenEvent({ type: 'TIMER_END', mode: timerMode });
    }
  }, [remainingTimerSeconds, timerStartMs, timerSeconds, timerMode]);

  // Détection des Scores mis à jour
  useEffect(() => {
    const currentScores = new Map<string, string>();
    const updatedMatches: DisplayMatch[] = [];

    matches.forEach((m) => {
      const key = m.id;
      const scoreValue = `${m.homeScore ?? '-'}-${m.awayScore ?? '-'}`;
      currentScores.set(key, scoreValue);

      if (prevScoresRef.current.has(key)) {
        const prevValue = prevScoresRef.current.get(key);
        if (prevValue !== scoreValue && (m.homeScore !== null || m.awayScore !== null)) {
          updatedMatches.push(toDisplayMatch(m));
        }
      }
    });

    if (prevScoresRef.current.size > 0 && updatedMatches.length > 0) {
      setFullscreenEvent({ type: 'SCORE_UPDATE', matches: updatedMatches });
    }

    prevScoresRef.current = currentScores;
  }, [matches]);

  // Auto-close overlay (6s)
  useEffect(() => {
    if (!fullscreenEvent) return;
    const timeout = setTimeout(() => {
      setFullscreenEvent(null);
    }, 4000);
    return () => window.clearTimeout(timeout);
  }, [fullscreenEvent]);

  const timerLabel = useMemo(() => {
    if (remainingTimerSeconds === null) return null;
    return formatRemainingTime(remainingTimerSeconds);
  }, [remainingTimerSeconds]);

  const sortedPhases = [...phases].sort((a, b) => a.order - b.order);
  const currentPhase = sortedPhases.find((phase) => phase.id === initialPhaseId) ?? sortedPhases[0];
  const isPlacementBracketPhase = currentPhase?.type === 'PLACEMENT_BRACKET';

  const phaseMatches = currentPhase
    ? matches.filter(match => match.phaseId === currentPhase.id)
    : matches;

  const upcomingMatchIds = useMemo(() => {
    const getTime = (date: string | null) =>
      date ? new Date(date).getTime() : null;

    const liveMatches = phaseMatches.filter(
      (m) => m.status === 'LIVE' && m.scheduledAt
    );

    const finishedMatches = phaseMatches
      .filter((m) => m.status === 'FINISHED' && m.scheduledAt)
      .sort(
        (a, b) =>
          getTime(b.scheduledAt)! - getTime(a.scheduledAt)!
      );

    const referenceScheduledAt =
      liveMatches.length > 0
        ? getTime(liveMatches[0].scheduledAt)
        : finishedMatches.length > 0
          ? getTime(finishedMatches[0].scheduledAt)
          : null;

    if (referenceScheduledAt === null) {
      return new Set<string>();
    }

    const waitingMatches = phaseMatches
      .filter(
        (m) =>
          m.status === 'SCHEDULED' &&
          m.scheduledAt &&
          getTime(m.scheduledAt)! > referenceScheduledAt
      )
      .sort(
        (a, b) =>
          getTime(a.scheduledAt)! - getTime(b.scheduledAt)!
      );

    const nextScheduledAt = waitingMatches[0]?.scheduledAt;

    return new Set(
      waitingMatches
        .filter(
          (m) =>
            getTime(m.scheduledAt) === getTime(nextScheduledAt ?? null)
        )
        .map((m) => m.id)
    );
  }, [phaseMatches]);

  const winnerData = buildWinnerData(phaseMatches);
  const placementTrees = buildPlacementTrees(phaseMatches);
  const sizedPlacementTrees: PlacementTreeWithSize[] = placementTrees
    .map((tree) => {
      const totalMatches = countTreeMatches(tree);
      return {
        ...tree,
        totalMatches,
        isCompact: totalMatches <= 1,
      };
    })
    .sort((a, b) => b.totalMatches - a.totalMatches || a.start - b.start);

  const compactPlacementTrees = sizedPlacementTrees.filter((tree) => tree.isCompact);
  const mainPlacementTrees = sizedPlacementTrees.filter((tree) => !tree.isCompact);

  const compactCount = compactPlacementTrees.length;
  const gridColsClass = compactCount <= 5 ? `grid-cols-${compactCount + 1}` : 'grid-cols-6';

  const rootStyle: React.CSSProperties | undefined = backgroundImageUrl
    ? {
      backgroundImage: `linear-gradient(rgba(3, 7, 18, ${backgroundDim}), rgba(3, 7, 18, ${backgroundDim})), url(${backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
    : undefined;

  return (
    <div className="h-screen w-screen bg-[#030712] text-slate-200 font-sans p-4 flex flex-col overflow-hidden relative uppercase italic select-none" style={rootStyle}>
      
      {/* OVERLAY PLEIN ÉCRAN ANIMÉ SANS SCROLLBAR */}
      <AnimatePresence>
        {fullscreenEvent && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            onClick={() => setFullscreenEvent(null)}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/95 backdrop-blur-3xl cursor-pointer overflow-hidden p-[clamp(0.75rem,3vw,1.5rem)]"
          >
            {/* OVERLAY DE DÉBUT DE TIMER */}
            {fullscreenEvent.type === 'TIMER_START' && (
              <motion.div
                initial={{ y: 20 }}
                animate={{ y: 0 }}
                className="flex max-w-[95vw] flex-col items-center gap-[clamp(0.75rem,3vh,1.5rem)] text-center z-10"
              >
                <span className="px-[clamp(0.75rem,2vw,1.5rem)] py-[clamp(0.375rem,1vh,0.5rem)] rounded-full bg-[#ccff00]/10 border border-[#ccff00]/40 text-[#ccff00] text-[clamp(0.65rem,1.2vw,0.875rem)] font-black tracking-widest not-italic shadow-[0_0_20px_rgba(204,255,0,0.3)]">
                  NOTIFICATION
                </span>

                <h1 className="max-w-full px-4 text-[clamp(2rem,8vw,6rem)] leading-tight wrap-break-word font-black text-transparent bg-clip-text bg-gradient-to-r from-[#ccff00] via-emerald-400 to-[#ccff00] tracking-tighter drop-shadow-[0_10px_35px_rgba(204,255,0,0.5)]">
                  {fullscreenEvent.mode === 'MATCH' ? 'DÉBUT DES MATCHS !' : 'DÉBUT DE LA PAUSE !'}
                </h1>

                <p className="max-w-[90vw] text-[clamp(0.875rem,2vw,1.25rem)] leading-snug text-slate-300 font-bold not-italic tracking-wide">
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
                className="flex max-w-[95vw] flex-col items-center gap-[clamp(0.75rem,3vh,1.5rem)] text-center z-10"
              >
                <span className="px-[clamp(0.75rem,2vw,1.5rem)] py-[clamp(0.375rem,1vh,0.5rem)] rounded-full bg-rose-500/10 border border-rose-500/40 text-rose-400 text-[clamp(0.65rem,1.2vw,0.875rem)] font-black tracking-widest not-italic shadow-[0_0_20px_rgba(244,63,94,0.3)]">
                  NOTIFICATION
                </span>

                <h1 className="max-w-full px-4 text-[clamp(2rem,8vw,6rem)] leading-tight wrap-break-word font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-amber-400 to-rose-500 tracking-tighter drop-shadow-[0_10px_35px_rgba(244,63,94,0.5)]">
                  {fullscreenEvent.mode === 'MATCH' ? 'FIN DU TEMPS' : 'PAUSE TERMINÉE'}
                </h1>

                <p className="max-w-[90vw] text-[clamp(0.875rem,2vw,1.25rem)] leading-snug text-slate-300 font-bold not-italic tracking-wide">
                  Veuillez valider vos feuilles de matchs auprès de la table de marque
                </p>
              </motion.div>
            )}

            {/* OVERLAY DE SCORE UPDATE */}
            {fullscreenEvent.type === 'SCORE_UPDATE' && (
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="flex flex-col items-center gap-[clamp(0.5rem,1.5vh,0.75rem)] text-center w-full max-w-6xl z-10 h-full justify-center overflow-hidden"
              >
                <div className="flex items-center gap-2 px-[clamp(0.75rem,2vw,1.25rem)] py-1.5 rounded-full bg-[#ccff00]/10 border border-[#ccff00]/50 shadow-[0_0_25px_rgba(204,255,0,0.25)] shrink-0">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ccff00] animate-ping" />
                  <span className="text-[#ccff00] text-[clamp(0.6rem,1vw,0.75rem)] font-black tracking-widest not-italic">
                    ÉVOLUTION DES SCORES ({fullscreenEvent.matches.length})
                  </span>
                </div>

                <div className="flex flex-col gap-2 w-full flex-1 justify-center min-h-0 overflow-hidden">
                  {fullscreenEvent.matches.map((match) => (
                    <div
                      key={match.id}
                      className="flex flex-1 max-h-[clamp(3.125rem,12vh,7.5rem)] min-h-[clamp(2.5rem,7vh,3.125rem)] items-center justify-between gap-[clamp(0.375rem,1vw,0.75rem)] w-full bg-slate-900/90 px-[clamp(0.5rem,1.5vw,1rem)] py-[clamp(0.25rem,0.8vh,0.5rem)] rounded-xl border-2 border-slate-700/80 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-2xl"
                    >
                      <div className="flex items-center justify-end gap-[clamp(0.375rem,1vw,0.75rem)] flex-1 min-w-0">
                        <span className="min-w-0 text-[clamp(0.75rem,2vw,1.5rem)] leading-tight wrap-break-word font-black text-white text-right tracking-tight">
                          {match.homeTeamName}
                        </span>
                        <div className="flex h-[clamp(1.75rem,6vh,3rem)] w-[clamp(1.75rem,6vh,3rem)] items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-[clamp(0.7rem,1vw,1rem)] font-black text-white shrink-0 shadow-md">
                          {initialsFromTeamName(match.homeTeamName)}
                        </div>
                      </div>

                      <div className="flex flex-col items-center gap-0.5 shrink-0 px-2">
                        <span className="text-[clamp(0.5rem,0.65vw,0.5625rem)] text-slate-400 font-extrabold not-italic tracking-wider uppercase">
                          {match.pitchName || 'TERRAIN'}
                        </span>
                        <motion.div
                          initial={{ scale: 0.95 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 300, damping: 15 }}
                          className="flex items-center gap-[clamp(0.375rem,1vw,0.75rem)] bg-slate-950 px-[clamp(0.5rem,1vw,1rem)] py-1.5 rounded-lg border border-[#ccff00]/40 shadow-[0_0_20px_rgba(204,255,0,0.2)]"
                        >
                          <span className="text-[clamp(1.25rem,4vw,2.25rem)] font-black text-[#ccff00] font-mono leading-none">{match.homeScore ?? 0}</span>
                          <span className="text-[clamp(0.75rem,1.5vw,1.125rem)] text-slate-600 font-bold leading-none">-</span>
                          <span className="text-[clamp(1.25rem,4vw,2.25rem)] font-black text-[#ccff00] font-mono leading-none">{match.awayScore ?? 0}</span>
                        </motion.div>
                      </div>

                      <div className="flex items-center justify-start gap-[clamp(0.375rem,1vw,0.75rem)] flex-1 min-w-0">
                        <div className="flex h-[clamp(1.75rem,6vh,3rem)] w-[clamp(1.75rem,6vh,3rem)] items-center justify-center rounded-lg bg-slate-800 border border-slate-700 text-[clamp(0.7rem,1vw,1rem)] font-black text-white shrink-0 shadow-md">
                          {initialsFromTeamName(match.awayTeamName)}
                        </div>
                        <span className="min-w-0 text-[clamp(0.75rem,2vw,1.5rem)] leading-tight wrap-break-word font-black text-white text-left tracking-tight">
                          {match.awayTeamName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-50" />

      <main className="flex-1 flex gap-4 min-h-0 relative z-10 px-2 overflow-hidden">

        {/* COLONNE DE GAUCHE : Winner Bracket */}
        <div className={`${isPlacementBracketPhase ? 'w-[32%]' : 'w-full'} flex flex-col h-full gap-3`}>
          <div className="flex-1 min-h-0">
            <BracketCard
              rounds={winnerData}
              className="h-full border-none bg-transparent"
              matchWidth={isPlacementBracketPhase ? 'w-[120px]' : 'w-[170px]'}
              upcomingMatchIds={upcomingMatchIds}
            />
          </div>
        </div>

        {/* COLONNE DE DROITE : Brackets de placement & Timer intégré */}
        {isPlacementBracketPhase && (
          <div className="flex-1 min-h-0 overflow-hidden">
            {sizedPlacementTrees.length > 0 ? (
              <div className="h-full flex flex-col gap-4">
                {compactPlacementTrees.length > 0 && (
                  <div className="w-full">
                    <div className={`grid ${gridColsClass} gap-2 w-full items-center`}>
                      {compactPlacementTrees.map((tree) => (
                        <BracketCard
                          key={`${tree.start}-${tree.end}`}
                          title={tree.title}
                          rounds={tree.rounds}
                          className="w-full h-[160px] bg-slate-950/40 border-white/5"
                          matchWidth="w-full"
                          upcomingMatchIds={upcomingMatchIds}
                        />
                      ))}
                      
                      {/* ENCADRE INFOS & TIMER ANIMÉ */}
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="h-[160px] flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded px-4 h-[115px] shrink-0"
                      >
                        <div className="flex flex-col items-start mb-1">
                          <h2 className="text-xl font-black italic text-white leading-none uppercase tracking-tighter">
                            {currentPhase?.name || 'Phase de Classement'}
                          </h2>
                        </div>

                        {timerLabel && (
                          <div className={`flex flex-col justify-center items-center gap-0.5 font-black tracking-tighter ${remainingTimerSeconds === 0 ? 'text-rose-500 animate-pulse' : 'text-[#ccff00]'}`}>
                            <span className="text-[8px] opacity-60 tracking-widest uppercase not-italic">
                              {timerMode === 'BREAK' ? 'Temps de battement' : 'Session'}
                            </span>
                              <span className='text-[50px]'>{timerLabel}</span>
                          </div>
                        )}
                      </motion.div>
                    </div>
                  </div>
                )}

                <div className="flex-1 min-h-0">
                  {mainPlacementTrees.length > 0 ? (
                    <div className="h-full grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3 auto-rows-fr">
                      {mainPlacementTrees.map((tree) => (
                        <BracketCard
                          key={`${tree.start}-${tree.end}`}
                          title={tree.title}
                          rounds={tree.rounds}
                          className={`bg-slate-900/20 border-white/5 ${tree.totalMatches >= 4 ? 'h-full' : 'min-h-[140px]'}`}
                          matchWidth="w-[100px]"
                          upcomingMatchIds={upcomingMatchIds}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center border border-dashed border-white/5 rounded-lg opacity-20 text-[10px] font-bold uppercase tracking-widest">
                      Aucun bracket de placement étendu
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center opacity-40 text-[10px] font-bold uppercase tracking-widest">
                Aucun bracket de placement généré
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}