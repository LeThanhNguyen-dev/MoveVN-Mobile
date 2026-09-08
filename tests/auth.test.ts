import { beforeEach, describe, expect, it, vi } from "vitest";
import { AxiosError, AxiosHeaders, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

const storage = vi.hoisted(() => ({ values: new Map<string, string>(), fail: false }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (key: string) => storage.values.get(key) ?? null),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    if (storage.fail) throw new Error("Storage unavailable");
    storage.values.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => { storage.values.delete(key); }),
}));
vi.mock("@/config/apiConfig", () => ({ getConfiguredApiBaseUrl: () => "http://auth.test" }));

const session = () => ({
  token: { accessToken: "old-access", refreshToken: "old-refresh", sessionId: "session-1", accessTokenJti: "jti",
    accessTokenExpiresAt: "2099-01-01T00:00:00Z", refreshTokenExpiresAt: "2099-02-01T00:00:00Z" },
  user: { userId: 1, fullName: "Test", email: "test@example.com", status: "Active", isEmailVerified: true, roles: ["Customer" as const] },
});
function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: String(status), headers: new AxiosHeaders() };
}
function reject401(config: InternalAxiosRequestConfig) {
  return Promise.reject(new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, undefined, response(config, { code: "401" }, 401)));
}
async function setup() {
  const store = await import("@/features/auth/hooks/useAuth");
  const client = await import("@/services/apiClient");
  const lifecycle = await import("@/features/auth/services/authSession");
  const service = await import("@/features/auth/services/authService");
  return { ...store, ...client, ...lifecycle, service };
}
beforeEach(() => { vi.resetModules(); storage.values.clear(); storage.fail = false; });

