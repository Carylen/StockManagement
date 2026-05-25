"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockGauge } from "@/components/ui/StockGauge";
import { format } from "date-fns";
import { AlertTriangle, Package, CheckCircle, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { DashboardSummary, StockLatestItem, InquiryStatusCounts } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();
  const t = useTranslations("dashboard");
  const site = user?.site ?? "AGMR";

  const { data: summary, isLoading: sumLoading, mutate: mutateSummary } = useSWR<DashboardSummary>(
    "/dashboard/summary",
    () => api.get("/dashboard/summary"),
    { refreshInterval: 60000 }
  );

  const { data: latest, isLoading: latestLoading } = useSWR<StockLatestItem[]>(
    "/dashboard/stock-latest",
    () => api.get("/dashboard/stock-latest"),
    { refreshInterval: 60000 }
  );

  const { data: inquiryCounts } = useSWR<InquiryStatusCounts>(
    "/dashboard/inquiry-counts",
    () => api.get("/dashboard/inquiry-counts"),
    { refreshInterval: 120000 }
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return t("morningGreet");
    if (h < 15) return t("afternoonGreet");
    if (h < 18) return t("eveningGreet");
    return t("nightGreet");
  })();

  const lastUpdated = summary?.last_updated
    ? format(new Date(summary.last_updated), "d MMM · HH:mm")
    : null;

  const dateLabel = summary?.last_updated
    ? format(new Date(summary.last_updated), "dd·MM")
    : format(new Date(), "dd·MM");

  const SUMMARY_CARDS = summary
    ? [
        {
          label: `Readiness · Site ${site}`,
          value: summary.total_parts,
          color: "var(--c-kpp)",
          tag: "KOMAT + SCNIA",
          sub: "Kelas V aktif",
          filter: "all",
          icon: Package,
        },
        {
          label: "WARNING",
          value: summary.status_count.WARNING,
          color: "#DC2626",
          tag: "butuh review",
          sub: "RTT di bawah MIN",
          filter: "WARNING",
          icon: AlertTriangle,
        },
        {
          label: "AMAN",
          value: summary.status_count.AMAN,
          color: "#16A34A",
          tag: "stabil",
          sub: "di rentang Min–Max",
          filter: "AMAN",
          icon: CheckCircle,
        },
        {
          label: "OVER",
          value: summary.status_count.OVER + summary.status_count.MAX,
          color: "#D97706",
          tag: "cek over-stock",
          sub: "RTT melebihi MAX",
          filter: "OVER",
          icon: RefreshCw,
        },
      ]
    : null;

  return (
    <div className="min-h-full">
      <Topbar
        title={`${greeting}, ${user?.name?.split(" ")[0]} 👋`}
        subtitle={`Site ${site} · ${lastUpdated ?? "—"}`}
      />

      <div className="p-6 pb-20 flex flex-col gap-5">

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {sumLoading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="bg-surface rounded-2xl h-36 animate-pulse border border-border" />
              ))
            : SUMMARY_CARDS?.map((card, i) => (
              <Link
                key={i}
                href={`/catalog?status=${card.filter}`}
                className="bg-surface rounded-2xl p-5 border border-border relative overflow-hidden hover:shadow-md transition-all"
              >
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: card.color }} />
                <div className="flex items-start justify-between mb-2">
                  <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px] leading-tight">
                    {card.label}
                  </p>
                  <span className="text-[10px] text-ink-3 font-medium whitespace-nowrap ml-2">{card.tag}</span>
                </div>
                <div
                  className="text-[48px] font-bold leading-none tracking-tight tnum mt-2 text-ink"
                >
                  {card.value}
                </div>
                <p className="text-[12px] text-ink-2 mt-1.5">{card.sub}</p>
              </Link>
            ))}
        </div>

        {/* ── Readiness + Inquiry row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">

          {/* Readiness panel */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
                  Readyness {site}
                </p>
                <h2 className="text-[18px] font-bold text-ink mt-1">Snapshot stok harian</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg text-[11px] font-bold font-mono tracking-wide bg-kpp-soft text-kpp">
                  {dateLabel}
                </span>
                <button
                  onClick={() => mutateSummary()}
                  className="p-1 text-ink-3 hover:text-ink transition-colors"
                  title="Refresh"
                >
                  <RefreshCw size={13} />
                </button>
              </div>
            </div>
            <div>
              {[
                { key: "OH",  label: "RTT > 0",    pct: summary?.readyness.oh_pct  ?? 0 },
                { key: "MIN", label: "RTT ≥ MIN",  pct: summary?.readyness.min_pct ?? 0 },
                { key: "FB",  label: "Total ≥ MIN", pct: summary?.readyness.fb_pct  ?? 0 },
              ].map((r, i) => (
                <div
                  key={r.key}
                  className={`flex items-center gap-3.5 py-4 ${i > 0 ? "border-t border-border/60" : ""}`}
                >
                  <div className="w-10 flex-shrink-0">
                    <p className="text-[13px] font-bold text-ink font-mono">{r.key}</p>
                    <p className="text-[10px] text-ink-3 mt-0.5">{r.label}</p>
                  </div>
                  <div className="flex-1 h-2.5 bg-surface-alt rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${r.pct}%`,
                        background: "linear-gradient(90deg, var(--c-kpp), var(--c-kpp-deep))",
                      }}
                    />
                  </div>
                  <div className="w-16 text-right flex-shrink-0">
                    <span className="text-[22px] font-bold text-ink tnum tracking-tight">{r.pct}</span>
                    <span className="text-[12px] text-ink-2 ml-0.5">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inquiry status panel */}
          <div className="bg-surface rounded-2xl border border-border p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
                  Inquiry Kelas G · {site}
                </p>
                <h2 className="text-[18px] font-bold text-ink mt-1">Status respond UT</h2>
              </div>
              <Link
                href="/inquiry/all"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-alt text-ink-2 text-[12px] font-semibold hover:text-ink transition-colors"
              >
                Lihat semua <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "Pending UT",  value: inquiryCounts?.pending ?? 0, color: "var(--c-pending)", sub: "menunggu respond" },
                { label: "Valid",       value: inquiryCounts?.valid   ?? 0, color: "var(--c-valid)",   sub: "stok tersedia" },
                { label: "Invalid",     value: inquiryCounts?.invalid ?? 0, color: "var(--c-invalid)", sub: "PN diganti" },
              ].map((s, i) => (
                <div key={i} className="bg-bg rounded-xl p-3.5 relative overflow-hidden">
                  <div
                    className="absolute top-0 left-0 bottom-0 w-[3px]"
                    style={{ background: s.color }}
                  />
                  <p className="text-[11px] text-ink-2 font-semibold tracking-[0.4px] mb-1 pl-1">{s.label}</p>
                  <p className="text-[30px] font-bold tnum leading-none pl-1" style={{ color: s.color }}>
                    {s.value}
                  </p>
                  <p className="text-[11px] text-ink-3 mt-1 pl-1">{s.sub}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between text-[12px]">
              <span className="text-ink-2">
                Total inquiry dari {site}:{" "}
                <strong className="text-ink font-mono">{inquiryCounts?.total ?? 0}</strong>
              </span>
              <span className="text-ink-3">SLA respond UT: 2–3 hari kerja</span>
            </div>
          </div>
        </div>

        {/* ── Warning table ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
                Perlu Perhatian · {site}
              </p>
              <h2 className="text-[18px] font-bold text-ink mt-1">Stok di bawah MIN</h2>
            </div>
            <div className="flex items-center gap-2">
              <button className="px-3.5 py-2 rounded-xl bg-surface-alt text-ink text-[12px] font-semibold hover:bg-surface-alt/80 transition-colors">
                Export CSV
              </button>
              <Link
                href="/catalog?status=WARNING"
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-bold text-white hover:opacity-90 transition-opacity"
                style={{ background: "var(--c-kpp)" }}
              >
                <ArrowRight size={12} /> Buka katalog
              </Link>
            </div>
          </div>

          {latestLoading ? (
            <div className="divide-y divide-border/60">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-6 py-3.5 flex gap-6">
                  <div className="h-4 w-28 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 w-16 bg-surface-alt animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : latest && latest.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-[0.6px] font-semibold">
                    <th className="text-left px-6 py-3">Part Number</th>
                    <th className="text-left px-4 py-3">Deskripsi</th>
                    <th className="text-left px-4 py-3 hidden lg:table-cell">Kategori</th>
                    <th className="text-right px-4 py-3">RTT</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">TBD</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">MIN</th>
                    <th className="text-right px-4 py-3 hidden xl:table-cell">Estimasi</th>
                    <th className="px-4 py-3 hidden xl:table-cell" style={{ width: 140 }} />
                    <th className="text-right px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((item) => (
                    <tr
                      key={item.part_number}
                      className="border-t border-border/60 hover:bg-surface-alt/40 cursor-pointer transition-colors"
                      onClick={() => { window.location.href = `/catalog/${item.part_number}`; }}
                    >
                      <td className="px-6 py-3.5 font-mono font-semibold text-[12.5px] text-ink whitespace-nowrap">
                        {item.part_number}
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-ink max-w-[200px] truncate">
                        {item.description ?? "—"}
                      </td>
                      <td className="px-4 py-3.5 text-ink-2 hidden lg:table-cell max-w-[160px] truncate">
                        {item.producer && item.commodity
                          ? `${item.producer} · ${item.commodity}`
                          : (item.producer ?? item.commodity ?? "—")}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-warning tnum">
                        {item.rtt_qty}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-ink tnum hidden md:table-cell">
                        {item.tbd_qty}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono text-ink tnum hidden md:table-cell">
                        {item.min_qty}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono tnum hidden xl:table-cell">
                        <span className={item.estimated_qty > 0 ? "text-[#5B5BD6] font-semibold" : "text-ink-3"}>
                          {item.estimated_qty > 0 ? `+${item.estimated_qty}` : "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        <StockGauge rtt={item.rtt_qty} min={item.min_qty} max={item.max_qty} height={8} />
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <StatusBadge status={item.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center">
              <div className="w-14 h-14 bg-aman-bg rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle size={28} className="text-aman" />
              </div>
              <p className="font-bold text-ink">{t("allSafe")}</p>
              <p className="text-sm text-ink-3 mt-1">{t("noPartsBelowMin")}</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
