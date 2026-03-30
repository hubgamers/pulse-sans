"use client"

import { useState, useMemo } from "react"
import { useRouter, usePathname, useParams } from "next/navigation"
import { Icons, Icon } from "../icons"
import { Avatar } from "../ui-components"
import { NavigationContext, NavigationItem, Organization } from "@prisma/client"
import SidebarFooter from "./SidebarFooter"

interface SidebarProps {
    user: {
        name: string
        email?: string
        avatar?: string | null
        role: "ADMIN" | "USER"
    }
    navItems: NavigationItem[]
    organizations: Organization[]
    collapsed: boolean
    onToggleCollapse: () => void
}

export function Sidebar({ user, navItems, organizations, collapsed, onToggleCollapse }: SidebarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const params = useParams()

    // --- ÉTATS ---
    const [showOrgDropdown, setShowOrgDropdown] = useState(false) // Pour le switch d'org
    const [forceGlobalView, setForceGlobalView] = useState(false)

    // --- SYNCHRO ORG ACTIVE ---
    const activeOrg = useMemo(() => {
        const urlSlug = params?.slug as string
        return organizations.find(o => o.slug === urlSlug) || organizations[0]
    }, [params?.slug, organizations])

    const isOnOrgPage = pathname.startsWith("/dashboard/org")
    const isShowingOrgMenu = isOnOrgPage && !forceGlobalView && organizations.length > 0
    const isShowingAdminMenu = pathname.startsWith("/admin")

    const getDynamicHref = (href: string) => {
        if (href.includes("[slug]")) {
            return href.replace("[slug]", activeOrg?.slug || activeOrg?.id || "")
        }
        return href
    }

    console.log(navItems)

    const displayItems = useMemo(() => {
        const filtered = isShowingOrgMenu
            ? navItems.filter(item => item.context === NavigationContext.ORGANIZATION)
            : isShowingAdminMenu ? navItems.filter(item => item.context === NavigationContext.ADMIN_SaaS)
            : navItems.filter(item => item.context !== NavigationContext.ORGANIZATION && item.context !== NavigationContext.ADMIN_SaaS)

        return [...filtered].sort((a, b) => (a.order || 0) - (b.order || 0))
    }, [navItems, isShowingOrgMenu, isShowingAdminMenu])

    return (
        <aside style={{
            width: collapsed ? 64 : 240,
            transition: "width 0.25s ease",
            display: "flex", flexDirection: "column", height: "100vh",
            background: "var(--surface)", borderRight: "1px solid var(--border)",
            position: "relative", zIndex: 100
        }}>

            {/* --- HEADER --- */}
            <div style={{
                height: 56, display: "flex", alignItems: "center", padding: collapsed ? "0 10px" : "0 16px",
                justifyContent: "space-between",
                borderBottom: "1px solid var(--border)"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isShowingOrgMenu ? (
                        <button
                            onClick={() => setForceGlobalView(true)}
                            style={{ background: "var(--elevated)", border: "1px solid var(--border)", borderRadius: 6, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <Icon d={Icons.chevronLeft} size={14} color="var(--text)" />
                        </button>
                    ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #0f766e, #0ea5a4)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon d={Icons.controller} size={14} color="white" />
                        </div>
                    )}
                    {!collapsed && (
                        <span style={{ fontWeight: 800, fontSize: 16, color: "var(--text)" }}>
                            {isShowingOrgMenu ? "ORG" : "HUB"}<span style={{ color: "var(--accent)" }}>{isShowingOrgMenu ? "ADMIN" : "GAMERS"}</span>
                        </span>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    aria-label={collapsed ? "Ouvrir la sidebar" : "Réduire la sidebar"}
                    title={collapsed ? "Ouvrir la sidebar" : "Réduire la sidebar"}
                    style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        border: "1px solid var(--border)",
                        background: "var(--elevated)",
                        color: "var(--muted)",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                    }}
                >
                    <Icon d={collapsed ? Icons.chevronRight : Icons.chevronLeft} size={14} color="currentColor" />
                </button>
            </div>

            {/* --- SELECTEUR D'ORGANISATION (L'aimant à clics) --- */}
            {!collapsed && organizations.length > 0 && (
                <div style={{ padding: "12px", position: "relative" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        <button
                            onClick={() => {
                                if (!isOnOrgPage) {
                                    // Si on est sur le Hub -> On entre dans l'org
                                    setShowOrgDropdown(false)
                                    router.push(`/dashboard/org/${activeOrg.slug}`)
                                } else if (forceGlobalView) {
                                    // Si on a forcé la vue globale -> On revient dans le menu org
                                    setForceGlobalView(false)
                                    setShowOrgDropdown(false)
                                } else {
                                    // Sinon -> On ouvre le switch d'organisation
                                    setShowOrgDropdown(!showOrgDropdown)
                                }
                            }}
                            style={{
                                width: "100%", display: "flex", alignItems: "center", gap: 10,
                                padding: "10px", background: "var(--elevated)",
                                borderRadius: 8, border: `1px solid ${isShowingOrgMenu ? "var(--accent)" : "var(--border)"}`,
                                cursor: "pointer", transition: "all 0.2s"
                            }}
                        >
                            <Avatar name={activeOrg?.name} size={24} />
                            <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: "var(--muted)", fontWeight: 700, textTransform: "uppercase" }}>
                                    {isShowingOrgMenu ? "Organisation Active" : "Accéder à l'org"}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {activeOrg?.name}
                                </div>
                            </div>
                            <Icon d={showOrgDropdown ? Icons.chevronUp : Icons.chevronDown} size={12} color="var(--muted)" />
                        </button>

                        {/* --- DROPDOWN : SWITCHER D'ORGANISATION --- */}
                        {showOrgDropdown && (
                            <div style={{
                                position: "absolute", top: "100%", left: 12, right: 12,
                                background: "var(--surface)", border: "1px solid var(--border2)",
                                borderRadius: 8, marginTop: 4, zIndex: 110, boxShadow: "0 10px 24px rgba(15,23,42,0.16)"
                            }}>
                                <div style={{ padding: "8px 12px", fontSize: 10, color: "var(--muted)", fontWeight: 700 }}>CHANGER D&apos;ORGANISATION</div>
                                <div style={{ maxHeight: "200px", overflowY: "auto" }}>
                                    {organizations.map(org => (
                                        <div
                                            key={org.id}
                                            onClick={() => {
                                                router.push(`/dashboard/org/${org.slug}`)
                                                setShowOrgDropdown(false)
                                            }}
                                            style={{
                                                display: "flex", alignItems: "center", gap: 10, padding: "10px 12px",
                                                cursor: "pointer", background: org.id === activeOrg.id ? "#f0fdfa" : "transparent",
                                                borderLeft: org.id === activeOrg.id ? "3px solid var(--accent)" : "3px solid transparent"
                                            }}
                                        >
                                            <Avatar name={org.name} size={20} />
                                            <span style={{ fontSize: 12, color: org.id === activeOrg.id ? "var(--text)" : "var(--muted)" }}>{org.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => router.push("/dashboard/org/create")}
                                    style={{
                                        width: "100%", padding: "10px 12px", background: "none", border: "none",
                                        borderTop: "1px solid var(--border)", color: "var(--accent)", fontSize: 12,
                                        cursor: "pointer", display: "flex", alignItems: "center", gap: 8
                                    }}
                                >
                                    <Icon d={Icons.plus} size={14} /> Créer une structure
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* --- NAVIGATION --- */}
            <nav style={{ flex: 1, padding: "12px", overflowY: "auto" }}>
                {!collapsed && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", padding: "0 12px 8px" }}>
                        {isShowingOrgMenu ? "Gestion Organisation" : ""}
                    </div>
                )}
                {displayItems.map((item) => {
                    const realHref = getDynamicHref(item.href)
                    const isActive = pathname === realHref
                    // On récupère si l'item appartient au contexte ADMIN_SaaS
                    const isAdminItem = item.context === NavigationContext.ADMIN_SaaS
                    const iconPath = Icons[item.icon as keyof typeof Icons] ?? Icons.grid

                    return (
                        <div key={item.href} onClick={() => router.push(realHref)}
                            style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: collapsed ? "12px 0" : "10px 12px",
                                justifyContent: collapsed ? "center" : "flex-start",
                                borderRadius: 8, cursor: "pointer",
                                background: isActive ? "#ecfeff" : "transparent",
                                color: isActive ? "var(--accent)" : "var(--muted)",
                                marginBottom: 4, transition: "all 0.2s"
                            }}
                        >
                            <Icon d={iconPath} size={18} />

                            {/* Badge ADMIN : On le garde même en mode collapsed ? 
                    Ici il s'affiche à côté du label quand c'est ouvert */}
                            {isAdminItem && !collapsed && (
                                <span style={{
                                    fontSize: 9, fontWeight: 800,
                                    background: isActive ? "var(--accent)" : "var(--elevated)",
                                    color: isActive ? "white" : "var(--muted)",
                                    padding: "2px 5px", borderRadius: 4, textTransform: "uppercase"
                                }}>
                                    Admin
                                </span>
                            )}

                            {!collapsed && (
                                <span style={{ fontSize: 14, fontWeight: isActive ? 600 : 500 }}>
                                    {item.label}
                                </span>
                            )}
                        </div>
                    )
                })}
            </nav>

            {/* CTA : Créer une org quand l'utilisateur n'en a pas encore */}
            {!collapsed && organizations.length === 0 && (
                <div style={{ padding: "12px", borderTop: "1px solid var(--border)" }}>
                    <button
                        onClick={() => router.push("/dashboard/org/create")}
                        style={{
                            width: "100%", padding: "10px 12px", borderRadius: 8,
                            background: "var(--elevated)", border: "1px dashed var(--accent)",
                            color: "var(--accent)", cursor: "pointer", fontSize: 12,
                            fontWeight: 600, display: "flex", alignItems: "center", gap: 8,
                            transition: "background 0.15s"
                        }}
                    >
                        <Icon d={Icons.plus} size={14} color="var(--accent)" />
                        Créer une organisation
                    </button>
                </div>
            )}

            <SidebarFooter user={user} router={router} collapsed={collapsed} />
        </aside>
    )
}