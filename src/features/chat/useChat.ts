import { create } from "zustand";
import { mergeChatMessages, sortChatRooms } from "./chatPresentation";
import type {
  ChatDraft,
  ChatMessage,
  ChatMessageCreatedPayload,
  ChatRoom,
} from "./types";

export interface ChatHistory {
  items: ChatMessage[];
  page: number;
  totalPages: number;
  loading: boolean;
  error: string | null;
}
export const emptyHistory: ChatHistory = {
  items: [],
  page: 0,
  totalPages: 0,
  loading: false,
  error: null,
};
export const emptyDraft: ChatDraft = { content: "", images: [] };

interface ChatState {
  userId: number | null;
  epoch: number;
  rooms: ChatRoom[];
  roomsLoading: boolean;
  roomsLoaded: boolean;
  roomsError: string | null;
  roomRevision: number;
  roomVersions: Record<string, number>;
  messageVersions: Record<string, number>;
  histories: Record<string, ChatHistory>;
  drafts: Record<string, ChatDraft>;
  sending: Record<string, { progress: number }>;
  sendErrors: Record<string, string | null>;
  readErrors: Record<string, string | null>;
  seenIds: string[];
  activeRoomId: string | null;
  foreground: boolean;
  readPaused: boolean;
  connectionStatus: "offline" | "connecting" | "connected";
  activate: (userId: number | null) => void;
  patchRoom: (room: ChatRoom) => void;
  receive: (payload: ChatMessageCreatedPayload) => void;
  patchDraft: (roomId: string, patch: Partial<ChatDraft>) => void;
}

const initial = () => ({
  userId: null,
  rooms: [],
  roomsLoading: false,
  roomsLoaded: false,
  roomsError: null,
  roomRevision: 0,
  roomVersions: {},
  messageVersions: {},
  histories: {},
  drafts: {},
  sending: {},
  sendErrors: {},
  readErrors: {},
  seenIds: [],
  activeRoomId: null,
  foreground: true,
  readPaused: false,
  connectionStatus: "offline" as const,
});

export const useChatStore = create<ChatState>((set, get) => ({
  ...initial(),
  epoch: 0,
  activate: (userId) => {
    if (get().userId !== userId)
      set({ ...initial(), userId, epoch: get().epoch + 1 });
  },
  patchRoom: (room) => {
    const state = get();
    if (
      state.userId == null ||
      ![room.customerId, room.ownerId].some((id) => Number(id) === state.userId)
    )
      return;
    const previous = state.rooms.find((item) => item.id === room.id);
    const isOlder =
      (Date.parse(previous?.lastMessage?.sentAt ?? "") || 0) >
      (Date.parse(room.lastMessage?.sentAt ?? "") || 0);
    const next = isOlder
      ? {
          ...room,
          lastMessage: previous!.lastMessage,
          unreadCount: previous!.unreadCount,
        }
      : room;
    const revision = state.roomRevision + 1;
    set({
      rooms: sortChatRooms([
        ...state.rooms.filter((item) => item.id !== room.id),
        next,
      ]),
      roomRevision: revision,
      roomVersions: { ...state.roomVersions, [room.id]: revision },
    });
  },
  receive: ({ message, room, recipientUnreadCounts }) => {
    const state = get();
    if (
      state.userId == null ||
      message.roomId !== room.id ||
      ![room.customerId, room.ownerId].some((id) => Number(id) === state.userId)
    )
      return;
    const previous = state.rooms.find((item) => item.id === room.id);
    const duplicate =
      state.seenIds.includes(message.id) ||
      state.histories[room.id]?.items.some((item) => item.id === message.id);
    const authoritativeCount = recipientUnreadCounts?.[String(state.userId)];
    const count = duplicate
      ? (previous?.unreadCount ?? room.unreadCount)
      : typeof authoritativeCount === "number"
        ? authoritativeCount
        : (previous?.unreadCount ?? 0) +
          (Number(message.senderId) === state.userId ? 0 : 1);
    get().patchRoom({ ...room, unreadCount: count });
    const history = state.histories[room.id];
    set({
      seenIds: duplicate
        ? state.seenIds
        : [...state.seenIds.slice(-511), message.id],
      messageVersions: duplicate
        ? state.messageVersions
        : {
            ...state.messageVersions,
            [room.id]: (state.messageVersions[room.id] ?? 0) + 1,
          },
      ...(history
        ? {
            histories: {
              ...get().histories,
              [room.id]: {
                ...history,
                items: mergeChatMessages(room.id, history.items, [message]),
              },
            },
          }
        : {}),
    });
  },
  patchDraft: (roomId, patch) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [roomId]: {
          ...(state.drafts[roomId] ?? emptyDraft),
          ...patch,
          clientMessageId: undefined,
        },
      },
      sendErrors: { ...state.sendErrors, [roomId]: null },
    })),
}));
