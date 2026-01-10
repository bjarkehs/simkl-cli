import Conf from "conf";

interface SimklConfig {
  accessToken?: string;
  clientId?: string;
  clientSecret?: string;
}

export const config = new Conf<SimklConfig>({
  projectName: "simkl-cli",
  schema: {
    accessToken: { type: "string" },
    clientId: { type: "string" },
    clientSecret: { type: "string" },
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

export function getClientSecret(): string | undefined {
  return config.get("clientSecret");
}

export function setClientSecret(secret: string): void {
  config.set("clientSecret", secret);
}

export function clearAuth(): void {
  config.delete("accessToken");
}

export function isAuthenticated(): boolean {
  return !!config.get("accessToken") && !!config.get("clientId");
}
