'use client'

import React, { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { Disc as Discord, ShieldCheck, Zap, Mail, Lock, UserPlus, LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null) // Pour le succès du reset
  
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  // Fonction pour mot de passe oublié
  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMsg("Veuillez entrer votre adresse email d'abord.")
      return
    }
    
    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/dashboard/update-password`,
      })
      if (error) throw error
      setSuccessMsg("Lien de réinitialisation envoyé par email !")
    } catch (error: any) {
      setErrorMsg(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDiscordLogin = async () => {
    setIsLoading(true)
    setErrorMsg(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (error: any) {
      setErrorMsg(error.message)
      setIsLoading(false)
    }
  }

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrorMsg(null)
    setSuccessMsg(null)

    try {
      if (mode === 'register') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) throw error
        setSuccessMsg("Vérifiez votre boîte mail pour confirmer l'inscription !")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw error
        router.push('/dashboard')
      }
    } catch (error: any) {
      setErrorMsg(error.message)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] text-white flex flex-col items-center justify-center p-4 selection:bg-indigo-500/30">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-64 bg-indigo-600/20 blur-[120px] pointer-events-none" />
      
      <div className="w-full max-w-md z-10">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 mb-4 shadow-lg shadow-indigo-500/20">
            <Zap className="w-8 h-8 text-white fill-current" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight mb-2">
            {mode === 'login' ? 'Bon retour !' : 'Rejoignez-nous'}
          </h1>
          <p className="text-gray-400">
            {mode === 'login' 
              ? 'Accédez à vos tournois et votre profil.' 
              : 'Créez votre compte pour commencer l\'aventure.'}
          </p>
        </div>

        <div className="bg-[#161618] border border-white/5 rounded-3xl p-1 shadow-2xl">
          <div className="flex p-1 bg-black/20 rounded-[1.4rem] mb-6">
            <button 
              onClick={() => { setMode('login'); setSuccessMsg(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-all ${mode === 'login' ? 'bg-[#27272a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <LogIn className="w-4 h-4" /> Connexion
            </button>
            <button 
              onClick={() => { setMode('register'); setSuccessMsg(null); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-xl transition-all ${mode === 'register' ? 'bg-[#27272a] text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              <UserPlus className="w-4 h-4" /> Inscription
            </button>
          </div>

          <div className="px-7 pb-8 pt-2">
            <button
              onClick={handleDiscordLogin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-[#5865F2] hover:bg-[#4752C4] disabled:opacity-50 text-white font-bold rounded-xl transition-all mb-6"
            >
              <Discord className="w-5 h-5" />
              <span>Discord</span>
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
              <div className="relative flex justify-center text-[10px] uppercase tracking-widest text-gray-500">
                <span className="bg-[#161618] px-4">Ou via Email</span>
              </div>
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-400 ml-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="email" 
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nom@exemple.com"
                    className="w-full bg-black/20 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-xs font-semibold text-gray-400">Mot de passe</label>
                  {mode === 'login' && (
                    <button 
                      type="button"
                      onClick={handleForgotPassword}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Mot de passe oublié ?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input 
                    type="password" 
                    required={mode === 'register' || mode === 'login'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-black/20 border border-white/5 rounded-xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
                  />
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-400 bg-red-400/10 p-3 rounded-lg border border-red-400/20">
                  {errorMsg}
                </p>
              )}

              {successMsg && (
                <p className="text-xs text-emerald-400 bg-emerald-400/10 p-3 rounded-lg border border-emerald-400/20">
                  {successMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-4 bg-white text-black hover:bg-gray-200 disabled:opacity-50 font-bold rounded-xl transition-all mt-2"
              >
                {isLoading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer un compte'}
              </button>
            </form>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 opacity-50">
           <ShieldCheck className="w-4 h-4" />
           <span className="text-[10px] uppercase tracking-tighter">Données Chiffrées AES-256</span>
        </div>
      </div>
    </div>
  )
}