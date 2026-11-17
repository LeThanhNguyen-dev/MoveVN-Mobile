import { useEffect } from "react";
import { AppState, Platform } from "react-native";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { loadLocalNotifications, loadPushNotifications, prepareLocalNotifications, registerPushDevice } from "./pushRegistration";
import { pushBookingTarget, usePushNavigation } from "./pushNavigation";
import { useNotificationStore } from "./useNotifications";
import { refreshNotificationCount } from "./notificationActions";
import { notificationRecipient, NOTIFICATION_CHANNEL_ID, resetSystemNotifications, setSystemNotificationPresenter } from "./systemNotificationPresentation";

export function usePushNotifications() {
  const userId = useAuthStore(state => state.user?.userId);
  const authenticated = useAuthStore(state => Boolean(state.token?.accessToken));

  useEffect(() => {
    if (!authenticated || !userId) { usePushNavigation.getState().clear(); resetSystemNotifications(); return; }
    let disposed = false;
    let lastResponse = "";
    let cleanup = () => {};
    let cleanupToken = () => {};
    let clearPresenter = () => {};
    const report = (error: unknown) => {
      if (__DEV__) console.warn("Chưa bật được thông báo hệ thống; sẽ thử lại khi mở app.", error instanceof Error ? error.message : "NotificationError");
    };
    const sync = () => {
      void registerPushDevice().catch(report);
      void prepareLocalNotifications().then(notifications => {
        if (disposed) return;
        clearPresenter();
        if (!notifications) return;
        clearPresenter = setSystemNotificationPresenter(userId, async item => {
          if (disposed || useAuthStore.getState().user?.userId !== userId) return;
          await notifications.scheduleNotificationAsync({
            identifier: `notification-${userId}-${item.id}`,
            content: { title: item.title, body: item.body, sound: "default",
              data: { localNotification: true, notificationId: item.id, userId: String(userId), dataJson: item.dataJson },
            },
            trigger: Platform.OS === "android" ? { channelId: NOTIFICATION_CHANNEL_ID } : null,
          });
        });
      }).catch(report);
    };
    sync();
    void loadPushNotifications().then(notifications => {
      if (!notifications || disposed) return;
      const subscription = notifications.addPushTokenListener(() => { if (!disposed) void registerPushDevice().catch(report); });
      cleanupToken = () => subscription.remove();
    }).catch(report);
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
        const recipient = notificationRecipient(request.content.data ?? {});
        const currentUser = useAuthStore.getState().user;
        if (pending?.userId === userId && currentUser?.userId === userId && currentUser.roles.includes(pending.roleTarget)) {
          useNotificationStore.setState({ centerOpen: false });
          usePushNavigation.setState({ pending });
        } else if (!pending && recipient?.userId === userId && currentUser?.userId === userId) {
          // Support, disputes, payments, availability, broadcasts and future types use the authenticated inbox.
          useNotificationStore.setState({ centerOpen: true, selectedNotificationId: recipient.notificationId });
        }
        void notifications.clearLastNotificationResponseAsync().catch(report);
      };
      const response = notifications.addNotificationResponseReceivedListener(handle);
      const received = notifications.addNotificationReceivedListener(notification => {
        if (!disposed && notificationRecipient(notification.request.content.data ?? {})?.userId === userId) void refreshNotificationCount();
      });
      cleanup = () => { response.remove(); received.remove(); };
      const initial = await notifications.getLastNotificationResponseAsync();
      if (initial) handle(initial);
    }).catch(report);
    return () => { disposed = true; clearPresenter(); appState.remove(); clearInterval(retry); cleanup(); cleanupToken(); resetSystemNotifications(); };
  }, [authenticated, userId]);
}
