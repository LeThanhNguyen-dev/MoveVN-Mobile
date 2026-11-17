import { setAssistantLocale } from "../src/features/assistant/assistantLanguage";
import { AssistantLocaleProvider } from "../src/features/assistant/assistantLocale";
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
vi.mock("expo-secure-store", () => ({ getItemAsync: vi.fn(async () => null), setItemAsync: vi.fn(async () => {}) }));
vi.mock("react-native-qrcode-svg", () => ({ default: "QRCode" }));
vi.mock("@/theme/useTheme", () => ({ useTheme: () => ({ theme: themes.light }) }));
vi.mock("@/services/apiClient", () => ({ getApiErrorMessage: (_err: unknown, fallback: string) => fallback }));
vi.mock("@/features/vehicles/components/RentalPeriodSheet", () => ({ default: "RentalPeriodSheet" }));
vi.mock("@/features/locations/components/AddressAutocomplete", () => ({ default: "AddressAutocomplete" }));
vi.mock("@/features/assistant/assistantService", () => ({
  assistantFailure: (_err: unknown, fallback: string) => fallback,
  getDraft: mocks.get, getConversationState: mocks.state, patchDraft: mocks.patch, prepareDraft: mocks.prepare,
  confirmAction: mocks.confirm, getDraftPaymentLink: mocks.payment, getAssistantPaymentStatus: mocks.status,
}));
import BookingFunnel from "@/features/assistant/components/BookingFunnel";
import { BookingPaymentCard, ConfirmationCard, QuoteCard } from "@/features/assistant/components/AssistantBooking";

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
beforeEach(() => { setAssistantLocale("vi"); vi.clearAllMocks(); mocks.state.mockResolvedValue({ activeFilters: {}, focusVehicleId: null }); mocks.get.mockResolvedValue(draft()); mocks.patch.mockImplementation(async (_id, version, patch) => draft({ version: version + 1, slots: { ...draft().slots, ...patch } })); mocks.prepare.mockResolvedValue(draft({ version: 3 })); });
afterEach(async () => { if (tree) await act(async () => tree.unmount()); });

it("keeps dates edited and saved in the form when an older chat suggestion is refreshed", async () => {
  const props = { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, initialPeriod: { startAt: "2099-01-01", endAt: "2099-01-03" }, onClose: vi.fn() };
  await render(React.createElement(BookingFunnel, props));
  await act(async () => tree.root.findAllByType("TextInput" as never)[0]!.props.onChangeText("2099-01-02"));
  await press("Tiếp tục");
  const saved = draft({ version: 2, slots: { ...draft().slots, startAt: "2099-01-02T03:00:00Z" } });
  mocks.get.mockResolvedValue(saved);
  await act(async () => tree.update(React.createElement(BookingFunnel, { ...props, revision: 1 })));
  await press("Quay lại");
  expect(tree.root.findAllByType("TextInput" as never)[0]!.props.value).toBe("2099-01-02");
});

it("reopens saved customer form dates instead of old dates from chat history", async () => {
  const saved = draft({ slots: { ...draft().slots, startAt: "2099-01-10T03:00:00Z", endAt: "2099-01-12T03:00:00Z" } });
  mocks.get.mockResolvedValue(saved);
  mocks.state.mockResolvedValue({ activeFilters: { startAt: saved.slots.startAt, endAt: saved.slots.endAt }, slotEvidence: { startAt: { origin: "CustomerForm", confirmation: "Confirmed", precision: "DateTime" }, endAt: { origin: "CustomerForm", confirmation: "Confirmed", precision: "DateTime" } } });
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, initialPeriod: { startAt: "2099-01-01", endAt: "2099-01-03" }, onClose: vi.fn() }));
  const inputs = tree.root.findAllByType("TextInput" as never);
  expect(inputs[0]!.props.value).toBe("2099-01-10");
  expect(inputs[1]!.props.value).toBe("10:00");
  expect(inputs[2]!.props.value).toBe("2099-01-12");
});

