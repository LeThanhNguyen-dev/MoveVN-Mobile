import React, { forwardRef, useImperativeHandle } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ list: vi.fn(), history: vi.fn(), send: vi.fn(), getDraft: vi.fn(), patch: vi.fn(), stored: vi.fn(), handoff: vi.fn(), getMessage: vi.fn(), event: null as null | ((event: { conversationId: string; status: string }) => void) }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", KeyboardAvoidingView: "KeyboardAvoidingView",
  Platform: { OS: "android" }, StyleSheet: { flatten: function flatten(style: unknown): Record<string, unknown> { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style && typeof style === "object" ? style as Record<string, unknown> : {}; }, create: (value: unknown) => value, hairlineWidth: 1 },
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
vi.mock("@/features/assistant/components/AssistantBooking", () => ({ AgentBlocks: "AgentBlocks" }));
vi.mock("@/features/assistant/components/BookingFunnel", () => ({ default: "BookingFunnel" }));
vi.mock("@/features/cms/screens/PolicyDetailScreen", () => ({ default: "PolicyDetailScreen" }));
vi.mock("@/features/assistant/assistantService", () => ({
  listConversations: mocks.list, getHistory: mocks.history, sendQuestion: mocks.send, getDraft: mocks.getDraft, patchDraft: mocks.patch,
  createConversation: vi.fn(), getMessage: mocks.getMessage, handoff: mocks.handoff, sendFeedback: vi.fn(), assistantError: () => "Error",
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
  vi.clearAllMocks(); mocks.stored.mockResolvedValue(null);
  mocks.list.mockResolvedValue({ items: [current] });
  mocks.history.mockResolvedValue({ items: [message], totalCount: 1 });
  mocks.send.mockResolvedValue({ status: "Completed" });
  mocks.getDraft.mockResolvedValue(null); mocks.patch.mockResolvedValue({});
  mocks.handoff.mockResolvedValue({ ...current, status: "WaitingForStaff", ticketId: 45 });
  mocks.getMessage.mockResolvedValue({ status: "Failed", errorCode: "AI_UNAVAILABLE" });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it("opens a policy source and returns to the conversation", async () => {
  await render(); await press("Chính sách thuê xe");
  const detail = tree.root.findByType("PolicyDetailScreen" as never);
  expect(detail.props.slug).toBe("thue-xe");
  await act(async () => detail.props.onBack());
  expect(button("Chính sách thuê xe")).toBeDefined();
});

it("opens the booking funnel before a vehicle is selected and requests more search results", async () => {
  await render(); await press("Xem thêm xe");
  expect(mocks.send).toHaveBeenCalledWith("c1", "Xem thêm xe", expect.any(String));
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
  expect(getAssistantReplies("Ngân sách bao nhiêu?")).toContain("3tr tổng chuyến");
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
  expect(mocks.handoff).toHaveBeenCalledWith("c1", "Cần hỗ trợ thuê xe");
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
