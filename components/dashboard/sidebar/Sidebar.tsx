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
}

export function Sidebar({ user, navItems, organizations }: SidebarProps) {
    const router = useRouter()
    const pathname = usePathname()
    const params = useParams()

    // --- ÉTATS ---
    const [collapsed] = useState(false)
    const [showOrgDropdown, setShowOrgDropdown] = useState(false) // Pour le switch d'org
    const [forceGlobalView, setForceGlobalView] = useState(false)

    // --- SYNCHRO ORG ACTIVE ---
    const activeOrg = useMemo(() => {
        const urlSlug = params?.slug as string
        return organizations.find(o => o.slug === urlSlug) || organizations[0]
    }, [params?.slug, organizations])

    const isOnOrgPage = pathname.startsWith("/dashboard/org")
    const isShowingOrgMenu = isOnOrgPage && !forceGlobalView

    const getDynamicHref = (href: string) => {
        if (href.includes("[slug]")) {
            return href.replace("[slug]", activeOrg?.slug || activeOrg?.id || "")
        }
        return href
    }

    const displayItems = useMemo(() => {
        const filtered = isShowingOrgMenu
            ? navItems.filter(item => item.context === NavigationContext.ORGANIZATION)
            : navItems.filter(item => item.context !== NavigationContext.ORGANIZATION)

        return [...filtered].sort((a, b) => (a.order || 0) - (b.order || 0))
    }, [navItems, isShowingOrgMenu])

    return (
        <aside style={{
            width: collapsed ? 64 : 260,
            transition: "width 0.25s ease",
            display: "flex", flexDirection: "column", height: "100vh",
            background: "#0d1117", borderRight: "1px solid #30363d",
            position: "relative", zIndex: 100
        }}>

            {/* --- HEADER --- */}
            <div style={{
                height: 56, display: "flex", alignItems: "center", padding: "0 16px",
                justifyContent: collapsed ? "center" : "space-between",
                borderBottom: "1px solid #30363d"
            }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {isShowingOrgMenu ? (
                        <button
                            onClick={() => setForceGlobalView(true)}
                            style={{ background: "#21262d", border: "none", borderRadius: 6, width: 28, height: 28, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                        >
                            <Icon d={Icons.chevronLeft} size={14} color="white" />
                        </button>
                    ) : (
                        <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #4f46e5, #9333ea)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <Icon d={Icons.controller} size={14} color="white" />
                        </div>
                    )}
                    {!collapsed && (
                        <span style={{ fontWeight: 800, fontSize: 16, color: "white" }}>
                            {isShowingOrgMenu ? "ORG" : "HUB"}<span style={{ color: "#4f46e5" }}>{isShowingOrgMenu ? "ADMIN" : "GAMERS"}</span>
                        </span>
                    )}
                </div>
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
                                padding: "10px", background: isShowingOrgMenu ? "#1c2128" : "#161b22",
                                borderRadius: 8, border: `1px solid ${isShowingOrgMenu ? "#4f46e5" : "#30363d"}`,
                                cursor: "pointer", transition: "all 0.2s"
                            }}
                        >
                            <Avatar name={activeOrg?.name} size={24} />
                            <div style={{ flex: 1, textAlign: "left", minWidth: 0 }}>
                                <div style={{ fontSize: 10, color: "#8b949e", fontWeight: 700, textTransform: "uppercase" }}>
                                    {isShowingOrgMenu ? "Structure Active" : "Accéder à l'org"}
                                </div>
                                <div style={{ fontSize: 12, fontWeight: 600, color: "white", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {activeOrg?.name}
                                </div>
                            </div>
                            <Icon d={showOrgDropdown ? Icons.chevronUp : Icons.chevronDown} size={12} color="#8b949e" />
                        </button>

                        {/* --- DROPDOWN : SWITCHER D'ORGANISATION --- */}
                        {showOrgDropdown && (
                            <div style={{
                                position: "absolute", top: "100%", left: 12, right: 12,
                                background: "#161b22", border: "1px solid #30363d",
                                borderRadius: 8, marginTop: 4, zIndex: 110, boxShadow: "0 10px 30px rgba(0,0,0,0.5)"
                            }}>
                                <div style={{ padding: "8px 12px", fontSize: 10, color: "#8b949e", fontWeight: 700 }}>CHANGER D&apos;ORGANISATION</div>
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
                                                cursor: "pointer", background: org.id === activeOrg.id ? "#21262d" : "transparent",
                                                borderLeft: org.id === activeOrg.id ? "3px solid #4f46e5" : "3px solid transparent"
                                            }}
                                        >
                                            <Avatar name={org.name} size={20} />
                                            <span style={{ fontSize: 12, color: org.id === activeOrg.id ? "white" : "#c9d1d9" }}>{org.name}</span>
                                        </div>
                                    ))}
                                </div>
                                <button
                                    onClick={() => router.push("/dashboard/org/create")}
                                    style={{
                                        width: "100%", padding: "10px 12px", background: "none", border: "none",
                                        borderTop: "1px solid #30363d", color: "#58a6ff", fontSize: 12,
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
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#8b949e", textTransform: "uppercase", padding: "0 12px 8px" }}>
                        {isShowingOrgMenu ? "Gestion Interne" : "Navigation Hub"}
                    </div>
                )}
                {displayItems.map((item) => {
                    const realHref = getDynamicHref(item.href)
                    const isActive = pathname === realHref
                    // On récupère si l'item appartient au contexte ADMIN_SaaS
                    const isAdminItem = item.context === NavigationContext.ADMIN_SaaS

                    return (
                        <div key={item.href} onClick={() => router.push(realHref)}
                            style={{
                                display: "flex", alignItems: "center", gap: 12,
                                padding: collapsed ? "12px 0" : "10px 12px",
                                justifyContent: collapsed ? "center" : "flex-start",
                                borderRadius: 8, cursor: "pointer",
                                background: isActive ? "rgba(79, 70, 229, 0.15)" : "transparent",
                                color: isActive ? "#818cf8" : "#8b949e",
                                marginBottom: 4, transition: "all 0.2s"
                            }}
                        >
                            <Icon d={Icons[item.icon as keyof typeof Icons]} size={18} />

                            {/* Badge ADMIN : On le garde même en mode collapsed ? 
                    Ici il s'affiche à côté du label quand c'est ouvert */}
                            {isAdminItem && !collapsed && (
                                <span style={{
                                    fontSize: 9, fontWeight: 800,
                                    background: isActive ? "#4f46e5" : "#30363d",
                                    color: isActive ? "white" : "#8b949e",
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

            <SidebarFooter user={user} router={router} collapsed={collapsed} />
        </aside>
    )
}