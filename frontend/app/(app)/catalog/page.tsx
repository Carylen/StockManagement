"use client";

import { useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockGauge } from "@/components/ui/StockGauge";
import { SkeletonTable } from "@/components/ui/Skeleton";
import { Search, X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import Link from "next/link";
import type { PaginatedParts, PartFilters } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";

const STATUS_FILTERS = ["all", "WARNING", "AMAN", "OVER", "MAX"] as const;

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

const SELECT_CLASS =
  "px-3 py-1.5 rounded-xl text-xs font-semibold bg-surface ring-1 ring-border text-ink-2 outline-none cursor-pointer hover:ring-border-strong transition-all";

export default function KatalogPage() {
  const { can } = useAuth();
  const searchParams = useSearchParams();
  const t = useTranslations("catalog");
  const tp = useTranslations("pagination");

  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "all");
  const [producer, setProducer] = useState("all");
  const [commodity, setCommodity] = useState("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...(search && { search }),
    ...(status !== "all" && { status }),
    ...(producer !== "all" && { producer }),
    ...(commodity !== "all" && { commodity }),
  });

  const { data, isLoading } = useSWR<PaginatedParts>(
    `/parts?${params}`,
    (url: string) => api.get<PaginatedParts>(url),
    { keepPreviousData: true }
  );

  const { data: filters } = useSWR<PartFilters>(
    "/parts/filters",
    (url: string) => api.get<PartFilters>(url),
    { revalidateOnFocus: false }
  );

  const resetFilters = useCallback(() => {
    setSearch(""); setStatus("all"); setProducer("all"); setCommodity("all"); setPage(1);
  }, []);

  const handleExport = async () => {
    try {
      const blob = await api.download("/export/stock-report");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "stok_agmr.xlsx";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const CHIP_CLASS = (active: boolean) =>
    `px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex-shrink-0 ${
      active ? "bg-ink text-white" : "bg-surface ring-1 ring-border text-ink-2 hover:ring-border-strong"
    }`;

  return (
    <div className="min-h-full">
      <Topbar title={t("title")} subtitle={`AGMR · ${data?.total ?? "—"} ${t("parts")}`} />

      <div className="p-4 md:p-6 space-y-4">
        {/* Search + Filters */}
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-surface ring-1 ring-border rounded-xl text-ink-3 focus-within:ring-primary/40 transition-all">
              <Search size={16} />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder={t("searchPlaceholder")}
                className="flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }} className="text-ink-3 hover:text-ink">
                  <X size={14} />
                </button>
              )}
            </div>
            {can("can_manage_master") && (
              <button
                onClick={handleExport}
                className="px-3 py-2.5 bg-surface ring-1 ring-border rounded-xl text-ink-2 hover:ring-border-strong transition-all flex items-center gap-1.5 text-sm font-semibold"
              >
                <Download size={14} /> Export
              </button>
            )}
          </div>

          {/* Status chips */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {STATUS_FILTERS.map((s) => (
              <button key={s} onClick={() => { setStatus(s); setPage(1); }} className={CHIP_CLASS(status === s)}>
                {s === "all" ? t("allStatus") : s}
              </button>
            ))}
          </div>

          {/* Producer + Commodity dropdowns (dynamic from DB) */}
          <div className="flex gap-2 flex-wrap">
            <select
              value={producer}
              onChange={(e) => { setProducer(e.target.value); setPage(1); }}
              className={SELECT_CLASS}
            >
              <option value="all">{t("allBrands")}</option>
              {(filters?.producers ?? []).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <select
              value={commodity}
              onChange={(e) => { setCommodity(e.target.value); setPage(1); }}
              className={SELECT_CLASS}
            >
              <option value="all">{t("allCommodity")}</option>
              {(filters?.commodities ?? []).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Result count */}
        <div className="flex items-center justify-between text-xs text-ink-2">
          <span>
            <strong className="text-ink font-mono">{data?.total ?? "—"}</strong> {t("of")} {data?.total ?? "—"} {t("parts")}
            {status !== "all" && <span> · filter <strong>{status}</strong></span>}
          </span>
          {(search || status !== "all" || producer !== "all" || commodity !== "all") && (
            <button onClick={resetFilters} className="text-ink-2 underline">{t("resetFilter")}</button>
          )}
        </div>

        {/* Mobile card list */}
        <div className="md:hidden space-y-3">
          {isLoading
            ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-surface rounded-xl ring-1 ring-border p-4 animate-pulse space-y-2">
                <div className="h-3 bg-surface-alt rounded w-28" />
                <div className="h-4 bg-surface-alt rounded w-full" />
                <div className="h-2 bg-surface-alt rounded w-1/2" />
              </div>
            ))
            : data?.items.map((part) => (
              <Link
                key={part.part_number}
                href={`/catalog/${encodeURIComponent(part.part_number)}`}
                className="block bg-surface rounded-xl ring-1 ring-border p-4 relative overflow-hidden hover:shadow-sm transition-all"
              >
                <div
                  className="absolute left-0 top-0 bottom-0 w-1"
                  style={{
                    background: part.status === "WARNING" ? "#EF4444"
                      : part.status === "AMAN" ? "#22C55E"
                      : part.status === "OVER" ? "#F59E0B"
                      : part.status === "MAX" ? "#3B82F6"
                      : "#E5E7EB"
                  }}
                />
                <div className="pl-2">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="font-mono text-xs font-semibold text-ink">{part.part_number}</p>
                      <p className="font-bold text-ink text-sm mt-0.5 line-clamp-1">{part.description}</p>
                      <p className="text-xs text-ink-2 mt-0.5">{part.commodity}</p>
                      {part.estimated_date && (
                        <p className="text-xs text-amber-600 font-semibold mt-0.5">Est. {fmtDate(part.estimated_date)}</p>
                      )}
                    </div>
                    <StatusBadge status={part.status} size="sm" />
                  </div>
                  <div className="flex gap-3 text-xs text-ink-2 mb-2">
                    <span>RTT <strong className="text-ink font-mono">{part.rtt_qty ?? 0}</strong></span>
                    <span>TBD <strong className="text-ink font-mono">{part.tbd_qty ?? 0}</strong></span>
                    <span className="ml-auto">Min <strong className="font-mono">{part.min_qty ?? 0}</strong> · Max <strong className="font-mono">{part.max_qty ?? 0}</strong></span>
                  </div>
                  <StockGauge rtt={part.rtt_qty ?? 0} min={part.min_qty ?? 0} max={part.max_qty ?? 1} height={6} />
                </div>
              </Link>
            ))}
        </div>

        {/* Desktop table */}
        {isLoading ? (
          <div className="hidden md:block">
            <SkeletonTable rows={10} />
          </div>
        ) : (
          <div className="hidden md:block bg-surface rounded-xl ring-1 ring-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-wide font-semibold">
                    <th className="text-left px-6 py-3">Part Number</th>
                    <th className="text-left px-4 py-3">{t("description")}</th>
                    <th className="text-left px-4 py-3 hidden xl:table-cell">{t("commodity")}</th>
                    <th className="text-left px-4 py-3 hidden xl:table-cell">Estimasi</th>
                    <th className="text-right px-4 py-3">RTT</th>
                    <th className="text-right px-4 py-3">TBD</th>
                    <th className="text-right px-4 py-3">MIN</th>
                    <th className="text-right px-4 py-3 hidden xl:table-cell">MAX</th>
                    <th className="px-4 py-3 hidden xl:table-cell" style={{ minWidth: 140 }}>Gauge</th>
                    <th className="text-right px-6 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.items.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-16 text-center text-ink-3 text-sm">
                        {t("noMatch")}
                      </td>
                    </tr>
                  ) : data?.items.map((part) => (
                    <tr key={part.part_number} className="border-t border-border hover:bg-surface-alt/40 transition-colors cursor-pointer">
                      <td className="px-6 py-3.5">
                        <Link href={`/catalog/${encodeURIComponent(part.part_number)}`} className="font-mono text-xs font-bold text-ink hover:text-primary-dark">
                          {part.part_number}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 font-semibold text-ink max-w-[240px] truncate">{part.description}</td>
                      <td className="px-4 py-3.5 text-ink-2 hidden xl:table-cell">{part.commodity ?? "—"}</td>
                      <td className="px-4 py-3.5 hidden xl:table-cell text-xs text-amber-600 font-semibold">{fmtDate(part.estimated_date)}</td>
                      <td className="px-4 py-3.5 text-right font-mono font-bold text-ink tnum">{part.rtt_qty ?? 0}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-ink-2 tnum">{part.tbd_qty ?? 0}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-ink-2 tnum">{part.min_qty ?? 0}</td>
                      <td className="px-4 py-3.5 text-right font-mono text-ink-2 tnum hidden xl:table-cell">{part.max_qty ?? 0}</td>
                      <td className="px-4 py-3.5 hidden xl:table-cell">
                        <StockGauge rtt={part.rtt_qty ?? 0} min={part.min_qty ?? 0} max={part.max_qty ?? 1} height={8} />
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <StatusBadge status={part.status} size="sm" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Pagination */}
        {data && data.pages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink-2">
              {t("page")} <strong className="text-ink">{page}</strong> {t("pageOf")} {data.pages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-surface ring-1 ring-border rounded-lg disabled:opacity-40 hover:ring-border-strong transition-all flex items-center gap-1 font-semibold text-ink-2"
              >
                <ChevronLeft size={14} /> {tp("prev")}
              </button>
              <button
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={page >= data.pages}
                className="px-3 py-1.5 bg-surface ring-1 ring-border rounded-lg disabled:opacity-40 hover:ring-border-strong transition-all flex items-center gap-1 font-semibold text-ink-2"
              >
                {tp("next")} <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
