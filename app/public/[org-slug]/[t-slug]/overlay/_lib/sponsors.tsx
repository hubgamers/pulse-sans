export type OverlaySponsor = {
    id: string
    name: string
    logoUrl: string
}

export type OverlaySponsorConfig = {
    sponsors: OverlaySponsor[]
}

function normalizeSponsor(raw: unknown, index: number): OverlaySponsor | null {
    if (!raw || typeof raw !== 'object') return null
    const item = raw as Record<string, unknown>
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const logoUrl = typeof item.logoUrl === 'string' ? item.logoUrl.trim() : ''
    if (!name || !logoUrl) return null

    return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id.trim() : `sponsor-${index}`,
        name,
        logoUrl,
    }
}

export function readOverlaySponsors(config: unknown): OverlaySponsor[] {
    if (!config || typeof config !== 'object') return []
    const rawSponsors = (config as { sponsors?: unknown }).sponsors
    if (!Array.isArray(rawSponsors)) return []

    return rawSponsors
        .map((item, index) => normalizeSponsor(item, index))
        .filter((item): item is OverlaySponsor => Boolean(item))
        .slice(0, 12)
}

export function OverlaySponsorStrip({
    sponsors,
    variant = 'dark',
}: {
    sponsors: OverlaySponsor[]
    variant?: 'dark' | 'light'
}) {
    if (sponsors.length === 0) return null

    const frameClass = variant === 'light'
        ? 'border-slate-200 bg-white/90 text-slate-500 shadow-sm'
        : 'border-white/10 bg-slate-950/70 text-slate-300 shadow-2xl'
    const logoClass = variant === 'light'
        ? 'bg-white'
        : 'bg-white/95'

    return (
        <aside className={`pointer-events-none fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-2 backdrop-blur-md ${frameClass}`}>
            <span className="shrink-0 text-[10px] font-black uppercase tracking-[0.18em]">Sponsors</span>
            <div className="flex min-w-0 items-center gap-2 overflow-hidden">
                {sponsors.map((sponsor) => (
                    <div key={sponsor.id} className={`flex h-10 w-24 shrink-0 items-center justify-center rounded-lg px-2 ${logoClass}`}>
                        <img src={sponsor.logoUrl} alt={sponsor.name} className="max-h-8 max-w-full object-contain" />
                    </div>
                ))}
            </div>
        </aside>
    )
}
