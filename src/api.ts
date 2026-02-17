import { getAccessToken, getClientId } from "./config.js";
import type { operations, paths } from "./generated/api-types.js";

const BASE_URL = "https://api.simkl.com";

/**
 * All known API endpoint paths from the OpenAPI spec.
 * Use `keyof paths` to constrain path parameters in typed wrappers.
 */
export type ApiPath = keyof paths;

/**
 * Extract the HTTP method operations for a given path.
 * Example: `PathMethods<"/search/{type}">` gives the object with `get`, `post`, etc.
 */
export type PathMethods<P extends ApiPath> = paths[P];

/**
 * Helper to extract the successful (200) JSON response type for an operation.
 * Works with operations that have `content["application/json"]` in their 200 response.
 *
 * Because the generated operation IDs contain spaces (e.g. "Get items based on text query"),
 * indexing them directly is awkward. Instead, use this type with a known operation name:
 *
 * ```ts
 * type SearchResult = OperationResponse<"Get items based on text query">;
 * ```
 */
export type OperationResponse<K extends keyof operations> = operations[K] extends {
  responses: { 200: { content: { "application/json": infer R } } };
}
  ? R
  : unknown;

/**
 * Helper to extract the request body JSON type for an operation.
 *
 * ```ts
 * type SyncBody = OperationRequestBody<"Add items to history / watchlist">;
 * ```
 */
export type OperationRequestBody<K extends keyof operations> = operations[K] extends {
  requestBody?: { content: { "application/json": infer B } };
}
  ? B
  : unknown;

export class SimklApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API Error ${status}: ${statusText}`);
    this.name = "SimklApiError";
  }
}

function getHeaders(authenticated: boolean): Record<string, string> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("Client ID not configured. Run: simkl config --client-id <your-id>");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "simkl-api-key": clientId,
  };

  if (authenticated) {
    const token = getAccessToken();
    if (!token) {
      throw new Error("Not authenticated. Run: simkl auth");
    }
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Make an authenticated or unauthenticated request to the Simkl API.
 *
 * The generic parameter `T` defaults to `unknown` so callers can supply
 * the expected response type (ideally via `OperationResponse`).
 *
 * @param path    - API path, e.g. "/search/id" or "/sync/all-items/shows/watching"
 * @param options - method, body, query params, and whether to send the auth token
 */
export async function api<T = unknown>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    body?: unknown;
    params?: Record<string, string | number | undefined>;
    authenticated?: boolean;
  } = {}
): Promise<T> {
  const { method = "GET", body, params, authenticated = false } = options;

  const url = new URL(path, BASE_URL);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString(), {
    method,
    headers: getHeaders(authenticated),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errorBody: unknown;
    try {
      errorBody = await res.json();
    } catch {
      // ignore parse errors on error responses
    }
    throw new SimklApiError(res.status, res.statusText, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/**
 * Make an unauthenticated GET request that passes `client_id` as a query parameter.
 *
 * Many Simkl public endpoints (search, ratings, media info) accept `client_id`
 * as a query param instead of requiring the `simkl-api-key` header with a token.
 *
 * @param path   - API path, e.g. "/search/id"
 * @param params - additional query parameters merged alongside `client_id`
 */
export async function apiPublic<T = unknown>(
  path: string,
  params: Record<string, string | number | undefined> = {}
): Promise<T> {
  const clientId = getClientId();
  if (!clientId) {
    throw new Error("Client ID not configured. Run: simkl config --client-id <your-id>");
  }
  return api<T>(path, { params: { ...params, client_id: clientId } });
}
