"use client";
import { useUser } from "@/components/Provider";
import { getOrganizationBySlug } from "@/lib/actions/organization/organization.queries"
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

// Mock des icônes et composants manquants dans ton snippet pour que ça compile
const Icons = { trophy: "", teams: "", players: "", flame: "" };
const Icon = ({ d, size }: { d: string, size: number }) => <span style={{ fontSize: size }} data-icon={d}>⚡</span>;

type OrganizationSummary = Awaited<ReturnType<typeof getOrganizationBySlug>>;

export default function OrganizationPageResume() {
  const params = useParams();
  const slug = params.slug;
  const user = useUser();

  const [activeOrg, setActiveOrg] = useState<OrganizationSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;

    const fetchOrg = async () => {
      try {
        const data = await getOrganizationBySlug(slug as string);
        setActiveOrg(data ?? null);
      } catch (error) {
        console.error("Erreur:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOrg();
  }, [slug]);

  // --- ÉCRAN DE CHARGEMENT ---
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--muted)" }}>
        <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 600 }}>Chargement de l&apos;organisation...</p>
      </div>
    );
  }

  // --- SÉCURITÉ SI PAS DE DONNÉES ---
  if (!activeOrg) {
    return (
      <div style={{ padding: 20, color: "var(--danger)" }}>
        Organisation introuvable ou erreur de chargement.
      </div>
    );
  }

  return (
    <>
      {/* Page title */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 500 }}>
            {activeOrg.name}
          </span>
          <span style={{ color: "var(--border2)" }}>{">"}</span>
          <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500 }}>
            Vue d&apos;ensemble
          </span>
        </div>
        <h1 style={{
          fontFamily: "Syne, sans-serif", fontWeight: 800,
          fontSize: 26, letterSpacing: "-0.03em", color: "var(--text)",
        }}>
          Bonjour, {user?.user.name || "Utilisateur"} 👋
        </h1>
        <p style={{ color: "var(--muted)", fontSize: 14, marginTop: 4 }}>
          Voici ce qui se passe dans {activeOrg.name} aujourd&apos;hui.
        </p>
      </div>

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Tournois actifs", value: "3", delta: "+1", color: "var(--accent)", icon: Icons.trophy },
          { label: "Équipes", value: "12", delta: "+2", color: "#a78bfa", icon: Icons.teams },
          { label: "Joueurs inscrits", value: "84", delta: "+7", color: "var(--success)", icon: Icons.players },
          { label: "Matchs ce mois", value: "47", delta: "+12", color: "var(--warning)", icon: Icons.flame },
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
              { team: "Thunder A", score: "2 — 1", opp: "Shadow Force", time: "Aujourd&apos;hui, 18h30", status: "win" },
              { team: "Thunder B", score: "0 — 3", opp: "Neon Wolves", time: "Hier, 20h00", status: "loss" },
              { team: "Thunder A", score: "—", opp: "Storm Team", time: "Demain, 19h00", status: "upcoming" },
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
              { name: "Spring Cup 2026", phase: "Phase de poules", teams: 8, max: 8, color: "var(--accent)" },
              { name: "Liga Open", phase: "Qualifications", teams: 14, max: 16, color: "#a78bfa" },
              { name: "Rookie Slam", phase: "Inscriptions", teams: 3, max: 12, color: "var(--warning)" },
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
    </>
  );
}