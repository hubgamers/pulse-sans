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

const WINNER_COLORS = ['text-sky-400', 'text-yellow-500', 'text-orange-500', 'text-[#ccff00]'];

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

const MatchBox = ({ players, isFinal, width, scheduledAt, pitchName }: { players: DisplayPlayer[]; isFinal: boolean; width: string; scheduledAt: string | null; pitchName: string | null }) => (
  <div className={`relative flex flex-col bg-slate-950 border ${isFinal ? 'border-yellow-500/50 shadow-[0_0_10px_rgba(234,179,8,0.2)]' : 'border-white/10'} rounded overflow-hidden ${width} z-10`}>
    {(scheduledAt || pitchName) && (
      <div className="px-2 pt-0.5 text-[6px] font-semibold text-teal-400 opacity-80 tracking-wide">
        {scheduledAt && new Date(scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        {pitchName && <span className={scheduledAt ? 'ml-1 opacity-60' : ''}>{scheduledAt ? '· ' : ''}{pitchName}</span>}
      </div>
    )}
    {players.map((p, i) => (
      <div key={i} className={`flex justify-between items-center px-2 py-1 h-4 ${i === 0 ? 'border-b border-white/5' : ''}`}>
        <span className={`text-[7px] font-bold uppercase italic truncate ${p.score !== null ? 'text-white' : 'text-slate-500'}`}>
          {p.name}
        </span>
        <span className="text-[7px] font-black text-yellow-400 ml-1">{p.score ?? ''}</span>
      </div>
    ))}
  </div>
);

const BracketRound = ({ round, roundIdx, isLast, matchWidth }: { round: BracketRoundData; roundIdx: number; isLast: boolean; matchWidth: string }) => {
  const matches = round.matches;

  return (
    <div className="flex flex-col flex-1 h-full min-w-0 relative">
      <div className={`text-[7px] font-black text-center mb-2 uppercase tracking-widest opacity-60 ${round.color || 'text-slate-400'}`}>
        {round.title}
      </div>
      
      <div className="flex flex-col justify-around flex-grow relative">
        {matches.map((match, idx) => {
          const isTop = idx % 2 === 0;
          return (
            <div key={match.id} className="relative flex items-center justify-center w-full py-2">
              {/* Connecteur Entrant (Gauche) */}
              {roundIdx > 0 && (
                <div className="absolute left-0 w-2 h-[1px] bg-white/20 -translate-x-full" />
              )}

              <MatchBox 
                players={match.players} 
                isFinal={isLast && matches.length === 1} 
                width={matchWidth}
                scheduledAt={match.scheduledAt}
                pitchName={match.pitchName}
              />

              {/* Connecteur Sortant (Droite) - Structure en Bracket */}
              {!isLast && (
                <div className="absolute right-0 translate-x-full flex items-center h-full w-2">
                  {/* Branche horizontale sortante */}
                  <div className={`w-full h-[1px] ${round.color ? 'bg-current opacity-50' : 'bg-white/20'}`} />
                  
                  {/* Branche verticale de jonction */}
                  {matches.length > 1 && (
                    <div 
                      className={`absolute right-0 w-[1px] ${round.color ? 'bg-current opacity-50' : 'bg-white/20'}`}
                      style={{
                        height: '100%',
                        top: isTop ? '50%' : 'auto',
                        bottom: !isTop ? '50%' : 'auto'
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
        <div className="h-2.5 w-0.5 bg-yellow-500 shadow-[0_0_5px_rgba(234,179,8,0.5)]"></div>
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

  // Keep the editor scoped to the current phase to avoid mixing trees across phases.
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
      {/* Background FX */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,_#1e293b_0%,_transparent_70%)] pointer-events-none opacity-50" />
      
      <header className="relative z-10 flex flex-col items-center mb-6">
        <div className="flex items-center gap-4">
          <div className="h-[1px] w-12 bg-gradient-to-r from-transparent to-yellow-500/50" />
          <h1 className="text-5xl font-black italic tracking-tighter uppercase text-white">
            Pulse<span className="text-yellow-500">.</span>
          </h1>
          <div className="h-[1px] w-12 bg-gradient-to-l from-transparent to-yellow-500/50" />
        </div>
        <div className="text-[8px] tracking-[0.6em] text-slate-500 font-bold uppercase mt-1">
          Tournament Management System — <span className="text-yellow-500/80">Premium Edition</span>
        </div>
      </header>

      <main className="flex-1 flex gap-4 min-h-0 relative z-10 px-2 overflow-hidden">
        {/* WINNER BRACKET (Large) */}
        <div className="w-[30%] flex flex-col h-full">
          <BracketCard rounds={winnerData} className="h-full border-none bg-transparent" matchWidth="w-[100px]" />
        </div>

        {isPlacementBracketPhase ? (
          <div className="flex-1 min-h-0 overflow-hidden">
            {sizedPlacementTrees.length > 0 ? (
              <div className="h-full flex flex-col gap-3">
                {compactPlacementTrees.length > 0 && (
                  <div className="rounded border border-white/10 bg-white/[0.015] p-2">
                    <div className="text-[8px] font-black uppercase tracking-widest text-white/60 mb-2">
                      Phases courtes
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {compactPlacementTrees.map((tree) => (
                        <BracketCard
                          key={`${tree.start}-${tree.end}`}
                          title={tree.title}
                          rounds={tree.rounds}
                          className="w-[180px] h-[108px]"
                          matchWidth="w-[64px]"
                        />
                      ))}
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
                          className={tree.totalMatches >= 4 ? 'min-h-[170px]' : 'min-h-[140px]'}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center opacity-40 text-[10px] font-bold uppercase tracking-widest">
                      Aucun grand bracket de placement
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
        ) : (
          <div className="flex-1 flex flex-col gap-4">
            {placementTrees.map((tree) => (
              <BracketCard
                key={`${tree.start}-${tree.end}`}
                title={tree.title}
                rounds={tree.rounds}
                className="flex-1"
              />
            ))}
          </div>
        )}
      </main>

      <footer className="mt-6 flex justify-between items-end relative z-10 border-t border-white/5 pt-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className={`text-[8px] font-mono uppercase ${remainingTimerSeconds === 0 ? 'text-rose-400' : 'text-slate-500'}`}>
              {timerLabel
                ? `${timerMode === 'BREAK' ? 'Temps de battement' : 'Fin de session'} ${timerLabel}`
                : 'Status: Live'}
            </span>
          </div>
        </div>
        
        <div className="flex flex-col items-end">
          <span className="text-[8px] text-yellow-500 font-black uppercase tracking-widest mb-1">Tableau Officiel</span>
          <h2 className="text-4xl font-black italic text-white leading-none uppercase tracking-tighter">
            {currentPhase?.name || 'Phase de Classement'}
          </h2>
        </div>
      </footer>
    </div>
  );
}