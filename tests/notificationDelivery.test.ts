import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { receiveNotification } from "@/features/notifications/notificationDelivery";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import { useToastStore } from "@/features/notifications/toastStore";
import type { NotificationItem } from "@/features/notifications/types";

const item = { id: 7, title: "Biên bản mới", body: "Kiểm tra biên bản", channel: "InApp", isRead: false, type: "CheckInReportCreated", createdAt: "2026-10-20T01:00:00Z" } as NotificationItem;
beforeEach(() => { vi.useFakeTimers(); useNotificationStore.getState().reset(); useNotificationStore.getState().activate(42); useToastStore.getState().clearToasts(); });
afterEach(() => vi.useRealTimers());

it("shows one banner across realtime delivery, polling and reconnect replay", () => {
  receiveNotification(item, 1);
  receiveNotification(item, 1);
  expect(useToastStore.getState().toasts).toHaveLength(1);
  expect(useNotificationStore.getState().items).toHaveLength(1);
  useToastStore.getState().toasts[0]!.onPress?.();
  expect(useNotificationStore.getState().centerOpen).toBe(true);
  vi.advanceTimersByTime(4200);
  expect(useToastStore.getState().toasts).toHaveLength(0);
  receiveNotification(item, 1);
  expect(useToastStore.getState().toasts).toHaveLength(0);
});

it("ignores email-only, read notifications and deliveries after logout", () => {
  receiveNotification({ ...item, channel: "Email" }, 1);
  receiveNotification({ ...item, id: 8, isRead: true }, 0);
  useNotificationStore.getState().activate(null);
  receiveNotification(item, 1);
  expect(useToastStore.getState().toasts).toHaveLength(0);
});

it("shows incoming updates for an owner account as well as a customer", () => {
  useNotificationStore.getState().activate(91);
  receiveNotification({ ...item, type: "BookingCheckedOut", channel: "Both" }, 2);
  expect(useToastStore.getState().toasts[0]?.title).toBe(item.title);
  expect(useNotificationStore.getState().unreadCount).toBe(2);
});
