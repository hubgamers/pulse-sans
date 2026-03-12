"use client";

import React from 'react';
import { Loader2, AlertCircle, CheckCircle2, LucideIcon, ChevronDown } from 'lucide-react';

/**
 * TYPES
 */
export interface FormState {
    message: string;
    errors?: Record<string, string[]>;
}

interface FormContainerProps {
    children: React.ReactNode;
    title?: string;
    subtitle?: string;
    action: (payload: FormData) => void;
}

interface FormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    icon?: LucideIcon;
    error?: string | string[];
}

interface FormStatusState {
    message?: string;
    success?: boolean;
    errors?: Record<string, string[] | string | undefined>;
}

/**
 * 1. FORM CONTAINER
 * Ajout d'une bordure supérieure dégradée et d'un meilleur grain de fond
 */
export const FormContainer: React.FC<FormContainerProps> = ({ children, title, subtitle, action }) => (
    <div className="w-full lg:max-w-xl mx-auto">
        {/* Ajout d'une bordure de gradient pour faire ressortir la carte du fond noir */}
        <div className="relative p-[1px] rounded-[2rem] bg-gradient-to-b from-slate-700 to-transparent shadow-2xl">
            <div className="relative overflow-hidden bg-[#0d1117] rounded-[2rem] p-8">

                {/* Lumières d'ambiance plus fortes */}
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/30 blur-[80px] rounded-full pointer-events-none" />

                {(title || subtitle) && (
                    <div className="relative mb-10">
                        {title && (
                            <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic italic leading-none">
                                {title}
                            </h2>
                        )}
                        {subtitle && <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 opacity-70">{subtitle}</p>}
                    </div>
                )}

                <form action={action} className="relative space-y-6">
                    {children}
                </form>
            </div>
        </div>
    </div>
);

/**
 * COMPOSANT INTERNE : FieldWrapper
 * Centralise le label et l'erreur pour FormField et FormSelect
 */
const FieldWrapper = ({ label, icon: Icon, error, children }: { label?: string, icon?: LucideIcon, error?: string | string[], children: React.ReactNode }) => {
    const errorMessage = Array.isArray(error) ? error[0] : error;
    return (
        <div className="group space-y-2.5">
            {label && (
                <label className="text-[11px] font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2 group-focus-within:text-indigo-400 transition-colors duration-300">
                    {Icon && <Icon size={14} className="opacity-70" />} {label}
                </label>
            )}
            <div className="relative">{children}</div>
            {errorMessage && (
                <div className="flex items-center gap-1.5 text-red-400 text-[11px] font-semibold pl-1 animate-in slide-in-from-top-1 duration-200">
                    <AlertCircle size={13} /> {errorMessage}
                </div>
            )}
        </div>
    );
};

/**
 * 2. FORM FIELD
 */
export const FormField: React.FC<FormFieldProps> = ({ label, icon: Icon, error, className, ...props }) => (
    <div className="group space-y-2">
        {label && (
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-indigo-400 transition-colors">
                {Icon && <Icon size={12} />} {label}
            </label>
        )}
        {/* On remplace bg-slate-900/40 par un gris plus solide pour qu'il soit visible */}
        <input
            {...props}
            className={`w-full bg-[#161b22] border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/50 transition-all ${className}`}
        />
        {error && <p className="text-red-500 text-[10px] font-bold uppercase mt-1">{Array.isArray(error) ? error[0] : error}</p>}
    </div>
);

/**
 * 3. FORM SELECT
 */
export const FormSelect: React.FC<React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string, icon?: LucideIcon, error?: string | string[], options: { value: string; label: string }[] }> = ({
    label, icon, error, options, className, ...props
}) => (
    <FieldWrapper label={label} icon={icon} error={error}>
        <select
            {...props}
            className={`w-full bg-slate-900/40 border ${error ? 'border-red-500/40' : 'border-slate-800'
                } rounded-2xl px-5 py-4 text-slate-100 appearance-none focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all duration-300 cursor-pointer ${className || ''}`}
        >
            {options.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-slate-950 text-white">
                    {opt.label}
                </option>
            ))}
        </select>
        <ChevronDown size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none group-focus-within:text-indigo-400 transition-colors" />
    </FieldWrapper>
);

/**
 * 4. FORM BUTTON
 */
export const FormButton: React.FC<{ children: React.ReactNode, isPending: boolean, icon?: LucideIcon }> = ({ children, isPending, icon: Icon }) => (
    <button
        type="submit"
        disabled={isPending}
        className="w-full relative group h-[58px] overflow-hidden rounded-2xl bg-indigo-600 text-white font-bold uppercase tracking-[0.15em] text-sm transition-all duration-300 hover:bg-indigo-500 hover:shadow-[0_0_30px_-5px_rgba(79,70,229,0.6)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none"
    >
        {/* Effet Shimmer */}
        <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />

        <div className="relative flex items-center justify-center gap-3">
            {isPending ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    <span className="animate-pulse">Traitement...</span>
                </>
            ) : (
                <>
                    {children}
                    {Icon && <Icon size={18} className="group-hover:translate-x-1 transition-transform duration-300" />}
                </>
            )}
        </div>
    </button>
);

/**
 * 5. FORM STATUS
 */
/**
 * 5. FORM STATUS - Corrigé pour afficher les erreurs globales
 */
/**
 * 5. FORM STATUS - Version avec détails des erreurs
 */
export const FormStatus: React.FC<{ state?: FormStatusState }> = ({ state }) => {
    if (!state?.message) return null;

    const isError = state.success === false || (state.errors && Object.keys(state.errors).length > 0);

    // On transforme l'objet d'erreurs en tableau lisible
    // state.errors est sous la forme { name: ["trop court"], slug: ["déjà pris"] }
    const errorList = state.errors
        ? Object.entries(state.errors).flatMap(([field, msgs]) =>
            Array.isArray(msgs) ? msgs.map(m => ({ field, m })) : []
        )
        : [];

    return (
        <div className={`p-4 rounded-2xl flex flex-col gap-3 border animate-in slide-in-from-bottom-2 duration-300 ${isError
                ? 'bg-red-500/10 border-red-500/20 text-red-400'
                : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-full ${isError ? 'bg-red-500/20' : 'bg-emerald-500/20'}`}>
                    {isError ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
                </div>
                <div className="flex flex-col">
                    <p className="text-[13px] font-bold uppercase tracking-tight">
                        {isError ? "Action impossible" : "Succès"}
                    </p>
                    <p className="text-xs opacity-90">{state.message}</p>
                </div>
            </div>

            {/* Affichage de la liste détaillée des erreurs si elles existent */}
            {isError && errorList.length > 0 && (
                <div className="mt-2 pl-12 space-y-1 border-l border-red-500/30">
                    {errorList.map((err, index) => (
                        <p key={index} className="text-[11px] font-medium leading-tight">
                            <span className="uppercase opacity-50 mr-1">{err.field}:</span>
                            {err.m}
                        </p>
                    ))}
                </div>
            )}
        </div>
    );
};