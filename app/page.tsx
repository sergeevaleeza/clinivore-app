"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { daysFromNow, daysLabel, type TreatmentStatus } from "@/lib/status";

interface DashboardData {
  stats: {
    dueToday: number;
    dueThisWeek: number;
    overdue: number;
    needsOutreach: number;
    highPriority: number;
    completedThisWeek: number;
  };
  urgentPatients: {
    patientId: string;
    displayName: string;
    internalId: string;
    providerName: string;
    protocolName: string;
    nextDueDate: string | null;
    status: string;
  }[];
  statusCounts: Record<string, number>;
}

interface StatCard {
  key: keyof DashboardData["stats"];
  label: string;
  sub: string;
  color: string;
  bg: string;
  icon: string;
  href: string;
}

const STAT_CARDS: StatCard[] = [
  { key: "overdue",          label: "Overdue",           sub: "Needs outreach",            color: "#DC2626", bg: "#FEE2E2", icon: "⚠️",  href: "/outreach" },
  { key: "dueThisWeek",      label: "Due This Week",     sub: "Confirm appointments",      color: "#B45309", bg: "#FFF4DE", icon: "📆",  href: "/patients" },
  { key: "dueToday",         label: "Upcoming",          sub: "Scheduled",                 color: "#0E9F93", bg: "#DDF7F4", icon: "📅",  href: "/patients" },
  { key: "completedThisWeek",label: "Completed (Week)",  sub: "Great work!",               color: "#059669", bg: "#DCFCE7", icon: "✅",  href: "/patients" },
  { key: "highPriority",     label: "High Priority",     sub: "Needs immediate attention", color: "#B91C1C", bg: "#FEE2E2", icon: "🔴",  href: "/outreach" },
  { key: "needsOutreach",    label: "Outreach Queue",    sub: "Open tasks",                color: "#1D4ED8", bg: "#EEF4FF", icon: "📞",  href: "/outreach" },
];

const CHART_COLORS: Record<string, string> = {
  HIGH_PRIORITY: "#B91C1C",
  OVERDUE:       "#DC2626",
  NEEDS_OUTREACH:"#0E9F93",
  DUE_TODAY:     "#B45309",
  DUE_SOON:      "#2563EB",
  ON_TRACK:      "#059669",
};

const CHART_LABELS: Record<string, string> = {
  HIGH_PRIORITY: "High Priority",
  OVERDUE:       "Overdue",
  NEEDS_OUTREACH:"Needs Outreach",
  DUE_TODAY:     "Due Today",
  DUE_SOON:      "Due Soon",
  ON_TRACK:      "On Track",
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => { setError("Failed to load dashboard"); setLoading(false); });
  }, []);

  const chartData = data
    ? Object.entries(data.statusCounts)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => ({ name: CHART_LABELS[k] ?? k, count: v, key: k }))
    : [];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const emoji = hour < 12 ? "👋" : hour < 17 ? "☀️" : "🌙";

  if (loading) return <LoadingSpinner label="Loading dashboard..." />;
  if (error) return <div style={{ color: "#DC2626", padding: "32px 0" }}>{error}</div>;
  if (!data) return null;

  return (
    <div>
      {/* Greeting header */}
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 26,
            fontWeight: 700,
            color: "var(--text-primary)",
            fontFamily: "var(--font-sora)",
            margin: 0,
          }}
        >
          {greeting} {emoji}
        </h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4, marginBottom: 0 }}>
          Here&apos;s your overview for today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        {STAT_CARDS.map((card) => (
          <div
            key={card.key}
            style={{
              background: "var(--card-bg)",
              borderRadius: 16,
              border: "1px solid var(--card-border)",
              boxShadow: "var(--card-shadow)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.09em",
                    color: "var(--text-muted)",
                    marginBottom: 8,
                  }}
                >
                  {card.label}
                </div>
                <div
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: card.color,
                    fontFamily: "var(--font-sora)",
                    lineHeight: 1,
                  }}
                >
                  {data.stats[card.key]}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>
                  {card.sub}
                </div>
              </div>
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: card.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 16,
                  flexShrink: 0,
                }}
              >
                {card.icon}
              </div>
            </div>
            <div
              style={{
                marginTop: 16,
                paddingTop: 12,
                borderTop: "1px solid var(--card-border)",
              }}
            >
              <Link
                href={card.href}
                style={{
                  fontSize: 12,
                  color: "var(--blue)",
                  fontWeight: 500,
                  textDecoration: "none",
                }}
              >
                View all →
              </Link>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Urgent patients */}
        <div
          className="lg:col-span-2"
          style={{
            background: "#ffffff",
            borderRadius: 16,
            border: "1px solid var(--card-border)",
            boxShadow: "var(--card-shadow)",
            padding: 20,
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--text-primary)",
                fontFamily: "var(--font-sora)",
                margin: 0,
              }}
            >
              Urgent Patients
            </h2>
            <Link
              href="/patients"
              style={{ fontSize: 12, color: "var(--blue)", textDecoration: "none" }}
            >
              View all →
            </Link>
          </div>

          {data.urgentPatients.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: 14 }}>
              No urgent patients — all treatments are on track!
            </div>
          ) : (
            <div style={{ borderTop: "1px solid var(--card-border)" }}>
              {data.urgentPatients.map((p) => {
                const days = daysFromNow(p.nextDueDate);
                return (
                  <div
                    key={p.patientId}
                    className="flex items-center justify-between gap-3"
                    style={{
                      padding: "10px 0",
                      borderBottom: "1px solid var(--card-border)",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/patients/${p.patientId}`}
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "var(--text-primary)",
                            textDecoration: "none",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--blue)")}
                          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
                        >
                          {p.displayName}
                        </Link>
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--text-muted)",
                            fontFamily: "monospace",
                          }}
                        >
                          {p.internalId}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                        {p.protocolName} · {p.providerName}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {daysLabel(days)}
                      </span>
                      <StatusBadge status={p.status as TreatmentStatus} size="sm" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--card-border)" }}>
            <Link href="/outreach" className="btn btn-secondary btn-sm w-full justify-center">
              View Outreach Queue
            </Link>
          </div>
        </div>

        {/* Chart */}
        <div
          style={{
            background: "#ffffff",
            borderRadius: 16,
            border: "1px solid var(--card-border)",
            boxShadow: "var(--card-shadow)",
            padding: 20,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--text-primary)",
              fontFamily: "var(--font-sora)",
              margin: "0 0 16px",
            }}
          >
            Treatment Status Overview
          </h2>
          {chartData.length === 0 ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                height: 192,
                color: "var(--text-muted)",
                fontSize: 13,
              }}
            >
              No data
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                <XAxis type="number" tick={{ fontSize: 11, fill: "#7A8BA0" }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={95}
                  tick={{ fontSize: 11, fill: "#7A8BA0" }}
                />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #EBE8E3" }}
                  formatter={(v) => [v, "Patients"]}
                />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={entry.key} fill={CHART_COLORS[entry.key] ?? "#94a3b8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
