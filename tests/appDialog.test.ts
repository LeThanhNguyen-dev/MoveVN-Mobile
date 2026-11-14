import React from "react";
import { act, create, type ReactTestInstance, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

vi.mock("react-native", () => ({
  Modal: ({ visible, children }: { visible: boolean; children: React.ReactNode }) => visible ? React.createElement("Modal", null, children) : null,
  Pressable: "Pressable",
  StyleSheet: { create: (styles: unknown) => styles },
  Text: "Text",
  View: "View",
}));
vi.mock("lucide-react-native", () => Object.fromEntries(["CircleCheck", "Info", "TriangleAlert"].map((name) => [name, name])));
vi.mock("@/theme/useTheme", async () => { const { themes } = await import("@/theme/tokens"); return { useTheme: () => ({ theme: themes.light }) }; });

import AppDialogHost from "@/components/appDialog/AppDialogHost";
import { showAppAlert, showAppDialog, useAppDialogStore } from "@/components/appDialog/dialogStore";

let tree: ReactTestRenderer | undefined;

const textOf = (node: ReactTestInstance) => node.findAll((n) => n.type as unknown === "Text").map((n) => n.children.filter((c) => typeof c === "string").join("")).join("\n");
const text = () => textOf(tree!.root);
const button = (label: string) => tree!.root.findAll((n) => n.type as unknown === "Pressable" && textOf(n) === label)[0];

beforeEach(async () => {
  useAppDialogStore.getState().clear();
  await act(async () => { tree = create(React.createElement(AppDialogHost)); });
});

afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});

it("renders an alert with the shared popup structure and closes on its only button", async () => {
  await act(async () => { showAppAlert("Không tải được", "Vui lòng thử lại."); });
  expect(text()).toContain("Không tải được");
  expect(text()).toContain("Vui lòng thử lại.");
  await act(async () => { button("Đóng")!.props.onPress(); });
  expect(text()).toBe("");
  expect(useAppDialogStore.getState().dialogs).toHaveLength(0);
});

it("runs the pressed action after dismissing and keeps the queue in order", async () => {
  const confirmed = vi.fn();
  await act(async () => {
    showAppAlert("Xóa xe?", "Không thể hoàn tác.", [
      { text: "Hủy", style: "cancel" },
      { text: "Xóa", style: "destructive", onPress: confirmed },
    ]);
    showAppDialog({ title: "Thông báo thứ hai", tone: "success" });
  });
  expect(text()).toContain("Xóa xe?");
  expect(text()).not.toContain("Thông báo thứ hai");
  await act(async () => { button("Xóa")!.props.onPress(); });
  expect(confirmed).toHaveBeenCalledTimes(1);
  expect(text()).toContain("Thông báo thứ hai");
  await act(async () => { button("Đóng")!.props.onPress(); });
  expect(text()).toBe("");
});
