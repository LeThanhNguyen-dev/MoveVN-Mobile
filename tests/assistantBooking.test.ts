import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { themes } from "@/theme/tokens";
import type { BookingDraft } from "@/features/assistant/assistantService";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const mocks = vi.hoisted(() => ({ get: vi.fn(), state: vi.fn(), patch: vi.fn(), prepare: vi.fn(), confirm: vi.fn(), payment: vi.fn(), status: vi.fn(), open: vi.fn() }));
vi.mock("react-native", () => ({
  View: "View", Text: "Text", TextInput: "TextInput", Pressable: "Pressable", ScrollView: "ScrollView", ActivityIndicator: "ActivityIndicator",
  StyleSheet: { create: (value: unknown) => value }, Linking: { openURL: mocks.open },
}));
vi.mock("react-native-qrcode-svg", () => ({ default: "QRCode" }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_err: unknown, fallback: string) => fallback }));
vi.mock("@/features/vehicles/components/RentalPeriodSheet", () => ({ default: "RentalPeriodSheet" }));
vi.mock("@/features/assistant/assistantService", () => ({
  getDraft: mocks.get, getConversationState: mocks.state, patchDraft: mocks.patch, prepareDraft: mocks.prepare,
  confirmAction: mocks.confirm, getDraftPaymentLink: mocks.payment, getAssistantPaymentStatus: mocks.status,
}));
import BookingFunnel from "@/features/assistant/components/BookingFunnel";
import { BookingPaymentCard, ConfirmationCard } from "@/features/assistant/components/AssistantBooking";

let tree: ReactTestRenderer;
const quote = { quoteId: "quote", vehicleId: 7, startAt: "2099-01-01T03:00:00Z", endAt: "2099-01-03T03:00:00Z", rental: 1000000, rentalDiscount: 0, promotionDiscount: 0, total: 1000000, deposit: 300000, securityDeposit: 1000000, deliveryFee: null, expiresAt: "2099-01-01" };
function draft(overrides: Partial<BookingDraft> = {}): BookingDraft {
  return { draftId: "draft", version: 1, status: "Draft", slots: { vehicleId: 7, startAt: quote.startAt, endAt: quote.endAt, pickupMode: "self_pickup" }, missing: [], quote, previousTotal: null, confirmToken: "token", bookingId: null, expiresAt: "2099-01-01", ...overrides };
}
async function render(element: React.ReactElement) { await act(async () => { tree = create(element); }); }
function button(label: string) {
  const match = tree.root.findAllByType("Pressable" as never).find(node => JSON.stringify(node.findAllByType("Text" as never).map(text => text.props.children)).includes(label));
  if (!match) throw new Error(`Missing button ${label}`);
  return match;
}
async function press(label: string) { await act(async () => { await button(label).props.onPress(); }); }
beforeEach(() => { vi.clearAllMocks(); mocks.get.mockResolvedValue(draft()); mocks.patch.mockImplementation(async (_id, version, patch) => draft({ version: version + 1, slots: { ...draft().slots, ...patch } })); mocks.prepare.mockResolvedValue(draft({ version: 3 })); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it("requires separate consent before confirming an increased price", async () => {
  mocks.confirm.mockResolvedValue({ status: "PaymentPending", bookingId: 9 });
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: draft({ previousTotal: 900000 }) }));
  expect(button("Xác nhận đặt xe").props.disabled).toBe(true);
  const consent = tree.root.findByProps({ accessibilityRole: "checkbox" });
  await act(async () => consent.props.onPress());
  expect(button("Xác nhận đặt xe").props.disabled).toBe(false);
  await press("Xác nhận đặt xe");
  expect(mocks.confirm).toHaveBeenCalledWith("token", true);
  expect(button("Lấy đường dẫn thanh toán")).toBeDefined();
});

it("keeps cancellation confirmation separate from booking payment", async () => {
  const booked = vi.fn();
  mocks.confirm.mockResolvedValue({ status: "Cancelled", bookingId: 9 });
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: { kind: "cancel", bookingId: 9, quote: { refundAmount: 100, forfeitedAmount: 0, policyMessage: "Hoàn tiền" }, confirmToken: "cancel", expiresAt: "2099-01-01" }, onBooked: booked }));
  await press("Xác nhận hủy đơn");
  expect(mocks.confirm).toHaveBeenCalledWith("cancel", false);
  expect(booked).not.toHaveBeenCalled();
});

it("uses the confirmed payment link and renders its QR without requesting another draft payment", async () => {
  const view = vi.fn();
  await render(React.createElement(BookingPaymentCard, { conversationId: "c", bookingId: 9, initial: { checkoutUrl: "https://pay.example/9", qrCode: "payment-data", orderCode: 9, paymentLinkId: "pay9" }, onViewBooking: view }));
  await press("Mở trang thanh toán");
  expect(mocks.open).toHaveBeenCalledWith("https://pay.example/9");
  expect(mocks.payment).not.toHaveBeenCalled();
  expect(tree.root.findByType("QRCode" as never).props.value).toBe("payment-data");
  await press("Xem đơn"); expect(view).toHaveBeenCalledWith(9);
});

it("saves promo and prepares a versioned draft through all five booking steps", async () => {
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7, brandName: "Honda" }], revision: 0, onClose: vi.fn() }));
  await press("Tiếp tục"); await press("Tiếp tục");
  await act(async () => tree.root.findByProps({ accessibilityLabel: "Mã khuyến mãi" }).props.onChangeText("sale"));
  await press("Tiếp tục");
  expect(mocks.patch).toHaveBeenCalledWith("c", 1, { promoCode: "SALE" });
  await press("Tiếp tục");
  expect(mocks.prepare).toHaveBeenCalledWith("c", 2);
  expect(button("Xác nhận đặt xe")).toBeDefined();
  expect(mocks.confirm).not.toHaveBeenCalled();
});

it("does not advance with missing rental dates", async () => {
  mocks.get.mockResolvedValue(draft({ slots: {} }));
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [], revision: 0, onClose: vi.fn() }));
  await press("Tiếp tục");
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ accessibilityRole: "alert" }).props.children).toContain("ngày nhận");
});
