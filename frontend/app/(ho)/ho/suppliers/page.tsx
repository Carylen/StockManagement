"use client";

import { useState } from "react";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { Plus, X, PlusCircle } from "lucide-react";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { Modal } from "@/components/ui/Modal";
import { Toast } from "@/components/ui/Toast";
import { useTranslations } from "next-intl";

interface Supplier {
  id: string;
  name: string;
  email: string;
  is_active: boolean;
  assigned_sites: string[];
}

interface SiteRow {
  code: string;
  name: string;
  is_active: boolean;
}

interface CreateForm {
  name: string;
  email: string;
  password: string;
  site: string;
}

const SITE_COLORS: Record<string, { bg: string; text: string }> = {
  AGMR: { bg: "#DCEEE3", text: "#1F6F4C" },
  RANT: { bg: "#E6E6F9", text: "#5B5BD6" },
  SPUT: { bg: "#FFE5DC", text: "#FF7A59" },
};

function SiteBadge({
  siteCode,
  onRemove,
}: {
  siteCode: string;
  onRemove?: () => void;
}) {
  const c = SITE_COLORS[siteCode] ?? { bg: "#EDE9E0", text: "#6B6256" };
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold tracking-wide font-mono uppercase"
      style={{ background: c.bg, color: c.text }}
    >
      {siteCode}
      {onRemove && (
        <button
          onClick={onRemove}
          className="ml-0.5 rounded-full hover:opacity-70 transition-opacity"
        >
          <X size={10} />
        </button>
      )}
    </span>
  );
}

