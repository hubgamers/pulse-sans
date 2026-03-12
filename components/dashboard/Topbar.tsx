// components/dashboard/topbar.tsx
"use client"

import { useState } from "react"
import { Icons, Icon } from "./icons"
import { Avatar } from "./ui-components"

interface Notification {
    id: string;
    type: 'match' | 'member' | 'tournament';
    message: string;
    time: string;
    read: boolean;
}

interface TopbarProps {
    user: { name: string; avatar?: string | null };
    notifications: Notification[];
    onMarkAllRead: () => void;
    onSearchClick: () => void;
}

export function Topbar({ user, notifications, onMarkAllRead, onSearchClick }: TopbarProps) {
    const [showNotifs, setShowNotifs] = useState(false)
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
            {/* 1. BARRE DE RECHERCHE (TRIGGER) */}
            <button onClick={onSearchClick} className="search-trigger">
                <Icon d={Icons.search} size={14} />
                <span>Rechercher...</span>
                <span className="search-kbd">⌘K</span>
            </button>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>

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
                                        <div key={n.id} className={`notif-item ${n.read ? "read" : "unread"}`}>
                                            <div className="notif-icon" style={{ background: style.bg, color: style.color }}>
                                                <Icon d={style.icon} size={14} />
                                            </div>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div className="notif-msg">{n.message}</div>
                                                <div className="notif-time">{n.time}</div>
                                            </div>
                                            {!n.read && <div className="unread-indicator" />}
                                        </div>
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