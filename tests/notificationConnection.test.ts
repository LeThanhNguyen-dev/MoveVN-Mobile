import { beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userId: 1 as number | null, generation: 0, token: "first-token", connections: [] as Array<{
    state: string; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>;
    handlers: Map<string, (payload: unknown) => void>;
    reconnecting?: () => void; reconnected?: () => void; closed?: () => void;
    tokenFactory?: () => string;
  }>,
  nextStart: vi.fn(), count: vi.fn(), list: vi.fn(),
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getToken: () => mocks.userId ? mocks.token : null,
  getAuthUser: () => mocks.userId ? { userId: mocks.userId } : null,
  getSessionGeneration: () => mocks.generation,
}));
vi.mock("@/services/apiClient", () => ({ getApiBaseUrl: () => "http://10.0.2.2:5171" }));
vi.mock("@/features/notifications/notificationActions", () => ({ refreshNotificationCount: mocks.count, loadNotificationPage: mocks.list }));
vi.mock("@microsoft/signalr", () => ({
  HubConnectionState: { Disconnected: "Disconnected", Connected: "Connected", Connecting: "Connecting", Reconnecting: "Reconnecting" },
  LogLevel: { Warning: 3 },
  HubConnectionBuilder: class {
    tokenFactory?: () => string;
    withUrl(_url: string, options: { accessTokenFactory: () => string }) { this.tokenFactory = options.accessTokenFactory; return this; }
    withAutomaticReconnect() { return this; }
    configureLogging() { return this; }
    build() {
      const connection = {
        state: "Disconnected", handlers: new Map<string, (payload: unknown) => void>(),
        tokenFactory: this.tokenFactory,
        start: vi.fn(async () => {
          connection.state = "Connecting";
          try { await mocks.nextStart(); connection.state = "Connected"; }
          catch (error) { connection.state = "Disconnected"; throw error; }
        }),
        stop: vi.fn(async () => { connection.state = "Disconnected"; }),
        on(name: string, handler: (payload: unknown) => void) { this.handlers.set(name, handler); },
        reconnecting: undefined as (() => void) | undefined,
        reconnected: undefined as (() => void) | undefined,
        closed: undefined as (() => void) | undefined,
        onreconnecting(handler: () => void) { this.reconnecting = handler; },
        onreconnected(handler: () => void) { this.reconnected = handler; },
        onclose(handler: () => void) { this.closed = handler; },
      };
      mocks.connections.push(connection);
      return connection;
    }
  },
}));

import { useNotificationStore as store } from "@/features/notifications/useNotifications";
import { startNotificationConnection, stopNotificationConnection } from "@/features/notifications/notificationConnection";

beforeEach(async () => {
  await stopNotificationConnection();
  vi.clearAllMocks();
  mocks.userId = 1; mocks.generation = 0; mocks.token = "first-token"; mocks.connections = [];
  mocks.nextStart.mockReset().mockResolvedValue(undefined);
  store.getState().reset(); store.getState().activate(1);
});

it("serializes concurrent starts and uses the latest access token without recreating a healthy connection", async () => {
  await Promise.all([startNotificationConnection(), startNotificationConnection()]);
  expect(mocks.connections).toHaveLength(1);
  expect(mocks.connections[0]?.start).toHaveBeenCalledTimes(1);
  mocks.token = "refreshed-token";
  expect(mocks.connections[0]?.tokenFactory?.()).toBe("refreshed-token");
  expect(store.getState().connectionStatus).toBe("connected");
});

it("retries an initially failed start on the next foreground sync", async () => {
  mocks.nextStart.mockRejectedValueOnce(new Error("offline"));
  await expect(startNotificationConnection()).rejects.toThrow("offline");
  expect(store.getState().connectionStatus).toBe("offline");
  await startNotificationConnection();
  expect(mocks.connections[0]?.start).toHaveBeenCalledTimes(2);
  expect(store.getState().connectionStatus).toBe("connected");
});

it("ignores callbacks from an old account even before the old connection has stopped", async () => {
  await startNotificationConnection();
  const old = mocks.connections[0]!;
  mocks.userId = 2; store.getState().activate(2);
  old.handlers.get("notification.unreadCountChanged")?.({ unreadCount: 99 });
  old.handlers.get("notification.created")?.({ notification: { id: 1, channel: "InApp", createdAt: "2026-10-13" }, unreadCount: 99 });
  expect(store.getState().unreadCount).toBe(0);
  expect(store.getState().items).toEqual([]);
  await startNotificationConnection();
  expect(old.stop).toHaveBeenCalledTimes(1);
  expect(mocks.connections).toHaveLength(2);
});

it("creates a new connection after logging out and logging in as the same user", async () => {
  await startNotificationConnection();
  const old = mocks.connections[0]!;
  mocks.generation++;
  store.getState().reset(); store.getState().activate(1);
  await startNotificationConnection();
  expect(old.stop).toHaveBeenCalledTimes(1);
  expect(mocks.connections).toHaveLength(2);
  old.handlers.get("notification.unreadCountChanged")?.({ unreadCount: 99 });
  expect(store.getState().unreadCount).toBe(0);
});

it("resynchronizes missed notifications on reconnect and reads made on another device", async () => {
  store.setState({ centerOpen: true });
  await startNotificationConnection();
  const active = mocks.connections[0]!;
  active.reconnecting?.();
  expect(store.getState().connectionStatus).toBe("connecting");
  active.reconnected?.();
  expect(store.getState().connectionStatus).toBe("connected");
  expect(mocks.list).toHaveBeenCalledTimes(1);
  active.handlers.get("notification.unreadCountChanged")?.({ unreadCount: 3 });
  expect(store.getState().unreadCount).toBe(3);
  expect(mocks.list).toHaveBeenCalledTimes(2);
});

it("closes an in-flight connection that finishes after logout", async () => {
  let resolve!: () => void;
  mocks.nextStart.mockReturnValueOnce(new Promise<void>((res) => { resolve = res; }));
  const pending = startNotificationConnection();
  await Promise.resolve();
  mocks.userId = null; mocks.generation++;
  store.getState().activate(null);
  resolve(); await pending;
  expect(mocks.connections[0]?.stop).toHaveBeenCalledTimes(1);
  expect(store.getState().userId).toBeNull();
  expect(store.getState().connectionStatus).toBe("offline");
});
