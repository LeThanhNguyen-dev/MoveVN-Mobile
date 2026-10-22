import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel,
} from "@microsoft/signalr";
import {
  getAuthUser,
  getSessionGeneration,
  getToken,
  useAuthStore,
} from "@/features/auth/hooks/useAuth";
import { getApiBaseUrl, refreshAuthSession } from "@/services/apiClient";
import { useChatStore as store } from "./useChat";
import { loadChatHistory, readChatRoom, refreshChatRooms } from "./chatActions";
import type { ChatMessageCreatedPayload, ChatRoom } from "./types";

let connection: HubConnection | null = null;
let identity = "";
let operations = Promise.resolve();

function enqueue(operation: () => Promise<void>) {
  const result = operations.then(operation);
  operations = result.catch(() => undefined);
  return result;
}

export async function syncChatAfterReconnect() {
  await refreshChatRooms();
  const state = store.getState();
  if (state.foreground && state.activeRoomId)
    await loadChatHistory(state.activeRoomId);
}

async function freshToken() {
  const token = useAuthStore.getState().token;
  if (token && Date.parse(token.accessTokenExpiresAt) - Date.now() < 60_000)
    await refreshAuthSession();
  return getToken() ?? "";
}

export function startChatConnection() {
  const userId = getAuthUser()?.userId;
  const generation = getSessionGeneration();
  const key = `${userId}:${generation}`;
  return enqueue(async () => {
    const valid = () =>
      Boolean(userId && getToken()) &&
      getAuthUser()?.userId === userId &&
      store.getState().userId === userId &&
      generation === getSessionGeneration();
    if (!valid()) return;
    if (connection && identity !== key) {
      const old = connection;
      connection = null;
      await old.stop();
    }
    if (connection && connection.state !== HubConnectionState.Disconnected)
      return;
    if (!connection) {
      const created = new HubConnectionBuilder()
        .withUrl(`${getApiBaseUrl()}/hubs/chat`, {
          accessTokenFactory: freshToken,
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();
      const current = () => connection === created && valid();
      created.on(
        "chat.messageCreated",
        (payload: ChatMessageCreatedPayload) => {
          if (!current()) return;
          store.getState().receive(payload);
          if (
            store.getState().foreground &&
            store.getState().activeRoomId === payload.message.roomId
          )
            void readChatRoom(payload.message.roomId);
        },
      );
      created.on("chat.roomUpdated", (room: ChatRoom) => {
        if (current()) store.getState().patchRoom(room);
      });
      // Assistant screens subscribe to this event on their own hub connection.
      // The server broadcasts it to every connection in the user's group, so
      // register a no-op here to avoid SignalR's "No client method" warning.
      created.on("AssistantUpdated", () => undefined);
      created.onreconnecting(() => {
        if (current()) store.setState({ connectionStatus: "connecting" });
      });
      created.onreconnected(() => {
        if (!current()) return;
        store.setState({ connectionStatus: "connected" });
        void syncChatAfterReconnect();
      });
      created.onclose(() => {
        if (current()) store.setState({ connectionStatus: "offline" });
      });
      connection = created;
      identity = key;
    }
    const active = connection;
    store.setState({ connectionStatus: "connecting" });
    try {
      await active.start();
      if (!valid()) {
        if (connection === active) connection = null;
        await active.stop();
        return;
      }
      store.setState({ connectionStatus: "connected" });
      void syncChatAfterReconnect();
    } catch (error) {
      if (valid()) store.setState({ connectionStatus: "offline" });
      throw error;
    }
  });
}

export function stopChatConnection() {
  return enqueue(async () => {
    const previous = connection;
    connection = null;
    identity = "";
    if (previous) await previous.stop();
  });
}
