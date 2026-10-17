import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";

vi.stubGlobal("React", React); vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
const mocks = vi.hoisted(() => ({ settle: vi.fn(), updated: vi.fn() }));
vi.mock("react-native", () => ({ Text: "Text", View: "View", Pressable: "Pressable", TextInput: "TextInput", ActivityIndicator: "ActivityIndicator", StyleSheet: { create: (s: unknown) => s } }));
vi.mock("lucide-react-native", () => ({ ArrowLeft: "ArrowLeft" }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_error: unknown, fallback: string) => fallback }));
vi.mock("@/features/booking/bookingService", () => ({ settleCheckoutSurcharges: mocks.settle }));
import OutstandingSurchargePayment from "@/features/booking/components/OutstandingSurchargePayment";

let tree: ReactTestRenderer;
beforeEach(() => vi.clearAllMocks());
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });
const report = { id: 60, version: 2, type: "CheckOut", externalPendingSurchargeAmount: 250000, outstandingSurchargeAmount: 250000 } as InspectionReportResponse;
const booking = { id: 109, status: "Completed", externalPendingSurchargeAmount: 0, outstandingSurchargeAmount: 0 } as BookingResponse;
function button(label: string) { return tree.root.findAll(n => (n.type as unknown) === "Pressable" && n.findAll(c => (c.type as unknown) === "Text" && c.children.includes(label)).length > 0)[0]!; }

for (const status of ["Returned", "Completed"]) {
  it(`shows the owner's external receipt action for ${status} even when booking totals are stale`, async () => {
    await act(async () => { tree = create(React.createElement(OutstandingSurchargePayment, { booking: { ...booking, status }, report, role: "Owner", onUpdated: mocks.updated })); });
    expect(JSON.stringify(tree.toJSON())).toContain("250.000");
    const confirm = button("Xác nhận đã nhận đủ tiền phụ thu trực tiếp");
    expect(confirm.props.disabled).toBe(true);
    await act(async () => confirm.props.onPress());
    expect(mocks.settle).not.toHaveBeenCalled();
    await act(async () => tree.root.find(n => (n.type as unknown) === "TextInput").props.onChangeText("Đã nhận đủ 250.000đ tiền mặt"));
    mocks.settle.mockResolvedValueOnce({ outstandingSurchargeAmount: 0 });
    await act(async () => confirm.props.onPress());
    expect(mocks.settle).toHaveBeenCalledExactlyOnceWith(109, { action: "ConfirmExternal", expectedVersion: 2, note: "Đã nhận đủ 250.000đ tiền mặt" });
    expect(mocks.updated).toHaveBeenCalledOnce();
  });
}

it("never offers the owner receipt button to the customer", async () => {
  await act(async () => { tree = create(React.createElement(OutstandingSurchargePayment, { booking, report, role: "Customer" })); });
  expect(button("Xác nhận đã nhận đủ tiền phụ thu trực tiếp")).toBeUndefined();
  expect(button("Thanh toán qua ví MoveVN")).toBeDefined();
});

it("hides the pending payment card after the latest report records full payment", async () => {
  await act(async () => { tree = create(React.createElement(OutstandingSurchargePayment, {
    booking: { ...booking, externalPendingSurchargeAmount: 250000, outstandingSurchargeAmount: 250000 },
    report: { ...report, externalPendingSurchargeAmount: 0, outstandingSurchargeAmount: 0 }, role: "Owner",
  })); });
  expect(tree.toJSON()).toBeNull();
});
