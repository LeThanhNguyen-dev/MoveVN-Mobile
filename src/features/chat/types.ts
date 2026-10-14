export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages?: number;
}

export interface ChatParticipant {
  userId: number;
  fullName: string;
  role: string;
  avatarUrl?: string | null;
  isOnline: boolean;
  lastSeenAt?: string | null;
}

export interface ChatLastMessage {
  text: string;
  senderId: number;
  sentAt: string;
}

export interface ChatRoom {
  id: string;
  bookingId: number;
  bookingCode: string;
  customerId: number;
  customerName: string;
  ownerId: number;
  ownerName: string;
  vehicleId: number;
  vehicleName?: string | null;
  participants: ChatParticipant[];
  lastMessage?: ChatLastMessage | null;
  unreadCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  bookingId: number;
  senderId: number;
  senderName: string;
  senderRole: string;
  messageType: string;
  content: string;
  attachments?: ChatAttachment[];
  replyToId?: string | null;
  replyTo?: ChatReply | null;
  isRead: boolean;
  sentAt: string;
}

export interface ChatMessageCreatedPayload {
  message: ChatMessage;
  room: ChatRoom;
  recipientUnreadCounts?: Record<string, number>;
}

export interface SendChatMessageRequest {
  content: string;
  replyToId?: string;
  clientMessageId?: string;
}

export interface ChatAttachment {
  url: string;
  name: string;
  contentType: string;
  size: number;
  width: number;
  height: number;
}

export interface ChatReply {
  id: string;
  senderName: string;
  content: string;
  messageType: string;
  attachments?: ChatAttachment[];
}

export interface ChatPickedImage {
  id: string;
  uri: string;
  name: string;
  type: string;
  size: number;
  file?: Blob;
}

export interface ChatDraft {
  content: string;
  images: ChatPickedImage[];
  reply?: ChatReply;
  clientMessageId?: string;
}
