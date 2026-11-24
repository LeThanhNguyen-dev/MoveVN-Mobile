import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useAppDialogStore } from "@/components/appDialog/dialogStore";
import type { PayOsSheetData } from "@/features/payments/components/PayOsQrSheet";

vi.stubGlobal("React", React);
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

vi.mock("react-native", () => ({
  Modal: ({ visible, children }: { visible: boolean; children?: React.ReactNode }) =>
    visible ? React.createElement("Modal", null, children) : null,
  Pressable: "Pressable",
  ScrollView: "ScrollView",
  Text: "Text",
  View: "View",
  StyleSheet: { create: (styles: unknown) => styles, absoluteFill: "AbsoluteFill", absoluteFillObject: {} },
  Linking: { openURL: vi.fn() },
}));
vi.mock("expo-clipboard", () => ({ setStringAsync: vi.fn() }));
vi.mock("@/services/deviceStorage", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => {}),
  deleteItemAsync: vi.fn(async () => {}),
}));
vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));
vi.mock("react-native-qrcode-svg", () => ({ default: "QRCode" }));
vi.mock("lucide-react-native", () =>
  Object.fromEntries(
    ["CheckCircle2", "Copy", "ExternalLink", "Landmark", "Lightbulb", "TriangleAlert", "X"].map((name) => [name, name]),
  ),
);
vi.mock("@/theme/useTheme", async () => {
  const { themes } = await import("@/theme/tokens");
  return { useTheme: () => ({ theme: themes.light }) };
});

import PayOsQrSheet from "@/features/payments/components/PayOsQrSheet";

const sheet: PayOsSheetData = {
  checkoutUrl: "https://pay.payos.vn/web/abc",
  qrCode: "000201010212",
  orderCode: 123456,
  amount: 200000,
  bin: "970436",
  accountNumber: "0123456789",
  accountName: "MOVEVN",
  expiredAt: Math.floor(Date.now() / 1000) + 900,
  title: "Nạp tiền vào ví",
};

let tree: ReactTestRenderer | undefined;

const text = () => JSON.stringify(tree!.toJSON());
const byLabel = (label: string) =>
  tree!.root.findAll((n) => (n.type as unknown) === "Pressable" && n.props.accessibilityLabel === label)[0];
const byText = (label: string) =>
  tree!.root.findAll(
    (n) =>
      (n.type as unknown) === "Pressable" &&
      n.findAll((c) => (c.type as unknown) === "Text" && c.children.filter((x) => typeof x === "string").join("") === label)
        .length > 0,
  )[0];

async function render(onCancel: () => void | Promise<void>) {
  await act(async () => {
    tree = create(React.createElement(PayOsQrSheet, { data: sheet, onClose: vi.fn(), onCancel }));
  });
}

beforeEach(() => {
  useAppDialogStore.getState().clear();
});

afterEach(async () => {
  if (tree) await act(async () => tree!.unmount());
  tree = undefined;
});

it("mở confirm ngay trong Modal của sheet, không dựng popup toàn cục", async () => {
  await render(vi.fn());
  await act(async () => { byLabel("Hủy giao dịch")!.props.onPress(); });
  expect(text()).toContain("Hủy giao dịch?");
  expect(text()).toContain("Xác nhận hủy");
  expect(text()).toContain("Giữ lại");
  expect(useAppDialogStore.getState().dialogs).toHaveLength(0);

  await act(async () => { byText("Giữ lại")!.props.onPress(); });
  expect(text()).not.toContain("Hủy giao dịch?");
});

it("bấm Xác nhận hủy thì gọi onCancel", async () => {
  const onCancel = vi.fn().mockResolvedValue(undefined);
  await render(onCancel);
  await act(async () => { byLabel("Hủy giao dịch")!.props.onPress(); });
  await act(async () => { byLabel("Xác nhận hủy")!.props.onPress(); });
  expect(onCancel).toHaveBeenCalledOnce();
  expect(text()).not.toContain("Không hủy được giao dịch.");
});

it("hủy lỗi thì báo lỗi ngay trong sheet và giữ sheet mở", async () => {
  const onCancel = vi.fn().mockRejectedValue(new Error("network"));
  await render(onCancel);
  await act(async () => { byLabel("Hủy giao dịch")!.props.onPress(); });
  await act(async () => { byLabel("Xác nhận hủy")!.props.onPress(); });
  expect(text()).toContain("Không hủy được giao dịch. Vui lòng thử lại.");
  expect(text()).toContain("Nạp tiền vào ví");
  expect(useAppDialogStore.getState().dialogs).toHaveLength(0);
});
