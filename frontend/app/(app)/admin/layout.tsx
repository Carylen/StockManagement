"use client";

import { usePermissionGuard } from "@/hooks/usePermissionGuard";

// Admin area gate: any site-management capability grants access (admin + super_admin).
// Individual pages further guard their own specific permission.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { ready } = usePermissionGuard(({ canAny }) =>
    canAny(
      "can_upload_readiness",
      "can_manage_master",
      "can_manage_employees",
      "can_manage_site_users",
      "can_manage_all_users",
    )
  );

  if (!ready) return null;

  return <>{children}</>;
}
