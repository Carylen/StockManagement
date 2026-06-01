"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ApprovalRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/inquiry/all"); }, [router]);
  return null;
}
