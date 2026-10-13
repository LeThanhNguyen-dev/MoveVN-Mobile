import { useEffect } from "react";
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
    const sync = () => {
      if (disposed || AppState.currentState === "background" || AppState.currentState === "inactive") return;
      void startNotificationConnection().catch(() => undefined);
      void refreshNotificationCount();
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
      void stopNotificationConnection().catch(() => undefined);
    };
  }, [authenticated, userId]);
}
