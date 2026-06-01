"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import {
  ChevronLeft, ChevronRight, CheckCircle, Loader2,
  Search, X, Plus, Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import type { PartSuggestion } from "@/lib/types";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PartEntry {
  id: string;
  part_number: string;
  part_name: string;
  qty: number;
}

let _counter = 0;
const uid = () => `p${++_counter}`;
const emptyPart = (): PartEntry => ({ id: uid(), part_number: "", part_name: "", qty: 1 });

// ── PartRowInput ──────────────────────────────────────────────────────────────

interface PartRowProps {
  entry: PartEntry;
  index: number;
  canRemove: boolean;
  onChange: (updated: PartEntry) => void;
  onRemove: () => void;
}

function PartRowInput({ entry, index, canRemove, onChange, onRemove }: PartRowProps) {
  const [query, setQuery] = useState(entry.part_number);
  const [debounced, setDebounced] = useState(query);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 220);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: suggestions } = useSWR<PartSuggestion[]>(
    debounced.length >= 2
      ? `/parts/autocomplete?q=${encodeURIComponent(debounced)}&kelas=G&limit=10`
      : null,
    (url: string) => api.get<PartSuggestion[]>(url),
    { revalidateOnFocus: false },
  );

  const select = useCallback((p: PartSuggestion) => {
    setQuery(p.part_number);
    setOpen(false);
    setActive(-1);
    onChange({ ...entry, part_number: p.part_number, part_name: p.description ?? "" });
  }, [entry, onChange]);

  const clear = () => {
    setQuery("");
    setOpen(false);
    setActive(-1);
    onChange({ ...entry, part_number: "", part_name: "" });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = suggestions ?? [];
    if (!open || list.length === 0) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setActive(i => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setActive(i => Math.max(i - 1, -1)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (active >= 0 && list[active]) select(list[active]); }
    else if (e.key === "Escape")    { setOpen(false); setActive(-1); }
  };

  return (
    <div className="bg-surface rounded-xl ring-1 ring-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-ink-3 uppercase tracking-wider">
          Part #{index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-ink-3 hover:text-warning-text transition-colors p-1"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>

      {/* Part Number search */}
      <div ref={wrapRef} className="relative">
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg border border-border bg-surface-alt focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
          <Search size={13} className="text-ink-3 flex-shrink-0" />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setOpen(true);
              setActive(-1);
              if (!e.target.value) onChange({ ...entry, part_number: "", part_name: "" });
            }}
            onFocus={() => { if (query.length >= 2) setOpen(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Cari part number atau nama part..."
            className="flex-1 bg-transparent text-sm font-mono text-ink outline-none placeholder:text-ink-3 placeholder:font-sans placeholder:text-xs"
          />
          {query && (
            <button type="button" onClick={clear} className="text-ink-3 hover:text-ink transition-colors flex-shrink-0">
              <X size={12} />
            </button>
          )}
        </div>

        {open && suggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-surface border border-border rounded-xl shadow-xl overflow-hidden z-50">
            {suggestions.map((p, i) => (
              <button
                key={p.part_number}
                type="button"
                onMouseDown={e => { e.preventDefault(); select(p); }}
                onMouseEnter={() => setActive(i)}
                className={`w-full px-3 py-2.5 flex items-start gap-2.5 text-left border-t first:border-t-0 border-border/50 transition-colors ${
                  active === i ? "bg-primary-soft" : "hover:bg-surface-alt/60"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="font-mono font-bold text-[12px] text-ink">{p.part_number}</p>
                  {p.description && (
                    <p className="text-[11px] text-ink-2 truncate mt-0.5">{p.description}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Part name — auto-filled, read-only */}
      {entry.part_name && (
        <div className="px-3 py-2 rounded-lg bg-primary-soft/50 border border-primary/20">
          <p className="text-xs text-primary-dark font-medium">{entry.part_name}</p>
        </div>
      )}

      {/* Qty */}
      <div className="flex items-center gap-3">
        <label className="text-[11px] font-bold text-ink-2 uppercase tracking-wider flex-shrink-0">
          Qty
        </label>
        <input
          type="number"
          min={1}
          value={entry.qty}
          onChange={e => onChange({ ...entry, qty: Math.max(1, Number(e.target.value) || 1) })}
          className="w-24 px-3 py-2 rounded-lg border border-border bg-surface text-sm font-mono font-bold text-center text-ink outline-none focus:ring-2 focus:ring-primary/30"
        />
        <span className="text-xs text-ink-3">pcs</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function InquiryBaruPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [parts, setParts] = useState<PartEntry[]>([emptyPart()]);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updatePart = useCallback((idx: number, updated: PartEntry) => {
    setParts(prev => prev.map((p, i) => i === idx ? updated : p));
  }, []);

  const removePart = useCallback((idx: number) => {
    setParts(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const addPart = () => setParts(prev => [...prev, emptyPart()]);

  const canNext = parts.length > 0 && parts.every(p => p.part_number.trim().length > 0 && p.qty >= 1);

  const totalQty = parts.reduce((sum, p) => sum + p.qty, 0);

  const handleSubmit = async () => {
    if (!canNext || submitting) return;
    setSubmitting(true);
    try {
      await api.post("/inquiries", {
        parts: parts.map(p => ({ part_number: p.part_number, qty: p.qty })),
      });
      setToast({ msg: "Inquiry berhasil dikirim!", kind: "ok" });
      setTimeout(() => router.push("/inquiry/mine"), 1500);
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Gagal mengirim inquiry", kind: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar
        title={step === 1 ? "Form Inquiry" : "Review Inquiry"}
        subtitle="Class G — Part Request"
      />

      <div className="max-w-lg mx-auto p-4 md:p-6">
        {/* Stepper */}
        <div className="flex gap-2 mb-6">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? "bg-primary" : "bg-surface-alt"}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? "bg-primary" : "bg-surface-alt"}`} />
        </div>

        {/* ── Step 1 ── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            {/* Parts list */}
            <div>
              <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-2">
                Daftar Part <span className="text-warning-text">*</span>
              </label>
              <div className="space-y-3">
                {parts.map((entry, idx) => (
                  <PartRowInput
                    key={entry.id}
                    entry={entry}
                    index={idx}
                    canRemove={parts.length > 1}
                    onChange={updated => updatePart(idx, updated)}
                    onRemove={() => removePart(idx)}
                  />
                ))}
              </div>
            </div>

            {/* Add part */}
            <button
              type="button"
              onClick={addPart}
              className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 text-ink-2 hover:text-primary text-sm font-semibold transition-all flex items-center justify-center gap-2"
            >
              <Plus size={15} />
              Tambah Part
            </button>
          </div>
        )}

        {/* ── Step 2 — Review ── */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="bg-primary-soft rounded-xl p-4">
              <p className="text-[11px] font-bold text-primary-dark uppercase tracking-wide mb-1">
                Periksa sebelum submit
              </p>
              <p className="text-sm text-ink">
                Pastikan semua part number dan qty sudah benar.
              </p>
            </div>

            {/* Parts table */}
            <div className="bg-surface rounded-xl ring-1 ring-border overflow-hidden">
              {/* Header */}
              <div className="flex items-center bg-surface-alt px-4 py-2 gap-4">
                <span className="text-[10px] font-bold text-ink-3 uppercase tracking-wider w-6">No</span>
                <span className="flex-1 text-[10px] font-bold text-ink-3 uppercase tracking-wider">
                  Part Number / Nama
                </span>
                <span className="text-[10px] font-bold text-ink-3 uppercase tracking-wider text-right w-14">
                  Qty
                </span>
              </div>

              {/* Rows */}
              {parts.map((p, i) => (
                <div key={p.id} className="flex items-start gap-4 px-4 py-3 border-t border-border">
                  <span className="text-xs font-mono text-ink-3 w-6 pt-0.5 flex-shrink-0">{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-bold text-ink">{p.part_number}</p>
                    {p.part_name && (
                      <p className="text-xs text-ink-2 mt-0.5 truncate">{p.part_name}</p>
                    )}
                  </div>
                  <span className="text-sm font-mono font-bold text-ink tabular-nums text-right w-14 flex-shrink-0">
                    {p.qty} pcs
                  </span>
                </div>
              ))}

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-3 bg-surface-alt border-t border-border">
                <span className="text-[11px] font-bold text-ink-3">
                  {parts.length} part
                </span>
                <span className="text-sm font-mono font-bold text-ink tabular-nums">
                  {totalQty} pcs total
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Bottom actions ── */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-border">
          {step === 1 ? (
            <>
              <button
                type="button"
                onClick={() => router.back()}
                className="px-5 py-3.5 rounded-xl bg-surface-alt text-ink font-semibold text-sm"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => canNext && setStep(2)}
                disabled={!canNext}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-ink text-white font-bold text-sm disabled:opacity-40 transition-all"
              >
                Review <ChevronRight size={16} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-5 py-3.5 rounded-xl bg-surface-alt text-ink font-semibold text-sm flex items-center gap-1"
              >
                <ChevronLeft size={16} /> Edit
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-ink font-extrabold text-sm disabled:opacity-60 transition-all"
              >
                {submitting
                  ? <Loader2 size={16} className="animate-spin" />
                  : <CheckCircle size={16} />}
                {submitting ? "Mengirim..." : "Kirim Inquiry"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
