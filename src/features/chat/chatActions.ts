import {
  getAuthUser,
  getSessionGeneration,
  getToken,
} from "@/features/auth/hooks/useAuth";
import { getApiErrorMessage } from "@/services/apiClient";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import * as service from "./chatService";
import {
  mergeChatMessages,
  sortChatRooms,
  validateChatDraft,
} from "./chatPresentation";
import { emptyDraft, emptyHistory, useChatStore as store } from "./useChat";

let roomsRequest = 0;
const historyRequests = new Map<string, number>();
const readRequests = new Map<string, Promise<void>>();

function canReadRoom(roomId: string) {
  const state = store.getState();
  return (
    state.foreground &&
    state.activeRoomId === roomId &&
    !state.readPaused &&
    !useNotificationStore.getState().centerOpen
  );
}

export function captureChatSession() {
  const { userId, epoch } = store.getState();
  const generation = getSessionGeneration();
  return () =>
    userId !== null &&
    Boolean(getToken()) &&
    getAuthUser()?.userId === userId &&
    store.getState().userId === userId &&
    store.getState().epoch === epoch &&
    generation === getSessionGeneration();
}

export async function refreshChatRooms() {
  const current = captureChatSession();
  if (!current()) return;
  const request = ++roomsRequest;
  const revision = store.getState().roomRevision;
  store.setState({ roomsLoading: true, roomsError: null });
  try {
    const rooms = [];
    let page = 1;
    let totalPages = 1;
    do {
      const result = await service.getChatRooms({ page, pageSize: 50 });
      if (!current() || request !== roomsRequest) return;
      rooms.push(...result.items);
      totalPages =
        result.totalPages ?? Math.ceil(result.totalCount / result.pageSize);
      page += 1;
    } while (page <= totalPages);
    const state = store.getState();
    const updates = state.rooms.filter(
      (room) => (state.roomVersions[room.id] ?? 0) > revision,
    );
    store.setState({
      rooms: sortChatRooms([...rooms, ...updates]),
      roomsLoaded: true,
    });
  } catch (error) {
    if (current() && request === roomsRequest)
      store.setState({
        roomsError: getApiErrorMessage(
          error,
          "Không tải được danh sách tin nhắn. Vui lòng thử lại.",
        ),
      });
  } finally {
    if (current() && request === roomsRequest)
      store.setState({ roomsLoading: false });
  }
}

export async function loadChatHistory(roomId: string, more = false) {
  const current = captureChatSession();
  if (!current()) return;
  const history = store.getState().histories[roomId] ?? emptyHistory;
  if (history.loading || (more && history.page >= history.totalPages)) return;
  const request = (historyRequests.get(roomId) ?? 0) + 1;
  historyRequests.set(roomId, request);
  const page = more ? history.page + 1 : 1;
  store.setState((state) => ({
    histories: {
      ...state.histories,
      [roomId]: { ...history, loading: true, error: null },
    },
  }));
  try {
    const result = await service.getChatMessages(roomId, {
      page,
      pageSize: 30,
    });
    if (!current() || historyRequests.get(roomId) !== request) return;
    store.setState((state) => ({
      histories: {
        ...state.histories,
        [roomId]: {
          ...state.histories[roomId]!,
          items: mergeChatMessages(
            roomId,
            result.items,
            state.histories[roomId]?.items ?? [],
          ),
          page: more ? result.page : Math.max(result.page, history.page),
          totalPages:
            result.totalPages ?? Math.ceil(result.totalCount / result.pageSize),
        },
      },
    }));
    if (store.getState().activeRoomId === roomId && store.getState().foreground)
      void readChatRoom(roomId);
  } catch (error) {
    if (current() && historyRequests.get(roomId) === request)
      store.setState((state) => ({
        histories: {
          ...state.histories,
          [roomId]: {
            ...state.histories[roomId]!,
            error: getApiErrorMessage(
              error,
              "Không tải được tin nhắn. Vui lòng thử lại.",
            ),
          },
        },
      }));
  } finally {
    if (current() && historyRequests.get(roomId) === request)
      store.setState((state) => ({
        histories: {
          ...state.histories,
          [roomId]: { ...state.histories[roomId]!, loading: false },
        },
      }));
  }
}

