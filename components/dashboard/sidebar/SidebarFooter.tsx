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
    return (
        <div style={{ borderTop: "1px solid var(--border)", padding: "12px" }}>
            {user.role === "ADMIN" && !collapsed && (
                <button
                    onClick={() => router.push("/dashboard")}
                    style={{
                        width: "100%", padding: "8px", borderRadius: 6, marginBottom: 12,
                        background: "#4f46e510", border: "1px solid #4f46e5",
                        color: "#4f46e5", fontSize: 10, fontWeight: 800, cursor: "pointer"
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
        </div>
    )
}