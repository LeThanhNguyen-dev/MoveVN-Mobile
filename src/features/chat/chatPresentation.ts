import i18n from "@/i18n";
import { getFormatLocale } from "@/i18n/formatLocale";
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
    name:
      name ||
      i18n.t(owner ? "mobile:chat.counterpart.owner" : "mobile:chat.counterpart.customer", {
        id,
      }),
    avatarUrl: participant?.avatarUrl,
    isOnline: participant?.isOnline ?? false,
    lastSeenAt: participant?.lastSeenAt,
  };
}

export function chatPresenceLabel(isOnline: boolean, lastSeenAt?: string | null) {
  if (isOnline) return i18n.t("mobile:chat.presence.online");
  const lastSeen = lastSeenAt ? Date.parse(lastSeenAt) : NaN;
  if (!Number.isFinite(lastSeen)) return i18n.t("mobile:chat.presence.offline");
  const minutes = Math.max(0, Math.floor((Date.now() - lastSeen) / 60_000));
  if (minutes < 1) return i18n.t("mobile:chat.presence.justNow");
  if (minutes < 60)
    return i18n.t("mobile:chat.presence.minutes", { n: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return i18n.t("mobile:chat.presence.hours", { n: hours });
  return i18n.t("mobile:chat.presence.days", {
    n: Math.floor(hours / 24),
  });
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
    : new Intl.DateTimeFormat(getFormatLocale(), {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
}

export function validateChatImages(images: ChatPickedImage[]) {
  if (images.length > 4) return i18n.t("mobile:chat.validation.maxImages");
  for (const image of images) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type))
      return i18n.t("mobile:chat.validation.unsupportedType");
    if (
      !Number.isFinite(image.size) ||
      image.size <= 0 ||
      image.size > 5 * 1024 * 1024
    )
      return i18n.t("mobile:chat.validation.invalidSize");
  }
  return null;
}

export function validateChatDraft(content: string, images: ChatPickedImage[]) {
  if (!content.trim() && !images.length)
    return i18n.t("mobile:chat.validation.emptyDraft");
  if (content.trim().length > 2000)
    return i18n.t("mobile:chat.validation.tooLong");
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
