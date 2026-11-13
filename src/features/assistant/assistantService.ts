import { assistantOperation } from "./assistantOperations";
import { apiClient } from "@/services/apiClient";
import i18n from "@/i18n";
import { ASSISTANT_HANDOFF_SUBJECT } from "./assistantContent";
import { decodeHistory, decodeMessage } from "./assistantProtocol";
import type { AssistantLifecycle } from "./assistantProtocol";

// Port từ FrontEnd (features/assistant/assistantService.ts), gồm cả booking
// (draft/prepare/confirm/payment-link) để chatbot đặt xe nhanh trên mobile.
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
      totalCount?: number;
    };
  }[];
  actions: { type: string; resourceId?: string }[];
  blocks?: { type: string; data: Record<string, unknown> }[];
  quickReplies?: string[];
};

export type TimelineItem = AssistantLifecycle & {
  id: string;
  role: "user" | "assistant" | "staff";
  content: string;
  createdAt: string;
  status: string;
  answer: AssistantAnswer | null;
  requestId?: string;
};

export type MessageResult = AssistantLifecycle & {
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
  return decodeHistory((await apiClient.get<{ data: Page<TimelineItem> }>(`${base}/${id}/messages`, { params: { page, pageSize: 50 }, signal })).data.data);
}

export async function sendQuestion(id: string, content: string, clientMessageId: string) {
  return decodeMessage((await apiClient.post<{ data: MessageResult }>(`${base}/${id}/messages`, { content, clientMessageId })).data.data);
}

export async function getMessage(id: string, messageId: string, signal?: AbortSignal) {
  return decodeMessage((await apiClient.get<{ data: MessageResult }>(`${base}/${id}/messages/${messageId}`, { signal })).data.data);
}

export async function handoff(id: string, message: string) {
  return (
    await apiClient.post<{ data: Conversation }>(`${base}/${id}/handoff`, {
      confirmed: true,
      subject: ASSISTANT_HANDOFF_SUBJECT,
      message,
    })
  ).data.data;
}

export async function sendFeedback(id: string, messageId: string, helpful: boolean) {
  await apiClient.post(`${base}/${id}/feedback`, { messageId, helpful });
}

export type DraftSlots = {
  vehicleId?: number | null;
  startAt?: string | null;
  endAt?: string | null;
  pickupMode?: "self_pickup" | "delivery" | null;
  pickupAddress?: string | null;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  returnAddress?: string | null;
  returnLatitude?: number | null;
  returnLongitude?: number | null;
  promoCode?: string | null;
  customerNote?: string | null;
};

export type AssistantCoords = { lat: number; lng: number };

export type AssistantQuote = {
  quoteId: string;
  vehicleId: number;
  startAt: string;
  endAt: string;
  rental: number;
  rentalDiscount: number;
  promotionDiscount: number;
  total: number;
  deposit: number;
  securityDeposit: number;
  deliveryFee: number | null;
  deliveryDistanceKm?: number | null;
  expiresAt: string;
};

export type BookingDraft = {
  draftId: string;
  version: number;
  status: string;
  slots: DraftSlots;
  missing: string[];
  quote: AssistantQuote | null;
  previousTotal: number | null;
  confirmToken: string | null;
  bookingId: number | null;
  expiresAt: string;
};

export type CancellationProposal = {
  kind: "cancel";
  bookingId: number;
  quote: { refundAmount: number; forfeitedAmount: number; policyMessage: string };
  confirmToken: string;
  expiresAt: string;
};

export type PaymentLink = { checkoutUrl: string; qrCode: string; orderCode: number; paymentLinkId: string };

export type ConfirmResult = {
  status: string;
  bookingId?: number;
  bookingCode?: string;
  payment?: PaymentLink;
  draft?: BookingDraft;
  message?: string;
};

export type ConversationState = {
  activeFilters: Record<string, unknown>;
  shownVehicles: { idx: number; id: number; pricePerDay: number }[];
  focusVehicleId: number | null;
};

