"use client"

import { useState, useEffect } from "react"

// ── Icons (inline SVG pour éviter les dépendances) ──────────────────────────

const Icon = ({ d, size = 20 }: { d: string; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const Icons = {
  dashboard:     "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  tournaments:   "M8 21H5a2 2 0 01-2-2v-3m18 5h-3a2 2 0 01-2-2v-3M3 10V5a2 2 0 012-2h3m10 0h3a2 2 0 012 2v5",
  teams:         "M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75",
  players:       "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  settings:      "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z",
  chevronLeft:   "M15 18l-6-6 6-6",
  chevronRight:  "M9 18l6-6-6-6",
  bell:          "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0",
  search:        "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z",
  plus:          "M12 5v14M5 12h14",
  controller:    "M6 12h4m2 0h4M8 10v4M18.5 9.5l-1 5M5.5 9.5l1 5M3 8h18a1 1 0 011 1v6a1 1 0 01-1 1H3a1 1 0 01-1-1V9a1 1 0 011-1z",
  logout:        "M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9",
  trophy:        "M6 9H4.5a2.5 2.5 0 010-5H6M18 9h1.5a2.5 2.5 0 000-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0012 0V2z",
  flame:         "M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 3z",
  grid:          "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
}

// ── Types ────────────────────────────────────────────────────────────────────

type NavItem = {
  label: string
  icon: keyof typeof Icons
  href: string
  badge?: number
}

type Organization = {
  id: string
  name: string
  slug: string
  type: "SPORT" | "ESPORT" | "MIXED"
  logoUrl?: string
  role: string
}

type Notification = {
  id: string
  message: string
  time: string
  read: boolean
  type: "match" | "member" | "tournament"
}

// ── Mock data ────────────────────────────────────────────────────────────────

const MOCK_ORGS: Organization[] = [
  { id: "1", name: "Thunder Esport", slug: "thunder-esport", type: "ESPORT", role: "OWNER" },
  { id: "2", name: "FC Rouen", slug: "fc-rouen", type: "SPORT", role: "ADMIN" },
  { id: "3", name: "All Stars Club", slug: "all-stars", type: "MIXED", role: "MEMBER" },
]

const MOCK_NOTIFS: Notification[] = [
  { id: "1", message: "Match Thunder vs Shadow — résultat enregistré", time: "Il y a 5 min", read: false, type: "match" },
  { id: "2", message: "Novo a rejoint Thunder Esport", time: "Il y a 1h", read: false, type: "member" },
  { id: "3", message: "Tournoi Spring 2026 ouvert aux inscriptions", time: "Il y a 3h", read: true, type: "tournament" },
]

const NAV_ITEMS: NavItem[] = [
  { label: "Vue d'ensemble", icon: "grid",        href: "/dashboard" },
  { label: "Tournois",       icon: "trophy",      href: "/dashboard/tournaments", badge: 2 },
  { label: "Équipes",        icon: "teams",       href: "/dashboard/teams" },
  { label: "Joueurs",        icon: "players",     href: "/dashboard/players" },
  { label: "Paramètres",     icon: "settings",    href: "/dashboard/settings" },
]

// ── Composants UI ─────────────────────────────────────────────────────────────

function OrgTypePill({ type }: { type: Organization["type"] }) {
  const map = {
    ESPORT: { label: "Esport", color: "#a78bfa" },
    SPORT:  { label: "Sport",  color: "#34d399" },
    MIXED:  { label: "Mixte",  color: "#fb923c" },
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

function Avatar({ name, size = 32, src }: { name: string; size?: number; src?: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const hue = name.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
  return src ? (
    <img src={src} alt={name} width={size} height={size}
      style={{ borderRadius: "50%", objectFit: "cover" }} />
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

// ── Layout Principal ──────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children?: React.ReactNode }) {
  const [collapsed, setCollapsed]         = useState(false)
  const [activeOrg, setActiveOrg]         = useState(MOCK_ORGS[0])
  const [activeNav, setActiveNav]         = useState("/dashboard")
  const [showNotifs, setShowNotifs]       = useState(false)
  const [showOrgMenu, setShowOrgMenu]     = useState(false)
  const [showSearch, setShowSearch]       = useState(false)
  const [searchQuery, setSearchQuery]     = useState("")
  const [notifs, setNotifs]               = useState(MOCK_NOTIFS)
  const [mounted, setMounted]             = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const unreadCount = notifs.filter(n => !n.read).length
  const W_OPEN = 240
  const W_CLOSED = 64

  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })))

  if (!mounted) return null

  return (
    <>
      {/* ── Google Fonts ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        :root {
          --bg:        #080b10;
          --surface:   #0d1117;
          --elevated:  #131920;
          --border:    #1e2730;
          --border2:   #242f3a;
          --text:      #e2e8f0;
          --muted:     #64748b;
          --accent:    #00e5ff;
          --accent2:   #7c3aed;
          --danger:    #f43f5e;
          --success:   #10b981;
          --warning:   #f59e0b;
          --sidebar-w: ${collapsed ? W_CLOSED : W_OPEN}px;
        }

        body { background: var(--bg); color: var(--text); font-family: 'DM Sans', sans-serif; }

        .hub-layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background: var(--bg);
        }

        /* ── Sidebar ── */
        .hub-sidebar {
          width: var(--sidebar-w);
          min-width: var(--sidebar-w);
          height: 100vh;
          background: var(--surface);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          transition: width 0.25s cubic-bezier(.4,0,.2,1),
                      min-width 0.25s cubic-bezier(.4,0,.2,1);
          overflow: hidden;
          position: relative;
          z-index: 30;
        }

        /* ── Topbar ── */
        .hub-topbar {
          height: 56px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 20px;
          gap: 12px;
          position: sticky;
          top: 0;
          z-index: 20;
        }

        /* ── Main ── */
        .hub-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }

        .hub-content {
          flex: 1;
          overflow-y: auto;
          padding: 28px;
        }

        /* ── Nav items ── */
        .nav-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: ${collapsed ? "10px 0" : "9px 12px"};
          ${collapsed ? "justify-content: center;" : ""}
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
          color: var(--muted);
          text-decoration: none;
          position: relative;
          white-space: nowrap;
          overflow: hidden;
          font-size: 13.5px;
          font-weight: 500;
          letter-spacing: 0.01em;
          margin: 1px 0;
        }
        .nav-item:hover { background: var(--elevated); color: var(--text); }
        .nav-item.active {
          background: #00e5ff12;
          color: var(--accent);
        }
        .nav-item.active::before {
          content: '';
          position: absolute;
          left: 0; top: 20%; bottom: 20%;
          width: 2px;
          background: var(--accent);
          border-radius: 2px;
        }

        /* ── Org button ── */
        .org-btn {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border-radius: 8px;
          background: var(--elevated);
          border: 1px solid var(--border2);
          cursor: pointer;
          transition: all 0.15s;
          text-align: left;
          overflow: hidden;
          white-space: nowrap;
        }
        .org-btn:hover { border-color: var(--accent); }

        /* ── Dropdown ── */
        .dropdown {
          position: absolute;
          background: var(--elevated);
          border: 1px solid var(--border2);
          border-radius: 10px;
          box-shadow: 0 16px 48px #00000080;
          z-index: 100;
          overflow: hidden;
          animation: fadeIn 0.12s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Search overlay ── */
        .search-overlay {
          position: fixed;
          inset: 0;
          background: #00000090;
          backdrop-filter: blur(4px);
          z-index: 200;
          display: flex;
          align-items: flex-start;
          justify-content: center;
          padding-top: 120px;
          animation: fadeIn 0.15s ease;
        }
        .search-box {
          width: 560px;
          background: var(--elevated);
          border: 1px solid var(--border2);
          border-radius: 14px;
          overflow: hidden;
          box-shadow: 0 24px 64px #00000090;
        }
        .search-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: 'DM Sans', sans-serif;
          font-size: 16px;
          padding: 18px 20px;
        }

        /* ── Notif badge ── */
        .notif-badge {
          position: absolute;
          top: 8px; right: 8px;
          width: 8px; height: 8px;
          border-radius: 50%;
          background: var(--danger);
          border: 2px solid var(--surface);
        }

        /* ── Scrollbar ── */
        .hub-content::-webkit-scrollbar { width: 4px; }
        .hub-content::-webkit-scrollbar-track { background: transparent; }
        .hub-content::-webkit-scrollbar-thumb { background: var(--border2); border-radius: 4px; }

        /* ── Stat cards ── */
        .stat-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 20px;
          transition: border-color 0.2s;
        }
        .stat-card:hover { border-color: var(--border2); }

        /* ── Glow line ── */
        .glow-line {
          height: 1px;
          background: linear-gradient(90deg, transparent, var(--accent)40, transparent);
          margin: 0;
        }
      `}</style>

      <div className="hub-layout">

        {/* ════════════════════════════════════════
            SIDEBAR
        ════════════════════════════════════════ */}
        <aside className="hub-sidebar">

          {/* Logo */}
          <div style={{
            height: 56, display: "flex", alignItems: "center",
            padding: collapsed ? "0" : "0 16px",
            justifyContent: collapsed ? "center" : "space-between",
            borderBottom: "1px solid var(--border)", flexShrink: 0,
          }}>
            {!collapsed && (
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6,
                  background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>
                  <Icon d={Icons.controller} size={14} />
                </div>
                <span style={{
                  fontFamily: "Syne, sans-serif", fontWeight: 800,
                  fontSize: 17, letterSpacing: "-0.02em", color: "var(--text)",
                }}>Hub<span style={{ color: "var(--accent)" }}>Gamers</span></span>
              </div>
            )}
            {collapsed && (
              <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: "linear-gradient(135deg, var(--accent), var(--accent2))",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Icon d={Icons.controller} size={14} />
              </div>
            )}
            <button onClick={() => setCollapsed(c => !c)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "var(--muted)", padding: 4, borderRadius: 6,
              display: "flex", alignItems: "center",
              transition: "color 0.15s",
            }}>
              <Icon d={collapsed ? Icons.chevronRight : Icons.chevronLeft} size={15} />
            </button>
          </div>

          {/* Org selector */}
          <div style={{ padding: collapsed ? "12px 8px" : "12px", flexShrink: 0, position: "relative" }}>
            <button className="org-btn"
              onClick={() => { setShowOrgMenu(o => !o); setShowNotifs(false) }}
              style={{ padding: collapsed ? "10px 0" : "10px 12px", justifyContent: collapsed ? "center" : "flex-start" }}
            >
              <Avatar name={activeOrg.name} size={26} />
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeOrg.name}
                  </div>
                  <OrgTypePill type={activeOrg.type} />
                </div>
              )}
            </button>

            {/* Org dropdown */}
            {showOrgMenu && (
              <div className="dropdown" style={{
                top: collapsed ? 0 : "100%",
                left: collapsed ? W_CLOSED + 8 : 12,
                right: collapsed ? "auto" : 12,
                width: collapsed ? 220 : "auto",
              }}>
                <div style={{ padding: "8px 0" }}>
                  {MOCK_ORGS.map(org => (
                    <button key={org.id} onClick={() => { setActiveOrg(org); setShowOrgMenu(false) }}
                      style={{
                        display: "flex", alignItems: "center", gap: 10,
                        width: "100%", padding: "9px 14px",
                        background: activeOrg.id === org.id ? "var(--border)" : "none",
                        border: "none", cursor: "pointer", color: "var(--text)",
                        fontFamily: "inherit", fontSize: 13, textAlign: "left",
                        transition: "background 0.1s",
                      }}
                    >
                      <Avatar name={org.name} size={24} />
                      <div>
                        <div style={{ fontWeight: 500 }}>{org.name}</div>
                        <OrgTypePill type={org.type} />
                      </div>
                    </button>
                  ))}
                </div>
                <div style={{ borderTop: "1px solid var(--border)", padding: "6px 0" }}>
                  <button style={{
                    display: "flex", alignItems: "center", gap: 8,
                    width: "100%", padding: "9px 14px",
                    background: "none", border: "none", cursor: "pointer",
                    color: "var(--accent)", fontFamily: "inherit", fontSize: 13,
                  }}>
                    <Icon d={Icons.plus} size={14} />
                    Nouvelle organisation
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="glow-line" />

          {/* Nav */}
          <nav style={{ flex: 1, padding: collapsed ? "12px 8px" : "12px", overflowY: "auto" }}>
            {!collapsed && (
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em",
                color: "var(--muted)", textTransform: "uppercase", padding: "4px 12px 8px" }}>
                Navigation
              </div>
            )}
            {NAV_ITEMS.map(item => (
              <div key={item.href} className={`nav-item ${activeNav === item.href ? "active" : ""}`}
                onClick={() => setActiveNav(item.href)}
                title={collapsed ? item.label : undefined}
              >
                <Icon d={Icons[item.icon]} size={17} />
                {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                {!collapsed && item.badge && (
                  <span style={{
                    background: "var(--accent2)", color: "#fff",
                    fontSize: 10, fontWeight: 700, borderRadius: 10,
                    padding: "1px 6px", minWidth: 18, textAlign: "center",
                  }}>{item.badge}</span>
                )}
                {collapsed && item.badge && (
                  <span style={{
                    position: "absolute", top: 6, right: 6,
                    width: 7, height: 7, borderRadius: "50%",
                    background: "var(--accent2)", border: "1.5px solid var(--surface)",
                  }} />
                )}
              </div>
            ))}
          </nav>

          {/* User profile */}
          <div style={{
            borderTop: "1px solid var(--border)",
            padding: collapsed ? "12px 8px" : "12px",
            flexShrink: 0,
          }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: collapsed ? "8px 0" : "8px",
              justifyContent: collapsed ? "center" : "flex-start",
              borderRadius: 8, cursor: "pointer",
            }}>
              <Avatar name="Alexandre D." size={30} />
              {!collapsed && (
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text)",
                    overflow: "hidden", textOverflow: "ellipsis" }}>Alexandre D.</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>alexandre@hub.gg</div>
                </div>
              )}
              {!collapsed && (
                <button style={{
                  background: "none", border: "none", cursor: "pointer",
                  color: "var(--muted)", padding: 4, borderRadius: 4,
                  display: "flex", alignItems: "center",
                }}>
                  <Icon d={Icons.logout} size={14} />
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* ════════════════════════════════════════
            MAIN
        ════════════════════════════════════════ */}
        <div className="hub-main">

          {/* Topbar */}
          <header className="hub-topbar">

            {/* Search trigger */}
            <button onClick={() => setShowSearch(true)} style={{
              display: "flex", alignItems: "center", gap: 8,
              background: "var(--elevated)", border: "1px solid var(--border2)",
              borderRadius: 8, padding: "6px 12px", cursor: "pointer",
              color: "var(--muted)", fontFamily: "inherit", fontSize: 13,
              transition: "all 0.15s", flex: 1, maxWidth: 320,
            }}>
              <Icon d={Icons.search} size={14} />
              <span>Rechercher...</span>
              <span style={{
                marginLeft: "auto", fontSize: 11,
                background: "var(--border)", borderRadius: 4,
                padding: "1px 6px", color: "var(--muted)",
              }}>⌘K</span>
            </button>

            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>

              {/* Notifications */}
              <div style={{ position: "relative" }}>
                <button onClick={() => { setShowNotifs(n => !n); setShowOrgMenu(false) }}
                  style={{
                    background: showNotifs ? "var(--elevated)" : "none",
                    border: "1px solid", borderColor: showNotifs ? "var(--border2)" : "transparent",
                    borderRadius: 8, padding: 7, cursor: "pointer",
                    color: showNotifs ? "var(--text)" : "var(--muted)",
                    display: "flex", alignItems: "center", transition: "all 0.15s",
                  }}>
                  <Icon d={Icons.bell} size={17} />
                </button>
                {unreadCount > 0 && <span className="notif-badge" />}

                {/* Notifications dropdown */}
                {showNotifs && (
                  <div className="dropdown" style={{ top: "calc(100% + 8px)", right: 0, width: 320 }}>
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "12px 16px", borderBottom: "1px solid var(--border)",
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>Notifications</span>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--accent)", fontSize: 12, fontFamily: "inherit",
                        }}>Tout lire</button>
                      )}
                    </div>
                    {notifs.map(n => (
                      <div key={n.id} style={{
                        padding: "12px 16px",
                        background: n.read ? "none" : "#00e5ff06",
                        borderBottom: "1px solid var(--border)",
                        display: "flex", gap: 10, alignItems: "flex-start",
                      }}>
                        <div style={{
                          width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                          background: n.type === "match" ? "#f43f5e18"
                            : n.type === "member" ? "#10b98118" : "#7c3aed18",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: n.type === "match" ? "var(--danger)"
                            : n.type === "member" ? "var(--success)" : "var(--accent2)",
                        }}>
                          <Icon d={n.type === "match" ? Icons.flame
                            : n.type === "member" ? Icons.players : Icons.trophy} size={14} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, color: "var(--text)", lineHeight: 1.4 }}>{n.message}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 3 }}>{n.time}</div>
                        </div>
                        {!n.read && (
                          <div style={{
                            width: 6, height: 6, borderRadius: "50%",
                            background: "var(--accent)", flexShrink: 0, marginTop: 4,
                          }} />
                        )}
                      </div>
                    ))}
                    {notifs.length === 0 && (
                      <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 13 }}>
                        Aucune notification
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Avatar */}
              <Avatar name="Alexandre D." size={30} />
            </div>
          </header>

          {/* Content */}
          <main className="hub-content"
            onClick={() => { setShowNotifs(false); setShowOrgMenu(false) }}>

            {/* Page title */}
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>
                  {activeOrg.name}
                </span>
                <span style={{ color: "var(--border2)" }}>›</span>
                <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500 }}>
                  Vue d'ensemble
                </span>
              </div>
              <h1 style={{
                fontFamily: "Syne, sans-serif", fontWeight: 800,
                fontSize: 26, letterSpacing: "-0.03em", color: "var(--text)",
              }}>
                Bonjour, Alexandre 👋
              </h1>
              <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
                Voici ce qui se passe dans {activeOrg.name} aujourd'hui.
              </p>
            </div>

            {/* Stat cards */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
              {[
                { label: "Tournois actifs",   value: "3",  delta: "+1",  color: "var(--accent)",  icon: Icons.trophy },
                { label: "Équipes",           value: "12", delta: "+2",  color: "#a78bfa",        icon: Icons.teams },
                { label: "Joueurs inscrits",  value: "84", delta: "+7",  color: "var(--success)", icon: Icons.players },
                { label: "Matchs ce mois",    value: "47", delta: "+12", color: "var(--warning)",  icon: Icons.flame },
              ].map(s => (
                <div key={s.label} className="stat-card">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 500 }}>{s.label}</span>
                    <div style={{
                      width: 30, height: 30, borderRadius: 8,
                      background: `${s.color}18`,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: s.color,
                    }}>
                      <Icon d={s.icon} size={14} />
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                    <span style={{
                      fontFamily: "Syne, sans-serif", fontWeight: 800,
                      fontSize: 28, color: "var(--text)", lineHeight: 1,
                    }}>{s.value}</span>
                    <span style={{
                      fontSize: 12, color: "var(--success)", fontWeight: 600,
                      marginBottom: 3,
                    }}>{s.delta} ce mois</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Bottom grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 14 }}>

              {/* Activité récente */}
              <div className="stat-card">
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  marginBottom: 18,
                }}>
                  <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: "Syne, sans-serif" }}>
                    Activité récente
                  </h2>
                  <button style={{
                    background: "none", border: "1px solid var(--border2)",
                    borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                    color: "var(--muted)", fontSize: 12, fontFamily: "inherit",
                  }}>Voir tout</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { team: "Thunder A", score: "2 — 1", opp: "Shadow Force", time: "Aujourd'hui, 18h30", status: "win" },
                    { team: "Thunder B", score: "0 — 3", opp: "Neon Wolves",  time: "Hier, 20h00",       status: "loss" },
                    { team: "Thunder A", score: "—",     opp: "Storm Team",   time: "Demain, 19h00",     status: "upcoming" },
                  ].map((m, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "12px 14px", borderRadius: 8,
                      background: "var(--elevated)",
                      border: "1px solid var(--border)",
                    }}>
                      <div style={{
                        width: 4, height: 36, borderRadius: 2, flexShrink: 0,
                        background: m.status === "win" ? "var(--success)"
                          : m.status === "loss" ? "var(--danger)" : "var(--border2)",
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>
                          {m.team}
                          <span style={{ color: "var(--muted)", fontWeight: 400 }}> vs </span>
                          {m.opp}
                        </div>
                        <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{m.time}</div>
                      </div>
                      <div style={{
                        fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: 15,
                        color: m.status === "win" ? "var(--success)"
                          : m.status === "loss" ? "var(--danger)" : "var(--muted)",
                      }}>{m.score}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tournois en cours */}
              <div className="stat-card">
                <div style={{ marginBottom: 18 }}>
                  <h2 style={{ fontSize: 14, fontWeight: 600, fontFamily: "Syne, sans-serif" }}>
                    Tournois en cours
                  </h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[
                    { name: "Spring Cup 2026", phase: "Phase de poules", teams: 8,  max: 8,  color: "var(--accent)" },
                    { name: "Liga Open",        phase: "Qualifications",  teams: 14, max: 16, color: "#a78bfa" },
                    { name: "Rookie Slam",      phase: "Inscriptions",    teams: 3,  max: 12, color: "var(--warning)" },
                  ].map((t, i) => (
                    <div key={i} style={{
                      padding: "12px 14px", borderRadius: 8,
                      background: "var(--elevated)",
                      border: "1px solid var(--border)",
                      cursor: "pointer", transition: "border-color 0.15s",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <div style={{
                          width: 6, height: 6, borderRadius: "50%",
                          background: t.color, flexShrink: 0,
                          boxShadow: `0 0 6px ${t.color}`,
                        }} />
                        <span style={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t.name}</span>
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 8 }}>{t.phase}</div>
                      <div style={{ height: 3, background: "var(--border)", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{
                          height: "100%", borderRadius: 2,
                          width: `${(t.teams / t.max) * 100}%`,
                          background: t.color, transition: "width 0.6s ease",
                        }} />
                      </div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 5, textAlign: "right" }}>
                        {t.teams}/{t.max} équipes
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>

      {/* ════════════════════════════════════════
          SEARCH OVERLAY
      ════════════════════════════════════════ */}
      {showSearch && (
        <div className="search-overlay" onClick={() => setShowSearch(false)}>
          <div className="search-box" onClick={e => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", padding: "0 20px",
              borderBottom: "1px solid var(--border)" }}>
              <Icon d={Icons.search} size={16} />
              <input className="search-input"
                autoFocus
                placeholder="Rechercher un tournoi, une équipe, un joueur..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              <kbd onClick={() => setShowSearch(false)} style={{
                background: "var(--border)", border: "1px solid var(--border2)",
                borderRadius: 4, padding: "2px 6px", fontSize: 11,
                color: "var(--muted)", cursor: "pointer", fontFamily: "inherit",
              }}>ESC</kbd>
            </div>
            <div style={{ padding: "8px 0" }}>
              {["Spring Cup 2026", "Thunder Esport A", "Alexandre D.", "FC Rouen — Liga Open"].map(r => (
                <div key={r} style={{
                  padding: "9px 20px", fontSize: 13, color: "var(--muted)",
                  cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                  transition: "background 0.1s",
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = "var(--border)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "none")}
                >
                  <Icon d={Icons.search} size={13} />
                  {r}
                </div>
              ))}
            </div>
            <div style={{
              borderTop: "1px solid var(--border)", padding: "8px 20px",
              display: "flex", gap: 16, fontSize: 11, color: "var(--muted)",
            }}>
              <span>↵ Ouvrir</span>
              <span>↑↓ Naviguer</span>
              <span>ESC Fermer</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}