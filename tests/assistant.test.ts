import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/services/apiClient", () => ({
  apiClient: { get: mocks.get, post: mocks.post },
  getApiErrorMessage: (_error: unknown, fallback: string) => fallback,
}));

import {
  assistantError,
  createConversation,
  getHistory,
  handoff,
  listConversations,
  sendFeedback,
  sendQuestion,
} from "@/features/assistant/assistantService";

const UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

describe("Assistant booking-free contract", () => {
  it("calls conversation APIs without any draft/booking endpoints", async () => {
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
    // Đảm bảo không đụng tới booking-write đã cố tình bỏ lại.
    expect(urls.join("\n")).not.toMatch(/draft|prepare|confirm|payment-link|payment\/.*status/);
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
});
