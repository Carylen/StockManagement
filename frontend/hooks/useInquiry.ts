import useSWR from "swr";
import { api } from "@/lib/api";
import type { PaginatedInquiries, Inquiry } from "@/lib/types";

interface InquiryParams {
  status?: string;
  from_date?: string;
  to_date?: string;
  page?: number;
  limit?: number;
}

function buildQuery(params: InquiryParams): string {
  const q = new URLSearchParams();
  if (params.status) q.set("status", params.status);
  if (params.from_date) q.set("from_date", params.from_date);
  if (params.to_date) q.set("to_date", params.to_date);
  if (params.page) q.set("page", String(params.page));
  if (params.limit) q.set("limit", String(params.limit));
  return q.toString() ? `?${q.toString()}` : "";
}

export function useMyInquiries(params: InquiryParams = {}) {
  const url = `/inquiries/me${buildQuery(params)}`;
  return useSWR<PaginatedInquiries>(url, (u: string) => api.get<PaginatedInquiries>(u));
}

export function useAllInquiries(params: InquiryParams = {}) {
  const url = `/inquiries${buildQuery(params)}`;
  return useSWR<PaginatedInquiries>(url, (u: string) => api.get<PaginatedInquiries>(u));
}

export function useInquiry(id: string | null) {
  return useSWR<Inquiry>(
    id ? `/inquiries/${id}` : null,
    (u: string) => api.get<Inquiry>(u)
  );
}
