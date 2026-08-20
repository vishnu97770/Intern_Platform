const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

let accessToken: string | null = null;
/** Called by ApiClient after a successful silent refresh, so future requests carry the new token. */
let onTokenRefreshed: ((token: string) => void) | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function setOnTokenRefreshed(callback: ((token: string) => void) | null): void {
  onTokenRefreshed = callback;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  /** Set false for the refresh call itself to avoid infinite retry loops. */
  allowRefresh?: boolean;
}

async function rawRequest(path: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  return fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    credentials: "include", // send the httpOnly refresh cookie
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
}

async function tryRefresh(): Promise<boolean> {
  const res = await rawRequest("/auth/refresh", { method: "POST", allowRefresh: false });
  if (!res.ok) return false;
  const data = await res.json();
  accessToken = data.accessToken;
  onTokenRefreshed?.(data.accessToken);
  return true;
}

/**
 * Core request helper: on a 401 (expired access token) it silently attempts
 * one refresh-and-retry before surfacing the error, so a valid session
 * doesn't force the student to log in again every 15 minutes.
 */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let res = await rawRequest(path, options);

  if (res.status === 401 && options.allowRefresh !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await rawRequest(path, options);
    }
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    throw new ApiError(payload?.error?.message ?? res.statusText, res.status, payload?.error?.code ?? "UNKNOWN");
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
