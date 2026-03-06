'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { LogOut } from 'lucide-react';

export default function LogoutButton() {
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <button
      onClick={handleLogout}
      className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
    >
      <LogOut size={18} />
      Déconnexion
    </button>
  );
}
