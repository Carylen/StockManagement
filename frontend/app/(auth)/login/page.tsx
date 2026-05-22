"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import type { TokenResponse } from "@/lib/types";

interface FormValues {
  email: string;
  password: string;
}

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { isSubmitting, errors } } = useForm<FormValues>();

  const onSubmit = async (data: FormValues) => {
    setError(null);
    try {
      const res = await api.post<TokenResponse>("/auth/login", data);
      login(res.access_token, res.user);
      router.push("/dashboard");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login gagal");
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-ink mx-auto mb-4 flex items-center justify-center ring-2 ring-primary/20">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-coral" />
          </div>
          <h1 className="text-2xl font-extrabold text-ink tracking-tight">
            UT<span className="text-primary-dark">·</span>STOCK
          </h1>
          <p className="text-[11px] font-medium text-ink-3 tracking-widest uppercase mt-1">KPP Mining — AGMR</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm ring-1 ring-border p-6">
          <h2 className="text-lg font-bold text-ink mb-1">Masuk ke akun</h2>
          <p className="text-sm text-ink-2 mb-6">Hubungi Admin Site jika belum punya akun.</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                autoComplete="email"
                placeholder="nama@kpp.co.id"
                className="w-full px-4 py-3 rounded-xl border border-border bg-bg text-ink text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                {...register("email", { required: "Email wajib diisi" })}
              />
              {errors.email && <p className="text-xs text-warning-text mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <label className="block text-[11px] font-bold text-ink-2 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-border bg-bg text-ink text-sm outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
                  {...register("password", { required: "Password wajib diisi" })}
                />
                <button
                  type="button"
                  onClick={() => setShowPass((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-3"
                >
                  {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="text-xs text-warning-text mt-1">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="px-4 py-3 bg-warning-bg rounded-xl text-sm text-warning-text font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-ink text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-ink/80 disabled:opacity-60 transition-all"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : null}
              {isSubmitting ? "Masuk…" : "Masuk"}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-ink-3 mt-6">
          Sistem monitoring VHS United Tractors untuk KPP Mining AGMR
        </p>
      </div>
    </div>
  );
}
