import useSWR from "swr";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import type { PaginatedInquiries, InquiryDetail, InquiryCount } from "@/lib/types";

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
  return useSWR<InquiryDetail>(
    id ? `/inquiries/${id}` : null,
    (u: string) => api.get<InquiryDetail>(u)
  );
}

export function useInquiryCount(status?: string, site?: string) {
  const { user } = useAuth();
  const q = new URLSearchParams();
  if (status) q.set("status", status);
  if (site) q.set("site", site);
  const qs = q.toString() ? `?${q}` : "";
  // plain field staff (user role) have no access to /inquiries/count — skip fetch
  const canFetch = user && user.role.toLowerCase() !== "user";
  return useSWR<InquiryCount>(
    canFetch ? `/inquiries/count${qs}` : null,
    (u: string) => api.get<InquiryCount>(u),
    { refreshInterval: 30000 }
  );
}
