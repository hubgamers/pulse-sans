import { Database } from './schema';

// helper generic for safe access
type TableRow<Name extends string> = Name extends keyof Database['public']['Tables']
  ? Database['public']['Tables'][Name] extends { Row: infer R }
    ? R
    : any
  : any;

export type EventType = 'esport' | 'festival' | 'meetup' | 'workshop';

export type EventRow = TableRow<'events'>;

export interface Event extends Omit<EventRow, 'type'> {
  type: EventType;
  metadata: {
    venue_map_url?: string;
    stream_links?: string[];
    schedule_description?: string;
    [key: string]: any;
  };
}

export type Registration = TableRow<'registrations'>;