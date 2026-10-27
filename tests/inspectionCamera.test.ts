import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const animationFrames = new Map<number, () => void>();
let nextFrameId = 0;
vi.stubGlobal("requestAnimationFrame", (callback: () => void) => {
  const id = ++nextFrameId; animationFrames.set(id, callback); return id;
});
vi.stubGlobal("cancelAnimationFrame", (id: number) => animationFrames.delete(id));
const mocks = vi.hoisted(() => ({
  takePicture: vi.fn(), requestPermission: vi.fn(), captureRef: vi.fn(), resize: vi.fn(), stamped: vi.fn(), delete: vi.fn(),
  captured: vi.fn(), close: vi.fn(), serverTime: vi.fn(), permission: { granted: true, canAskAgain: true },
  platform: "android",
}));
vi.mock("react-native", () => ({
  ActivityIndicator: "ActivityIndicator", Image: "Image", Modal: "Modal", Pressable: "Pressable", Text: "Text", View: "View",
  Platform: { get OS() { return mocks.platform; } }, StyleSheet: { flatten: function flatten(style: unknown): Record<string, unknown> { return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style && typeof style === "object" ? style as Record<string, unknown> : {}; }, create: (styles: unknown) => styles }, Linking: { openSettings: vi.fn() },
  PixelRatio: { get: () => 3 },
  AppState: { currentState: "active", addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock("react-native-safe-area-context", () => ({ SafeAreaView: "SafeAreaView" }));
vi.mock("lucide-react-native", () => ({ Camera: "Camera", X: "X" }));
vi.mock("react-native-view-shot", () => ({ captureRef: mocks.captureRef }));
vi.mock("../src/features/booking/inspectionPhoto", () => ({ deleteInspectionPhoto: mocks.delete, resizeCameraPhoto: mocks.resize, stampedInspectionPhoto: mocks.stamped }));
vi.mock("@/features/booking/utils/serverTime", () => ({ getServerTimeISO: mocks.serverTime }));
vi.mock("expo-camera", async () => {
  const react = await import("react");
  return {
    useCameraPermissions: () => [mocks.permission, mocks.requestPermission],
    CameraView: react.forwardRef((props: object, ref) => {
      react.useImperativeHandle(ref, () => ({ takePictureAsync: mocks.takePicture }));
      return react.createElement("CameraView", props);
    }),
  };
});
import InspectionCameraModal from "@/features/booking/components/InspectionCameraModal";
let tree: ReactTestRenderer | undefined;
const stamped = { id: "1", uri: "file:///stamped.jpg", capturedAt: "2026-10-04T02:00:00Z", file: { uri: "file:///stamped.jpg", name: "inspection.jpg", type: "image/jpeg" } };
beforeEach(() => {
  animationFrames.clear();
  mocks.platform = "android";
  vi.clearAllMocks(); mocks.permission.granted = true;
  mocks.takePicture.mockResolvedValue({ uri: "file:///raw.jpg", width: 3000, height: 4000 });
  mocks.resize.mockResolvedValue({ uri: "file:///resized.jpg", width: 1200, height: 1600 });
  mocks.captureRef.mockResolvedValue("file:///stamped.jpg"); mocks.stamped.mockReturnValue(stamped);
  mocks.serverTime.mockResolvedValue("2026-10-04T02:00:00Z");
});
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; });
async function mount() {
  await act(async () => { tree = create(React.createElement(InspectionCameraModal, { bookingCode: "MVN-42", type: "CheckIn", onCaptured: mocks.captured, onClose: mocks.close }), { createNodeMock: () => ({}) }); });
}
function host(type: string) { return tree!.root.findAll((node) => (node.type as unknown) === type); }
function button(title: string) {
  return host("Pressable").find((node) => node.props.accessibilityLabel === title || node.findAll((child) => (child.type as unknown) === "Text" && child.children.includes(title)).length > 0)!;
}
async function takePhoto() {
  await act(async () => host("CameraView")[0]!.props.onCameraReady());
  await act(async () => button("Chụp ảnh xe").props.onPress());
}
async function finishStamp() {
  await act(async () => {
    host("View").find((node) => node.props.onLayout)!.props.onLayout();
    host("Image").find((node) => node.props.onLoad)!.props.onLoad();
  });
  // Advance the two render frames explicitly rather than relying on wall-clock
  // sleeps, which become unreliable while native/web builds run concurrently.
  for (let frame = 0; frame < 2; frame++) {
    await act(async () => {
      const callbacks = [...animationFrames.values()]; animationFrames.clear();
      callbacks.forEach((callback) => callback());
    });
  }
}

it("waits for photo decode and layout, burns the watermark, and hands off only the stamped JPEG", async () => {
  await mount(); await takePhoto();
  expect(mocks.serverTime).toHaveBeenCalled();
  expect(mocks.takePicture).toHaveBeenCalledWith({ quality: 0.9, exif: false });
  expect(mocks.resize).toHaveBeenCalledWith("file:///raw.jpg", 3000, 4000);
  expect(mocks.captureRef).not.toHaveBeenCalled();
  expect(button("Dùng ảnh này").props.disabled).toBe(true);
  const composition = host("View").find((node) => node.props.onLayout)!;
  expect(JSON.stringify(composition.findAll((node) => (node.type as unknown) === "Text").map((node) => node.children))).toContain("MoveVN | MVN-42 | CHECK-IN");
  expect(JSON.stringify(composition.findAll((node) => (node.type as unknown) === "Text").map((node) => node.children))).toContain("UTC+07:00");
  await finishStamp();
  expect(mocks.captureRef).toHaveBeenCalledWith(expect.anything(), { format: "jpg", quality: 0.9, result: "tmpfile", width: 1200, height: 1600, useRenderInContext: false });
  expect(button("Dùng ảnh này").props.disabled).toBe(false);
  await act(async () => button("Dùng ảnh này").props.onPress());
  expect(mocks.captured).toHaveBeenCalledWith(stamped); expect(mocks.close).toHaveBeenCalledOnce();
  await act(async () => tree!.unmount()); tree = undefined;
  expect(mocks.delete).toHaveBeenCalledWith("file:///raw.jpg");
  expect(mocks.delete).toHaveBeenCalledWith("file:///resized.jpg");
  expect(mocks.delete).not.toHaveBeenCalledWith("file:///stamped.jpg");
});

it("never accepts an unstamped photo if image composition fails", async () => {
  mocks.captureRef.mockRejectedValue(new Error("Snapshot failure"));
  await mount(); await takePhoto(); await finishStamp();
  expect(button("Dùng ảnh này").props.disabled).toBe(true);
  expect(mocks.captured).not.toHaveBeenCalled();
  expect(JSON.stringify(tree!.toJSON())).toContain("Không thể gắn watermark");
  await act(async () => button("Chụp lại").props.onPress());
  expect(host("CameraView")).toHaveLength(1);
  expect(mocks.delete).toHaveBeenCalledWith("file:///raw.jpg");
});

it("captures iOS at the composition bounds so Retina scaling cannot leave a blank canvas", async () => {
  mocks.platform = "ios";
  await mount(); await takePhoto();
  const composition = host("View").find(node => node.props.onLayout)!;
  // A 1200x1600 pixel photo is composed in points on a 3x Retina screen.
  expect(composition.props.style.width).toBe(400);
  expect(composition.props.style.height).toBeCloseTo(1600 / 3);
  await finishStamp();
  const options = mocks.captureRef.mock.calls[0]![1];
  expect(options.useRenderInContext).toBe(true);
  expect(options).not.toHaveProperty("width");
  expect(options).not.toHaveProperty("height");
  expect(button("Dùng ảnh này").props.disabled).toBe(false);
});

it("requires camera permission without offering the image library", async () => {
  mocks.permission.granted = false; await mount();
  expect(host("CameraView")).toHaveLength(0);
  expect(JSON.stringify(tree!.toJSON())).not.toContain("chọn ảnh từ thư viện");
  expect(button("Cho phép camera")).toBeDefined();
  expect(mocks.takePicture).not.toHaveBeenCalled();
});
