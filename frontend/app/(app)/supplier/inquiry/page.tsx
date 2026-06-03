"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import {
  Send, RefreshCw, CheckCircle, XCircle, Download,
  Package, Calendar, User,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { InquiryBadge } from "@/components/ui/InquiryBadge";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useInquiryCount } from "@/hooks/useInquiry";
import type { PaginatedInquiries, InquiryListItem, InquiryDetail, Site } from "@/lib/types";

const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function SiteBadge({ site }: { site: string }) {
  const c = SITE_COLORS[site] ?? { bg: "#F3F4F6", text: "#4B5563" };
  return (
    <span className="text-[10px] font-mono font-bold px-2.5 py-1 rounded-full"
      style={{ background: c.bg, color: c.text }}>
      {site}
    </span>
  );
}

function CountPill({ n, active }: { n: number; active: boolean }) {
  if (!n) return null;
  return (
    <span className="text-[10px] font-bold tabular-nums"
      style={{
        padding: "1px 6px", borderRadius: 6,
        background: active ? "#E8A323" : "#FEF3C7",
        color: active ? "#16110D" : "#D97706",
      }}>
      {n}
    </span>
  );
}

const WH_MAP: Record<string, string> = { AGMR: "RTT", RANT: "SMR", SPUT: "BTL" };

type ItemRespond = {
  status: "valid" | "invalid";
  replacement_pn: string;
  ut_site_code: string;
  ut_note: string;
};

