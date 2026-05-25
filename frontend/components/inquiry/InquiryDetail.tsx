"use client";

import { InquiryBadge } from "@/components/ui/InquiryBadge";
import type { Inquiry } from "@/lib/types";
import { format, parseISO } from "date-fns";
import { MapPin, Package } from "lucide-react";

interface Props {
  inquiry: Inquiry;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 border-b border-[rgba(27,24,20,0.06)] last:border-0">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">{label}</span>
      <span className="text-sm text-ink">{value || <span className="text-ink-3">—</span>}</span>
    </div>
  );
}

export function InquiryDetail({ inquiry }: Props) {
  const fmt = (d: string | null) =>
    d ? format(parseISO(d), "d MMMM yyyy HH:mm") : null;

  return (
    <div className="space-y-0">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-ink-3 truncate">{inquiry.id}</span>
        <InquiryBadge status={inquiry.status} />
      </div>

      <Row label="Part Name"   value={<span className="font-semibold">{inquiry.part_name}</span>} />
      <Row label="Part Number" value={inquiry.part_number && <span className="font-mono">{inquiry.part_number}</span>} />
      <Row label="Qty Dibutuhkan" value={<><span className="font-bold font-mono tabular-nums">{inquiry.qty_needed}</span> pcs</>} />
      <Row label="Unit / Aset" value={inquiry.unit_asset} />
      <Row label="Tgl Dibutuhkan" value={inquiry.date_needed} />
      <Row label="Catatan"     value={inquiry.notes} />
      <Row
        label="Diajukan oleh"
        value={
          <span>
            {inquiry.submitter_name ?? inquiry.submitted_by ?? "—"}
            <span className="text-ink-3 ml-1">· {fmt(inquiry.created_at)}</span>
          </span>
        }
      />

      {/* UT respond block */}
      {(inquiry.status === "valid" || inquiry.status === "invalid") && (
        <div
          className="mt-3 p-3 rounded-lg"
          style={{
            background: inquiry.status === "valid" ? "#DCFCE7" : "#FEE2E2",
          }}
        >
          <p
            className="text-[10px] font-bold uppercase tracking-wider mb-2"
            style={{ color: inquiry.status === "valid" ? "#15803D" : "#B91C1C" }}
          >
            Respond UT
          </p>
          {inquiry.ut_site_code && (
            <div className="flex items-center gap-1.5 text-sm mb-1.5">
              <MapPin size={12} className="text-ink-3" />
              <span className="text-ink-3 text-xs">Kode WH UT:</span>
              <span className="font-mono font-bold" style={{ color: "#B07410" }}>{inquiry.ut_site_code}</span>
            </div>
          )}
          {inquiry.replacement_pn && (
            <div className="flex items-center gap-1.5 text-sm mb-1.5">
              <Package size={12} className="text-ink-3" />
              <span className="text-ink-3 text-xs">PN Pengganti:</span>
              <span className="font-mono font-bold text-ink">{inquiry.replacement_pn}</span>
            </div>
          )}
          {inquiry.respond_notes && (
            <p className="text-sm text-ink italic mt-1.5">&ldquo;{inquiry.respond_notes}&rdquo;</p>
          )}
          {inquiry.responded_at && (
            <p className="text-[10px] text-ink-3 mt-2">{fmt(inquiry.responded_at)}</p>
          )}
        </div>
      )}
    </div>
  );
}
