'use client';

import { Community } from '@/types/Community';
import { Users, MessageSquare, Star } from 'lucide-react';

interface CommunityCardProps {
  community: Community;
}

export function CommunityCard({ community }: CommunityCardProps) {
  return (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#16213e] hover:border-[#5865F2] transition-colors">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{community.name}</h3>
            {community.slug && (
              <p className="text-xs text-gray-400 mt-1">#{community.slug}</p>
            )}
          </div>
          <Star className="text-[#5865F2]" size={20} />
        </div>

        {community.description && (
          <p className="text-gray-400 text-sm mb-4">{community.description}</p>
        )}

        <div className="flex items-center gap-4 text-sm text-gray-300 pt-4 border-t border-[#16213e]">
          <div className="flex items-center gap-1">
            <Users size={16} className="text-[#5865F2]" />
            <span>{community.member_count || 0} membres</span>
          </div>
          <div className="flex items-center gap-1">
            <MessageSquare size={16} className="text-[#5865F2]" />
            <span>Posts</span>
          </div>
        </div>
      </div>
    </div>
  );
}
