import { Database } from './schema';

export type UserRole = 'admin' | 'lead' | 'ambassador' | 'member';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export interface Profile extends Omit<ProfileRow, 'role'> {
  role: UserRole;
}

export type XPLog = Database['public']['Tables']['xp_log']['Row'];