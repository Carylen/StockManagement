"use client";

import { Bell, Search } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { LangToggle } from "@/components/layout/LangToggle";

interface Props {
  title: string;
  subtitle?: string;
}

export function Topbar({ title, subtitle }: Props) {
  const { user } = useAuth();
  const router = useRouter();
  const t = useTranslations("common");

  return (
    <header className="sticky top-0 z-40 bg-bg border-b border-border flex items-center gap-4 px-6 py-4 flex-shrink-0">
      <div className="flex-1 min-w-0">
        {subtitle && (
          <p className="text-[11px] font-semibold text-ink-3 uppercase tracking-wider mb-0.5">{subtitle}</p>
        )}
        <h1 className="text-xl font-bold text-ink truncate">{title}</h1>
      </div>

      {/* Search */}
      <button
        onClick={() => router.push("/catalog")}
        className="hidden md:flex items-center gap-2 px-3 py-2 bg-surface ring-1 ring-border rounded-lg text-ink-3 text-sm w-60 hover:ring-border-strong transition-all"
      >
        <Search size={14} />
        <span className="flex-1 text-left">{t("searchPlaceholder")}</span>
        <kbd className="text-[10px] font-mono bg-surface-alt px-1.5 py-0.5 rounded text-ink-2">⌘K</kbd>
      </button>

      {/* Language toggle */}
      <LangToggle />

      {/* Notification */}
      <button className="relative w-9 h-9 rounded-lg bg-surface ring-1 ring-border flex items-center justify-center text-ink-2 hover:ring-border-strong transition-all">
        <Bell size={16} />
        <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-coral ring-2 ring-white" />
      </button>

      {/* User avatar */}
      {user && (
        <div className="flex items-center gap-2.5 pl-1.5 pr-3 py-1 rounded-full ring-1 ring-border bg-surface">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-primary to-coral flex items-center justify-center text-ink font-bold text-xs">
            {user.name[0]}
          </div>
          <div className="hidden md:block leading-tight">
            <div className="text-[12px] font-semibold text-ink">{user.name.split(" ")[0]}</div>
          </div>
        </div>
      )}
    </header>
  );
}
