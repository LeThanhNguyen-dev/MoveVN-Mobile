import { setAssistantLocale } from "../src/features/assistant/assistantLanguage";
import { useAssistantUi } from "../src/features/assistant/useAssistantUi";
import React, { forwardRef, useImperativeHandle } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ list: vi.fn(), history: vi.fn(), send: vi.fn(), getDraft: vi.fn(), state: vi.fn(), patch: vi.fn(), stored: vi.fn(), handoff: vi.fn(), feedback: vi.fn(), getMessage: vi.fn(), event: null as null | ((event: { conversationId: string; status: string }) => void) }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" }, StyleSheet: { create: (value: unknown) => value, hairlineWidth: 1 },
  FlatList: forwardRef(({ data, renderItem, ListEmptyComponent, ListHeaderComponent, ListFooterComponent }: any, ref) => {
    useImperativeHandle(ref, () => ({ scrollToEnd: vi.fn() }));
    return React.createElement("FlatList", {}, ListHeaderComponent, data.length ? data.map((item: any) => React.createElement(React.Fragment, { key: item.id }, renderItem({ item }))) : ListEmptyComponent, ListFooterComponent);
  }),
}));
vi.mock("lucide-react-native", () => Object.fromEntries(["Bot", "CalendarCheck", "Headphones", "History", "Plus", "RotateCcw", "Send", "ThumbsDown", "ThumbsUp", "X"].map(name => [name, name])));
vi.mock("expo-image", () => ({ Image: "Image" }));
vi.mock("expo-secure-store", () => ({ getItemAsync: mocks.stored, setItemAsync: vi.fn(async () => {}), deleteItemAsync: vi.fn(async () => {}) }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/features/auth/hooks/useAuth", () => ({ useAuthStore: (selector: any) => selector({ user: { userId: 1, roles: ["Customer"] } }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_err: unknown, fallback: string) => fallback }));
vi.mock("@/features/assistant/assistantConnection", () => ({ subscribeAssistant: (event: any) => { mocks.event = event; return () => {}; } }));
vi.mock("@/features/assistant/components/AssistantBooking", () => ({ AgentBlocks: "AgentBlocks", BookingPaymentCard: "BookingPaymentCard", ConfirmationCard: "ConfirmationCard" }));
vi.mock("@/features/assistant/components/BookingFunnel", () => ({ default: "BookingFunnel" }));
vi.mock("@/features/locations/components/AddressAutocomplete", () => ({ default: "AddressAutocomplete" }));
vi.mock("@/features/cms/screens/PolicyDetailScreen", () => ({ default: "PolicyDetailScreen" }));
vi.mock("@/features/assistant/assistantService", () => ({
  listConversations: mocks.list, getHistory: mocks.history, sendQuestion: mocks.send, getDraft: mocks.getDraft, getConversationState: mocks.state, patchDraft: mocks.patch, prepareDraft: vi.fn(),
  createConversation: vi.fn(), getMessage: mocks.getMessage, handoff: mocks.handoff, sendFeedback: mocks.feedback, assistantError: () => "Error", assistantFailure: (_error: unknown, fallback: string) => fallback,
}));
import AssistantScreen from "@/features/assistant/screens/AssistantScreen";
import { getAssistantReplies } from "@/features/assistant/assistantPresentation";

let tree: ReactTestRenderer;
const current = { id: "c1", status: "BotActive", ticketId: null, createdAt: "2026-10-22" };
const answer = {
  content: "Chính sách thuê xe", sources: [{ id: 1, slug: "thue-xe", title: "Chính sách thuê xe" }], actions: [],
  cards: [{ name: "vehicles.search", data: { items: [{ id: 7, brandName: "Honda", modelName: "City" }], hasMore: true } }],
};
const message = { id: "m1", role: "assistant", status: "Completed", content: "Tìm được xe", createdAt: "2026-10-22", answer };
const props = { onBack: vi.fn(), onQuickBook: vi.fn(), onViewVehicle: vi.fn(), onViewBooking: vi.fn() };
async function render() { await act(async () => { tree = create(React.createElement(AssistantScreen, props)); }); }
function button(label: string) {
  const match = tree.root.findAllByType("Pressable" as never).find(node => JSON.stringify(node.findAllByType("Text" as never).map(text => text.props.children)).includes(label));
  if (!match) throw new Error(`Missing ${label}`); return match;
}
async function press(label: string) { await act(async () => { button(label).props.onPress(); }); }
beforeEach(() => {
  setAssistantLocale("vi"); useAssistantUi.setState({ vehicleDetailId: null });
  vi.clearAllMocks(); mocks.stored.mockResolvedValue(null);
  mocks.list.mockResolvedValue({ items: [current] });
  mocks.history.mockResolvedValue({ items: [message], totalCount: 1 });
  mocks.send.mockResolvedValue({ status: "Completed" });
  mocks.getDraft.mockResolvedValue(null); mocks.patch.mockResolvedValue({});
  mocks.handoff.mockResolvedValue({ ...current, status: "WaitingForStaff", ticketId: 45 });
  mocks.getMessage.mockResolvedValue({ status: "Failed", errorCode: "AI_UNAVAILABLE" });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); vi.useRealTimers(); });

it("does not turn failed resource lookups into empty catalog or promotion messages", async () => {
  mocks.history.mockResolvedValue({ items: [{ ...message, answer: { ...answer, cards: ["promotions.list", "vehicles.reviews", "vehicles.search"].map(name => ({ name, data: { items: [], lookupStatus: "unavailable", availabilityChecked: false } })) } }], totalCount: 1 });
  await render();
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain("Tra cứu đang gián đoạn");
  expect(output).not.toContain("Hiện chưa có mã giảm giá nào");
  expect(output).not.toContain("Xe này chưa có đánh giá công khai");
  expect(output).not.toContain("cần ngày nhận và trả để kiểm tra lịch trống");
});

it("opens a policy source and returns to the conversation", async () => {
  await render(); await press("Chính sách thuê xe");
  const detail = tree.root.findByType("PolicyDetailScreen" as never);
  expect(detail.props.slug).toBe("thue-xe");
  await act(async () => detail.props.onBack());
  expect(button("Chính sách thuê xe")).toBeDefined();
});

it("opens the booking funnel before a vehicle is selected and requests more search results", async () => {
  await render(); await press("Xem thêm xe");
  expect(mocks.send).toHaveBeenCalledWith("c1", "Xem thêm xe", expect.any(String), { uiLocale: "vi" });
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Đặt xe nhanh" }).props.onPress());
  const funnel = tree.root.findByType("BookingFunnel" as never);
  expect(funnel.props.conversationId).toBe("c1");
  expect(funnel.props.vehicles[0].id).toBe(7);
  expect(props.onQuickBook).not.toHaveBeenCalled();
});

it("reuses the same request id after a lost send response", async () => {
  mocks.send.mockRejectedValueOnce(new Error("offline"));
  await render();
  const input = tree.root.findAllByType("TextInput" as never)[0]!;
  await act(async () => input.props.onChangeText("Tìm xe"));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  await press("Thử lại");
  expect(mocks.send.mock.calls[1]).toEqual(mocks.send.mock.calls[0]);
});

it("retains the draft and request id while schema readiness is temporarily unavailable", async () => {
  mocks.send.mockRejectedValueOnce({ response: { status: 503, data: { code: "AI_SCHEMA_NOT_READY" } } });
  await render();
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("Xin chào"));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  expect(tree.root.findAllByType("TextInput" as never)[0]!.props.value).toBe("Xin chào");
  await press("Thử lại");
  expect(mocks.send.mock.calls[1]).toEqual(mocks.send.mock.calls[0]);
});

