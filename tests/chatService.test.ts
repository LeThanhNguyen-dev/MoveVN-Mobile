import { beforeEach, expect, it, vi } from "vitest";
import {
  chatMessage,
  chatPage,
  chatPickedImage,
  chatRoom,
} from "./chatFixtures";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  cameraPermission: vi.fn(),
  camera: vi.fn(),
  library: vi.fn(),
}));
vi.mock("@/services/apiClient", () => ({
  apiClient: { get: mocks.get, post: mocks.post, put: mocks.put },
}));
vi.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: mocks.cameraPermission,
  launchCameraAsync: mocks.camera,
  launchImageLibraryAsync: mocks.library,
}));
vi.mock("expo-file-system", () => ({
  File: class {
    size = 2048;
  },
}));
vi.mock("@/features/chat/chatActions", () => ({
  newChatClientId: () => "client-key",
}));
import {
  getChatRooms,
  getChatMessages,
  getChatMessage,
  getChatImageData,
  getChatImages,
  searchChatMessages,
  sendChatImages,
  sendChatMessage,
} from "@/features/chat/chatService";
import { pickChatImages } from "@/features/chat/chatImagePicker";

beforeEach(() => {
  vi.resetAllMocks();
  mocks.cameraPermission.mockResolvedValue({ granted: true });
});

it("calls existing text and history routes with optional reply and idempotency fields", async () => {
  mocks.get.mockResolvedValue({ data: { data: chatPage([chatMessage()]) } });
  await getChatMessages("room-a", { page: 2, pageSize: 30 });
  expect(mocks.get).toHaveBeenCalledWith("/api/chats/rooms/room-a/messages", {
    params: { page: 2, pageSize: 30 },
  });
  mocks.post.mockResolvedValue({
    data: { data: chatMessage("sent", "room-a", 1) },
  });
  const body = { content: "hello", replyToId: "old", clientMessageId: "key" };
  await sendChatMessage("room-a", body);
  expect(mocks.post).toHaveBeenCalledWith(
    "/api/chats/rooms/room-a/messages",
    body,
  );
});

it("does not turn a malformed response into an empty-success screen", async () => {
  mocks.get.mockResolvedValue({ data: { data: null } });
  await expect(getChatRooms()).rejects.toThrow("Missing chat response");
  await expect(getChatMessages("room-a")).rejects.toThrow(
    "Missing chat response",
  );
});

it("searches and paginates the whole room, including history not yet loaded on the phone", async () => {
  const abort = new AbortController();
  mocks.get.mockResolvedValue({ data: { data: chatPage([chatMessage()]) } });
  await searchChatMessages("room-a", "nhận xe", 3, abort.signal);
  expect(mocks.get).toHaveBeenCalledWith(
    "/api/chats/rooms/room-a/messages/search",
    {
      params: { keyword: "nhận xe", page: 3, pageSize: 20 },
      signal: abort.signal,
    },
  );
  await getChatImages("room-a", 2, abort.signal);
  expect(mocks.get).toHaveBeenLastCalledWith("/api/chats/rooms/room-a/images", {
    params: { page: 2, pageSize: 12 },
    signal: abort.signal,
  });
  await getChatMessage("room-a", "old");
  expect(mocks.get).toHaveBeenLastCalledWith(
    "/api/chats/rooms/room-a/messages/old",
    { signal: undefined },
  );
});

it("sends native picker objects as multipart files, with image-only content and progress", async () => {
  const NativeFormData = globalThis.FormData;
  class Form {
    fields: Array<[string, unknown]> = [];
    append(key: string, value: unknown) {
      this.fields.push([key, value]);
    }
  }
  vi.stubGlobal("FormData", Form);
  try {
    mocks.post.mockResolvedValue({
      data: { data: chatMessage("image", "room-a", 1) },
    });
    const progress = vi.fn();
    await sendChatImages(
      "room-a",
      { content: "", replyToId: "quote", clientMessageId: "uuid" },
      [chatPickedImage()],
      progress,
    );
    const [url, form, config] = mocks.post.mock.calls[0]!;
    expect(url).toBe("/api/chats/rooms/room-a/messages/images");
    expect((form as Form).fields).toEqual([
      ["content", ""],
      ["replyToId", "quote"],
      ["clientMessageId", "uuid"],
      [
        "files",
        { uri: "file:///photo-1.jpg", name: "photo-1.jpg", type: "image/jpeg" },
      ],
    ]);
    config.onUploadProgress({ loaded: 51, total: 100 });
    expect(progress).toHaveBeenCalledWith(51);
    expect(config.timeout).toBe(120_000);
  } finally {
    vi.stubGlobal("FormData", NativeFormData);
  }
});

it("fetches private images through the authenticated API without trusting attachment URLs", async () => {
  mocks.get.mockResolvedValue({ data: Uint8Array.from([1, 2, 3]).buffer });
  const attachment = {
    url: "https://untrusted.example/private",
    name: "photo.jpg",
    contentType: "image/jpeg",
    size: 3,
    width: 10,
    height: 10,
  };
  expect(await getChatImageData("room-a", "image", 0, attachment)).toBe(
    "data:image/jpeg;base64,AQID",
  );
  expect(mocks.get.mock.calls[0]?.[0]).toBe(
    "/api/chats/rooms/room-a/messages/image/attachments/0",
  );
  await expect(
    getChatImageData("room-a", "image", 0, {
      ...attachment,
      contentType: "text/html",
    }),
  ).rejects.toThrow("Unsupported");
  mocks.get.mockResolvedValue({ data: new ArrayBuffer(5 * 1024 * 1024 + 1) });
  await expect(
    getChatImageData("room-a", "image", 0, attachment),
  ).rejects.toThrow("size");
});

it("handles picker cancellation, camera permission denial and supported image metadata", async () => {
  mocks.library.mockResolvedValueOnce({ canceled: true });
  expect(await pickChatImages("library", 4)).toEqual([]);
  mocks.cameraPermission.mockResolvedValueOnce({ granted: false });
  await expect(pickChatImages("camera", 4)).rejects.toThrow("Cài đặt");
  expect(mocks.camera).not.toHaveBeenCalled();
  mocks.camera.mockResolvedValueOnce({
    canceled: false,
    assets: [
      {
        uri: "file:///photo.jpg",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        fileSize: 1234,
      },
    ],
  });
  expect(await pickChatImages("camera", 4)).toEqual([
    chatPickedImage("client-key", {
      uri: "file:///photo.jpg",
      name: "photo.jpg",
      size: 1234,
      file: undefined,
    }),
  ]);
});

it("checks file info when the picker omits size and rejects excessive count or unsupported files", async () => {
  mocks.library.mockResolvedValueOnce({
    canceled: false,
    assets: [{ uri: "file:///photo.webp", fileName: "photo.webp" }],
  });
  expect((await pickChatImages("library", 4))[0]?.size).toBe(2048);
  mocks.library.mockResolvedValueOnce({
    canceled: false,
    assets: [
      { uri: "file:///photo.gif", mimeType: "image/gif", fileSize: 1024 },
    ],
  });
  await expect(pickChatImages("library", 4)).rejects.toThrow("JPG");
  await expect(pickChatImages("library", 0)).rejects.toThrow("4 ảnh");
  mocks.library.mockResolvedValueOnce({
    canceled: false,
    assets: Array.from({ length: 2 }, () => ({
      uri: "file:///photo.jpg",
      mimeType: "image/jpeg",
      fileSize: 1024,
    })),
  });
  await expect(pickChatImages("library", 1)).rejects.toThrow("4 ảnh");
});
