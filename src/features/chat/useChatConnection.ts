import { useEffect } from "react";
import { AppState } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import {
  startChatConnection,
  stopChatConnection,
  syncChatAfterReconnect,
} from "./chatConnection";
import { useChatStore } from "./useChat";

export function useChatConnection() {
  const userId = useAuthStore((state) =>
    state.token?.accessToken ? state.user?.userId : null,
  );
  const supported = useAuthStore((state) =>
    Boolean(
      state.user?.roles.some((role) => role === "Customer" || role === "Owner"),
    ),
  );
  useEffect(() => {
    const activeUser = supported ? (userId ?? null) : null;
    useChatStore.getState().activate(activeUser);
    if (!activeUser) {
      void stopChatConnection().catch(() => undefined);
      return;
    }
    let disposed = false;
    const sync = () => {
      if (
        disposed ||
        AppState.currentState === "background" ||
        AppState.currentState === "inactive"
      )
        return;
      useChatStore.setState({ foreground: true });
      void startChatConnection().catch(() => undefined);
      // Also reconcile history/unread counts if realtime has not recovered.
      void syncChatAfterReconnect();
    };
    sync();
    const timer = setInterval(sync, 30_000);
    const listener = AppState.addEventListener("change", (state) => {
      useChatStore.setState({ foreground: state === "active" });
      if (state === "active") sync();
      else if (state === "background")
        void stopChatConnection().catch(() => undefined);
    });
    return () => {
      disposed = true;
      clearInterval(timer);
      listener.remove();
      useChatStore.getState().activate(null);
      void stopChatConnection().catch(() => undefined);
    };
  }, [userId, supported]);
}
