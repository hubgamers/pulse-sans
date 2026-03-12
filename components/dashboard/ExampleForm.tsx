"use client";

import { createOrganization, FormState } from "@/lib/actions/organization/organization.actions";
import { useActionState, useState, type ChangeEvent } from "react";
import { Trophy, Globe, Fingerprint, Activity, Loader2 } from "lucide-react";

const initialState: FormState = {
    message: "",
    errors: {},
};

const slugify = (value: string) =>
    value
        .toLowerCase()
        .replace(/ /g, "-")
        .replace(/[^\w-]+/g, "");

export default function CreateOrgForm() {
    const [state, formAction, isPending] = useActionState(createOrganization, initialState);
    const [slug, setSlug] = useState("");
    const [name, setName] = useState("");
    const [slugEdited, setSlugEdited] = useState(false);

    const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => {
        const nextName = e.target.value;
        setName(nextName);
        if (!slugEdited) {
            setSlug(slugify(nextName));
        }
    };

    const handleSlugChange = (e: ChangeEvent<HTMLInputElement>) => {
        setSlug(e.target.value);
        setSlugEdited(true);
    };

    return (
        <div className="w-full max-w-xl mx-auto">
            <form action={formAction} className="space-y-8 bg-[#0d1117] p-8 rounded-2xl shadow-2xl">

                {/* Header du formulaire */}
                <div className="space-y-2">
                    <h2 className="text-2xl font-bold text-white tracking-tight">Nouvelle Organisation</h2>
                    <p className="text-slate-400 text-sm">Configurez votre espace de compétition en quelques secondes.</p>
                </div>

                <div className="space-y-6">
                    {/* Champ Nom */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Trophy size={16} className="text-indigo-400" /> Nom de l&apos;organisation
                        </label>
                        <input
                            name="name"
                            type="text"
                            value={name}
                            onChange={handleNameChange}
                            placeholder="Ex: Thunder Esport"
                            className="w-full bg-[#131920] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                        />
                        {state.errors?.name && (
                            <p className="text-red-400 text-xs mt-1 animate-pulse">{state.errors.name[0]}</p>
                        )}
                    </div>

                    {/* Champ Slug */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Fingerprint size={16} className="text-indigo-400" /> Identifiant unique (Slug)
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm select-none font-mono">
                                hub.gg/
                            </span>
                            <input
                                name="slug"
                                type="text"
                                value={slug}
                                onChange={handleSlugChange}
                                className="w-full bg-[#131920] border border-slate-700 rounded-xl pl-[62px] pr-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                            />
                        </div>
                        {state.errors?.slug && (
                            <p className="text-red-400 text-xs mt-1">{state.errors.slug[0]}</p>
                        )}
                    </div>

                    {/* Select Type */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-slate-300 flex items-center gap-2">
                            <Activity size={16} className="text-indigo-400" /> Type de structure
                        </label>
                        <div className="grid grid-cols-2 gap-4">
                            {['SPORT', 'ESPORT'].map((type) => (
                                <label key={type} className="relative group cursor-pointer">
                                    <input type="radio" name="type" value={type} defaultChecked={type === 'ESPORT'} className="peer sr-only" />
                                    <div className="p-4 bg-[#131920] border border-slate-700 rounded-xl text-center text-sm font-semibold text-slate-400 peer-checked:bg-indigo-500/10 peer-checked:border-indigo-500 peer-checked:text-indigo-400 transition-all group-hover:border-slate-500">
                                        {type === 'SPORT' ? '⚽ Sport' : '🎮 Esport'}
                                    </div>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Message d'erreur global */}
                {state.message && (
                    <div className={`p-4 rounded-xl flex items-center gap-3 animate-in fade-in slide-in-from-top-2 ${state.errors ? 'bg-red-500/10 border border-red-500/20 text-red-400' : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                        }`}>
                        <span className="text-sm font-medium">{state.message}</span>
                    </div>
                )}

                {/* Bouton de soumission */}
                <button
                    type="submit"
                    disabled={isPending}
                    className="w-full group relative flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold py-4 rounded-xl transition-all overflow-hidden shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="animate-spin" size={20} />
                            <span>Propulsion...</span>
                        </>
                    ) : (
                        <>
                            <span>Créer l&apos;espace</span>
                            <Globe size={18} className="group-hover:translate-x-1 transition-transform" />
                        </>
                    )}

                    {/* Effet de brillance au survol */}
                    <div className="absolute inset-0 w-1/2 h-full bg-white/10 -skew-x-[30deg] -translate-x-full group-hover:animate-[shimmer_0.6s_infinite]" />
                </button>
            </form>
        </div>
    );
}