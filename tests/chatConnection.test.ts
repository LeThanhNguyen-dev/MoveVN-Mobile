import { beforeEach, expect, it, vi } from "vitest";
import { chatMessage, chatRoom } from "./chatFixtures";

const mocks = vi.hoisted(() => ({
  userId: 1 as number | null,
  generation: 0,
  token: "first-token",
  expiry: new Date(Date.now() + 3600_000).toISOString(),
  nextStart: vi.fn(),
  refresh: vi.fn(),
  rooms: vi.fn(),
  history: vi.fn(),
  read: vi.fn(),
  connections: [] as Array<{
    state: string;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
    handlers: Map<string, (payload: unknown) => void>;
    reconnected?: () => void;
    reconnecting?: () => void;
    closed?: () => void;
    tokenFactory: () => Promise<string>;
  }>,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getToken: () => (mocks.userId ? mocks.token : null),
  getAuthUser: () => (mocks.userId ? { userId: mocks.userId } : null),
  getSessionGeneration: () => mocks.generation,
  useAuthStore: {
    getState: () => ({
      token: { accessToken: mocks.token, accessTokenExpiresAt: mocks.expiry },
    }),
  },
}));
vi.mock("@/services/apiClient", () => ({
  getApiBaseUrl: () => "http://10.0.2.2:5171",
  refreshAuthSession: mocks.refresh,
}));
vi.mock("@/features/chat/chatActions", () => ({
  refreshChatRooms: mocks.rooms,
  loadChatHistory: mocks.history,
  readChatRoom: mocks.read,
}));
vi.mock("@microsoft/signalr", () => ({
  HubConnectionState: { Disconnected: "Disconnected", Connected: "Connected" },
  LogLevel: { Warning: 3 },
  HubConnectionBuilder: class {
    tokenFactory!: () => Promise<string>;
    withUrl(
      _url: string,
      options: { accessTokenFactory: () => Promise<string> },
    ) {
      this.tokenFactory = options.accessTokenFactory;
      return this;
    }
    withAutomaticReconnect() {
      return this;
    }
    configureLogging() {
      return this;
    }
    build() {
      const connection = {
        state: "Disconnected",
        tokenFactory: this.tokenFactory,
        handlers: new Map<string, (payload: unknown) => void>(),
        start: vi.fn(async () => {
          connection.state = "Connecting";
          try {
            await mocks.nextStart();
            connection.state = "Connected";
          } catch (error) {
            connection.state = "Disconnected";
            throw error;
          }
        }),
        stop: vi.fn(async () => {
          connection.state = "Disconnected";
        }),
        on(name: string, handler: (payload: unknown) => void) {
          this.handlers.set(name, handler);
        },
        reconnected: undefined as (() => void) | undefined,
        reconnecting: undefined as (() => void) | undefined,
        closed: undefined as (() => void) | undefined,
        onreconnected(handler: () => void) {
          this.reconnected = handler;
        },
        onreconnecting(handler: () => void) {
          this.reconnecting = handler;
        },
        onclose(handler: () => void) {
          this.closed = handler;
        },
      };
      mocks.connections.push(connection);
      return connection;
    }
  },
}));
import { useChatStore as store } from "@/features/chat/useChat";
import {
  startChatConnection,
  stopChatConnection,
} from "@/features/chat/chatConnection";

beforeEach(async () => {
  await stopChatConnection();
  vi.clearAllMocks();
  mocks.userId = 1;
  mocks.generation = 0;
  mocks.token = "first-token";
  mocks.expiry = new Date(Date.now() + 3600_000).toISOString();
  mocks.connections = [];
  mocks.nextStart.mockReset().mockResolvedValue(undefined);
  store.getState().activate(null);
  store.getState().activate(1);
});

it("serializes concurrent starts, uses the latest token and refreshes one that is about to expire", async () => {
  await Promise.all([startChatConnection(), startChatConnection()]);
  expect(mocks.connections).toHaveLength(1);
  expect(mocks.connections[0]?.start).toHaveBeenCalledTimes(1);
  mocks.token = "new-token";
  expect(await mocks.connections[0]?.tokenFactory()).toBe("new-token");
  mocks.expiry = new Date(Date.now() + 1000).toISOString();
  mocks.refresh.mockImplementationOnce(async () => {
    mocks.token = "refreshed";
  });
  expect(await mocks.connections[0]?.tokenFactory()).toBe("refreshed");
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
});

it("retries failed initial connections and resynchronizes the active history on reconnect", async () => {
  mocks.nextStart.mockRejectedValueOnce(new Error("offline"));
  await expect(startChatConnection()).rejects.toThrow("offline");
  expect(store.getState().connectionStatus).toBe("offline");
  await startChatConnection();
  store.setState({ activeRoomId: "room-a" });
  const connection = mocks.connections[0]!;
  connection.reconnecting?.();
  expect(store.getState().connectionStatus).toBe("connecting");
  connection.reconnected?.();
  await Promise.resolve();
  await Promise.resolve();
  expect(store.getState().connectionStatus).toBe("connected");
  expect(mocks.history).toHaveBeenCalledWith("room-a");
});

it("receives messages and reads only the currently visible room", async () => {
  await startChatConnection();
  const connection = mocks.connections[0]!;
  connection.handlers.get("chat.messageCreated")?.({
    message: chatMessage(),
    room: chatRoom(),
    recipientUnreadCounts: { "1": 2 },
  });
  expect(store.getState().rooms[0]?.unreadCount).toBe(2);
  expect(mocks.read).not.toHaveBeenCalled();
  store.setState({ activeRoomId: "room-a" });
  connection.handlers.get("chat.messageCreated")?.({
    message: chatMessage("new"),
    room: chatRoom(),
    recipientUnreadCounts: { "1": 3 },
  });
  expect(mocks.read).toHaveBeenCalledWith("room-a");
  mocks.read.mockClear();
  store.setState({ foreground: false });
  connection.handlers.get("chat.messageCreated")?.({
    message: chatMessage("background"),
    room: chatRoom(),
  });
  expect(mocks.read).not.toHaveBeenCalled();
});

it("ignores old account callbacks and recreates the connection even for same-user relogin", async () => {
  await startChatConnection();
  const old = mocks.connections[0]!;
  mocks.generation++;
  store.getState().activate(null);
  store.getState().activate(1);
  await startChatConnection();
  old.handlers.get("chat.messageCreated")?.({
    message: chatMessage(),
    room: chatRoom(),
  });
  expect(store.getState().rooms).toEqual([]);
  expect(old.stop).toHaveBeenCalledTimes(1);
  expect(mocks.connections).toHaveLength(2);
});

it("stops a connection whose delayed start finishes after logout", async () => {
  let resolve!: () => void;
  mocks.nextStart.mockReturnValueOnce(
    new Promise<void>((res) => {
      resolve = res;
    }),
  );
  const start = startChatConnection();
  await Promise.resolve();
  mocks.userId = null;
  mocks.generation++;
  store.getState().activate(null);
  resolve();
  await start;
  expect(mocks.connections[0]?.stop).toHaveBeenCalledTimes(1);
  expect(store.getState().connectionStatus).toBe("offline");
});
