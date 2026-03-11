"use client";

import React, { useActionState, JSX } from 'react';
import { Loader2, AlertCircle, CheckCircle2, LucideIcon } from 'lucide-react';

/**
 * TYPES ET INTERFACES
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

interface FormButtonProps {
    children: React.ReactNode;
    isPending: boolean;
    icon?: LucideIcon;
}

interface FormStatusProps {
    state: FormState;
}

/**
 * 1. FORM CONTAINER
 */
export const FormContainer: React.FC<FormContainerProps> = ({
    children,
    title,
    subtitle,
    action
}) => (
    <div className="w-full max-w-xl mx-auto p-1">
        <div className="relative overflow-hidden bg-[#0d1117]/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl">
            <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-500/10 blur-[100px] rounded-full pointer-events-none" />
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-fuchsia-500/10 blur-[100px] rounded-full pointer-events-none" />

            {(title || subtitle) && (
                <div className="relative mb-8">
                    {title && <h2 className="text-2xl font-black text-white tracking-tight uppercase italic">{title}</h2>}
                    {subtitle && <p className="text-slate-400 text-sm font-medium mt-1">{subtitle}</p>}
                </div>
            )}

            <form action={action} className="relative space-y-6">
                {children}
            </form>
        </div>
    </div>
);

/**
 * 2. FORM FIELD
 */
export const FormField: React.FC<FormFieldProps> = ({
    label,
    icon: Icon,
    error,
    className,
    ...props
}) => {
    const errorMessage = Array.isArray(error) ? error[0] : error;

    return (
        <div className="group space-y-2 text-left">
            {label && (
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-indigo-400 transition-colors">
                    {Icon && <Icon size={14} className="shrink-0" />} {label}
                </label>
            )}
            <div className="relative">
                <input
                    {...props}
                    className={`w-full bg-slate-900/50 border ${errorMessage ? 'border-red-500/50' : 'border-slate-700'
                        } rounded-xl px-5 py-3.5 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 ${errorMessage ? 'focus:ring-red-500/20' : 'focus:ring-indigo-500/30'
                        } focus:border-indigo-500 transition-all duration-300 ${className || ''}`}
                />
            </div>
            {errorMessage && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs font-bold animate-in fade-in slide-in-from-left-1">
                    <AlertCircle size={12} /> {errorMessage}
                </p>
            )}
        </div>
    );
};

/**
 * 3. FORM BUTTON
 */
export const FormButton: React.FC<FormButtonProps> = ({
    children,
    isPending,
    icon: Icon
}) => (
    <button
        type="submit"
        disabled={isPending}
        className="w-full group relative flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all duration-300 shadow-lg shadow-indigo-500/20 active:scale-[0.98] overflow-hidden"
    >
        {isPending ? (
            <span className="flex items-center gap-2">
                <Loader2 className="animate-spin" size={18} /> Propulsion...
            </span>
        ) : (
            <span className="flex items-center gap-2">
                {children} {Icon && <Icon size={18} className="group-hover:translate-x-1 transition-transform" />}
            </span>
        )}
        <div className="absolute inset-0 w-1/4 h-full bg-white/10 -skew-x-[45deg] -translate-x-full group-hover:animate-[shimmer_0.8s_ease-out]" />
    </button>
);

/**
 * 4. FORM STATUS
 */
export const FormStatus: React.FC<FormStatusProps> = ({ state }) => {
    if (!state?.message) return null;
    const isError = !!(state.errors && Object.keys(state.errors).length > 0);

    return (
        <div className={`p-4 rounded-xl flex items-start gap-3 border animate-in zoom-in-95 ${isError ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
            }`}>
            {isError ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <p className="text-sm font-bold leading-tight">{state.message}</p>
        </div>
    );
};

interface FormSelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    icon?: LucideIcon;
    error?: string | string[];
    options: { value: string; label: string }[];
}

export const FormSelect: React.FC<FormSelectProps> = ({
    label,
    icon: Icon,
    error,
    options,
    className,
    ...props
}) => {
    const errorMessage = Array.isArray(error) ? error[0] : error;

    return (
        <div className="group space-y-2 text-left">
            {label && (
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2 group-focus-within:text-indigo-400 transition-colors">
                    {Icon && <Icon size={14} className="shrink-0" />} {label}
                </label>
            )}
            <div className="relative">
                <select
                    {...props}
                    className={`w-full bg-[#0d1117] border ${errorMessage ? 'border-red-500/50' : 'border-slate-700'
                        } rounded-xl px-5 py-3.5 text-white appearance-none focus:outline-none focus:ring-2 ${errorMessage ? 'focus:ring-red-500/20' : 'focus:ring-indigo-500/30'
                        } focus:border-indigo-500 transition-all duration-300 cursor-pointer ${className || ''}`}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#0d1117] text-white">
                            {opt.label}
                        </option>
                    ))}
                </select>

                {/* Flèche personnalisée car appearance-none cache la flèche native */}
                <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-500 group-focus-within:text-indigo-400">
                    <svg className="w-4 h-4 fill-current" viewBox="0 0 20 20">
                        <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                    </svg>
                </div>
            </div>
            {errorMessage && (
                <p className="flex items-center gap-1.5 text-red-400 text-xs font-bold animate-in fade-in slide-in-from-left-1">
                    <AlertCircle size={12} /> {errorMessage}
                </p>
            )}
        </div>
    );
};