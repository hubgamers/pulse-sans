import { Database } from './schema';

// helper to safely extract the Row type of a table if it exists
// (duplicate definition allowed, it's small)
type TableRow<Name extends string> = Name extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][Name] extends { Row: infer R }
    ? R
    : any
  : any;

export type Contest = TableRow<'contests'>;
export type Submission = TableRow<'submissions'>;
export type Vote = TableRow<'votes'>;

// Community types
export type CommunityRow = TableRow<'communities'>;

export interface Community extends CommunityRow {
  id: string;
  name: string;
  slug: string;
  description?: string;
  member_count?: number;
  created_at: string;
  updated_at?: string;
}