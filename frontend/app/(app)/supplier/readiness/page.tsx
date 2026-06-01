"use client";

import { useState } from "react";
import useSWR from "swr";
import { format, parseISO } from "date-fns";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { DashboardSummary, PaginatedParts, PartListItem, Site } from "@/lib/types";

const SITE_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C", accent: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6", accent: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59", accent: "#FF7A59" },
};

function siteColor(code: string) {
  return SITE_COLORS[code] ?? { bg: "#F3F4F6", text: "#4B5563", accent: "#4B5563" };
}

type StatusFilter = "all" | "WARNING" | "AMAN" | "OVER";

function ReadinessBar({ pct, color }: { pct: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[rgba(27,24,20,0.08)] rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      </div>
      <span className="text-[12px] font-mono font-bold tabular-nums" style={{ color, minWidth: 36 }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function SiteBadge({ code }: { code: string }) {
  const c = siteColor(code);
  return (
    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.text }}>
      {code}
    </span>
  );
}

function SiteCard({ site, summary, onClick }: {
  site: Site; summary: DashboardSummary | undefined; onClick: () => void;
}) {
  const c = siteColor(site.code);
  return (
    <button onClick={onClick}
      className="w-full text-left bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-5 transition-all hover:shadow-md hover:border-[rgba(27,24,20,0.18)] relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-1 rounded-t-xl" style={{ background: c.accent }} />
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className="text-[10px] font-mono font-bold px-2 py-1 rounded-full"
            style={{ background: c.bg, color: c.text }}>{site.code}</span>
          <div className="text-[14px] font-bold text-ink mt-2">{site.name}</div>
        </div>
      </div>

      {summary ? (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "Total", value: summary.total_parts,              color: "#16110D" },
              { label: "Aman",  value: summary.status_count.AMAN,        color: "#16A34A" },
              { label: "Warn",  value: summary.status_count.WARNING,     color: "#DC2626" },
              { label: "MIN%",  value: `${summary.readyness.min_pct.toFixed(0)}%`, color: "#B07410" },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-bg rounded-lg p-2.5">
                <div className="text-[9px] font-bold uppercase tracking-widest text-ink-3">{label}</div>
                <div className="text-[18px] font-bold font-mono mt-1 tabular-nums leading-none" style={{ color }}>{value}</div>
              </div>
            ))}
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-ink-3 mb-1">
              <span>Readyness</span>
              {summary.last_updated && (
                <span>{format(parseISO(summary.last_updated), "d MMM · HH:mm")}</span>
              )}
            </div>
            {[
              { key: "OH",    pct: summary.readyness.oh_pct  },
              { key: "MIN",   pct: summary.readyness.min_pct },
              { key: "TOTAL", pct: summary.readyness.fb_pct  },
            ].map(({ key, pct }) => (
              <div key={key} className="flex items-center gap-2 text-[11px]">
                <span className="w-10 text-ink-3">{key}</span>
                <ReadinessBar pct={pct} color={c.accent} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="space-y-2">
          <Skeleton className="h-14 rounded-lg" />
          <Skeleton className="h-3 rounded" />
        </div>
      )}
    </button>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function SupplierReadinessPage() {
  const [view, setView]                 = useState("consolidated");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch]             = useState("");

  // Dynamic site list from DB
  const { data: sites = [] } = useSWR<Site[]>(
    "/sites", (u: string) => api.get<Site[]>(u), { revalidateOnFocus: false }
  );

  // Fixed top-level SWR calls for up to 3 known sites — avoids hook-in-loop
  const { data: sumAGMR, mutate: mAGMR } = useSWR<DashboardSummary>(
    sites.some((s) => s.code === "AGMR") ? "/dashboard/summary?site=AGMR" : null,
    (u: string) => api.get<DashboardSummary>(u), { refreshInterval: 60000 }
  );
  const { data: sumRANT, mutate: mRANT } = useSWR<DashboardSummary>(
    sites.some((s) => s.code === "RANT") ? "/dashboard/summary?site=RANT" : null,
    (u: string) => api.get<DashboardSummary>(u), { refreshInterval: 60000 }
  );
  const { data: sumSPUT, mutate: mSPUT } = useSWR<DashboardSummary>(
    sites.some((s) => s.code === "SPUT") ? "/dashboard/summary?site=SPUT" : null,
    (u: string) => api.get<DashboardSummary>(u), { refreshInterval: 60000 }
  );

  const summaries: Record<string, DashboardSummary | undefined> = {
    AGMR: sumAGMR, RANT: sumRANT, SPUT: sumSPUT,
  };

  const handleRefresh = () => { mAGMR(); mRANT(); mSPUT(); };

  const activeSites = view === "consolidated" ? sites.map((s) => s.code) : [view];

  const paramsFor = (code: string) => {
    const p = new URLSearchParams({ site: code, limit: "500", sort_by: "part_number" });
    if (statusFilter !== "all") p.set("status", statusFilter);
    if (search) p.set("search", search);
    return p.toString();
  };

  const { data: partsAGMR, isLoading: loadAGMR } = useSWR<PaginatedParts>(
    activeSites.includes("AGMR") ? `/parts?${paramsFor("AGMR")}` : null,
    (u: string) => api.get<PaginatedParts>(u)
  );
  const { data: partsRANT, isLoading: loadRANT } = useSWR<PaginatedParts>(
    activeSites.includes("RANT") ? `/parts?${paramsFor("RANT")}` : null,
    (u: string) => api.get<PaginatedParts>(u)
  );
  const { data: partsSPUT, isLoading: loadSPUT } = useSWR<PaginatedParts>(
    activeSites.includes("SPUT") ? `/parts?${paramsFor("SPUT")}` : null,
    (u: string) => api.get<PaginatedParts>(u)
  );

  const partsMap: Record<string, PaginatedParts | undefined> = {
    AGMR: partsAGMR, RANT: partsRANT, SPUT: partsSPUT,
  };

  type TableRow = PartListItem & { site: string };
  let tableRows: TableRow[] = [];
  if (view === "consolidated") {
    for (const s of sites) {
      const d = partsMap[s.code];
      if (d) tableRows.push(...d.items.map((p) => ({ ...p, site: s.code })));
    }
  } else {
    const d = partsMap[view];
    if (d) tableRows = d.items.map((p) => ({ ...p, site: view }));
  }

  const isLoadingTable = loadAGMR || loadRANT || loadSPUT;
  const viewSummary = view !== "consolidated" ? summaries[view] : undefined;
  const colSpan = view === "consolidated" ? 10 : 9;

  return (
    <div className="min-h-full">
      <Topbar
        title={view === "consolidated" ? `Readiness · ${sites.length} Site` : `Readiness ${view}`}
        subtitle="UT · readiness viewer"
      />

      <div className="p-4 lg:p-6 pb-10 space-y-5 max-w-[1400px]">

        {/* ── View toggle ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3 mr-1">View:</span>
          {([
            { key: "consolidated", label: "Konsolidasi" },
            ...sites.map((s) => ({ key: s.code, label: s.code })),
          ]).map(({ key, label }) => {
            const on = view === key;
            return (
              <button key={key} onClick={() => setView(key)}
                className="px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all"
                style={{
                  background: on ? "#16110D" : "#FFFFFF", color: on ? "#fff" : "#6B6256",
                  border: on ? "none" : "1px solid rgba(27,24,20,0.1)",
                  fontFamily: key !== "consolidated" ? "var(--font-mono, monospace)" : "inherit",
                }}>
                {key === "consolidated" && <span className="mr-1">🌐</span>}
                {label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[12px] text-ink-2">
              <span className="font-mono font-bold text-ink tabular-nums">{tableRows.length}</span> baris
            </span>
            <button onClick={handleRefresh}
              className="p-2 rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={13} />
            </button>
          </div>
        </div>

        {/* ── Site cards ──────────────────────────────────── */}
        {view === "consolidated" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sites.map((s) => (
              <SiteCard key={s.code} site={s} summary={summaries[s.code]}
                onClick={() => setView(s.code)} />
            ))}
          </div>
        )}

        {/* ── Single-site summary ─────────────────────────── */}
        {view !== "consolidated" && viewSummary && (
          <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <SiteBadge code={view} />
                <span className="text-[13px] font-bold text-ink ml-3">
                  {sites.find((s) => s.code === view)?.name}
                </span>
              </div>
              {viewSummary.last_updated && (
                <span className="text-[11px] text-ink-3">
                  {format(parseISO(viewSummary.last_updated), "d MMM yyyy · HH:mm")}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              {[
                { l: "Total Part", v: viewSummary.total_parts,              c: "#16110D" },
                { l: "WARNING",    v: viewSummary.status_count.WARNING,     c: "#DC2626" },
                { l: "AMAN",       v: viewSummary.status_count.AMAN,        c: "#16A34A" },
                { l: "OVER",       v: (viewSummary.status_count.OVER ?? 0) + (viewSummary.status_count.MAX ?? 0), c: "#D97706" },
              ].map(({ l, v, c }) => (
                <div key={l} className="bg-bg rounded-xl p-3">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-ink-3 mb-1">{l}</div>
                  <div className="text-[28px] font-bold font-mono tabular-nums leading-none" style={{ color: c }}>{v}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {[
                { label: "OH  %",   pct: viewSummary.readyness.oh_pct  },
                { label: "MIN %",   pct: viewSummary.readyness.min_pct },
                { label: "TOTAL %", pct: viewSummary.readyness.fb_pct  },
              ].map(({ label, pct }) => (
                <div key={label} className="flex items-center gap-3 text-[12px]">
                  <span className="w-14 text-ink-3 font-mono text-right">{label}</span>
                  <ReadinessBar pct={pct} color={siteColor(view).accent} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Filters ─────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari PN atau nama part…"
            className="px-3 py-2 rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface text-sm text-ink outline-none focus:border-brand w-56" />
          <div className="flex gap-1.5">
            {([
              { key: "all",     label: "Semua",   dot: null      },
              { key: "WARNING", label: "Warning", dot: "#DC2626" },
              { key: "AMAN",    label: "Aman",    dot: "#16A34A" },
              { key: "OVER",    label: "Over",    dot: "#D97706" },
            ] as { key: StatusFilter; label: string; dot: string | null }[]).map(({ key, label, dot }) => {
              const on = statusFilter === key;
              return (
                <button key={key} onClick={() => setStatusFilter(key)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11.5px] font-semibold transition-all"
                  style={{
                    background: on ? "#16110D" : "#FFFFFF", color: on ? "#fff" : "#6B6256",
                    border: on ? "none" : "1px solid rgba(27,24,20,0.1)",
                  }}>
                  {dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: on ? "#fff" : dot }} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Table ───────────────────────────────────────── */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] border-collapse">
              <thead>
                <tr className="bg-bg text-[11px] font-semibold uppercase tracking-wider text-ink-3">
                  {view === "consolidated" && <th className="text-left px-5 py-3">Site</th>}
                  <th className="text-left px-4 py-3">Part Number</th>
                  <th className="text-left px-4 py-3">Deskripsi</th>
                  <th className="text-left px-4 py-3">Commodity</th>
                  <th className="text-right px-4 py-3">MIN</th>
                  <th className="text-right px-4 py-3">MAX</th>
                  <th className="text-right px-4 py-3">RTT</th>
                  <th className="text-right px-4 py-3">TBD</th>
                  <th className="text-right px-4 py-3">Estimasi</th>
                  <th className="text-right px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingTable ? (
                  [...Array(8)].map((_, i) => (
                    <tr key={i} className="border-t border-[rgba(27,24,20,0.06)]">
                      <td colSpan={colSpan} className="px-5 py-3">
                        <Skeleton className="h-5 w-full rounded" />
                      </td>
                    </tr>
                  ))
                ) : tableRows.length === 0 ? (
                  <tr>
                    <td colSpan={colSpan} className="px-5 py-14 text-center text-ink-3 text-sm">
                      Tidak ada data stok pada filter ini.
                    </td>
                  </tr>
                ) : (
                  tableRows.slice(0, 200).map((row, i) => (
                    <tr key={`${row.site}-${row.part_number}-${i}`}
                      className="border-t border-[rgba(27,24,20,0.06)] hover:bg-[#F6F3EE] transition-colors">
                      {view === "consolidated" && (
                        <td className="px-5 py-3"><SiteBadge code={row.site} /></td>
                      )}
                      <td className="px-4 py-3 font-mono font-semibold text-ink text-[12.5px]">{row.part_number}</td>
                      <td className="px-4 py-3 text-ink max-w-[180px] truncate">{row.description ?? "—"}</td>
                      <td className="px-4 py-3 text-ink-2 text-[12px]">{row.commodity ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-2 tabular-nums">{row.min_qty ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-2 tabular-nums">{row.max_qty ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-ink tabular-nums">{row.rtt_qty ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono text-ink-2 tabular-nums">{row.tbd_qty ?? "—"}</td>
                      <td className="px-4 py-3 text-right font-mono tabular-nums text-[11px]">
                        {row.estimated_date
                          ? <span className="text-[#5B5BD6]">{format(new Date(row.estimated_date), "d MMM yy")}</span>
                          : <span className="text-ink-3">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <StatusBadge status={row.status} size="sm" />
                      </td>
                    </tr>
                  ))
                )}
                {tableRows.length > 200 && (
                  <tr className="border-t border-[rgba(27,24,20,0.06)]">
                    <td colSpan={colSpan} className="px-5 py-4 text-center text-[12px] text-ink-3">
                      … {tableRows.length - 200} baris lainnya · pakai filter untuk mempersempit
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
