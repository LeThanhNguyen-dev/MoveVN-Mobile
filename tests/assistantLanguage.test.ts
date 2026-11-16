import { afterEach, describe, expect, it } from "vitest";
import { assistantDate, assistantMoney, assistantText, assistantVehicleLabel, normalizeAssistantLocale, rentalInstant, rentalParts } from "../src/features/assistant/assistantLanguage";
import { decodeAnswer, conversationBookingPeriod } from "../src/features/assistant/assistantProtocol";
import { resolveBookingPeriod } from "../src/features/assistant/assistantBookingPeriod";
import { getAssistantReplies } from "../src/features/assistant/assistantPresentation";
import type { TimelineItem } from "../src/features/assistant/assistantService";

const originalTimezone = process.env.TZ;
afterEach(() => { if (originalTimezone === undefined) delete process.env.TZ; else process.env.TZ = originalTimezone; });
const message = (answer: unknown): TimelineItem => ({ id: "a", role: "assistant", status: "Completed", createdAt: "2026-11-11T00:00:00Z", content: "Cars", answer: decodeAnswer(answer) });

describe("assistant English and context", () => {
  it("accepts supported regional locales without treating arbitrary strings as languages", () => {
    expect(normalizeAssistantLocale("en-US")).toBe("en");
    expect(normalizeAssistantLocale("vi_VN")).toBe("vi");
    for (const value of ["fr", "english", "en<script>", null, 123]) expect(normalizeAssistantLocale(value)).toBeUndefined();
  });
  it("localizes booking, payment, handoff and accessibility labels while preserving unknown content", () => {
    for (const label of ["Đặt xe nhanh", "Xác nhận đặt xe", "Lấy đường dẫn thanh toán", "Gặp nhân viên", "Gửi tin nhắn", "Mã QR thanh toán", "Xem đơn #"]) {
      expect(assistantText(label, "en")).not.toBe(label);
      expect(assistantText(label, "vi")).toBe(label);
    }
    expect(assistantText("Ngũ Hành Sơn, Đà Nẵng", "en")).toBe("Ngũ Hành Sơn, Đà Nẵng");
    expect(assistantMoney(500000, "en")).toContain("500,000");
    expect(assistantMoney(500000, "en")).toMatch(/₫|VND/);
  });
  it("keeps original model text and its locale when decoding an English reply", () => {
    const answer = decodeAnswer({ content: "Pick up in Đà Nẵng.", replyLocale: "en", rentalPeriod: { startAt: "2026-11-15" }, cards: [{ name: "vehicles.search", data: { id: 1, appliedFilters: { startAt: "2026-11-15T09:00:00+07:00" } } }] });
    expect(answer).toMatchObject({ content: "Pick up in Đà Nẵng.", replyLocale: "en", rentalPeriod: { startAt: "2026-11-15" }, cards: [{ data: { appliedFilters: { startAt: "2026-11-15T09:00:00+07:00" } } }] });
    expect(decodeAnswer({ content: "Hi", replyLocale: "fr" })?.replyLocale).toBeUndefined();
  });
  it("localizes known car enums in both languages without rewriting custom catalog values", () => {
    for (const [input, vietnamese, english] of [["Automatic", "Số tự động", "Automatic"], ["Manual", "Số sàn", "Manual"], ["Gasoline", "Xăng", "Petrol"], ["Petrol", "Xăng", "Petrol"], ["Diesel", "Dầu", "Diesel"], ["Electric", "Điện", "Electric"], ["Số tự động", "Số tự động", "Automatic"], ["Xăng", "Xăng", "Petrol"], ["Hybrid", "Hybrid", "Hybrid"], ["Plug-in Hybrid", "Plug-in Hybrid", "Plug-in Hybrid"], ["CVT", "CVT", "CVT"], ["DCT", "DCT", "DCT"]]) {
      expect(assistantVehicleLabel(input!, "vi")).toBe(vietnamese);
      expect(assistantVehicleLabel(input!, "en")).toBe(english);
    }
    for (const value of ["Custom drivetrain", "  Chủ xe ghi chú riêng  "]) for (const locale of ["vi", "en"] as const) expect(assistantVehicleLabel(value, locale)).toBe(value);
  });
  it("never infers suggested intents from response words and offers only cars by default", () => {
    expect(getAssistantReplies("date", undefined, "en")).toEqual(getAssistantReplies("budget", undefined, "en"));
    expect(getAssistantReplies("", undefined, "en").join(" ")).not.toMatch(/xe máy|motorcycle|scooter/);
    expect(getAssistantReplies("", ["Keep these dates"], "en")).toEqual(["Keep these dates"]);
    expect(getAssistantReplies("", [], "en")).toEqual([]);
  });
  it("makes unsafe or nonnumeric navigation actions inert", () => {
    const answer = decodeAnswer({ content: "Choose a next step", actions: [{ type: "OpenVehicle", resourceId: "7" }, { type: "OpenBooking", resourceId: "javascript:alert(1)" }, { type: "OpenVehicle", resourceId: "-1" }, { type: "OpenBooking", resourceId: "9007199254740993" }, { type: "RequestHandoff", resourceId: null }, { type: "DeleteBooking", resourceId: "7" }] });
    expect(answer?.actions.map(action => action.type)).toEqual(["OpenVehicle", "RequestHandoff"]);
  });
  it("uses the latest chat date correction when selecting a previously shown car", () => {
    const items = [message({ content: "Cars", cards: [{ name: "vehicles.search", data: { id: 7, startDate: "2026-11-15T02:00:00Z", endDate: "2026-11-17T02:00:00Z" } }] }), message({ content: "Dates updated", rentalPeriod: { startAt: "2026-11-20", endAt: "2026-11-22" } })];
    expect(conversationBookingPeriod(items, { startAt: "2026-11-15", endAt: "2026-11-17" })).toEqual({ startAt: "2026-11-20", endAt: "2026-11-22" });
  });
  it("fills a partial draft from conversation state and keeps explicit clocks on the same day", () => {
    expect(resolveBookingPeriod({ startAt: null, endAt: null }, { startAt: "2026-11-20T02:00:00Z", endAt: "2026-11-22T02:00:00Z" })).toEqual({ startAt: "2026-11-20T02:00:00Z", endAt: "2026-11-22T02:00:00Z" });
    expect(resolveBookingPeriod({ startAt: "2026-11-20T02:00:00Z" }, {}, { startAt: "2026-11-20" }).startAt).toBe("2026-11-20T02:00:00Z");
    expect(resolveBookingPeriod({}, { startAt: "2026-11-20T00:00:00+07:00" }, {}, { startAt: { precision: "DateOnly" } }).startAt).toBe("2026-11-20");
  });
  it("keeps CustomerForm dates on reopen and allows later verified chat corrections", () => {
    const saved = { startAt: "2026-11-20T02:00:00Z", endAt: "2026-11-22T02:00:00Z" };
    const oldTimeline = { startAt: "2026-11-15", endAt: "2026-11-17" };
    expect(resolveBookingPeriod(saved, saved, oldTimeline, { startAt: { origin: "CustomerForm", confirmation: "Confirmed", precision: "DateTime" }, endAt: { origin: "CustomerForm", confirmation: "Confirmed", precision: "DateTime" } })).toEqual(saved);
    expect(resolveBookingPeriod(saved, { startAt: "2026-11-25T00:00:00+07:00" }, oldTimeline, { startAt: { origin: "LatestUser", precision: "DateOnly" } }).startAt).toBe("2026-11-25");
    expect(resolveBookingPeriod(saved, { startAt: "2026-11-20T00:00:00+07:00" }, oldTimeline, { startAt: { origin: "LatestUser", precision: "DateOnly" } }).startAt).toBe(saved.startAt);
  });
  it("keeps saved dates when state is unavailable and fills only missing fields from timeline", () => {
    const saved = { startAt: "2026-11-20T02:00:00Z" };
    expect(resolveBookingPeriod(saved, undefined, { startAt: "2026-11-15", endAt: "2026-11-22" })).toEqual({ ...saved, endAt: "2026-11-22" });
  });
});

describe("Vietnam rental time", () => {
  it.each(["Europe/London", "America/New_York", "Asia/Ho_Chi_Minh"])("preserves 09:00 Vietnam pickup while the device uses %s", timezone => {
    process.env.TZ = timezone;
    expect(rentalInstant({ date: "2026-11-20", time: "09:00" })).toBe("2026-11-20T02:00:00.000Z");
    expect(rentalParts("2026-11-20T02:00:00Z")).toEqual({ date: "2026-11-20", time: "09:00" });
    expect(assistantDate("2026-11-20T02:00:00Z", "en")).toContain("09:00");
  });
  it("requires an explicit clock and rejects invalid calendar dates", () => {
    expect(rentalParts("2026-11-20")).toEqual({ date: "2026-11-20", time: "" });
    expect(rentalInstant({ date: "2026-11-20", time: "" })).toBeNull();
    expect(rentalInstant({ date: "2026-02-30", time: "09:00" })).toBeNull();
    expect(rentalInstant({ date: "2026-11-20", time: "25:00" })).toBeNull();
  });
});
