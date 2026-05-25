"use client";

import { InquiryBadge } from "@/components/ui/InquiryBadge";
import type { Inquiry } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { CalendarDays, Package, User, MapPin, RefreshCw } from "lucide-react";

interface Props {
  inquiry: Inquiry;
  onClick?: () => void;
  showSubmitter?: boolean;
  showSite?: boolean;
}

export function InquiryCard({ inquiry, onClick, showSubmitter = false, showSite = false }: Props) {
  const createdAt = inquiry.created_at
    ? format(parseISO(inquiry.created_at), "d MMM yyyy · HH:mm")
    : "—";

  return (
    <div
      onClick={onClick}
      className={`bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] p-4 transition-all ${
        onClick ? "cursor-pointer hover:border-brand/40 hover:shadow-sm" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-ink truncate">{inquiry.part_name}</span>
            {inquiry.part_number && (
              <span className="text-[10px] font-mono text-ink-3 bg-surface-alt px-1.5 py-0.5 rounded">
                {inquiry.part_number}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {showSite && inquiry.site && <SitePill site={inquiry.site} />}
          <InquiryBadge status={inquiry.status} size="sm" />
        </div>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-3 mt-2">
        <span className="flex items-center gap-1">
          <Package size={11} />
          Qty: <span className="font-bold text-ink font-mono tabular-nums">{inquiry.qty_needed}</span>
          {inquiry.unit_asset && <span className="text-ink-2"> · {inquiry.unit_asset}</span>}
        </span>
        <span className="flex items-center gap-1">
          <CalendarDays size={11} />
          {createdAt}
        </span>
        {showSubmitter && inquiry.submitter_name && (
          <span className="flex items-center gap-1">
            <User size={11} />
            {inquiry.submitter_name}
          </span>
        )}
      </div>

      {/* UT response block */}
      {(inquiry.status === "valid" || inquiry.status === "invalid") && (
        <div
          className="mt-3 rounded-lg px-3 py-2.5 text-xs space-y-1"
          style={{
            background: inquiry.status === "valid" ? "#DCFCE7" : "#FEE2E2",
            color: inquiry.status === "valid" ? "#15803D" : "#B91C1C",
          }}
        >
          {inquiry.ut_site_code && (
            <div className="flex items-center gap-1.5">
              <MapPin size={10} />
              <span className="font-semibold uppercase tracking-wide">WH UT:</span>
              <span className="font-mono font-bold">{inquiry.ut_site_code}</span>
            </div>
          )}
          {inquiry.replacement_pn && (
            <div className="flex items-center gap-1.5">
              <RefreshCw size={10} />
              <span className="font-semibold uppercase tracking-wide">PN Pengganti:</span>
              <span className="font-mono font-bold">{inquiry.replacement_pn}</span>
            </div>
          )}
          {inquiry.respond_notes && (
            <p className="text-xs leading-relaxed mt-1 italic opacity-90">
              &ldquo;{inquiry.respond_notes}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SitePill({ site }: { site: string }) {
  const COLORS: Record<string, { bg: string; text: string }> = {
    AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
    RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
    SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
  };
  const c = COLORS[site] ?? { bg: "#F3F4F6", text: "#4B5563" };
  return (
    <span
      className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      {site}
    </span>
  );
}
