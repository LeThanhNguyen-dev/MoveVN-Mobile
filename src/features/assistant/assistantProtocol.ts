import type { AssistantAnswer, MessageResult, TimelineItem } from "./assistantService";

export type AssistantLifecycle = {
  turnSequence?: number; stateVersion?: number; draftVersion?: number;
  acceptedAt?: string; startedAt?: string; deadlineAt?: string; completedAt?: string; serverNow?: string;
  phase?: string; projectionStatus?: string; businessStatus?: string; outcome?: string;
  diagnostics?: { code?: string; retryable?: boolean; retryAfterSeconds?: number; traceId?: string };
};
const object = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const quote = (value: unknown) => object(value) && text(value.quoteId) && number(value.vehicleId) && date(value.startAt) && date(value.endAt)
  && date(value.expiresAt) && ["rental", "rentalDiscount", "promotionDiscount", "total", "deposit", "securityDeposit"].every(key => number(value[key]));
function safeBlock(value: unknown): boolean {
  if (!object(value) || !object(value.data)) return false;
  const data = value.data;
  if (value.type === "quoteCard") return quote(data);
  if (value.type === "draftCard") return text(data.draftId) && number(data.version);
  if (value.type !== "confirmCard" || typeof data.confirmToken !== "string" || !/^[a-f0-9]{64}$/i.test(data.confirmToken) || !date(data.expiresAt)) return false;
  if (data.kind === "cancel") return number(data.bookingId) && object(data.quote) && number(data.quote.refundAmount) && number(data.quote.forfeitedAmount) && text(data.quote.policyMessage);
  return text(data.draftId) && number(data.version) && object(data.slots) && Array.isArray(data.missing) && quote(data.quote);
}
function cardData(value: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, field] of Object.entries(value)) {
    if (field === null || typeof field === "string" || typeof field === "boolean" || number(field)) result[key] = field;
  }
  if (Array.isArray(value.features)) result.features = value.features.filter(text).slice(0, 30);
  if (object(value.quote) && number(value.quote.refundAmount)) result.quote = { refundAmount: value.quote.refundAmount, canCancel: value.quote.canCancel === true, policyMessage: typeof value.quote.policyMessage === "string" ? value.quote.policyMessage : "" };
  if (Array.isArray(value.items)) result.items = value.items.filter(object).filter(item => number(item.id)).slice(0, 50).map(cardData);
  return result;
}
/** Network data is untrusted. Invalid action blocks never become executable UI. */
export function decodeAnswer(value: unknown): AssistantAnswer | null {
  if (!object(value) || !text(value.content) || value.content.length > 8000) return null;
  return {
    content: value.content,
    sources: list(value.sources).filter(object).filter(source => number(source.id) && number(source.version) && text(source.title) && text(source.slug) && typeof source.excerpt === "string").slice(0, 12),
    cards: list(value.cards).filter(object).filter(card => typeof card.name === "string" && /^(vehicles\.(search|detail|reviews|availability)|bookings\.(list|detail|cancellationQuote)|promotions\.list|policies\.lookup)$/.test(card.name) && object(card.data)).slice(0, 12).map(card => ({ name: card.name, data: cardData(card.data as Record<string, unknown>) })),
    actions: list(value.actions).filter(object).filter(action => ["OpenVehicle", "OpenBooking", "RequestHandoff"].includes(String(action.type)) && (action.resourceId === undefined || typeof action.resourceId === "string")).slice(0, 12),
    blocks: list(value.blocks).filter(safeBlock).slice(0, 12),
    quickReplies: Array.isArray(value.quickReplies) ? value.quickReplies.filter(text).map(reply => reply.slice(0, 200)).slice(0, 6) : undefined,
  } as AssistantAnswer;
}
export function decodeMessage(value: unknown): MessageResult {
  if (!object(value) || !text(value.id) || !text(value.status)) throw new Error("AI_INVALID_RESPONSE");
  return { ...value, id: value.id, status: value.status, errorCode: typeof value.errorCode === "string" ? value.errorCode : null, answer: decodeAnswer(value.answer) } as MessageResult;
}
/** A definite client rejection needs a corrected request, rather than a blind resend. */
export function assistantSendCanRetry(error: unknown): boolean {
  const status = (error as { response?: { status?: number } } | null)?.response?.status;
  return !status || ![400, 401, 403, 404, 413, 422].includes(status);
}
export function decodeHistory<T extends { items: TimelineItem[] }>(page: T): T {
  if (!object(page) || !Array.isArray(page.items)) throw new Error("AI_INVALID_RESPONSE");
  return { ...page, items: page.items.filter(object).filter(item => text(item.id) && ["user", "assistant", "staff"].includes(String(item.role)) && typeof item.content === "string").map(item => ({ ...item, answer: decodeAnswer(item.answer) })) } as T;
}
export const isPendingMessage = (message: { status: string }) => ["Queued", "Processing"].includes(message.status);
export function pendingNotice(message: AssistantLifecycle, now = Date.now()): string | null {
  if (/committed|projecting/i.test(message.phase ?? "") || /committed/i.test(message.businessStatus ?? message.outcome ?? "")) return "Đã ghi nhận kết quả. MoveVN đang đồng bộ thông tin…";
  const deadline = message.deadlineAt ? Date.parse(message.deadlineAt) : NaN;
  return Number.isFinite(deadline) && now > deadline + 10000 ? "Chưa xác nhận được trạng thái. Bạn có thể kiểm tra lại; tin nhắn đang được giữ nguyên." : null;
}
export function actionIsExpired(data: { expiresAt?: unknown }, now = Date.now()) {
  return data.expiresAt !== undefined && (!date(data.expiresAt) || Date.parse(data.expiresAt) <= now);
}
export function answerActionsAllowed(item: { status: string; draftVersion?: number }, latestDraftVersion: number | undefined, pending: boolean) {
  return !pending && item.status === "Completed" && !(typeof item.draftVersion === "number" && typeof latestDraftVersion === "number" && item.draftVersion < latestDraftVersion);
}
/** A committed response remains visible while the Mongo history projection catches up. */
export function applyMessageResult(items: TimelineItem[], result: MessageResult): TimelineItem[] {
  const existing = items.find(item => item.role === "user" && item.requestId === result.id);
  // Reconnect/history and status polling can race. A delayed queued result may
  // not regress a terminal message or re-enable its pending controls.
  if (existing && !isPendingMessage(existing) && isPendingMessage(result)) return items;
  const next = items.map(item => item.role === "user" && item.requestId === result.id ? { ...item, ...result, id: item.id, role: item.role, content: item.content, requestId: result.id, answer: null } : item);
  if (result.status !== "Completed" || !result.answer) return next;
  const answer: TimelineItem = { ...result, id: `assistant:${result.id}`, role: "assistant", requestId: result.id, content: result.answer.content, createdAt: result.completedAt ?? new Date().toISOString(), answer: result.answer };
  const index = next.findIndex(item => item.role === "assistant" && item.requestId === result.id);
  if (index >= 0) next.splice(index, 1);
  const question = next.findIndex(item => item.role === "user" && item.requestId === result.id);
  next.splice(question < 0 ? next.length : question + 1, 0, answer);
  return next;
}
