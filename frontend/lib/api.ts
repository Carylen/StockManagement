const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";

let _token: string | null = null;

export function setToken(token: string | null) {
  _token = token;
}

export function getToken(): string | null {
  if (_token) return _token;
  if (typeof window !== "undefined") {
    return localStorage.getItem("ut_stock_token");
  }
  return null;
}

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

/** `detail` is usually a plain string, but some endpoints (e.g. "no active
 * event") return a structured `{code, message}` object — extract a display
 * string either way and surface `code` for callers that want to branch. */
async function _extractError(res: Response, fallback: string): Promise<ApiError> {
  let message = fallback;
  let code: string | undefined;
  try {
    const err = await res.json();
    if (err.detail && typeof err.detail === "object") {
      message = err.detail.message || message;
      code = err.detail.code;
    } else {
      message = err.detail || err.message || message;
    }
  } catch {}
  return new ApiError(message, code);
}

/** Session expired/invalid — clear it and bounce to /login. Shared by every
 * fetch wrapper below so a dead session behaves identically everywhere. */
function _handleUnauthorized(): never {
  if (typeof window !== "undefined") {
    localStorage.removeItem("ut_stock_token");
    localStorage.removeItem("ut_stock_user");
    // Soft replace so browser history is not broken
    window.location.replace("/login");
  }
  throw new Error("Session expired. Please log in again.");
}

function _authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ..._authHeaders(),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (res.status === 401) _handleUnauthorized();

  if (!res.ok) {
    throw await _extractError(res, `Error ${res.status}`);
  }

  // 204/205 (and any other empty-body response) has no JSON to parse — the
  // server may still send Content-Type: application/json out of habit even
  // though the body is empty, so check status/length before content-type.
  if (res.status === 204 || res.status === 205 || res.headers.get("content-length") === "0") {
    return undefined as T;
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.blob() as unknown as T;
}

/** Filename the server chose (`Content-Disposition: attachment; filename="…"`),
 * or null if the header is missing/unparsable — callers fall back to their own
 * default in that case rather than guessing a site/date-specific name upfront. */
function _filenameFromContentDisposition(res: Response): string | null {
  const header = res.headers.get("content-disposition");
  if (!header) return null;
  const match = /filename\*?=(?:UTF-8''|")?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1]) : null;
}

export interface DownloadResult {
  blob: Blob;
  filename: string | null;
}

async function apiFetchFile(endpoint: string): Promise<DownloadResult> {
  const res = await fetch(`${API_URL}${endpoint}`, { headers: _authHeaders() });

  if (res.status === 401) _handleUnauthorized();

  if (!res.ok) {
    throw await _extractError(res, `Download error ${res.status}`);
  }

  return { blob: await res.blob(), filename: _filenameFromContentDisposition(res) };
}

/** Save a downloaded blob as a file — the createObjectURL/anchor-click/revoke
 * dance every download button needs, in one place instead of copy-pasted. */
export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const api = {
  get: <T>(url: string) => apiFetch<T>(url),
  post: <T>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "POST", body: JSON.stringify(body) }),
  patch: <T>(url: string, body?: unknown) =>
    apiFetch<T>(url, { method: "PATCH", body: body !== undefined ? JSON.stringify(body) : undefined }),
  put: <T>(url: string, body: unknown) =>
    apiFetch<T>(url, { method: "PUT", body: JSON.stringify(body) }),
  delete: <T>(url: string) => apiFetch<T>(url, { method: "DELETE" }),
  download: (url: string) => apiFetchFile(url),

  uploadFile: async <T>(url: string, file: File, fields?: Record<string, string>): Promise<T> => {
    const formData = new FormData();
    formData.append("file", file);
    for (const [k, v] of Object.entries(fields ?? {})) formData.append(k, v);
    const res = await fetch(`${API_URL}${url}`, {
      method: "POST",
      headers: _authHeaders(),
      body: formData,
    });
    if (res.status === 401) _handleUnauthorized();
    if (!res.ok) {
      throw await _extractError(res, `Error ${res.status}`);
    }
    return res.json();
  },
};
