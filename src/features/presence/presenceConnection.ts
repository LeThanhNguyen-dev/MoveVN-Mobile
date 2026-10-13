import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import { getApiBaseUrl, refreshAuthSession } from "@/services/apiClient";
import { getAuthUser, getToken, useAuthStore } from "@/features/auth/hooks/useAuth";
import { usePresenceStore } from "@/features/presence/usePresence";

let connection: HubConnection | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
let startPromise: Promise<void> | null = null;
let connectionUserId: number | null = null;
let connectingUserId: number | null = null;

function getPresenceHubUrl() {
  return `${getApiBaseUrl()}/hubs/presence`;
}

// Refresh trước khi access token hết hạn để negotiate SignalR không bị 401.
const REFRESH_SKEW_MS = 60_000;

export function isPresenceAuthError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { statusCode?: unknown; status?: unknown; message?: unknown; response?: unknown };
  if (record.statusCode === 401 || record.status === 401) return true;
  const response = record.response as { status?: unknown } | undefined;
  if (response?.status === 401) return true;
  const message = typeof record.message === "string" ? record.message : "";
  return message.includes("401") || message.toLowerCase().includes("unauthorized");
}

async function ensureFreshToken(): Promise<void> {
  const stored = useAuthStore.getState().token;
  if (!stored?.accessToken) throw new Error("Missing session.");
  const expiresAt = Date.parse(stored.accessTokenExpiresAt);
  if (Number.isNaN(expiresAt) || expiresAt - Date.now() > REFRESH_SKEW_MS) return;
  if (!stored.refreshToken) throw new Error("Missing refresh token.");
  await refreshAuthSession();
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
  if (!useAuthStore.getState().token?.refreshToken) return;

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
        accessTokenFactory: async () => {
          try {
            await ensureFreshToken();
          } catch {
            // Giữ token cũ để server trả lỗi rõ ràng; lỗi auth được xử lý ở start().
          }
          return getToken() ?? "";
        },
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
  startPromise = (async () => {
    // Hết phiên (401) thì throw để caller dừng retry; lỗi mạng thì throw để caller retry 5s.
    await ensureFreshToken();
    try {
      await activeConnection.start();
    } catch (error) {
      if (!isPresenceAuthError(error)) throw error;
      // Token có thể vừa hết hạn giữa lúc check và negotiate: refresh rồi thử lại 1 lần.
      await refreshAuthSession();
      await activeConnection.start();
    }
  })().finally(() => {
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