it.each([400, 403, 404])("preserves the draft without offering a blind resend after HTTP %i", async status => {
  mocks.send.mockRejectedValueOnce({ response: { status, data: { message: "private server detail" } } });
  await render();
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("Xin chào"));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  expect(tree.root.findAllByType("TextInput" as never)[0]!.props.value).toBe("Xin chào");
  expect(tree.root.findAllByType("Pressable" as never).filter(node => JSON.stringify(node.findAllByType("Text" as never).map(text => text.props.children)).includes("Thử lại"))).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).not.toContain("private server detail");
});

it("accepts the next composed turn while an earlier accepted turn is queued", async () => {
  mocks.history.mockResolvedValue({ items: [{ id: "user:q1", role: "user", status: "Queued", content: "Tìm xe", requestId: "q1", createdAt: "2026-10-27T00:00:00Z" }], totalCount: 1 });
  mocks.send.mockResolvedValue({ id: "q2", status: "Queued", answer: null });
  await render();
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("Xe ở Đà Nẵng"));
  expect(tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.disabled).toBe(false);
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  expect(mocks.send).toHaveBeenCalledWith("c1", "Xe ở Đà Nẵng", expect.any(String), { uiLocale: "vi" });
});

it("polls each accepted request through repeated Processing responses without realtime", async () => {
  vi.useFakeTimers();
  mocks.history.mockResolvedValue({ items: [{ id: "user:q1", role: "user", status: "Queued", content: "Tìm xe", requestId: "q1", createdAt: "2026-10-27T00:00:00Z" }], totalCount: 1 });
  mocks.getMessage.mockResolvedValueOnce({ id: "q1", status: "Processing" }).mockResolvedValueOnce({ id: "q1", status: "Processing" }).mockResolvedValue({ id: "q1", status: "Completed", projectionStatus: "Pending", answer: { content: "Kết quả đã được ghi nhận", sources: [], cards: [], actions: [] } });
  await render();
  for (let index = 0; index < 3; index++) await act(async () => { await vi.advanceTimersByTimeAsync(3001); });
  expect(mocks.getMessage).toHaveBeenCalledTimes(3);
  expect(mocks.getMessage).toHaveBeenCalledWith("c1", "q1", expect.anything());
  expect(JSON.stringify(tree.toJSON())).toContain("Kết quả đã được ghi nhận");
});

