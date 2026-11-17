import type { NotificationItem } from "./types";
import { useNotificationStore } from "./useNotifications";

// Keep the existing native channel ID; both local and remote notifications use it.
export const NOTIFICATION_CHANNEL_ID = "bookings";

const presented = new Map<string, number>();
const retentionMs = 15 * 60_000;

export function claimSystemNotification(userId: number, notificationId: number) {
  const now = Date.now();
  for (const [key, at] of presented) if (now - at > retentionMs) presented.delete(key);
  const key = `${userId}:${notificationId}`;
  if (presented.has(key)) return false;
  if (presented.size >= 256) presented.delete(presented.keys().next().value!);
  presented.set(key, now);
  return true;
}

export function releaseSystemNotification(userId: number, notificationId: number) {
  presented.delete(`${userId}:${notificationId}`);
}

export function resetSystemNotifications() { presented.clear(); }

export function notificationRecipient(data: Record<string, unknown>) {
  const userId = typeof data.userId === "number" || typeof data.userId === "string" ? Number(data.userId) : NaN;
  const notificationId = typeof data.notificationId === "number" || typeof data.notificationId === "string" ? Number(data.notificationId) : NaN;
  return Number.isSafeInteger(userId) && userId > 0 && Number.isSafeInteger(notificationId) && notificationId > 0
    ? { userId, notificationId } : null;
}
type Presenter = (item: NotificationItem) => Promise<unknown>;
let active: { userId: number; present: Presenter } | null = null;

export function setSystemNotificationPresenter(userId: number, present: Presenter) {
  const current = { userId, present };
  active = current;
  return () => { if (active === current) active = null; };
}

// Shared by realtime/polling. Native banners fall back to a toast if scheduling fails.
export function presentSystemNotification(item: NotificationItem, userId: number, fallback: () => void) {
  if (!active || active.userId !== userId) return false;
  if (!claimSystemNotification(userId, item.id)) return true;
  const epoch = useNotificationStore.getState().epoch;
  void active.present(item).catch(() => {
    releaseSystemNotification(userId, item.id);
    const current = useNotificationStore.getState();
    if (current.userId === userId && current.epoch === epoch) fallback();
  });
  return true;
}
