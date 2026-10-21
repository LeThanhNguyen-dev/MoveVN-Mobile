import { useEffect } from "react";
import { getNotifications } from "./services/notificationService";
import { receiveNotification } from "./notificationDelivery";
import { useToastStore } from "./toastStore";
import { AppState } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { startNotificationConnection, stopNotificationConnection } from "@/features/notifications/notificationConnection";
import { useNotificationStore } from "./useNotifications";
import { loadNotificationPage, refreshNotificationCount } from "./notificationActions";

export function useNotificationConnection() {
  const authenticated = useAuthStore((state) => Boolean(state.token?.accessToken));
  const userId = useAuthStore((state) => state.user?.userId);

  useEffect(() => {
    useNotificationStore.getState().activate(authenticated && userId ? userId : null);
    if (!authenticated || !userId) {
      void stopNotificationConnection().catch(() => undefined);
      return;
    }
    let disposed = false;
    let watermark: number | null = null;
    let polling = false;
    const poll = async () => {
      if (polling) return;
      polling = true;
      const epoch = useNotificationStore.getState().epoch;
      try {
        const page = await getNotifications({ page: 1, pageSize: 50 });
        if (disposed || useNotificationStore.getState().epoch !== epoch) return;
        const latest = Math.max(0, ...page.items.map(item => item.id));
        // First fetch establishes a baseline so signing in does not replay old alerts.
        if (watermark !== null) {
          for (const item of [...page.items].sort((a, b) => a.id - b.id)) {
            if (item.id > watermark) receiveNotification(item, useNotificationStore.getState().unreadCount);
          }
        }
        watermark = Math.max(watermark ?? 0, latest);
      } catch { /* The next foreground sync retries the fallback. */ }
      finally { polling = false; }
    };
    const sync = () => {
      if (disposed || AppState.currentState === "background" || AppState.currentState === "inactive") return;
      void startNotificationConnection().catch(() => undefined);
      void poll().then(() => { if (!disposed) void refreshNotificationCount(); });
      if (useNotificationStore.getState().centerOpen) void loadNotificationPage();
    };
    sync();
    // Automatic reconnect does not retry a failed initial start; retry in the
    // foreground and poll as a fallback when the realtime connection is down.
    const timer = setInterval(sync, 30_000);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") sync();
      else if (state === "background") void stopNotificationConnection().catch(() => undefined);
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      subscription.remove();
      useNotificationStore.getState().reset();
      useToastStore.getState().clearToasts();
      void stopNotificationConnection().catch(() => undefined);
    };
  }, [authenticated, userId]);
}
