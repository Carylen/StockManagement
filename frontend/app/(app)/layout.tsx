"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { useTranslations } from "next-intl";
import { useInquiryCount, useMyInquiries } from "@/hooks/useInquiry";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const t = useTranslations("app");
  const router = useRouter();

  // admin/GL/supplier: count ALL pending inquiries for badge + sidebar
  const { data: pendingData } = useInquiryCount("pending");
  // mechanic: count only their OWN pending inquiries for bottom nav badge
  const { data: myPendingData } = useMyInquiries({ status: "pending", limit: 1 });

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

  const isMechanic = user.role === "mechanic";
  const mechanicBadge = myPendingData?.total ?? 0;

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar — on mobile renders fixed top bar + drawer; on desktop renders left rail */}
      <Sidebar pendingCount={pendingData?.count} />

      {/* Main content */}
      <div className={`flex-1 flex flex-col min-w-0 overflow-y-auto${!isMechanic ? " pt-14 md:pt-0" : ""}`}>
        <main className={`flex-1${isMechanic ? " pb-24 md:pb-8" : " pb-8"}`}>
          {children}
        </main>
      </div>

      {/* Mobile bottom nav — mechanic only */}
      {isMechanic && <MobileBottomNav badge={mechanicBadge || undefined} />}
    </div>
  );
}