export default function SupplierInquiryPage() {
  const [siteFilter, setSiteFilter] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileModalOpen, setMobileModalOpen] = useState(false);

  // Respond form state
  const [itemResponses, setItemResponses] = useState<Record<string, ItemRespond>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  // Accessible sites — revalidated on focus so new HO assignments take effect immediately
  const { data: sites = [], isLoading: sitesLoading } = useSWR<Site[]>(
    "/me/sites", (u: string) => api.get<Site[]>(u), { revalidateOnFocus: true }
  );

  const limit = 30;
  const params = new URLSearchParams({ status: "pending", page: String(page), limit: String(limit) });
  if (siteFilter !== "ALL") params.set("site", siteFilter);

  const { data, isLoading, mutate } = useSWR<PaginatedInquiries>(
    `/inquiries?${params}`,
    (u: string) => api.get<PaginatedInquiries>(u),
    { refreshInterval: 30000 }
  );

  const { data: detail, mutate: mutateDetail } = useSWR<InquiryDetail>(
    activeId ? `/inquiries/${activeId}` : null,
    (u: string) => api.get<InquiryDetail>(u)
  );

  // Counts per site — fixed hooks for the 3 known sites; backend enforces supplier scoping
  const { data: cntAll  } = useInquiryCount("pending");
  const { data: cntAGMR } = useInquiryCount("pending", "AGMR");
  const { data: cntRANT } = useInquiryCount("pending", "RANT");
  const { data: cntSPUT } = useInquiryCount("pending", "SPUT");

  const pendingBySite: Record<string, number> = {
    ALL:  cntAll?.count  ?? 0,
    AGMR: cntAGMR?.count ?? 0,
    RANT: cntRANT?.count ?? 0,
    SPUT: cntSPUT?.count ?? 0,
  };

  const items = data?.items ?? [];

  // Auto-select first inquiry
  useEffect(() => {
    if (items.length > 0 && !items.find((i) => i.id === activeId)) {
      setActiveId(items[0].id);
    }
  }, [items]); // eslint-disable-line react-hooks/exhaustive-deps

  const active = items.find((i) => i.id === activeId) ?? items[0] ?? null;

  // Reset respond form when active inquiry or detail changes
  useEffect(() => {
    if (!active || !detail) return;
    const defaultCode = WH_MAP[active.site] ?? "";
    const init: Record<string, ItemRespond> = {};
    for (const item of detail.items) {
      init[item.id] = { status: "valid", replacement_pn: "", ut_site_code: defaultCode, ut_note: "" };
    }
    setItemResponses(init);
  }, [active?.id, detail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setItemField = (
    itemId: string,
    field: keyof ItemRespond,
    value: string
  ) => {
    setItemResponses(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value },
    }));
  };

  const handleRespond = async () => {
    if (!active || !detail || submitting) return;
    const pendingItems = detail.items.filter(i => i.status === "pending");
    const missing = pendingItems.some(i => {
      const r = itemResponses[i.id];
      return r?.status === "invalid" && !r.replacement_pn.trim();
    });
    if (missing) {
      setToast({ msg: "Isi PN pengganti untuk semua item invalid.", ok: false });
      return;
    }

    setSubmitting(true);
    try {
      const responses = pendingItems.map(item => {
        const r = itemResponses[item.id] ?? { status: "valid", replacement_pn: "", ut_site_code: "", ut_note: "" };
        return {
          item_id: item.id,
          status: r.status,
          replacement_pn: r.status === "invalid" ? (r.replacement_pn.trim() || null) : null,
          ut_site_code: r.ut_site_code.trim() || null,
          ut_note: r.ut_note.trim() || null,
        };
      });

      await api.patch(`/inquiries/${active.id}/respond`, { responses });
      setToast({ msg: `Respond dikirim ke ${active.site}.`, ok: true });
      setMobileModalOpen(false);
      mutate();
      mutateDetail();
      const next = items.find((i) => i.id !== active.id);
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
      a.href = url; a.download = `inquiry-export-${Date.now()}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch { setToast({ msg: "Export gagal.", ok: false }); }
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const pendingDetailItems = detail?.items.filter(i => i.status === "pending") ?? [];
  const canSubmit = !submitting && pendingDetailItems.length > 0 &&
    !pendingDetailItems.some(i => {
      const r = itemResponses[i.id];
      return r?.status === "invalid" && !r?.replacement_pn.trim();
    });

  // ── Respond panel content (shared between desktop aside & mobile modal) ──────
  const panelContent = active && detail ? (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <InquiryBadge status={active.status} />
          <SiteBadge site={active.site} />
        </div>
        <div className="text-[10px] text-ink-3 font-mono">
          {pendingDetailItems.length}/{detail.items.length} pending
        </div>
      </div>

      {/* Submitter */}
      <div className="flex items-center gap-2 mb-1">
        <User size={13} className="text-ink-3" />
        <span className="text-[13px] font-bold text-ink">{active.submitted_by_name ?? "—"}</span>
        {active.submitted_by_nrp && (
          <span className="text-[11px] font-mono text-ink-3">{active.submitted_by_nrp}</span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[12px] text-ink-3 mb-4">
        <Calendar size={11} />
        {active.created_at ? format(parseISO(active.created_at), "d MMM yyyy · HH:mm") : "—"}
      </div>

      {/* Per-item respond rows */}
      <div className="mb-4">
        <div className="text-[10px] font-bold uppercase tracking-widest text-ink-3 mb-2">
          Respond per Item
        </div>
        <div className="rounded-lg border border-[rgba(27,24,20,0.08)] overflow-hidden divide-y divide-[rgba(27,24,20,0.06)]">
          {detail.items.map((item, idx) => {
            const isPending = item.status === "pending";
            const r = itemResponses[item.id] ?? { status: "valid", replacement_pn: "", ut_site_code: WH_MAP[active.site] ?? "", ut_note: "" };
            const isInvalid = r.status === "invalid";

            if (!isPending) {
              const st = item.status === "valid"
                ? { bg: "#DCFCE7", color: "#15803D", label: "Valid" }
                : { bg: "#FEE2E2", color: "#B91C1C", label: "Invalid" };
              return (
                <div key={item.id} className={`px-3 py-2.5 ${idx % 2 === 1 ? "bg-surface-alt/30" : ""}`}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-[11px] text-ink">{item.part_number}</div>
                      {item.part_name && (
                        <div className="text-[10px] text-ink-2 truncate">{item.part_name}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="font-mono font-bold text-[12px] tabular-nums text-ink">{item.qty}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                        style={{ background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>
                  </div>
                  {item.replacement_pn && (
                    <div className="text-[10px] text-ink-3 mt-1">
                      PN: <span className="font-mono font-bold text-ink">{item.replacement_pn}</span>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div key={item.id}
                className={`px-3 py-2.5 space-y-2 ${idx % 2 === 1 ? "bg-surface-alt/30" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-mono font-bold text-[11px] text-ink">{item.part_number}</div>
                    {item.part_name && (
                      <div className="text-[10px] text-ink-2 truncate">{item.part_name}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <span className="font-mono font-bold text-[12px] tabular-nums text-ink">{item.qty}</span>
                    <span className="text-[10px] text-ink-3">pcs</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  {(["valid", "invalid"] as const).map(s => {
                    const on = r.status === s;
                    const style = s === "valid"
                      ? { bg: "#DCFCE7", color: "#15803D", border: "#86EFAC" }
                      : { bg: "#FEE2E2", color: "#B91C1C", border: "#FCA5A5" };
                    return (
                      <button key={s} type="button"
                        onClick={() => setItemField(item.id, "status", s)}
                        className="py-1.5 rounded-lg text-[11px] font-bold transition-all capitalize"
                        style={{
                          background: on ? style.bg : "#F6F3EE",
                          color: on ? style.color : "#6B6256",
                          border: on ? `1.5px solid ${style.border}` : "1px solid rgba(27,24,20,0.08)",
                        }}>
                        {s === "valid" ? "Valid" : "Invalid"}
                      </button>
                    );
                  })}
                </div>

                {isInvalid && (
                  <input
                    value={r.replacement_pn}
                    onChange={e => setItemField(item.id, "replacement_pn", e.target.value.toUpperCase())}
                    placeholder="PN Pengganti *"
                    maxLength={25}
                    className="w-full px-2.5 py-1.5 rounded border text-[11px] font-mono bg-bg outline-none"
                    style={{ minWidth: 200, borderColor: r.replacement_pn ? "#22C55E" : "#FCA5A5" }}
                  />
                )}

                <input
                  value={r.ut_site_code}
                  onChange={e => setItemField(item.id, "ut_site_code", e.target.value.toUpperCase())}
                  placeholder="Kode Warehouse UT"
                  maxLength={25}
                  className="w-full px-2.5 py-1.5 rounded border text-[11px] font-mono font-bold tracking-widest bg-bg outline-none uppercase"
                  style={{ minWidth: 200, borderColor: r.ut_site_code ? "#22C55E" : "rgba(27,24,20,0.12)" }}
                />

                <input
                  value={r.ut_note}
                  onChange={e => setItemField(item.id, "ut_note", e.target.value)}
                  placeholder={isInvalid ? "Alasan penggantian…" : "Catatan opsional…"}
                  className="w-full px-2.5 py-1.5 rounded border border-[rgba(27,24,20,0.1)] text-[11px] bg-bg outline-none text-ink-2"
                />
              </div>
            );
          })}

          <div className="px-3 py-2 bg-surface-alt text-[11px] font-bold text-ink-2 flex justify-between">
            <span>Total</span>
            <span className="font-mono tabular-nums text-ink">
              {detail.items.reduce((s, i) => s + i.qty, 0)} pcs
            </span>
          </div>
        </div>
      </div>

      {pendingDetailItems.length === 0 ? (
        <div className="py-3 text-center text-[12px] font-semibold text-aman">
          ✓ Semua item sudah direspond
        </div>
      ) : (
        <button
          onClick={handleRespond}
          disabled={!canSubmit}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
          style={{
            background: canSubmit ? "#E8A323" : "#EDE9E0",
            color: canSubmit ? "#16110D" : "#6B6256",
          }}>
          <Send size={15} />
          {submitting
            ? "Mengirim…"
            : `Kirim ${pendingDetailItems.length} respond ke ${active.site}`}
        </button>
      )}
    </>
  ) : active ? (
    <div className="py-8 text-center text-ink-3">
      <Package size={24} className="mx-auto mb-2 opacity-40" />
      <p className="text-sm">Memuat detail…</p>
    </div>
  ) : (
    <div className="py-12 text-center text-ink-3">
      <Package size={32} className="mx-auto mb-3 opacity-40" />
      <p className="text-sm font-semibold">Pilih inquiry untuk merespond.</p>
    </div>
  );

  if (!sitesLoading && sites.length === 0) {
    return (
      <div className="min-h-full">
        <Topbar title="Inquiry Masuk" subtitle="UT — hanya menampilkan pending" />
        <div className="flex flex-col items-center justify-center py-32 text-center px-6">
          <div className="w-14 h-14 rounded-2xl bg-surface-alt flex items-center justify-center mb-5">
            <Package size={24} className="text-ink-3" />
          </div>
          <h3 className="text-[16px] font-bold text-ink mb-2">Belum ada site yang di-assign</h3>
          <p className="text-[13px] text-ink-3 max-w-sm">
            Hubungi tim HO untuk mendapatkan akses ke site. Inquiry akan muncul otomatis setelah di-assign.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {toast && (
        <div className="fixed top-4 right-4 z-[200] px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2.5 animate-fade-in"
          style={{
            background: toast.ok ? "#DCFCE7" : "#FEE2E2",
            color: toast.ok ? "#15803D" : "#B91C1C",
            border: `1.5px solid ${toast.ok ? "#86EFAC" : "#FCA5A5"}`,
          }}>
          {toast.ok ? <CheckCircle size={15} /> : <XCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Mobile modal — hanya tampil di layar kecil */}
      <Modal
        open={mobileModalOpen}
        onClose={() => setMobileModalOpen(false)}
        title={active ? `Respond · ${active.site}` : "Respond Inquiry"}
        width={520}
      >
        <div className="p-5">{panelContent}</div>
      </Modal>

      <Topbar title="Inquiry Masuk" subtitle="UT — hanya menampilkan pending" />

      <div className="p-4 lg:p-6 pb-10 space-y-4 max-w-[1400px]">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-[11px] font-bold uppercase tracking-widest text-ink-3">Filter Site:</span>
          {(["ALL", ...sites.map((s) => s.code)] as string[]).map((s) => {
            const on = siteFilter === s;
            const count = pendingBySite[s] ?? 0;
            return (
              <button key={s} onClick={() => { setSiteFilter(s); setPage(1); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-bold transition-all"
                style={{
                  background: on ? "#16110D" : "#FFFFFF", color: on ? "#FFFFFF" : "#6B6256",
                  border: on ? "none" : "1px solid rgba(27,24,20,0.1)",
                  fontFamily: s === "ALL" ? "inherit" : "var(--font-mono, monospace)",
                }}>
                {s === "ALL" ? "Semua Site" : s}
                <CountPill n={count} active={on} />
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => mutate()}
              className="p-2 rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface text-ink-3 hover:text-ink transition-colors">
              <RefreshCw size={14} />
            </button>
            <button onClick={handleExport}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-bold transition-colors"
              style={{ background: "#E8A323", color: "#16110D" }}>
              <Download size={13} /> Export Excel
            </button>
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_460px] gap-4">

          {/* ── Inquiry list ── */}
          <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] overflow-hidden">
            <div className="hidden lg:grid text-[11px] font-semibold uppercase tracking-wider text-ink-3 px-5 py-3"
              style={{ gridTemplateColumns: "72px 80px 1fr 60px 60px 100px", background: "#F6F3EE" }}>
              <div>Site</div>
              <div>Tanggal</div>
              <div>Mekanik</div>
              <div className="text-right">Part</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Status</div>
            </div>

            {isLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
              </div>
            ) : items.length === 0 ? (
              <div className="py-16 text-center text-ink-3">
                <CheckCircle size={36} className="mx-auto mb-3 text-aman opacity-60" />
                <p className="text-sm font-semibold">Tidak ada inquiry pending.</p>
              </div>
            ) : (
              items.map((inq: InquiryListItem) => {
                const on = activeId === inq.id;
                const dateStr = inq.created_at ? format(parseISO(inq.created_at), "d MMM") : "—";
                return (
                  <button key={inq.id}
                    onClick={() => {
                      setActiveId(inq.id);
                      if (window.innerWidth < 1024) setMobileModalOpen(true);
                    }}
                    className="w-full text-left transition-colors border-t border-[rgba(27,24,20,0.06)]"
                    style={{ background: on ? "#FFF1D0" : "transparent" }}>
                    {/* Desktop row */}
                    <div className="hidden lg:grid items-center px-5 py-3.5"
                      style={{ gridTemplateColumns: "72px 80px 1fr 60px 60px 100px" }}>
                      <SiteBadge site={inq.site} />
                      <div className="text-[12.5px] font-bold text-ink">{dateStr}</div>
                      <div className="min-w-0 pr-2">
                        <div className="text-[13px] font-bold text-ink truncate">
                          {inq.submitted_by_name ?? "—"}
                        </div>
                        {inq.submitted_by_nrp && (
                          <div className="text-[10px] font-mono text-ink-3 mt-0.5">{inq.submitted_by_nrp}</div>
                        )}
                      </div>
                      <div className="text-right font-mono font-bold text-ink tabular-nums text-[13px]">
                        {inq.total_unique_parts}<span className="text-ink-3 font-normal text-[10px] ml-0.5">pn</span>
                      </div>
                      <div className="text-right font-mono font-bold text-ink tabular-nums text-[13px]">
                        {inq.total_qty}<span className="text-ink-3 font-normal text-[10px] ml-0.5">pcs</span>
                      </div>
                      <div className="text-right">
                        <InquiryBadge status={inq.status} size="sm" />
                      </div>
                    </div>
                    {/* Mobile card */}
                    <div className="lg:hidden p-4 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <SiteBadge site={inq.site} />
                          <InquiryBadge status={inq.status} size="sm" />
                        </div>
                        <div className="text-sm font-bold text-ink">{inq.submitted_by_name ?? "—"}</div>
                        <div className="text-xs text-ink-2 mt-1">
                          {dateStr} · {inq.total_unique_parts} part · {inq.total_qty} pcs
                        </div>
                      </div>
                      <div className="flex-shrink-0 self-center">
                        <Send size={14} className="text-ink-3" />
                      </div>
                    </div>
                  </button>
                );
              })
            )}

            {data && data.pages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-[rgba(27,24,20,0.06)] bg-[#F6F3EE]">
                <span className="text-[12px] text-ink-3">{data.total} pending · hal. {page}/{data.pages}</span>
                <div className="flex gap-2">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">Prev</button>
                  <button onClick={() => setPage(p => Math.min(data.pages, p + 1))} disabled={page === data.pages}
                    className="px-3 py-1.5 text-xs rounded-lg border border-[rgba(27,24,20,0.1)] bg-surface disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>

          {/* ── Desktop respond panel ── */}
          <aside className="hidden lg:block bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-5 lg:sticky lg:top-6 self-start">
            {panelContent}
          </aside>
        </div>
      </div>
    </div>
  );
}
