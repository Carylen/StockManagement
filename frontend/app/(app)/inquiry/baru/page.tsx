"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { ChevronLeft, ChevronRight, CheckCircle, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import type { Inquiry } from "@/lib/types";

interface FormValues {
  part_name: string;
  part_number: string;
  qty_needed: number;
  unit_asset: string;
  date_needed: string;
  notes: string;
}

const URGENCY = [
  { key: "normal", label: "Normal", sub: "3–5 hari", color: "#22C55E" },
  { key: "urgent", label: "Urgent", sub: "1–2 hari", color: "#F59E0B" },
  { key: "critical", label: "Critical", sub: "< 24 jam", color: "#EF4444" },
];

export default function InquiryBaruPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(1);
  const [urgency, setUrgency] = useState("normal");
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormValues>({
    defaultValues: {
      part_name: searchParams.get("part") || "",
      qty_needed: 1,
    }
  });

  const values = watch();
  const canNext = values.part_name?.trim().length > 2 && values.qty_needed > 0;

  const onSubmit = async (data: FormValues) => {
    try {
      await api.post<Inquiry>("/inquiries", {
        part_name: data.part_name,
        part_number: data.part_number || null,
        qty_needed: Number(data.qty_needed),
        unit_asset: data.unit_asset || null,
        date_needed: data.date_needed || null,
        notes: data.notes || null,
      });
      setToast({ msg: "Inquiry terkirim · menunggu approval Group Leader", kind: "ok" });
      setTimeout(() => router.push("/inquiry/saya"), 1500);
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : "Gagal submit", kind: "err" });
    }
  };

  return (
    <div className="min-h-full">
      <Toast message={toast?.msg ?? null} kind={toast?.kind} onDismiss={() => setToast(null)} />
      <Topbar title={step === 1 ? "Form Pengajuan" : "Review & Submit"} subtitle="Inquiry · Kelas G" />

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
                <strong className="text-primary-dark">Kelas G</strong> untuk part yang <strong>tidak ada</strong> di katalog VHS.{" "}
                Cek{" "}
                <a href="/katalog" className="text-primary-dark font-bold underline">katalog</a> dulu sebelum ajukan.
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  Part yang diminta <span className="text-warning-text">*</span>
                </label>
                <input
                  placeholder="Deskripsi part atau PN kalau tahu"
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  {...register("part_name", { required: "Nama part wajib diisi" })}
                />
                {errors.part_name && <p className="text-xs text-warning-text mt-1">{errors.part_name.message}</p>}
                <p className="text-xs text-ink-3 mt-1">Contoh: "Filter udara Scania P460" atau "1873018"</p>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  Part Number / Kode <span className="text-ink-3">(opsional)</span>
                </label>
                <input
                  placeholder="Contoh: 1873018"
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-white text-sm font-mono text-ink outline-none focus:ring-2 focus:ring-primary/30"
                  {...register("part_number")}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                    Quantity <span className="text-warning-text">*</span>
                  </label>
                  <input
                    type="number"
                    min={1}
                    className="w-full px-4 py-3.5 rounded-xl border border-border bg-white text-sm font-mono font-bold text-center text-ink outline-none focus:ring-2 focus:ring-primary/30"
                    {...register("qty_needed", { required: true, min: 1, valueAsNumber: true })}
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                    Unit / Equipment
                  </label>
                  <input
                    placeholder="PC200 #07"
                    className="w-full px-4 py-3.5 rounded-xl border border-border bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
                    {...register("unit_asset")}
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  Tanggal Dibutuhkan
                </label>
                <input
                  type="date"
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30"
                  {...register("date_needed")}
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  Urgensi
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {URGENCY.map((u) => (
                    <button
                      key={u.key}
                      type="button"
                      onClick={() => setUrgency(u.key)}
                      className={`py-3 rounded-xl text-sm font-bold transition-all border ${
                        urgency === u.key
                          ? "bg-white border-current shadow-sm"
                          : "bg-surface-alt border-transparent text-ink-2"
                      }`}
                      style={{ color: urgency === u.key ? u.color : undefined }}
                    >
                      {u.label}
                      <div className="text-[9px] font-normal text-ink-3 mt-0.5">{u.sub}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                  Justifikasi / Keterangan <span className="text-warning-text">*</span>
                </label>
                <textarea
                  rows={4}
                  placeholder="Kenapa perlu part ini? Kondisi unit, jam operasi, gejala…"
                  className="w-full px-4 py-3.5 rounded-xl border border-border bg-white text-sm text-ink outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  {...register("notes")}
                />
                <p className="text-xs text-ink-3 mt-1">GL akan review ini sebelum diteruskan ke UT.</p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-fade-in">
              <div className="bg-primary-soft rounded-xl p-4">
                <p className="text-[11px] font-bold text-primary-dark uppercase tracking-wide mb-1">Sebelum submit</p>
                <p className="text-sm text-ink">Setelah submit, inquiry masuk antrian Group Leader. Setelah disetujui, baru diteruskan ke PIC UT Rantau.</p>
              </div>

              <div className="bg-white rounded-xl ring-1 ring-border divide-y divide-border">
                {[
                  ["Part", values.part_name],
                  ["Part Number", values.part_number || "(tidak diisi)"],
                  ["Quantity", `${values.qty_needed} pcs`],
                  ["Unit", values.unit_asset || "(tidak diisi)"],
                  ["Tanggal Butuh", values.date_needed || "(tidak diisi)"],
                  ["Urgensi", urgency],
                  ["Catatan", values.notes || "(tidak diisi)"],
                ].map(([k, v]) => (
                  <div key={k} className="px-5 py-3.5 flex gap-4">
                    <span className="text-[11px] font-bold text-ink-3 uppercase tracking-wide w-24 flex-shrink-0 pt-0.5">{k}</span>
                    <span className="text-sm text-ink font-medium">{v}</span>
                  </div>
                ))}
              </div>

              {/* Approval flow */}
              <div className="bg-white rounded-xl ring-1 ring-border p-5">
                <p className="text-[11px] font-bold text-ink-2 uppercase tracking-wide mb-4">Alur Persetujuan</p>
                <div className="relative pl-5">
                  <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
                  {[
                    { l: "Submit oleh kamu", sub: "sekarang", c: "#F5A623", done: true },
                    { l: "Review Group Leader", sub: "~30 menit", c: "#5B5BD6", done: false },
                    { l: "Diteruskan ke UT", sub: "PIC Pak Hendro", c: "#FF7A59", done: false },
                    { l: "Respond dari UT", sub: "Tersedia / Partial / Tidak Ada", c: "#22C55E", done: false },
                  ].map((t, i) => (
                    <div key={i} className="flex items-start gap-3 pb-4 relative">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-white absolute -left-3.5"
                        style={{ background: t.done ? t.c : "#E5EFE1" }}
                      />
                      <div className="ml-3">
                        <p className={`text-sm font-semibold ${t.done ? "text-ink" : "text-ink-2"}`}>{t.l}</p>
                        <p className="text-xs text-ink-3">{t.sub}</p>
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
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => canNext && setStep(2)}
                  disabled={!canNext}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-ink text-white font-bold text-sm disabled:opacity-40 transition-all"
                >
                  Review pengajuan <ChevronRight size={16} />
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
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-ink font-extrabold text-sm disabled:opacity-60 transition-all"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                  {isSubmitting ? "Mengirim…" : "Submit ke Group Leader"}
                </button>
              </>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
