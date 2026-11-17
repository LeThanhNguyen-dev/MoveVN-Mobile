import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  constants: { executionEnvironment: "bare", expoConfig: { extra: { remotePushEnabled: true, eas: { projectId: "test-project" } } } },
  device: { isDevice: true }, generation: 1, userId: 12 as number | null,
  token: vi.fn(), put: vi.fn(), remove: vi.fn(), permission: vi.fn(), request: vi.fn(),
}));
vi.mock("expo-constants", () => ({ default: mocks.constants }));
vi.mock("expo-device", () => mocks.device);
vi.mock("expo-crypto", () => ({ randomUUID: () => "device-12345" }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/services/deviceStorage", () => ({ getItemAsync: async () => "device-12345", setItemAsync: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: { put: mocks.put }, bareApiClient: { delete: mocks.remove } }));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getSessionGeneration: () => mocks.generation,
  useAuthStore: { getState: () => ({ user: mocks.userId ? { userId: mocks.userId } : null, token: { accessToken: "access-token" } }) },
}));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 }, setNotificationChannelAsync: vi.fn(), setNotificationHandler: vi.fn(),
  getPermissionsAsync: mocks.permission, requestPermissionsAsync: mocks.request, getExpoPushTokenAsync: mocks.token,
}));
import { registerPushDevice } from "@/features/notifications/pushRegistration";

beforeEach(() => {
  vi.clearAllMocks(); mocks.generation++; mocks.userId = 12;
  mocks.constants.executionEnvironment = "bare"; mocks.constants.expoConfig.extra.remotePushEnabled = true;
  mocks.constants.expoConfig.extra.eas.projectId = "test-project"; mocks.device.isDevice = true;
  mocks.permission.mockResolvedValue({ granted: true });
  mocks.token.mockResolvedValue({ data: "ExpoPushToken[device]" });
  mocks.put.mockResolvedValue({}); mocks.remove.mockResolvedValue({});
});

it("registers the Expo token and device against the authenticated session", async () => {
  await registerPushDevice();
  expect(mocks.token).toHaveBeenCalledWith({ projectId: "test-project" });
  expect(mocks.put).toHaveBeenCalledWith("/api/notifications/push-devices", { deviceId: "device-12345", token: "ExpoPushToken[device]", platform: "android" });
});

it("registers an Android emulator when its notification provider returns a token", async () => {
  mocks.device.isDevice = false;
  await registerPushDevice();
  expect(mocks.token).toHaveBeenCalledWith({ projectId: "test-project" });
  expect(mocks.put).toHaveBeenCalledWith("/api/notifications/push-devices", {
    deviceId: "device-12345", token: "ExpoPushToken[device]", platform: "android",
  });
});

it("does not try remote registration in Expo Go or when disabled", async () => {
  mocks.constants.executionEnvironment = "storeClient";
  await registerPushDevice();
  mocks.constants.executionEnvironment = "bare";
  mocks.constants.expoConfig.extra.remotePushEnabled = false;
  await registerPushDevice();
  expect(mocks.token).not.toHaveBeenCalled(); expect(mocks.put).not.toHaveBeenCalled();
});

it("reports missing project configuration instead of silently skipping registration", async () => {
  mocks.constants.expoConfig.extra.eas.projectId = "";
  await expect(registerPushDevice()).rejects.toThrow("EXPO_PUBLIC_EAS_PROJECT_ID");
  expect(mocks.put).not.toHaveBeenCalled();
});

it("unregisters an existing device when OS permission is revoked", async () => {
  mocks.permission.mockResolvedValue({ granted: false, canAskAgain: false });
  await registerPushDevice();
  expect(mocks.remove).toHaveBeenCalledWith("/api/notifications/push-devices/device-12345", expect.objectContaining({ headers: { Authorization: "Bearer access-token" } }));
  expect(mocks.put).not.toHaveBeenCalled();
});

it("does not register a token resolved after an account switch", async () => {
  mocks.token.mockImplementationOnce(async () => { mocks.userId = 99; mocks.generation++; return { data: "ExpoPushToken[old]" }; });
  await registerPushDevice();
  expect(mocks.put).not.toHaveBeenCalled();
});

it("cleans up a registration if sign-out happens while its request is in flight", async () => {
  mocks.put.mockImplementationOnce(async () => { mocks.userId = null; mocks.generation++; });
  await registerPushDevice();
  expect(mocks.remove).toHaveBeenCalledWith("/api/notifications/push-devices/device-12345", { headers: { Authorization: "Bearer access-token" } });
});

it("can retry after a transient registration failure", async () => {
  mocks.put.mockRejectedValueOnce(new Error("offline"));
  await expect(registerPushDevice()).rejects.toThrow("offline");
  await expect(registerPushDevice()).resolves.toBeUndefined();
  expect(mocks.put).toHaveBeenCalledTimes(2);
});
