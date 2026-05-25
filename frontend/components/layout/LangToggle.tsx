"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { setLocaleCookie } from "@/lib/locale";
import clsx from "clsx";

export function LangToggle() {
  const locale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSwitch = (next: "en" | "id") => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleCookie(next);
      router.refresh();
    });
  };

  return (
    <div className={clsx("flex items-center rounded-lg ring-1 ring-border bg-surface overflow-hidden text-xs font-bold", isPending && "opacity-60")}>
      {(["en", "id"] as const).map((l) => (
        <button
          key={l}
          onClick={() => handleSwitch(l)}
          className={clsx(
            "px-2.5 py-1.5 transition-colors uppercase",
            locale === l
              ? "bg-ink text-white"
              : "text-ink-2 hover:text-ink"
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
