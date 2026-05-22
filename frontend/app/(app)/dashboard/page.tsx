"use client";

import useSWR from "swr";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockGauge } from "@/components/ui/StockGauge";
import { SkeletonCard, SkeletonTable } from "@/components/ui/Skeleton";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import { AlertTriangle, TrendingUp, Package, CheckCircle, ArrowRight, RefreshCw } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import Link from "next/link";
import type { DashboardSummary, StockLatestItem, InquiryPulseItem } from "@/lib/types";

export default function DashboardPage() {
  const { user } = useAuth();

  const { data: summary, error: sumErr, isLoading: sumLoading, mutate: mutateSummary } = useSWR<DashboardSummary>(
    "/dashboard/summary",
    () => api.get("/dashboard/summary"),
    { refreshInterval: 60000 }
  );

  const { data: latest, isLoading: latestLoading } = useSWR<StockLatestItem[]>(
    "/dashboard/stock-latest",
    () => api.get("/dashboard/stock-latest"),
    { refreshInterval: 60000 }
  );

  const { data: pulse } = useSWR<InquiryPulseItem[]>(
    "/dashboard/inquiry-pulse",
    () => api.get("/dashboard/inquiry-pulse"),
    { refreshInterval: 120000 }
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return "Selamat pagi";
    if (h < 15) return "Selamat siang";
    if (h < 18) return "Selamat sore";
    return "Selamat malam";
  })();

  const lastUpdated = summary?.last_updated
    ? format(new Date(summary.last_updated), "d MMM · HH:mm 'WIB'", { locale: id })
    : null;

  const SUMMARY_CARDS = summary
    ? [
        { label: "Total Part Kelas V", value: summary.total_parts, icon: Package, color: "#F5A623", filter: "all", sub: "KOMAT & SCNIA" },
        { label: "WARNING", value: summary.status_count.WARNING, icon: AlertTriangle, color: "#EF4444", filter: "WARNING", sub: "RTT di bawah MIN" },
        { label: "AMAN", value: summary.status_count.AMAN, icon: CheckCircle, color: "#22C55E", filter: "AMAN", sub: "Di rentang Min–Max" },
        { label: "OVER", value: summary.status_count.OVER + summary.status_count.MAX, icon: TrendingUp, color: "#F59E0B", filter: "OVER", sub: "RTT melebihi MAX" },
      ]
    : null;

  return (
    <div className="min-h-full">
      <Topbar
        title={`${greeting}, ${user?.name?.split(" ")[0]} 👋`}
        subtitle={`AGMR · ${lastUpdated || "—"}`}
      />

      <div className="p-4 md:p-6 xl:p-8 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {sumLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
            : SUMMARY_CARDS?.map((card) => (
              <Link
                key={card.label}
                href={`/katalog?status=${card.filter}`}
                className="bg-white rounded-xl p-4 md:p-5 ring-1 ring-border hover:shadow-md transition-all relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: card.color }} />
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">{card.label}</p>
                  <card.icon size={16} style={{ color: card.color }} />
                </div>
                <div className="text-4xl md:text-5xl font-bold text-ink tnum leading-none mb-1">{card.value}</div>
                <p className="text-xs text-ink-3">{card.sub}</p>
              </Link>
            ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 md:gap-6">
          {/* Readyness */}
          <div className="lg:col-span-2 bg-white rounded-xl ring-1 ring-border p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Readyness AGMR</p>
                <h2 className="font-bold text-ink mt-0.5">Snapshot stok harian</h2>
              </div>
              <button onClick={() => mutateSummary()} title="Refresh" className="text-ink-3 hover:text-ink transition-colors">
                <RefreshCw size={14} />
              </button>
            </div>
            <div className="space-y-4">
              {[
                { key: "OH", label: "RTT > 0", pct: summary?.readyness.oh_pct ?? 0 },
                { key: "MIN", label: "RTT ≥ MIN", pct: summary?.readyness.min_pct ?? 0 },
                { key: "FB", label: "Total ≥ MIN", pct: summary?.readyness.fb_pct ?? 0 },
              ].map((r) => (
                <div key={r.key} className="flex items-center gap-3">
                  <div className="w-10 flex-shrink-0">
                    <p className="text-xs font-bold text-ink font-mono">{r.key}</p>
                    <p className="text-[9px] text-ink-3 mt-0.5">{r.label}</p>
                  </div>
                  <div className="flex-1 h-2.5 bg-surface-alt rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-coral transition-all duration-500"
                      style={{ width: `${r.pct}%` }}
                    />
                  </div>
                  <div className="w-14 text-right text-lg font-bold text-ink tnum">
                    {r.pct}<span className="text-xs font-normal text-ink-2">%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inquiry pulse */}
          <div className="lg:col-span-3 bg-white rounded-xl ring-1 ring-border p-5">
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Inquiry Kelas G</p>
                <h2 className="font-bold text-ink mt-0.5">7 hari terakhir</h2>
              </div>
              <Link href="/inquiry/semua" className="flex items-center gap-1 text-xs text-ink-2 font-semibold hover:text-ink">
                Lihat semua <ArrowRight size={12} />
              </Link>
            </div>
            {pulse && pulse.length > 0 ? (
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={pulse} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#A39A8A" }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB", boxShadow: "none" }}
                    formatter={(v: number) => [`${v} inquiry`, ""]}
                  />
                  <Bar dataKey="count" fill="#F5A623" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-28 flex items-center justify-center text-sm text-ink-3">Belum ada data inquiry</div>
            )}
          </div>
        </div>

        {/* WARNING table */}
        <div className="bg-white rounded-xl ring-1 ring-border overflow-hidden">
          <div className="flex items-center justify-between px-5 md:px-6 py-4 border-b border-border">
            <div>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Perlu Perhatian</p>
              <h2 className="font-bold text-ink mt-0.5">Stok di bawah MIN</h2>
            </div>
            <Link
              href="/katalog?status=WARNING"
              className="flex items-center gap-1.5 px-3 py-2 bg-ink text-white text-xs font-semibold rounded-lg hover:bg-ink/80 transition-colors"
            >
              Buka katalog <ArrowRight size={12} />
            </Link>
          </div>

          {latestLoading ? (
            <SkeletonTable rows={3} />
          ) : latest && latest.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-wide font-semibold">
                    <th className="text-left px-6 py-3">Part Number</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Deskripsi</th>
                    <th className="text-right px-4 py-3">RTT</th>
                    <th className="text-right px-4 py-3 hidden lg:table-cell">TBD</th>
                    <th className="text-right px-4 py-3 hidden lg:table-cell">MIN</th>
                    <th className="px-4 py-3 hidden xl:table-cell" style={{ width: 150 }}>Gauge</th>
                    <th className="text-right px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((item) => (
                    <tr key={item.part_number} className="border-t border-border hover:bg-surface-alt/50 transition-colors">
                      <td className="px-6 py-3.5">
                        <Link href={`/katalog/${item.part_number}`} className="font-mono text-xs font-semibold text-ink hover:text-primary-dark">
                          {item.part_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-ink hidden md:table-cell max-w-[200px] truncate">
                        {item.description}
                      </td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-warning-text tnum">{item.rtt_qty}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-ink-2 tnum hidden lg:table-cell">{item.tbd_qty}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-ink-2 tnum hidden lg:table-cell">{item.min_qty}</td>
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
            <div className="py-16 text-center text-ink-3 text-sm">
              <CheckCircle size={32} className="mx-auto mb-3 text-aman" />
              <p className="font-semibold text-ink">Semua stok aman</p>
              <p className="mt-1">Tidak ada part di bawah MIN saat ini.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
