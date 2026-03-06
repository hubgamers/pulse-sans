'use client';

export function ProfileCardSkeleton() {
  return (
    <div className="bg-[#1a1a2e] rounded-lg p-6 border border-[#16213e] animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-12 h-12 rounded-full bg-[#16213e]"></div>
          <div className="flex-1">
            <div className="h-4 bg-[#16213e] rounded w-32 mb-2"></div>
            <div className="h-3 bg-[#16213e] rounded w-20"></div>
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-[#16213e] rounded"></div>
        <div className="h-3 bg-[#16213e] rounded w-40"></div>
      </div>
    </div>
  );
}

export function EventCardSkeleton() {
  return (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#16213e] animate-pulse">
      <div className="p-6 space-y-4">
        <div className="h-5 bg-[#16213e] rounded w-48"></div>
        <div className="h-3 bg-[#16213e] rounded"></div>
        <div className="h-3 bg-[#16213e] rounded w-40"></div>
        <div className="space-y-2">
          <div className="h-3 bg-[#16213e] rounded w-32"></div>
          <div className="h-3 bg-[#16213e] rounded w-40"></div>
        </div>
      </div>
    </div>
  );
}

export function TournamentCardSkeleton() {
  return (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#16213e] animate-pulse">
      <div className="bg-[#16213e] h-2"></div>
      <div className="p-6 space-y-4">
        <div className="h-5 bg-[#16213e] rounded w-48"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-12 bg-[#16213e] rounded"></div>
          <div className="h-12 bg-[#16213e] rounded"></div>
        </div>
      </div>
    </div>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="bg-[#1a1a2e] rounded-lg overflow-hidden border border-[#16213e] animate-pulse">
      <div className="p-6 space-y-4">
        <div className="h-5 bg-[#16213e] rounded w-40"></div>
        <div className="h-3 bg-[#16213e] rounded"></div>
        <div className="pt-4 border-t border-[#16213e]">
          <div className="h-3 bg-[#16213e] rounded w-32"></div>
        </div>
      </div>
    </div>
  );
}
