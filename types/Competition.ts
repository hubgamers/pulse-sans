import { Database } from './schema';

// helper generic for safe table lookups
type TableRow<Name extends string> = Name extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][Name] extends { Row: infer R }
    ? R
    : any
  : any;

// Enums pour la logique métier
export type TournamentFormat = 'SWISS' | 'DOUBLE_ELIM' | 'SINGLE_ELIM' | 'POULES' | 'FFA';
export type TournamentStatus = 'open' | 'live' | 'finished' | 'setup';

// --- TEAMS ---
export type Team = TableRow<'teams'>;

// --- TOURNAMENTS ---
export type TournamentRow = TableRow<'tournaments'>;

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
export type MatchRow = TableRow<'matches'>;

export interface Match extends MatchRow {
  metadata: {
    map_veto?: string[];
    server_id?: string;
    match_logs?: string;
    [key: string]: any;
  };
}