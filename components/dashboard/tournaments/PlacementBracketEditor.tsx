'use client';

import React, { startTransition, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

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

const MatchBox = ({ players, isFinal, width, scheduledAt, pitchName, isLive, isFinished }: { players: DisplayPlayer[]; isFinal: boolean; width: string; scheduledAt: string | null; pitchName: string | null; isLive?: boolean; isFinished?: boolean }) => {
  const scores = players.map(p => p.score ?? -1);
  const highImg = Math.max(...scores);

  return (
    <div className={`
      relative flex flex-col bg-slate-900/90 border-l-2 rounded-sm overflow-hidden ${width} z-10 backdrop-blur-md transition-all ml-4
      ${isFinal ? 'border-[#ccff00] shadow-[0_0_15px_rgba(204,255,0,0.15)]' : 'border-white/20'}
      ${isLive ? 'border-l-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.3)] animate-pulse' : ''}
      ${isFinished ? 'border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.3)]' : ''}
    `}>

      {/* Header : Heure et Terrain */}
      {(scheduledAt || pitchName) && (
        <div className={`flex items-center justify-between px-1.5 py-0.5 border-b border-white/5 ${isLive ? 'bg-emerald-500/10' : 'bg-white/5'}`}>
          <div className="flex items-center gap-1">
            <div className={`w-1 h-1 rounded-full ${isLive ? 'bg-emerald-400 animate-bounce' : 'bg-[#ccff00]'}`} />
            <span className={`text-[7px] font-black tracking-tighter uppercase ${isLive ? 'text-emerald-400' : 'text-slate-400'}`}>
              {isLive ? 'EN DIRECT' : (scheduledAt && new Date(scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }))}
            </span>
          </div>
          {pitchName && (
            <span className="text-[7px] font-bold text-white/40 uppercase truncate max-w-[40px]">
              {pitchName}
            </span>
          )}
        </div>
      )}

      {/* Liste des joueurs/équipes */}
      <div className="flex flex-col">
        {players.map((p, i) => {
          const isWinner = p.score !== null && p.score === highImg && scores[0] !== scores[1];

          return (
            <div
              key={i}
              className={`flex justify-between items-center px-2 py-1 h-5 transition-colors ${i === 0 ? 'border-b border-white/5' : ''} ${isWinner ? 'bg-[#ccff00]/5' : ''}`}
            >
              <span className={`text-[8px] font-black uppercase italic truncate tracking-tight ${isWinner ? 'text-white' : p.name != 'TBD' ? 'text-slate-300' : 'text-slate-600'}`}>
                {p.name}
              </span>

              <div className="flex items-center gap-1">
                {isWinner && <div className="w-0.5 h-2 bg-[#ccff00]" />}
                <span className={`text-[9px] font-black tabular-nums ${isWinner ? 'text-[#ccff00]' : isLive ? 'text-emerald-400' : 'text-white/90'}`}>
                  {p.score ?? '-'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// COMPOSANT CORRIGÉ : Utilisation native du système Flexbox pour les traits
const BracketRound = ({ round, roundIdx, isLast, matchWidth }: { round: BracketRoundData; roundIdx: number; isLast: boolean; matchWidth: string }) => {
  const matches = round.matches;

  return (
    <div className="flex flex-col flex-1 h-full min-w-0 relative">
      <div className={`text-[7px] font-black text-center mb-2 uppercase tracking-widest opacity-60 ${round.color || 'text-slate-400'}`}>
        {round.title}
      </div>

      <div className="flex flex-col flex-grow relative w-full">
        {matches.map((match, idx) => {
          const isTop = idx % 2 === 0;
          const isOddLast = isTop && idx === matches.length - 1;

          return (
            <div key={match.id} className="relative flex items-center flex-1 w-full">
              
              {/* Connecteur Entrant (Gauche) : Comble le "ml-4" natif de MatchBox */}
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
              />

              {/* Connecteurs Sortants (Droite) */}
              {!isLast && (
                <div className={`relative flex-1 self-stretch min-w-[8px] ${round.color || 'text-white'}`}>
                  {/* Ligne horizontale vers la prochaine étape */}
                  <div className="absolute top-1/2 left-0 w-full h-[1px] -translate-y-1/2 bg-current opacity-50" />

                  {/* Ligne verticale de liaison entre la paire */}
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

const BracketCard = ({ title, rounds, className = '', matchWidth = 'w-[80px]' }: { title?: string; rounds: BracketRoundData[]; className?: string; matchWidth?: string }) => (
  <div className={`flex flex-col bg-white/[0.02] border border-white/5 rounded p-2 overflow-hidden ${className}`}>
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
          />
        ))
      ) : (
        <div className="flex-1 flex items-center justify-center opacity-10 text-[8px] italic uppercase">Non généré</div>
      )}
    </div>
  </div>
);

// --- Main App ---

export default function App({ initialPhaseId = null, phases = [], matches = [], timerSeconds = 0, timerStartMs = null, timerMode = 'MATCH', backgroundImageUrl = null, backgroundDim = 0.55 }: AppProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const router = useRouter();

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

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

  const rootStyle: React.CSSProperties | undefined = backgroundImageUrl
    ? {
      backgroundImage: `linear-gradient(rgba(3, 7, 18, ${backgroundDim}), rgba(3, 7, 18, ${backgroundDim})), url(${backgroundImageUrl})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }
    : undefined;

  return (
    <div className="h-screen w-screen bg-[#030712] text-slate-200 font-sans p-4 flex flex-col overflow-hidden relative" style={rootStyle}>
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-50" />

      <header className="relative z-10 flex items-end justify-between mb-4 pt-4 border-b border-white/10 pb-6">

        {/* LEFT: PHASE INFO */}
        <div className="flex flex-col items-start min-w-[250px]">
          <span className="text-[10px] text-[#ccff00] font-black uppercase tracking-[0.2em] mb-1">
            Tableau Officiel
          </span>
          <h2 className="text-4xl font-black italic text-white leading-none uppercase tracking-tighter">
            {currentPhase?.name || 'Phase de Classement'}
          </h2>
        </div>

        {/* CENTER: MEGA TIMER */}
        {timerLabel && (
          <div className={`flex flex-col items-center gap-2 text-sm font-black tracking-tighter ${remainingTimerSeconds === 0 ? 'text-rose-500 animate-pulse' : 'text-[#ccff00]'}`}>
            <span className="text-[9px] opacity-60 tracking-widest uppercase not-italic">{timerMode === 'BREAK' ? 'Temps de battement' : 'Session en cours'}</span>
            <h1 className="text-5xl font-black tracking-tighter leading-none">{timerLabel}</h1>
          </div>
        )}

        {/* RIGHT: LOGO PULSE */}
        <div className="flex items-center gap-3 min-w-[250px] justify-end">
          <div className="h-[1px] w-8 bg-gradient-to-r from-transparent to-[#ccff00]/30" />
          <h1 className="text-4xl font-black italic tracking-tighter uppercase text-white">
            Pulse<span className="text-[#ccff00]">.</span>
          </h1>
        </div>

      </header>

      <main className="flex-1 flex gap-4 min-h-0 relative z-10 px-2 overflow-hidden">
        {/* WINNER BRACKET */}
        <div className={`${isPlacementBracketPhase ? 'w-[30%]' : 'w-full'} flex flex-col h-full`}>
          <BracketCard
            rounds={winnerData}
            className="h-full border-none bg-transparent"
            matchWidth={isPlacementBracketPhase ? 'w-[120px]' : 'w-[170px]'}
          />
        </div>

        {isPlacementBracketPhase && (
          <div className="flex-1 min-h-0 overflow-hidden">
            {sizedPlacementTrees.length > 0 ? (
              <div className="h-full flex flex-col gap-4">

                {/* SECTION PHASES COURTES */}
                {compactPlacementTrees.length > 0 && (
                  <div className="w-full">
                    <div className="grid grid-cols-6 gap-2 w-full">
                      {compactPlacementTrees.map((tree) => (
                        <BracketCard
                          key={`${tree.start}-${tree.end}`}
                          title={tree.title}
                          rounds={tree.rounds}
                          className="w-full h-[115px] bg-slate-950/40 border-white/5"
                          matchWidth="w-full"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* SECTION GRANDS BRACKETS */}
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
