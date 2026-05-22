"use client";

import Link from "next/link";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { StockGauge } from "@/components/ui/StockGauge";
import { DataTable, Pagination } from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import type { PartListItem } from "@/lib/types";

interface Props {
  data: PartListItem[];
  loading: boolean;
  total: number;
  page: number;
  pages: number;
  limit: number;
  sortBy: string;
  sortDir: "asc" | "desc";
  onSort: (key: string, dir: "asc" | "desc") => void;
  onPage: (page: number) => void;
}

const COLUMNS: Column<PartListItem>[] = [
  {
    key: "part_number",
    label: "Part Number",
    sortable: true,
    render: (row) => (
      <Link
        href={`/katalog/${row.part_number}`}
        className="font-mono font-bold text-ink hover:text-primary transition-colors text-xs"
      >
        {row.part_number}
      </Link>
    ),
  },
  {
    key: "description",
    label: "Deskripsi",
    sortable: true,
    render: (row) => (
      <span className="text-xs text-ink-2 line-clamp-2 max-w-[280px]">{row.description || "—"}</span>
    ),
  },
  {
    key: "producer",
    label: "Prod",
    render: (row) => (
      <span className="text-[10px] font-semibold bg-[#F5EFE1] px-1.5 py-0.5 rounded">{row.producer || "—"}</span>
    ),
  },
  {
    key: "rtt_qty",
    label: "RTT",
    sortable: true,
    className: "text-right",
    headerClassName: "text-right",
    render: (row) => (
      <span className="font-mono font-bold text-xs text-right block">{row.rtt_qty ?? "—"}</span>
    ),
  },
  {
    key: "tbd_qty",
    label: "TBD",
    className: "text-right",
    headerClassName: "text-right",
    render: (row) => (
      <span className="font-mono text-xs text-right block text-ink-2">{row.tbd_qty ?? "—"}</span>
    ),
  },
  {
    key: "gauge",
    label: "MIN→MAX",
    render: (row) =>
      row.min_qty !== null && row.max_qty !== null && row.rtt_qty !== null ? (
        <div className="w-28">
          <StockGauge rtt={row.rtt_qty ?? 0} min={row.min_qty ?? 0} max={row.max_qty ?? 0} height={6} />
          <div className="flex justify-between text-[9px] text-ink-3 font-mono mt-0.5">
            <span>{row.min_qty}</span>
            <span>{row.max_qty}</span>
          </div>
        </div>
      ) : (
        <span className="text-ink-3 text-xs">—</span>
      ),
  },
  {
    key: "status",
    label: "Status",
    sortable: true,
    render: (row) => <StatusBadge status={row.status} size="sm" />,
  },
];

export function PartTable({
  data,
  loading,
  total,
  page,
  pages,
  limit,
  sortBy,
  sortDir,
  onSort,
  onPage,
}: Props) {
  return (
    <div className="bg-surface rounded-lg border border-[rgba(27,24,20,0.08)] overflow-hidden">
      <DataTable
        columns={COLUMNS}
        data={data}
        keyField="id"
        loading={loading}
        sortBy={sortBy}
        sortDir={sortDir}
        onSort={onSort}
        emptyMessage="Tidak ada part ditemukan"
      />
      <Pagination
        page={page}
        pages={pages}
        total={total}
        limit={limit}
        onPage={onPage}
      />
    </div>
  );
}
