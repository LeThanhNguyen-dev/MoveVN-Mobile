import React, { forwardRef, useEffect, useImperativeHandle } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  chatMessage,
  chatPage,
  chatPickedImage,
  chatRoom,
  deferred,
} from "./chatFixtures";
import type { ChatMessage, PagedResult } from "@/features/chat/types";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({
  rooms: vi.fn(),
  room: vi.fn(),
  messages: vi.fn(),
  read: vi.fn(),
  send: vi.fn(),
  images: vi.fn(),
  search: vi.fn(),
  gallery: vi.fn(),
  message: vi.fn(),
  imageData: vi.fn(),
  pick: vi.fn(),
  back: vi.fn(),
  booking: vi.fn(),
  open: vi.fn(),
  platform: "android",
  topInset: 0,
  windowTop: 0,
}));
vi.mock("@/features/auth/hooks/useAuth", () => ({
  getAuthUser: () => ({ userId: 1 }),
  getToken: () => "token",
  getSessionGeneration: () => 0,
  useAuthStore: (selector: (state: { user: { userId: number } }) => unknown) =>
    selector({ user: { userId: 1 } }),
}));
vi.mock("@/services/apiClient", () => ({
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));
vi.mock("@/features/notifications/components/NotificationBell", () => ({
  default: () => React.createElement("NotificationBell"),
}));
vi.mock("@react-navigation/native", () => ({
  useFocusEffect: (effect: () => (() => void) | undefined) =>
    useEffect(effect, [effect]),
}));
vi.mock("@/features/chat/chatImagePicker", () => ({
  pickChatImages: mocks.pick,
}));
vi.mock("@/features/chat/chatService", () => ({
  getChatRooms: mocks.rooms,
  getChatRoom: mocks.room,
  getOrCreateChatRoomByBooking: mocks.room,
  getChatMessages: mocks.messages,
  markChatRoomAsRead: mocks.read,
  sendChatMessage: mocks.send,
  sendChatImages: mocks.images,
  searchChatMessages: mocks.search,
  getChatImages: mocks.gallery,
  getChatMessage: mocks.message,
  getChatImageData: mocks.imageData,
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator",
  Pressable: "Pressable",
  Text: "Text",
  View: "View",
  Image: "Image",
  ScrollView: "ScrollView",
  RefreshControl: "RefreshControl",
  KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { get OS() { return mocks.platform; } },
  StyleSheet: { flatten: function flatten(style: unknown): Record<string, unknown> { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style && typeof style === "object" ? style as Record<string, unknown> : {}; }, create: (styles: unknown) => styles, hairlineWidth: 1 },
  TextInput: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({ focus: vi.fn() }));
    return React.createElement("TextInput", props);
  }),
  Modal: ({
    visible,
    children,
    onRequestClose,
  }: {
    visible: boolean;
    children: React.ReactNode;
    onRequestClose: () => void;
  }) =>
    visible ? React.createElement("Modal", { onRequestClose }, children) : null,
  FlatList: forwardRef(
    (
      {
        data,
        renderItem,
        ListEmptyComponent,
        ListFooterComponent,
        ...props
      }: {
        data: unknown[];
        renderItem: (props: { item: unknown }) => React.ReactNode;
        ListEmptyComponent?: React.ReactNode;
        ListFooterComponent?: React.ReactNode;
      },
      ref,
    ) => {
      useImperativeHandle(ref, () => ({ scrollToOffset: vi.fn() }));
      return React.createElement(
        "FlatList",
        props,
        data.length
          ? data.map((item, i) =>
              React.createElement(
                React.Fragment,
                { key: i },
                renderItem({ item }),
              ),
            )
          : ListEmptyComponent,
        ListFooterComponent,
      );
    },
  ),
}));
vi.mock("react-native-safe-area-context", () => ({
  SafeAreaView: forwardRef((props: Record<string, unknown>, ref) => {
    useImperativeHandle(ref, () => ({ measureInWindow: (callback: (x: number, y: number) => void) => callback(0, mocks.windowTop) }));
    return React.createElement("SafeAreaView", props);
  }),
  SafeAreaProvider: "SafeAreaProvider",
  useSafeAreaInsets: () => ({ top: mocks.topInset, bottom: 34, left: 0, right: 0 }),
}));
vi.mock("lucide-react-native", () =>
  Object.fromEntries(
    [
      "ArrowDown",
      "ArrowLeft",
      "Camera",
      "ImagePlus",
      "Images",
      "Search",
      "Send",
      "X",
      "Reply",
      "MessageSquare",
      "RefreshCw",
    ].map((name) => [name, name]),
  ),
);
import ChatRoomScreen from "@/features/chat/screens/ChatRoomScreen";
import ChatListScreen from "@/features/chat/screens/ChatListScreen";
import { useChatStore as store } from "@/features/chat/useChat";
import { useThemeStore } from "@/theme/useThemeStore";

