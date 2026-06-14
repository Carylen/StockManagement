"use client";

import { InquiryBadge } from "@/components/ui/InquiryBadge";
import type { InquiryDetail as InquiryDetailType } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { useTranslations } from "next-intl";
import { MapPin, RefreshCw } from "lucide-react";

interface Props {
  inquiry: InquiryDetailType;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-[rgba(27,24,20,0.06)] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</span>
      <span className="text-sm text-ink">{value ?? <span className="text-ink-3">—</span>}</span>
    </div>
  );
}

const ITEM_STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: "#FEF3C7", color: "#B45309", label: "Pending"  },
  valid:   { bg: "#DCFCE7", color: "#15803D", label: "Valid"    },
  invalid: { bg: "#FEE2E2", color: "#B91C1C", label: "Invalid"  },
};

export function InquiryDetail({ inquiry }: Props) {
  const t = useTranslations("inquiryDetail");
  const fmt = (d: string | null) =>
    d ? format(parseISO(d), "d MMMM yyyy HH:mm") : null;

  const pendingN  = inquiry.items.filter(i => i.status === "pending").length;
  const validN    = inquiry.items.filter(i => i.status === "valid").length;
  const invalidN  = inquiry.items.filter(i => i.status === "invalid").length;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <InquiryBadge status={inquiry.status} />
        {/* Item summary chips */}
        <div className="flex items-center gap-1.5">
          {validN > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#DCFCE7", color: "#15803D" }}>
              {validN}V
            </span>
          )}
          {invalidN > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#FEE2E2", color: "#B91C1C" }}>
              {invalidN}I
            </span>
          )}
          {pendingN > 0 && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: "#FEF3C7", color: "#B45309" }}>
              {pendingN}P
            </span>
          )}
        </div>
      </div>

      <Row
        label={t("submittedBy")}
        value={
          <span>
            {inquiry.submitted_by_name ?? "—"}
            {inquiry.submitted_by_nrp && (
              <span className="text-ink-3 font-mono ml-1.5 text-xs">{inquiry.submitted_by_nrp}</span>
            )}
            <span className="text-ink-3 ml-1.5 text-xs">· {fmt(inquiry.created_at)}</span>
          </span>
        }
      />
      <Row label="Site" value={inquiry.site} />

      {/* Items table */}
      <div className="py-2.5 border-b border-[rgba(27,24,20,0.06)]">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3 block mb-2">
          {t("partList")} ({inquiry.items.length})
        </span>
        <div className="rounded-lg border border-[rgba(27,24,20,0.08)] overflow-hidden divide-y divide-[rgba(27,24,20,0.06)]">
          {/* Header */}
          <div className="grid text-[10px] font-bold uppercase tracking-wider text-ink-3 bg-surface-alt px-3 py-2 gap-2"
            style={{ gridTemplateColumns: "1fr 2fr auto auto" }}>
            <span>Part No.</span>
            <span>{t("partName")}</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Status</span>
          </div>

          {inquiry.items.map((item, i) => {
            const st = ITEM_STATUS_STYLE[item.status] ?? ITEM_STATUS_STYLE.pending;
            return (
              <div key={item.id}>
                {/* Main row */}
                <div
                  className={`grid px-3 py-2.5 gap-2 text-sm ${i % 2 === 1 ? "bg-surface-alt/30" : ""}`}
                  style={{ gridTemplateColumns: "1fr 2fr auto auto" }}
                >
                  <span className="font-mono font-bold text-xs text-ink">{item.part_number}</span>
                  <span className="text-xs text-ink-2 truncate">{item.part_name ?? "—"}</span>
                  <span className="font-mono font-bold text-xs tabular-nums text-right">{item.qty}</span>
                  <span className="text-right">
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                      style={{ background: st.bg, color: st.color }}>
                      {st.label}
                    </span>
                  </span>
                </div>

                {/* Respond detail row (for responded items) */}
                {item.status !== "pending" && (
                  <div className="px-3 pb-2.5 space-y-1" style={{ background: `${st.bg}55` }}>
                    {item.replacement_pn && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <RefreshCw size={10} className="text-ink-3 flex-shrink-0" />
                        <span className="text-ink-3">{t("replacementPn")}</span>
                        <span className="font-mono font-bold text-ink">{item.replacement_pn}</span>
                      </div>
                    )}
                    {item.ut_site_code && (
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <MapPin size={10} className="text-ink-3 flex-shrink-0" />
                        <span className="text-ink-3">{t("utWhCode")}</span>
                        <span className="font-mono font-bold" style={{ color: "#B07410" }}>
                          {item.ut_site_code}
                        </span>
                      </div>
                    )}
                    {item.ut_note && (
                      <p className="text-[11px] text-ink italic">&ldquo;{item.ut_note}&rdquo;</p>
                    )}
                    {item.responded_by && (
                      <p className="text-[10px] text-ink-3">
                        {t("by")} {item.responded_by}
                        {item.responded_at && ` · ${fmt(item.responded_at)}`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
