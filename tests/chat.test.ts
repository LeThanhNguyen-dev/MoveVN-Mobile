import { beforeEach, expect, it, vi } from "vitest";
import {
  chatMessage,
  chatPage,
  chatPickedImage,
  chatRoom,
  deferred,
} from "./chatFixtures";
import type { ChatMessage, ChatRoom, PagedResult } from "@/features/chat/types";

const mocks = vi.hoisted(() => ({
  userId: 1 as number | null,
  generation: 0,
  rooms: vi.fn(),
  messages: vi.fn(),
  read: vi.fn(),
  room: vi.fn(),
  booking: vi.fn(),
  send: vi.fn(),
  images: vi.fn(),
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () => (mocks.userId ? { userId: mocks.userId } : null),
  getToken: () => (mocks.userId ? "token" : null),
  getSessionGeneration: () => mocks.generation,
}));
vi.mock("@/services/apiClient", () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("@/features/chat/chatService", () => ({
  getChatRooms: mocks.rooms,
  getChatMessages: mocks.messages,
  markChatRoomAsRead: mocks.read,
  getChatRoom: mocks.room,
  getOrCreateChatRoomByBooking: mocks.booking,
  sendChatMessage: mocks.send,
  sendChatImages: mocks.images,
}));
import { useChatStore as store } from "@/features/chat/useChat";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import {
  loadChatHistory,
  openChatRoom,
  readChatRoom,
  refreshChatRooms,
  submitChatMessage,
} from "@/features/chat/chatActions";
import {
  bytesToBase64,
  chatCounterpart,
  mergeChatMessages,
  normalizeChatSearch,
  sortChatRooms,
  validateChatDraft,
  validateChatImages,
} from "@/features/chat/chatPresentation";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.userId = 1;
  mocks.generation = 0;
  useNotificationStore.setState({ centerOpen: false });
  store.getState().activate(null);
  store.getState().activate(1);
  mocks.rooms.mockResolvedValue(chatPage([chatRoom()]));
  mocks.messages.mockResolvedValue(chatPage([chatMessage()]));
  mocks.read.mockResolvedValue(chatRoom("room-a", 0));
  mocks.room.mockResolvedValue(chatRoom());
  mocks.booking.mockResolvedValue(chatRoom());
  mocks.send.mockResolvedValue(chatMessage("sent", "room-a", 1));
  mocks.images.mockResolvedValue(
    chatMessage("sent-image", "room-a", 1, {
      messageType: "image",
      attachments: [
        {
          url: "/api/private",
          name: "photo.jpg",
          contentType: "image/jpeg",
          size: 1024,
          width: 10,
          height: 10,
        },
      ],
    }),
  );
});

it("sorts rooms by message activity rather than read updates, deduplicates and isolates room history", () => {
  const old = {
    ...chatRoom("room-b"),
    lastMessage: undefined,
    updatedAt: "2099-01-01",
  };
  expect(sortChatRooms([old, chatRoom(), old]).map((room) => room.id)).toEqual([
    "room-a",
    "room-b",
  ]);
  expect(
    mergeChatMessages(
      "room-a",
      [chatMessage(), chatMessage("foreign", "room-b")],
      [chatMessage()],
    ),
  ).toHaveLength(1);
  expect(chatCounterpart(chatRoom(), 1).name).toBe("Chủ Đặng");
  expect(chatCounterpart(chatRoom(), 2).name).toBe("Khách Nguyễn");
  expect(normalizeChatSearch("Chủ Đặng")).toBe("chu dang");
});

it("validates empty/text/image-only messages and exact 5 MB and 2000-character boundaries", () => {
  expect(validateChatDraft("  ", [])).toBeTruthy();
  expect(validateChatDraft("", [chatPickedImage()])).toBeNull();
  expect(validateChatDraft("a".repeat(2000), [])).toBeNull();
  expect(validateChatDraft("a".repeat(2001), [])).toBeTruthy();
  expect(
    validateChatImages([chatPickedImage("a", { size: 5 * 1024 * 1024 })]),
  ).toBeNull();
  for (const image of [
    chatPickedImage("a", { size: 0 }),
    chatPickedImage("a", { size: 5 * 1024 * 1024 + 1 }),
    chatPickedImage("a", { type: "image/gif" }),
  ])
    expect(validateChatImages([image])).toBeTruthy();
  expect(
    validateChatImages(
      Array.from({ length: 5 }, (_, i) => chatPickedImage(String(i))),
    ),
  ).toBeTruthy();
});

it.each(
  [
    [],
    [0],
    [1, 2],
    [255, 254, 253],
    Array.from({ length: 24000 }, (_, i) => i % 256),
  ].map((values) => ({ values })),
)(
  "encodes private binary images without Node-only Buffer APIs ($values.length bytes)",
  ({ values }) => {
    const bytes = Uint8Array.from(values);
    expect(bytesToBase64(bytes)).toBe(btoa(String.fromCharCode(...bytes)));
  },
);

