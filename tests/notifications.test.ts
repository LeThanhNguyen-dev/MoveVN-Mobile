import { beforeEach, expect, it, vi } from "vitest";
import type { NotificationItem } from "@/features/notifications/types";

const mocks = vi.hoisted(() => ({
  userId: 1 as number | null, generation: 0,
  list: vi.fn(), count: vi.fn(), read: vi.fn(), readAll: vi.fn(),
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () => mocks.userId ? { userId: mocks.userId } : null,
  getToken: () => mocks.userId ? "test-token" : null,
  getSessionGeneration: () => mocks.generation,
}));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock("@/features/notifications/services/notificationService", () => ({
  getNotifications: mocks.list, getNotificationUnreadCount: mocks.count,
  markNotificationAsRead: mocks.read, markAllNotificationsAsRead: mocks.readAll,
}));

import { useNotificationStore as store } from "@/features/notifications/useNotifications";
import { loadNotificationPage, readAllNotifications, readNotification, refreshNotificationCount } from "@/features/notifications/notificationActions";
import { formatNotificationDate, notificationCategory, notificationReference } from "@/features/notifications/notificationPresentation";

const item = (id: number, isRead = false): NotificationItem => ({
  id, type: "BookingApproved", title: `Booking ${id}`, body: "Thông tin chuyến đi", channel: "InApp", isRead,
  createdAt: new Date(Date.UTC(2026, 9, 13, 0, id)).toISOString(), readAt: isRead ? "2026-10-13T10:00:00Z" : null,
});
const page = (items: NotificationItem[], number = 1, totalPages = 1) => ({ items, page: number, pageSize: 20, totalPages, totalCount: totalPages * 20 });
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId = 1; mocks.generation = 0;
  store.getState().reset(); store.getState().activate(1);
  mocks.count.mockResolvedValue({ unreadCount: 2 });
  mocks.list.mockResolvedValue(page([item(2), item(1)]));
  mocks.read.mockImplementation(async (id: number) => item(id, true));
  mocks.readAll.mockResolvedValue({ updatedCount: 2 });
});

it("loads more than ten notifications, appends pages without duplicates and keeps newest first", async () => {
  mocks.list.mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, index) => item(40 - index)), 1, 2));
  await loadNotificationPage();
  mocks.list.mockResolvedValueOnce(page([item(21), ...Array.from({ length: 19 }, (_, index) => item(20 - index))], 2, 2));
  await loadNotificationPage({ more: true });
  expect(store.getState().items).toHaveLength(39);
  expect(store.getState().items[0]?.id).toBe(40);
  expect(store.getState().page).toBe(2);
  await loadNotificationPage({ more: true });
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it("keeps the unread filter when a slower all-notifications response arrives later", async () => {
  const old = deferred<ReturnType<typeof page>>();
  mocks.list.mockReturnValueOnce(old.promise).mockResolvedValueOnce(page([item(3)]));
  const first = loadNotificationPage();
  await loadNotificationPage({ filter: "unread" });
  old.resolve(page([item(1, true)])); await first;
  expect(store.getState().filter).toBe("unread");
  expect(store.getState().items.map((entry) => entry.id)).toEqual([3]);
  expect(mocks.list).toHaveBeenLastCalledWith({ page: 1, pageSize: 20, unreadOnly: true });
});

it("discards responses belonging to a logged-out account before the effect resets the store", async () => {
  const pending = deferred<ReturnType<typeof page>>();
  mocks.list.mockReturnValueOnce(pending.promise);
  const request = loadNotificationPage();
  mocks.userId = null; mocks.generation++;
  pending.resolve(page([item(1)])); await request;
  expect(store.getState().items).toEqual([]);
  store.getState().activate(null);
  expect(store.getState().unreadCount).toBe(0);
});

it("does not leak an old request after switching accounts and then returning to the first", async () => {
  const pending = deferred<ReturnType<typeof page>>();
  mocks.list.mockReturnValueOnce(pending.promise);
  const request = loadNotificationPage();
  mocks.userId = 2; store.getState().activate(2);
  mocks.userId = 1; mocks.generation++; store.getState().activate(1);
  pending.resolve(page([item(1)])); await request;
  expect(store.getState().items).toEqual([]);
  expect(store.getState().loading).toBe(false);
});

it("keeps a realtime notification received while the first page is loading", async () => {
  const pending = deferred<ReturnType<typeof page>>();
  mocks.list.mockReturnValueOnce(pending.promise);
  const request = loadNotificationPage();
  store.getState().prependNotification(item(9), 3);
  pending.resolve(page([item(2), item(1)])); await request;
  expect(store.getState().items.map((entry) => entry.id)).toEqual([9, 2, 1]);
});

it("deduplicates replayed notifications without truncating previously loaded history", async () => {
  mocks.list.mockResolvedValueOnce(page(Array.from({ length: 20 }, (_, index) => item(index + 1))));
  await loadNotificationPage();
  store.getState().prependNotification(item(30), 3);
  store.getState().prependNotification(item(30), 3);
  expect(store.getState().items).toHaveLength(21);
  expect(store.getState().items.filter((entry) => entry.id === 30)).toHaveLength(1);
});

it("ignores email-only realtime payloads", () => {
  store.getState().prependNotification({ ...item(1), channel: "Email" }, 9);
  expect(store.getState().items).toEqual([]);
  expect(store.getState().unreadCount).toBe(0);
});

