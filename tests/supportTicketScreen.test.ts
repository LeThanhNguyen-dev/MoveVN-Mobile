import React from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ticket, quality } from "./fixtures/supportTicket";
import type { TicketEntry } from "@/features/supportTickets/types";

vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), create: vi.fn(), reply: vi.fn(), quality: vi.fn(), rate: vi.fn(), upload: vi.fn(), pick: vi.fn(), camera: vi.fn(), permission: vi.fn(), convert: vi.fn(), alert: vi.fn(), close: vi.fn(), generation: 1, size: 1000, listeners: [] as ((state: string) => void)[] }));
vi.mock("@/features/supportTickets/supportTicketService", () => ({ getMySupportTickets: mocks.list, getSupportTicketById: mocks.detail, createSupportTicket: mocks.create, addSupportTicketMessage: mocks.reply, getTicketQuality: mocks.quality, rateSupportTicket: mocks.rate, uploadSupportTicketAttachment: mocks.upload }));
vi.mock("@/features/auth/hooks/useAuth", () => ({ getSessionGeneration: () => mocks.generation }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_e: unknown, fallback: string) => fallback }));
vi.mock("@/theme/useTheme", async () => { const { themes } = await import("@/theme/tokens"); return { useTheme: () => ({ theme: themes.light }) }; });
vi.mock("react-native", () => ({ View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", RefreshControl: "RefreshControl", KeyboardAvoidingView: "KeyboardAvoidingView", Image: "Image", Platform: { OS: "android" }, Alert: { alert: mocks.alert }, BackHandler: { addEventListener: () => ({ remove: () => {} }) }, AppState: { currentState: "active", addEventListener: (_type: string, listener: (state: string) => void) => { mocks.listeners.push(listener); return { remove: () => { mocks.listeners = mocks.listeners.filter(x => x !== listener); } }; } }, StyleSheet: { create: (x: unknown) => x }, Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement("Modal", null, children) : null }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "View" }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.pick, launchCameraAsync: mocks.camera, requestCameraPermissionsAsync: mocks.permission }));
vi.mock("expo-image-manipulator", () => ({ manipulateAsync: mocks.convert, SaveFormat: { JPEG: "jpeg" } }));
vi.mock("expo-file-system", () => ({ File: class { get size() { return mocks.size; } } }));
vi.mock("lucide-react-native", () => Object.fromEntries(["ChevronLeft", "ChevronRight", "Headphones", "MessageCircle", "Plus", "Search", "Send", "ArrowLeft", "RefreshCw", "Camera", "ImagePlus", "X", "Clock3", "Star"].map(n => [n, n])));
import SupportTicketsScreen from "@/features/supportTickets/SupportTicketsScreen";

let tree: ReactTestRenderer | undefined;
const textOf = (node: ReactTestInstance) => node.findAll(n => n.type as unknown === "Text").map(n => n.children.filter(c => typeof c === "string" || typeof c === "number").join("")).join("\n");
const text = () => textOf(tree!.root);
function button(label: string) { const found = tree!.root.findAll(n => n.type as unknown === "Pressable" && (n.props.accessibilityLabel === label || textOf(n) === label))[0]; expect(found, label).toBeDefined(); return found!; }
async function press(label: string) { const target = button(label); expect(Boolean(target.props.disabled), label).toBe(false); await act(async () => { target.props.onPress(); }); }
async function fill(label: string, value: string) { const input = tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === label)[0]!; await act(async () => input.props.onChangeText(value)); }
async function mount(entry: TicketEntry = {}) { await act(async () => { tree = create(React.createElement(SupportTicketsScreen, { entry, onClose: mocks.close })); }); }
beforeEach(() => {
  vi.clearAllMocks(); mocks.listeners = []; mocks.generation = 1; mocks.size = 1000;
  mocks.list.mockResolvedValue({ items: [structuredClone(ticket)], totalCount: 11, page: 1, pageSize: 10, totalPages: 2 });
  mocks.detail.mockResolvedValue(structuredClone(ticket)); mocks.create.mockResolvedValue(structuredClone(ticket)); mocks.reply.mockResolvedValue(structuredClone(ticket)); mocks.quality.mockResolvedValue(structuredClone(quality));
  mocks.upload.mockResolvedValue("https://example.invalid/upload.jpg"); mocks.pick.mockResolvedValue({ canceled: true }); mocks.permission.mockResolvedValue({ granted: true }); mocks.convert.mockResolvedValue({ uri: "file:///converted.jpg" });
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; vi.useRealTimers(); });

it("lists own tickets, applies server filters, and resets pagination after filtering", async () => {
  await mount(); expect(text()).toContain(ticket.subject); await press("Trang sau"); expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({ page: 2 });
  await press("Đã xử lý"); expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({ page: 1, status: "Resolved" });
  await fill("Tìm theo mã hoặc tiêu đề", " thanh toán "); await press("Tìm kiếm"); expect(mocks.list.mock.calls.at(-1)?.[0].keyword).toBe("thanh toán");
  await press("Xóa bộ lọc"); expect(mocks.list.mock.calls.at(-1)?.[0].status).toBeUndefined();
});
it("shows a retryable load error rather than a misleading empty ticket list", async () => {
  mocks.list.mockRejectedValueOnce(new Error("Mất kết nối")); await mount(); expect(text()).toContain("Mất kết nối"); expect(text()).not.toContain("Chưa có yêu cầu phù hợp");
  await press("Thử lại"); expect(text()).toContain(ticket.subject);
});
it("validates create fields, retains failed text, and opens the saved ticket", async () => {
  await mount({ create: true }); await press("Gửi yêu cầu"); expect(mocks.create).not.toHaveBeenCalled(); expect(text()).toContain("nhập tiêu đề");
  await fill("Tiêu đề yêu cầu", "  Cần hỗ trợ  "); await fill("Nội dung yêu cầu", "  Không thấy thanh toán  "); await press("Cao");
  mocks.create.mockRejectedValueOnce(new Error("Không gửi được")); await press("Gửi yêu cầu"); expect(text()).toContain("Không gửi được");
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === "Nội dung yêu cầu")[0]?.props.value).toBe("  Không thấy thanh toán  ");
  await press("Gửi yêu cầu"); expect(mocks.create.mock.calls.at(-1)?.[0]).toMatchObject({ subject: "Cần hỗ trợ", message: "Không thấy thanh toán", priority: "High" }); expect(text()).toContain("Chi tiết yêu cầu");
});
it("links booking support to the actual booking and allows a new request after a closed ticket", async () => {
  mocks.list.mockResolvedValue({ items: [{ ...ticket, status: "Closed", bookingId: 50 }], totalCount: 1, page: 1, pageSize: 10 });
  await mount({ bookingId: 50, bookingCode: "BK50" }); expect(mocks.list.mock.calls[0]?.[0].bookingId).toBe(50); await press("Tạo yêu cầu mới");
  expect(text()).toContain("Liên quan: BK50"); await fill("Tiêu đề yêu cầu", "Bàn giao"); await fill("Nội dung yêu cầu", "Cần kiểm tra bàn giao"); await press("Gửi yêu cầu");
  expect(mocks.create.mock.calls[0]?.[0]).toMatchObject({ bookingId: 50, category: "Booking" });
});
it("blocks double submissions while creation is in flight", async () => {
  let resolve!: (value: typeof ticket) => void; mocks.create.mockImplementation(() => new Promise(done => { resolve = done; }));
  await mount({ create: true }); await fill("Tiêu đề yêu cầu", "Hỗ trợ"); await fill("Nội dung yêu cầu", "Cần hỗ trợ"); const send = button("Gửi yêu cầu");
  await act(async () => { send.props.onPress(); send.props.onPress(); }); expect(mocks.create).toHaveBeenCalledTimes(1); expect(button("Gửi yêu cầu").props.disabled).toBe(true);
  await act(async () => resolve(ticket)); expect(text()).toContain("Chi tiết yêu cầu");
});
it("shows the staff exchange, keeps a failed reply and clears it only after success", async () => {
  await mount({ ticketId: 41 }); expect(text()).toContain("Nhân viên hỗ trợ"); expect(text()).toContain("Chúng tôi đang kiểm tra");
  await fill("Nội dung phản hồi", "Tôi bổ sung thông tin"); mocks.reply.mockRejectedValueOnce(new Error("Lỗi gửi")); await press("Gửi phản hồi");
  expect(text()).toContain("Lỗi gửi"); expect(tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === "Nội dung phản hồi")[0]?.props.value).toBe("Tôi bổ sung thông tin");
  await press("Gửi phản hồi"); expect(mocks.reply).toHaveBeenLastCalledWith(41, { message: "Tôi bổ sung thông tin", attachmentUrls: undefined });
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === "Nội dung phản hồi")[0]?.props.value).toBe("");
});
it.each(["Resolved", "Closed"])("disables replies for %s tickets and allows an eligible rating exactly once", async status => {
  mocks.detail.mockResolvedValue({ ...ticket, status }); mocks.quality.mockResolvedValue({ ...quality, canRate: true });
  mocks.rate.mockResolvedValue({ id: "feedback", rating: 5 }); await mount({ ticketId: 41 });
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === "Nội dung phản hồi")).toHaveLength(0);
  expect(button("Gửi đánh giá").props.disabled).toBe(true); await press("5 sao"); await fill("Nhận xét hỗ trợ", "Cảm ơn"); await press("Gửi đánh giá");
  expect(mocks.rate).toHaveBeenCalledWith(41, 5, "Cảm ơn"); expect(text()).toContain("Đánh giá đã được ghi nhận"); expect(mocks.reply).not.toHaveBeenCalled();
});
it("keeps successful uploads on failed send so retry does not upload the same image again", async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg", fileName: "photo.jpg", fileSize: 1000 }] });
  await mount({ create: true }); await fill("Tiêu đề yêu cầu", "Ảnh lỗi"); await fill("Nội dung yêu cầu", "Có ảnh đính kèm"); await press("Chọn ảnh");
  mocks.create.mockRejectedValueOnce(new Error("Thử lại")); await press("Gửi yêu cầu"); await press("Gửi yêu cầu");
  expect(mocks.upload).toHaveBeenCalledTimes(1); expect(mocks.create.mock.calls.at(-1)?.[0].attachmentUrls).toBe('["https://example.invalid/upload.jpg"]');
});
it("converts an iPhone HEIC photo and rejects images exceeding the backend limit", async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///photo.heic", mimeType: "image/heic", fileName: "photo.HEIC" }] });
  await mount({ create: true }); await press("Chọn ảnh"); expect(mocks.convert).toHaveBeenCalled(); expect(button("Xóa ảnh 1")).toBeDefined(); await press("Xóa ảnh 1");
  mocks.size = 6 * 1024 * 1024; await press("Chọn ảnh"); expect(text()).toContain("tối đa 5 MB"); expect(mocks.upload).not.toHaveBeenCalled();
});
it("does not send old form content under a new login when an upload finishes late", async () => {
  let resolve!: (value: string) => void; mocks.upload.mockImplementation(() => new Promise(done => { resolve = done; }));
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///photo.jpg", mimeType: "image/jpeg", fileName: "photo.jpg" }] });
  await mount({ create: true }); await fill("Tiêu đề yêu cầu", "Hỗ trợ"); await fill("Nội dung yêu cầu", "Nội dung riêng"); await press("Chọn ảnh"); await press("Gửi yêu cầu");
  mocks.generation++; await act(async () => resolve("https://example.invalid/photo.jpg")); expect(mocks.create).not.toHaveBeenCalled();
});
it("ignores an obsolete list response after a filter change", async () => {
  let resolve!: (value: unknown) => void; mocks.list.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
  await mount(); await press("Đã đóng"); expect(mocks.list.mock.calls[0]?.[1].aborted).toBe(true);
  await act(async () => resolve({ items: [{ ...ticket, subject: "Dữ liệu cũ" }], totalCount: 1, page: 1, pageSize: 10 }));
  expect(text()).not.toContain("Dữ liệu cũ"); expect(text()).toContain(ticket.subject);
});
it("refreshes messages when returning to the foreground and does not show a reply form after closure", async () => {
  await mount({ ticketId: 41 }); mocks.detail.mockResolvedValue({ ...ticket, status: "Closed" });
  await act(async () => { for (const listener of [...mocks.listeners]) listener("active"); }); expect(text()).toContain("Yêu cầu đã kết thúc");
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === "Nội dung phản hồi")).toHaveLength(0);
});
it("keeps an unsent rating and comment when the background status refresh changes the message count", async () => {
  mocks.detail.mockResolvedValue({ ...ticket, status: "Resolved" }); mocks.quality.mockResolvedValue({ ...quality, canRate: true });
  await mount({ ticketId: 41 }); await press("4 sao"); await fill("Nhận xét hỗ trợ", "Tôi đang nhập đánh giá");
  mocks.detail.mockResolvedValue({ ...ticket, status: "Resolved", messages: [...ticket.messages, { ...ticket.messages[0]!, id: 3, message: "Thông tin cuối" }] });
  await press("Làm mới yêu cầu");
  expect(button("4 sao").props.accessibilityState.checked).toBe(true);
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === "Nhận xét hỗ trợ")[0]?.props.value).toBe("Tôi đang nhập đánh giá");
});