it("keeps saved draft dates on state 503 and uses timeline only for a missing return", async () => {
  const saved = draft({ slots: { ...draft().slots, startAt: "2099-01-10T03:00:00Z", endAt: null } });
  mocks.get.mockResolvedValue(saved);
  mocks.state.mockRejectedValue({ response: { status: 503 } });
  const props = { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, initialPeriod: { startAt: "2099-01-01", endAt: "2099-01-12T03:00:00Z" }, onClose: vi.fn() };
  await render(React.createElement(BookingFunnel, props));
  await act(async () => tree.update(React.createElement(BookingFunnel, { ...props, revision: 1 })));
  const inputs = tree.root.findAllByType("TextInput" as never);
  expect(inputs[0]!.props.value).toBe("2099-01-10");
  expect(inputs[1]!.props.value).toBe("10:00");
  expect(inputs[2]!.props.value).toBe("2099-01-12");
  expect(inputs[3]!.props.value).toBe("10:00");
});

it("shows an English quote and payment controls with explicit Vietnam time and VND", async () => {
  // A conversation may be English while the device/UI preference remains Vietnamese.
  setAssistantLocale("vi");
  await render(React.createElement(AssistantLocaleProvider, { locale: "en", children: React.createElement(QuoteCard, { quote }) }));
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain("Trip quote");
  expect(output).toContain("Vietnam time (UTC+7)");
  expect(output).toContain("Rental total:");
  expect(output).toContain("1,000,000");
  expect(output).not.toContain("Tổng tiền thuê");
});

it("requires selected coordinates and saves delivery and its verified fee in quick booking", async () => {
  const deliverySlots = { ...draft().slots, pickupMode: "delivery" as const, pickupAddress: "Điểm giao", pickupLatitude: 16.1, pickupLongitude: 108 };
  mocks.prepare.mockResolvedValue(draft({ slots: deliverySlots, quote: { ...quote, deliveryFee: 61000, deliveryDistanceKm: 11.1, total: 1061000, deposit: 212200 } }));
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7, brandName: "Honda" }], revision: 0, onClose: vi.fn() }));
  await press("Tiếp tục"); await press("Tiếp tục"); await press("Tiếp tục");
  await press("Giao xe tận nơi");
  const address = () => tree.root.findAllByType("AddressAutocomplete" as never).find(node => node.props.label === "Địa chỉ giao xe")!;
  await act(async () => address().props.onChange("Điểm giao"));
  await press("Tiếp tục");
  expect(mocks.prepare).not.toHaveBeenCalled();
  await act(async () => address().props.onSelect({ address: "Điểm giao", latitude: 16.1, longitude: 108 }));
  await press("Giao xe tận nơi"); // Reselecting the active mode must preserve the place.
  await press("Tiếp tục");
  expect(mocks.patch).toHaveBeenLastCalledWith("c", expect.any(Number), expect.objectContaining({ pickupLatitude: 16.1, pickupLongitude: 108, pickupMode: "delivery" }));
  expect(JSON.stringify(tree.toJSON())).toContain("61.000");
  expect(JSON.stringify(tree.toJSON())).not.toContain("Nhận xe tại địa chỉ của chủ xe");
});

it("shows free delivery as verified delivery rather than pickup at the owner", async () => {
  await render(React.createElement(QuoteCard, { quote: { ...quote, deliveryFee: 0, deliveryDistanceKm: 1.1 }, slots: { pickupMode: "delivery", pickupAddress: "Điểm giao" } }));
  const output = JSON.stringify(tree.toJSON());
  expect(output).toContain("Miễn phí");
  expect(output).not.toContain("Nhận xe tại địa chỉ của chủ xe");
});

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

it("keeps expired or superseded confirmations inert", async () => {
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: draft({ expiresAt: "2000-01-01T00:00:00Z" }) }));
  expect(button("Xác nhận đặt xe").props.disabled).toBe(true);
  await press("Xác nhận đặt xe");
  expect(mocks.confirm).not.toHaveBeenCalled();
});

