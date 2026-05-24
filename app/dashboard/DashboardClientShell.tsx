"use client"

import { useState, useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { NavigationItem, type NavigationItem as PrismaNavItem } from "@prisma/client";
import { Icon, Icons } from "@/components/dashboard/icons";
import { Sidebar } from "@/components/dashboard/sidebar/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { getUserOrganizations } from "@/lib/actions/organization/organization.queries";
import { UserProvider } from "@/components/Provider";
import {
  getDashboardNotifications,
  globalDashboardSearch,
  type DashboardNotification,
  type GlobalSearchResult,
} from "@/lib/actions/dashboard.actions";

type NotificationItem = DashboardNotification;

type UserOrganizationList = Awaited<ReturnType<typeof getUserOrganizations>>;

// On définit la structure de l'utilisateur
interface UserData {
  name: string;
  email: string | undefined;
  avatar: string | null;
  roles: string[];
  role: "ADMIN" | "USER";
}

// ── Layout Principal ──────────────────────────────────────────────────────────

export default function DashboardClientShell({
  children,
  user,
  navItems
}: {
  children: React.ReactNode;
  user: UserData
  navItems: (PrismaNavItem & { children: PrismaNavItem[] })[];
}) {
  const NAV_ITEMS: NavigationItem[] = navItems;

  // INITS
  const pathname = usePathname()
  const router = useRouter()
  const [collapsed, setCollapsed] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
  const [searchResults, setSearchResults] = useState<GlobalSearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [organizations, setOrganizations] = useState<UserOrganizationList>([])


  useEffect(() => {
    const fetchOrgs = async () => {
      try {
        const data = await getUserOrganizations();
        setOrganizations(data || []);
      } catch (error) {
        console.error("Failed to fetch orgs:", error);
      } finally {
        setMounted(true)
      }
    };
    fetchOrgs();
  }, [pathname])

  useEffect(() => {
    let cancelled = false

    const fetchNotifications = async () => {
      try {
        const data = await getDashboardNotifications()
        if (!cancelled) setNotifs(data)
      } catch (error) {
        console.error("Failed to fetch dashboard notifications:", error)
      }
    }

    fetchNotifications()
    return () => {
      cancelled = true
    }
  }, [pathname])

  useEffect(() => {
    if (!showSearch) return

    const query = searchQuery.trim()
    if (query.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)

    const timeout = window.setTimeout(async () => {
      try {
        const data = await globalDashboardSearch(query)
        if (!cancelled) setSearchResults(data)
      } catch (error) {
        console.error("Failed to search dashboard:", error)
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [searchQuery, showSearch])

  useEffect(() => {
    if (!showSearch) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSearch(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [showSearch])

  const W_OPEN = 240
  const W_CLOSED = 64

  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })))
  const openSearchResult = (href: string) => {
    setShowSearch(false)
    setSearchQuery("")
    router.push(href)
  }

  if (!mounted) return null

  return (
    <>
      <UserProvider initialData={{ user: user, navItems, organizations }}>
        {/* ── Google Fonts ── */}
        <style>{`
        :root {
          --bg:        #f6f7f9;
          --surface:   #ffffff;
          --elevated:  #f8fafc;
          --border:    #e5e7eb;
          --border2:   #d1d5db;
          --text:      #111827;
          --muted:     #6b7280;
          --accent:    #0f766e;
          --accent2:   #0ea5a4;
          --danger:    #dc2626;
          --success:   #059669;
          --warning:   #d97706;
          --sidebar-w: ${collapsed ? W_CLOSED : W_OPEN}px;
        }

        body { background: var(--bg); color: var(--text); }

        .hub-layout {
          display: flex;
          height: 100vh;
          overflow: hidden;
          background:
            radial-gradient(circle at top left, #ecfeff 0%, transparent 36%),
            radial-gradient(circle at bottom right, #f0fdfa 0%, transparent 32%),
            var(--bg);
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
          height: 60px;
          background: var(--surface);
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          padding: 0 16px;
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
          padding: 22px;
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
          box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
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
          background: rgba(17, 24, 39, 0.35);
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
          box-shadow: 0 18px 44px rgba(15, 23, 42, 0.18);
        }
        .search-input {
          width: 100%;
          background: transparent;
          border: none;
          outline: none;
          color: var(--text);
          font-family: inherit;
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

        .search-trigger {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--elevated);
          border: 1px solid var(--border);
          color: var(--muted);
          padding: 8px 12px;
          border-radius: 10px;
          font-size: 13px;
        }
        .sidebar-toggle-btn {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: var(--elevated);
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-toggle-btn:hover {
          color: var(--text);
          border-color: var(--border2);
        }
        .search-trigger:hover {
          border-color: var(--border2);
          color: var(--text);
        }
        .search-kbd {
          margin-left: 4px;
          font-size: 11px;
          border: 1px solid var(--border2);
          color: var(--muted);
          padding: 2px 6px;
          border-radius: 6px;
          background: #fff;
        }

        .notif-btn {
          position: relative;
          width: 34px;
          height: 34px;
          border: 1px solid var(--border);
          background: var(--elevated);
          color: var(--muted);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          border-radius: 10px;
        }
        .notif-btn.active,
        .notif-btn:hover {
          color: var(--text);
          border-color: var(--border2);
        }
        .notif-badge-dot {
          position: absolute;
          top: 7px;
          right: 8px;
          width: 8px;
          height: 8px;
          border-radius: 999px;
          background: var(--danger);
          border: 2px solid var(--surface);
        }

        .notif-dropdown {
          top: calc(100% + 10px);
          right: 0;
          width: 340px;
        }
        .dropdown-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          font-weight: 600;
        }
        .text-action-btn {
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          background: transparent;
          border: none;
          padding: 0;
        }
        .notif-list {
          max-height: 280px;
          overflow-y: auto;
        }
        .notif-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-bottom: 1px solid var(--border);
        }
        .notif-item:last-child {
          border-bottom: none;
        }
        .notif-item.unread {
          background: #f8fafc;
        }
        .notif-icon {
          width: 26px;
          height: 26px;
          border-radius: 8px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .notif-msg {
          font-size: 13px;
          color: var(--text);
          line-height: 1.3;
        }
        .notif-time {
          font-size: 11px;
          color: var(--muted);
          margin-top: 2px;
        }
        .unread-indicator {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: var(--accent);
          flex-shrink: 0;
        }
        .empty-state {
          padding: 16px;
          text-align: center;
          color: var(--muted);
          font-size: 13px;
        }

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
          <Sidebar
            user={user}
            navItems={NAV_ITEMS}
            organizations={organizations}
            collapsed={collapsed}
            onToggleCollapse={() => setCollapsed(current => !current)}
          />


          {/* ════════════════════════════════════════
            MAIN
        ════════════════════════════════════════ */}
          <div className="hub-main">

            {/* Topbar */}
            <Topbar
              user={user}
              notifications={notifs}
              onMarkAllRead={markAllRead}
              onSearchClick={() => setShowSearch(true)}
              collapsed={collapsed}
              onToggleSidebar={() => setCollapsed(current => !current)}
            />

            {/* Content */}
            <main className="hub-content">

              {children}
            </main>
          </div>
        </div>

        {/* ════════════════════════════════════════
          SEARCH OVERLAY
      ════════════════════════════════════════ */}
        {showSearch && (
          <div className="search-overlay" onClick={() => setShowSearch(false)}>
            <div className="search-box" onClick={e => e.stopPropagation()}>
              <div style={{
                display: "flex", alignItems: "center", padding: "0 20px",
                borderBottom: "1px solid var(--border)"
              }}>
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
                {searchLoading && <div className="empty-state">Recherche...</div>}
                {!searchLoading && searchQuery.trim().length >= 2 && searchResults.length === 0 && <div className="empty-state">Aucun resultat.</div>}
                {!searchLoading && searchResults.map(result => (
                  <button key={`${result.type}-${result.id}`} type="button" style={{
                    padding: "9px 20px", fontSize: 13, color: "var(--muted)",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: 10,
                    transition: "background 0.1s",
                    width: "100%", background: "none", border: "none", textAlign: "left",
                  }}
                    onMouseEnter={e => (e.currentTarget.style.background = "var(--border)")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}
                    onClick={() => openSearchResult(result.href)}
                  >
                    <Icon d={Icons.search} size={13} />
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "block", color: "var(--text)", fontWeight: 600 }}>{result.title}</span>
                      <span style={{ display: "block", fontSize: 11 }}>{result.subtitle}</span>
                    </span>
                    <span style={{ marginLeft: "auto", fontSize: 10, textTransform: "uppercase", color: "var(--muted)" }}>{result.type}</span>
                  </button>
                ))}
                {!searchLoading && searchQuery.trim().length < 2 && <div className="empty-state">Tapez au moins 2 caracteres pour chercher.</div>}
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
      </UserProvider>
    </>
  )
}
