"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { AuthUser, Role, TokenResponse } from "@/lib/types";
import { Logo } from "@/components/ui/Logo";
import { HaulCycleAnim } from "@/components/ui/HaulCycleAnim";

type Track = "plant" | "admin" | "ut";

interface NRPForm { nrp: string; }
interface PasswordForm { email: string; password: string; }

const BRAND = {
  plant: { color: "#1F6F4C", deep: "#0F4A30", soft: "#DCEEE3", on: "#FFFFFF", org: "KPP Mining" },
  admin: { color: "#1F6F4C", deep: "#0F4A30", soft: "#DCEEE3", on: "#FFFFFF", org: "KPP Mining" },
  ut:    { color: "#E8A323", deep: "#B07410", soft: "#FFF1D0", on: "#16110D", org: "United Tractors" },
};

export default function LoginPage() {
  const t = useTranslations("loginPage");
  const { login } = useAuth();
  const router = useRouter();
  const [track, setTrack] = useState<Track>("plant");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nrpForm = useForm<NRPForm>();
  const pwdForm = useForm<PasswordForm>();

  const B = BRAND[track];
  const ctx = { heading: t(`heading_${track}`), desc: t(`desc_${track}`) };

  const switchTrack = (t: Track) => {
    setTrack(t);
    setError(null);
  };

  // ── Plant / NRP login ──────────────────────────────────────────
  const handleNRP = nrpForm.handleSubmit(async ({ nrp }) => {
    setError(null);
    try {
      const res = await api.post<TokenResponse>("/auth/login-nrp", {
        nrp: nrp.trim().toUpperCase(),
      });
      const emp = res.employee!;
      const authUser: AuthUser = {
        id: emp.id,
        name: emp.name,
        email: "",
        nrp: emp.nrp,
        role: emp.role as Role,
        site: emp.site,
        permissions: [], // re-derived from JWT inside login()
      };
      login(res.access_token, authUser);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("nrpNotFound"));
    }
  });

  // ── Email + password login ─────────────────────────────────────
  const handlePassword = pwdForm.handleSubmit(async ({ email, password }) => {
    setError(null);
    try {
      const res = await api.post<TokenResponse>("/auth/login", { email, password });
      const u = res.user!;
      const authUser: AuthUser = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role as Role,
        site: u.site,
        permissions: [], // re-derived from JWT inside login()
      };
      login(res.access_token, authUser);
      const dest =
        u.role === "supplier" ? "/supplier/inquiry" :
        u.role === "super_admin" ? "/ho/dashboard" :
        "/dashboard";
      router.push(dest);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("wrongCredentials"));
    }
  });

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = B.color;
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = "";
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col lg:grid lg:grid-cols-2">

      {/* ── Left panel · dark brand context (desktop only) ────── */}
      <div
        className="hidden lg:flex flex-col bg-ink text-white p-12 relative overflow-hidden"
        style={{ minHeight: "100vh" }}
      >
        {/* Ambient glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 25% 75%, ${B.color}1A 0%, transparent 55%)`,
          }}
        />

        {/* Haul cycle backdrop animation */}
        <HaulCycleAnim accent={B.color} />

        {/* Logo */}
        <div className="relative">
          <Logo dark isSupplier={track === "ut"} size="md" />
        </div>

        {/* Context block */}
        <div className="relative mt-auto">
          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em] mb-4"
            style={{ color: B.color }}
          >
            {B.org} · {t("signInWord")}
          </p>
          <h2
            className="text-[38px] font-bold text-white leading-[1.07] mb-5"
            style={{ letterSpacing: "-0.04em", maxWidth: 380 }}
          >
            {ctx.heading.split("\n").map((line, i) => (
              <span key={i}>
                {line}
                {i < ctx.heading.split("\n").length - 1 && <br />}
              </span>
            ))}
          </h2>
          <p className="text-[13px] text-white/55 leading-relaxed mb-7" style={{ maxWidth: 360 }}>
            {ctx.desc}
          </p>
          <div className="flex flex-wrap gap-2">
            {[t("tag1"), t("tag2"), t("tag3")].map((tag) => (
              <span
                key={tag}
                className="px-2.5 py-1 rounded-md text-[11px] text-white/50"
                style={{ background: "rgba(255,255,255,0.08)" }}
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Right panel · form ────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center px-6 py-10 lg:px-14">
        <div className="w-full max-w-md">

          {/* Mobile logo */}
          <div className="flex justify-center mb-8 lg:hidden">
            <Logo isSupplier={track === "ut"} size="sm" />
          </div>

          <p
            className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2"
            style={{ color: B.deep }}
          >
            {t("chooseAccountType")}
          </p>
          <h1
            className="text-[28px] font-bold text-ink mb-6"
            style={{ letterSpacing: "-0.03em" }}
          >
            {t("loginAs")}
          </h1>

          {/* ── Track switcher ── */}
          <div className="grid grid-cols-3 gap-1.5 p-1 bg-surface-alt rounded-2xl mb-7">
            {([
              { k: "plant" as Track, label: t("trackUser"),  sub: t("trackUserSub") },
              { k: "admin" as Track, label: t("trackAdmin"), sub: t("trackAdminSub") },
              { k: "ut"    as Track, label: t("trackUt"),    sub: t("trackUtSub") },
            ]).map(({ k, label, sub }) => {
              const on = track === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => switchTrack(k)}
                  className={`py-3 px-2 rounded-xl text-center transition-all ${
                    on ? "bg-surface shadow-sm" : "bg-transparent"
                  }`}
                >
                  <div className={`text-[12px] font-bold leading-snug ${on ? "text-ink" : "text-ink-2"}`}>
                    {label}
                  </div>
                  <div className={`text-[10px] font-medium mt-0.5 leading-tight ${on ? "text-ink-2" : "text-ink-3"}`}>
                    {sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Plant / NRP form ── */}
          {track === "plant" ? (
            <form onSubmit={handleNRP} className="space-y-5">

              {/* NRP field */}
              <div>
                <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2">
                  {t("nrpLabel")}
                </label>
                <input
                  {...nrpForm.register("nrp", { required: t("nrpRequired") })}
                  placeholder="KM19142"
                  className="w-full px-5 py-4 rounded-xl border-[1.5px] bg-surface font-mono font-bold text-[20px] text-ink tracking-widest outline-none transition-colors"
                  style={{ borderColor: `${B.color}55`, textTransform: "uppercase" }}
                  onInput={(e) => { e.currentTarget.value = e.currentTarget.value.toUpperCase(); }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = B.color; }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = `${B.color}55`; }}
                />
                {nrpForm.formState.errors.nrp && (
                  <p className="text-xs text-warning mt-1.5">{nrpForm.formState.errors.nrp.message}</p>
                )}
                <p className="text-[11px] text-ink-3 mt-2">
                  {t("nrpHint")}
                </p>
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 bg-warning-bg rounded-xl text-sm text-warning font-semibold">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={nrpForm.formState.isSubmitting}
                className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-opacity disabled:opacity-60 mt-1"
                style={{ background: B.color, color: B.on }}
              >
                {nrpForm.formState.isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> {t("checkingNrp")}</>
                ) : (
                  <>{t("signInAsEmployee")} <ArrowRight size={16} /></>
                )}
              </button>
            </form>

          ) : (
            /* ── Email + Password form ── */
            <form onSubmit={handlePassword} className="space-y-4">

              {/* Email */}
              <div>
                <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2">
                  {t("officeEmail")}
                </label>
                <input
                  {...pwdForm.register("email", { required: t("emailRequired") })}
                  type="email"
                  autoComplete="email"
                  placeholder={track === "ut" ? "pic@unitedtractors.com" : "admin@kpp.co.id"}
                  className="w-full px-4 py-3.5 rounded-xl border-[1.5px] border-border bg-surface text-sm text-ink outline-none transition-colors"
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
                {pwdForm.formState.errors.email && (
                  <p className="text-xs text-warning mt-1.5">{pwdForm.formState.errors.email.message}</p>
                )}
              </div>

              {/* Password */}
              <div>
                <label className="block text-[10px] font-bold text-ink-3 uppercase tracking-[0.08em] mb-2">
                  {t("passwordLabel")}
                </label>
                <div className="relative">
                  <input
                    {...pwdForm.register("password", { required: t("passwordRequired") })}
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="w-full px-4 py-3.5 pr-20 rounded-xl border-[1.5px] border-border bg-surface text-sm text-ink font-mono outline-none transition-colors"
                    onFocus={inputFocus}
                    onBlur={inputBlur}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-surface-alt text-ink-3 text-[10px] font-semibold flex items-center gap-1"
                  >
                    {showPwd ? <><EyeOff size={12} /> {t("hide")}</> : <><Eye size={12} /> {t("show")}</>}
                  </button>
                </div>
                {pwdForm.formState.errors.password && (
                  <p className="text-xs text-warning mt-1.5">{pwdForm.formState.errors.password.message}</p>
                )}
              </div>

              {/* Error */}
              {error && (
                <div className="px-4 py-3 bg-warning-bg rounded-xl text-sm text-warning font-semibold">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={pwdForm.formState.isSubmitting}
                className="w-full py-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2.5 transition-opacity disabled:opacity-60 mt-1"
                style={{ background: B.color, color: B.on }}
              >
                {pwdForm.formState.isSubmitting ? (
                  <><Loader2 size={16} className="animate-spin" /> {t("checking")}</>
                ) : (
                  <>{t("signInPrefix")}{track === "ut" ? t("picUtRantau") : t("adminSite")} <ArrowRight size={16} /></>
                )}
              </button>

            </form>
          )}

          {/* Footer note */}
          <p className="text-center text-[11px] text-ink-3 mt-8 leading-relaxed">
            {t("footer")}
            {/* <br />
            <span className="font-mono tracking-wider">AGMR · RANT · SPUT</span> */}
          </p>

        </div>
      </div>
    </div>
  );
}
