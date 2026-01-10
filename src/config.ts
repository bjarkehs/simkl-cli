import Conf from "conf";

interface SimklConfig {
  accessToken?: string;
  clientId?: string;
}

export const config = new Conf<SimklConfig>({
  projectName: "simkl-cli",
  schema: {
    accessToken: { type: "string" },
    clientId: { type: "string" },
  },
});

export function getAccessToken(): string | undefined {
  return config.get("accessToken");
}

export function setAccessToken(token: string): void {
  config.set("accessToken", token);
}

export function getClientId(): string | undefined {
  return config.get("clientId");
}

export function setClientId(id: string): void {
  config.set("clientId", id);
}

export function clearAuth(): void {
  config.delete("accessToken");
}

export function isAuthenticated(): boolean {
  return !!config.get("accessToken") && !!config.get("clientId");
}
