"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, MessageSquare, User } from "lucide-react";
import { useTranslations } from "next-intl";

export function MobileBottomNav({ badge }: { badge?: number }) {
  const pathname = usePathname();
  const t = useTranslations("common");

  // MobileBottomNav is for role "user" only — admin/supplier use the Sidebar mobile drawer
  const NAV = [
    { href: "/dashboard",     label: t("home"),    icon: LayoutDashboard },
    { href: "/catalog",       label: t("catalog"), icon: Package },
    { href: "/inquiry/mine",  label: t("inquiry"), icon: MessageSquare },
    { href: "/profile",       label: t("profile"), icon: User },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-gradient-to-t from-bg via-bg to-transparent pt-4 px-3 md:hidden">
      <div
        className="bg-surface rounded-2xl shadow-lg ring-1 ring-border"
        style={{ display: "grid", gridTemplateColumns: `repeat(${NAV.length}, 1fr)`, padding: "8px 4px" }}
      >
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          const showBadge = n.href === "/inquiry/mine" && badge;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center gap-1 py-1 relative"
              style={{ color: isActive ? "#16110D" : "#A39A8A" }}
            >
              <div
                className="rounded-xl transition-colors"
                style={{
                  padding: "6px 16px",
                  background: isActive ? "#FFF1D0" : "transparent",
                }}
              >
                <Icon size={22} />
              </div>
              <span className="text-[10.5px]" style={{ fontWeight: isActive ? 700 : 500 }}>
                {n.label}
              </span>
              {showBadge ? (
                <span
                  className="absolute top-1"
                  style={{
                    right: "30%",
                    background: "#FF7A59",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 5px",
                    borderRadius: 6,
                  }}
                >
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
