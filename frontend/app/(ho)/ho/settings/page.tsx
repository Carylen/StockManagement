"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Toast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

interface AppSettings {
  plan_attention_relevance_days: number;
  plan_attention_lock_warning_days: number;
}

export default function HOSettingsPage() {
  const t = useTranslations("ho");

  const { data: settings, isLoading, mutate } = useSWR<AppSettings>(
    "/ho/settings",
    (u: string) => api.get<AppSettings>(u)
  );

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const form = useForm<AppSettings>();

  useEffect(() => {
    if (settings) form.reset(settings);
  }, [settings, form]);

  const handleSave = async (data: AppSettings) => {
    setLoading(true);
    try {
      const updated = await api.patch<AppSettings>("/ho/settings", {
        plan_attention_relevance_days: Number(data.plan_attention_relevance_days),
        plan_attention_lock_warning_days: Number(data.plan_attention_lock_warning_days),
      });
      form.reset(updated);
      mutate(updated, false);
      setToast({ msg: t("settingsSaved"), kind: "ok" });
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedSaveSettings"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full">
      <Topbar title={t("settingsTitle")} subtitle={t("settingsSubtitle")} />

      {toast && (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}

      <div className="p-6">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden max-w-xl">
          <div className="px-6 py-5 border-b border-border">
            <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
              {t("settingsSectionAttention")}
            </p>
          </div>

          {isLoading ? (
            <div className="p-6 space-y-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-4 w-full bg-surface-alt animate-pulse rounded" />
              ))}
            </div>
          ) : (
            <form onSubmit={form.handleSubmit(handleSave)} className="p-6 space-y-5">
              <div>
                <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">
                  {t("relevanceWindowDaysLabel")}
                </label>
                <input
                  {...form.register("plan_attention_relevance_days", { required: true, min: 1, max: 365, valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={365}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-1.5 text-[11.5px] text-ink-3 leading-relaxed">
                  {t("relevanceWindowDaysHint")}
                </p>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">
                  {t("lockWarningDaysLabel")}
                </label>
                <input
                  {...form.register("plan_attention_lock_warning_days", { required: true, min: 1, max: 365, valueAsNumber: true })}
                  type="number"
                  min={1}
                  max={365}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <p className="mt-1.5 text-[11.5px] text-ink-3 leading-relaxed">
                  {t("lockWarningDaysHint")}
                </p>
              </div>
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
                  style={{ background: "#1B1814" }}
                >
                  {loading ? t("saving") : t("save")}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
