import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { startPresenceConnection, stopPresenceConnection } from "@/features/presence/presenceConnection";

export function usePresenceConnection() {
  const token = useAuthStore((state) => state.token?.accessToken);
  const userId = useAuthStore((state) => state.user?.userId);

  useEffect(() => {
    let disposed = false;
    let connecting = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (disposed || connecting || AppState.currentState === "background" || AppState.currentState === "inactive") return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      connecting = true;
      void startPresenceConnection()
        .catch((error: unknown) => {
          if (disposed) return;
          console.warn("Presence connection failed; retrying.", error);
          retryTimer = setTimeout(connect, 5_000);
        })
        .finally(() => { connecting = false; });
    };

    if (!token || !userId) {
      void stopPresenceConnection().catch(() => undefined);
      return;
    }

    connect();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") connect();
    });

    return () => {
      disposed = true;
      subscription.remove();
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [token, userId]);
}
