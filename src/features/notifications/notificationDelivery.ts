import type { NotificationItem } from "./types";
import { useNotificationStore } from "./useNotifications";
import { showToast } from "./toastStore";
import { presentBookingSystemNotification } from "./bookingSystemNotifications";

// Shared by SignalR and polling: a replay must never display a second banner.
export function receiveNotification(item: NotificationItem, unreadCount: number) {
  const state = useNotificationStore.getState();
  if (state.userId === null || !["InApp", "Both"].includes(item.channel)) return;
  const known = state.items.some(entry => entry.id === item.id) || Boolean(state.updates[item.id]);
  state.prependNotification(item, unreadCount);
  if (!known && !item.isRead) {
    const toast = () => showToast({
      type: "info", title: item.title, message: item.body,
      onPress: () => useNotificationStore.setState({ centerOpen: true }),
    });
    if (!presentBookingSystemNotification(item, state.userId, toast)) toast();
  }
}
