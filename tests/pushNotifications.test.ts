import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.stubGlobal("__DEV__", false);
const mocks = vi.hoisted(() => ({
  userId: 1 as number | null, roles: ["Customer", "Owner"],
  initial: null as unknown, response: undefined as ((value: unknown) => void) | undefined,
  register: vi.fn(), schedule: vi.fn(), clear: vi.fn(), removed: vi.fn(), handler: vi.fn(), foreground: undefined as ((state: string) => void) | undefined,
}));
vi.mock("react-native", () => ({ Platform: { OS: "android" }, AppState: { currentState: "active", addEventListener: (_type: string, callback: (state: string) => void) => {
  mocks.foreground = callback; return { remove: vi.fn() };
} } }));
vi.mock("@/features/auth/hooks/useAuth", () => {
  const state = () => ({ token: mocks.userId ? { accessToken: "token" } : null,
    user: mocks.userId ? { userId: mocks.userId, roles: mocks.roles } : null });
  return { useAuthStore: Object.assign((selector: (state: unknown) => unknown) => selector(state()), { getState: state }) };
});
vi.mock("@/features/notifications/pushRegistration", () => ({
  registerPushDevice: mocks.register,
  prepareLocalNotifications: async () => ({ scheduleNotificationAsync: mocks.schedule }),
  loadLocalNotifications: async () => ({
    DEFAULT_ACTION_IDENTIFIER: "default", setNotificationHandler: mocks.handler,
    getLastNotificationResponseAsync: async () => mocks.initial,
    clearLastNotificationResponseAsync: mocks.clear,
    addNotificationResponseReceivedListener: (callback: (value: unknown) => void) => { mocks.response = callback; return { remove: mocks.removed }; },
    addPushTokenListener: () => ({ remove: mocks.removed }),
  }),
}));
import { usePushNotifications } from "@/features/notifications/usePushNotifications";
import { usePushNavigation } from "@/features/notifications/pushNavigation";
import { receiveNotification } from "@/features/notifications/notificationDelivery";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import { useToastStore } from "@/features/notifications/toastStore";

function Host() { usePushNotifications(); return null; }
const tap = (userId: number, requestId = "tap-1") => ({ actionIdentifier: "default", notification: { request: {
  identifier: requestId, content: { data: { userId: String(userId), dataJson: '{"bookingId":42,"roleTarget":"customer"}' } },
} } });
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.userId = 1; mocks.roles = ["Customer", "Owner"];
  mocks.initial = null; mocks.response = undefined;
  mocks.register.mockResolvedValue(undefined); mocks.clear.mockResolvedValue(undefined);
  mocks.schedule.mockResolvedValue("scheduled");
  useNotificationStore.getState().activate(1); useToastStore.getState().clearToasts();
  usePushNavigation.getState().clear();
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.useRealTimers(); });

it("opens the booking from a cold-start OS notification and consumes its stored response", async () => {
  mocks.initial = tap(1);
  await act(async () => { tree = create(React.createElement(Host)); });
  expect(usePushNavigation.getState().pending).toMatchObject({ userId: 1, bookingId: 42, roleTarget: "Customer" });
  expect(mocks.clear).toHaveBeenCalledOnce();
  usePushNavigation.getState().clear();
  await act(async () => { mocks.response?.(tap(1)); });
  expect(usePushNavigation.getState().pending).toBeNull();
});

it("ignores a notification addressed to another logged-in account", async () => {
  mocks.initial = tap(2);
  await act(async () => { tree = create(React.createElement(Host)); });
  expect(usePushNavigation.getState().pending).toBeNull();
});

it("retries registration on foreground and disposes OS listeners when signing out", async () => {
  await act(async () => { tree = create(React.createElement(Host)); });
  await act(async () => { mocks.foreground?.("active"); });
  expect(mocks.register).toHaveBeenCalledTimes(2);
  mocks.userId = null;
  await act(async () => { tree!.update(React.createElement(Host)); });
  expect(mocks.removed).toHaveBeenCalledTimes(1);
  await act(async () => { mocks.response?.(tap(1, "late-tap")); });
  expect(usePushNavigation.getState().pending).toBeNull();
});

it("does not route a push into a role the current account no longer has", async () => {
  mocks.roles = ["Owner"]; mocks.initial = tap(1);
  await act(async () => { tree = create(React.createElement(Host)); });
  expect(usePushNavigation.getState().pending).toBeNull();
});

it("presents a real booking event as an OS notification once while the app is open", async () => {
  await act(async () => { tree = create(React.createElement(Host)); });
  const item = { id: 902, type: "Booking", title: "Đơn thuê đã duyệt", body: "Bạn có thể đặt cọc", channel: "InApp", isRead: false, createdAt: "2026-10-24T01:00:00Z", dataJson: '{"bookingId":42,"roleTarget":"customer"}' };
  receiveNotification(item, 1); receiveNotification(item, 1);
  expect(mocks.schedule).toHaveBeenCalledOnce();
  expect(mocks.schedule).toHaveBeenCalledWith(expect.objectContaining({ content: expect.objectContaining({ title: item.title, sound: "default", data: expect.objectContaining({ localBooking: true, userId: "1" }) }), trigger: { channelId: "bookings-demo" } }));
  expect(useToastStore.getState().toasts).toHaveLength(0);
});

it("falls back to the existing toast if the OS cannot display the notification", async () => {
  mocks.schedule.mockRejectedValue(new Error("Permission revoked"));
  await act(async () => { tree = create(React.createElement(Host)); });
  receiveNotification({ id: 903, type: "Booking", title: "Biên bản mới", body: "Kiểm tra biên bản", channel: "InApp", isRead: false, createdAt: "2026-10-24T01:00:00Z" }, 1);
  await act(async () => {});
  expect(useToastStore.getState().toasts[0]?.title).toBe("Biên bản mới");
});
