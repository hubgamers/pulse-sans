'use client';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import LoginButton from '@/components/auth/LoginButton';
import { Gamepad2 } from 'lucide-react';

export default function AuthPage() {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && session) {
      router.push('/dashboard');
    }
  }, [session, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0a0a0b] to-[#0f3460]">
      <div className="w-full max-w-md mx-auto px-4">
        {/* Logo/Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Gamepad2 size={40} className="text-[#5865F2]" />
            <h1 className="text-4xl font-bold text-white">HubGamers</h1>
          </div>
          <p className="text-gray-300 text-lg">
            La plateforme gaming communautaire
          </p>
        </div>

        {/* Auth Card */}
        <div className="bg-[#1a1a2e] rounded-lg border border-[#16213e] p-8 shadow-2xl">
          <h2 className="text-2xl font-bold text-white mb-2 text-center">
            Bienvenue
          </h2>
          <p className="text-gray-400 text-center mb-8">
            Connectez-vous avec Discord pour accéder à votre dashboard
          </p>

          {loading ? (
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#5865F2]"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <LoginButton />
              <p className="text-xs text-gray-500 text-center mt-4">
                En continuant, vous acceptez nos conditions d'utilisation et notre politique de confidentialité
              </p>
            </div>
          )}
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-3 gap-4 text-center">
          <div className="text-gray-400">
            <div className="text-2xl mb-2">🎮</div>
            <p className="text-sm">Compétitions</p>
          </div>
          <div className="text-gray-400">
            <div className="text-2xl mb-2">👥</div>
            <p className="text-sm">Communautés</p>
          </div>
          <div className="text-gray-400">
            <div className="text-2xl mb-2">🏆</div>
            <p className="text-sm">Classements</p>
          </div>
        </div>
      </div>
    </div>
  );
}
