// components/auth/LoginButton.tsx
'use client'

import { supabase } from '@/lib/supabase'

export default function LoginButton() {
  const handleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        // Redirige vers une route API qui gère le callback
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <button 
      onClick={handleLogin}
      className="bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition-all"
    >
      Connexion avec Discord
    </button>
  )
}