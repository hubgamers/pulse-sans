'use client';

import { Profile } from '@/types/Profile';
import { User, Shield } from 'lucide-react';

interface ProfileCardProps {
  profile: Profile;
}

export function ProfileCard({ profile }: ProfileCardProps) {
  return (
    <div className="bg-[#1a1a2e] rounded-lg p-6 border border-[#16213e] hover:border-[#5865F2] transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#5865F2] to-[#4752C4] flex items-center justify-center">
            <User size={24} className="text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">{profile.username || 'Utilisateur'}</h3>
            <div className="flex items-center gap-1 text-sm text-gray-400">
              <Shield size={14} />
              <span className="capitalize">{profile.role}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-gray-300">
          <span>Points XP:</span>
          <span className="font-semibold">{profile.xp_balance || 0}</span>
        </div>
        {profile.bio && (
          <div className="pt-2 border-t border-[#16213e]">
            <p className="text-gray-400 italic">{profile.bio}</p>
          </div>
        )}
      </div>
    </div>
  );
}
