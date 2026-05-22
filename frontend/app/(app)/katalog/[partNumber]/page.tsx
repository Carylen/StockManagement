"use client";

import { use } from "react";
import useSWR from "swr";
import Link from "next/link";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockGauge } from "@/components/ui/StockGauge";
import { Skeleton } from "@/components/ui/Skeleton";
import { ChevronLeft, Plus } from "lucide-react";
import { LineChart, Line, ResponsiveContainer, Tooltip, ReferenceLine, XAxis, YAxis } from "recharts";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import type { Part, StockHistoryItem } from "@/lib/types";

export default function PartDetailPage({ params }: { params: Promise<{ partNumber: string }> }) {
  const { partNumber } = use(params);
  const pn = decodeURIComponent(partNumber);

  const { data: part, isLoading } = useSWR<Part>(
    `/parts/${pn}`,
    () => api.get(`/parts/${pn}`)
  );

  const { data: history } = useSWR<StockHistoryItem[]>(
    `/parts/${pn}/history?days=7`,
    () => api.get(`/parts/${pn}/history?days=7`)
  );

  const stock = part?.current_stock;
  const status = stock?.status;
  const totalQty = (stock?.rtt_qty ?? 0) + (stock?.tbd_qty ?? 0);

  // Build chart data from history (last 7 days ascending)
  const chartData = history
    ? [...history].reverse().map((h) => ({
        date: format(new Date(h.synced_at), "dd/MM"),
        qty: h.new_qty,
      }))
    : [];

  return (
    <div className="min-h-full">
      <Topbar
        title={isLoading ? "Memuat…" : (part?.description ?? pn)}
        subtitle={isLoading ? "" : `${part?.producer ?? ""} · ${part?.commodity ?? ""} · Kelas V`}
      />

      <div className="p-4 md:p-6 xl:p-8 space-y-4">
        {/* Back */}
        <Link href="/katalog" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
          <ChevronLeft size={16} /> Kembali ke katalog
        </Link>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Skeleton className="h-48 rounded-xl" />
              <Skeleton className="h-48 rounded-xl" />
            </div>
          </div>
        ) : part ? (
          <>
            {/* Hero card */}
            <div className="bg-gradient-to-br from-primary-soft to-coral-soft rounded-2xl p-6 md:p-8 relative overflow-hidden">
              <div className="absolute -bottom-16 -right-16 w-64 h-64 rounded-full bg-primary/10" />
              <div className="relative flex flex-col md:flex-row md:items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <code className="font-mono text-sm font-bold text-ink bg-white/60 px-2 py-0.5 rounded">{part.part_number}</code>
                    {status && <StatusBadge status={status} />}
                  </div>
                  <h1 className="text-2xl md:text-3xl font-extrabold text-ink tracking-tight leading-tight">{part.description}</h1>
                  <p className="text-sm text-ink-2 mt-2">
                    {part.producer === "KOMAT" ? "Komatsu" : "Scania"} · Commodity <strong>{part.commodity}</strong> · Kelas V
                  </p>
                </div>
                <div className="text-left md:text-right flex-shrink-0">
                  <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Total stok UT</p>
                  <div className="text-5xl font-extrabold text-ink font-mono tnum leading-none mt-1">
                    {totalQty}<span className="text-base font-semibold text-ink-2 ml-1">pcs</span>
                  </div>
                  <p className="text-xs text-ink-2 mt-1.5">RTT {stock?.rtt_qty ?? 0} + TBD {stock?.tbd_qty ?? 0}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Stock breakdown */}
              <div className="bg-white rounded-xl ring-1 ring-border p-5">
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide mb-4">Stok per Warehouse</p>
                <div className="space-y-4">
                  {[
                    { key: "RTT", label: "Rantau Warehouse · Kalimantan Selatan", qty: stock?.rtt_qty ?? 0, color: "#F5A623" },
                    { key: "TBD", label: "Banjarmasin Depot · transit warehouse", qty: stock?.tbd_qty ?? 0, color: "#FF7A59" },
                  ].map((w, i) => (
                    <div key={w.key} className={i > 0 ? "pt-4 border-t border-border" : ""}>
                      <div className="flex items-baseline justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <code className="font-mono text-xs font-bold bg-surface-alt px-2 py-0.5 rounded text-ink">{w.key}</code>
                          <span className="text-sm text-ink font-semibold">{w.label}</span>
                        </div>
                        <span className="font-mono font-bold text-2xl text-ink tnum">{w.qty}</span>
                      </div>
                      <div className="h-2.5 bg-surface-alt rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: totalQty > 0 ? `${(w.qty / totalQty) * 100}%` : "0%", background: w.color }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* vs. Kebutuhan */}
              <div className="bg-white rounded-xl ring-1 ring-border p-5">
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide mb-4">vs Kebutuhan AGMR</p>
                <div className="grid grid-cols-3 gap-3 mb-5">
                  {[
                    { k: "MIN", v: stock?.min_qty ?? 0, c: "#6B6256" },
                    { k: "MAX", v: stock?.max_qty ?? 0, c: "#6B6256" },
                    { k: "RTT", v: stock?.rtt_qty ?? 0, c: status === "WARNING" ? "#EF4444" : "#22C55E" },
                  ].map((m) => (
                    <div key={m.k} className="bg-bg rounded-xl p-3">
                      <p className="text-[9px] font-bold text-ink-3 uppercase tracking-wide">{m.k}</p>
                      <p className="font-mono font-bold text-xl tnum mt-1" style={{ color: m.c }}>{m.v}</p>
                    </div>
                  ))}
                </div>
                <div className="py-2">
                  <StockGauge rtt={stock?.rtt_qty ?? 0} min={stock?.min_qty ?? 0} max={stock?.max_qty ?? 1} height={16} showLabels />
                </div>
                <p className="text-xs mt-3 font-semibold flex items-center gap-1.5"
                  style={{ color: status === "WARNING" ? "#EF4444" : status === "OVER" ? "#F59E0B" : "#22C55E" }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  {status === "WARNING"
                    ? `Kurang ${(stock?.min_qty ?? 0) - (stock?.rtt_qty ?? 0)} pcs untuk mencapai MIN`
                    : status === "OVER"
                    ? `Kelebihan ${(stock?.rtt_qty ?? 0) - (stock?.max_qty ?? 0)} pcs di atas MAX`
                    : `Aman · ${(stock?.rtt_qty ?? 0) - (stock?.min_qty ?? 0)} pcs di atas MIN`}
                </p>
              </div>
            </div>

            {/* History chart */}
            <div className="bg-white rounded-xl ring-1 ring-border p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-wide">Histori RTT · 7 hari terakhir</p>
                  <p className="font-bold text-ink mt-0.5">Tren ketersediaan di Rantau Warehouse</p>
                </div>
              </div>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={chartData}>
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#A39A8A" }} axisLine={false} tickLine={false} />
                    <YAxis hide domain={["auto", "auto"]} />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E5E7EB" }} formatter={(v: number) => [`${v} pcs`, "RTT"]} />
                    {stock && (
                      <ReferenceLine y={stock.min_qty} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} />
                    )}
                    <Line type="monotone" dataKey="qty" stroke="#F5A623" strokeWidth={2.5} dot={{ r: 3, fill: "white", stroke: "#F5A623", strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-32 flex items-center justify-center text-sm text-ink-3">
                  Belum ada histori tersedia.
                </div>
              )}
            </div>

            {/* FAB - Submit Inquiry */}
            <div className="fixed bottom-24 right-4 md:bottom-8 md:right-6 z-30">
              <Link
                href={`/inquiry/baru?part=${encodeURIComponent(part.description ?? part.part_number)}`}
                className="flex items-center gap-2 px-4 py-3 bg-ink text-white rounded-full shadow-xl font-bold text-sm hover:bg-ink/80 transition-all"
              >
                <Plus size={16} /> Ajukan Kelas G
              </Link>
            </div>
          </>
        ) : (
          <div className="py-20 text-center text-ink-3">
            <p className="text-lg font-bold text-ink">Part tidak ditemukan</p>
            <Link href="/katalog" className="text-sm text-primary-dark underline mt-2 inline-block">
              Kembali ke katalog
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