let tree: ReactTestRenderer | undefined;
const text = () =>
  tree!.root
    .findAll((node) => typeof node.type === "string")
    .map((node) =>
      (node.type as unknown) === "Text"
        ? node.children.filter((value) => typeof value === "string").join("")
        : `${node.props.accessibilityLabel ?? ""} ${node.props.value ?? ""}`,
    )
    .join("\n");
beforeEach(() => {
  vi.resetAllMocks();
  mocks.platform = "android";
  mocks.topInset = 0;
  mocks.windowTop = 0;
  store.getState().activate(null);
  store.getState().activate(1);
  mocks.rooms.mockResolvedValue(chatPage([chatRoom()]));
  mocks.room.mockResolvedValue(chatRoom());
  mocks.messages.mockResolvedValue(chatPage([chatMessage()]));
  mocks.read.mockResolvedValue(chatRoom("room-a", 0));
  mocks.send.mockImplementation(
    async (_room: string, body: { content: string; replyToId?: string }) =>
      chatMessage("sent", "room-a", 1, {
        content: body.content,
        replyToId: body.replyToId,
      }),
  );
  mocks.images.mockResolvedValue(
    chatMessage("sent-image", "room-a", 1, {
      content: "",
      attachments: [
        {
          name: "photo.jpg",
          url: "/api/private",
          contentType: "image/jpeg",
          size: 1024,
          width: 10,
          height: 10,
        },
      ],
    }),
  );
  mocks.pick.mockResolvedValue([chatPickedImage()]);
  mocks.imageData.mockResolvedValue("data:image/jpeg;base64,AQID");
  mocks.search.mockResolvedValue(
    chatPage(
      [chatMessage("old", "room-a", 2, { content: "Nội dung cũ" })],
      1,
      2,
    ),
  );
  mocks.gallery.mockResolvedValue(
    chatPage(
      [
        chatMessage("photo-message", "room-a", 2, {
          attachments: [
            {
              name: "gallery.jpg",
              url: "/api/private",
              contentType: "image/jpeg",
              size: 1024,
              width: 10,
              height: 10,
            },
          ],
        }),
      ],
      1,
      2,
    ),
  );
  mocks.message.mockResolvedValue(
    chatMessage("original", "room-a", 2, { content: "Tin nhắn gốc đầy đủ" }),
  );
});
afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});
async function mount(roomId = "room-a") {
  await act(async () => {
    tree = create(
      React.createElement(ChatRoomScreen, {
        roomId,
        onBack: mocks.back,
        onBookingPress: mocks.booking,
      }),
    );
  });
}
async function press(label: string) {
  const button = tree!.root.findAll(
    (node) =>
      (node.type as unknown) === "Pressable" &&
      node.props.accessibilityLabel === label,
  )[0];
  expect(button, label).toBeDefined();
  expect(button!.props.disabled, `${label} disabled`).not.toBe(true);
  await act(async () => {
    await button!.props.onPress();
  });
}
async function type(label: string, value: string) {
  const field = tree!.root.find(
    (node) =>
      (node.type as unknown) === "TextInput" &&
      node.props.accessibilityLabel === label,
  );
  await act(async () => field.props.onChangeText(value));
}

it("opens the customer's booking room, reads it, replies and sends a scoped message", async () => {
  await mount();
  expect(text()).toContain("Chủ Đặng");
  expect(text()).toContain("MV-101");
  expect(mocks.read).toHaveBeenCalledWith("room-a");
  await press("Trả lời tin nhắn message-1");
  expect(text()).toContain("Trả lời Chủ Đặng");
  await type("Nội dung tin nhắn", "Mình đến lúc 8h");
  await press("Gửi tin nhắn");
  expect(mocks.send.mock.calls[0]).toEqual([
    "room-a",
    expect.objectContaining({
      content: "Mình đến lúc 8h",
      replyToId: "message-1",
      clientMessageId: expect.any(String),
    }),
  ]);
  expect(store.getState().drafts["room-a"]?.content).toBe("");
  expect(text()).toContain("Mình đến lúc 8h");
  await press("Xem booking");
  expect(mocks.booking).toHaveBeenCalledWith(101);
});

