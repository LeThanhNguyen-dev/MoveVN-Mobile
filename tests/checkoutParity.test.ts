import { describe, expect, it, vi } from "vitest";
import { checkoutStartDate, canOwnerCancel, canReportNoShow, inspectionAvailability, isDepositExpired } from "@/features/booking/bookingDisplay";
import { returnTimeISO, validateCheckoutKm, vietnamInput } from "@/features/booking/checkoutRules";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";
const mocks = vi.hoisted(() => ({ post: vi.fn(), patch: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: mocks }));
import { amendCheckout, confirmCheckOut } from "@/features/booking/bookingService";
import { createOwnerCheckOutReport } from "@/features/booking/bookingOwnerService";

const start = "2026-10-16T03:00:00Z", now = Date.parse("2026-10-16T05:00:00Z");
const booking = { id: 42, status: "DepositPaid", startDate: start, paymentDueAt: "2026-10-16T02:00:00Z" } as BookingResponse;
const report = { id: 2, type: "CheckOut", version: 2, isCustomerConfirmed: false } as InspectionReportResponse;

describe("checkout compatibility", () => {
  it("converts explicit Vietnam input and rejects invalid, future and pre-rental dates", () => {
    expect(returnTimeISO("2026-10-16 11:30", start, now)).toBe("2026-10-16T04:30:00.000Z");
    expect(vietnamInput("2026-10-16T18:00:00Z")).toBe("2026-10-17 01:00");
    for (const value of ["2026-10-16 09:59", "2026-10-16 12:01", "2026-02-30 11:00", "16/10/2026 11:00", ""]) expect(() => returnTimeISO(value, start, now)).toThrow();
  });
  it("requires integer odometer no lower than check-in", () => {
    expect(validateCheckoutKm("1200", 1200)).toBe(1200);
    for (const value of ["", "1199", "-1", "1200.5", "2147483648"]) expect(() => validateCheckoutKm(value, 1200)).toThrow();
  });
  it("uses the displayed version and keeps stale conflicts visible without retry", async () => {
    mocks.post.mockResolvedValueOnce({ data: { data: booking } });
    await confirmCheckOut(42, 2);
    expect(mocks.post).toHaveBeenLastCalledWith("/api/bookings/42/check-out/confirm", { expectedVersion: 2 });
    mocks.post.mockRejectedValueOnce(new Error("Biên bản đã thay đổi"));
    await expect(confirmCheckOut(42, 1)).rejects.toThrow("Biên bản đã thay đổi");
    const request = { expectedVersion: 2, reason: "Đối chiếu lại", actualReturnAt: start, damageNoted: false };
    mocks.patch.mockResolvedValueOnce({ data: { data: { ...report, version: 3 } } });
    expect((await amendCheckout(42, request)).version).toBe(3);
    expect(mocks.patch).toHaveBeenLastCalledWith("/api/bookings/42/check-out", request);
  });
  it("sends actual handover time and capture timestamps through the owner upload path", async () => {
    mocks.post.mockResolvedValueOnce({ data: { data: report } });
    await createOwnerCheckOutReport(42, { actualReturnAt: start, odometerKm: 1200, damageNoted: false, images: [new Blob(["jpeg"], { type: "image/jpeg" })], capturedAts: [start] });
    const [, data, config] = mocks.post.mock.calls.at(-1)!;
    expect(data.get("actualReturnAt")).toBe(start);
    expect(data.getAll("capturedAts")).toEqual([start]);
    expect(config.timeout).toBe(120000);
  });
});

describe("booking action boundaries", () => {
  it("requires explicit backend availability for early pickup and an unconfirmed report", () => {
    const checkIn = { ...report, type: "CheckIn" };
    const early = Date.parse(start) - 2 * 3600000;
    expect(inspectionAvailability({ ...booking, canCheckInNow: true }, "Customer", "CheckIn", [checkIn], early).canConfirm).toBe(true);
    expect(inspectionAvailability(booking, "Owner", "CheckIn", [], now).canCreate).toBe(false);
    expect(inspectionAvailability({ ...booking, canCheckInNow: false }, "Owner", "CheckIn", [], early).canCreate).toBe(false);
    expect(inspectionAvailability({ ...booking, canCheckInNow: true }, "Customer", "CheckIn", [], early).canConfirm).toBe(false);
    expect(inspectionAvailability({ ...booking, canCheckInNow: true }, "Customer", "CheckIn", [{ ...checkIn, isCustomerConfirmed: true }], early).canConfirm).toBe(false);
  });
  it("allows immediate checkout after confirmed early handover at minute precision", () => {
    const pickup = "2026-10-16T02:30:45Z";
    const early = { ...booking, status: "InProgress", statusHistory: [{ toStatus: "InProgress", createdAt: pickup }] };
    const instant = Date.parse(pickup);
    expect(inspectionAvailability(early, "Owner", "CheckOut", [], instant).canCreate).toBe(true);
    expect(inspectionAvailability(early, "Customer", "CheckOut", [report], instant).canConfirm).toBe(true);
    expect(returnTimeISO("2026-10-16 09:30", checkoutStartDate(early), instant)).toBe("2026-10-16T02:30:00.000Z");
    expect(() => returnTimeISO("2026-10-16 09:29", checkoutStartDate(early), instant)).toThrow();
    expect(inspectionAvailability({ ...booking, status: "InProgress" }, "Owner", "CheckOut", [], instant).canCreate).toBe(false);
    expect(inspectionAvailability({ ...early, status: "DepositPaid" }, "Owner", "CheckOut", [], instant).canCreate).toBe(false);
  });
  it("supports checkout during InProgress and Returning, then blocks Returned and Completed", () => {
    for (const status of ["InProgress", "Returning"]) expect(inspectionAvailability({ ...booking, status }, "Customer", "CheckOut", [report], now).canConfirm).toBe(true);
    for (const status of ["Returned", "Completed"]) expect(inspectionAvailability({ ...booking, status }, "Customer", "CheckOut", [report], now).canConfirm).toBe(false);
  });
  it("gates no-show, owner cancellation and deposit at the exact boundary", () => {
    const at = Date.parse(start);
    expect(canReportNoShow(booking, [], at - 1)).toBe(false);
    expect(canReportNoShow(booking, [], at)).toBe(true);
    expect(canReportNoShow(booking, [{ ...report, type: "CheckIn" }], at)).toBe(false);
    expect(canOwnerCancel(booking, at - 1)).toBe(true);
    expect(canOwnerCancel(booking, at)).toBe(false);
    expect(isDepositExpired(booking, Date.parse(booking.paymentDueAt!) - 1)).toBe(false);
    expect(isDepositExpired(booking, Date.parse(booking.paymentDueAt!))).toBe(true);
    expect(isDepositExpired({ ...booking, paymentDueAt: undefined }, at - 1)).toBe(true);
  });
});