it("retries feedback without resending the last question", async () => {
  mocks.history.mockResolvedValue({ items: [{ ...message, requestId: "r1" }], totalCount: 1 });
  mocks.feedback.mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
  await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Câu trả lời hữu ích" }).props.onPress());
  await press("Thử lại");
  expect(mocks.feedback).toHaveBeenCalledTimes(2);
  expect(mocks.send).not.toHaveBeenCalled();
});

it("retries only history after an accepted send whose refresh was interrupted", async () => {
  await render();
  mocks.history.mockRejectedValueOnce(new Error("offline"));
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("Tin đã nhận"));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  await press("Thử lại");
  expect(mocks.send).toHaveBeenCalledTimes(1);
});

it("refreshes conversation status after a realtime completion", async () => {
  await render();
  mocks.list.mockResolvedValue({ items: [{ ...current, status: "Closed" }] });
  await act(async () => { mocks.event?.({ conversationId: "c1", status: "Completed" }); });
  expect(button("Bắt đầu trò chuyện mới")).toBeDefined();
  expect(tree.root.findAllByProps({ accessibilityLabel: "Gửi tin nhắn" })).toHaveLength(0);
});

it("opens vehicle details separately from choosing a vehicle to book", async () => {
  await render(); await press("Xem chi tiết");
  expect(props.onViewVehicle).toHaveBeenCalledWith(7);
  expect(mocks.patch).not.toHaveBeenCalled();
  await press("Đặt xe này");
  expect(mocks.patch).toHaveBeenCalledWith("c1", 0, { vehicleId: 7 });
  expect(tree.root.findByType("BookingFunnel" as never)).toBeDefined();
  expect(props.onViewVehicle).toHaveBeenCalledTimes(1);
});

it("reopens an old car card without patching its stale dates over the saved customer form", async () => {
  const oldPeriod = { startAt: "2099-11-20T02:00:00Z", endAt: "2099-11-23T02:00:00Z" };
  const saved = { draftId: "saved", version: 4, status: "Draft", slots: { vehicleId: 7, startAt: "2099-11-21T02:00:00Z", endAt: "2099-11-24T02:00:00Z" }, missing: [], bookingId: null };
  mocks.history.mockResolvedValue({ items: [{ ...message, answer: { ...answer, rentalPeriod: oldPeriod } }], totalCount: 1 });
  mocks.getDraft.mockResolvedValue(saved);
  mocks.patch.mockResolvedValue({ ...saved, version: 5 });
  mocks.state.mockResolvedValue({ activeFilters: { startAt: saved.slots.startAt, endAt: saved.slots.endAt }, slotEvidence: { startAt: { origin: "CustomerForm", confirmation: "Confirmed", precision: "DateTime" }, endAt: { origin: "CustomerForm", confirmation: "Confirmed", precision: "DateTime" } } });
  await render(); await press("Đặt xe này");
  expect(mocks.patch).toHaveBeenCalledExactlyOnceWith("c1", 4, { vehicleId: 7 });
  const { default: RealFunnel } = await vi.importActual<typeof import("@/features/assistant/components/BookingFunnel")>("@/features/assistant/components/BookingFunnel");
  const funnelProps = tree.root.findByType("BookingFunnel" as never).props as React.ComponentProps<typeof RealFunnel>;
  expect(funnelProps.initialPeriod).toEqual(oldPeriod);
  await act(async () => tree.update(React.createElement(RealFunnel, funnelProps)));
  const fields = tree.root.findAllByType("TextInput" as never);
  expect(fields[0]!.props.value).toBe("2099-11-21");
  expect(fields[1]!.props.value).toBe("09:00");
  expect(fields[2]!.props.value).toBe("2099-11-24");
  expect(fields[3]!.props.value).toBe("09:00");
});

