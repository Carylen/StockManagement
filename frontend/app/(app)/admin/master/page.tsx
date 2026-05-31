"use client";

import { useRef, useState, useEffect, KeyboardEvent } from "react";
import useSWR from "swr";
import {
  AlertTriangle, CheckCircle, Download, RefreshCw, X, Search,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { api } from "@/lib/api";
import { downloadTemplate } from "@/lib/downloadTemplate";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import type { MasterMeta, MasterPreview, MasterPart, MasterUploadResult } from "@/lib/types";

type UploadState = "idle" | "uploading" | "result";
type ClassFilter = "all" | "V" | "G";

const PAGE_SIZE = 25;

function Highlight({ text, query }: { text: string | null; query: string }) {
  if (!text) return <span className="text-ink-3">—</span>;
  if (!query.trim()) return <>{text}</>;
  const q = query.trim();
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-kpp/20 text-kpp font-semibold not-italic rounded-[3px] px-px">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

function KelasBadge({ kelas }: { kelas: "V" | "G" }) {
  return (
    <span className={`inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full font-mono ${
      kelas === "V" ? "bg-aman-bg text-aman" : "bg-over-bg text-over"
    }`}>
      • {kelas}
    </span>
  );
}

function buildListUrl(q: string, kelas: ClassFilter, page: number) {
  const params = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
  if (q.trim()) params.set("search", q.trim());
  if (kelas !== "all") params.set("kelas", kelas);
  return `/master/parts?${params}`;
}

export default function MasterClassVGPage() {
  const t = useTranslations("masterVG");
  const { user } = useAuth();
  const site = user?.site ?? "AGMR";

  // ── Upload state ──────────────────────────────────────────────────
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadResult, setUploadResult] = useState<MasterUploadResult | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Search + pagination state ─────────────────────────────────────
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [classFilter, setClassFilter] = useState<ClassFilter>("all");
  const [page, setPage] = useState(1);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);

  // Debounce + reset page on query/filter change
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => { setPage(1); }, [classFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
        setActiveIdx(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ── SWR ──────────────────────────────────────────────────────────
  const { data: meta, isLoading: metaLoading, mutate: mutateMeta } = useSWR<MasterMeta>(
    "/master/parts/meta",
    (u: string) => api.get<MasterMeta>(u)
  );

  const { data: listData, isLoading: listLoading, mutate: mutateList } = useSWR<MasterPreview>(
    buildListUrl(debouncedQuery, classFilter, page),
    (u: string) => api.get<MasterPreview>(u)
  );

  const suggestions = listData?.items.slice(0, 8) ?? [];
  const items = listData?.items ?? [];
  const totalItems = listData?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));

  // ── Upload handlers ───────────────────────────────────────────────
  const handleFile = async (file: File) => {
    setUploadError(null);
    setUploadState("uploading");
    try {
      const result = await api.uploadFile<MasterUploadResult>("/master/parts/upload", file);
      setUploadResult(result);
      setUploadState("result");
      setToast({ msg: t("uploadSuccess"), kind: "ok" });
      mutateMeta();
      mutateList();
    } catch (e: unknown) {
      setUploadError(e instanceof Error ? e.message : t("uploadError"));
      setUploadState("idle");
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleDownloadTemplate = async () => {
    try {
      await downloadTemplate("master");
    } catch {
      setToast({ msg: t("downloadError"), kind: "err" });
    }
  };

  const resetUpload = () => {
    setUploadState("idle");
    setUploadResult(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Search handlers ───────────────────────────────────────────────
  const selectSuggestion = (part: MasterPart) => {
    setQuery(part.part_number);
    setDropdownOpen(false);
    setActiveIdx(-1);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!dropdownOpen || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIdx >= 0 && suggestions[activeIdx]) selectSuggestion(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setDropdownOpen(false);
      setActiveIdx(-1);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setDropdownOpen(false);
    setActiveIdx(-1);
  };

  const totalParts = (meta?.class_v_count ?? 0) + (meta?.class_g_count ?? 0);

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={t("title")} subtitle={`Admin ${site} · Master Data`} />

      <div className="p-6 pb-20 flex flex-col gap-5">

        {/* ── 1. Active master card ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-bold text-ink-3 uppercase tracking-widest mb-1">
                {t("activeCard")}
              </p>
              {metaLoading ? (
                <div className="h-6 w-52 bg-surface-alt animate-pulse rounded mt-1" />
              ) : (
                <p className="text-2xl font-extrabold text-ink tracking-tight leading-none">
                  {meta?.filename ?? t("noFile")}
                </p>
              )}
              {!metaLoading && meta?.uploaded_at && (
                <p className="text-xs text-ink-2 mt-2">
                  {t("uploadedAt")}{" "}
                  {format(parseISO(meta.uploaded_at), "d MMM yyyy · HH:mm")}{" "}
                  {meta.uploader_name ? `${t("uploadedBy")} ${meta.uploader_name}` : ""}
                </p>
              )}
            </div>
            <span className="px-3 py-1 rounded-full bg-aman-bg text-aman text-[10px] font-bold uppercase tracking-widest">
              {t("activeStatus")}
            </span>
          </div>

          <div className="grid grid-cols-4 divide-x divide-border bg-bg">
            {[
              { label: t("statClassV"),  value: meta?.class_v_count, color: "#16A34A" },
              { label: t("statClassG"),  value: meta?.class_g_count, color: "#E8A323" },
              { label: t("statKomatsu"), value: meta?.komatsu_count, color: "#FF7A59" },
              { label: t("statScania"),  value: meta?.scania_count,  color: "#5B5BD6" },
            ].map((s, i) => (
              <div key={i} className="px-5 py-5 relative">
                <div className="absolute top-0 left-0 right-0 h-[3px]" style={{ background: s.color }} />
                <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.6px]">{s.label}</p>
                {metaLoading ? (
                  <div className="h-8 w-20 bg-surface-alt animate-pulse rounded mt-2" />
                ) : (
                  <p className="text-[30px] font-bold font-mono tracking-tight leading-none mt-2 tnum" style={{ color: s.color }}>
                    {s.value !== undefined ? s.value.toLocaleString("id-ID") : "—"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── 2. Upload zone ── */}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`bg-surface rounded-2xl border-[1.5px] border-dashed px-8 py-8 relative overflow-hidden transition-colors ${
            dragging ? "border-kpp bg-kpp/5" : "border-kpp"
          }`}
        >
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-kpp/10 blur-3xl pointer-events-none" />

          <div className="flex items-start gap-8 relative flex-wrap">
            <div
              className="w-20 h-20 rounded-2xl flex items-center justify-center text-white flex-shrink-0 shadow-lg"
              style={{ background: "linear-gradient(135deg, var(--c-kpp), var(--c-kpp-deep))" }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <path d="M12 3v13" /><path d="m6 9 6-6 6 6" /><path d="M5 21h14" />
              </svg>
            </div>

            <div className="flex-1 min-w-[280px]">
              <p className="text-[22px] font-bold text-ink tracking-tight leading-tight">
                {uploadState === "uploading" ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw size={18} className="animate-spin text-kpp" />
                    {t("uploading")}
                  </span>
                ) : uploadState === "result" ? (
                  <span className="flex items-center gap-2 text-aman">
                    <CheckCircle size={20} /> {t("uploadSuccess")}
                  </span>
                ) : (
                  t("uploadTitle")
                )}
              </p>

              {uploadState === "idle" && (
                <>
                  <p className="text-[13px] text-ink-2 mt-2 leading-relaxed max-w-[520px]">
                    {t("uploadDesc")}{" "}
                    <code className="font-mono text-[11px] bg-surface-alt px-1.5 py-0.5 rounded border border-border">
                      {t("columnsList")}
                    </code>
                  </p>
                  <div className="mt-5 flex items-center gap-3 flex-wrap">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-5 py-2.5 bg-ink text-white text-sm font-bold rounded-xl hover:bg-ink/80 transition-colors"
                    >
                      {t("uploadTitle")}
                    </button>
                    <button
                      type="button"
                      onClick={handleDownloadTemplate}
                      className="flex items-center gap-1.5 px-4 py-2.5 bg-surface-alt text-ink text-sm font-semibold rounded-xl hover:bg-surface-alt/80 transition-colors"
                    >
                      <Download size={14} /> {t("downloadTemplate")}
                    </button>
                    <span className="flex items-center gap-1.5 text-[11px] text-warning font-semibold">
                      <AlertTriangle size={12} /> {t("uploadWarning")}
                    </span>
                  </div>
                </>
              )}

              {uploadState === "result" && uploadResult && (
                <div className="mt-4 space-y-4">
                  <div className="flex gap-4 flex-wrap">
                    {[
                      { label: t("resultInserted"), value: uploadResult.inserted,      color: "text-aman" },
                      { label: t("resultUpdated"),  value: uploadResult.updated,       color: "text-ink" },
                      { label: t("resultClassV"),   value: uploadResult.class_v,       color: "text-kpp" },
                      { label: t("resultClassG"),   value: uploadResult.class_g,       color: "text-ut-deep" },
                      { label: t("resultSkipped"),  value: uploadResult.skipped,       color: "text-over" },
                      { label: t("resultErrors"),   value: uploadResult.errors.length, color: "text-warning" },
                    ].map((s) => (
                      <div key={s.label} className="text-center">
                        <p className={`font-mono font-bold text-2xl tnum ${s.color}`}>{s.value}</p>
                        <p className="text-[10px] text-ink-3 font-bold uppercase tracking-wide mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {uploadResult.errors.length > 0 && (
                    <div className="bg-warning-bg rounded-xl p-3 border border-warning/20 space-y-1">
                      {uploadResult.errors.slice(0, 3).map((err, i) => (
                        <p key={i} className="text-xs text-warning font-semibold">{err}</p>
                      ))}
                    </div>
                  )}
                  <button
                    onClick={resetUpload}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-surface-alt text-ink text-sm font-semibold hover:bg-surface-alt/80 transition-colors"
                  >
                    <X size={13} /> {t("uploadAgain")}
                  </button>
                </div>
              )}

              {uploadError && uploadState === "idle" && (
                <div className="mt-4 flex items-start gap-2 p-3 bg-warning-bg rounded-xl border border-warning/20">
                  <AlertTriangle size={15} className="text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-warning">{uploadError}</p>
                    <button onClick={() => setUploadError(null)} className="text-xs underline text-warning mt-1">
                      {t("tryAgain")}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {meta && uploadState === "idle" && (
              <div className="border-l border-border pl-8 shrink-0">
                <p className="text-[10px] font-bold text-ink-3 uppercase tracking-widest mb-1.5">Total Master</p>
                <p className="text-3xl font-bold font-mono text-ink tracking-tight tnum">
                  {totalParts.toLocaleString("id-ID")}
                </p>
                <p className="text-[11px] text-ink-2 mt-1">part aktif di sistem</p>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ""; }}
          />
        </div>

        {/* ── 3. Table with search + chips + pagination ── */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">

          {/* Toolbar row */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">

            {/* Search */}
            <div ref={searchRef} className="relative flex-1 max-w-sm">
              <div className="flex items-center gap-2 px-3 py-2 bg-bg border border-border rounded-xl">
                <Search size={13} className="text-ink-3 flex-shrink-0" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setDropdownOpen(true);
                    setActiveIdx(-1);
                  }}
                  onFocus={() => { if (query) setDropdownOpen(true); }}
                  onKeyDown={handleKeyDown}
                  placeholder="Cari Part Number, deskripsi, mnemonic…"
                  className="flex-1 bg-transparent text-[13px] text-ink placeholder:text-ink-3 outline-none"
                />
                {query && (
                  <button type="button" onClick={clearSearch} className="text-ink-3 hover:text-ink transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>

              {/* Floating dropdown */}
              {dropdownOpen && query.trim() && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden z-50 min-w-[420px]">
                  {suggestions.map((part, i) => (
                    <button
                      key={part.part_number}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectSuggestion(part); }}
                      onMouseEnter={() => setActiveIdx(i)}
                      className={`w-full px-4 py-3 flex items-center gap-3 text-left transition-colors border-t first:border-t-0 border-border/50 ${
                        activeIdx === i ? "bg-surface-alt" : "hover:bg-surface-alt/60"
                      }`}
                    >
                      <KelasBadge kelas={part.kelas} />
                      <div className="flex-1 min-w-0">
                        <p className="font-mono font-bold text-[12px] text-ink">
                          <Highlight text={part.part_number} query={query} />
                        </p>
                        {part.description && (
                          <p className="text-[11px] text-ink-2 truncate mt-0.5">
                            <Highlight text={part.description} query={query} />
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-0.5 flex-shrink-0 text-right">
                        {part.mnemonic && (
                          <span className="text-[10px] font-mono text-ink-3">
                            <Highlight text={part.mnemonic} query={query} />
                          </span>
                        )}
                        {part.commodity && (
                          <span className="text-[10px] text-ink-3">
                            <Highlight text={part.commodity} query={query} />
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                  {totalItems > 8 && (
                    <div className="px-4 py-2 border-t border-border/50 bg-bg">
                      <p className="text-[11px] text-ink-3 font-semibold">
                        +{(totalItems - 8).toLocaleString("id-ID")} hasil lainnya di tabel
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Chip filters */}
            <div className="flex items-center gap-1.5">
              {/* Semua */}
              <button
                type="button"
                onClick={() => setClassFilter("all")}
                className={`px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                  classFilter === "all"
                    ? "bg-ink text-white"
                    : "bg-surface-alt text-ink-2 hover:text-ink"
                }`}
              >
                Semua
              </button>

              {/* Class V */}
              <button
                type="button"
                onClick={() => setClassFilter("V")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                  classFilter === "V"
                    ? "bg-aman-bg text-aman"
                    : "bg-surface-alt text-ink-2 hover:text-ink"
                }`}
              >
                <span className="text-aman text-[8px]">●</span>
                Class V
              </button>

              {/* Class G */}
              <button
                type="button"
                onClick={() => setClassFilter("G")}
                className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[12px] font-bold transition-all ${
                  classFilter === "G"
                    ? "bg-over-bg text-over"
                    : "bg-surface-alt text-ink-2 hover:text-ink"
                }`}
              >
                <span className="text-over text-[8px]">●</span>
                Class G
              </button>
            </div>

            {/* Count */}
            {listData && (
              <span className="ml-2 text-[12px] text-ink-3 font-semibold whitespace-nowrap">
                {totalItems.toLocaleString("id-ID")} baris
              </span>
            )}
          </div>

          {/* Table body */}
          {listLoading ? (
            <div className="divide-y divide-border/60">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="px-6 py-3 flex gap-6">
                  <div className="h-4 w-28 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 w-20 bg-surface-alt animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : items.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px] border-collapse">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-[0.6px] font-semibold">
                    <th className="text-left px-6 py-3">{t("colPartNumber")}</th>
                    <th className="text-left px-4 py-3">{t("colDescription")}</th>
                    <th className="text-left px-4 py-3">{t("colMnemonic")}</th>
                    <th className="text-left px-4 py-3">{t("colCommodity")}</th>
                    <th className="text-right px-6 py-3">{t("colClass")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((part, i) => (
                    <tr key={i} className="border-t border-border/60 hover:bg-surface-alt/40">
                      <td className="px-6 py-3 font-mono font-bold text-[12.5px] text-ink whitespace-nowrap">
                        <Highlight text={part.part_number} query={debouncedQuery} />
                      </td>
                      <td className="px-4 py-3 text-ink font-medium max-w-[240px] truncate">
                        <Highlight text={part.description} query={debouncedQuery} />
                      </td>
                      <td className="px-4 py-3 text-ink-2 font-mono text-[11px]">
                        <Highlight text={part.mnemonic} query={debouncedQuery} />
                      </td>
                      <td className="px-4 py-3 text-ink-2 font-mono text-[11px]">
                        <Highlight text={part.commodity} query={debouncedQuery} />
                      </td>
                      <td className="px-6 py-3 text-right">
                        <KelasBadge kelas={part.kelas} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-ink-3 text-sm">
              {debouncedQuery
                ? `Tidak ada part yang cocok dengan "${debouncedQuery}"`
                : t("noData")}
            </div>
          )}

          {/* Pagination footer */}
          {totalPages > 1 && (
            <div className="px-6 py-3 border-t border-border flex items-center justify-between bg-bg">
              <p className="text-[12px] text-ink-3 font-semibold">
                Halaman {page} dari {totalPages.toLocaleString("id-ID")}
                {" · "}
                {((page - 1) * PAGE_SIZE + 1).toLocaleString("id-ID")}–{Math.min(page * PAGE_SIZE, totalItems).toLocaleString("id-ID")} dari {totalItems.toLocaleString("id-ID")}
              </p>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-ink-2 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft size={14} /> Prev
                </button>

                {/* Page number pills */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                  const p = start + i;
                  return (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-[12px] font-bold transition-colors ${
                        p === page
                          ? "bg-ink text-white"
                          : "text-ink-2 hover:bg-surface-alt"
                      }`}
                    >
                      {p}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[12px] font-semibold text-ink-2 hover:bg-surface-alt disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  Next <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}
