"use client"

import { useState, useEffect } from "react"
import { NavigationItem, type NavigationItem as PrismaNavItem } from "@prisma/client";
import { Icon, Icons } from "@/components/dashboard/icons";
import { Sidebar } from "@/components/dashboard/sidebar/Sidebar";
import { Topbar } from "@/components/dashboard/Topbar";
import { getUserOrganizations } from "@/lib/actions/organization/organization.queries";
import { UserProvider } from "@/components/Provider";

type NotificationItem = {
  id: string;
  type: "match" | "member" | "tournament";
  message: string;
  time: string;
  read: boolean;
};

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
  const [collapsed] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [notifs, setNotifs] = useState<NotificationItem[]>([])
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
  }, [])

  const W_OPEN = 240
  const W_CLOSED = 64

  const markAllRead = () => setNotifs(n => n.map(x => ({ ...x, read: true })))

  if (!mounted) return null

  return (
    <>
      <UserProvider initialData={{ user: user, navItems, organizations }}>
        {/* ── Google Fonts ── */}
        <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');


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
          <Sidebar user={user} navItems={NAV_ITEMS} organizations={organizations} />


          {/* ════════════════════════════════════════
            MAIN
        ════════════════════════════════════════ */}
          <div className="hub-main">

            {/* Topbar */}
            <Topbar user={user} notifications={notifs} onMarkAllRead={markAllRead} onSearchClick={() => setShowSearch(true)} />

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
      </UserProvider>
    </>
  )
}