// components/dashboard/ui-components.tsx
import Image from "next/image"

export function OrgTypePill({ type }: { type: "SPORT" | "ESPORT" | "MIXED" }) {
    const map = {
        ESPORT: { label: "Esport", color: "#a78bfa" },
        SPORT: { label: "Sport", color: "#34d399" },
        MIXED: { label: "Mixte", color: "#fb923c" },
    }
    const { label, color } = map[type]
    return (
        <span style={{
            fontSize: 9, fontWeight: 700, letterSpacing: "0.08em",
            color, border: `1px solid ${color}30`,
            background: `${color}12`, borderRadius: 4,
            padding: "1px 5px", textTransform: "uppercase",
        }}>{label}</span>
    )
}

export function Avatar({ name, size = 32, src }: { name: string; size?: number; src?: string }) {
    const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
    const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
    return src ? (
        <Image
            src={src}
            alt={name}
            width={size}
            height={size}
            unoptimized
            style={{ borderRadius: "50%", objectFit: "cover" }}
        />
    ) : (
        <div style={{
            width: size, height: size, borderRadius: "50%",
            background: `hsl(${hue}, 60%, 35%)`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: size * 0.36, fontWeight: 700, color: `hsl(${hue}, 80%, 85%)`,
            flexShrink: 0, fontFamily: "inherit",
        }}>{initials}</div>
    )
}