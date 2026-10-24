import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  channel: vi.fn(), permission: vi.fn(), request: vi.fn(), handler: vi.fn(), registerApi: vi.fn(),
}));
// Demo runs in Expo Go without an EAS project or native remote-push credentials.
vi.mock("expo-constants", () => ({ default: { executionEnvironment: "storeClient", expoConfig: { extra: {} } } }));
vi.mock("expo-device", () => ({ isDevice: true }));
vi.mock("expo-crypto", () => ({ randomUUID: vi.fn() }));
vi.mock("react-native", () => ({ Platform: { OS: "android" } }));
vi.mock("@/services/deviceStorage", () => ({ getItemAsync: vi.fn(), setItemAsync: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: { put: mocks.registerApi }, bareApiClient: {} }));
vi.mock("@/features/auth/hooks/useAuth", () => ({ getSessionGeneration: () => 1, useAuthStore: { getState: () => ({ user: { userId: 42 } }) } }));
vi.mock("expo-notifications", () => ({
  AndroidImportance: { HIGH: 4 }, setNotificationChannelAsync: mocks.channel,
  getPermissionsAsync: mocks.permission, requestPermissionsAsync: mocks.request,
  setNotificationHandler: mocks.handler,
}));
import { prepareLocalNotifications, registerPushDevice } from "@/features/notifications/pushRegistration";

beforeEach(() => {
  vi.clearAllMocks(); mocks.channel.mockResolvedValue(undefined);
  mocks.permission.mockResolvedValue({ granted: false, canAskAgain: true });
  mocks.request.mockResolvedValue({ granted: true });
});

it("enables local OS banners and sound in Expo Go without registering remote push", async () => {
  expect(await prepareLocalNotifications()).not.toBeNull();
  await registerPushDevice();
  expect(mocks.channel).toHaveBeenCalledWith("bookings-demo", expect.objectContaining({ importance: 4, sound: "default" }));
  expect(mocks.request).toHaveBeenCalledOnce();
  expect(mocks.registerApi).not.toHaveBeenCalled();
  const handler = mocks.handler.mock.calls[0]![0].handleNotification;
  expect(await handler({ request: { content: { data: { localBooking: true } } } })).toMatchObject({ shouldShowBanner: true, shouldPlaySound: true });
  expect(await handler({ request: { content: { data: {} } } })).toMatchObject({ shouldShowBanner: false });
});

it("does not repeatedly prompt or enable a presenter when permission is denied", async () => {
  mocks.permission.mockResolvedValue({ granted: false, canAskAgain: false });
  expect(await prepareLocalNotifications()).toBeNull();
  expect(mocks.request).not.toHaveBeenCalled();
});
