"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import clsx from "clsx";

export interface Column<T> {
  key: string;
  label: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  className?: string;
  headerClassName?: string;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  keyField: keyof T;
  onSort?: (key: string, dir: "asc" | "desc") => void;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  loading?: boolean;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

function SortIcon({ active, dir }: { active: boolean; dir?: "asc" | "desc" }) {
  if (!active) return <ChevronsUpDown size={12} className="text-ink-3" />;
  return dir === "asc"
    ? <ChevronUp size={12} className="text-primary" />
    : <ChevronDown size={12} className="text-primary" />;
}

export function DataTable<T extends object>({
  columns,
  data,
  keyField,
  onSort,
  sortBy,
  sortDir,
  loading,
  emptyMessage = "Tidak ada data",
  onRowClick,
}: Props<T>) {
  const handleSort = (col: Column<T>) => {
    if (!col.sortable || !onSort) return;
    const newDir = sortBy === col.key && sortDir === "asc" ? "desc" : "asc";
    onSort(col.key, newDir);
  };

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#F5EFE1]">
            {columns.map((col) => (
              <th
                key={col.key}
                className={clsx(
                  "text-left px-3 py-2.5 text-xs font-semibold text-ink-2 uppercase tracking-wider whitespace-nowrap select-none",
                  col.sortable && "cursor-pointer hover:text-ink",
                  col.headerClassName
                )}
                onClick={() => handleSort(col)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  {col.sortable && (
                    <SortIcon active={sortBy === col.key} dir={sortBy === col.key ? sortDir : undefined} />
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[rgba(27,24,20,0.05)]">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-3">
                    <div className="h-4 bg-[#F5EFE1] animate-pulse rounded" />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className="px-3 py-12 text-center text-ink-3 text-sm"
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr
                key={String(row[keyField])}
                onClick={() => onRowClick?.(row)}
                className={clsx(
                  "border-b border-[rgba(27,24,20,0.05)] transition-colors",
                  onRowClick && "cursor-pointer hover:bg-[#FBF7EE]"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={clsx("px-3 py-3 text-ink", col.className)}
                  >
                    {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

interface PaginationProps {
  page: number;
  pages: number;
  total: number;
  limit: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pages, total, limit, onPage }: PaginationProps) {
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex items-center justify-between px-3 py-3 border-t border-[rgba(27,24,20,0.06)]">
      <p className="text-xs text-ink-3">
        {total > 0 ? `${start}–${end} dari ${total}` : "0 data"}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[rgba(27,24,20,0.1)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5EFE1] transition-colors"
        >
          ‹ Prev
        </button>
        <span className="px-3 py-1.5 text-xs font-semibold text-ink">
          {page}/{pages}
        </span>
        <button
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-[rgba(27,24,20,0.1)] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#F5EFE1] transition-colors"
        >
          Next ›
        </button>
      </div>
    </div>
  );
}
