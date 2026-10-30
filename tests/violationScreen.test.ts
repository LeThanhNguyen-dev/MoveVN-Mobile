import React from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { report, violationReasons } from "./fixtures/violation";
import type { ViolationEntry } from "@/features/violations/types";

vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ list: vi.fn(), detail: vi.fn(), reasons: vi.fn(), create: vi.fn(), upload: vi.fn(), pick: vi.fn(), camera: vi.fn(), permission: vi.fn(), convert: vi.fn(), alert: vi.fn(), close: vi.fn(), generation: 1, size: 1000, back: (() => {}) as () => void, listeners: [] as ((state: string) => void)[] }));
vi.mock("@/features/violations/violationService", () => ({ getMyViolations: mocks.list, getViolation: mocks.detail, getViolationReasons: mocks.reasons, createViolation: mocks.create, uploadViolationEvidence: mocks.upload }));
vi.mock("@/features/supportTickets/supportTicketService", () => ({ uploadSupportTicketAttachment: vi.fn() }));
vi.mock("@/features/auth/hooks/useAuth", () => ({ getSessionGeneration: () => mocks.generation }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_e: unknown, fallback: string) => fallback }));
vi.mock("@/theme/useTheme", async () => { const { themes } = await import("@/theme/tokens"); return { useTheme: () => ({ theme: themes.light }) }; });
vi.mock("react-native", () => ({ View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator", RefreshControl: "RefreshControl", KeyboardAvoidingView: "KeyboardAvoidingView", Image: "Image", Platform: { OS: "android" }, Alert: { alert: mocks.alert }, AppState: { currentState: "active", addEventListener: (_type: string, listener: (state: string) => void) => { mocks.listeners.push(listener); return { remove: () => { mocks.listeners = mocks.listeners.filter(x => x !== listener); } }; } }, StyleSheet: { create: (x: unknown) => x }, Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement("Modal", null, children) : null }));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "View" }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.pick, launchCameraAsync: mocks.camera, requestCameraPermissionsAsync: mocks.permission }));
vi.mock("expo-image-manipulator", () => ({ manipulateAsync: mocks.convert, SaveFormat: { JPEG: "jpeg" } }));
vi.mock("expo-file-system", () => ({ File: class { get size() { return mocks.size; } } }));
vi.mock("lucide-react-native", () => Object.fromEntries(["ChevronLeft", "ChevronRight", "Flag", "CheckCircle2", "Search", "Send", "ShieldCheck", "ArrowLeft", "RefreshCw", "Camera", "ImagePlus", "X"].map(n => [n, n])));
import ViolationsScreen from "@/features/violations/ViolationsScreen";
let tree: ReactTestRenderer | undefined;
const textOf = (node: ReactTestInstance) => node.findAll(n => n.type as unknown === "Text").map(n => n.children.filter(c => typeof c === "string" || typeof c === "number").join("")).join("\n");
const text = () => textOf(tree!.root);
function button(label: string) { const found = tree!.root.findAll(n => n.type as unknown === "Pressable" && (n.props.accessibilityLabel === label || textOf(n) === label))[0]; expect(found, label).toBeDefined(); return found!; }
async function press(label: string) { const target = button(label); expect(Boolean(target.props.disabled), label).toBe(false); await act(async () => { target.props.onPress(); }); }
async function fill(label: string, value: string) { const input = tree!.root.findAll(n => n.type as unknown === "TextInput" && n.props.accessibilityLabel === label)[0]!; await act(async () => input.props.onChangeText(value)); }
async function mount(entry: ViolationEntry = {}) { await act(async () => { tree = create(React.createElement(ViolationsScreen, { entry, onClose: mocks.close, registerBack: (action: () => void) => { mocks.back = action; } })); }); }
const target = { targetType: "Vehicle" as const, targetId: 7, ownerId: 22, label: "Honda City 43A-12345" };
beforeEach(() => {
  vi.clearAllMocks(); mocks.listeners = []; mocks.generation = 1; mocks.size = 1000;
  mocks.list.mockResolvedValue({ items: [structuredClone(report)], totalCount: 12, page: 1, pageSize: 10, totalPages: 2 });
  mocks.detail.mockResolvedValue(structuredClone(report)); mocks.reasons.mockResolvedValue(structuredClone(violationReasons)); mocks.create.mockResolvedValue(structuredClone(report));
  mocks.upload.mockImplementation(async (file: { uri: string }) => `https://example.invalid/${file.uri.split("/").at(-1)}`); mocks.pick.mockResolvedValue({ canceled: true }); mocks.permission.mockResolvedValue({ granted: true }); mocks.convert.mockResolvedValue({ uri: "file:///converted.jpg" });
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
it("lists own reports with server filtering, paging and filter reset", async () => {
  await mount(); expect(text()).toContain(report.targetLabel); await press("Trang báo cáo sau"); expect(mocks.list.mock.calls.at(-1)?.[0].page).toBe(2);
  await press("Đang xác minh"); expect(mocks.list.mock.calls.at(-1)?.[0]).toMatchObject({ status: "InReview", page: 1 });
  await fill("Tìm báo cáo theo tên đối tượng", " 43A "); await press("Tìm báo cáo"); expect(mocks.list.mock.calls.at(-1)?.[0].keyword).toBe("43A");
  await press("Xóa bộ lọc báo cáo"); expect(mocks.list.mock.calls.at(-1)?.[0]).toEqual({ page: 1, pageSize: 10 });
});
it("shows load failure honestly and supports retry", async () => {
  mocks.list.mockRejectedValueOnce(new Error("Không có kết nối")); await mount(); expect(text()).toContain("Không có kết nối"); expect(text()).not.toContain("Chưa có báo cáo phù hợp");
  await press("Thử lại"); expect(text()).toContain(report.targetLabel);
});
it("anchors the target to the entry screen and only shows applicable reasons", async () => {
  await mount({ target }); expect(text()).toContain(target.label); expect(text()).toContain("Xe không an toàn"); expect(text()).not.toContain("Quấy rối");
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput")).toHaveLength(1);
  await press("Gửi báo cáo"); expect(mocks.create).not.toHaveBeenCalled(); expect(text()).toContain("chọn lý do");
  await press("Vi phạm khác"); await fill("Mô tả báo cáo vi phạm", "quá ngắn"); await press("Gửi báo cáo"); expect(text()).toContain("20 đến");
});
it("creates a report without implying guilt and shows the server's canonical target", async () => {
  await mount({ target }); await press("Vi phạm khác"); await fill("Mô tả báo cáo vi phạm", "  Có thông tin trong tin đăng cần được kiểm tra lại.  "); await press("Gửi báo cáo");
  expect(mocks.create).toHaveBeenCalledWith({ targetType: "Vehicle", targetId: 7, reason: "Other", description: "Có thông tin trong tin đăng cần được kiểm tra lại.", evidenceUrls: [] });
  expect(text()).toContain("Chi tiết báo cáo"); expect(text()).toContain("Chưa có kết luận đối tượng vi phạm"); expect(text()).toContain(report.targetLabel);
});
it("retains text on duplicate/failed submissions and does not submit twice before rerender", async () => {
  await mount({ target }); await press("Vi phạm khác"); await fill("Mô tả báo cáo vi phạm", "Thông tin cần xác minh được mô tả chi tiết ở đây.");
  let reject!: (error: Error) => void; mocks.create.mockImplementation(() => new Promise((_resolve, fail) => { reject = fail; })); const send = button("Gửi báo cáo");
  await act(async () => { send.props.onPress(); send.props.onPress(); }); expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Đã có báo cáo đang xử lý"))); expect(text()).toContain("Đã có báo cáo đang xử lý");
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput")[0]?.props.value).toContain("Thông tin cần xác minh");
});
it("uploads no more than five images to the violation endpoint and reuses uploads on retry", async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: Array.from({ length: 6 }, (_, i) => ({ uri: `file:///photo${i}.jpg`, mimeType: "image/jpeg", fileName: `photo${i}.jpg` })) });
  await mount({ target }); await press("Vi phạm khác"); await fill("Mô tả báo cáo vi phạm", "Có ảnh bằng chứng liên quan đến sự việc này."); await press("Chọn ảnh");
  expect(mocks.pick.mock.calls[0]?.[0].selectionLimit).toBe(5);
  mocks.create.mockRejectedValueOnce(new Error("Gửi lỗi")); await press("Gửi báo cáo"); await press("Gửi báo cáo");
  expect(mocks.upload).toHaveBeenCalledTimes(5); expect(mocks.create.mock.calls.at(-1)?.[0].evidenceUrls).toHaveLength(5);
  expect(Array.isArray(mocks.create.mock.calls.at(-1)?.[0].evidenceUrls)).toBe(true);
});
it("does not display staff-only history, snapshot or moderation actions even if present in a response", async () => {
  mocks.detail.mockResolvedValue({ ...report, targetSnapshot: "PRIVATE-SNAPSHOT", allowedActions: ["SuspendAccount"], history: [...report.history, { id: 2, internal: true, action: "InternalNote", note: "PRIVATE-STAFF-NOTE", actorName: "Admin", createdAt: report.createdAt }] });
  await mount({ reportId: report.id }); expect(text()).not.toContain("PRIVATE"); expect(text()).not.toContain("Ghi chú nội bộ");
  expect(tree!.root.findAll(n => n.type as unknown === "TextInput")).toHaveLength(0);
});
it.each(["Resolved", "Rejected"] as const)("renders %s as a server conclusion without payment or account controls", async status => {
  mocks.detail.mockResolvedValue({ ...report, status, decision: status === "Resolved" ? "HideVehicle" : "Reject", resolution: "Bộ phận kiểm duyệt đã xác minh các thông tin được cung cấp.", closedAt: report.createdAt });
  await mount({ reportId: report.id }); expect(text()).toContain("Kết quả xác minh"); expect(text()).toContain("Bộ phận kiểm duyệt đã xác minh"); expect(text()).not.toContain("Báo cáo đang được xác minh");
});
it("ignores a stale filtered response and aborts it", async () => {
  let resolve!: (value: unknown) => void; mocks.list.mockImplementationOnce(() => new Promise(done => { resolve = done; })); await mount(); await press("Chờ tiếp nhận");
  expect(mocks.list.mock.calls[0]?.[1].aborted).toBe(true);
  await act(async () => resolve({ items: [{ ...report, targetLabel: "STALE" }], page: 1, pageSize: 10, totalCount: 1 })); expect(text()).not.toContain("STALE");
});
it("does not submit a previous user's draft if logout happens during image upload", async () => {
  let resolve!: (value: string) => void; mocks.upload.mockImplementation(() => new Promise(done => { resolve = done; })); mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file:///a.jpg", mimeType: "image/jpeg", fileName: "a.jpg" }] });
  await mount({ target }); await press("Vi phạm khác"); await fill("Mô tả báo cáo vi phạm", "Nội dung riêng tư liên quan đến sự việc này."); await press("Chọn ảnh"); await press("Gửi báo cáo");
  mocks.generation++; await act(async () => resolve("https://example.invalid/a.jpg")); expect(mocks.create).not.toHaveBeenCalled();
});
it("protects a draft when Android back is requested and keeps the modal open during upload", async () => {
  await mount({ target }); await fill("Mô tả báo cáo vi phạm", "Nội dung đang soạn chưa được gửi đi."); await act(async () => mocks.back());
  expect(mocks.alert).toHaveBeenCalledWith("Bỏ báo cáo đang soạn?", expect.any(String), expect.any(Array)); expect(mocks.close).not.toHaveBeenCalled();
});