it("keeps cancellation confirmation separate from booking payment", async () => {
  const booked = vi.fn();
  const view = vi.fn();
  mocks.confirm.mockResolvedValue({ status: "Cancelled", bookingId: 9 });
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: { kind: "cancel", bookingId: 9, quote: { refundAmount: 100, forfeitedAmount: 0, policyMessage: "Hoàn tiền" }, confirmToken: "cancel", expiresAt: "2099-01-01" }, onBooked: booked, onViewBooking: view }));
  await press("Xác nhận hủy đơn");
  expect(mocks.confirm).toHaveBeenCalledWith("cancel", false);
  expect(booked).not.toHaveBeenCalled();
  expect(view).not.toHaveBeenCalled();
});

it("opens confirmed booking details once, after the server responds", async () => {
  const view = vi.fn();
  let finish!: (value: unknown) => void;
  mocks.confirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: draft(), onViewBooking: view }));
  const onPress = button("Xác nhận đặt xe").props.onPress;
  await act(async () => { onPress(); onPress(); });
  expect(view).not.toHaveBeenCalled();
  await act(async () => finish({ status: "PaymentPending", bookingId: 9 }));
  expect(view).toHaveBeenCalledExactlyOnceWith(9);
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
});

it("closes quick booking and opens details after confirmation", async () => {
  const close = vi.fn(), view = vi.fn();
  mocks.confirm.mockResolvedValue({ status: "PaymentPending", bookingId: 9 });
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7, brandName: "Honda" }], revision: 0, onClose: close, onViewBooking: view }));
  for (let step = 0; step < 4; step++) await press("Tiếp tục");
  expect(view).not.toHaveBeenCalled();
  await press("Xác nhận đặt xe");
  expect(close).toHaveBeenCalledTimes(1);
  expect(view).toHaveBeenCalledExactlyOnceWith(9);
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

it("exposes selected vehicle and pickup choices to assistive technologies", async () => {
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7, brandName: "Honda" }, { id: 8, brandName: "Toyota" }], revision: 0, onClose: vi.fn() }));
  await press("Tiếp tục");
  let radios = tree.root.findAllByType("Pressable" as never).filter(node => node.props.accessibilityRole === "radio");
  expect(radios.map(node => node.props["aria-checked"])).toEqual([true, false]);
  await act(async () => radios[1]!.props.onPress());
  radios = tree.root.findAllByType("Pressable" as never).filter(node => node.props.accessibilityRole === "radio");
  expect(radios.map(node => node.props["aria-checked"])).toEqual([false, true]);
  await press("Tiếp tục"); await press("Tiếp tục");
  radios = tree.root.findAllByType("Pressable" as never).filter(node => node.props.accessibilityRole === "radio");
  expect(radios.map(node => node.props["aria-checked"])).toEqual([true, false]);
});

it("does not advance with missing rental dates", async () => {
  mocks.get.mockResolvedValue(draft({ slots: {} }));
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [], revision: 0, onClose: vi.fn() }));
  await press("Tiếp tục");
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(tree.root.findByProps({ accessibilityRole: "alert" }).props.children).toContain("ngày nhận");
});

it.each([
  ["past pickup", [[0, "2000-01-01"]]],
  ["return before pickup", [[2, "2098-12-31"]]],
  ["return equal to pickup", [[2, "2099-01-01"]]],
  ["invalid calendar date", [[0, "2099-02-30"]]],
  ["missing pickup clock", [[1, ""]]],
  ["invalid return clock", [[3, "25:00"]]],
] as const)("blocks %s before saving or preparing a booking", async (_name, edits) => {
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, onClose: vi.fn() }));
  for (const [index, value] of edits) await act(async () => tree.root.findAllByType("TextInput" as never)[index]!.props.onChangeText(value));
  await press("Tiếp tục");
  expect(tree.root.findByProps({ accessibilityRole: "alert" }).props.children).toContain("ngày nhận");
  expect(tree.root.findAllByType("TextInput" as never)).toHaveLength(4);
  expect(mocks.patch).not.toHaveBeenCalled();
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.confirm).not.toHaveBeenCalled();
});

