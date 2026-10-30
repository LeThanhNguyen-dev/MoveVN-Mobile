import type { ChatMessage, ChatRoom, ChatPickedImage } from "./types";

const time = (value?: string) => (value ? Date.parse(value) || 0 : 0);

export function sortChatRooms(rooms: ChatRoom[]) {
  return [...new Map(rooms.map((room) => [room.id, room])).values()].sort(
    (a, b) =>
      time(b.lastMessage?.sentAt ?? b.createdAt) -
        time(a.lastMessage?.sentAt ?? a.createdAt) || a.id.localeCompare(b.id),
  );
}

export function mergeChatMessages(roomId: string, ...lists: ChatMessage[][]) {
  const messages = new Map<string, ChatMessage>();
  for (const message of lists.flat()) {
    if (message.roomId !== roomId) continue;
    const previous = messages.get(message.id);
    messages.set(message.id, {
      ...previous,
      ...message,
      isRead: Boolean(previous?.isRead || message.isRead),
    });
  }
  return [...messages.values()].sort(
    (a, b) => time(a.sentAt) - time(b.sentAt) || a.id.localeCompare(b.id),
  );
}

export function chatCounterpart(room: ChatRoom, userId: number) {
  const owner = Number(room.ownerId) === Number(userId);
  const id = owner ? room.customerId : room.ownerId;
  const participant = room.participants.find(
    (person) => Number(person.userId) === Number(id),
  );
  const name =
    (owner ? room.customerName : room.ownerName)?.trim() ||
    participant?.fullName?.trim();
  return {
    id,
    name: name || `${owner ? "Khách thuê" : "Chủ xe"} #${id}`,
    avatarUrl: participant?.avatarUrl,
    isOnline: participant?.isOnline ?? false,
    lastSeenAt: participant?.lastSeenAt,
  };
}

export function chatPresenceLabel(isOnline: boolean, lastSeenAt?: string | null) {
  if (isOnline) return "Đang hoạt động";
  const lastSeen = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
  if (!Number.isFinite(lastSeen)) return "Hiện không hoạt động";
  const minutes = Math.max(0, Math.floor((Date.now() - lastSeen) / 60_000));
  if (minutes < 1) return "Vừa hoạt động";
  if (minutes < 60) return `Hoạt động ${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hoạt động ${hours} giờ trước`;
  return `Hoạt động ${Math.floor(hours / 24)} ngày trước`;
}

export function normalizeChatSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase();
}

export function chatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

export function validateChatImages(images: ChatPickedImage[]) {
  if (images.length > 4) return "Mỗi tin nhắn chỉ gửi tối đa 4 ảnh.";
  for (const image of images) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type))
      return "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.";
    if (
      !Number.isFinite(image.size) ||
      image.size <= 0 ||
      image.size > 5 * 1024 * 1024
    )
      return "Mỗi ảnh phải có dữ liệu và không vượt quá 5 MB.";
  }
  return null;
}

export function validateChatDraft(content: string, images: ChatPickedImage[]) {
  if (!content.trim() && !images.length)
    return "Nhập tin nhắn hoặc chọn ảnh trước khi gửi.";
  if (content.trim().length > 2000)
    return "Tin nhắn không vượt quá 2.000 ký tự.";
  return validateChatImages(images);
}

export function bytesToBase64(bytes: Uint8Array) {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const chunks: string[] = [];
  let chunk = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!;
    const b = bytes[i + 1];
    const c = bytes[i + 2];
    chunk +=
      alphabet[a >> 2]! +
      alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)]! +
      (b === undefined ? "=" : alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)]!) +
      (c === undefined ? "=" : alphabet[c & 63]!);
    if (chunk.length >= 8192) {
      chunks.push(chunk);
      chunk = "";
    }
  }
  chunks.push(chunk);
  return chunks.join("");
}
