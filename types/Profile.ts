import { Database } from './schema';

// safe table row lookup
type TableRow<Name extends string> = Name extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][Name] extends { Row: infer R }
    ? R
    : any
  : any;

export type UserRole = 'admin' | 'lead' | 'ambassador' | 'member';

export type ProfileRow = TableRow<'profiles'>;

export interface Profile extends Omit<ProfileRow, 'role'> {
  role: UserRole;
}

export type XPLog = TableRow<'xp_log'>;