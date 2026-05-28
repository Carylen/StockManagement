"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, MessageSquare, User, Upload } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useTranslations } from "next-intl";
import clsx from "clsx";

export function MobileBottomNav({ badge }: { badge?: number }) {
  const pathname = usePathname();
  const t = useTranslations("common");

  /*const NAV = [
    { href: "/dashboard",    label: t("home"),    icon: LayoutDashboard },
    { href: "/catalog",       label: t("catalog"), icon: Package },
    { href: "/inquiry/mine",  label: t("inquiry"), icon: MessageSquare },
    { href: "/profile",       label: t("profile"), icon: User },
  ];*/

  const { user } = useAuth();

  const NAV_BY_ROLE = {
    admin: [
      { href: "/dashboard",       label: t("home"),      icon: LayoutDashboard },
      { href: "/catalog",         label: t("catalog"),   icon: Package },
      { href: "/inquiry/all",     label: t("inquiry"),   icon: MessageSquare },
      { href: "/admin/upload",    label: t("upload"),    icon: Upload },
      { href: "/profile",         label: t("profile"),   icon: User },
    ],
    group_leader: [
      { href: "/dashboard",       label: t("home"),      icon: LayoutDashboard },
      { href: "/catalog",         label: t("catalog"),   icon: Package },
      { href: "/inquiry/all",     label: t("inquiry"),   icon: MessageSquare },
      { href: "/profile",         label: t("profile"),   icon: User },
    ],
    mechanic: [
      { href: "/dashboard",       label: t("home"),      icon: LayoutDashboard },
      { href: "/catalog",         label: t("catalog"),   icon: Package },
      { href: "/inquiry/mine",    label: t("inquiry"),   icon: MessageSquare },
      { href: "/profile",         label: t("profile"),   icon: User },
    ],
    supplier: [
      { href: "/supplier/inquiry",   label: t("inquiry"),   icon: MessageSquare },
      { href: "/supplier/readiness", label: t("catalog"),   icon: Package },
      { href: "/profile",            label: t("profile"),   icon: User },
    ],
  };
  
  const NAV = NAV_BY_ROLE[user?.role ?? "mechanic"] ?? NAV_BY_ROLE.mechanic;


  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-gradient-to-t from-bg via-bg to-transparent pt-4 px-3 md:hidden">
      <div 
        className="bg-surface rounded-2xl shadow-lg ring-1 ring-border p-1.5">
        style={{ display: "grid", gridTemplateColumns: `repeat(${NAV.length}, 1fr)` }}
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          const showBadge = n.href === "/inquiry/mine" && badge;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center gap-1 py-1.5 relative"
            >
              <div className={clsx(
                "px-4 py-1.5 rounded-xl transition-colors",
                isActive ? "bg-brand-soft" : "hover:bg-surface-alt"
              )}>
                <Icon size={22} className={isActive ? "text-ink" : "text-ink-3"} />
              </div>
              <span className={clsx("text-[10.5px] font-medium", isActive ? "text-ink font-bold" : "text-ink-3")}>
                {n.label}
              </span>
              {showBadge ? (
                <span className="absolute top-1 right-5 bg-coral text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
