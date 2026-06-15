"use client";

import { usePermissionGuard } from "@/hooks/usePermissionGuard";
import { HOSidebar } from "@/components/layout/HOSidebar";
import { useTranslations } from "next-intl";

export default function HOLayout({ children }: { children: React.ReactNode }) {
  const { ready } = usePermissionGuard(
    ({ can }) => can("can_view_ho_dashboard"),
    "/dashboard"
  );
  const t = useTranslations("app");

  if (!ready) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-xl bg-ink mx-auto flex items-center justify-center">
            <div className="w-5 h-5 rounded bg-gradient-to-br from-primary to-coral" />
          </div>
          <p className="text-sm text-ink-2 font-medium">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      <HOSidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 pb-8">{children}</main>
      </div>
    </div>
  );
}
