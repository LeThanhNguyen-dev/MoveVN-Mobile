import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({
  userId: 1 as number | null, list: vi.fn(), start: vi.fn(), stop: vi.fn(),
}));
vi.mock("react-native", () => ({ AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) } }));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  useAuthStore: (select: (state: unknown) => unknown) => select({
    token: mocks.userId ? { accessToken: "token" } : null,
    user: mocks.userId ? { userId: mocks.userId } : null,
  }),
}));
vi.mock("@/features/notifications/services/notificationService", () => ({ getNotifications: mocks.list }));
vi.mock("@/features/notifications/notificationConnection", () => ({ startNotificationConnection: mocks.start, stopNotificationConnection: mocks.stop }));
vi.mock("@/features/notifications/notificationActions", () => ({ refreshNotificationCount: vi.fn(), loadNotificationPage: vi.fn() }));
import { useNotificationConnection } from "@/features/notifications/useNotificationConnection";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import { useToastStore } from "@/features/notifications/toastStore";
import { receiveNotification } from "@/features/notifications/notificationDelivery";

const item = (id: number) => ({ id, title: "Update " + id, body: "Booking update", channel: "InApp", isRead: false, createdAt: "2026-10-20T01:00:00Z", type: "BookingCheckedOut" });
const page = (id: number) => ({ items: [item(id)], page: 1, totalPages: 1, totalCount: 1 });
function Host() { useNotificationConnection(); return null; }
let tree: ReactTestRenderer | undefined;
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mocks.userId = 1;
  mocks.list.mockReset(); mocks.start.mockResolvedValue(undefined); mocks.stop.mockResolvedValue(undefined);
  useNotificationStore.getState().reset(); useToastStore.getState().clearToasts();
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.useRealTimers(); });

it("does not replay historical alerts but displays newly polled updates while realtime is unavailable", async () => {
  mocks.list.mockResolvedValueOnce(page(10)).mockResolvedValueOnce(page(11));
  await act(async () => { tree = create(React.createElement(Host)); });
  expect(useToastStore.getState().toasts).toHaveLength(0);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(useToastStore.getState().toasts.map(t => t.title)).toEqual(["Update 11"]);
});

it("does not display a second banner when polling catches a realtime update", async () => {
  mocks.list.mockResolvedValueOnce(page(10)).mockResolvedValueOnce(page(11));
  await act(async () => { tree = create(React.createElement(Host)); });
  receiveNotification(item(11), 1);
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(useToastStore.getState().toasts).toHaveLength(0);
  expect(useNotificationStore.getState().items).toHaveLength(1);
});

it("ignores an old account's in-flight poll after switching accounts", async () => {
  mocks.list.mockResolvedValueOnce(page(10));
  await act(async () => { tree = create(React.createElement(Host)); });
  let resolve!: (value: ReturnType<typeof page>) => void;
  mocks.list.mockImplementationOnce(() => new Promise(res => { resolve = res; }));
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  mocks.userId = 2; mocks.list.mockResolvedValueOnce(page(30));
  await act(async () => { tree!.update(React.createElement(Host)); });
  await act(async () => { resolve(page(11)); });
  expect(useNotificationStore.getState().userId).toBe(2);
  expect(useNotificationStore.getState().items).toHaveLength(0);
  expect(useToastStore.getState().toasts).toHaveLength(0);
});
