'use client'

import { useFormStatus } from 'react-dom'
import type { ChangeEvent, ReactNode } from 'react'
import { formatPhaseType } from './TournamentTabShell.utils'

export type LoadingSubmitButtonProps = {
    children: ReactNode
    className: string
    disabled?: boolean
    loadingLabel?: string
}

export function LoadingSubmitButton({ children, className, disabled = false, loadingLabel = 'Traitement...' }: LoadingSubmitButtonProps) {
    const { pending } = useFormStatus()

    return (
        <button type="submit" disabled={pending || disabled} className={className}>
            {pending ? loadingLabel : children}
        </button>
    )
}

export function StepSection({
    num, title, desc, children, color = 'indigo',
}: {
    num: number; title: string; desc?: string; children: ReactNode; color?: 'indigo' | 'cyan' | 'emerald' | 'amber'
}) {
    const colorCls = {
        indigo: 'border-teal-600/40 bg-teal-700/20 text-teal-700',
        cyan: 'border-teal-300 bg-teal-50 text-teal-700',
        emerald: 'border-emerald-500/40 bg-emerald-600/20 text-emerald-300',
        amber: 'border-amber-500/40 bg-amber-600/20 text-amber-300',
    }[color]

    return (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start gap-3 pb-1 border-b border-slate-200">
                <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-bold ${colorCls}`}>
                    {num}
                </div>
                <div>
                    <p className="text-sm font-semibold text-slate-900">{title}</p>
                    {desc && <p className="mt-0.5 text-xs text-slate-500">{desc}</p>}
                </div>
            </div>
            {children}
        </div>
    )
}

export function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
            {message}
        </div>
    )
}

export function PhaseTypeBadge({ type }: { type: string }) {
    const PHASE_STYLES: Record<string, string> = {
        GROUP: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
        BRACKET_SINGLE: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
        BRACKET_DOUBLE: 'text-orange-400 bg-orange-500/10 border-orange-500/20',
        PLACEMENT_BRACKET: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
        ROUND_SWISS: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
    }

    const cls = PHASE_STYLES[type] || 'text-slate-400 bg-slate-500/10 border-slate-500/20'

    return (
        <span className={`rounded border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest antialiased ${cls}`}>
            {formatPhaseType(type)}
        </span>
    )
}

export type UploadInputProps = {
    overlayBgPreview: string
    overlayBgUploading: boolean
    overlayBgUploadError: string
    onOverlayBackgroundChange: (event: ChangeEvent<HTMLInputElement>) => Promise<void>
    setOverlayBgUrl: (value: string) => void
    setOverlayBgPreview: (value: string) => void
    setOverlayBgUploadError: (value: string) => void
}
