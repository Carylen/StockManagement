"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { Topbar } from "@/components/layout/Topbar";
import { useTranslations } from "next-intl";
import { Globe, Users, Truck, CheckCircle, XCircle } from "lucide-react";

interface SiteRow {
  code: string;
  name: string;
  is_active: boolean;
}

interface UserRow {
  id: string;
  role: string;
  site: string;
  is_active: boolean;
}

interface SupplierRow {
  id: string;
  is_active: boolean;
  assigned_sites: string[];
}

export default function HODashboardPage() {
  const t = useTranslations("ho");

  const { data: sites } = useSWR<SiteRow[]>("/ho/sites", (u: string) => api.get<SiteRow[]>(u));
  const { data: users } = useSWR<UserRow[]>("/ho/users", (u: string) => api.get<UserRow[]>(u));
  const { data: suppliers } = useSWR<SupplierRow[]>(
    "/ho/suppliers",
    (u: string) => api.get<SupplierRow[]>(u)
  );

  const activeSites = sites?.filter((s) => s.is_active).length ?? 0;
  const totalUsers = users?.filter((u) => u.is_active).length ?? 0;
  const totalSuppliers = suppliers?.filter((s) => s.is_active).length ?? 0;

  const KPIS = [
    {
      label: t("kpiSites"),
      value: activeSites,
      icon: Globe,
      color: "#1F6F4C",
      bg: "#DCEEE3",
    },
    {
      label: t("kpiUsers"),
      value: totalUsers,
      icon: Users,
      color: "#5B5BD6",
      bg: "#E6E6F9",
    },
    {
      label: t("kpiSuppliers"),
      value: totalSuppliers,
      icon: Truck,
      color: "#D97706",
      bg: "#FEF3C7",
    },
  ];

  return (
    <div className="min-h-full">
      <Topbar title={t("dashboardTitle")} subtitle={t("dashboardSubtitle")} />

      <div className="p-6 flex flex-col gap-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {KPIS.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <div
                key={kpi.label}
                className="bg-surface rounded-2xl p-5 border border-border relative overflow-hidden"
              >
                <div
                  className="absolute top-0 left-0 right-0 h-[3px]"
                  style={{ background: kpi.color }}
                />
                <div className="flex items-start justify-between mb-3">
                  <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
                    {kpi.label}
                  </p>
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: kpi.bg }}
                  >
                    <Icon size={16} style={{ color: kpi.color }} />
                  </div>
                </div>
                <div className="text-[42px] font-bold leading-none tnum text-ink">
                  {sites === undefined ? "—" : kpi.value}
                </div>
              </div>
            );
          })}
        </div>

        {/* Sites table */}
        <div className="bg-surface rounded-2xl border border-border overflow-hidden">
          <div className="px-6 py-5 border-b border-border">
            <p className="text-[11px] font-semibold text-ink-2 uppercase tracking-[0.8px]">
              {t("perSiteTable")}
            </p>
          </div>

          {!sites ? (
            <div className="divide-y divide-border/60">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-6 py-4 flex gap-6">
                  <div className="h-4 w-16 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 flex-1 bg-surface-alt animate-pulse rounded" />
                  <div className="h-4 w-14 bg-surface-alt animate-pulse rounded" />
                </div>
              ))}
            </div>
          ) : sites.length === 0 ? (
            <div className="py-16 text-center text-ink-3 text-sm">No sites configured yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-bg text-ink-2 text-[11px] uppercase tracking-[0.6px] font-semibold">
                    <th className="text-left px-6 py-3">{t("colCode")}</th>
                    <th className="text-left px-4 py-3">{t("colName")}</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Users</th>
                    <th className="text-left px-4 py-3 hidden md:table-cell">Suppliers</th>
                    <th className="text-right px-6 py-3">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.map((site) => {
                    const siteUsers = users?.filter(
                      (u) => u.site === site.code && u.role !== "supplier"
                    ).length ?? "—";
                    const siteSuppliers = suppliers?.filter((s) =>
                      s.assigned_sites.includes(site.code)
                    ).length ?? "—";

                    return (
                      <tr
                        key={site.code}
                        className="border-t border-border/60 hover:bg-surface-alt/40 transition-colors"
                      >
                        <td className="px-6 py-3.5 font-mono font-bold text-[12.5px] text-ink">
                          {site.code}
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-ink">{site.name}</td>
                        <td className="px-4 py-3.5 text-ink-2 hidden sm:table-cell tnum">
                          {siteUsers}
                        </td>
                        <td className="px-4 py-3.5 text-ink-2 hidden md:table-cell tnum">
                          {siteSuppliers}
                        </td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
