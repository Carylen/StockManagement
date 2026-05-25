"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Send, RefreshCw, CheckCircle, XCircle, Download,
  Package, User, MapPin, Calendar,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import type { PaginatedInquiries, Inquiry } from "@/lib/types";

// ── Site colours ────────────────────────────────────────────────
const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function SiteBadge({ site }: { site: string }) {
  const c = SITE_COLORS[site] ?? { bg: "#F3F4F6", text: "#4B5563" };
  return (
    <span
      className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.text }}
    >
      {site}
    </span>
  );
}

// ── Pending count badge used in site filter chips ───────────────
function CountPill({ n, active }: { n: number; active: boolean }) {
  if (!n) return null;
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-md"
      style={{
        background: active ? "rgba(232,163,35,0.25)" : "#FEF3C7",
        color: active ? "#B07410" : "#B45309",
      }}
    >
      {n}
    </span>
  );
}

const SITES = ["AGMR", "RANT", "SPUT"] as const;

export default function SupplierInquiryPage() {
  const [siteFilter, setSiteFilter]   = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [page, setPage]               = useState(1);
  const [activeId, setActiveId]       = useState<string | null>(null);

  // Respond form state
  const [mode, setMode]         = useState<"valid" | "invalid">("valid");
  const [utCode, setUtCode]     = useState("");
  const [replacePn, setReplacePn] = useState("");
  const [note, setNote]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const limit = 30;
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (statusFilter) params.set("status", statusFilter);
  if (siteFilter !== "ALL") params.set("site", siteFilter);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u),
    { refreshInterval: 30000 }
  );

  // Also fetch pending counts per site for the filter pills
  const { data: allPending } = useSWR<PaginatedInquiries>(
    "/inquiries?status=pending&limit=200",
    (u: string) => api.get<PaginatedInquiries>(u),
    { refreshInterval: 30000 }
  );

  const items = data?.items ?? [];

  // Auto-select first item when list loads or filter changes
  useEffect(() => {
    if (items.length > 0 && !items.find((i) => i.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Reset form when active inquiry changes
  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;
  useEffect(() => {
    if (!active) return;
    setMode("valid");
    setReplacePn("");
    setNote("");
    // Suggest nearest UT warehouse for active inquiry site
    const WH: Record<string, string> = { AGMR: "RTT", RANT: "SMR", SPUT: "BTL" };
    setUtCode(WH[active.site] ?? "");
  }, [active?.id]);  // eslint-disable-line react-hooks/exhaustive-deps

  const pendingBySite: Record<string, number> = { ALL: 0 };
  for (const s of SITES) pendingBySite[s] = 0;
  for (const inq of allPending?.items ?? []) {
    pendingBySite.ALL = (pendingBySite.ALL ?? 0) + 1;
    if (inq.site in pendingBySite) pendingBySite[inq.site]++;
  }

  const handleRespond = async () => {
    if (!active || submitting) return;
    if (!utCode) { setToast({ msg: "Isi kode warehouse UT terlebih dahulu.", ok: false }); return; }
    if (mode === "invalid" && !replacePn) { setToast({ msg: "Isi Part Number pengganti.", ok: false }); return; }

    setSubmitting(true);
    try {
      await api.patch(`/inquiries/${active.id}/respond`, {
        result: mode,
        ut_site_code: utCode,
        replacement_pn: mode === "invalid" ? replacePn : null,
        note: note || null,
      });
      setToast({ msg: `Respond ${mode.toUpperCase()} dikirim ke ${active.site}.`, ok: true });
      mutate();
      // Move to next pending
      const next = items.find((i) => i.id !== active.id && i.status === "pending");
      if (next) setActiveId(next.id);
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Gagal mengirim respond.", ok: false });
    } finally {
      setSubmitting(false);
    }
  };

  const handleExport = async () => {
    const p = new URLSearchParams();
    if (siteFilter !== "ALL") p.set("site", siteFilter);
    try {
      const blob = await api.download(`/export/inquiries?${p}`);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = url;
      a.download = `inquiry-export-${Date.now()}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast({ msg: "Export gagal.", ok: false });
    }
  };

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <div className="min-h-full">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2.5 animate-fade-in"
          style={{
            background: toast.ok ? "#DCFCE7" : "#FEE2E2",
            color: toast.ok ? "#15803D" : "#B91C1C",
            border: `1.5px solid ${toast.ok ? "#86EFAC" : "#FCA5A5"}`,
          }}
        >
          {toast.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      <Topbar title="Inquiry Masuk dari KPP" subtitle="UT Rantau · PIC · multi-site inbox" />

      <div className="p-4 lg:p-6 pb-10 space-y-4 max-w-[1400px]">

        {/* ── Top action bar ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Site filter chips */}
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Filter Site:</span>
          {(["ALL", ...SITES] as string[]).map((s) => {
            const on = siteFilter === s;
            const count = pendingBySite[s] ?? 0;
            return (
              <button
                key={s}
                onClick={() => { setSiteFilter(s); setPage(1); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all"
                style={{
                  background: on ? "#16110D" : "#FFFFFF",
                  color: on ? "#FFFFFF" : "#6B6256",
                  border: on ? "none" : "1px solid rgba(27,24,20,0.1)",
                  fontFamily: s === "ALL" ? "inherit" : "var(--font-mono, monospace)",
                }}
              >
                {s === "ALL" ? "Semua Site KPP" : s}
                <CountPill n={count} active={on} />
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => mutate()}
              className="p-2 rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface text-ink-3 hover:text-ink transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
              style={{ background: "#E8A323", color: "#16110D" }}
            >
              <Download size={13} />
              Export Excel
            </button>
          </div>
        </div>

        {/* ── Status chips ───────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {[
            { key: "",        label: "Semua",          dot: null },
            { key: "pending", label: "Pending",        dot: "#F59E0B" },
            { key: "valid",   label: "Valid",           dot: "#22C55E" },
            { key: "invalid", label: "Invalid · diganti", dot: "#EF4444" },
          ].map(({ key, label, dot }) => {
            const on = statusFilter === key;
            const count = (data?.total && statusFilter === key)
              ? data.total
              : undefined;
            return (
              <button
                key={key}
                onClick={() => { setStatusFilter(key); setPage(1); }}
                className="flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all"
                style={{
                  background: on ? "#16110D" : "#FFFFFF",
                  color: on ? "#FFFFFF" : "#6B6256",
                  border: on ? "none" : "1px solid rgba(27,24,20,0.1)",
                }}
              >
                {dot && (
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: on ? "#fff" : dot }}
                  />
                )}
                {label}
                {count !== undefined && (
                  <span className="text-[11px] opacity-60 font-mono tabular-nums">{count}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Two-column grid: list + panel ──────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">

          {/* List */}
          <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
            {/* Table header */}
            <div
              className="hidden lg:grid text-[11px] font-semibold uppercase tracking-wider text-ink-3 px-5 py-3"
              style={{
                gridTemplateColumns: "72px 72px 1fr 56px 104px",
                background: "#F6F3EE",
              }}
            >
              <div>Site</div>
              <div>Tanggal</div>
              <div>Part &amp; Asal</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Status</div>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-ink-3">
                <CheckCircle size={36} className="mx-auto mb-3 text-aman opacity-60" />
                <p className="text-sm font-semibold">Tidak ada inquiry pada filter ini.</p>
              </div>
            ) : (
              items.map((inq) => {
                const on = activeId === inq.id;
                const date = inq.created_at
                  ? format(parseISO(inq.created_at), "d MMM")
                  : "—";
                return (
                  <button
                    key={inq.id}
                    onClick={() => setActiveId(inq.id)}
                    className="w-full text-left transition-colors border-t border-[rgba(27,24,20,0.06)]"
                    style={{ background: on ? "#FFF1D0" : "transparent" }}
                  >
                    {/* Desktop row */}
                    <div
                      className="hidden lg:grid items-center px-5 py-3.5"
                      style={{ gridTemplateColumns: "72px 72px 1fr 56px 104px" }}
                    >
                      <div><SiteBadge site={inq.site} /></div>
                      <div>
                        <div className="text-[12.5px] font-bold text-ink">{date}</div>
                        <div className="text-[10px] text-ink-3 font-mono mt-0.5 truncate max-w-[64px]">{inq.id.slice(-8)}</div>
                      </div>
                      <div className="min-w-0 pr-2">
                        <div className="text-[13.5px] font-bold text-ink truncate">{inq.part_name}</div>
                        <div className="text-[11px] text-ink-2 mt-0.5 truncate">
                          {inq.part_number && <span className="font-mono mr-1.5">{inq.part_number}</span>}
                          {inq.submitter_name && <span>{inq.submitter_name}</span>}
                          {inq.unit_asset && <span> · {inq.unit_asset}</span>}
                        </div>
                      </div>
                      <div className="text-right font-mono font-bold text-ink tabular-nums">
                        {inq.qty_needed}<span className="text-ink-3 font-normal ml-1">pcs</span>
                      </div>
                      <div className="text-right"><InquiryBadge status={inq.status} size="sm" /></div>
                    </div>

                    {/* Mobile card */}
                    <div className="lg:hidden p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SiteBadge site={inq.site} />
                          <InquiryBadge status={inq.status} size="sm" />
                        </div>
                        <div className="text-sm font-bold text-ink truncate">{inq.part_name}</div>
                        {inq.part_number && (
                          <div className="text-[10px] font-mono text-ink-3 mt-0.5">{inq.part_number}</div>
                        )}
                        <div className="text-xs text-ink-2 mt-1 flex items-center gap-2">
                          <span>{date}</span>
                          {inq.submitter_name && <span>· {inq.submitter_name}</span>}
                          <span className="font-mono font-bold text-ink">{inq.qty_needed} pcs</span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {/* Pagination */}
            {data && data.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(27,24,20,0.06)] bg-[#F6F3EE]">
                <span className="text-[12px] text-ink-3">
                  {data.total} inquiry · hal. {page}/{data.pages}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40"
                  >
                    Prev
                  </button>
                  <button
                    onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                    disabled={page === data.pages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── Respond panel ──────────────────────────────────── */}
          <aside className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-5 lg:sticky lg:top-6 self-start">
            {active ? (
              <RespondPanel
                inquiry={active}
                mode={mode}
                utCode={utCode}
                replacePn={replacePn}
                note={note}
                submitting={submitting}
                onModeChange={setMode}
                onUtCodeChange={setUtCode}
                onReplacePnChange={setReplacePn}
                onNoteChange={setNote}
                onSubmit={handleRespond}
              />
            ) : (
              <div className="py-12 text-center text-ink-3">
                <Package size={32} className="mx-auto mb-3 opacity-40" />
                <p className="text-sm font-semibold">Pilih inquiry untuk merespond.</p>
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}

// ── Sub-component: respond panel ────────────────────────────────
interface RespondPanelProps {
  inquiry: Inquiry;
  mode: "valid" | "invalid";
  utCode: string;
  replacePn: string;
  note: string;
  submitting: boolean;
  onModeChange: (m: "valid" | "invalid") => void;
  onUtCodeChange: (v: string) => void;
  onReplacePnChange: (v: string) => void;
  onNoteChange: (v: string) => void;
  onSubmit: () => void;
}

function RespondPanel({
  inquiry, mode, utCode, replacePn, note, submitting,
  onModeChange, onUtCodeChange, onReplacePnChange, onNoteChange, onSubmit,
}: RespondPanelProps) {
  const date = inquiry.created_at
    ? format(parseISO(inquiry.created_at), "d MMM yyyy · HH:mm")
    : "—";
  const canSubmit = !!utCode && (mode === "valid" || !!replacePn);

  return (
    <>
      {/* Header badges */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <InquiryBadge status={inquiry.status} />
          <SiteBadge site={inquiry.site} />
        </div>
        <span className="text-[10px] font-mono text-ink-3">{inquiry.id.slice(-12)}</span>
      </div>

      {/* Part name */}
      <h2 className="text-[18px] font-bold text-ink leading-tight tracking-tight mb-1">
        {inquiry.part_name}
      </h2>
      {inquiry.part_number && (
        <div className="font-mono text-[12px] text-ink-2 mb-1">{inquiry.part_number}</div>
      )}
      <div className="text-[12px] text-ink-3 mb-4 flex items-center gap-1">
        <Calendar size={11} />
        {date}
      </div>

      {/* Info grid */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <div className="bg-bg rounded-lg p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-3 mb-1.5">Diajukan oleh</div>
          <div className="text-[13px] font-bold text-ink">{inquiry.submitter_name ?? "—"}</div>
        </div>
        <div className="bg-bg rounded-lg p-3">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-3 mb-1.5">Qty · Unit</div>
          <div className="text-[22px] font-bold text-ink font-mono tabular-nums leading-none">
            {inquiry.qty_needed}
            <span className="text-[11px] font-normal text-ink-3 ml-1">pcs</span>
          </div>
          {inquiry.unit_asset && (
            <div className="text-[11px] text-ink-2 mt-1 truncate">{inquiry.unit_asset}</div>
          )}
        </div>
      </div>

      {/* Mechanic notes (if any) */}
      {inquiry.notes && (
        <div className="bg-bg rounded-lg p-3 mb-4">
          <div className="text-[9px] font-bold uppercase tracking-widest text-ink-3 mb-1.5">Catatan mekanik</div>
          <p className="text-[12.5px] text-ink leading-relaxed italic">&ldquo;{inquiry.notes}&rdquo;</p>
        </div>
      )}

      {/* Respond form (pending only) */}
      {inquiry.status === "pending" ? (
        <>
          <div className="text-[11px] font-bold uppercase tracking-widest text-ink-3 mb-2">
            Respond — pilih satu
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {([
              { k: "valid",   label: "Valid · tersedia",   desc: "Isi kode warehouse UT",          color: "#22C55E", bg: "#DCFCE7" },
              { k: "invalid", label: "Invalid · PN diganti", desc: "Isi PN pengganti + kode WH UT", color: "#EF4444", bg: "#FEE2E2" },
            ] as const).map(({ k, label, desc, color, bg }) => {
              const on = mode === k;
              return (
                <button
                  key={k}
                  onClick={() => onModeChange(k)}
                  className="p-3 rounded-xl text-left transition-all"
                  style={{
                    background: on ? bg : "#F6F3EE",
                    color: on ? color : "#6B6256",
                    border: on ? `1.5px solid ${color}` : "1px solid rgba(27,24,20,0.08)",
                  }}
                >
                  <div className="text-[12.5px] font-bold">{label}</div>
                  <div className="text-[10.5px] mt-1 opacity-70">{desc}</div>
                </button>
              );
            })}
          </div>

          {/* PN pengganti (invalid only) */}
          {mode === "invalid" && (
            <div className="mb-3">
              <label className="block text-[11px] font-bold uppercase tracking-widest text-ink-3 mb-1.5">
                Part Number pengganti *
              </label>
              <input
                value={replacePn}
                onChange={(e) => onReplacePnChange(e.target.value)}
                placeholder="contoh: 6212-31-2300"
                className="w-full px-3 py-2.5 rounded-lg border text-[13px] font-mono font-semibold text-ink bg-bg outline-none transition-colors"
                style={{ borderColor: replacePn ? "#22C55E" : "rgba(27,24,20,0.12)" }}
              />
            </div>
          )}

          {/* WT warehouse code */}
          <div className="mb-3">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-ink-3 mb-1.5">
              Kode Warehouse UT *
            </label>
            <input
              value={utCode}
              onChange={(e) => onUtCodeChange(e.target.value.toUpperCase())}
              placeholder="contoh: RTT"
              maxLength={6}
              className="w-full px-3 py-2.5 rounded-lg border text-[14px] font-mono font-bold tracking-widest text-ink bg-bg outline-none transition-colors uppercase"
              style={{ borderColor: utCode ? "#22C55E" : "rgba(27,24,20,0.12)" }}
            />
            <p className="mt-1.5 text-[11px] text-ink-3">
              WH terdekat ke {inquiry.site}:{" "}
              <span className="font-mono font-bold" style={{ color: "#B07410" }}>
                {{ AGMR: "RTT", RANT: "SMR", SPUT: "BTL" }[inquiry.site] ?? "—"}
              </span>
            </p>
          </div>

          {/* Note */}
          <div className="mb-4">
            <label className="block text-[11px] font-bold uppercase tracking-widest text-ink-3 mb-1.5">
              Catatan untuk Plant
            </label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => onNoteChange(e.target.value)}
              placeholder={
                mode === "valid"
                  ? "ETA, kondisi stok, info tambahan…"
                  : "Alasan penggantian PN, kondisi stok…"
              }
              className="w-full px-3 py-2.5 rounded-lg border border-[rgba(27,24,20,0.12)] text-[12px] text-ink bg-bg outline-none resize-none"
            />
          </div>

          <button
            onClick={onSubmit}
            disabled={!canSubmit || submitting}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: canSubmit && !submitting
                ? mode === "valid" ? "#22C55E" : "#EF4444"
                : "#EDE9E0",
              color: canSubmit && !submitting ? "#fff" : "#6B6256",
            }}
          >
            <Send size={15} />
            {submitting ? "Mengirim…" : `Kirim respond ke ${inquiry.site}`}
          </button>
        </>
      ) : (
        /* Already responded */
        <div
          className="rounded-xl p-4"
          style={{
            background: inquiry.status === "valid" ? "#DCFCE7" : "#FEE2E2",
          }}
        >
          <div
            className="text-[11px] font-bold uppercase tracking-widest mb-3"
            style={{ color: inquiry.status === "valid" ? "#15803D" : "#B91C1C" }}
          >
            Sudah Direspond
          </div>

          {inquiry.replacement_pn && (
            <div className="bg-white/60 rounded-lg p-2.5 mb-3">
              <div
                className="text-[10px] font-bold uppercase tracking-widest mb-1"
                style={{ color: "#B91C1C" }}
              >
                PN Pengganti
              </div>
              <div className="font-mono font-bold text-ink text-[13px]">{inquiry.replacement_pn}</div>
            </div>
          )}

          {inquiry.ut_site_code && (
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={12} className="text-ink-3" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-ink-2">Kode WH UT</span>
              <span className="font-mono font-bold text-[13px]" style={{ color: "#B07410" }}>
                {inquiry.ut_site_code}
              </span>
            </div>
          )}

          {inquiry.respond_notes && (
            <p className="text-[12.5px] text-ink leading-relaxed italic mt-2">
              &ldquo;{inquiry.respond_notes}&rdquo;
            </p>
          )}

          {inquiry.responded_at && (
            <p className="text-[11px] text-ink-3 mt-3">
              {format(parseISO(inquiry.responded_at), "d MMM yyyy · HH:mm")}
            </p>
          )}
        </div>
      )}
    </>
  );
}
