import { setAssistantLocale } from "../src/features/assistant/assistantLanguage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
}));

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: mocks.get, post: mocks.post, patch: mocks.patch },
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

import {
  assistantError,
  confirmAction,
  createConversation,
  getConversationState,
  getDraft,
  getDraftPaymentLink,
  getHistory,
  handoff,
  listConversations,
  patchDraft,
  prepareDraft,
  sendFeedback,
  sendQuestion,
  validatedInputContext,
} from "@/features/assistant/assistantService";

const UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

beforeEach(() => setAssistantLocale("vi"));

describe("Assistant chat + booking contract", () => {
  it("sends the language and an allowlisted vehicle reference", async () => {
    mocks.post.mockResolvedValue({ data: { data: { id: UUID, status: "Queued" } } });
    await sendQuestion(UUID, "Is this car available?", UUID, { uiLocale: "en", context: { vehicleId: 7, source: "vehicle_detail" } });
    expect(mocks.post).toHaveBeenLastCalledWith(expect.stringContaining("/messages"), { content: "Is this car available?", clientMessageId: UUID, uiLocale: "en", context: { vehicleId: 7, source: "vehicle_detail" } });
    expect(validatedInputContext({ vehicleId: -1, source: "vehicle_detail" })).toBeUndefined();
    expect(validatedInputContext({ vehicleId: 7, source: "assistant_card", sourceMessageId: "<script>" })).toBeUndefined();
    expect(validatedInputContext({ vehicleId: 7, source: "untrusted" as never })).toBeUndefined();
  });
  it("calls conversation APIs", async () => {
    mocks.post.mockResolvedValue({ status: 202, data: { data: { id: UUID, status: "Queued", errorCode: null, answer: null } } });
    mocks.get.mockResolvedValue({ data: { data: { items: [] } } });

    await createConversation();
    await listConversations();
    await getHistory(UUID);
    await sendQuestion(UUID, "Tìm xe 7 chỗ", UUID);
    await handoff(UUID, "Cần nhân viên");
    await sendFeedback(UUID, UUID, true);

    const urls = [...mocks.post.mock.calls.map((c) => c[0] as string), ...mocks.get.mock.calls.map((c) => c[0] as string)];
    expect(urls.join("\n")).toContain("/api/assistant/conversations");
  });

  it("sends camelCase clientMessageId/content matching backend SendAssistantMessageRequest", async () => {
    mocks.post.mockClear();
    mocks.post.mockResolvedValue({ status: 202, data: { data: { id: UUID, status: "Queued", errorCode: null, answer: null } } });
    await sendQuestion(UUID, " hello ", UUID);
    expect(mocks.post).toHaveBeenCalledWith(expect.stringContaining(`/api/assistant/conversations/${UUID}/messages`), {
      content: " hello ",
      clientMessageId: UUID,
    });
  });

  it("maps backend error codes to Vietnamese messages", () => {
    expect(assistantError("AI_RATE_LIMITED")).toContain("nhiều yêu cầu");
    expect(assistantError("AI_NO_EVIDENCE")).toContain("xác thực");
    expect(assistantError("AI_MISSING_SOURCES")).not.toContain("ngoài");
    expect(assistantError("UNKNOWN_CODE")).toContain("thử lại");
  });

  it("calls draft/confirm/payment endpoints matching backend routes", async () => {
    mocks.get.mockResolvedValue({ data: { data: null } });
    mocks.post.mockResolvedValue({ data: { data: {} } });
    mocks.patch.mockResolvedValue({ data: { data: {} } });

    await getDraft(UUID);
    await getConversationState(UUID);
    await patchDraft(UUID, 3, { vehicleId: 7 });
    await prepareDraft(UUID, 3);
    await confirmAction("tok/en+1", true);
    await getDraftPaymentLink(UUID);

    expect(mocks.get).toHaveBeenCalledWith(
      expect.stringContaining(`/api/assistant/conversations/${UUID}/draft`),
      expect.anything(),
    );
    expect(mocks.get).toHaveBeenCalledWith(
      expect.stringContaining(`/api/assistant/conversations/${UUID}/state`),
      expect.anything(),
    );
    expect(mocks.patch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/assistant/conversations/${UUID}/draft`),
      { version: 3, patch: { vehicleId: 7 } },
      { headers: { "Idempotency-Key": expect.any(String) } },
    );
    expect(mocks.post).toHaveBeenCalledWith(
      expect.stringContaining(`/api/assistant/conversations/${UUID}/draft/prepare`),
      { version: 3 },
      { headers: { "Idempotency-Key": expect.any(String) } },
    );
    // Token xác nhận phải được encode vì chứa ký tự đặc biệt.
    expect(mocks.post).toHaveBeenCalledWith(
      "/api/assistant/actions/tok%2Fen%2B1/confirm",
      { acceptPriceChange: true },
      { headers: { "Idempotency-Key": expect.any(String) } },
    );
    expect(mocks.post).toHaveBeenCalledWith(
      expect.stringContaining(`/api/assistant/conversations/${UUID}/draft/payment-link`),
      undefined,
      { headers: { "Idempotency-Key": expect.any(String) } },
    );
  });

  it("keeps an idempotency header after transport uncertainty and changes it for a new draft version", async () => {
    mocks.post.mockRejectedValueOnce(new Error("lost response")).mockResolvedValue({ data: { data: {} } });
    await expect(prepareDraft(UUID, 10)).rejects.toThrow("lost response");
    await prepareDraft(UUID, 10);
    await prepareDraft(UUID, 11);
    const calls = mocks.post.mock.calls;
    expect(calls[1]![2].headers["Idempotency-Key"]).toBe(calls[0]![2].headers["Idempotency-Key"]);
    expect(calls[2]![2].headers["Idempotency-Key"]).not.toBe(calls[0]![2].headers["Idempotency-Key"]);
  });

  it("uses a fresh operation key for a new confirmation token or price consent", async () => {
    mocks.post.mockRejectedValueOnce(new Error("lost response")).mockResolvedValue({ data: { data: {} } });
    await expect(confirmAction("first-token", false)).rejects.toThrow();
    await confirmAction("first-token", true);
    await confirmAction("new-token", true);
    const keys = mocks.post.mock.calls.map(call => call[2].headers["Idempotency-Key"]);
    expect(new Set(keys).size).toBe(3);
  });

  it("reuses the confirmation operation key when its response is lost and consent is unchanged", async () => {
    mocks.post.mockRejectedValueOnce(new Error("lost confirmation response")).mockResolvedValueOnce({ data: { data: { status: "PaymentPending", bookingId: 9 } } });
    await expect(confirmAction("same-uncertain-token", false)).rejects.toThrow("lost confirmation response");
    await expect(confirmAction("same-uncertain-token", false)).resolves.toMatchObject({ status: "PaymentPending", bookingId: 9 });
    expect(mocks.post.mock.calls[1]![2].headers["Idempotency-Key"]).toBe(mocks.post.mock.calls[0]![2].headers["Idempotency-Key"]);
    expect(mocks.post.mock.calls.map(call => call[1])).toEqual([{ acceptPriceChange: false }, { acceptPriceChange: false }]);
  });
});
