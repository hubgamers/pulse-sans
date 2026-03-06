'use client';

import { Tournament } from '@/types/Competition';
import { Trophy, Users, Gamepad2 } from 'lucide-react';

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const formatLabels: Record<string, string> = {
    SWISS: '🔷 Suisse',
    DOUBLE_ELIM: '🌳 Double Élim',
    SINGLE_ELIM: '📊 Élimination Simple',
    POULES: '🏆 Poules',
    FFA: '⚔️ FFA',
  };

  const statusLabels: Record<string, string> = {
    open: '🔓 Ouvert',
    live: '🔴 En direct',
    finished: '✅ Terminé',
    setup: '⚙️ Configuration',
  };

  return (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#16213e] hover:border-[#5865F2] transition-colors">
      <div className="bg-gradient-to-r from-[#5865F2] to-[#4752C4] h-2"></div>
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <div>
            <h3 className="text-lg font-semibold text-white">{tournament.name}</h3>
            {tournament.game && (
              <p className="text-sm text-gray-400 mt-1 flex items-center gap-2">
                <Gamepad2 size={14} />
                {tournament.game}
              </p>
            )}
          </div>
          <span className="text-xs px-3 py-1 bg-[#0f3460] rounded-full text-[#5865F2]">
            {statusLabels[tournament.status] || tournament.status}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-400 mb-1">Format</p>
            <p className="font-semibold text-white">{formatLabels[tournament.format_type] || tournament.format_type}</p>
          </div>
          <div>
            <p className="text-gray-400 mb-1 flex items-center gap-1">
              <Users size={14} /> Équipes
            </p>
            <p className="font-semibold text-white">{tournament.nb_teams || 0}</p>
          </div>
        </div>

        {tournament.description && (
          <p className="text-gray-400 text-sm mt-4 pt-4 border-t border-[#16213e]">
            {tournament.description}
          </p>
        )}
      </div>
    </div>
  );
}
