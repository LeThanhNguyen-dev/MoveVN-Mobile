import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { getApiBaseUrl } from "@/services/apiClient";
import { getAuthUser, getToken } from "@/features/auth/hooks/useAuth";
import { usePresenceStore } from "@/features/presence/usePresence";

let connection: HubConnection | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let startPromise: Promise<void> | null = null;
let connectionUserId: number | null = null;
let connectingUserId: number | null = null;

function getPresenceHubUrl() {
  return `${getApiBaseUrl()}/hubs/presence`;
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (connection?.state === HubConnectionState.Connected) {
      const activeConnection = connection;
      void activeConnection.invoke("Heartbeat")
        .then(() => {
          if (connection === activeConnection) usePresenceStore.getState().setSelfOnline(true);
        })
        .catch((error: unknown) => {
          if (connection === activeConnection) usePresenceStore.getState().setSelfOnline(false);
          console.warn("Presence heartbeat failed.", error);
        });
    }
  }, 30_000);
}

export async function startPresenceConnection() {
  const token = getToken();
  const currentUser = getAuthUser();
  if (!token || !currentUser) return;

  if (connection?.state === HubConnectionState.Connected
      || connection?.state === HubConnectionState.Connecting
      || connection?.state === HubConnectionState.Reconnecting) {
    if (connectionUserId === currentUser.userId) {
      return;
    }
    if (connection.state === HubConnectionState.Connecting && connectingUserId === currentUser.userId && startPromise) {
      await startPromise;
      return;
    }

    await stopPresenceConnection();
  }

  if (!connection) {
    connection = new HubConnectionBuilder()
      .withUrl(getPresenceHubUrl(), {
        accessTokenFactory: () => getToken() ?? "",
      })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: () => 5_000 })
      .configureLogging(LogLevel.Warning)
      .build();

    connection.on("UserPresenceChanged", (userId: number, isOnline: boolean, lastSeenAt: string | null) => {
      usePresenceStore.getState().setUserPresence(userId, isOnline, lastSeenAt);
      if (getAuthUser()?.userId === userId) {
        usePresenceStore.getState().setSelfOnline(isOnline);
      }
    });

    connection.onreconnected(() => {
      const reconnected = connection;
      if (!reconnected) return;
      startHeartbeat();
      void reconnected.invoke("Heartbeat")
        .then(() => {
          if (connection !== reconnected) return;
          usePresenceStore.getState().setSelfOnline(true);
        })
        .catch((error: unknown) => console.warn("Presence heartbeat failed after reconnect.", error));
    });

    connection.onreconnecting(() => {
      usePresenceStore.getState().setSelfOnline(false);
      stopHeartbeat();
    });

    connection.onclose(() => {
      usePresenceStore.getState().setSelfOnline(false);
      stopHeartbeat();
    });
  }

  const activeConnection = connection;
  connectingUserId = currentUser.userId;
  startPromise = activeConnection.start().finally(() => {
    startPromise = null;
    connectingUserId = null;
  });

  await startPromise;
  if (connection !== activeConnection) {
    await activeConnection.stop();
    return;
  }

  await activeConnection.invoke("Heartbeat");
  usePresenceStore.getState().setSelfOnline(true);
  connectionUserId = currentUser.userId;
  usePresenceStore.getState().setUserPresence(currentUser.userId, true, new Date().toISOString());
  startHeartbeat();
}

export async function stopPresenceConnection() {
  stopHeartbeat();
  usePresenceStore.getState().setSelfOnline(false);
  if (connectionUserId) {
    usePresenceStore.getState().setUserPresence(connectionUserId, false, new Date().toISOString());
  }

  if (!connection) return;

  const activeConnection = connection;
  if (startPromise) {
    await startPromise.catch(() => undefined);
  }

  await activeConnection.stop();
  if (connection === activeConnection) {
    connection = null;
    connectionUserId = null;
  }
}