it("renders localized catalog enums and keeps unknown metadata unchanged", async () => {
  mocks.history.mockResolvedValue({ items: [{ ...message, answer: { ...answer, replyLocale: "en", cards: [{ name: "vehicles.search", data: { items: [{ id: 7, transmission: "Số tự động", fuelType: "Xăng" }, { id: 8, transmission: "Custom gearbox", fuelType: "Hybrid" }] } }] } }], totalCount: 1 });
  await render();
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain("Automatic · Petrol");
  expect(output).toContain("Custom gearbox · Hybrid");
  expect(output).not.toContain("Số tự động");
});

it("uses the stored conversation and does not merge messages from another history", async () => {
  const other = { ...current, id: "c2", createdAt: "2026-10-21" };
  mocks.stored.mockResolvedValue("c2");
  mocks.list.mockResolvedValue({ items: [current, other] });
  mocks.history.mockImplementation(async (id: string) => ({ items: [{ ...message, id, content: id === "c2" ? "Second chat" : "First chat" }], totalCount: 1 }));
  await render(); expect(JSON.stringify(tree.toJSON())).toContain("Second chat");
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Lịch sử trò chuyện" }).props.onPress());
  await act(async () => { const rows = tree.root.findAllByType("Pressable" as never).filter(node => JSON.stringify(node.findAllByType("Text" as never).map(text => text.props.children)).includes("Trò chuyện với MoveVN")); rows[0]!.props.onPress(); });
  const content = JSON.stringify(tree.toJSON());
  expect(content).toContain("First chat"); expect(content).not.toContain("Second chat");
});

it("uses server quick replies and supplies contextual fallbacks", () => {
  expect(getAssistantReplies("Ngày nào?", ["Ngày mai"])).toEqual(["Ngày mai"]);
  expect(getAssistantReplies("Ngày nào?", [])).toEqual([]);
  expect(getAssistantReplies("Ngân sách bao nhiêu?")).toContain("Tìm ô tô dưới 1 triệu/ngày");
  expect(getAssistantReplies("Ngày nào?")).toEqual(getAssistantReplies("Ngân sách bao nhiêu?"));
});

it("does not send empty questions", async () => {
  await render();
  const input = tree.root.findAllByType("TextInput" as never)[0]!;
  await act(async () => input.props.onChangeText("   "));
  expect(tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  expect(mocks.send).not.toHaveBeenCalled();
});

it("requires explicit staff consent and a support note before transferring", async () => {
  await render(); await press("Gặp nhân viên");
  expect(mocks.handoff).not.toHaveBeenCalled();
  expect(button("Đồng ý chuyển").props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ placeholder: "Bạn cần hỗ trợ vấn đề gì?" }).props.onChangeText("Cần hỗ trợ thuê xe"));
  await press("Đồng ý chuyển");
  expect(mocks.handoff).toHaveBeenCalledWith("c1", "Cần hỗ trợ thuê xe", "vi");
  expect(tree.root.findByProps({ placeholder: "Nhắn cho nhân viên…" })).toBeDefined();
});

it("shows a failed AI request as a retryable error without fabricating an answer", async () => {
  mocks.history.mockResolvedValue({ items: [{ id: "failed", role: "user", status: "Failed", content: "Xin chào", requestId: "failed-id", createdAt: "2026-10-22" }], totalCount: 1 });
  await render();
  expect(mocks.getMessage).toHaveBeenCalledWith("c1", "failed-id", expect.anything());
  expect(button("Thử lại")).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).not.toContain("Tìm được xe");
});