describe("Authentication lifecycle", () => {
  it("persists login before publishing the session and restores current user", async () => {
    const app = await setup();
    app.bareApiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe("/api/auth/login");
      expect(JSON.parse(config.data)).toEqual({ email: "test@example.com", password: "password" });
      return response(config, { status: true, data: session() });
    };
    await app.completeSignIn(await app.service.login({ email: "test@example.com", password: "password" }));
    expect(JSON.parse(storage.values.get("movevn.auth.session")!).token.accessToken).toBe("old-access");
    app.apiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe("/api/auth/me");
      expect(config.headers.get("Authorization")).toBe("Bearer old-access");
      return response(config, { status: true, data: { ...session().user, fullName: "Updated" } });
    };
    await app.restoreSession();
    expect(app.useAuthStore.getState().isHydrated).toBe(true);
    expect(app.getAuthUser()?.fullName).toBe("Updated");
  });

  it("does not refresh invalid login credentials", async () => {
    const app = await setup();
    app.bareApiClient.defaults.adapter = reject401;
    await expect(app.service.login({ email: "bad@example.com", password: "wrong" })).rejects.toBeInstanceOf(AxiosError);
    expect(app.getToken()).toBeNull();
  });

  it("shares a refresh across concurrent 401 requests, rotates tokens and retries", async () => {
    const app = await setup();
    await app.setSession(session());
    let refreshes = 0;
    app.bareApiClient.defaults.adapter = async (config) => {
      refreshes++;
      expect(config.url).toBe("/api/auth/refresh-token");
      expect(JSON.parse(config.data)).toEqual({ refreshToken: "old-refresh" });
      await new Promise((resolve) => setTimeout(resolve, 10));
      return response(config, { status: true, data: { ...session(), token: { ...session().token, accessToken: "new-access", refreshToken: "new-refresh" } } });
    };
    app.apiClient.defaults.adapter = async (config) => config.headers.get("Authorization") === "Bearer old-access"
      ? reject401(config) : response(config, { status: true, data: session().user });
    await Promise.all([app.service.getCurrentUser(), app.service.getCurrentUser(), app.service.getCurrentUser()]);
    expect(refreshes).toBe(1);
    expect(app.getRefreshToken()).toBe("new-refresh");
    expect(JSON.parse(storage.values.get("movevn.auth.session")!).token.accessToken).toBe("new-access");
  });

  it("clears authentication when refresh is rejected", async () => {
    const app = await setup();
    await app.setSession(session());
    app.apiClient.defaults.adapter = reject401;
    app.bareApiClient.defaults.adapter = reject401;
    await expect(app.service.getCurrentUser()).rejects.toBeDefined();
    expect(app.getToken()).toBeNull();
    expect(storage.values.has("movevn.auth.session")).toBe(false);
  });

  it("does not loop if the retry also returns 401", async () => {
    const app = await setup();
    await app.setSession(session());
    let calls = 0;
    app.apiClient.defaults.adapter = (config) => { calls++; return reject401(config); };
    app.bareApiClient.defaults.adapter = async (config) => response(config, { status: true, data: session() });
    await expect(app.service.getCurrentUser()).rejects.toBeDefined();
    expect(calls).toBe(2);
    expect(app.getToken()).toBeNull();
  });

  it("cannot resurrect a session when refresh finishes after logout", async () => {
    const app = await setup();
    await app.setSession(session());
    let release!: () => void;
    let started!: () => void;
    const waiting = new Promise<void>((resolve) => { started = resolve; });
    app.bareApiClient.defaults.adapter = async (config) => {
      started(); await new Promise<void>((resolve) => { release = resolve; });
      return response(config, { status: true, data: session() });
    };
    const refreshing = app.refreshAuthSession();
    const result = expect(refreshing).rejects.toThrow("Session changed");
    await waiting; await app.clearSession(); release(); await result;
    expect(app.getToken()).toBeNull();
    expect(storage.values.has("movevn.auth.session")).toBe(false);
  });

  it("revokes with the captured tokens and clears locally even when offline", async () => {
    const app = await setup();
    await app.setSession(session());
    app.bareApiClient.defaults.adapter = async (config) => {
      expect(config.url).toBe("/api/auth/logout");
      expect(config.headers.get("Authorization")).toBe("Bearer old-access");
      expect(JSON.parse(config.data).refreshToken).toBe("old-refresh");
      throw new AxiosError("Offline", "ERR_NETWORK", config);
    };
    await expect(app.signOut()).rejects.toBeDefined();
    expect(app.getToken()).toBeNull();
    expect(storage.values.size).toBe(0);
  });

  it("keeps the startup gate and stored session when current-user lookup is offline", async () => {
    storage.values.set("movevn.auth.session", JSON.stringify(session()));
    const app = await setup();
    app.apiClient.defaults.adapter = async (config) => { throw new AxiosError("Offline", "ERR_NETWORK", config); };
    await expect(app.restoreSession()).rejects.toBeDefined();
    expect(app.useAuthStore.getState().isHydrated).toBe(false);
    expect(app.getToken()).toBe("old-access");
  });

  it("refreshes expired access tokens before fetching current user", async () => {
    storage.values.set("movevn.auth.session", JSON.stringify({ ...session(), token: { ...session().token, accessTokenExpiresAt: "2000-01-01T00:00:00Z" } }));
    const app = await setup();
    const paths: string[] = [];
    app.bareApiClient.defaults.adapter = async (config) => { paths.push(config.url!); return response(config, { status: true, data: session() }); };
    app.apiClient.defaults.adapter = async (config) => { paths.push(config.url!); return response(config, { status: true, data: session().user }); };
    await app.restoreSession();
    expect(paths).toEqual(["/api/auth/refresh-token", "/api/auth/me"]);
  });

  it("discards corrupt storage and prevents login if persistence fails", async () => {
    storage.values.set("movevn.auth.session", "{bad json");
    const app = await setup();
    await app.restoreSession();
    expect(app.getToken()).toBeNull();
    storage.fail = true;
    await expect(app.completeSignIn(session())).rejects.toThrow();
    expect(app.getToken()).toBeNull();
    expect(app.useAuthStore.getState().storageError).toBeTruthy();
  });

  it("restricts active roles to the authenticated user's roles", async () => {
    const app = await setup();
    await app.setSession(session());
    await app.useAuthStore.getState().setActiveRole("Admin");
    expect(app.useAuthStore.getState().activeRole).toBe("Customer");
  });
});

describe("Web validation contract", () => {
  it("validates registration, OTP, password confirmation and login independently", async () => {
    const { validateAuth } = await import("@/features/auth/utils/validation");
    const fields = { email: "test@example.com", fullName: "Test", phone: "0912345678", password: "password", confirmPassword: "password", otp: "123456" };
    expect(validateAuth("register", fields, true)).toEqual({});
    expect(validateAuth("register", { ...fields, phone: "123", password: "short" }, false)).toHaveProperty("terms");
    expect(validateAuth("verify", { ...fields, otp: "12a456" }, false)).toHaveProperty("otp");
    expect(validateAuth("reset", { ...fields, confirmPassword: "different" }, false)).toHaveProperty("confirmPassword");
    expect(validateAuth("login", { ...fields, password: "short" }, false)).toEqual({});
  });
});
