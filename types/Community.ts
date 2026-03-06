import { Database } from './schema';

export type Contest = Database['public']['Tables']['contests']['Row'];
export type Submission = Database['public']['Tables']['submissions']['Row'];
export type Vote = Database['public']['Tables']['votes']['Row'];