it("accounts for the iPhone safe area and actual screen position while composing and sending", async () => {
  mocks.platform = "ios";
  mocks.topInset = 59;
  mocks.windowTop = 83;
  await mount();
  const avoidingView = () => tree!.root.find(n => n.type as unknown === "KeyboardAvoidingView");
  expect(avoidingView().props.behavior).toBe("padding");
  expect(avoidingView().props.keyboardVerticalOffset).toBe(59);
  const rootScreen = tree!.root.findAll(n => n.type as unknown === "SafeAreaView")[0]!;
  await act(async () => rootScreen.props.onLayout());
  expect(avoidingView().props.keyboardVerticalOffset).toBe(83);
  expect(avoidingView().findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === "Nội dung tin nhắn")).toHaveLength(1);
  await type("Nội dung tin nhắn", "Tin nhắn trên iPhone");
  expect(text()).toContain("Tin nhắn trên iPhone");
  await press("Gửi tin nhắn");
  expect(mocks.send).toHaveBeenCalledWith("room-a", expect.objectContaining({ content: "Tin nhắn trên iPhone" }));
});

it("keeps Android resize behaviour independent of the iOS keyboard offset", async () => {
  mocks.topInset = 24;
  await mount();
  const avoidingView = tree!.root.find(n => n.type as unknown === "KeyboardAvoidingView");
  expect(avoidingView.props.behavior).toBe("height");
  expect(avoidingView.props.keyboardVerticalOffset).toBe(0);
});

it("lets the user choose/remove images and retry an image-only send without losing the draft", async () => {
  await mount();
  await press("Chọn ảnh");
  expect(text()).toContain("Bỏ ảnh photo-1.jpg");
  await press("Bỏ ảnh photo-1.jpg");
  expect(store.getState().drafts["room-a"]?.images).toEqual([]);
  await press("Chụp ảnh");
  expect(mocks.pick).toHaveBeenLastCalledWith("camera", 4);
  mocks.images.mockRejectedValueOnce(new Error("offline"));
  await press("Gửi tin nhắn");
  expect(text()).toContain("Bản nháp được giữ lại");
  expect(store.getState().drafts["room-a"]?.images).toHaveLength(1);
  await press("Gửi tin nhắn");
  expect(store.getState().drafts["room-a"]?.images).toEqual([]);
  expect(text()).toContain("Xem ảnh photo.jpg");
});

it("displays picker failures and keeps an existing draft untouched", async () => {
  await mount();
  await type("Nội dung tin nhắn", "Bản nháp");
  mocks.pick.mockRejectedValueOnce(
    new Error("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."),
  );
  await press("Chọn ảnh");
  expect(text()).toContain("Chỉ hỗ trợ ảnh JPG");
  expect(store.getState().drafts["room-a"]?.content).toBe("Bản nháp");
});

it("searches old messages on the server, changes page, and replies to an unloaded message", async () => {
  await mount();
  await press("Tìm trong chat booking");
  await type("Từ khóa tìm tin nhắn", "nhận xe");
  await press("Tìm tin nhắn");
  expect(mocks.search).toHaveBeenCalledWith(
    "room-a",
    "nhận xe",
    1,
    expect.any(AbortSignal),
  );
  expect(text()).toContain("Nội dung cũ");
  await press("Trang sau");
  expect(mocks.search).toHaveBeenLastCalledWith(
    "room-a",
    "nhận xe",
    2,
    expect.any(AbortSignal),
  );
  await press("Trả lời tin nhắn old");
  expect(text()).not.toContain("Tìm trong booking");
  expect(store.getState().drafts["room-a"]?.reply?.id).toBe("old");
});

it("shows scoped gallery pages, opens a private full-size image and supports Android back", async () => {
  await mount();
  await press("Thư viện ảnh booking");
  expect(mocks.gallery).toHaveBeenCalledWith(
    "room-a",
    1,
    expect.any(AbortSignal),
  );
  await press("Trang sau");
  expect(mocks.gallery).toHaveBeenLastCalledWith(
    "room-a",
    2,
    expect.any(AbortSignal),
  );
  await press("Xem ảnh gallery.jpg");
  expect(text()).toContain("Đóng ảnh");
  const photo = tree!.root.find((node) => (node.type as unknown) === "Modal");
  await act(async () => photo.props.onRequestClose());
  expect(text()).toContain("Ảnh của booking");
  expect(text()).toContain("2/2");
});

