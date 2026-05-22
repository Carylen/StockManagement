import useSWR from "swr";
import { api } from "@/lib/api";
import type { DashboardSummary, StockLatestItem, InquiryPendingCount, InquiryPulseItem } from "@/lib/types";
import { useAuth } from "@/lib/auth";

export function useDashboardSummary() {
  const { user } = useAuth();
  return useSWR<DashboardSummary>(
    user ? "/dashboard/summary" : null,
    (url: string) => api.get<DashboardSummary>(url),
    { refreshInterval: 60000 }
  );
}

export function useStockLatest() {
  const { user } = useAuth();
  return useSWR<StockLatestItem[]>(
    user ? "/dashboard/stock-latest" : null,
    (url: string) => api.get<StockLatestItem[]>(url),
    { refreshInterval: 60000 }
  );
}

export function useInquiryPending() {
  const { user } = useAuth();
  return useSWR<InquiryPendingCount>(
    user ? "/dashboard/inquiry-pending" : null,
    (url: string) => api.get<InquiryPendingCount>(url),
    { refreshInterval: 30000 }
  );
}

export function useInquiryPulse() {
  const { user } = useAuth();
  return useSWR<InquiryPulseItem[]>(
    user ? "/dashboard/inquiry-pulse" : null,
    (url: string) => api.get<InquiryPulseItem[]>(url),
    { refreshInterval: 60000 }
  );
}
