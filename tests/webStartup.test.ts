import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(() => { throw new Error("SecureStore is unavailable on web"); }),
  setItemAsync: vi.fn(() => { throw new Error("SecureStore is unavailable on web"); }),
  deleteItemAsync: vi.fn(() => { throw new Error("SecureStore is unavailable on web"); }),
}));
vi.mock("@/services/deviceStorage", () => import("@/services/deviceStorage.web"));
vi.mock("@/config/apiConfig", () => ({ getConfiguredApiBaseUrl: () => "http://auth.test" }));

function browserStorage() {
  const values = new Map<string, string>();
  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    removeItem: vi.fn((key: string) => { values.delete(key); }),
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("window", { sessionStorage: browserStorage(), localStorage: browserStorage() });
});
afterEach(() => vi.unstubAllGlobals());

it("opens a fresh web session without calling native SecureStore or the backend", async () => {
  const { restoreSession } = await import("@/features/auth/services/authSession");
  const { useAuthStore } = await import("@/features/auth/hooks/useAuth");
  const { apiClient, bareApiClient } = await import("@/services/apiClient");
  const network = vi.fn(async () => { throw new Error("Unexpected network request"); });
  apiClient.defaults.adapter = network;
  bareApiClient.defaults.adapter = network;
  await restoreSession();
  expect(useAuthStore.getState()).toMatchObject({ isHydrated: true, token: null, user: null });
  expect(network).not.toHaveBeenCalled();
});

it("stores browser auth within the tab and preferences across reloads", async () => {
  const storage = await import("@/services/deviceStorage.web");
  await storage.setItemAsync("movevn.auth.session", "session");
  await storage.setItemAsync("movevn.theme.mode", "dark");
  expect(window.localStorage.getItem("movevn.auth.session")).toBeNull();
  expect(window.sessionStorage.getItem("movevn.auth.session")).toBe("session");
  expect(await storage.getItemAsync("movevn.theme.mode")).toBe("dark");
  await storage.deleteItemAsync("movevn.auth.session");
  expect(await storage.getItemAsync("movevn.auth.session")).toBeNull();
});

it("allows startup to be retried after browser storage becomes available", async () => {
  const read = vi.spyOn(window.sessionStorage, "getItem").mockImplementationOnce(() => {
    throw new Error("Storage blocked");
  });
  const { restoreSession } = await import("@/features/auth/services/authSession");
  const { useAuthStore } = await import("@/features/auth/hooks/useAuth");
  await expect(restoreSession()).rejects.toThrow("Storage blocked");
  expect(useAuthStore.getState().isHydrated).toBe(false);
  read.mockRestore();
  await restoreSession();
  expect(useAuthStore.getState().isHydrated).toBe(true);
});
