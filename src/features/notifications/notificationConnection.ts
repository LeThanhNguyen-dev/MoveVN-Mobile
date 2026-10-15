import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { getAuthUser, getSessionGeneration, getToken } from "@/features/auth/hooks/useAuth";
import { getHubAccessToken, startHubWithAuthRecovery } from "@/services/hubStart";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import type { NotificationCreatedPayload, NotificationUnreadCountPayload } from "@/features/notifications/types";
import { getApiBaseUrl } from "@/services/apiClient";
import { loadNotificationPage, refreshNotificationCount } from "./notificationActions";

let connection: HubConnection | null = null;
let connectionUserId: number | null = null;
let connectionGeneration = -1;
let operations: Promise<void> = Promise.resolve();

function enqueue(operation: () => Promise<void>) {
  const result = operations.then(operation);
  operations = result.catch(() => undefined);
  return result;
}

function getNotificationHubUrl() {
  return `${getApiBaseUrl()}/hubs/notifications`;
}

export async function startNotificationConnection() {
  const userId = getAuthUser()?.userId;
  const generation = getSessionGeneration();
  return enqueue(async () => {
    if (!userId || !getToken() || getAuthUser()?.userId !== userId || generation !== getSessionGeneration()) return;
    if (connection && (connectionUserId !== userId || connectionGeneration !== generation)) {
      const previous = connection;
      connection = null;
      await previous.stop();
    }
    if (!getToken() || getAuthUser()?.userId !== userId || generation !== getSessionGeneration()) return;
    if (connection && connection.state !== HubConnectionState.Disconnected) return;
    if (!connection) {
      const created = new HubConnectionBuilder()
        .withUrl(getNotificationHubUrl(), {
          // Refresh trước khi token hết hạn để negotiate không bị 401.
          accessTokenFactory: () => getHubAccessToken(),
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      const current = () => connection === created && getAuthUser()?.userId === userId
        && useNotificationStore.getState().userId === userId && generation === getSessionGeneration();
      created.on("notification.created", (payload: NotificationCreatedPayload) => {
        if (current()) useNotificationStore.getState().prependNotification(payload.notification, payload.unreadCount);
      });
      created.on("notification.unreadCountChanged", (payload: NotificationUnreadCountPayload) => {
        if (!current()) return;
        useNotificationStore.getState().setUnreadCount(payload.unreadCount);
        // A read on another device only broadcasts the count, not the item.
        if (useNotificationStore.getState().centerOpen) void loadNotificationPage();
      });
      created.onreconnecting(() => {
        if (current()) useNotificationStore.setState({ connectionStatus: "connecting" });
      });
      created.onreconnected(() => {
        if (!current()) return;
        useNotificationStore.setState({ connectionStatus: "connected" });
        void refreshNotificationCount();
        if (useNotificationStore.getState().centerOpen) void loadNotificationPage();
      });
      created.onclose(() => {
        if (current()) useNotificationStore.setState({ connectionStatus: "offline" });
      });
      connection = created;
      connectionUserId = userId;
      connectionGeneration = generation;
    }
    const active = connection;
    useNotificationStore.setState({ connectionStatus: "connecting" });
    // Negotiate 401 (token vừa hết hạn) thì refresh rồi thử lại 1 lần;
    // phiên chết hẳn thì đăng xuất thay vì log lỗi lặp lại.
    const started = await startHubWithAuthRecovery("notifications", userId, () => active.start());
    if (!started) {
      if (getAuthUser()?.userId === userId && generation === getSessionGeneration()) useNotificationStore.setState({ connectionStatus: "offline" });
      return;
    }
    if (getAuthUser()?.userId !== userId || generation !== getSessionGeneration()) {
      connection = null;
      connectionUserId = null;
      await active.stop();
      return;
    }
    useNotificationStore.setState({ connectionStatus: "connected" });
    void refreshNotificationCount();
  });
}

export async function stopNotificationConnection() {
  return enqueue(async () => {
    const previous = connection;
    connection = null;
    connectionUserId = null;
    connectionGeneration = -1;
    if (previous) await previous.stop();
  });
}
