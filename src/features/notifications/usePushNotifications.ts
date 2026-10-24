import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { loadLocalNotifications, prepareLocalNotifications, registerPushDevice } from "./pushRegistration";
import { setBookingSystemPresenter } from "./bookingSystemNotifications";
import { pushBookingTarget, usePushNavigation } from "./pushNavigation";
import { useNotificationStore } from "./useNotifications";

export function usePushNotifications() {
  const userId = useAuthStore(state => state.user?.userId);
  const authenticated = useAuthStore(state => Boolean(state.token?.accessToken));

  useEffect(() => {
    if (!authenticated || !userId) { usePushNavigation.getState().clear(); return; }
    let disposed = false;
    let lastResponse = "";
    let cleanup = () => {};
    let clearPresenter = () => {};
    const report = (error: unknown) => {
      if (__DEV__) console.warn("Chưa bật được thông báo hệ thống; sẽ thử lại khi mở app.", error instanceof Error ? error.name : "NotificationError");
    };
    const sync = () => {
      void registerPushDevice().catch(report);
      void prepareLocalNotifications().then(notifications => {
        if (disposed) return;
        clearPresenter();
        if (!notifications) return;
        clearPresenter = setBookingSystemPresenter(userId, async item => {
          if (disposed || useAuthStore.getState().user?.userId !== userId) return;
          await notifications.scheduleNotificationAsync({
            identifier: `booking-${userId}-${item.id}`,
            content: { title: item.title, body: item.body, sound: "default",
              data: { localBooking: true, notificationId: item.id, userId: String(userId), dataJson: item.dataJson },
            },
            trigger: Platform.OS === "android" ? { channelId: "bookings-demo" } : null,
          });
        });
      }).catch(report);
    };
    sync();
    const appState = AppState.addEventListener("change", state => { if (state === "active") sync(); });
    // Retry registration if the initial attempt was offline.
    const retry = setInterval(() => { if (AppState.currentState === "active") sync(); }, 5 * 60_000);
    void loadLocalNotifications().then(async notifications => {
      if (!notifications || disposed) return;
      const handle = (response: import("expo-notifications").NotificationResponse) => {
        if (disposed || response.actionIdentifier !== notifications.DEFAULT_ACTION_IDENTIFIER) return;
        const request = response.notification.request;
        if (lastResponse === request.identifier) return;
        lastResponse = request.identifier;
        const pending = pushBookingTarget(request.content.data ?? {}, request.identifier);
        const currentUser = useAuthStore.getState().user;
        if (pending?.userId === userId && currentUser?.userId === userId && currentUser.roles.includes(pending.roleTarget)) {
          useNotificationStore.setState({ centerOpen: false });
          usePushNavigation.setState({ pending });
        }
        void notifications.clearLastNotificationResponseAsync().catch(report);
      };
      const response = notifications.addNotificationResponseReceivedListener(handle);
      cleanup = () => { response.remove(); };
      const initial = await notifications.getLastNotificationResponseAsync();
      if (initial) handle(initial);
    }).catch(report);
    return () => { disposed = true; clearPresenter(); appState.remove(); clearInterval(retry); cleanup(); };
  }, [authenticated, userId]);
}
