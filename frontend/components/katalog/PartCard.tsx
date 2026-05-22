"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockGauge } from "@/components/ui/StockGauge";
import type { PartListItem } from "@/lib/types";

interface Props {
  part: PartListItem;
}

export function PartCard({ part }: Props) {
  return (
    <Link
      href={`/katalog/${part.part_number}`}
      className="block bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4 hover:border-primary/40 hover:shadow-sm transition-all"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <p className="text-sm font-bold text-ink font-mono truncate">{part.part_number}</p>
          <p className="text-xs text-ink-2 mt-0.5 line-clamp-2">{part.description || "—"}</p>
        </div>
        <StatusBadge status={part.status} size="sm" />
      </div>

      {part.min_qty !== null && part.max_qty !== null && part.rtt_qty !== null && (
        <div className="my-3">
          <StockGauge
            rtt={part.rtt_qty ?? 0}
            min={part.min_qty ?? 0}
            max={part.max_qty ?? 0}
            height={8}
            showLabels
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs mt-2">
        <div className="flex gap-3">
          <span className="text-ink-3">
            RTT: <span className="font-bold text-ink font-mono">{part.rtt_qty ?? "—"}</span>
          </span>
          <span className="text-ink-3">
            TBD: <span className="font-bold text-ink font-mono">{part.tbd_qty ?? "—"}</span>
          </span>
        </div>
        <div className="flex gap-2 text-ink-3">
          {part.producer && (
            <span className="px-1.5 py-0.5 bg-[#F5EFE1] rounded text-[10px] font-semibold">
              {part.producer}
            </span>
          )}
          {part.commodity && (
            <span className="px-1.5 py-0.5 bg-[#F5EFE1] rounded text-[10px]">
              {part.commodity}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
