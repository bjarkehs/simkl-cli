import createClient from "openapi-fetch";
import { getAccessToken, getClientId } from "../config.js";
import type { paths } from "./schema.js";

const BASE_URL = "https://api.simkl.com";

export function createSimklClient() {
  const clientId = getClientId();
  const accessToken = getAccessToken();

  if (!clientId) {
    throw new Error("Client ID not configured. Run `simkl config --client-id <id>` first.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "simkl-api-key": clientId,
  };

  if (accessToken) {
    headers.Authorization = `Bearer ${accessToken}`;
  }

  return createClient<paths>({
    baseUrl: BASE_URL,
    headers,
  });
}

export function createUnauthenticatedClient(clientId: string) {
  return createClient<paths>({
    baseUrl: BASE_URL,
    headers: {
      "Content-Type": "application/json",
      "simkl-api-key": clientId,
    },
  });
}
