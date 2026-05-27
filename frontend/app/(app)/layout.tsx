"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import useSWR from "swr";
import { api } from "@/lib/api";
import { useTranslations } from "next-intl";
import type { InquiryPendingCount } from "@/lib/types";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const t = useTranslations("app");
  const router = useRouter();

  const { data: pending } = useSWR<InquiryPendingCount>(
    user ? "/dashboard/inquiry-pending" : null,
    (url: string) => api.get<InquiryPendingCount>(url),
    { refreshInterval: 30000 }
  );

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router]);

  if (isLoading) {
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

  if (!user) return null;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Desktop sidebar */}
      <div className="hidden md:flex">
        <Sidebar pendingCount={pending?.count} />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <main className="flex-1 pb-24 md:pb-8">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <MobileBottomNav badge={pending?.count} />
    </div>
  );
}
