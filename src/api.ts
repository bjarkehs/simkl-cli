import { getAccessToken, getClientId } from "./config.js";

const BASE_URL = "https://api.simkl.com";

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
      // ignore
    }
    throw new SimklApiError(res.status, res.statusText, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

// Unauthenticated GET with client_id as query param (for endpoints that take it as query)
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
