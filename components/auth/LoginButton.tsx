'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { LogIn } from 'lucide-react';

export default function LoginButton() {
  const { signInWithDiscord, loading } = useAuth();

  const handleLogin = async () => {
    await signInWithDiscord();
  };

  return (
    <button
      onClick={handleLogin}
      disabled={loading}
      className="flex items-center gap-2 px-6 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <LogIn size={20} />
      {loading ? 'Connexion...' : 'Se connecter avec Discord'}
    </button>
  );
}
