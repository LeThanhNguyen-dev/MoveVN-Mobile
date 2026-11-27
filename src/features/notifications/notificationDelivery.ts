import i18n from "@/i18n";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import type { NotificationItem } from "./types";
import { useNotificationStore } from "./useNotifications";
import { showToast, type ToastType } from "./toastStore";
import { presentSystemNotification } from "./systemNotificationPresentation";
import { usePushNavigation } from "./pushNavigation";
import { parseBookingTarget } from "./utils/target";

function bookingTone(action: string): ToastType {
  const text = action.toLowerCase();
  if (/reject|cancel/.test(text)) return "error";
  if (/approve|confirm|deposit|completed|compensated/.test(text)) return "success";
  return "info";
}

function currentUserRole(): "Owner" | "Customer" | null {
  const roles = useAuthStore.getState().user?.roles ?? [];
  if (roles.includes("Customer")) return "Customer";
  if (roles.includes("Owner")) return "Owner";
  return null;
}

function openBooking(bookingId: number, roleTarget: string, notificationId: number) {
  const user = useAuthStore.getState().user;
  const role: "Owner" | "Customer" | null = roleTarget.toLowerCase() === "owner" ? "Owner"
    : roleTarget.toLowerCase() === "customer" ? "Customer" : null;
  if (!user || !role || !user.roles.includes(role)) {
    useNotificationStore.setState({ centerOpen: true });
    return;
  }
  usePushNavigation.setState({
    pending: {
      bookingId,
      roleTarget: role,
      userId: user.userId,
      requestId: `booking-toast-${notificationId}-${Date.now()}`,
    },
  });
}

// Shared by SignalR and polling: a replay must never display a second banner.
export function receiveNotification(item: NotificationItem, unreadCount: number) {
  const state = useNotificationStore.getState();
  if (state.userId === null || !["InApp", "Both"].includes(item.channel)) return;
  const known = state.items.some(entry => entry.id === item.id) || Boolean(state.updates[item.id]);
  state.prependNotification(item, unreadCount);
  if (!known && !item.isRead) {
    // Owner yêu cầu bật GPS: banner hệ thống tự ẩn sau vài giây nên dễ lỡ tay.
    // Hiện toast trong app đủ lâu để đọc và bấm thẳng vào chuyến.
    const gpsRequest = item.type === "GPS" ? parseBookingTarget(item.dataJson) : null;
    if (gpsRequest) {
      showToast({
        type: "info",
        title: item.title,
        message: item.body,
        actionLabel: i18n.t("common:notifications.openTrip"),
        durationMs: 10_000,
        onPress: () => openBooking(gpsRequest.bookingId, currentUserRole() ?? "", item.id),
      });
      return;
    }
    const target = item.type === "Booking" ? parseBookingTarget(item.dataJson) : null;
    const toast = target
      ? () => showToast({
        type: bookingTone(target.action),
        title: item.title,
        message: item.body,
        actionLabel: i18n.t("common:notifications.viewBooking"),
        durationMs: 6000,
        onPress: () => openBooking(target.bookingId, target.roleTarget, item.id),
      })
      : () => showToast({
        type: "info",
        title: item.title,
        message: item.body,
        onPress: () => useNotificationStore.setState({ centerOpen: true }),
      });
    if (!presentSystemNotification(item, state.userId, toast)) toast();
  }
}