it("blocks the vehicle step until the customer has selected a car", async () => {
  mocks.get.mockResolvedValue(draft({ slots: { startAt: quote.startAt, endAt: quote.endAt, pickupMode: "self_pickup" } }));
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [], revision: 0, onClose: vi.fn() }));
  await press("Tiếp tục"); await press("Tiếp tục");
  expect(tree.root.findByProps({ accessibilityRole: "alert" }).props.children).toContain("chọn một xe");
  expect(mocks.prepare).not.toHaveBeenCalled();
  expect(mocks.confirm).not.toHaveBeenCalled();
});

it.each([409, 503])("retries once after a retryable HTTP %i prepare failure and reaches confirmation", async status => {
  mocks.prepare.mockRejectedValueOnce({ response: { status } });
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, onClose: vi.fn() }));
  for (let step = 0; step < 4; step++) await press("Tiếp tục");
  expect(mocks.prepare).toHaveBeenNthCalledWith(1, "c", 1);
  expect(mocks.prepare).toHaveBeenNthCalledWith(2, "c", 1);
  expect(button("Xác nhận đặt xe")).toBeDefined();
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(mocks.payment).not.toHaveBeenCalled();
});

it("keeps the pickup step and avoids confirmation when prepare fails with HTTP 422", async () => {
  mocks.prepare.mockRejectedValueOnce({ response: { status: 422 } });
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, onClose: vi.fn() }));
  for (let step = 0; step < 4; step++) await press("Tiếp tục");
  expect(mocks.prepare).toHaveBeenCalledExactlyOnceWith("c", 1);
  expect(tree.root.findByProps({ accessibilityRole: "alert" }).props.children).toContain("Thông tin đã thay đổi");
  expect(tree.root.findAllByType("Pressable" as never).some(node => JSON.stringify(node.findAllByType("Text" as never).map(text => text.props.children)).includes("Xác nhận đặt xe"))).toBe(false);
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(mocks.payment).not.toHaveBeenCalled();
});

it("keeps unsaved rental edits and retries once when PATCH fails with HTTP 503", async () => {
  mocks.patch.mockRejectedValueOnce({ response: { status: 503 } });
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, onClose: vi.fn() }));
  await act(async () => tree.root.findAllByType("TextInput" as never)[1]!.props.onChangeText("09:45"));
  await press("Tiếp tục");
  expect(mocks.patch).toHaveBeenLastCalledWith("c", 1, { startAt: "2099-01-01T02:45:00.000Z" });
  expect(mocks.prepare).not.toHaveBeenCalled();
  await press("Quay lại");
  expect(tree.root.findAllByType("TextInput" as never)[1]!.props.value).toBe("09:45");
});

it("keeps local edits and retries against a newer server draft after a failed PATCH", async () => {
  mocks.patch.mockRejectedValueOnce({ response: { status: 409 } });
  mocks.get.mockResolvedValueOnce(draft()).mockResolvedValueOnce(draft({ version: 2, slots: { ...draft().slots, startAt: "2099-01-02T04:00:00Z" } }));
  await render(React.createElement(BookingFunnel, { conversationId: "c", vehicles: [{ id: 7 }], revision: 0, onClose: vi.fn() }));
  await act(async () => tree.root.findAllByType("TextInput" as never)[1]!.props.onChangeText("09:45"));
  await press("Tiếp tục");
  expect(mocks.patch).toHaveBeenLastCalledWith("c", 2, { startAt: "2099-01-01T02:45:00.000Z" });
  expect(mocks.prepare).not.toHaveBeenCalled();
  await press("Quay lại");
  const fields = tree.root.findAllByType("TextInput" as never);
  expect(fields[0]!.props.value).toBe("2099-01-01");
  expect(fields[1]!.props.value).toBe("09:45");
});

it("rejects expired confirmations without showing a created booking or payment", async () => {
  mocks.confirm.mockRejectedValue(new Error("expired"));
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: draft() }));
  await press("Xác nhận đặt xe");
  expect(JSON.stringify(tree.toJSON())).toContain("Xác nhận đã hết hạn");
  expect(JSON.stringify(tree.toJSON())).not.toContain("Đơn đã tạo");
  expect(mocks.payment).not.toHaveBeenCalled();
});

