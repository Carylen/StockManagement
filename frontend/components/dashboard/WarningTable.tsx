"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockGauge } from "@/components/ui/StockGauge";
import { SkeletonRow } from "@/components/ui/Skeleton";
import type { StockLatestItem } from "@/lib/types";

interface Props {
  data?: StockLatestItem[];
  loading: boolean;
}

export function WarningTable({ data, loading }: Props) {
  return (
    <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(27,24,20,0.06)]">
        <div>
          <h3 className="text-sm font-bold text-ink">Stok Terkini</h3>
          <p className="text-xs text-ink-3">Parts perlu perhatian</p>
        </div>
        <Link
          href="/katalog?status=WARNING"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Lihat semua →
        </Link>
      </div>

      <div className="divide-y divide-[rgba(27,24,20,0.04)]">
        {loading ? (
          [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
        ) : !data || data.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-sm text-ink-3">Tidak ada data stok</p>
          </div>
        ) : (
          data.map((item) => (
            <Link
              key={item.part_number}
              href={`/katalog/${item.part_number}`}
              className="flex items-center gap-3 px-4 py-3 hover:bg-[#FBF7EE] transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-ink font-mono truncate group-hover:text-primary transition-colors">
                  {item.part_number}
                </p>
                <p className="text-xs text-ink-3 truncate mt-0.5">{item.description || "—"}</p>
              </div>
              <div className="hidden sm:block w-24">
                <StockGauge rtt={item.rtt_qty} min={item.min_qty} max={item.max_qty} height={6} />
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-xs font-bold text-ink font-mono">{item.rtt_qty}</p>
                <p className="text-[10px] text-ink-3">RTT</p>
              </div>
              <StatusBadge status={item.status} size="sm" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
