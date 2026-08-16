const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4100';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  accessToken?: string | null;
}

/** Calls the QRHub API. Always sends credentials so the httpOnly refresh
 * cookie (set by the API's own origin) is included on every request. */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.accessToken) {
    headers.Authorization = `Bearer ${options.accessToken}`;
  }

  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'include',
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorBody: unknown = await response.json().catch(() => null);
    const message =
      errorBody && typeof errorBody === 'object' && 'message' in errorBody
        ? String((errorBody as { message: unknown }).message)
        : response.statusText;
    throw new ApiError(response.status, message);
  }

  // NestJS sends a fully empty body (not the text "null") for a handler that
  // returns `null`, not just for an explicit 204 — response.json() would
  // throw on that empty body, so check for empty text first.
  const text = await response.text();
  if (!text) {
    return undefined as T;
  }
  return JSON.parse(text) as T;
}
