import { Database } from './schema';

// Enums pour la logique métier
export type TournamentFormat = 'SWISS' | 'DOUBLE_ELIM' | 'SINGLE_ELIM' | 'POULES' | 'FFA';
export type TournamentStatus = 'open' | 'live' | 'finished' | 'setup';

// --- TEAMS ---
export type Team = Database['public']['Tables']['teams']['Row'];

// --- TOURNAMENTS ---
export type TournamentRow = Database['public']['Tables']['tournaments']['Row'];

export interface Tournament extends Omit<TournamentRow, 'format_type' | 'status' | 'format_settings'> {
  format_type: TournamentFormat;
  status: TournamentStatus;
  format_settings: {
    points_per_win?: number;
    points_per_draw?: number;
    has_loser_bracket?: boolean;
    nb_qualified_per_group?: number;
    seed_type?: 'random' | 'skill_based';
    [key: string]: any; 
  };
}

// --- MATCHES ---
export type MatchRow = Database['public']['Tables']['matches']['Row'];

export interface Match extends MatchRow {
  metadata: {
    map_veto?: string[];
    server_id?: string;
    match_logs?: string;
    [key: string]: any;
  };
}