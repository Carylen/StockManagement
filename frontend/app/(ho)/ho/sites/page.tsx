"use client";

import { useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { Plus, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

interface SiteRow {
  code: string;
  name: string;
  is_active: boolean;
}

interface SiteForm {
  code: string;
  name: string;
}

export default function HOSitesPage() {
  const t = useTranslations("ho");

  const { data: sites, isLoading, mutate } = useSWR<SiteRow[]>(
    "/ho/sites",
    (u: string) => api.get<SiteRow[]>(u)
  );

  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const form = useForm<SiteForm>();

  const handleCreate = async (data: SiteForm) => {
    setLoading(true);
    try {
      await api.post("/ho/sites", { code: data.code.toUpperCase(), name: data.name });
      setToast({ msg: t("siteCreated", { code: data.code.toUpperCase() }), kind: "ok" });
      setShowCreate(false);
      form.reset();
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedCreate"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (site: SiteRow) => {
    const confirm = window.confirm(
      site.is_active
        ? t("deactivateConfirm", { code: site.code })
        : t("activateConfirm", { code: site.code })
    );
    if (!confirm) return;
    setLoading(true);
    try {
      await api.patch(`/ho/sites/${site.code}`, { is_active: !site.is_active });
      setToast({ msg: t("siteUpdated", { code: site.code }), kind: "ok" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedUpdate"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full">
      <Topbar title={t("sitesTitle")} subtitle={t("sitesSubtitle")} />

      {toast && (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}

      <div className="p-6">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
                {t("sitesSubtitle")}
              </p>
              <h2 className="text-[18px] font-bold text-ink mt-1">
                {sites ? `${sites.length} sites` : "—"}
              </h2>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: "#1B1814" }}
            >
              <Plus size={15} /> {t("addSite")}
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="divide-y divide-border/60">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-6">
                  <div className="h-4 w-16 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 w-20 bg-surface-alt animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : !sites || sites.length === 0 ? (
            <div className="py-16 text-center text-ink-3 text-sm">No sites yet.</div>
          ) : (
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-[0.6px] font-semibold">
                  <th className="text-left px-6 py-3">{t("colCode")}</th>
                  <th className="text-left px-4 py-3">{t("colName")}</th>
                  <th className="text-right px-6 py-3">{t("colStatus")}</th>
                  <th className="text-right px-6 py-3">{t("colActions")}</th>
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <tr
                    key={site.code}
                    className="border-t border-border/60 hover:bg-surface-alt/40 transition-colors"
                  >
                    <td className="px-6 py-3.5 font-mono font-bold text-[12.5px] text-ink">
                      {site.code}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-ink">{site.name}</td>
                    <td className="px-6 py-3.5 text-right">
                      {site.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-[#DCEEE3] text-[#1F6F4C]">
                          <CheckCircle size={11} /> {t("active")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-surface-alt text-ink-3">
                          <XCircle size={11} /> {t("inactive")}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <button
                        disabled={loading}
                        onClick={() => handleToggle(site)}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-alt transition-colors text-ink-2 disabled:opacity-50"
                      >
                        {site.is_active ? t("deactivate") : t("activate")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t("createSiteTitle")}>
        <form onSubmit={form.handleSubmit(handleCreate)} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">
              {t("siteCode")}
            </label>
            <input
              {...form.register("code", { required: true })}
              onInput={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase(); }}
              placeholder="e.g. AGMR"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
              style={{ textTransform: "uppercase" }}
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">
              {t("siteName")}
            </label>
            <input
              {...form.register("name", { required: true })}
              placeholder="e.g. Agrimuli Site"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2.5 rounded-xl border border-border text-ink-2 text-sm font-semibold hover:bg-surface-alt transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: "#1B1814" }}
            >
              {loading ? t("creating") : t("createBtn")}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
