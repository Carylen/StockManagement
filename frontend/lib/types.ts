export type Role = "user" | "group_leader" | "planner" | "admin" | "supplier" | "super_admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;      // empty string "" for employees (NRP login)
  nrp?: string;       // only for employees
  role: Role;
  site: string;
  permissions: string[];   // derived from JWT payload — drives all client-side guards
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
  NO_DATA: number;
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
  part_number: string;
  description: string | null;
  mnemonic: string | null;
  commodity: string | null;
  producer: string | null;
  kelas: string | null;
  min_qty: number | null;
  max_qty: number | null;
  avail_stock: number | null;
  last_uploaded_at: string | null;
  status: StockStatus | null;
  is_fallback: boolean;
  // legacy fields — may be null in new flow
  rtt_qty?: number | null;
  tbd_qty?: number | null;
  total_qty?: number | null;
  estimated_date?: string | null;
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

export type ApprovalStatus = "not_required" | "pending" | "approved" | "rejected";

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
  approval_status: ApprovalStatus;
  reject_reason: string | null;
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
  approval_status: ApprovalStatus;
  approved_by_name: string | null;
  approved_at: string | null;
  reject_reason: string | null;
}

export interface PaginatedInquiries {
  items: InquiryListItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// Employees (plant workers — user / group_leader / planner [GL-Planner])
export type EmployeeRole = "user" | "group_leader" | "planner";

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

// ── Scheduled Plan / Overhaul ──────────────────────────────────────────
export type PlanLineStatus = "READY" | "NOT_READY";

export interface PlanPeriod {
  period_id: string;
  site: string;
  activity: string;
  start_date: string;
  due_date: string;
  state: "OPEN" | "LOCKED";
  readiness_pct: number;
  total_lines: number;
}

export interface PlanLine {
  id: string;
  egi: string;
  cn: string;
  apl_activity: string;
  npn: string;
  description: string | null;
  req_qty: number;
  req_date: string | null;
  status: PlanLineStatus;
  ut_location: string | null;
  est_date: string | null;
  is_ready: boolean;
  removed_in_revision: boolean;
}

export interface PaginatedPlanLines {
  items: PlanLine[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface FillImportResult {
  updated: number;
  skipped: number;
  errors: { line_id?: string; reason?: string }[];
}

export interface PlanPeriodUploadResult {
  period_id: string;
  activity: string;
  is_revision: boolean;
  rows_inserted: number;
  rows_updated: number;
  rows_merged: number;
  rows_marked_removed: number;
}

export interface PlanSkippedPeriod {
  activity: string;
  reason: string;
}

export interface PlanUploadResult {
  site: string;
  start_date: string;
  due_date: string;
  rows_total: number;
  // aggregate counts across all processed periods
  rows_inserted: number;
  rows_updated: number;
  rows_merged: number;
  rows_skipped: number;
  rows_marked_removed: number;
  periods: PlanPeriodUploadResult[];
  skipped_periods: PlanSkippedPeriod[];
  errors: { row: number; reason: string }[];
}

export interface PlanAplStat {
  apl_activity: string;
  ready: number;
  total: number;
  pct: number;
}

export interface PlanActivityOverview {
  activity: string;
  readiness_pct: number;
  ready: number;
  total: number;
  apl_activities: PlanAplStat[];
}

export interface PlanOverview {
  period_id: string;
  activities: PlanActivityOverview[];
}

export interface PlanActivityAchievement {
  activity: string;
  readiness_pct: number;
  ready: number;
  total: number;
  not_ready_apl_activities: PlanAplStat[];
}

export interface PlanAchievement {
  period_id: string;
  activities: PlanActivityAchievement[];
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

export type UploadWarning =
  | { code: "duplicate_pn"; pn: string; rows: string }
  | { code: "empty_pn"; row: number };

export interface MasterUploadResult {
  inserted: number;
  updated: number;
  class_v: number;
  class_g: number;
  skipped: number;
  errors: string[];
  warnings: UploadWarning[];
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

// UT Stock Upload (Bagian 6C)
export interface UTValidateResponse {
  filename: string;
  total_rows: number;
  matched_rows: number;
  skipped_rows: number;
  sites_affected: string[];
  warnings: string[];
  preview: Array<{
    part_number: string;
    description: string | null;
    plnt_code: string;
    site_code: string;
    avail_stock: number;
  }>;
}

export interface UTPublishResult {
  batch_id: string;
  total_rows: number;
  matched_rows: number;
  skipped_rows: number;
  sites_affected: string[];
  warnings: string[];
}

export interface UTUploadLogItem {
  id: string;
  batch_id: string;
  filename: string | null;
  uploaded_by: string | null;
  uploader_name: string | null;
  total_rows: number;
  matched_rows: number;
  skipped_rows: number;
  sites_affected: string[];
  uploaded_at: string;
}

export interface UTUploadLogsResponse {
  items: UTUploadLogItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