it("requires renewed consent and uses the new token when confirmation reprices the booking", async () => {
  const view = vi.fn();
  mocks.confirm.mockResolvedValueOnce({ status: "PriceChanged", draft: draft({ confirmToken: "new-token", previousTotal: 900000 }), message: "Giá đã tăng" })
    .mockResolvedValueOnce({ status: "PaymentPending", bookingId: 9 });
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: draft(), onViewBooking: view }));
  await press("Xác nhận đặt xe");
  expect(view).not.toHaveBeenCalled();
  expect(button("Xác nhận đặt xe").props.disabled).toBe(true);
  await act(async () => tree.root.findByProps({ accessibilityRole: "checkbox" }).props.onPress());
  await press("Xác nhận đặt xe");
  expect(mocks.confirm.mock.calls.map(call => call[0])).toEqual(["token", "new-token"]);
  expect(view).toHaveBeenCalledExactlyOnceWith(9);
});

it("only sends one confirmation if two taps arrive before React renders busy state", async () => {
  let finish!: (value: unknown) => void;
  mocks.confirm.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  await render(React.createElement(ConfirmationCard, { conversationId: "c", proposal: draft() }));
  const onPress = button("Xác nhận đặt xe").props.onPress;
  await act(async () => { onPress(); onPress(); });
  expect(mocks.confirm).toHaveBeenCalledTimes(1);
  await act(async () => finish({ status: "PaymentPending", bookingId: 9 }));
});

it("can recover a payment link without creating another booking", async () => {
  mocks.payment.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ checkoutUrl: "https://pay.example/9", qrCode: "qr" });
  await render(React.createElement(BookingPaymentCard, { conversationId: "c", bookingId: 9 }));
  await press("Lấy đường dẫn thanh toán"); await press("Lấy đường dẫn thanh toán");
  expect(mocks.confirm).not.toHaveBeenCalled();
  expect(mocks.open).toHaveBeenCalledWith("https://pay.example/9");
});

it("checks server payment confirmation instead of assuming opening the payment page is payment", async () => {
  mocks.status.mockResolvedValueOnce({ status: { isConfirmed: false, message: "Chờ thanh toán" } })
    .mockResolvedValueOnce({ status: { isConfirmed: true, message: "Paid" } });
  await render(React.createElement(BookingPaymentCard, { conversationId: "c", bookingId: 9 }));
  await press("Tôi đã thanh toán");
  expect(JSON.stringify(tree.toJSON())).toContain("Chờ thanh toán");
  await press("Tôi đã thanh toán");
  expect(JSON.stringify(tree.toJSON())).toContain("Đã ghi nhận thanh toán");
});

it("does not claim payment succeeded when its status request fails", async () => {
  mocks.status.mockRejectedValueOnce(new Error("offline"));
  await render(React.createElement(BookingPaymentCard, { conversationId: "c", bookingId: 9 }));
  await press("Tôi đã thanh toán");
  expect(JSON.stringify(tree.toJSON())).toContain("Chưa kiểm tra được thanh toán");
  expect(JSON.stringify(tree.toJSON())).not.toContain("Đã ghi nhận thanh toán");
  expect(mocks.confirm).not.toHaveBeenCalled();
});

it.each(["https://", "http://pay.example/9", "javascript:alert(1)", "data:text/html,payment"])("does not open invalid or non-HTTPS checkout URLs (%s)", async url => {
  mocks.payment.mockResolvedValue({ checkoutUrl: url, orderCode: 9, paymentLinkId: "bad" });
  await render(React.createElement(BookingPaymentCard, { conversationId: "c", bookingId: 9 }));
  await press("Lấy đường dẫn thanh toán");
  expect(mocks.open).not.toHaveBeenCalled();
  expect(JSON.stringify(tree.toJSON())).toContain("Đường dẫn thanh toán không hợp lệ");
});
