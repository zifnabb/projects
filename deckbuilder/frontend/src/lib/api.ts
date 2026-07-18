/**
 * Single fetch wrapper for the vermilion API. All calls are same-origin
 * (Vite proxies /api → backend in dev; FastAPI serves both in prod) and send
 * the httpOnly session cookie via `credentials: "include"`.
 *
 * Errors throw `ApiError` carrying the HTTP status and the backend's `detail`
 * string, so screens can render the exact message (e.g. rate-limit copy).
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type Json = Record<string, unknown> | unknown[];

async function request<T>(
  method: string,
  path: string,
  body?: Json,
): Promise<T> {
  const res = await fetch(path, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      if (data && typeof data.detail === "string") detail = data.detail;
    } catch {
      /* non-JSON error body — keep statusText */
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, body?: Json) => request<T>("POST", path, body),
  patch: <T>(path: string, body?: Json) => request<T>("PATCH", path, body),
  del: <T>(path: string) => request<T>("DELETE", path),
};
