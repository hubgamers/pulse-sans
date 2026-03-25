import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'Édition - Placement Bracket | HubGamers',
    description: 'Édition des résultats du placement bracket',
}

export default function ExternalLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <div className="bg-slate-900">
            {children}
        </div>
    )
}