it("loads all room pages so the badge includes conversations beyond the first 50", async () => {
  mocks.rooms
    .mockResolvedValueOnce(chatPage([chatRoom()], 1, 2, 50))
    .mockResolvedValueOnce(chatPage([chatRoom("room-b", 3)], 2, 2, 50));
  await refreshChatRooms();
  expect(mocks.rooms).toHaveBeenLastCalledWith({ page: 2, pageSize: 50 });
  expect(
    store.getState().rooms.reduce((sum, room) => sum + room.unreadCount, 0),
  ).toBe(5);
});

it("preserves a live room and its unread count when an older rooms request completes", async () => {
  const pending = deferred<PagedResult<ChatRoom>>();
  mocks.rooms.mockReturnValueOnce(pending.promise);
  const request = refreshChatRooms();
  store
    .getState()
    .receive({
      message: chatMessage("new"),
      room: chatRoom(),
      recipientUnreadCounts: { "1": 3 },
    });
  pending.resolve(chatPage([chatRoom("room-a", 1)]));
  await request;
  expect(store.getState().rooms[0]?.unreadCount).toBe(3);
});

it("does not count duplicate realtime events twice or accept another account's room", () => {
  const payload = {
    message: chatMessage(),
    room: chatRoom(),
    recipientUnreadCounts: { "1": 4 },
  };
  store.getState().receive(payload);
  store.getState().receive(payload);
  expect(store.getState().rooms[0]?.unreadCount).toBe(4);
  store
    .getState()
    .receive({
      ...payload,
      room: { ...chatRoom("foreign"), customerId: 9, ownerId: 10 },
    });
  expect(store.getState().rooms).toHaveLength(1);
});

it("preserves newest activity when a delayed read event describes an older room", () => {
  store
    .getState()
    .patchRoom({
      ...chatRoom(),
      lastMessage: { text: "New", senderId: 2, sentAt: "2026-10-14T11:00:00Z" },
      unreadCount: 3,
    });
  store.getState().patchRoom(chatRoom("room-a", 0));
  expect(store.getState().rooms[0]?.lastMessage?.text).toBe("New");
  expect(store.getState().rooms[0]?.unreadCount).toBe(3);
});

it("paginates history without losing live messages or inserting duplicates", async () => {
  const pending = deferred<PagedResult<ChatMessage>>();
  mocks.messages.mockReturnValueOnce(pending.promise);
  const request = loadChatHistory("room-a");
  store.getState().receive({ message: chatMessage("new"), room: chatRoom() });
  pending.resolve(chatPage([chatMessage()], 1, 2));
  await request;
  mocks.messages.mockResolvedValueOnce(
    chatPage(
      [
        chatMessage(),
        chatMessage("old", "room-a", 2, { sentAt: "2026-10-01" }),
      ],
      2,
      2,
    ),
  );
  await loadChatHistory("room-a", true);
  expect(
    store.getState().histories["room-a"]?.items.map((item) => item.id),
  ).toEqual(["old", "message-1", "new"]);
  expect(mocks.read).not.toHaveBeenCalled();
});

it("leaves unread counts unchanged if the read fails and retries while the room is visible", async () => {
  store.getState().patchRoom(chatRoom());
  store.setState({ activeRoomId: "room-a" });
  mocks.read.mockRejectedValueOnce(new Error("offline"));
  await readChatRoom("room-a");
  expect(store.getState().rooms[0]?.unreadCount).toBe(2);
  expect(store.getState().readErrors["room-a"]).toBeTruthy();
  await readChatRoom("room-a");
  expect(store.getState().rooms[0]?.unreadCount).toBe(0);
});

it("does not mark messages read in the background or an unselected room", async () => {
  store.setState({ activeRoomId: "room-a", foreground: false });
  await readChatRoom("room-a");
  store.setState({ foreground: true, activeRoomId: "room-b" });
  await readChatRoom("room-a");
  expect(mocks.read).not.toHaveBeenCalled();
});

it("does not mark newly received messages read while a gallery or notifications cover the feed", async () => {
  store.setState({ activeRoomId: "room-a", readPaused: true });
  await readChatRoom("room-a");
  store.setState({ readPaused: false });
  useNotificationStore.setState({ centerOpen: true });
  await readChatRoom("room-a");
  expect(mocks.read).not.toHaveBeenCalled();
  useNotificationStore.setState({ centerOpen: false });
  await readChatRoom("room-a");
  expect(mocks.read).toHaveBeenCalledTimes(1);
});

it("rereads after a message arrives during a read without looping on its roomUpdated echo", async () => {
  const pending = deferred<ChatRoom>();
  mocks.read.mockReturnValueOnce(pending.promise);
  store.getState().patchRoom(chatRoom());
  store.setState({ activeRoomId: "room-a" });
  const read = readChatRoom("room-a");
  store
    .getState()
    .receive({
      message: chatMessage("late", "room-a", 2, {
        sentAt: "2026-10-14T11:00:00Z",
      }),
      room: {
        ...chatRoom(),
        lastMessage: {
          text: "Late",
          senderId: 2,
          sentAt: "2026-10-14T11:00:00Z",
        },
      },
      recipientUnreadCounts: { "1": 3 },
    });
  mocks.read.mockImplementationOnce(async () => {
    const result = { ...store.getState().rooms[0]!, unreadCount: 0 };
    store.getState().patchRoom(result);
    return result;
  });
  pending.resolve(chatRoom("room-a", 0));
  await read;
  expect(mocks.read).toHaveBeenCalledTimes(2);
  expect(store.getState().rooms[0]?.unreadCount).toBe(0);
});