it("does not overwrite a newer SignalR unread count with a stale HTTP response", async () => {
  const pending = deferred<{ unreadCount: number }>();
  mocks.count.mockReturnValueOnce(pending.promise);
  const request = refreshNotificationCount();
  store.getState().setUnreadCount(8);
  pending.resolve({ unreadCount: 2 }); await request;
  expect(store.getState().unreadCount).toBe(8);
});

it("marks an item read without double-decrementing a count that SignalR already updated", async () => {
  await loadNotificationPage();
  const pending = deferred<NotificationItem>();
  mocks.read.mockReturnValueOnce(pending.promise);
  const request = readNotification(2);
  store.getState().setUnreadCount(1);
  mocks.count.mockResolvedValue({ unreadCount: 1 });
  pending.resolve(item(2, true)); await request;
  expect(store.getState().items.find((entry) => entry.id === 2)?.isRead).toBe(true);
  expect(store.getState().unreadCount).toBe(1);
  await readNotification(2);
  expect(mocks.read).toHaveBeenCalledTimes(1);
});

it("preserves unread state when marking read fails and permits retry", async () => {
  await loadNotificationPage();
  mocks.read.mockRejectedValueOnce(new Error("offline"));
  await expect(readNotification(1)).rejects.toThrow("offline");
  expect(store.getState().items.find((entry) => entry.id === 1)?.isRead).toBe(false);
  expect(store.getState().unreadCount).toBe(2);
  expect(store.getState().pendingIds).toEqual([]);
  expect(await readNotification(1)).toBe(true);
});

it("removes a read item from the unread list but retains its full detail", async () => {
  await loadNotificationPage({ filter: "unread" });
  await readNotification(2);
  expect(store.getState().items.map((entry) => entry.id)).toEqual([1]);
  expect(store.getState().updates[2]?.item.isRead).toBe(true);
});

it("does not restore an unread status from a list response racing a successful mark-read", async () => {
  await loadNotificationPage();
  const pending = deferred<ReturnType<typeof page>>();
  mocks.list.mockReturnValueOnce(pending.promise);
  const refresh = loadNotificationPage();
  await readNotification(1);
  pending.resolve(page([item(1)])); await refresh;
  expect(store.getState().items[0]?.isRead).toBe(true);
});

it("accepts a read performed on another device even if the item was first received via SignalR", async () => {
  store.getState().prependNotification(item(1), 1);
  mocks.list.mockResolvedValueOnce(page([item(1, true)]));
  await loadNotificationPage();
  expect(store.getState().items[0]?.isRead).toBe(true);
});

it("preserves a notification arriving during mark-all and rechecks the count", async () => {
  await loadNotificationPage();
  const pending = deferred<{ updatedCount: number }>();
  mocks.readAll.mockReturnValueOnce(pending.promise);
  const request = readAllNotifications();
  store.getState().prependNotification(item(9), 1);
  mocks.list.mockResolvedValueOnce(page([item(9), item(2, true), item(1, true)]));
  mocks.count.mockResolvedValue({ unreadCount: 1 });
  pending.resolve({ updatedCount: 2 }); await request;
  expect(store.getState().items.find((entry) => entry.id === 9)?.isRead).toBe(false);
  expect(store.getState().items.filter((entry) => entry.id !== 9).every((entry) => entry.isRead)).toBe(true);
  expect(store.getState().unreadCount).toBe(1);
  expect(store.getState().markingAll).toBe(false);
});

it("leaves existing notifications unread when mark-all fails", async () => {
  await loadNotificationPage();
  mocks.readAll.mockRejectedValueOnce(new Error("offline"));
  await expect(readAllNotifications()).rejects.toThrow("offline");
  expect(store.getState().items.every((entry) => !entry.isRead)).toBe(true);
  expect(store.getState().markingAll).toBe(false);
});

it("keeps the current page on a load-more error and retries the same next page", async () => {
  mocks.list.mockResolvedValueOnce(page([item(3)], 1, 2));
  await loadNotificationPage();
  mocks.list.mockRejectedValueOnce(new Error("offline"));
  await loadNotificationPage({ more: true });
  expect(store.getState().page).toBe(1);
  expect(store.getState().items).toHaveLength(1);
  expect(store.getState().error).toContain("Không thể tải");
  mocks.list.mockResolvedValueOnce(page([item(2)], 2, 2));
  await loadNotificationPage({ more: true });
  expect(mocks.list).toHaveBeenLastCalledWith({ page: 2, pageSize: 20, unreadOnly: undefined });
  expect(store.getState().error).toBeNull();
});

it("retains the last unread count and shows an error when synchronizing it fails", async () => {
  store.getState().setUnreadCount(7);
  mocks.count.mockRejectedValueOnce(new Error("offline"));
  await refreshNotificationCount();
  expect(store.getState().unreadCount).toBe(7);
  expect(store.getState().countError).toBe(true);
});

it("handles unknown notification types and malformed metadata safely", () => {
  expect(notificationCategory("SupportSlaReminder").label).toBe("Hỗ trợ");
  expect(notificationCategory("FutureEvent").label).toBe("Hệ thống");
  expect(notificationReference("not json")).toBeNull();
  expect(notificationReference("null")).toBeNull();
  expect(notificationReference('{"ticketNumber":"TK001","targetPath":"https://evil.example"}')).toBe("Mã hỗ trợ: TK001");
  expect(formatNotificationDate("invalid")).toBe("Chưa có thời gian");
});