export default function HOSuppliersPage() {
  const t = useTranslations("ho");

  const { data: suppliers, isLoading, mutate } = useSWR<Supplier[]>(
    "/ho/suppliers",
    (u: string) => api.get<Supplier[]>(u)
  );
  const { data: sites } = useSWR<SiteRow[]>(
    "/ho/sites",
    (u: string) => api.get<SiteRow[]>(u)
  );

  const [showCreate, setShowCreate] = useState(false);
  const [assigningTo, setAssigningTo] = useState<Supplier | null>(null);
  const [selectedSite, setSelectedSite] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(null);

  const createForm = useForm<CreateForm>({ defaultValues: { site: "AGMR" } });

  const handleCreate = async (data: CreateForm) => {
    setLoading(true);
    try {
      await api.post("/ho/users", {
        name: data.name,
        email: data.email,
        password: data.password,
        role: "supplier",
        site: data.site || "HO",
      });
      setToast({ msg: t("userCreated", { name: data.name }), kind: "ok" });
      setShowCreate(false);
      createForm.reset();
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedCreateUser"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!assigningTo || !selectedSite) return;
    setLoading(true);
    try {
      await api.post(`/ho/suppliers/${assigningTo.id}/sites`, { site_code: selectedSite });
      setToast({ msg: t("siteAssigned", { site: selectedSite, name: assigningTo.name }), kind: "ok" });
      setAssigningTo(null);
      setSelectedSite("");
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedAssign"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const handleUnassign = async (supplier: Supplier, siteCode: string) => {
    if (!confirm(t("unassignConfirm", { site: siteCode, name: supplier.name }))) return;
    setLoading(true);
    try {
      await api.delete(`/ho/suppliers/${supplier.id}/sites/${siteCode}`);
      setToast({ msg: t("siteUnassigned", { site: siteCode }), kind: "ok" });
      mutate();
    } catch (e: unknown) {
      setToast({ msg: e instanceof Error ? e.message : t("failedUnassign"), kind: "err" });
    } finally {
      setLoading(false);
    }
  };

  const activeSites = sites?.filter((s) => s.is_active) ?? [];

  return (
    <div className="min-h-full">
      <Topbar title={t("suppliersTitle")} subtitle={t("suppliersSubtitle")} />

      {toast && (
        <Toast message={toast.msg} kind={toast.kind} onDismiss={() => setToast(null)} />
      )}

      <div className="p-6">
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-border flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
                {t("suppliersSubtitle")}
              </p>
              <h2 className="text-[18px] font-bold text-ink mt-1">
                {suppliers ? `${suppliers.length} suppliers` : "—"}
              </h2>
            </div>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-85"
              style={{ background: "#1B1814" }}
            >
              <Plus size={15} /> {t("addSupplier")}
            </button>
          </div>

          {/* List */}
          {isLoading ? (
            <div className="divide-y divide-border/60">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-4">
                  <div className="h-4 w-36 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-surface-alt animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : !suppliers || suppliers.length === 0 ? (
            <div className="py-16 text-center text-ink-3 text-sm">No suppliers found.</div>
          ) : (
            <div className="divide-y divide-border/60">
              {suppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="px-6 py-4 flex items-start gap-4 hover:bg-surface-alt/30 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 bg-[#FFF1D0] text-[#D97706]">
                    {supplier.name[0]}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-ink text-[13.5px]">{supplier.name}</span>
                      <span className="text-[11px] text-ink-3">{supplier.email}</span>
                      {!supplier.is_active && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-surface-alt text-ink-3">
                          Inactive
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-[11px] text-ink-3 font-semibold">{t("assignedSites")}:</span>
                      {supplier.assigned_sites.length === 0 ? (
                        <span className="text-[11px] text-ink-3 italic">{t("noSitesAssigned")}</span>
                      ) : (
                        supplier.assigned_sites.map((siteCode) => (
                          <SiteBadge
                            key={siteCode}
                            siteCode={siteCode}
                            onRemove={
                              supplier.is_active
                                ? () => handleUnassign(supplier, siteCode)
                                : undefined
                            }
                          />
                        ))
                      )}
                      {supplier.is_active && (
                        <button
                          onClick={() => {
                            setAssigningTo(supplier);
                            setSelectedSite(activeSites[0]?.code ?? "");
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-ink-3 hover:text-ink transition-colors"
                        >
                          <PlusCircle size={13} /> {t("assignSite")}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Create supplier modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title={t("addSupplier")} width={440}>
        <form onSubmit={createForm.handleSubmit(handleCreate)} className="p-6 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("fullName")}</label>
            <input
              {...createForm.register("name", { required: true })}
              placeholder="UT Supplier PIC name"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("email")}</label>
            <input
              {...createForm.register("email", { required: true })}
              type="email"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t("password")}</label>
            <input
              {...createForm.register("password", { required: true, minLength: 8 })}
              type="password"
              placeholder="Min. 8 characters"
              className="w-full px-3.5 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <p className="text-[11px] text-ink-3 bg-surface-alt px-3 py-2.5 rounded-xl">
            Assign sites separately after creating the account.
          </p>
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
              {loading ? t("saving") : t("createBtn")}
            </button>
          </div>
        </form>
      </Modal>

      {/* Assign site modal */}
      <Modal
        open={!!assigningTo}
        onClose={() => { setAssigningTo(null); setSelectedSite(""); }}
        title={t("assignSite")}
        width={360}
      >
        <div className="p-6 space-y-4">
          <p className="text-[13px] text-ink-2">
            Assign a site to <strong className="text-ink">{assigningTo?.name}</strong>:
          </p>
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl border border-border bg-bg text-ink text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {activeSites
              .filter((s) => !assigningTo?.assigned_sites.includes(s.code))
              .map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} – {s.name}
                </option>
              ))}
          </select>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => { setAssigningTo(null); setSelectedSite(""); }}
              className="px-4 py-2.5 rounded-xl border border-border text-ink-2 text-sm font-semibold hover:bg-surface-alt transition-colors"
            >
              {t("cancel")}
            </button>
            <button
              onClick={handleAssign}
              disabled={loading || !selectedSite}
              className="px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50"
              style={{ background: "#1B1814" }}
            >
              {loading ? t("saving") : t("assignSite")}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
