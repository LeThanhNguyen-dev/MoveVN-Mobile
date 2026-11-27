import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.mock("react-native", () => ({ Image: "Image", Modal: "Modal", Pressable: "Pressable", View: "View", Text: "Text", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (value: unknown) => value, absoluteFill: {} } }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
import PhotoPreview from "@/components/PhotoPreview";
let tree: ReactTestRenderer;
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it.each(["file:///local.jpg", "https://example.invalid/evidence.jpg"])("opens %s directly as an image and closes with Back", async uri => {
  await act(async () => { tree = create(React.createElement(PhotoPreview, { photos: [{ uri, name: "evidence.jpg" }] })); });
  const preview = tree.root.find(n => (n.type as unknown) === "Pressable" && n.props.accessibilityLabel === "Xem ảnh 1");
  await act(async () => preview.props.onPress());
  const modal = tree.root.find(n => (n.type as unknown) === "Modal");
  expect(modal.find(n => (n.type as unknown) === "Image").props.source.uri).toBe(uri);
  await act(async () => modal.props.onRequestClose());
  expect(tree.root.findAll(n => (n.type as unknown) === "Modal")).toHaveLength(0);
});

it("retries a failed image and removes a selected attachment by index", async () => {
  const remove = vi.fn();
  await act(async () => { tree = create(React.createElement(PhotoPreview, { photos: [{ uri: "file:///local.jpg" }], onRemove: remove })); });
  await act(async () => tree.root.find(n => (n.type as unknown) === "Image").props.onError());
  expect(JSON.stringify(tree.toJSON())).toContain("Không tải được ảnh");
  const retry = tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(c => (c.type as unknown) === "Text" && c.children.includes("Thử lại")).length > 0).at(-1)!;
  await act(async () => retry.props.onPress());
  expect(JSON.stringify(tree.toJSON())).not.toContain("Không tải được ảnh");
  await act(async () => tree.root.find(n => (n.type as unknown) === "Pressable" && n.props.accessibilityLabel === "Xóa ảnh 1").props.onPress());
  expect(remove).toHaveBeenCalledWith(0);
});
