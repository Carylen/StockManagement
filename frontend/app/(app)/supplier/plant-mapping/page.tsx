"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";
import type { PlantMapping, Site } from "@/lib/types";

const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function SiteBadge({ code }: { code: string }) {
  const c = SITE_COLORS[code] ?? { bg: "#EDE9E0", text: "#6B6256" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide font-mono uppercase"
      style={{ background: c.bg, color: c.text }}
    >
      {code}
    </span>
  );
}

export default function SupplierPlantMappingPage() {
  const t = useTranslations("supplierPlantMapping");

  const { data: mappings, isLoading, mutate } = useSWR<PlantMapping[]>(
    "/upload/plant-mapping",
    (u: string) => api.get<PlantMapping[]>(u)
  );
  const { data: mySites } = useSWR<Site[]>(
    "/auth/me/sites",
    (u: string) => api.get<Site[]>(u)
  );

  const [showCreate, setShowCreate] = useState(false);
  const [plntCode, setPlntCode] = useState("");
  const [siteCode, setSiteCode] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const resetForm = () => {
    setPlntCode("");
    setSiteCode("");
    setDescription("");
  };

  const handleCreate = async () => {
    if (!plntCode.trim() || !siteCode) return;
    setLoading(true);
    try {
      await api.post("/upload/plant-mapping", {
        plnt_code: plntCode.trim(),
        site_code: siteCode,
        description: description.trim() || undefined,
      });
      setToast({ msg: t("mappingAdded", { plnt: plntCode.trim().toUpperCase(), site: siteCode }), kind: "ok" });
      setShowCreate(false);
      resetForm();
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedAdd"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (row: PlantMapping) => {
    if (!window.confirm(t("deleteConfirm", { plnt: row.plnt_code, site: row.site_code }))) return;
    setLoading(true);
    try {
      await api.delete(`/upload/plant-mapping/${row.plnt_code}/${row.site_code}`);
      setToast({ msg: t("mappingRemoved"), kind: "ok" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedDelete"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full">
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      {toast && <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />}

      <div className="p-6">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">{t("subtitle")}</p>
              <h2 className="text-[18px] font-bold text-ink mt-1">
                {mappings ? t("mappingCount", { count: mappings.length }) : "—"}
              </h2>
            </div>
            <button
              onClick={() => {
                setSiteCode(mySites?.[0]?.code ?? "");
                setShowCreate(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: "#1B1814" }}
            >
              <Plus size={15} /> {t("addMapping")}
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="divide-y divide-border/60">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-6">
                  <div className="h-4 w-16 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 w-16 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-surface-alt animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : !mappings || mappings.length === 0 ? (
            <div className="py-16 text-center text-ink-3 text-sm">{t("noMappingsYet")}</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-[0.6px] font-semibold">
                    <th className="text-left px-6 py-3">{t("colPlnt")}</th>
                    <th className="text-left px-4 py-3">{t("colSite")}</th>
                    <th className="text-left px-4 py-3">{t("colDescription")}</th>
                    <th className="text-right px-6 py-3">{t("colActions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {mappings.map((m) => (
                    <tr
                      key={`${m.plnt_code}-${m.site_code}`}
                      className="border-t border-border/60 hover:bg-surface-alt/40 transition-colors"
                    >
                      <td className="px-6 py-3.5 font-mono font-bold text-[12.5px] text-ink">{m.plnt_code}</td>
                      <td className="px-4 py-3.5"><SiteBadge code={m.site_code} /></td>
                      <td className="px-4 py-3.5 text-ink-2">{m.description ?? "—"}</td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          disabled={loading}
                          onClick={() => handleDelete(m)}
                          className="text-[12px] font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-surface-alt transition-colors text-ink-2 disabled:opacity-50 inline-flex items-center gap-1.5"
                        >
                          <Trash2 size={12} /> {t("delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Create modal */}
      <Modal open={showCreate} onClose={() => { setShowCreate(false); resetForm(); }} title={t("addMapping")}>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("plntCode")}</label>
            <input
              value={plntCode}
              onChange={(e) => setPlntCode(e.target.value)}
              placeholder="RTT"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm font-mono uppercase focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("siteKpp")}</label>
            <select
              value={siteCode}
              onChange={(e) => setSiteCode(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">—</option>
              {(mySites ?? []).map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} – {s.name}
                </option>
              ))}
            </select>
            {mySites && mySites.length === 0 && (
              <p className="text-[11px] text-ink-3 mt-1.5">{t("noSitesAssignedHint")}</p>
            )}
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("description")}</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("descriptionPlaceholder")}
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setShowCreate(false); resetForm(); }}
              className="px-4 py-2.5 rounded-xl border border-border text-ink-2 text-sm font-semibold hover:bg-surface-alt transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleCreate}
              disabled={loading || !plntCode.trim() || !siteCode}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: "#1B1814" }}
            >
              {loading ? t("saving") : t("createBtn")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
