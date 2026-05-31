"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import useSWR from "swr";
import { ChevronLeft, ChevronRight, CheckCircle, Loader2, Search, X } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import type { Inquiry, PartSuggestion } from "@/lib/types";
import { useTranslations } from "next-intl";

interface FormValues {
  part_name: string;
  part_number: string;
  qty_needed: number;
  unit_asset: string;
  notes: string;
}

export default function InquiryBaruPage() {
  const t = useTranslations("newInquiry");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const {
    register, handleSubmit, watch, setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { part_name: searchParams.get("part") || "", qty_needed: 1 },
  });

  // ── Part-number combobox ──────────────────────────────────────────
  const [pnQuery, setPnQuery] = useState(searchParams.get("pn") || "");
  const [debouncedPn, setDebouncedPn] = useState(pnQuery);
  const [pnOpen, setPnOpen] = useState(false);
  const [pnActive, setPnActive] = useState(-1);
  const pnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPn(pnQuery), 220);
    return () => clearTimeout(timer);
  }, [pnQuery]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pnRef.current && !pnRef.current.contains(e.target as Node)) {
        setPnOpen(false);
        setPnActive(-1);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: suggestions } = useSWR<PartSuggestion[]>(
    debouncedPn.length >= 2
      ? `/parts/autocomplete?q=${encodeURIComponent(debouncedPn)}&kelas=G&limit=10`
      : null,
    (url: string) => api.get<PartSuggestion[]>(url),
    { revalidateOnFocus: false },
  );

  const selectPart = useCallback((p: PartSuggestion) => {
    setPnQuery(p.part_number);
    setValue("part_number", p.part_number);
    if (p.description) setValue("part_name", p.description);
    setPnOpen(false);
    setPnActive(-1);
  }, [setValue]);

  const clearPn = () => {
    setPnQuery("");
    setValue("part_number", "");
    setPnOpen(false);
    setPnActive(-1);
  };

  const handlePnKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const list = suggestions ?? [];
    if (!pnOpen || list.length === 0) return;
    if (e.key === "ArrowDown")  { e.preventDefault(); setPnActive((i) => Math.min(i + 1, list.length - 1)); }
    else if (e.key === "ArrowUp")   { e.preventDefault(); setPnActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === "Enter")     { e.preventDefault(); if (pnActive >= 0 && list[pnActive]) selectPart(list[pnActive]); }
    else if (e.key === "Escape")    { setPnOpen(false); setPnActive(-1); }
  };

  // ── Form state ────────────────────────────────────────────────────
  const values = watch();
  const canNext = values.part_name?.trim().length > 2 && values.qty_needed > 0;

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post<Inquiry>("/inquiries", {
        part_name: data.part_name,
        part_number: data.part_number || null,
        qty_needed: Number(data.qty_needed),
        unit_asset: data.unit_asset || null,
        notes: data.notes || null,
      });
      setToast({ msg: t("submitted"), kind: "ok" });
      setTimeout(() => router.push("/inquiry/mine"), 1500);
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedSubmit"), kind: "err" });
    }
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={step === 1 ? t("titleStep1") : t("titleStep2")} subtitle={t("subtitle")} />

      <div className="max-w-lg mx-auto p-4 md:p-6">
        {/* Stepper */}
        <div className="flex gap-2 mb-6">
          <div className={`flex-1 h-1.5 rounded-full ${step >= 1 ? "bg-primary" : "bg-surface-alt"}`} />
          <div className={`flex-1 h-1.5 rounded-full ${step >= 2 ? "bg-primary" : "bg-surface-alt"}`} />
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {step === 1 && (
            <div className="space-y-5 animate-fade-in">
              <div className="bg-primary-soft rounded-xl p-4 text-sm text-ink leading-relaxed">
                <strong className="text-primary-dark">{t("classGInfoBold")}</strong>{t("classGInfoText")}
              </div>

              {/* Part Number — combobox */}
              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  {t("partNumberLabel")} <span className="text-ink-3">{t("optional")}</span>
                </label>
                <div ref={pnRef} className="relative">
                  <div className="flex items-center gap-2 px-4 py-3 rounded-xl border border-border bg-surface focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
                    <Search size={15} className="text-ink-3 flex-shrink-0" />
                    <input
                      value={pnQuery}
                      onChange={(e) => {
                        setPnQuery(e.target.value);
                        setValue("part_number", e.target.value);
                        setPnOpen(true);
                        setPnActive(-1);
                      }}
                      onFocus={() => { if (pnQuery.length >= 2) setPnOpen(true); }}
                      onKeyDown={handlePnKeyDown}
                      placeholder={t("partNumberPlaceholder")}
                      className="flex-1 bg-transparent text-sm font-mono text-ink outline-none placeholder:text-ink-3 placeholder:font-sans"
                    />
                    {pnQuery && (
                      <button type="button" onClick={clearPn} className="text-ink-3 hover:text-ink transition-colors flex-shrink-0">
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Dropdown */}
                  {pnOpen && suggestions && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1.5 bg-surface border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                      {suggestions.map((p, i) => (
                        <button
                          key={p.part_number}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectPart(p); }}
                          onMouseEnter={() => setPnActive(i)}
                          className={`w-full px-4 py-3 flex items-start gap-3 text-left border-t first:border-t-0 border-border/50 transition-colors ${
                            pnActive === i ? "bg-primary-soft" : "hover:bg-surface-alt/60"
                          }`}
                        >
                          <span className="mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded bg-surface-alt text-ink-3 font-mono flex-shrink-0">
                            {p.kelas}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="font-mono font-bold text-[12px] text-ink">{p.part_number}</p>
                            {p.description && (
                              <p className="text-[11px] text-ink-2 truncate mt-0.5">{p.description}</p>
                            )}
                          </div>
                          {p.mnemonic && (
                            <span className="text-[10px] font-mono text-ink-3 flex-shrink-0 self-center">{p.mnemonic}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* hidden RHF field to carry the value */}
                <input type="hidden" {...register("part_number")} />
              </div>

              {/* Part name */}
              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  {t("partLabel")} <span className="text-warning-text">*</span>
                </label>
                <input
                  placeholder={t("partPlaceholder")}
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  {...register("part_name", { required: t("partRequired") })}
                />
                {errors.part_name && <p className="text-xs text-warning-text mt-1">{errors.part_name.message}</p>}
                <p className="text-xs text-ink-3 mt-1">{t("exampleHint")}</p>
              </div>

              {/* Qty + Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                    Quantity <span className="text-warning-text">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-4 py-3.5 rounded-xl border border-border bg-surface text-sm font-mono font-bold text-center text-ink outline-none focus:ring-2 focus:ring-primary/30"
                    {...register("qty_needed", { required: true, min: 1, valueAsNumber: true })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                    Unit / Equipment
                  </label>
                  <input
                    placeholder="PC200 #07"
                    className="w-full px-4 py-3.5 rounded-xl border border-border bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
                    {...register("unit_asset")}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  {t("justification")} <span className="text-warning-text">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder={t("justificationPlaceholder")}
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-surface text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  {...register("notes")}
                />
                <p className="text-xs text-ink-3 mt-1">{t("glNote")}</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-primary-soft rounded-xl p-4">
                <p className="text-[11px] font-bold text-primary-dark uppercase tracking-wide mb-1">{t("beforeSubmit")}</p>
                <p className="text-sm text-ink">{t("beforeSubmitInfo")}</p>
              </div>

              <div className="bg-surface rounded-xl ring-1 ring-border divide-y divide-border">
                {[
                  ["Part", values.part_name],
                  ["Part Number", values.part_number || t("notFilled")],
                  ["Quantity", `${values.qty_needed} pcs`],
                  ["Unit", values.unit_asset || t("notFilled")],
                  [t("notesLabel"), values.notes || t("notFilled")],
                ].map(([k, v]) => (
                  <div key={k} className="px-5 py-3.5 flex gap-4">
                    <span className="text-[11px] font-bold text-ink-3 uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{k}</span>
                    <span className="text-sm text-ink font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {/* Approval flow */}
              <div className="bg-surface rounded-xl ring-1 ring-border p-5">
                <p className="text-[11px] font-bold text-ink-2 uppercase tracking-wide mb-4">{t("approvalFlow")}</p>
                <div className="relative pl-5">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
                  {[
                    { l: t("step1"), sub: t("step1sub"), c: "#F5A623", done: true },
                    { l: t("step2"), sub: t("step2sub"), c: "#5B5BD6", done: false },
                    { l: t("step3"), sub: t("step3sub"), c: "#FF7A59", done: false },
                    { l: t("step4"), sub: t("step4sub"), c: "#22C55E", done: false },
                  ].map((s, i) => (
                    <div key={i} className="flex items-start gap-3 pb-4 relative">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-white absolute -left-3.5"
                        style={{ background: s.done ? s.c : "#E5EFE1" }}
                      />
                      <div className="ml-3">
                        <p className={`text-sm font-semibold ${s.done ? "text-ink" : "text-ink-2"}`}>{s.l}</p>
                        <p className="text-xs text-ink-3">{s.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Bottom action */}
          <div className="flex gap-3 mt-6 pt-4 border-t border-border">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="px-5 py-3.5 rounded-xl bg-surface-alt text-ink font-semibold text-sm"
                >
                  {t("cancelBtn")}
                </button>
                <button
                  type="button"
                  onClick={() => canNext && setStep(2)}
                  disabled={!canNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-ink text-white font-bold text-sm disabled:opacity-40 transition-all"
                >
                  {t("reviewBtn")} <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-5 py-3.5 rounded-xl bg-surface-alt text-ink font-semibold text-sm flex items-center gap-1"
                >
                  <ChevronLeft size={16} /> {t("editBtn")}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-ink font-extrabold text-sm disabled:opacity-60 transition-all"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {isSubmitting ? t("submitting") : t("submitBtn")}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
