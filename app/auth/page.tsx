"use client";
import React, { useState } from 'react';
import { Chrome, Disc, ArrowRight, Mail, Lock, User } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { Provider } from '@supabase/supabase-js';

const SaaSAuth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const supabase = createClient(); // On initialise le client une fois

  // Fonction générique pour OAuth (Google & Discord)
  const handleOAuthSignIn = async (provider: Provider) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: provider,
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback`, // Important pour la redirection
      },
    });

    if (error) {
      alert(error.message); // Correction de alert.call
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0f172a] text-slate-200 font-sans p-6 relative overflow-hidden">
      {/* Cercles décoratifs */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-indigo-600/20 rounded-full blur-[120px] -z-10"></div>
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] -z-10"></div>

      <div className="w-full max-w-[440px] bg-slate-900/50 border border-slate-800 backdrop-blur-xl rounded-3xl p-8 shadow-2xl">
        
        {/* Header */}
        <div className="mb-10 text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 mb-4 shadow-lg shadow-indigo-500/20">
            <span className="text-white font-bold text-xl">S</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            {isLogin ? 'Connexion' : 'Créer un compte'}
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            {isLogin ? 'Accédez à votre tableau de bord SaaS' : 'Commencez votre essai gratuit de 14 jours'}
          </p>
        </div>

        {/* Boutons Sociaux */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <button 
            onClick={() => handleOAuthSignIn('google')}
            className="flex items-center justify-center gap-2 py-2.5 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all duration-200 active:scale-95"
          >
            <Chrome size={18} className="text-red-400" />
            <span className="text-sm font-medium">Google</span>
          </button>
          <button 
            onClick={() => handleOAuthSignIn('discord')}
            className="flex items-center justify-center gap-2 py-2.5 border border-slate-700 rounded-xl hover:bg-slate-800 transition-all duration-200 active:scale-95"
          >
            <Disc size={18} className="text-indigo-400" />
            <span className="text-sm font-medium">Discord</span>
          </button>
        </div>

        <div className="relative mb-8">
          <div className="absolute inset-0 flex items-center text-slate-800"><hr className="w-full border-slate-800"/></div>
          <div className="relative flex justify-center text-xs uppercase text-slate-500">
            <span className="bg-[#111827] px-2">Ou email</span>
          </div>
        </div>

        {/* Formulaire */}
        <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
          {!isLogin && (
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400 uppercase ml-1">Nom complet</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                <input type="text" placeholder="Alex Doe" className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-400 uppercase ml-1">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="email" placeholder="alex@saas.com" className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600" />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex justify-between items-center px-1">
              <label className="text-xs font-semibold text-slate-400 uppercase">Mot de passe</label>
              {isLogin && <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition">Oublié ?</a>}
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input type="password" placeholder="••••••••" className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 pl-10 pr-4 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder:text-slate-600" />
            </div>
          </div>

          <button className="group w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3.5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 active:scale-95">
            {isLogin ? 'Se connecter' : 'Créer mon compte'}
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </form>

        {/* Switch Login/Register */}
        <p className="mt-8 text-center text-slate-400 text-sm">
          {isLogin ? "Nouveau sur la plateforme ?" : "Déjà un compte ?"}
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="ml-2 text-white font-semibold hover:text-indigo-400 underline-offset-4 hover:underline transition-all"
          >
            {isLogin ? "S'inscrire gratuitement" : "Se connecter ici"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default SaaSAuth;