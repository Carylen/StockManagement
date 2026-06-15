"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import type { PermissionChecks } from "@/lib/auth";

/**
 * Client-side route guard driven by permissions (not role strings).
 *
 * Redirects to `redirectTo` when the authenticated user fails `allowed`.
 * Returns `ready` — true only when auth has loaded, a user exists, and the
 * check passes — so callers can `if (!ready) return null` to avoid flicker.
 *
 * Reusable across all (admin)/(supplier)/(ho) layouts and page guards.
 */
export function usePermissionGuard(
  allowed: (checks: PermissionChecks) => boolean,
  redirectTo = "/dashboard"
) {
  const { user, isLoading, can, canAny, canAll } = useAuth();
  const router = useRouter();

  const ok = !!user && allowed({ can, canAny, canAll });

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!ok) {
      router.replace(redirectTo);
    }
  }, [isLoading, user, ok, router, redirectTo]);

  return { ready: !isLoading && !!user && ok, user };
}
