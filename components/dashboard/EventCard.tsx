'use client';

import { Event } from '@/types/Event';
import { Calendar, MapPin, Users } from 'lucide-react';

interface EventCardProps {
  event: Event;
}

export function EventCard({ event }: EventCardProps) {
  const eventTypeLabels: Record<string, string> = {
    esport: '🎮 Esport',
    festival: '🎉 Festival',
    meetup: '👥 Meetup',
    workshop: '📚 Workshop',
  };

  return (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#16213e] hover:border-[#5865F2] transition-colors">
      <div className="p-6">
        <div className="flex justify-between items-start mb-3">
          <h3 className="text-lg font-semibold text-white flex-1">{event.name}</h3>
          <span className="text-xs px-3 py-1 bg-[#0f3460] rounded-full text-[#5865F2]">
            {eventTypeLabels[event.type] || event.type}
          </span>
        </div>

        {event.description && (
          <p className="text-gray-400 text-sm mb-4">{event.description}</p>
        )}

        <div className="space-y-3 text-sm text-gray-300">
          {event.start_date && (
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-[#5865F2]" />
              <span>{new Date(event.start_date).toLocaleDateString('fr-FR')}</span>
            </div>
          )}
          {event.location && (
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-[#5865F2]" />
              <span>{event.location}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users size={16} className="text-[#5865F2]" />
            <span>{event.max_attendees || 'Illimité'} places</span>
          </div>
        </div>
      </div>
    </div>
  );
}