export async function getDraft(id: string, signal?: AbortSignal) {
  return (await apiClient.get<{ data: BookingDraft | null }>(`${base}/${id}/draft`, { signal })).data.data;
}

export async function getConversationState(id: string, signal?: AbortSignal) {
  return (await apiClient.get<{ data: ConversationState }>(`${base}/${id}/state`, { signal })).data.data;
}

export async function patchDraft(id: string, version: number, patch: Partial<DraftSlots>) {
  const payload = { version, patch };
  return assistantOperation(id, "draft.patch", payload, async key => (await apiClient.patch<{ data: BookingDraft }>(`${base}/${id}/draft`, payload, { headers: { "Idempotency-Key": key } })).data.data);
}
export async function prepareDraft(id: string, version: number) {
  return assistantOperation(id, "draft.prepare", { version }, async key => (await apiClient.post<{ data: BookingDraft }>(`${base}/${id}/draft/prepare`, { version }, { headers: { "Idempotency-Key": key } })).data.data);
}
export async function confirmAction(token: string, acceptPriceChange = false) {
  return assistantOperation(token, "action.confirm", { acceptPriceChange }, async key => (await apiClient.post<{ data: ConfirmResult }>(`/api/assistant/actions/${encodeURIComponent(token)}/confirm`, { acceptPriceChange }, { headers: { "Idempotency-Key": key } })).data.data);
}
export async function getDraftPaymentLink(id: string) {
  return assistantOperation(id, "draft.payment-link", {}, async key => (await apiClient.post<{ data: PaymentLink }>(`${base}/${id}/draft/payment-link`, undefined, { headers: { "Idempotency-Key": key } })).data.data);
}
export async function getAssistantPaymentStatus(bookingId: number) {
  return (
    await apiClient.get<{ data: { status: string | { isConfirmed: boolean; message: string } } }>(
      `/api/assistant/payments/${bookingId}/status`,
    )
  ).data.data;
}

const ASSISTANT_ERROR_CODES = new Set([
  "AI_SCHEMA_NOT_READY",
  "AI_OUT_OF_SCOPE",
  "ASSISTANT_CONFLICT",
  "AI_STATE_SYNC_PENDING",
  "AI_QUEUE_DEADLINE_EXCEEDED",
  "AI_QUEUE_BUSY",
  "AI_UNAVAILABLE",
  "AI_INVALID_KEY",
  "AI_RATE_LIMITED",
  "AI_TIMEOUT",
  "AI_SOURCE_STALE",
  "AI_NO_EVIDENCE",
  "AI_PROVIDER_ERROR",
  "AI_INVALID_RESPONSE",
  "AI_MISSING_SOURCES",
  "AI_INVALID_SOURCE",
  "AI_PROCESSING_ERROR",
]);

export function assistantError(code?: string | null) {
  if (code === "queue_busy") code = "AI_QUEUE_BUSY";
  if (code === "queue_deadline_exceeded") code = "AI_QUEUE_DEADLINE_EXCEEDED";
  return i18n.t(
    code && ASSISTANT_ERROR_CODES.has(code)
      ? `mobile:assistant.errors.codes.${code}`
      : "mobile:assistant.errors.fallback",
  );
}

const ASSISTANT_HTTP_ERRORS = [400, 401, 403, 404, 413, 422];

/** Show only allowlisted diagnostics; upstream bodies can include implementation details. */
export function assistantFailure(error: unknown, fallback: string): string {
  const value = error as { response?: { status?: number; data?: { code?: unknown } }; message?: string };
  const code = value?.response?.data?.code;
  if (typeof code === "string" && /^(AI_|ASSISTANT_|queue_)/.test(code)) return assistantError(code);
  if (value?.message === "AI_INVALID_RESPONSE") return assistantError(value.message);
  const status = value?.response?.status;
  if (status && ASSISTANT_HTTP_ERRORS.includes(status))
    return i18n.t(`mobile:assistant.errors.http.${status}`);
  return fallback;
}
