import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const state = vi.hoisted(() => ({ mode: "light" as "light" | "dark" }));
vi.mock("@/theme/useTheme", async () => {
  const { themes } = await import("@/theme/tokens");
  return { useTheme: () => ({ theme: themes[state.mode] }) };
});
vi.mock("react-native", () => ({
  Text: "Text", View: "View", Image: "Image", Pressable: "Pressable", TextInput: "TextInput", ActivityIndicator: "ActivityIndicator",
  StyleSheet: {
    create: (styles: unknown) => styles, absoluteFill: {},
    flatten: function flatten(style: unknown): Record<string, unknown> {
      return Array.isArray(style) ? Object.assign({}, ...style.map(flatten)) : style && typeof style === "object" ? style as Record<string, unknown> : {};
    },
  },
}));
vi.mock("lucide-react-native", () => ({ ArrowLeft: "ArrowLeft", RefreshCw: "RefreshCw" }));
import { StyleSheet } from "react-native";
import AppText from "@/components/AppText";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppAvatar from "@/components/ui/AppAvatar";
import AppScreenHeader from "@/components/ui/AppScreenHeader";

let tree: ReactTestRenderer | undefined;
afterEach(async () => { if (tree) await act(async () => tree!.unmount()); tree = undefined; state.mode = "light"; });
async function mount(element: React.ReactElement) { await act(async () => { tree = create(element); }); }
const host = (type: string) => tree!.root.find(n => n.type as unknown === type);
const style = (type: string) => StyleSheet.flatten(host(type).props.style);

it("uses loaded font assets for body and headings, and keeps explicit monospace styles", async () => {
  await mount(React.createElement(AppText, { style: { fontWeight: "600" } }, "Nội dung"));
  expect(style("Text").fontFamily).toBe("BeVietnamPro_600SemiBold");
  await act(async () => tree!.update(React.createElement(AppText, { display: true }, "Tiêu đề")));
  expect(style("Text").fontFamily).toBe("Quicksand_700Bold");
  await act(async () => tree!.update(React.createElement(AppText, { style: { fontFamily: "monospace", fontWeight: "700" } }, "BK001")));
  expect(style("Text")).toMatchObject({ fontFamily: "monospace", fontWeight: "700" });
});

it("keeps Vietnamese accents clear and respects system text scaling", async () => {
  await mount(React.createElement(AppText, { style: { fontSize: 20, lineHeight: 18 }, allowFontScaling: true }, "Đăng ký"));
  expect(style("Text").lineHeight).toBeGreaterThanOrEqual(28);
  expect(host("Text").props.allowFontScaling).toBe(true);
  expect(host("Text").props.display).toBeUndefined();
});

it("reports loading and disabled button states while keeping readable primary text in dark mode", async () => {
  state.mode = "dark";
  await mount(React.createElement(AppButton, { title: "Gửi yêu cầu", onPress: vi.fn(), busy: true }));
  expect(host("Pressable").props.disabled).toBe(true);
  expect(host("Pressable").props.accessibilityState).toMatchObject({ disabled: true, busy: true });
  expect(style("Text").color).toBe("#FFFFFF");
  expect(host("ActivityIndicator").props.color).toBe("#FFFFFF");
});

it("preserves input events and highlights only the focused editable field", async () => {
  const focus = vi.fn(), blur = vi.fn(), change = vi.fn();
  await mount(React.createElement(AppInput, { accessibilityLabel: "Tên", value: "", onChangeText: change, onFocus: focus, onBlur: blur }));
  await act(async () => host("TextInput").props.onFocus({ nativeEvent: {} }));
  expect(focus).toHaveBeenCalledOnce(); expect(style("TextInput").borderColor).toBe(themes.light.brand);
  await act(async () => host("TextInput").props.onChangeText("An"));
  expect(change).toHaveBeenCalledWith("An");
  await act(async () => host("TextInput").props.onBlur({ nativeEvent: {} }));
  expect(blur).toHaveBeenCalledOnce(); expect(style("TextInput").borderColor).toBe(themes.light.border);
});

it("preserves back navigation and disables only refresh while a screen loads", async () => {
  const back = vi.fn(), refresh = vi.fn();
  await mount(React.createElement(AppScreenHeader, { title: "Chuyến thuê", onBack: back, onRefresh: refresh, busy: true }));
  const buttons = tree!.root.findAll(n => n.type as unknown === "Pressable");
  const backButton = buttons.find(n => n.props.accessibilityLabel === "Quay lại")!;
  const refreshButton = buttons.find(n => n.props.accessibilityLabel === "Làm mới")!;
  await act(async () => backButton.props.onPress());
  expect(back).toHaveBeenCalledOnce(); expect(backButton.props.disabled).toBeUndefined();
  expect(refreshButton.props.disabled).toBe(true);
});

it("falls back to initials for broken avatars and accepts an updated image URL", async () => {
  await mount(React.createElement(AppAvatar, { name: "Nguyễn Văn An", uri: "https://example.test/old.jpg" }));
  await act(async () => host("Image").props.onError());
  expect(host("Text").children.join("")).toBe("VA");
  await act(async () => tree!.update(React.createElement(AppAvatar, { name: "Nguyễn Văn An", uri: "https://example.test/new.jpg" })));
  expect(host("Image").props.source.uri).toContain("new.jpg");
});
