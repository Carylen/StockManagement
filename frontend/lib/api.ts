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

async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${endpoint}`, { ...options, headers });

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("ut_stock_token");
      localStorage.removeItem("ut_stock_user");
      // Soft replace so browser history is not broken
      window.location.replace("/login");
    }
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) {
    throw await _extractError(res, `Error ${res.status}`);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.blob() as unknown as T;
}

async function apiFetchFile(endpoint: string): Promise<Blob> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}${endpoint}`, { headers });
  if (!res.ok) throw new Error(`Download error ${res.status}`);
  return res.blob();
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
    const token = getToken();
    const formData = new FormData();
    formData.append("file", file);
    for (const [k, v] of Object.entries(fields ?? {})) formData.append(k, v);
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}${url}`, {
      method: "POST",
      headers,
      body: formData,
    });
    if (res.status === 401) {
      window.location.href = "/login";
      throw new Error("Session expired");
    }
    if (!res.ok) {
      throw await _extractError(res, `Error ${res.status}`);
    }
    return res.json();
  },
};
