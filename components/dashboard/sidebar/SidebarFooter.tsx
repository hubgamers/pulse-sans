import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Icon, Icons } from "../icons";
import { Avatar } from "../ui-components";

interface SidebarFooterProps {
    user: {
        name: string;
        email?: string;
        avatar?: string | null;
        role: "ADMIN" | "USER";
    };
    router: { push: (href: string) => void };
    collapsed: boolean;
}

export default function SidebarFooter({ user, router, collapsed }: SidebarFooterProps) {
    const [isSigningOut, setIsSigningOut] = useState(false);

    const handleSignOut = async () => {
        const supabase = createClient();
        setIsSigningOut(true);

        try {
            await supabase.auth.signOut();
        } finally {
            router.push("/auth");
        }
    };

    return (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px" }}>
            {user.role === "ADMIN" && !collapsed && (
                <button
                    onClick={() => router.push("/admin")}
                    style={{
                        width: "100%", padding: "8px", borderRadius: 6, marginBottom: 12,
                        background: "#ecfeff", border: "1px solid var(--accent)",
                        color: "var(--accent)", fontSize: 10, fontWeight: 800, cursor: "pointer"
                    }}
                >
                    Espace admin
                </button>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: collapsed ? "center" : "flex-start" }}>
                <Avatar name={user.name} src={user.avatar ?? undefined} size={32} />
                {!collapsed && (
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{user.name}</div>
                        <div style={{ fontSize: 11, color: "var(--muted)" }}>{user.email}</div>
                    </div>
                )}
            </div>

            <button
                type="button"
                onClick={() => void handleSignOut()}
                disabled={isSigningOut}
                aria-label="Se déconnecter"
                style={{
                    width: collapsed ? 40 : "100%",
                    marginTop: 12,
                    padding: collapsed ? "10px" : "10px 12px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--elevated)",
                    color: "var(--muted)",
                    cursor: isSigningOut ? "wait" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: collapsed ? "center" : "space-between",
                    gap: 10,
                    fontSize: 12,
                    fontWeight: 600,
                    opacity: isSigningOut ? 0.7 : 1,
                    transition: "all 0.15s"
                }}
            >
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <Icon d={Icons.logout} size={16} color="currentColor" />
                    {!collapsed && <span>{isSigningOut ? "Déconnexion..." : "Se déconnecter"}</span>}
                </span>
            </button>
        </div>
    )
}