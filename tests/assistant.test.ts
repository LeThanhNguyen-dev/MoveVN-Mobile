import { describe, expect, it, vi } from "vitest";

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
} from "@/features/assistant/assistantService";

const UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("Assistant chat + booking contract", () => {
  it("calls conversation APIs", async () => {
    mocks.post.mockResolvedValue({ data: { data: { id: UUID } } });
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
    mocks.post.mockResolvedValue({ data: { data: { id: UUID } } });
    await sendQuestion(UUID, " hello ", UUID);
    expect(mocks.post).toHaveBeenCalledWith(expect.stringContaining(`/api/assistant/conversations/${UUID}/messages`), {
      content: " hello ",
      clientMessageId: UUID,
    });
  });

  it("maps backend error codes to Vietnamese messages", () => {
    expect(assistantError("AI_RATE_LIMITED")).toContain("nhiều yêu cầu");
    expect(assistantError("AI_NO_EVIDENCE")).toContain("tìm xe");
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
    );
    expect(mocks.post).toHaveBeenCalledWith(
      expect.stringContaining(`/api/assistant/conversations/${UUID}/draft/prepare`),
      { version: 3 },
    );
    // Token xác nhận phải được encode vì chứa ký tự đặc biệt.
    expect(mocks.post).toHaveBeenCalledWith(
      "/api/assistant/actions/tok%2Fen%2B1/confirm",
      { acceptPriceChange: true },
    );
    expect(mocks.post).toHaveBeenCalledWith(
      expect.stringContaining(`/api/assistant/conversations/${UUID}/draft/payment-link`),
    );
  });
});