it("keeps drafts scoped by booking, replies in the payload, and reuses the UUID after a failed send", async () => {
  store.getState().patchRoom(chatRoom());
  store
    .getState()
    .patchDraft("room-a", {
      content: "  Hẹn nhận xe  ",
      reply: {
        id: "original",
        senderName: "Chủ Đặng",
        content: "Hẹn",
        messageType: "text",
      },
    });
  store.getState().patchDraft("room-b", { content: "Booking B" });
  mocks.send.mockRejectedValueOnce(new Error("offline"));
  expect(await submitChatMessage("room-a")).toBe(false);
  const first = mocks.send.mock.calls[0]?.[1];
  expect(first).toMatchObject({
    content: "Hẹn nhận xe",
    replyToId: "original",
  });
  expect(first.clientMessageId).toMatch(/^[0-9a-f-]{36}$/);
  expect(store.getState().drafts["room-a"]?.content).toBe("  Hẹn nhận xe  ");
  expect(await submitChatMessage("room-a")).toBe(true);
  expect(mocks.send.mock.calls[1]?.[1].clientMessageId).toBe(
    first.clientMessageId,
  );
  expect(store.getState().drafts["room-a"]?.content).toBe("");
  expect(store.getState().drafts["room-b"]?.content).toBe("Booking B");
});

it("retains image-only drafts on failure and prevents double taps during an upload", async () => {
  store.getState().patchRoom(chatRoom());
  store.getState().patchDraft("room-a", { images: [chatPickedImage()] });
  const pending = deferred<ChatMessage>();
  mocks.images.mockReturnValueOnce(pending.promise);
  const send = submitChatMessage("room-a");
  await submitChatMessage("room-a");
  expect(mocks.images).toHaveBeenCalledTimes(1);
  pending.reject(new Error("timeout"));
  await send;
  expect(store.getState().drafts["room-a"]?.images).toHaveLength(1);
  await submitChatMessage("room-a");
  expect(mocks.images.mock.calls[1]?.[1].clientMessageId).toBe(
    mocks.images.mock.calls[0]?.[1].clientMessageId,
  );
});

it("does not overwrite a changed draft when a previous send finishes", async () => {
  store.getState().patchRoom(chatRoom());
  store.getState().patchDraft("room-a", { content: "first" });
  const pending = deferred<ChatMessage>();
  mocks.send.mockReturnValueOnce(pending.promise);
  const send = submitChatMessage("room-a");
  store.getState().patchDraft("room-a", { content: "next" });
  pending.resolve(chatMessage("sent", "room-a", 1));
  await send;
  expect(store.getState().drafts["room-a"]?.content).toBe("next");
});

it("discards rooms, history and send responses after logout, including same-account relogin", async () => {
  const rooms = deferred<PagedResult<ChatRoom>>();
  const history = deferred<PagedResult<ChatMessage>>();
  const message = deferred<ChatMessage>();
  mocks.rooms.mockReturnValueOnce(rooms.promise);
  mocks.messages.mockReturnValueOnce(history.promise);
  mocks.send.mockReturnValueOnce(message.promise);
  store.getState().patchRoom(chatRoom());
  store.getState().patchDraft("room-a", { content: "secret" });
  const requests = [
    refreshChatRooms(),
    loadChatHistory("room-a"),
    submitChatMessage("room-a"),
  ];
  mocks.generation++;
  store.getState().activate(null);
  store.getState().activate(1);
  rooms.resolve(chatPage([chatRoom()]));
  history.resolve(chatPage([chatMessage()]));
  message.resolve(chatMessage("sent", "room-a", 1));
  await Promise.all(requests);
  expect(store.getState().rooms).toEqual([]);
  expect(store.getState().histories).toEqual({});
  expect(store.getState().drafts).toEqual({});
});

it("opens a booking through the authorized API and surfaces errors instead of creating an empty room", async () => {
  await openChatRoom({ bookingId: 101 });
  expect(mocks.booking).toHaveBeenCalledWith(101);
  mocks.booking.mockRejectedValueOnce(new Error("Forbidden"));
  await expect(openChatRoom({ bookingId: 999 })).rejects.toThrow("Forbidden");
  expect(store.getState().rooms).toHaveLength(1);
});

it("blocks sending to a closed room and rejects invalid input before making any API request", async () => {
  store.getState().patchRoom({ ...chatRoom(), isActive: false });
  store.getState().patchDraft("room-a", { content: "hello" });
  expect(await submitChatMessage("room-a")).toBe(false);
  store.getState().patchRoom(chatRoom());
  store.getState().patchDraft("room-a", { content: "a".repeat(2001) });
  expect(await submitChatMessage("room-a")).toBe(false);
  expect(mocks.send).not.toHaveBeenCalled();
  expect(mocks.images).not.toHaveBeenCalled();
});
