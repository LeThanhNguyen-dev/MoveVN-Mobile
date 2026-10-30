import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from "@microsoft/signalr";
import { getAuthUser, getSessionGeneration, getToken } from "@/features/auth/hooks/useAuth";
import { getHubAccessToken, startHubWithAuthRecovery } from "@/services/hubStart";
import { getApiBaseUrl } from "@/services/apiClient";
import { useGpsStore } from "./gpsStore";
import type { GpsLocationUpdatedPayload, GpsStatusChangedPayload } from "./types";

// Singleton connection tới /hubs/tracking — cùng pattern với notificationConnection.
let connection: HubConnection | null = null;
let connectionUserId: number | null = null;
let connectionGeneration = -1;
let operations: Promise<void> = Promise.resolve();

function enqueue<T>(operation: () => Promise<T>): Promise<T> {
  const result = operations.then(operation);
  operations = result.then(() => undefined, () => undefined);
  return result;
}

function getTrackingHubUrl() {
  return `${getApiBaseUrl()}/hubs/tracking`;
}

export async function startGpsTrackingConnection(): Promise<boolean> {
  const userId = getAuthUser()?.userId;
  const generation = getSessionGeneration();
  return enqueue(async () => {
    if (!userId || !getToken() || getAuthUser()?.userId !== userId || generation !== getSessionGeneration()) return false;
    if (connection && (connectionUserId !== userId || connectionGeneration !== generation)) {
      const previous = connection;
      connection = null;
      await previous.stop();
    }
    if (!getToken() || getAuthUser()?.userId !== userId || generation !== getSessionGeneration()) return false;
    if (!connection) {
      const created = new HubConnectionBuilder()
        .withUrl(getTrackingHubUrl(), {
          // Refresh trước khi token hết hạn để negotiate không bị 401.
          accessTokenFactory: () => getHubAccessToken(),
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      const current = () => connection === created
        && getAuthUser()?.userId === userId
        && generation === getSessionGeneration();

      created.on("gps.locationUpdated", (payload: GpsLocationUpdatedPayload) => {
        if (!current()) return;
        useGpsStore.getState().applyPosition(payload);
      });
      created.on("gps.statusChanged", (payload: GpsStatusChangedPayload) => {
        if (!current()) return;
        useGpsStore.getState().applyStatus(payload);
        if (payload.status === "gpsEnableRequested") {
          useGpsStore.getState().markGpsEnableRequested();
        }
      });
      created.onreconnecting(() => {
        if (current()) useGpsStore.getState().setConnectionStatus("connecting");
      });
      created.onreconnected(() => {
        if (current()) useGpsStore.getState().setConnectionStatus("connected");
      });
      created.onclose(() => {
        if (current()) useGpsStore.getState().setConnectionStatus("offline");
      });

      connection = created;
      connectionUserId = userId;
      connectionGeneration = generation;
    }

    const active = connection;
    if (active.state !== HubConnectionState.Disconnected) {
      useGpsStore.getState().setConnectionStatus("connected");
      return true;
    }
    useGpsStore.getState().setConnectionStatus("connecting");
    // Negotiate 401 thì refresh rồi thử lại 1 lần; phiên chết thì đăng xuất ở hubStart.
    const started = await startHubWithAuthRecovery("tracking", userId, () => active.start());
    if (!started) {
      useGpsStore.getState().setConnectionStatus("offline");
      return false;
    }
    useGpsStore.getState().setConnectionStatus("connected");
    return true;
  });
}

export async function subscribeToBooking(bookingId: number): Promise<boolean> {
  return enqueue(async () => {
    const active = connection;
    if (!active || active.state !== HubConnectionState.Connected) return false;
    try {
      return Boolean(await active.invoke("Subscribe", bookingId));
    } catch {
      return false;
    }
  });
}

export async function unsubscribeFromBooking(bookingId: number): Promise<void> {
  return enqueue(async () => {
    const active = connection;
    if (!active || active.state !== HubConnectionState.Connected) return;
    try {
      await active.invoke("Unsubscribe", bookingId);
    } catch {
      // Bỏ qua: có thể connection vừa mất, group sẽ tự dọn khi connection đứt.
    }
  });
}

export async function stopGpsTrackingConnection(): Promise<void> {
  return enqueue(async () => {
    const previous = connection;
    connection = null;
    connectionUserId = null;
    connectionGeneration = -1;
    if (previous) await previous.stop();
    useGpsStore.getState().setConnectionStatus("offline");
  });
}
