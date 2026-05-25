"use client";

import { UserCheck } from "lucide-react";
import { Topbar } from "@/components/layout/Topbar";
import { useAuth } from "@/lib/auth";

export default function TimMekanikPage() {
  const { user } = useAuth();
  const site = user?.site ?? "—";

  return (
    <div className="min-h-full">
      <Topbar
        title="Tim Mekanik"
        subtitle={`Group Leader · Site ${site}`}
      />

      <div className="flex-1 flex items-center justify-center p-12">
        <div className="text-center max-w-md">
          <div className="w-24 h-24 rounded-full bg-[#DCEEE3] flex items-center justify-center mx-auto mb-5">
            <UserCheck size={40} className="text-[#1F6F4C]" />
          </div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-[#1F6F4C] mb-2">
            Belum di scope ini
          </div>
          <h1 className="text-2xl font-bold text-ink tracking-tight mb-3">
            Tim Mekanik · {site}
          </h1>
          <p className="text-sm text-ink-2 leading-relaxed">
            Roster dan data mekanik di bawah Group Leader site {site}.
            Termasuk shift aktif dan riwayat inquiry per mekanik.
          </p>
        </div>
      </div>
    </div>
  );
}
