import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { BookingResponse } from "@/features/booking/types";
import { themes } from "@/theme/tokens";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ checkIn: vi.fn(), checkOut: vi.fn(), delete: vi.fn(), saved: vi.fn(), back: vi.fn(), resize: vi.fn(), library: vi.fn() }));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Image: "Image", KeyboardAvoidingView: "KeyboardAvoidingView", Pressable: "Pressable", ScrollView: "ScrollView", Switch: "Switch", Text: "Text", TextInput: "TextInput", View: "View",
  Platform: { OS: "android" }, StyleSheet: { flatten: function flatten(style: unknown): Record<string, unknown> { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style && typeof style === "object" ? style as Record<string, unknown> : {}; }, create: (styles: unknown) => styles },
  Alert: { alert: vi.fn() }, BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("lucide-react-native", () => ({ ArrowLeft: "ArrowLeft" }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock("@/features/booking/bookingService", () => ({ createCheckInReport: mocks.checkIn, createCheckOutReport: mocks.checkOut }));
vi.mock("@/features/booking/inspectionPhoto", () => ({ deleteInspectionPhoto: mocks.delete, resizeCameraPhoto: mocks.resize }));
vi.mock("expo-image-picker", () => ({ launchImageLibraryAsync: mocks.library }));
vi.mock("@/features/booking/components/InspectionCameraModal", () => ({ default: (props: object) => React.createElement("CameraCapture", props) }));
import InspectionFormScreen from "@/features/booking/screens/InspectionFormScreen";

let tree: ReactTestRenderer | undefined;
const jpeg = new Blob(["stamped jpeg"], { type: "image/jpeg" });
const photo = { id: "1", uri: "file:///stamped.jpg", capturedAt: "2026-10-04T02:00:00Z", file: jpeg as never };
beforeEach(() => vi.clearAllMocks());
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
function button(title: string) { return tree!.root.findAll((node) => (node.type as unknown) === "Pressable" && node.findAll((child) => (child.type as unknown) === "Text" && child.children.includes(title)).length > 0)[0]!; }
async function mount(type: "CheckIn" | "CheckOut" = "CheckIn", overrides: Partial<BookingResponse> = {}) {
  await act(async () => { tree = create(React.createElement(InspectionFormScreen, {
    booking: { startDate: "2020-01-01T00:00:00Z", id: 42, bookingCode: "MVN-42", vehicleId: 3, ...overrides } as BookingResponse, type, onBack: mocks.back, onSaved: mocks.saved,
  })); });
}
async function addPhoto() {
  await act(async () => button("Chụp ảnh xe").props.onPress());
  const camera = tree!.root.find((node) => (node.type as unknown) === "CameraCapture");
  await act(async () => { camera.props.onCaptured(photo); camera.props.onClose(); });
}

it("keeps watermarked photos after upload failure so the owner can retry without recapturing", async () => {
  await mount(); await addPhoto();
  mocks.checkIn.mockRejectedValueOnce(new Error("offline"));
  await act(async () => button("Gửi biên bản cho khách xác nhận").props.onPress());
  expect(mocks.saved).not.toHaveBeenCalled(); expect(mocks.delete).not.toHaveBeenCalled();
  expect(JSON.stringify(tree!.toJSON())).toContain("Ảnh vẫn được giữ");
  expect(tree!.root.findAll((node) => (node.type as unknown) === "Image" && node.props.source.uri === photo.uri)).toHaveLength(1);
  const report = { id: 7, type: "CheckIn" };
  mocks.checkIn.mockResolvedValueOnce(report);
  await act(async () => button("Gửi biên bản cho khách xác nhận").props.onPress());
  expect(mocks.saved).toHaveBeenCalledWith(report); expect(mocks.checkIn).toHaveBeenCalledTimes(2);
});

it("blocks duplicate submissions and posts checkout to the checkout service", async () => {
  await mount("CheckOut"); await addPhoto();
  const time = tree!.root.findAll(node => (node.type as unknown) === "TextInput")[0]!;
  await act(async () => time.props.onChangeText("2021-01-01 10:00"));
  let complete!: (value: unknown) => void;
  mocks.checkOut.mockImplementationOnce(() => new Promise((resolve) => { complete = resolve; }));
  await act(async () => {
    const submit = button("Gửi biên bản cho khách xác nhận").props.onPress;
    submit(); submit();
  });
  expect(mocks.checkOut).toHaveBeenCalledTimes(1); expect(mocks.checkIn).not.toHaveBeenCalled();
  expect(button("Chụp ảnh xe").props.disabled).toBe(true);
  await act(async () => complete({ id: 8, type: "CheckOut" }));
  expect(mocks.saved).toHaveBeenCalledWith({ id: 8, type: "CheckOut" });
});

it("deletes removed photos and refuses to send a report without a photo", async () => {
  await mount(); await addPhoto();
  const remove = tree!.root.find((node) => (node.type as unknown) === "Pressable" && node.props.accessibilityLabel === "Xóa ảnh 1");
  await act(async () => remove.props.onPress());
  expect(mocks.delete).toHaveBeenCalledWith(photo.uri);
  expect(button("Gửi biên bản cho khách xác nhận").props.disabled).toBe(true);
  // Even a programmatic call cannot bypass validation.
  await act(async () => button("Gửi biên bản cho khách xác nhận").props.onPress());
  expect(mocks.checkIn).not.toHaveBeenCalled();
});


it("posts selected checkout fees and requires a reason before uploading", async () => {
  await mount("CheckOut", { surchargeTerms: [{ id: 201, feeType: "Cleaning", name: "Vệ sinh xe", calculationMethod: "Fixed", unitPrice: 100000, createdAt: "2020-01-01T00:00:00Z" }] });
  await addPhoto();
  await act(async () => tree!.root.findAll(n => (n.type as unknown) === "TextInput")[0]!.props.onChangeText("2021-01-01 10:00"));
  await act(async () => tree!.root.find(n => (n.type as unknown) === "Switch" && n.props.accessibilityLabel === "Vệ sinh xe").props.onValueChange(true));
  await act(async () => button("Gửi biên bản cho khách xác nhận").props.onPress());
  expect(mocks.checkOut).not.toHaveBeenCalled();
  const field = tree!.root.findAll(n => (n.type as unknown) === "TextInput" && n.props.multiline)[0]!;
  await act(async () => field.props.onChangeText("Bùn đất trong xe"));
  mocks.checkOut.mockResolvedValueOnce({ id: 9, type: "CheckOut" });
  await act(async () => button("Gửi biên bản cho khách xác nhận").props.onPress());
  expect(mocks.checkOut).toHaveBeenCalledTimes(1);
  const data = mocks.checkOut.mock.calls[0]![1] as FormData;
  expect(data.get("additionalSurcharges[0].termId")).toBe("201");
  expect(data.get("additionalSurcharges[0].quantity")).toBe("1");
  expect(data.get("additionalSurcharges[0].note")).toBe("Bùn đất trong xe");
});


it("only exposes camera capture and never opens the image library", async () => {
  await mount();
  expect(JSON.stringify(tree!.toJSON())).not.toContain("Chọn ảnh từ thư viện");
  await addPhoto();
  expect(mocks.library).not.toHaveBeenCalled();
  expect(tree!.root.findAll(n => (n.type as unknown) === "Image")).toHaveLength(1);
});
