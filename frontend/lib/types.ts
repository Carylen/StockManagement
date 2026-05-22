export type Role = "mechanic" | "group_leader" | "admin" | "supplier";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  site: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

// Dashboard
export interface StatusCount {
  WARNING: number;
  AMAN: number;
  OVER: number;
  MAX: number;
}

export interface ReadynessMetrics {
  oh_pct: number;
  min_pct: number;
  fb_pct: number;
}

export interface DashboardSummary {
  site: string;
  last_updated: string | null;
  total_parts: number;
  status_count: StatusCount;
  readyness: ReadynessMetrics;
}

export interface StockLatestItem {
  part_number: string;
  description: string | null;
  rtt_qty: number;
  tbd_qty: number;
  min_qty: number;
  max_qty: number;
  status: StockStatus | null;
  snapshot_date: string | null;
  updated_at: string | null;
}

export interface InquiryPendingCount {
  count: number;
  role_label: string;
}

export interface InquiryPulseItem {
  date: string;
  count: number;
}

// Parts
export type StockStatus = "WARNING" | "AMAN" | "OVER" | "MAX";

export interface StockInfo {
  rtt_qty: number;
  tbd_qty: number;
  total_qty: number;
  min_qty: number;
  max_qty: number;
  status: StockStatus | null;
  snapshot_date: string | null;
}

export interface Part {
  id: string;
  part_number: string;
  description: string | null;
  producer: string | null;
  commodity: string | null;
  kelas: "V" | "G";
  is_active: boolean;
  current_stock: StockInfo | null;
  created_at: string;
  updated_at: string;
}

export interface PartListItem {
  id: string;
  part_number: string;
  description: string | null;
  producer: string | null;
  commodity: string | null;
  kelas: "V" | "G";
  rtt_qty: number | null;
  tbd_qty: number | null;
  total_qty: number | null;
  min_qty: number | null;
  max_qty: number | null;
  status: StockStatus | null;
  snapshot_date: string | null;
}

export interface PaginatedParts {
  items: PartListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface StockHistoryItem {
  id: string;
  warehouse: "RTT" | "TBD";
  old_qty: number | null;
  new_qty: number;
  delta: number;
  source_file: string | null;
  synced_at: string;
}

// Inquiries
export type InquiryStatus = "draft" | "pending" | "available" | "unavailable" | "partial" | "rejected";

export interface Inquiry {
  id: string;
  submitted_by: string;
  reviewed_by: string | null;
  site: string;
  part_name: string;
  part_number: string | null;
  qty_needed: number;
  unit_asset: string | null;
  date_needed: string | null;
  notes: string | null;
  status: InquiryStatus;
  rejection_reason: string | null;
  supplier_notes: string | null;
  reviewed_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  submitter_name: string | null;
  reviewer_name: string | null;
}

export interface PaginatedInquiries {
  items: Inquiry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Users
export interface AppUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  site: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Upload
export interface ValidationResponse {
  session_id: string;
  filename: string;
  rows_total: number;
  rows_valid: number;
  rows_skipped: number;
  rows_error: number;
  errors: Array<{ row: number; reason: string }>;
  preview: Array<{
    part_number: string;
    description?: string;
    producer?: string;
    commodity?: string;
    rtt_qty: number;
    tbd_qty: number;
    min_qty: number;
    max_qty: number;
    status: string;
  }>;
  skipped_detail: Array<{ pn: string; reason: string }>;
  error_detail: Array<{ row: number; reason: string }>;
}

export interface UploadLog {
  id: string;
  filename: string;
  rows_total: number;
  rows_processed: number;
  rows_skipped: number;
  rows_error: number;
  status: "success" | "partial" | "failed";
  created_at: string;
  uploader_name: string | null;
}
