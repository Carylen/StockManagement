"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

export default function Home() {
  const { user, isLoading, can } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
    } else if (can("can_view_ho_dashboard")) {
      router.replace("/ho/dashboard");
    } else {
      router.replace("/dashboard");
    }
  }, [isLoading, user, can, router]);

  return null;
}
