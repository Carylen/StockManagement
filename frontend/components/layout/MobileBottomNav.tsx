"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Package, MessageSquare, User } from "lucide-react";
import { useAuth } from "@/lib/auth";
import clsx from "clsx";

const NAV = [
  { href: "/dashboard",       label: "Beranda",  icon: LayoutDashboard },
  { href: "/katalog",         label: "Katalog",  icon: Package },
  { href: "/inquiry/saya",    label: "Inquiry",  icon: MessageSquare },
  { href: "/profil",          label: "Profil",   icon: User },
];

export function MobileBottomNav({ badge }: { badge?: number }) {
  const pathname = usePathname();
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 pb-safe bg-gradient-to-t from-bg via-bg to-transparent pt-4 px-3 md:hidden">
      <div className="grid grid-cols-4 bg-white rounded-2xl shadow-lg ring-1 ring-border p-1.5">
        {NAV.map((n) => {
          const Icon = n.icon;
          const isActive = pathname === n.href || (n.href !== "/dashboard" && pathname.startsWith(n.href));
          const showBadge = n.href === "/inquiry/saya" && badge;
          return (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-col items-center gap-1 py-1.5 relative"
            >
              <div className={clsx(
                "px-4 py-1.5 rounded-xl transition-colors",
                isActive ? "bg-primary-soft" : "hover:bg-surface-alt"
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
