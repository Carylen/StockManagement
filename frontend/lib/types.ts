export type Role = "user" | "group_leader" | "admin" | "supplier";

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
  commodity: string | null;
  rtt_qty: number;
  tbd_qty: number;
  estimated_date: string | null;
  min_qty: number;
  max_qty: number;
  status: StockStatus | null;
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
  done: number;
  total: number;
}

export interface PartFilters {
  commodities: string[];
  producers: string[];
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
  estimated_date: string | null;
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
  commodity: string | null;
  rtt_qty: number | null;
  tbd_qty: number | null;
  total_qty: number | null;
  min_qty: number | null;
  max_qty: number | null;
  status: StockStatus | null;
  estimated_date: string | null;
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

// Inquiries — v2.1: item-level respond
// pending = any item pending; done = all items responded
export type InquiryStatus = "pending" | "done";

export interface InquiryItem {
  id: string;
  part_number: string;
  part_name: string | null;
  qty: number;
  // item-level respond fields
  status: "pending" | "valid" | "invalid";
  replacement_pn: string | null;
  ut_site_code: string | null;
  ut_note: string | null;
  responded_at: string | null;
  responded_by: string | null;
}

export interface InquiryListItem {
  id: string;
  site: string;
  submitted_by_nrp: string | null;
  submitted_by_name: string | null;
  status: InquiryStatus;
  total_unique_parts: number;
  total_qty: number;
  total_pending_items: number;
  total_valid_items: number;
  total_invalid_items: number;
  created_at: string;
  responded_at: string | null;
}

export interface InquiryDetail {
  id: string;
  site: string;
  submitted_by_nrp: string | null;
  submitted_by_name: string | null;
  status: InquiryStatus;  // computed from items
  created_at: string;
  updated_at: string;
  items: InquiryItem[];
}

export interface PaginatedInquiries {
  items: InquiryListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Employees (plant workers — mechanic / group_leader / user)
export type EmployeeRole = "mechanic" | "group_leader" | "user";

export interface EmployeeSummary {
  total: number;
  active: number;
  inactive: number;
  dept_head_count: number;
}

export interface Employee {
  id: string;
  nrp: string;
  name: string;
  site: string;
  role: EmployeeRole;
  position: string | null;
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
  warnings: string[];
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
    commodity?: string;
    rtt_qty: number;
    tbd_qty: number;
    estimated_date: string | null;
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

export interface Site {
  code: string;
  name: string;
}
