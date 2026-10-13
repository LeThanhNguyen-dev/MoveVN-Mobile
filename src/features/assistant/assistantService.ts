import { apiClient } from "@/services/apiClient";

// Port từ FrontEnd (features/assistant/assistantService.ts)
// ĐÃ BỎ phần booking-write (draft/prepare/confirm/payment-link, BookingFunnel)
// vì mobile chưa làm booking. Chỉ giữ chat + tra cứu read-only.
export type Conversation = {
  id: string;
  status: "BotActive" | "WaitingForStaff" | "StaffActive" | "Closed";
  ticketId: number | null;
  createdAt: string;
};

export type AssistantSource = {
  id: number;
  version: number;
  title: string;
  slug: string;
  excerpt: string;
};

export type ResourceCard = {
  id: number;
  brandName?: string;
  modelName?: string;
  vehicleName?: string;
  bookingCode?: string;
  featuredImage?: string;
  vehicleImage?: string;
  pricePerDay?: number;
  totalAmount?: number;
  status?: string;
  seatCount?: number;
  transmission?: string;
  fuelType?: string;
  areaName?: string;
  features?: string[];
  totalDynamicPrice?: number | null;
  rentalDays?: number | null;
  quote?: { refundAmount: number; canCancel: boolean; policyMessage: string };
  code?: string;
  name?: string;
  description?: string;
  discountType?: string;
  discountValue?: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  vehicleType?: string;
  endAt?: string;
  rating?: number;
  comment?: string;
  averageRating?: number;
  createdAt?: string;
};

export type AssistantAnswer = {
  content: string;
  sources: AssistantSource[];
  cards: {
    name: string;
    data: ResourceCard & {
      items?: ResourceCard[];
      hasMore?: boolean;
      page?: number;
      lookupStatus?: string;
      availabilityChecked?: boolean;
      startDate?: string;
      endDate?: string;
      observedAt?: string;
    };
  }[];
  actions: { type: string; resourceId?: string }[];
  blocks?: { type: string; data: Record<string, unknown> }[];
  quickReplies?: string[];
};

export type TimelineItem = {
  id: string;
  role: "user" | "assistant" | "staff";
  content: string;
  createdAt: string;
  status: string;
  answer: AssistantAnswer | null;
  requestId?: string;
};

export type MessageResult = {
  id: string;
  status: string;
  errorCode: string | null;
  answer: AssistantAnswer | null;
};

type Page<T> = { items: T[]; totalCount: number; page: number; pageSize: number };

const base = "/api/assistant/conversations";

export async function listConversations(signal?: AbortSignal) {
  return (await apiClient.get<{ data: Page<Conversation> }>(base, { params: { pageSize: 50 }, signal })).data.data;
}

export async function createConversation() {
  return (await apiClient.post<{ data: Conversation }>(base)).data.data;
}

export async function getHistory(id: string, page = 1, signal?: AbortSignal) {
  return (await apiClient.get<{ data: Page<TimelineItem> }>(`${base}/${id}/messages`, { params: { page, pageSize: 50 }, signal })).data
    .data;
}

export async function sendQuestion(id: string, content: string, clientMessageId: string) {
  return (await apiClient.post<{ data: MessageResult }>(`${base}/${id}/messages`, { content, clientMessageId })).data.data;
}

export async function getMessage(id: string, messageId: string, signal?: AbortSignal) {
  return (await apiClient.get<{ data: MessageResult }>(`${base}/${id}/messages/${messageId}`, { signal })).data.data;
}

export async function handoff(id: string, message: string) {
  return (
    await apiClient.post<{ data: Conversation }>(`${base}/${id}/handoff`, {
      confirmed: true,
      subject: "Hỗ trợ từ trợ lý MoveVN",
      message,
    })
  ).data.data;
}

export async function sendFeedback(id: string, messageId: string, helpful: boolean) {
  await apiClient.post(`${base}/${id}/feedback`, { messageId, helpful });
}

export function assistantError(code?: string | null) {
  const messages: Record<string, string> = {
    AI_UNAVAILABLE: "Trợ lý chưa được kết nối với AI. Bạn có thể thử lại sau hoặc liên hệ nhân viên.",
    AI_INVALID_KEY: "Trợ lý đang gặp sự cố kết nối. Bạn thử lại sau hoặc liên hệ nhân viên nhé.",
    AI_RATE_LIMITED: "AI đang nhận nhiều yêu cầu. Bạn thử lại sau một chút nhé.",
    AI_TIMEOUT: "Trợ lý phản hồi lâu hơn dự kiến. Bạn có thể gửi lại câu hỏi.",
    AI_SOURCE_STALE: "Chính sách đã được cập nhật. Hãy hỏi lại để nhận thông tin mới nhất.",
    AI_NO_EVIDENCE:
      "Câu này nằm ngoài những việc mình hỗ trợ được (tìm xe, xem booking, chính sách thuê xe, khuyến mãi). Bạn hỏi về xe, booking hoặc chính sách giúp mình nhé.",
    AI_PROVIDER_ERROR: "Chưa kết nối được với trợ lý. Bạn thử lại sau hoặc liên hệ nhân viên nhé.",
    AI_INVALID_RESPONSE: "AI trả kết quả không đúng cấu trúc yêu cầu. Bạn thử gửi lại câu hỏi nhé. (AI_INVALID_RESPONSE)",
    AI_MISSING_SOURCES:
      "Câu này nằm ngoài những việc mình hỗ trợ được (tìm xe, xem booking, chính sách thuê xe, khuyến mãi). Bạn hỏi về xe, booking hoặc chính sách giúp mình nhé.",
    AI_INVALID_SOURCE: "Nguồn chính sách AI sử dụng không vượt qua kiểm tra. Bạn thử hỏi lại nhé. (AI_INVALID_SOURCE)",
    AI_PROCESSING_ERROR: "Backend gặp lỗi khi xử lý câu hỏi. Vui lòng kiểm tra log Assistant request. (AI_PROCESSING_ERROR)",
  };
  return messages[code ?? ""] ?? "Chưa thể trả lời lúc này. Bạn thử lại hoặc gặp nhân viên nhé.";
}
