import type { InquiryStatus } from "@/lib/types";
import clsx from "clsx";

const INQ_CONFIG: Record<InquiryStatus, { label: string; dot: string; text: string; bg: string }> = {
  draft:       { label: "DRAFT",      dot: "#6B7280", text: "#374151", bg: "#F3F4F6" },
  pending:     { label: "PENDING",    dot: "#F59E0B", text: "#B45309", bg: "#FEF3C7" },
  available:   { label: "TERSEDIA",   dot: "#22C55E", text: "#15803D", bg: "#DCFCE7" },
  unavailable: { label: "TIDAK ADA",  dot: "#EF4444", text: "#B91C1C", bg: "#FEE2E2" },
  partial:     { label: "PARTIAL",    dot: "#6366F1", text: "#6D28D9", bg: "#EDE9FE" },
  rejected:    { label: "DITOLAK",    dot: "#EF4444", text: "#B91C1C", bg: "#FEE2E2" },
};

interface Props {
  status: InquiryStatus | string | null | undefined;
  size?: "sm" | "md";
}

export function InquiryBadge({ status, size = "md" }: Props) {
  if (!status) return null;
  const cfg = INQ_CONFIG[status as InquiryStatus] ?? { label: status.toUpperCase(), dot: "#9CA3AF", text: "#4B5563", bg: "#F3F4F6" };
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full font-semibold uppercase tracking-wide",
        size === "sm" ? "text-[10px] px-2 py-0.5" : "text-[11px] px-2.5 py-1"
      )}
      style={{ background: cfg.bg, color: cfg.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}