it("closes input on an ended conversation and allows starting a clean conversation", async () => {
  mocks.stored.mockResolvedValue("c1");
  mocks.list.mockResolvedValue({ items: [{ ...current, status: "Closed" }] });
  await render();
  expect(tree.root.findAllByProps({ accessibilityLabel: "Gửi tin nhắn" })).toHaveLength(0);
  await press("Bắt đầu trò chuyện mới");
  expect(tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" })).toBeDefined();
  expect(JSON.stringify(tree.toJSON())).not.toContain("Tìm được xe");
});

it("uses replyLocale for English UI and cards while keeping the response verbatim", async () => {
  mocks.history.mockResolvedValue({ items: [{ ...message, content: "Pick up in Đà Nẵng.", answer: { ...answer, replyLocale: "en", content: "Pick up in Đà Nẵng." } }], totalCount: 1 });
  await render();
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain("MoveVN assistant");
  expect(output).toContain("Book this car");
  expect(output).toContain("Pick up in Đà Nẵng.");
  expect(tree.root.findByProps({ placeholder: "Ask MoveVN…" })).toBeDefined();
});

it("uses the UI preference for a new conversation after auto-detecting English in a previous one", async () => {
  mocks.history.mockResolvedValue({ items: [{ ...message, answer: { ...answer, replyLocale: "en" } }], totalCount: 1 });
  await render();
  expect(JSON.stringify(tree.toJSON())).toContain("MoveVN assistant");
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Cuộc trò chuyện mới" }).props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain("Trợ lý MoveVN");
  expect(JSON.stringify(tree.toJSON())).not.toContain("MoveVN assistant");
});

it("uses a newer message language over the previous English conversation locale", async () => {
  mocks.history.mockResolvedValue({ items: [{ ...message, answer: { ...answer, replyLocale: "en" } }, { id: "user:new", requestId: "new", role: "user", status: "Queued", replyLocale: "vi", content: "Trả lời tiếng Việt nhé", createdAt: "2026-10-23", answer: null }], totalCount: 2 });
  await render();
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain("Trợ lý MoveVN");
  expect(output).toContain('"placeholder":"Hỏi MoveVN…"');
  expect(output).toContain("Book this car"); // Historical English cards keep their own language.
});

it("keeps a completed reply after its question when history has not projected the user row yet", async () => {
  const timestamp = "2026-10-24T00:00:00Z";
  mocks.send.mockResolvedValue({ id: "new-receipt", status: "Completed", acceptedAt: timestamp, completedAt: timestamp, answer: { content: "Reply belongs after the new question", sources: [], cards: [], actions: [] } });
  await render();
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("New question before the reply"));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  const output = JSON.stringify(tree.toJSON());
  expect(output.indexOf("New question before the reply")).toBeGreaterThan(0);
  expect(output.indexOf("New question before the reply")).toBeLessThan(output.indexOf("Reply belongs after the new question"));
});

it("uses a new request ID when the same question refers to a different vehicle after a lost response", async () => {
  mocks.send.mockRejectedValueOnce(new Error("offline"));
  useAssistantUi.setState({ vehicleDetailId: 7 });
  await render();
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("Is this car available?"));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  await act(async () => useAssistantUi.setState({ vehicleDetailId: 8 }));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  expect(mocks.send.mock.calls[1]![2]).not.toBe(mocks.send.mock.calls[0]![2]);
  expect(mocks.send.mock.calls[1]![3]).toEqual({ uiLocale: "vi", context: { vehicleId: 8, source: "vehicle_detail" } });
});

it("requests a real conversation language switch when the user selects English", async () => {
  await render();
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Switch to English" }).props.onPress());
  expect(mocks.send).toHaveBeenCalledWith("c1", "Please reply in English.", expect.any(String), { uiLocale: "en" });
});

it("attaches the current vehicle page reference without exposing page text", async () => {
  useAssistantUi.setState({ vehicleDetailId: 17 });
  await render();
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("Is this car available?"));
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Gửi tin nhắn" }).props.onPress());
  expect(mocks.send).toHaveBeenCalledWith("c1", "Is this car available?", expect.any(String), { uiLocale: "vi", context: { vehicleId: 17, source: "vehicle_detail" } });
});

it("opens consent rather than transferring immediately for a server handoff action", async () => {
  mocks.history.mockResolvedValue({ items: [{ ...message, answer: { ...answer, actions: [{ type: "RequestHandoff" }] } }], totalCount: 1 });
  await render();
  expect(tree.root.findAllByType("Pressable" as never).filter(node => JSON.stringify(node.findAllByType("Text" as never).map(text => text.props.children)).includes("Gặp nhân viên"))).toHaveLength(2);
  await press("Gặp nhân viên");
  expect(mocks.handoff).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain("Nhân viên sẽ được xem nội dung cuộc trò chuyện");
});