export async function openChatRoom(input: {
  roomId?: string;
  bookingId?: number;
}) {
  const current = captureChatSession();
  if (!current()) throw new Error("Session changed.");
  const room =
    input.bookingId != null
      ? await service.getOrCreateChatRoomByBooking(input.bookingId)
      : await service.getChatRoom(input.roomId!);
  if (!current()) throw new Error("Session changed.");
  store.getState().patchRoom(room);
  return room;
}

export function readChatRoom(roomId: string): Promise<void> {
  const state = store.getState();
  const key = `${state.epoch}:${getSessionGeneration()}:${roomId}`;
  const pending = readRequests.get(key);
  if (pending) return pending;
  const current = captureChatSession();
  if (!current() || !canReadRoom(roomId)) return Promise.resolve();
  if (
    state.rooms.find((room) => room.id === roomId)?.unreadCount === 0 &&
    !state.readErrors[roomId]
  )
    return Promise.resolve();
  const task = (async () => {
    try {
      let repeat: boolean;
      do {
        const revision = store.getState().messageVersions[roomId] ?? 0;
        const room = await service.markChatRoomAsRead(roomId);
        if (!current()) return;
        repeat = revision !== (store.getState().messageVersions[roomId] ?? 0);
        if (!repeat) store.getState().patchRoom(room);
        store.setState((latest) => ({
          readErrors: { ...latest.readErrors, [roomId]: null },
        }));
        // A read response may predate a message arriving during the request.
        // Never clear that newer unread count; issue a second read while visible.
      } while (repeat && canReadRoom(roomId));
    } catch {
      if (current())
        store.setState((latest) => ({
          readErrors: {
            ...latest.readErrors,
            [roomId]: "Chưa thể đánh dấu đã đọc. Nhấn để thử lại.",
          },
        }));
    }
  })().finally(() => {
    if (readRequests.get(key) === task) readRequests.delete(key);
  });
  readRequests.set(key, task);
  return task;
}

export function newChatClientId() {
  // This UUID is an idempotency key, never an authentication secret.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 3) | 8).toString(16);
  });
}

export async function submitChatMessage(roomId: string) {
  const current = captureChatSession();
  const state = store.getState();
  if (!current() || state.sending[roomId]) return false;
  const draft = state.drafts[roomId] ?? emptyDraft;
  const validation = validateChatDraft(draft.content, draft.images);
  if (validation) {
    store.setState({
      sendErrors: { ...state.sendErrors, [roomId]: validation },
    });
    return false;
  }
  const room = state.rooms.find((item) => item.id === roomId);
  if (!room?.isActive) return false;
  const snapshot = {
    ...draft,
    clientMessageId: draft.clientMessageId ?? newChatClientId(),
  };
  store.setState({
    drafts: { ...state.drafts, [roomId]: snapshot },
    sending: { ...state.sending, [roomId]: { progress: 0 } },
    sendErrors: { ...state.sendErrors, [roomId]: null },
  });
  try {
    const body = {
      content: snapshot.content.trim(),
      replyToId: snapshot.reply?.id,
      clientMessageId: snapshot.clientMessageId,
    };
    const message = snapshot.images.length
      ? await service.sendChatImages(
          roomId,
          body,
          snapshot.images,
          (progress) => {
            if (current())
              store.setState((latest) => ({
                sending: { ...latest.sending, [roomId]: { progress } },
              }));
          },
        )
      : await service.sendChatMessage(roomId, body);
    if (!current()) return false;
    const latest = store.getState();
    const actualRoom = latest.rooms.find((item) => item.id === roomId) ?? room;
    store.getState().receive({
      message,
      room: {
        ...actualRoom,
        lastMessage: {
          senderId: message.senderId,
          sentAt: message.sentAt,
          text:
            message.content || `Đã gửi ${message.attachments?.length ?? 1} ảnh`,
        },
      },
    });
    if (latest.drafts[roomId] === snapshot)
      store.setState({
        drafts: { ...latest.drafts, [roomId]: { ...emptyDraft, images: [] } },
      });
    return true;
  } catch (error) {
    if (current())
      store.setState((latest) => ({
        sendErrors: {
          ...latest.sendErrors,
          [roomId]: getApiErrorMessage(
            error,
            "Chưa gửi được tin nhắn. Bản nháp được giữ lại; nhấn Gửi để thử lại.",
          ),
        },
      }));
    return false;
  } finally {
    if (current())
      store.setState((latest) => {
        const sending = { ...latest.sending };
        delete sending[roomId];
        return { sending };
      });
  }
}
