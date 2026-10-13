import { useEffect } from "react";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { startNotificationConnection, stopNotificationConnection } from "@/features/notifications/notificationConnection";
import { getNotificationUnreadCount } from "@/features/notifications/services/notificationService";
import { useNotificationStore } from "@/features/notifications/useNotifications";

export function useNotificationConnection() {
  const token = useAuthStore((state) => state.token?.accessToken);
  const userId = useAuthStore((state) => state.user?.userId);

  useEffect(() => {
    if (!token || !userId) {
      void stopNotificationConnection().catch(() => undefined);
      return;
    }

    // Nạp số chưa đọc hiện tại rồi mới mở socket realtime.
    getNotificationUnreadCount()
      .then((res) => useNotificationStore.getState().setUnreadCount(res.unreadCount))
      .catch(() => undefined);
    void startNotificationConnection().catch(() => undefined);
  }, [token, userId]);
}
