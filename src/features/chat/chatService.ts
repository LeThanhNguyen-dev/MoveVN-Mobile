import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type {
  ChatMessage,
  ChatRoom,
  PagedResult,
  SendChatMessageRequest,
  ChatPickedImage,
  ChatAttachment,
} from "@/features/chat/types";
import { appendUploadFile } from "@/types/upload";
import { bytesToBase64 } from "./chatPresentation";

function requireData<T>(response: ApiResponse<T>): T {
  if (response.data == null) throw new Error("Missing chat response.");
  return response.data;
}

export async function getChatRooms(
  params: { page?: number; pageSize?: number } = {},
): Promise<PagedResult<ChatRoom>> {
  const res = await apiClient.get<ApiResponse<PagedResult<ChatRoom>>>(
    endpoints.chats.rooms,
    { params },
  );
  return requireData(res.data);
}

export async function getOrCreateChatRoomByBooking(
  bookingId: number,
): Promise<ChatRoom> {
  const res = await apiClient.post<ApiResponse<ChatRoom>>(
    endpoints.chats.roomByBooking(bookingId),
  );
  return requireData(res.data);
}

export async function getChatMessages(
  roomId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PagedResult<ChatMessage>> {
  const res = await apiClient.get<ApiResponse<PagedResult<ChatMessage>>>(
    endpoints.chats.messages(roomId),
    { params },
  );
  return requireData(res.data);
}

export async function sendChatMessage(
  roomId: string,
  data: SendChatMessageRequest,
): Promise<ChatMessage> {
  const res = await apiClient.post<ApiResponse<ChatMessage>>(
    endpoints.chats.messages(roomId),
    data,
  );
  return requireData(res.data);
}

export async function markChatRoomAsRead(roomId: string): Promise<ChatRoom> {
  const res = await apiClient.put<ApiResponse<ChatRoom>>(
    endpoints.chats.read(roomId),
  );
  return requireData(res.data);
}

export async function getChatRoom(roomId: string): Promise<ChatRoom> {
  const res = await apiClient.get<ApiResponse<ChatRoom>>(
    `${endpoints.chats.rooms}/${encodeURIComponent(roomId)}`,
  );
  return requireData(res.data);
}

export async function searchChatMessages(
  roomId: string,
  keyword: string,
  page = 1,
  signal?: AbortSignal,
): Promise<PagedResult<ChatMessage>> {
  const res = await apiClient.get<ApiResponse<PagedResult<ChatMessage>>>(
    `${endpoints.chats.messages(roomId)}/search`,
    { params: { keyword, page, pageSize: 20 }, signal },
  );
  return requireData(res.data);
}

export async function getChatImages(
  roomId: string,
  page = 1,
  signal?: AbortSignal,
): Promise<PagedResult<ChatMessage>> {
  const res = await apiClient.get<ApiResponse<PagedResult<ChatMessage>>>(
    `${endpoints.chats.rooms}/${roomId}/images`,
    { params: { page, pageSize: 12 }, signal },
  );
  return requireData(res.data);
}

export async function getChatMessage(
  roomId: string,
  messageId: string,
  signal?: AbortSignal,
): Promise<ChatMessage> {
  const res = await apiClient.get<ApiResponse<ChatMessage>>(
    `${endpoints.chats.messages(roomId)}/${encodeURIComponent(messageId)}`,
    { signal },
  );
  return requireData(res.data);
}

export async function sendChatImages(
  roomId: string,
  data: SendChatMessageRequest,
  images: ChatPickedImage[],
  onProgress: (percent: number) => void,
): Promise<ChatMessage> {
  const form = new FormData();
  form.append("content", data.content);
  if (data.replyToId) form.append("replyToId", data.replyToId);
  if (data.clientMessageId)
    form.append("clientMessageId", data.clientMessageId);
  images.forEach((image) =>
    appendUploadFile(
      form,
      "files",
      image.file ?? { uri: image.uri, name: image.name, type: image.type },
    ),
  );
  const res = await apiClient.post<ApiResponse<ChatMessage>>(
    `${endpoints.chats.messages(roomId)}/images`,
    form,
    {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120_000,
      onUploadProgress: (event) =>
        onProgress(
          event.total
            ? Math.min(100, Math.round((event.loaded * 100) / event.total))
            : 0,
        ),
    },
  );
  return requireData(res.data);
}

// Always use the authenticated API, never provider URLs or tokens in a URL.
// In-memory data URIs also avoid retaining private images in a shared disk cache.
export async function getChatImageData(
  roomId: string,
  messageId: string,
  index: number,
  attachment: ChatAttachment,
  signal?: AbortSignal,
) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(attachment.contentType)
  )
    throw new Error("Unsupported chat image.");
  const res = await apiClient.get<ArrayBuffer>(
    `${endpoints.chats.messages(roomId)}/${encodeURIComponent(messageId)}/attachments/${index}`,
    { responseType: "arraybuffer", signal },
  );
  const bytes = new Uint8Array(res.data);
  if (!bytes.length || bytes.length > 5 * 1024 * 1024)
    throw new Error("Invalid chat image size.");
  return `data:${attachment.contentType};base64,${bytesToBase64(bytes)}`;
}
