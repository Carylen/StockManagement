"use client";

import { Sidebar } from "./Sidebar";
import { MobileBottomNav } from "./MobileBottomNav";
import { Topbar } from "./Topbar";
import { useInquiryCount } from "@/hooks/useInquiry";

interface Props {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AppShell({ children, title, subtitle }: Props) {
  const { data } = useInquiryCount("pending");
  const pendingCount = data?.count ?? 0;

  return (
    <div className="flex min-h-screen bg-bg">
      <Sidebar pendingCount={pendingCount} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar title={title} subtitle={subtitle} />
        <main className="flex-1 p-4 md:p-6 pb-24 md:pb-6">
          {children}
        </main>
      </div>
      <MobileBottomNav badge={pendingCount > 0 ? pendingCount : undefined} />
    </div>
  );
}
