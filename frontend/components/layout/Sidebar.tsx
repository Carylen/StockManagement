"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Package, MessageSquare, Upload,
  Activity, Users, LogOut, ChevronRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import clsx from "clsx";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  roles: Role[];
  badge?: number;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard",          label: "Dashboard",       icon: LayoutDashboard, roles: ["admin","group_leader","mechanic"] },
  { href: "/katalog",            label: "Katalog Stok",    icon: Package,         roles: ["admin","group_leader","mechanic","supplier"] },
  { href: "/inquiry/semua",      label: "Semua Inquiry",   icon: MessageSquare,   roles: ["admin","group_leader"] },
  { href: "/inquiry/approval",   label: "Antrian Approval",icon: MessageSquare,   roles: ["group_leader"] },
  { href: "/supplier/inquiry",   label: "Inquiry Masuk",   icon: MessageSquare,   roles: ["supplier"] },
  { href: "/admin/upload",       label: "Upload CSV",       icon: Upload,          roles: ["admin"] },
  { href: "/admin/log",          label: "Log Upload",       icon: Activity,        roles: ["admin"] },
  { href: "/admin/users",        label: "Kelola User",      icon: Users,           roles: ["admin"] },
];

interface Props {
  pendingCount?: number;
}

export function Sidebar({ pendingCount }: Props) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user) return null;

  const items = NAV_ITEMS.filter((n) => n.roles.includes(user.role));

  const roleLabel: Record<Role, string> = {
    admin: "Admin Site",
    group_leader: "Group Leader",
    mechanic: "Mekanik",
    supplier: "PIC UT Rantau",
  };

  return (
    <aside className="w-60 flex-shrink-0 flex flex-col border-r border-border bg-bg h-screen sticky top-0">
      {/* Logo */}
      <div className="px-5 py-6">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-ink flex items-center justify-center ring-1 ring-primary/30">
            <div className="w-4 h-4 rounded bg-gradient-to-br from-primary to-coral" />
          </div>
          <div className="leading-none">
            <div className="font-extrabold text-ink text-[15px] tracking-tight">
              UT<span className="text-primary-dark">·</span>STOCK
            </div>
            <div className="text-[9px] font-medium text-ink-3 tracking-widest mt-0.5">BY KPP MINING</div>
          </div>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          const badge = item.href === "/inquiry/approval" || item.href === "/inquiry/semua" ? pendingCount : undefined;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13.5px] font-medium transition-all relative",
                isActive
                  ? "bg-white text-ink shadow-sm ring-1 ring-border font-semibold"
                  : "text-ink-2 hover:bg-white/60 hover:text-ink"
              )}
            >
              <Icon
                size={18}
                className={clsx(isActive ? "text-primary-dark" : "text-ink-3")}
              />
              {item.label}
              {badge ? (
                <span className="ml-auto bg-coral text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                  {badge}
                </span>
              ) : isActive ? (
                <ChevronRight size={14} className="ml-auto text-ink-3" />
              ) : null}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2.5 p-3 rounded-xl bg-white ring-1 ring-border">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-coral flex items-center justify-center text-ink font-bold text-sm flex-shrink-0">
            {user.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[12.5px] font-semibold text-ink truncate">{user.name}</div>
            <div className="text-[10px] text-ink-3">{roleLabel[user.role]}</div>
          </div>
          <button
            onClick={logout}
            title="Keluar"
            className="text-ink-3 hover:text-warning transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}
