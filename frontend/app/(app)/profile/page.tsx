"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, User, Shield, MapPin, Mail } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Topbar } from "@/components/layout/Topbar";
import type { Role } from "@/lib/types";
import { useTranslations } from "next-intl";


const ROLE_COLORS: Record<Role, { bg: string; text: string }> = {
  user:         { bg: "#F3F4F6", text: "#374151" },
  group_leader: { bg: "#EDE9FE", text: "#6D28D9" },
  planner:      { bg: "#DCEEE3", text: "#1F6F4C" },
  admin:        { bg: "#FFF1D0", text: "#B45309" },
  supplier:     { bg: "#DCFCE7", text: "#15803D" },
  super_admin:  { bg: "#1B1814", text: "#FFFFFF" },
};

const FALLBACK_ROLE_COLOR = { bg: "#F3F4F6", text: "#374151" };

export default function ProfilPage() {
  const t = useTranslations("profile");
  const tr = useTranslations("roles");
  const tu = useTranslations("users");
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const roleColor = ROLE_COLORS[user.role] ?? FALLBACK_ROLE_COLOR;

  return (
    <div className="min-h-full">
      <Topbar title={t("title")} subtitle={t("subtitle")} />

      <div className="p-4 md:p-6 max-w-md space-y-4">
        {/* Avatar & Name */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] p-6 text-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-extrabold mx-auto mb-4"
            style={{ background: "#1B1814" }}
          >
            {user.name.charAt(0).toUpperCase()}
          </div>
          <h2 className="text-xl font-bold text-ink">{user.name}</h2>
          <div
            className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-semibold"
            style={{ background: roleColor.bg, color: roleColor.text }}
          >
            <Shield size={12} />
            {tr(user.role)}
          </div>
        </div>

        {/* Info fields */}
        <div className="bg-surface rounded-xl border border-[rgba(27,24,20,0.08)] divide-y divide-[rgba(27,24,20,0.06)]">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Mail size={16} className="text-ink-3 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Email</p>
              <p className="text-sm font-medium text-ink">{user.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <User size={16} className="text-ink-3 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Role</p>
              <p className="text-sm font-medium text-ink">{tr(user.role)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <MapPin size={16} className="text-ink-3 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">Site</p>
              <p className="text-sm font-medium text-ink">{user.site}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 px-4 py-3.5">
            <Shield size={16} className="text-ink-3 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-3">User ID</p>
              <p className="text-xs font-mono text-ink-2">{user.id}</p>
            </div>
          </div>
        </div>

        {/* Note about password change */}
        <div className="bg-surface-alt rounded-lg p-3 border border-[rgba(27,24,20,0.06)]">
          <p className="text-xs text-ink-2">{t("changeNote")}</p>
        </div>

        {/* Logout */}
        {!showLogoutConfirm ? (
          <button
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 py-3 bg-[#FEE2E2] text-warning-text font-bold text-sm rounded-xl hover:bg-red-100 transition-colors"
          >
            <LogOut size={16} />
            {t("signOut")}
          </button>
        ) : (
          <div className="bg-warning-bg rounded-xl p-4 border border-warning/20">
            <p className="text-sm font-semibold text-ink text-center mb-3">{t("signOutConfirm")}</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 py-2.5 bg-surface-alt text-ink font-semibold text-sm rounded-lg"
              >
                {tu("cancel")}
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 py-2.5 bg-warning text-white font-bold text-sm rounded-lg hover:bg-red-600 transition-colors"
              >
                {t("signOut")}
              </button>
            </div>
          </div>
        )}

        {/* Version */}
        <p className="text-center text-[10px] text-ink-3">
          {t("version")}
        </p>
      </div>
    </div>
  );
}
