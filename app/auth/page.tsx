"use client";

import { Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  Chrome,
  Disc,
  Lock,
  Mail,
  ShieldCheck,
  Trophy,
  User,
  Users,
  Linkedin,
} from "lucide-react";
import type { Provider } from "@supabase/supabase-js";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const OAUTH_PROVIDERS: Array<{
  id: Provider;
  label: string;
  hint: string;
  icon: typeof Chrome;
  accent: string;
}> = [
    {
      id: "google",
      label: "Google",
      hint: "Connexion rapide avec Gmail ou Workspace",
      icon: Chrome,
      accent: "from-rose-500/15 to-orange-400/10 text-rose-600",
    },
    {
      id: "discord",
      label: "Discord",
      hint: "Parfait pour les staffs et communautés gaming",
      icon: Disc,
      accent: "from-indigo-500/15 to-sky-500/10 text-indigo-600",
    },
    {
      id: "linkedin_oidc",
      label: "LinkedIn",
      hint: "Pratique pour les profils pro et partenaires",
      icon: Linkedin,
      accent: "from-sky-500/15 to-cyan-400/10 text-sky-700",
    },
  ];

function AuthPageFallback() {
  return <div className="min-h-screen bg-slate-50" />;
}

function SaaSAuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [isLogin, setIsLogin] = useState(true);
  const [isRecoveryFlow, setIsRecoveryFlow] = useState(
    searchParams.get("type") === "recovery" || searchParams.get("mode") === "recovery"
  );
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);
  const [isSendingPasswordLink, setIsSendingPasswordLink] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<Provider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showGeneratePasswordLink, setShowGeneratePasswordLink] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(
    searchParams.get("error") === "auth-code-error"
      ? "La connexion OAuth n'a pas pu être finalisée. Réessayez."
      : null
  );

  const authRedirect = typeof window !== "undefined"
    ? `${window.location.origin}/api/auth/callback?next=/dashboard`
    : undefined;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const recoveryMode =
      queryParams.get("type") === "recovery" ||
      queryParams.get("mode") === "recovery" ||
      hashParams.get("type") === "recovery";

    if (recoveryMode) {
      setIsRecoveryFlow(true);
      setIsLogin(true);
      setErrorMessage(null);
      setMessage(null);
    }
  }, [searchParams]);

  const handleOAuthSignIn = async (provider: Provider) => {
    setErrorMessage(null);
    setMessage(null);
    setShowGeneratePasswordLink(false);
    setOauthLoading(provider);

    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: authRedirect,
      },
    });

    if (error) {
      setErrorMessage(error.message);
      setOauthLoading(null);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setMessage(null);
    setShowGeneratePasswordLink(false);
    setIsSubmitting(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setErrorMessage(error.message);
          if (email.trim().length > 0) {
            setShowGeneratePasswordLink(true);
          }
          return;
        }
        router.push("/dashboard");
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: authRedirect,
          data: { full_name: fullName },
        },
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setMessage("Compte créé. Vérifiez votre email pour confirmer l'inscription.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setErrorMessage("Saisissez votre email pour réinitialiser le mot de passe.");
      return;
    }

    setIsSendingPasswordLink(true);
    setErrorMessage(null);
    setMessage(null);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth?mode=recovery`,
    });

    if (error) {
      setErrorMessage(error.message);
      setIsSendingPasswordLink(false);
      return;
    }

    setMessage("Lien envoyé. Vérifiez votre boîte mail pour définir ou réinitialiser votre mot de passe.");
    setShowGeneratePasswordLink(false);
    setIsSendingPasswordLink(false);
  };

  const handleUpdatePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage(null);
    setMessage(null);

    if (newPassword.length < 6) {
      setErrorMessage("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsUpdatingPassword(true);

    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setMessage("Mot de passe mis à jour. Vous pouvez maintenant vous connecter avec votre email.");
      setNewPassword("");
      setConfirmPassword("");
      setIsRecoveryFlow(false);
      setIsLogin(true);
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f9fafb_0%,#eefaf7_45%,#f7fbff_100%)] text-slate-900">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8rem] top-[-5rem] h-72 w-72 rounded-full bg-teal-500/15 blur-3xl" />
        <div className="absolute right-[-6rem] top-24 h-80 w-80 rounded-full bg-cyan-400/15 blur-3xl" />
        <div className="absolute bottom-[-8rem] left-1/3 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,118,110,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,118,110,0.05)_1px,transparent_1px)] bg-[size:72px_72px]" />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid w-full gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-stretch">
          <section className="relative overflow-hidden rounded-[32px] border border-white/60 bg-[linear-gradient(135deg,rgba(15,23,42,0.97),rgba(15,118,110,0.93))] p-8 text-white shadow-[0_30px_80px_rgba(15,23,42,0.22)] sm:p-10 lg:p-12">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.18),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(94,234,212,0.18),transparent_34%)]" />
            <div className="relative flex h-full flex-col justify-between gap-10">
              <div className="space-y-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-teal-100 backdrop-blur-sm">
                  HubGamers Access
                </div>

                <div className="max-w-xl space-y-4">
                  <h1 className="text-4xl font-black leading-tight tracking-[-0.04em] sm:text-5xl">
                    Gérez vos organisations, tournois et équipes depuis un seul cockpit.
                  </h1>
                  <p className="max-w-lg text-sm leading-7 text-slate-200 sm:text-base">
                    Authentification email ou connexion directe avec vos comptes Google, Discord et LinkedIn pour rejoindre rapidement votre espace HubGamers.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <ShieldCheck className="mb-3 h-5 w-5 text-teal-200" />
                  <p className="text-sm font-semibold">Sessions sécurisées</p>
                  <p className="mt-1 text-xs leading-6 text-slate-200">OAuth Supabase et accès unifié au dashboard.</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <Trophy className="mb-3 h-5 w-5 text-teal-200" />
                  <p className="text-sm font-semibold">Compétitions pilotées</p>
                  <p className="mt-1 text-xs leading-6 text-slate-200">Tournois, brackets, matchs et planification centralisés.</p>
                </div>
                <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm">
                  <Users className="mb-3 h-5 w-5 text-teal-200" />
                  <p className="text-sm font-semibold">Multi-organisation</p>
                  <p className="mt-1 text-xs leading-6 text-slate-200">Passez d'une structure à l'autre sans friction.</p>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200/80 bg-white/85 p-5 shadow-[0_24px_70px_rgba(15,23,42,0.10)] backdrop-blur-xl sm:p-7 lg:p-8">
            <div className="rounded-[28px] border border-slate-200 bg-white/90 p-6 sm:p-8">
              <div className="mb-8 flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-teal-700">Authentification</p>
                  <h2 className="mt-2 text-3xl font-black tracking-[-0.03em] text-slate-950">
                    {isLogin ? "Connexion" : "Créer un compte"}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {isLogin
                      ? "Reprenez la main sur votre espace HubGamers."
                      : "Créez votre accès pour lancer votre première structure."}
                  </p>
                </div>
                <div className="hidden rounded-2xl border border-teal-100 bg-teal-50 px-4 py-3 text-right sm:block">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">OAuth</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">3 providers</p>
                  <p className="text-xs text-slate-500">Google, Discord, LinkedIn</p>
                </div>
              </div>

              {isRecoveryFlow ? (
                <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  <p className="font-semibold">Définissez votre mot de passe</p>
                  <p className="mt-1 text-xs leading-5 text-amber-700">
                    Ce formulaire est affiché après un lien de récupération Supabase. Entrez un nouveau mot de passe pour activer la connexion par email.
                  </p>
                </div>
              ) : (
                <div className="mb-6 grid grid-cols-2 rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(true);
                      setMessage(null);
                      setErrorMessage(null);
                    }}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${isLogin ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    Se connecter
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsLogin(false);
                      setMessage(null);
                      setErrorMessage(null);
                    }}
                    className={`rounded-xl px-4 py-3 text-sm font-semibold transition ${!isLogin ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"
                      }`}
                  >
                    S'inscrire
                  </button>
                </div>
              )}

              {!isRecoveryFlow && (
                <div className="mb-8 grid gap-3">
                  {OAUTH_PROVIDERS.map((provider) => {
                    const ProviderIcon = provider.icon;
                    const isLoading = oauthLoading === provider.id;

                    return (
                      <button
                        key={provider.id}
                        type="button"
                        onClick={() => void handleOAuthSignIn(provider.id)}
                        disabled={Boolean(oauthLoading) || isSubmitting}
                        className="group flex items-center gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg disabled:cursor-wait disabled:opacity-70"
                      >
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${provider.accent}`}>
                          <ProviderIcon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-slate-900">
                            {isLoading ? `Connexion ${provider.label}...` : `Continuer avec ${provider.label}`}
                          </p>
                          <p className="text-xs leading-5 text-slate-500">{provider.hint}</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:translate-x-1 group-hover:text-slate-700" />
                      </button>
                    );
                  })}
                </div>
              )}

              {!isRecoveryFlow && (
                <div className="relative mb-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dashed border-slate-300" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                      ou avec votre email
                    </span>
                  </div>
                </div>
              )}

              {isRecoveryFlow ? (
                <form className="space-y-5" onSubmit={handleUpdatePassword}>
                  <label className="block space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Nouveau mot de passe</span>
                    <div className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-teal-600 focus-within:bg-white">
                      <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-full w-full border-none bg-transparent px-0 py-0 text-sm focus:bg-transparent focus:ring-0"
                        required
                        minLength={6}
                      />
                    </div>
                  </label>

                  <label className="block space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Confirmer le mot de passe</span>
                    <div className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-teal-600 focus-within:bg-white">
                      <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-full w-full border-none bg-transparent px-0 py-0 text-sm focus:bg-transparent focus:ring-0"
                        required
                        minLength={6}
                      />
                    </div>
                  </label>

                  {errorMessage && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p>{errorMessage}</p>
                    </div>
                  )}

                  {message && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isUpdatingPassword}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-wait disabled:bg-slate-400"
                  >
                    {isUpdatingPassword ? "Mise à jour..." : "Enregistrer le nouveau mot de passe"}
                    {!isUpdatingPassword && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsRecoveryFlow(false);
                      setErrorMessage(null);
                      setMessage(null);
                    }}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Retour à la connexion
                  </button>
                </form>
              ) : (
                <form className="space-y-5" onSubmit={handleEmailAuth}>
                  {!isLogin && (
                    <label className="block space-y-2">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Nom complet</span>
                      <div className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-teal-600 focus-within:bg-white">
                        <User className="h-4 w-4 shrink-0 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Alexandre Martin"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          className="h-full w-full border-none bg-transparent px-0 py-0 text-sm focus:bg-transparent focus:ring-0"
                          required={!isLogin}
                        />
                      </div>
                    </label>
                  )}

                  <label className="block space-y-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Email</span>
                    <div className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-teal-600 focus-within:bg-white">
                      <Mail className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="alex@hubgamers.gg"
                        className="h-full w-full border-none bg-transparent px-0 py-0 text-sm focus:bg-transparent focus:ring-0"
                        required
                      />
                    </div>
                  </label>

                  <label className="block space-y-2">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Mot de passe</span>
                      {isLogin && (
                        <button
                          type="button"
                          onClick={() => void handleForgotPassword()}
                          className="text-xs font-semibold text-teal-700 transition hover:text-teal-600"
                        >
                          Mot de passe oublié ?
                        </button>
                      )}
                    </div>
                    <div className="flex h-12 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 focus-within:border-teal-600 focus-within:bg-white">
                      <Lock className="h-4 w-4 shrink-0 text-slate-400" />
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-full w-full border-none bg-transparent px-0 py-0 text-sm focus:bg-transparent focus:ring-0"
                        required
                        minLength={6}
                      />
                    </div>
                  </label>

                  {errorMessage && (
                    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                      <p>{errorMessage}</p>
                      {isLogin && showGeneratePasswordLink && (
                        <button
                          type="button"
                          onClick={() => void handleForgotPassword()}
                          disabled={isSendingPasswordLink}
                          className="mt-3 inline-flex items-center gap-2 rounded-xl border border-rose-300 bg-white px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70"
                        >
                          {isSendingPasswordLink ? "Envoi du lien..." : "Générer un mot de passe par email"}
                        </button>
                      )}
                    </div>
                  )}

                  {message && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                      {message}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isSubmitting || Boolean(oauthLoading)}
                    className="group inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-4 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-wait disabled:bg-slate-400"
                  >
                    {isSubmitting
                      ? "Chargement..."
                      : isLogin
                        ? "Se connecter par email"
                        : "Créer mon compte"}
                    {!isSubmitting && <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />}
                  </button>
                </form>
              )}

              <div className="mt-8 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-xs leading-6 text-slate-500">
                <p className="font-semibold uppercase tracking-[0.18em] text-slate-600">Accès recommandé</p>
                <p className="mt-2">
                  Google pour les comptes personnels, Discord pour les équipes esports, LinkedIn pour les partenaires et profils professionnels.
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function SaaSAuth() {
  return (
    <Suspense fallback={<AuthPageFallback />}>
      <SaaSAuthContent />
    </Suspense>
  );
}