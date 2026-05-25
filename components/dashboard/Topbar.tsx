// components/dashboard/topbar.tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icons, Icon } from "./icons"
import { Avatar } from "./ui-components"

interface Notification {
    id: string;
    type: 'match' | 'member' | 'tournament';
    message: string;
    time: string;
    read: boolean;
    href?: string;
}

interface TopbarProps {
    user: { name: string; avatar?: string | null };
    notifications: Notification[];
    onMarkAllRead: () => void;
    onSearchClick: () => void;
    collapsed: boolean;
    onToggleSidebar: () => void;
}

export function Topbar({ user, notifications, onMarkAllRead, onSearchClick, collapsed, onToggleSidebar }: TopbarProps) {
    const [showNotifs, setShowNotifs] = useState(false)
    const router = useRouter()
    const unreadCount = notifications.filter(n => !n.read).length

    // Utilitaire pour le style des icônes de notifications
    const getNotifStyle = (type: Notification['type']) => {
        switch (type) {
            case "match": return { bg: "#f43f5e18", color: "var(--danger)", icon: Icons.flame };
            case "member": return { bg: "#10b98118", color: "var(--success)", icon: Icons.players };
            default: return { bg: "#7c3aed18", color: "var(--accent2)", icon: Icons.trophy };
        }
    };

    return (
        <header className="hub-topbar">
            <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={collapsed ? "Ouvrir la sidebar" : "Réduire la sidebar"}
                title={collapsed ? "Ouvrir la sidebar" : "Réduire la sidebar"}
                className="sidebar-toggle-btn"
            >
                <Icon d={collapsed ? Icons.chevronRight : Icons.chevronLeft} size={16} />
            </button>

            {/* 1. BARRE DE RECHERCHE (TRIGGER) */}
            <button onClick={onSearchClick} className="search-trigger">
                <Icon d={Icons.search} size={14} />
                <span>Rechercher...</span>
                <span className="search-kbd">⌘K</span>
            </button>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
                <button
                    type="button"
                    onClick={() => router.push("/dashboard/help")}
                    className="notif-btn"
                    aria-label="Ouvrir l'aide"
                    title="Aide"
                >
                    <Icon d={Icons.help} size={17} />
                </button>

                {/* 2. NOTIFICATIONS */}
                <div style={{ position: "relative" }}>
                    <button
                        onClick={() => setShowNotifs(!showNotifs)}
                        className={`notif-btn ${showNotifs ? "active" : ""}`}
                    >
                        <Icon d={Icons.bell} size={17} />
                        {unreadCount > 0 && <span className="notif-badge-dot" />}
                    </button>

                    {/* Dropdown Notifications */}
                    {showNotifs && (
                        <div className="dropdown notif-dropdown">
                            <div className="dropdown-header">
                                <span>Notifications</span>
                                {unreadCount > 0 && (
                                    <button onClick={onMarkAllRead} className="text-action-btn">
                                        Tout lire
                                    </button>
                                )}
                            </div>

                            <div className="notif-list">
                                {notifications.map(n => {
                                    const style = getNotifStyle(n.type);
                                    return (
                                        <button
                                            key={n.id}
                                            type="button"
                                            className={`notif-item ${n.read ? "read" : "unread"}`}
                                            onClick={() => {
                                                if (!n.href) return;
                                                setShowNotifs(false);
                                                router.push(n.href);
                                            }}
                                            style={{ width: "100%", border: "none", textAlign: "left", cursor: n.href ? "pointer" : "default" }}
                                        >
                                            <div className="notif-icon" style={{ background: style.bg, color: style.color }}>
                                                <Icon d={style.icon} size={14} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="notif-msg">{n.message}</div>
                                                <div className="notif-time">{n.time}</div>
                                            </div>
                                            {!n.read && <div className="unread-indicator" />}
                                        </button>
                                    );
                                })}

                                {notifications.length === 0 && (
                                    <div className="empty-state">Aucune notification</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. USER AVATAR */}
                <Avatar name={user.name} src={user.avatar ?? undefined} size={30} />
            </div>
        </header>
    )
}
