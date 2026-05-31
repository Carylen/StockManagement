export type Role = "mechanic" | "group_leader" | "admin" | "supplier";

export interface AuthUser {
  id: string;
  name: string;
  email: string;      // empty string "" for employees (NRP login)
  nrp?: string;       // only for employees
  role: Role;
  site: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
    site: string;
  };
  employee?: {
    id: string;
    name: string;
    nrp: string;
    role: string;
    site: string;
  };
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
  producer: string | null;
  commodity: string | null;
  rtt_qty: number;
  tbd_qty: number;
  estimated_qty: number;
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

export interface InquiryCount {
  count: number;
}

export interface InquiryStatusCounts {
  pending: number;
  valid: number;
  invalid: number;
  total: number;
}

export interface InquiryPulseItem {
  date: string;
  count: number;
}

// Parts
export type StockStatus = "WARNING" | "AMAN" | "OVER" | "MAX";

export interface PartSuggestion {
  part_number: string;
  description: string | null;
  mnemonic: string | null;
  kelas: "V" | "G";
}

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

// Inquiries — v2.0: only pending | valid | invalid
export type InquiryStatus = "pending" | "valid" | "invalid";

export interface Inquiry {
  id: string;
  submitted_by: string | null;
  submitted_by_employee_id: string | null;
  site: string;
  kelas: string;
  part_name: string;
  part_number: string | null;
  qty_needed: number;
  unit_asset: string | null;
  date_needed: string | null;
  notes: string | null;
  status: InquiryStatus;
  // UT response fields
  ut_site_code: string | null;
  replacement_pn: string | null;
  respond_notes: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
  submitter_name: string | null;
}

export interface PaginatedInquiries {
  items: Inquiry[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Employees (plant workers — mechanic / group_leader)
export type EmployeeRole = "mechanic" | "group_leader";

export interface Employee {
  id: string;
  nrp: string;
  name: string;
  site: string;
  role: EmployeeRole;
  shift: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaginatedEmployees {
  items: Employee[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface BulkEmployeeResult {
  inserted: number;
  updated: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
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

// Master Class V/G
export interface MasterMeta {
  filename: string | null;
  uploaded_at: string | null;
  uploader_name: string | null;
  total: number;
  class_v_count: number;
  class_g_count: number;
  komatsu_count: number;
  scania_count: number;
}

export interface MasterPart {
  part_number: string;
  description: string | null;
  mnemonic: string | null;
  commodity: string | null;
  kelas: "V" | "G";
}

export interface MasterPreview {
  items: MasterPart[];
  total: number;
}

export interface MasterUploadResult {
  inserted: number;
  updated: number;
  class_v: number;
  class_g: number;
  skipped: number;
  errors: string[];
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
    estimated_qty: number;
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
