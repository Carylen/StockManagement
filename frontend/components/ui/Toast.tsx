"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import clsx from "clsx";

interface Props {
  message: string | null;
  kind?: "ok" | "err" | "warn" | "info";
  onDismiss: () => void;
}

const KIND_STYLES = {
  ok:   { dot: "#22C55E", bg: "#DCFCE7" },
  err:  { dot: "#EF4444", bg: "#FEE2E2" },
  warn: { dot: "#F59E0B", bg: "#FEF3C7" },
  info: { dot: "#6366F1", bg: "#EDE9FE" },
};

export function Toast({ message, kind = "ok", onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDismiss, 3500);
    return () => clearTimeout(t);
  }, [message, onDismiss]);

  if (!message) return null;

  const { dot, bg } = KIND_STYLES[kind];

  return (
    <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[200] animate-slide-up">
      <div
        className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border border-border max-w-md"
        style={{ background: "white" }}
      >
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: dot, boxShadow: `0 0 0 4px ${bg}` }} />
        <p className="text-sm font-semibold text-ink">{message}</p>
        <button onClick={onDismiss} className="ml-2 text-ink-3 hover:text-ink transition-colors">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
