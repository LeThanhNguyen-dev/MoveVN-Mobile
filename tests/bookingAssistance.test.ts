import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ create: vi.fn(), upload: vi.fn(), get: vi.fn(), list: vi.fn(), reply: vi.fn(), pick: vi.fn() }));
vi.mock("react-native", () => ({ ActivityIndicator: "Spinner", Image: "Image", Modal: "Modal", Pressable: "Pressable", ScrollView: "ScrollView", Text: "Text", View: "View" }));
vi.mock("expo-image-picker", () => ({ launchCameraAsync: mocks.pick, requestCameraPermissionsAsync: async () => ({ granted: true }) }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: {} }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (e: Error) => e.message }));
vi.mock("@/features/booking/components/BookingControls", () => ({ BookingButton: "Button", BookingField: "Field" }));
vi.mock("@/features/supportTickets/supportTicketService", () => ({ createSupportTicket: mocks.create, uploadSupportTicketAttachment: mocks.upload, getSupportTicketById: mocks.get, getMySupportTickets: mocks.list, addSupportTicketMessage: mocks.reply }));
import BookingAssistance from "@/features/booking/components/BookingAssistance";
let tree: ReactTestRenderer;
const ticket = { id: 9, ticketNumber: "TK9", status: "Open", messages: [] };
const buttons = () => tree.root.findAll(n => (n.type as unknown) === "Button");
const field = () => tree.root.find(n => (n.type as unknown) === "Field");
const send = () => buttons().find(n => n.props.title === "Gửi yêu cầu hỗ trợ" || n.props.title === "Gửi phản hồi")!;
async function mount() {
  await act(async () => { tree = create(React.createElement(BookingAssistance, { bookingId: 42, bookingCode: "BK42" })); });
  await act(async () => { buttons()[0]!.props.onPress(); });
}
beforeEach(() => {
  vi.resetAllMocks(); mocks.list.mockResolvedValue({ items: [] }); mocks.create.mockResolvedValue(ticket);
  mocks.get.mockResolvedValue(ticket); mocks.reply.mockResolvedValue(ticket); mocks.upload.mockResolvedValue("https://img.test/evidence.jpg");
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
it("sends booking-linked evidence then replies in the same thread", async () => {
  await mount();
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: "file://photo.jpg", fileName: "photo.jpg", mimeType: "image/jpeg", fileSize: 100 }] });
  await act(async () => { buttons().find(n => n.props.title.startsWith("Chụp ảnh bằng chứng"))!.props.onPress(); });
  await act(async () => field().props.onChangeText("Tôi đã trả xe, cần đối chiếu"));
  await act(async () => send().props.onPress());
  expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ bookingId: 42, message: "Tôi đã trả xe, cần đối chiếu", attachmentUrls: "https://img.test/evidence.jpg" }));
  expect(field().props.value).toBe("");
  await act(async () => field().props.onChangeText("Bổ sung thời gian trả xe"));
  await act(async () => send().props.onPress());
  expect(mocks.reply).toHaveBeenCalledWith(9, expect.objectContaining({ message: "Bổ sung thời gian trả xe" }));
});
it("retains a failed draft and blocks duplicate submissions before rerender", async () => {
  await mount();
  await act(async () => field().props.onChangeText("Chủ xe chưa giao xe"));
  let reject!: (error: Error) => void;
  mocks.create.mockImplementation(() => new Promise((_, r) => { reject = r; }));
  await act(async () => { send().props.onPress(); send().props.onPress(); });
  expect(mocks.create).toHaveBeenCalledTimes(1);
  await act(async () => reject(new Error("Mất kết nối")));
  expect(field().props.value).toBe("Chủ xe chưa giao xe");
  expect(JSON.stringify(tree.toJSON())).toContain("Mất kết nối");
});
it("restores the existing conversation when reopened", async () => {
  mocks.list.mockResolvedValue({ items: [{ id: 9 }] });
  await mount();
  expect(mocks.list).toHaveBeenCalledWith({ bookingId: 42, page: 1, pageSize: 1 });
  expect(mocks.get).toHaveBeenCalledWith(9);
  expect(mocks.create).not.toHaveBeenCalled();
  await act(async () => field().props.onChangeText("Kiểm tra lại giúp tôi"));
  await act(async () => send().props.onPress());
  expect(mocks.reply).toHaveBeenCalledWith(9, expect.anything());
});
