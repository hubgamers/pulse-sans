import { Database } from './schema';

export type EventType = 'esport' | 'festival' | 'meetup' | 'workshop';

export type EventRow = Database['public']['Tables']['events']['Row'];

export interface Event extends Omit<EventRow, 'type'> {
  type: EventType;
  metadata: {
    venue_map_url?: string;
    stream_links?: string[];
    schedule_description?: string;
    [key: string]: any;
  };
}

export type Registration = Database['public']['Tables']['registrations']['Row'];