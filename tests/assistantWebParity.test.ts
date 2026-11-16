import { setAssistantLocale } from "../src/features/assistant/assistantLanguage";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: mocks }));
import * as mobile from "@/features/assistant/assistantService";
// The sibling application has its own Vite/DOM TypeScript configuration.
// Load it for runtime parity without typechecking its Vite imports as Expo source.
const webServicePath = new URL("../../MoveVN-FrontEnd/src/features/assistant/assistantService.ts", import.meta.url).href;
const web: typeof mobile = await import(webServicePath);

beforeEach(() => {
  setAssistantLocale("vi");
  vi.stubGlobal("crypto", { randomUUID: () => "3fa85f64-5717-4562-b3fc-2c963f66afa6" });
  vi.clearAllMocks();
  for (const method of Object.values(mocks)) method.mockResolvedValue({ status: 202, data: { data: { id: "same-server-result", status: "Queued", errorCode: null, answer: null, items: [], totalCount: 0, page: 1, pageSize: 50 } } });
});

describe("mobile/web assistant API parity", () => {
  const calls = [
    ["listConversations", []], ["createConversation", []], ["getHistory", ["conversation", 3]],
    ["sendQuestion", ["conversation", "Tìm xe", "same-client-id"]],
    ["getMessage", ["conversation", "message"]], ["handoff", ["conversation", "Cần hỗ trợ", "vi"]],
    ["sendFeedback", ["conversation", "message", false]], ["getDraft", ["conversation"]],
    ["getConversationState", ["conversation"]], ["patchDraft", ["conversation", 4, { vehicleId: 7, promoCode: null }]],
    ["prepareDraft", ["conversation", 4]], ["confirmAction", ["tok/en+1", true]],
    ["getDraftPaymentLink", ["conversation"]], ["getAssistantPaymentStatus", [71]],
  ] as const;
  it.each(calls)("%s uses identical request and response contracts", async (name, args) => {
    const invoke = async (api: typeof mobile | typeof web) => {
      for (const method of Object.values(mocks)) method.mockClear();
      const result = await (api[name] as (...values: unknown[]) => Promise<unknown>)(...args);
      return { result, get: [...mocks.get.mock.calls], post: [...mocks.post.mock.calls], patch: [...mocks.patch.mock.calls] };
    };
    expect(await invoke(mobile)).toEqual(await invoke(web));
  });

  it.each(["AI_SCHEMA_NOT_READY", "AI_UNAVAILABLE", "AI_INVALID_KEY", "AI_RATE_LIMITED", "AI_TIMEOUT", "AI_SOURCE_STALE", "AI_NO_EVIDENCE", "AI_PROVIDER_ERROR", "AI_INVALID_RESPONSE", "AI_MISSING_SOURCES", "AI_INVALID_SOURCE", "AI_PROCESSING_ERROR", "UNKNOWN"])("%s has the same user-facing failure message", code => {
    expect(mobile.assistantError(code, "vi")).toBe(web.assistantError(code, "vi"));
  });

  it.each([mobile, web])("explains schema readiness without exposing a server exception", api => {
    const error = { response: { status: 503, data: { code: "AI_SCHEMA_NOT_READY", message: "relation private_table does not exist" } } };
    expect(api.assistantFailure(error, "uncertain transport", "vi")).toContain("đang được cập nhật");
    expect(api.assistantFailure(error, "uncertain transport", "vi")).not.toContain("private_table");
  });

  it.each([400, 422])("surfaces the server validation message on both clients for HTTP %i", status => {
    const error = { response: { status, data: { message: "Ngày nhận phải ở tương lai." } } };
    expect(mobile.assistantFailure(error, "uncertain transport", "vi")).toBe("Ngày nhận phải ở tương lai.");
    expect(web.assistantFailure(error, "uncertain transport", "vi")).toBe("Ngày nhận phải ở tương lai.");
  });

  it.each([403, 404])("classifies HTTP %i as a safe definitive rejection on both clients", status => {
    const error = { response: { status, data: { message: "private server detail" } } };
    expect(mobile.assistantFailure(error, "uncertain transport", "vi")).toBe(web.assistantFailure(error, "uncertain transport", "vi"));
    expect(mobile.assistantFailure(error, "uncertain transport", "vi")).not.toMatch(/uncertain transport|private server detail/);
  });

  it.each([mobile, web])("keeps unknown transport and server errors uncertain without displaying raw bodies", api => {
    expect(api.assistantFailure(new Error("offline"), "uncertain transport")).toBe("uncertain transport");
    expect(api.assistantFailure({ response: { status: 500, data: { message: "private server detail" } } }, "uncertain transport")).toBe("uncertain transport");
  });
});
