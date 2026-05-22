import useSWR from "swr";
import { api } from "@/lib/api";
import type { PaginatedParts, Part, StockHistoryItem } from "@/lib/types";

interface PartsParams {
  search?: string;
  status?: string;
  producer?: string;
  commodity?: string;
  page?: number;
  limit?: number;
  sort_by?: string;
  sort_dir?: string;
}

function buildQuery(params: PartsParams): string {
  const q = new URLSearchParams();
  if (params.search) q.set("search", params.search);
  if (params.status) q.set("status", params.status);
  if (params.producer) q.set("producer", params.producer);
  if (params.commodity) q.set("commodity", params.commodity);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  if (params.sort_by) q.set("sort_by", params.sort_by);
  if (params.sort_dir) q.set("sort_dir", params.sort_dir);
  return q.toString() ? `?${q.toString()}` : "";
}

export function useParts(params: PartsParams) {
  const url = `/parts${buildQuery(params)}`;
  return useSWR<PaginatedParts>(url, (u: string) => api.get<PaginatedParts>(u));
}

export function usePart(partNumber: string | null) {
  return useSWR<Part>(
    partNumber ? `/parts/${partNumber}` : null,
    (u: string) => api.get<Part>(u)
  );
}

export function usePartHistory(partNumber: string | null, days = 7) {
  return useSWR<StockHistoryItem[]>(
    partNumber ? `/parts/${partNumber}/history?days=${days}` : null,
    (u: string) => api.get<StockHistoryItem[]>(u)
  );
}
