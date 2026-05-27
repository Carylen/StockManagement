import clsx from "clsx";
import type { CSSProperties } from "react";

interface Props {
  className?: string;
  style?: CSSProperties;
}

export function Skeleton({ className, style }: Props) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded bg-surface-alt",
        className
      )}
      style={style}
    />
  );
}

export function SkeletonCard() {
  return (
    <div className="bg-surface rounded-lg border border-border p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-10 w-16" />
      <Skeleton className="h-3 w-32" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-6 py-4 border-t border-border">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 flex-1" />
      <Skeleton className="h-4 w-12" />
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-surface rounded-lg border border-border overflow-hidden">
      <div className="px-6 py-3 bg-bg flex gap-6">
        {[100, 200, 80, 60, 60, 80].map((w, i) => (
          <Skeleton key={i} className={`h-3`} style={{ width: w }} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}
