import React from "react";
import { act, create } from "react-test-renderer";
import { expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";
vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
vi.mock("react-native", () => ({ Modal: "Modal", ScrollView: "ScrollView", Text: "Text", View: "View", Pressable: "Pressable", ActivityIndicator: "ActivityIndicator", TextInput: "TextInput", StyleSheet: { create: (s: unknown) => s } }));
vi.mock("lucide-react-native", () => ({ ArrowLeft: "ArrowLeft" }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/features/booking/bookingService", () => ({ settleCheckoutSurcharges: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_e: unknown, fallback: string) => fallback }));
import CheckoutConfirmation from "@/features/booking/components/CheckoutConfirmation";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";
it("shows the mileage fee and full due amount before confirming the version viewed", async () => {
  const report = { type: "CheckOut", version: 4, excessMileageFee: 250000, pendingSurchargeAmount: 370000, initialOdometerKm: 1000, odometerKm: 1650, additionalSurcharges: [{ termId: 1, quantity: 1, unitPrice: 100000, amount: 100000, name: "Vệ sinh xe", note: "Bùn đất trong xe" }], lateReturnFee: 20000, outstandingSurchargeAmount: 0, travelledKm: 650, includedKm: 600, excessKm: 50 } as InspectionReportResponse;
  const booking = { totalAmount: 2000000, escrowAmount: 500000 } as BookingResponse;
  const confirm = vi.fn(); let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(React.createElement(CheckoutConfirmation, { booking, report, busy: false, onClose: vi.fn(), onConfirm: confirm })); });
  const text = JSON.stringify(tree.toJSON());
  expect(text).toContain("Phụ phí vượt km"); expect(text).toContain("250.000"); expect(text).not.toContain("1.870.000"); expect(text).toContain("1.500.000"); expect(text).toContain("370.000"); expect(text).toContain("toàn bộ phụ phí đã hiển thị"); expect(text).toContain("Bùn đất trong xe"); expect(text).toContain("Đồng hồ km");
  expect(tree.root.findAll(n => (n.type as unknown) === "Text" && n.children.includes("Qua ví MoveVN trên web/app"))).toHaveLength(0);
  expect(confirm).not.toHaveBeenCalled();
  const continueButton = tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(c => (c.type as unknown) === "Text" && c.children.includes("Tôi đã bàn giao xe · Tiếp tục")).length > 0)[0]!;
  await act(async () => continueButton.props.onPress());
  expect(confirm).not.toHaveBeenCalled();
  const button = tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(child => (child.type as unknown) === "Text" && child.children.includes("Đồng ý và xác nhận trả xe")).length > 0)[0]!;
  expect(button.props.disabled).toBe(true);
  await act(async () => button.props.onPress()); expect(confirm).not.toHaveBeenCalled();
  const wallet = tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(child => (child.type as unknown) === "Text" && child.children.includes("Qua ví MoveVN trên web/app")).length > 0)[0]!;
  await act(async () => wallet.props.onPress());
  expect(button.props.disabled).toBe(false);
  await act(async () => button.props.onPress()); expect(confirm).toHaveBeenCalledWith(report, "Wallet");
  await act(async () => tree.unmount());
});


it("lets the customer choose external payment before confirming the displayed report", async () => {
  const report = { id: 10, type: "CheckOut", version: 2, pendingSurchargeAmount: 100000 } as InspectionReportResponse;
  const booking = { totalAmount: 100000, escrowAmount: 20000 } as BookingResponse;
  const confirm = vi.fn(); let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(React.createElement(CheckoutConfirmation, { booking, report, busy: false, onClose: vi.fn(), onConfirm: confirm })); });
  const button = (label: string) => tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(c => (c.type as unknown) === "Text" && c.children.includes(label)).length > 0)[0]!;
  await act(async () => button("Tôi đã bàn giao xe · Tiếp tục").props.onPress());
  await act(async () => button("Trả trực tiếp cho chủ xe").props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain("Không trừ ví");
  await act(async () => button("Đồng ý và xác nhận trả xe").props.onPress());
  expect(confirm).toHaveBeenCalledWith(report, "External");
  await act(async () => tree.unmount());
});

it("skips payment choice for a report without surcharges", async () => {
  const report = { id: 11, type: "CheckOut", version: 1, pendingSurchargeAmount: 0 } as InspectionReportResponse;
  const booking = { totalAmount: 100000, escrowAmount: 20000 } as BookingResponse;
  const confirm = vi.fn(); let tree!: ReturnType<typeof create>;
  await act(async () => { tree = create(React.createElement(CheckoutConfirmation, { booking, report, busy: false, onClose: vi.fn(), onConfirm: confirm })); });
  const button = tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(c => (c.type as unknown) === "Text" && c.children.includes("Tôi đã bàn giao xe · Xác nhận")).length > 0)[0]!;
  await act(async () => button.props.onPress());
  expect(confirm).toHaveBeenCalledWith(report, "Wallet");
  expect(JSON.stringify(tree.toJSON())).not.toContain("Qua ví MoveVN trên web/app");
  await act(async () => tree.unmount());
});
