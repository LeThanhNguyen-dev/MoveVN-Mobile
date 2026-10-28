import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), camera: vi.fn(), library: vi.fn() }));
vi.mock("react-native", () => ({ Image: "Image", Modal: "Modal", ScrollView: "ScrollView", Text: "Text", View: "View" }));
vi.mock("expo-image-picker", () => ({ requestCameraPermissionsAsync: async () => ({ granted: true }), launchCameraAsync: mocks.camera, launchImageLibraryAsync: mocks.library }));
vi.mock("@/services/apiClient", () => ({ apiClient: { get: mocks.get, post: mocks.post }, getApiErrorMessage: (_err: unknown, fallback: string) => fallback }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: {} }) }));
vi.mock("@/features/booking/components/BookingControls", () => ({ BookingButton: "Button", BookingField: "Field" }));
import ReportBookingViolation from "@/features/booking/components/ReportBookingViolation";

let tree: ReactTestRenderer;
const created = { id: "report", targetId: 42, status: "Open", description: "Chủ xe không giao đúng xe đã đặt" };
function button(title: string) { return tree.root.findAllByType("Button" as never).find(node => node.props.title === title)!; }
async function press(title: string) { await act(async () => { await button(title).props.onPress(); }); }
beforeEach(() => {
  vi.clearAllMocks();
  mocks.get.mockImplementation(async (path: string) => ({ data: { data: path.endsWith("/reasons") ? [{ code: "Other", label: "Khác", targetTypes: ["Booking"] }] : path.endsWith("/my") ? { items: [] } : { ...created, status: "InReview" } } }));
  mocks.post.mockResolvedValue({ data: { data: created } });
});
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
async function mount() { await act(async () => { tree = create(React.createElement(ReportBookingViolation, { bookingId: 42, bookingCode: "BK42" })); }); await press("Báo cáo vi phạm booking"); }
it("validates a booking report, submits the booking target, and can refresh its result", async () => {
  await mount(); await press("Gửi báo cáo vi phạm"); expect(mocks.post).not.toHaveBeenCalled();
  await press("Khác");
  await act(async () => tree.root.findByType("Field" as never).props.onChangeText(created.description));
  await press("Gửi báo cáo vi phạm");
  expect(mocks.post).toHaveBeenCalledWith("/api/violation-reports", { targetType: "Booking", targetId: 42, reason: "Other", description: created.description, evidenceUrls: [] });
  await press("Tải trạng thái báo cáo");
  expect(mocks.get).toHaveBeenCalledWith("/api/violation-reports/report");
  expect(JSON.stringify(tree.toJSON())).toContain("Đang xác minh");
});
it("captures booking evidence from camera without offering a library upload", async () => {
  await mount(); mocks.camera.mockResolvedValue({ canceled: true });
  await press("Chụp ảnh bằng chứng (0/5)");
  expect(mocks.camera).toHaveBeenCalledOnce(); expect(mocks.library).not.toHaveBeenCalled();
});