it("fetches the complete original quoted message even when it is not in the loaded history", async () => {
  mocks.messages.mockResolvedValueOnce(
    chatPage([
      chatMessage("reply", "room-a", 2, {
        replyToId: "original",
        replyTo: {
          id: "original",
          senderName: "Chủ Đặng",
          content: "Preview",
          messageType: "text",
        },
      }),
    ]),
  );
  await mount();
  await press("Xem tin nhắn được trả lời");
  expect(mocks.message).toHaveBeenCalledWith(
    "room-a",
    "original",
    expect.any(AbortSignal),
  );
  expect(text()).toContain("Tin nhắn gốc đầy đủ");
  await press("Đóng tin nhắn gốc");
  expect(text()).not.toContain("Tin nhắn gốc đầy đủ");
});

it("keeps booking drafts isolated when changing rooms", async () => {
  await mount();
  await type("Nội dung tin nhắn", "Phòng A");
  await press("Chọn ảnh");
  mocks.room.mockResolvedValueOnce(chatRoom("room-b"));
  mocks.messages.mockResolvedValueOnce(chatPage([chatMessage("b", "room-b")]));
  await act(async () =>
    tree!.update(
      React.createElement(ChatRoomScreen, {
        roomId: "room-b",
        onBack: mocks.back,
        onBookingPress: mocks.booking,
      }),
    ),
  );
  expect(text()).not.toContain("Bỏ ảnh photo-1.jpg");
  await type("Nội dung tin nhắn", "Phòng B");
  expect(store.getState().drafts["room-a"]?.content).toBe("Phòng A");
  expect(store.getState().drafts["room-b"]?.content).toBe("Phòng B");
});

it("retains received messages during a delayed initial history request", async () => {
  const pending = deferred<PagedResult<ChatMessage>>();
  mocks.messages.mockReturnValueOnce(pending.promise);
  await mount();
  await act(async () =>
    store.getState().receive({
      room: chatRoom(),
      message: chatMessage("live", "room-a", 2, {
        content: "Vừa nhận trực tiếp",
      }),
    }),
  );
  await act(async () => pending.resolve(chatPage([chatMessage()])));
  expect(text()).toContain("Vừa nhận trực tiếp");
  expect(text()).toContain("Tin message-1");
});

it("shows a room error with retry, and leaves closed conversations read-only", async () => {
  mocks.room.mockRejectedValueOnce(new Error("forbidden"));
  await mount();
  expect(text()).toContain("Không mở được chat booking");
  mocks.room.mockResolvedValueOnce({ ...chatRoom(), isActive: false });
  mocks.read.mockResolvedValue({
    ...chatRoom("room-a", 0),
    isActive: false,
  });
  await press("Thử mở lại chat");
  expect(text()).toContain("Cuộc trò chuyện đã đóng");
  expect(text()).not.toContain("Gửi tin nhắn");
});

it("filters the list by Vietnamese names and booking code and opens the selected room", async () => {
  await act(async () => {
    tree = create(React.createElement(ChatListScreen, { onOpen: mocks.open }));
  });
  expect(text()).toContain("Chủ Đặng");
  await type("Tìm booking hoặc người trò chuyện", "chu dang");
  await press("Chủ Đặng, MV-101, 2 chưa đọc");
  expect(mocks.open).toHaveBeenCalledWith("room-a");
  await type("Tìm booking hoặc người trò chuyện", "no match");
  expect(text()).toContain("Không tìm thấy booking");
});

it("uses an authenticated in-memory image source in dark mode and allows retry after an image fetch error", async () => {
  // Theme state is restored after this test to keep the other screens independent.
  const original = useThemeStore.getState();
  useThemeStore.setState({ mode: "dark" });
  try {
    mocks.messages.mockResolvedValueOnce(
      chatPage([
        chatMessage("img", "room-a", 2, {
          attachments: [
            {
              name: "private.jpg",
              url: "/api/private",
              contentType: "image/jpeg",
              size: 1024,
              width: 10,
              height: 10,
            },
          ],
        }),
      ]),
    );
    mocks.imageData.mockRejectedValueOnce(new Error("offline"));
    await mount();
    expect(text()).toContain("Tải lại ảnh private.jpg");
    await press("Tải lại ảnh private.jpg");
    const image = tree!.root.find((node) => (node.type as unknown) === "Image");
    expect(image.props.source.uri).toBe("data:image/jpeg;base64,AQID");
  } finally {
    await act(async () => useThemeStore.setState(original));
  }
});
