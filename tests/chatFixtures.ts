import type {
  ChatMessage,
  ChatPickedImage,
  ChatRoom,
  PagedResult,
} from "@/features/chat/types";

export const chatRoom = (id = "room-a", unreadCount = 2): ChatRoom => ({
  id,
  bookingId: id === "room-a" ? 101 : 102,
  bookingCode: id === "room-a" ? "MV-101" : "MV-102",
  customerId: 1,
  customerName: "Khách Nguyễn",
  ownerId: 2,
  ownerName: "Chủ Đặng",
  vehicleId: 5,
  vehicleName: "Honda City",
  participants: [
    { userId: 1, fullName: "Khách Nguyễn", role: "Customer", isOnline: true },
    { userId: 2, fullName: "Chủ Đặng", role: "Owner", isOnline: false },
  ],
  unreadCount,
  isActive: true,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-14T00:00:00Z",
  lastMessage: {
    senderId: 2,
    text: "Hẹn nhận xe",
    sentAt: "2026-10-14T10:00:00Z",
  },
});
export const chatMessage = (
  id = "message-1",
  roomId = "room-a",
  senderId = 2,
  overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
  id,
  roomId,
  bookingId: roomId === "room-a" ? 101 : 102,
  senderId,
  senderName: senderId === 1 ? "Khách Nguyễn" : "Chủ Đặng",
  senderRole: senderId === 1 ? "Customer" : "Owner",
  content: `Tin ${id}`,
  messageType: "text",
  attachments: [],
  isRead: false,
  sentAt: "2026-10-14T10:00:00Z",
  ...overrides,
});
export const chatPickedImage = (
  id = "photo-1",
  overrides: Partial<ChatPickedImage> = {},
): ChatPickedImage => ({
  id,
  uri: `file:///${id}.jpg`,
  name: `${id}.jpg`,
  type: "image/jpeg",
  size: 1024,
  ...overrides,
});
export const chatPage = <T>(
  items: T[],
  page = 1,
  totalPages = 1,
  pageSize = 30,
): PagedResult<T> => ({
  items,
  page,
  pageSize,
  totalPages,
  totalCount: totalPages * pageSize,
});
export function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
