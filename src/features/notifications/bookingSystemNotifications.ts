import type { NotificationItem } from "./types";
import { notificationCategory } from "./notificationPresentation";
import { useNotificationStore } from "./useNotifications";

type Presenter = (item: NotificationItem) => Promise<unknown>;
let active: { userId: number; present: Presenter } | null = null;

export function setBookingSystemPresenter(userId: number, present: Presenter) {
  const current = { userId, present };
  active = current;
  return () => { if (active === current) active = null; };
}

// Native behavior is supplied by the session hook; web and denied permissions use the toast.
export function presentBookingSystemNotification(item: NotificationItem, userId: number, fallback: () => void) {
  if (!active || active.userId !== userId || notificationCategory(item.type).icon !== "booking") return false;
  const epoch = useNotificationStore.getState().epoch;
  void active.present(item).catch(() => {
    const current = useNotificationStore.getState();
    if (current.userId === userId && current.epoch === epoch) fallback();
  });
  return true;
}
