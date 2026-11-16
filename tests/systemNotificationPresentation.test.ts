import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { claimSystemNotification, notificationRecipient, releaseSystemNotification, resetSystemNotifications } from "@/features/notifications/systemNotificationPresentation";

beforeEach(() => { vi.useFakeTimers(); resetSystemNotifications(); });
afterEach(() => { vi.useRealTimers(); resetSystemNotifications(); });

it("deduplicates the same notification across local and remote transport per account", () => {
  expect(claimSystemNotification(1, 42)).toBe(true);
  expect(claimSystemNotification(1, 42)).toBe(false);
  expect(claimSystemNotification(2, 42)).toBe(true);
  releaseSystemNotification(1, 42);
  expect(claimSystemNotification(1, 42)).toBe(true);
});

it("expires presentation entries and clears them for a new session", () => {
  claimSystemNotification(1, 42);
  vi.advanceTimersByTime(16 * 60_000);
  expect(claimSystemNotification(1, 42)).toBe(true);
  resetSystemNotifications();
  expect(claimSystemNotification(1, 42)).toBe(true);
});

it.each([{}, { userId: true, notificationId: 1 }, { userId: 0, notificationId: 1 }, { userId: 1, notificationId: -1 }, { userId: 1, notificationId: 1.5 }])("rejects malformed recipient identity: %j", data => {
  expect(notificationRecipient(data)).toBeNull();
});

it("accepts numeric IDs sent by Expo and IDs stored as strings", () => {
  expect(notificationRecipient({ userId: "12", notificationId: 42 })).toEqual({ userId: 12, notificationId: 42 });
});
