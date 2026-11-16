import { describe, expect, it } from "vitest";
import { bookingFlowGuide, bookingFlowStep, FLOW_STEPS } from "@/features/booking/bookingFlowGuide";
import { bookingFlowGuide as webBookingFlowGuide } from "../../MoveVN-FrontEnd/src/features/booking/bookingFlowGuide";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";

const now = Date.parse("2026-10-22T10:00:00Z");
const base = {
  status: "Pending",
  startDate: "2026-10-19T10:00:00Z",
  endDate: "2026-10-21T10:00:00Z",
  paymentDueAt: "2026-10-22T11:00:00Z",
  statusHistory: [{ toStatus: "InProgress", createdAt: "2026-10-19T10:00:00Z" }],
  escrowStatus: "Held",
  canCheckInNow: true,
} as unknown as BookingResponse;
const checkIn = { type: "CheckIn", isCustomerConfirmed: false } as InspectionReportResponse;
const confirmedCheckIn = { type: "CheckIn", isCustomerConfirmed: true } as InspectionReportResponse;
const revisionCheckIn = { type: "CheckIn", isCustomerConfirmed: false, requiresRevision: true } as InspectionReportResponse;
const checkOut = { type: "CheckOut", isCustomerConfirmed: false } as InspectionReportResponse;
const confirmedCheckOut = { type: "CheckOut", isCustomerConfirmed: true } as InspectionReportResponse;

describe("bookingFlowStep", () => {
  it("maps statuses to stepper positions", () => {
    expect(bookingFlowStep("Pending")).toBe(0);
    expect(bookingFlowStep("Approved")).toBe(1);
    expect(bookingFlowStep("DepositPaid")).toBe(2);
    expect(bookingFlowStep("Confirmed")).toBe(2);
    expect(bookingFlowStep("InProgress")).toBe(3);
    expect(bookingFlowStep("Returning")).toBe(4);
    expect(bookingFlowStep("Returned")).toBe(5);
    expect(bookingFlowStep("Completed")).toBe(6);
    expect(bookingFlowStep(undefined)).toBe(0);
  });
});

describe("owner flow guide", () => {
  it("Pending: hướng dẫn bấm duyệt đơn", () => {
    const guide = bookingFlowGuide({ ...base }, [], "Owner", now);
    expect(guide).toMatchObject({ step: 0, key: "approve", actionable: true, terminal: false });
  });
  it("Approved: chờ khách đặt cọc", () => {
    const guide = bookingFlowGuide({ ...base, status: "Approved" }, [], "Owner", now);
    expect(guide).toMatchObject({ step: 1, key: "waitDeposit", actionable: false });
  });
  it("DepositPaid chưa biên bản: bấm lập biên bản nhận xe", () => {
    const guide = bookingFlowGuide({ ...base, status: "DepositPaid" }, [], "Owner", now);
    expect(guide).toMatchObject({ step: 2, key: "createCheckIn", actionable: true });
  });
  it("DepositPaid đã gửi biên bản: chờ khách xác nhận", () => {
    const guide = bookingFlowGuide({ ...base, status: "DepositPaid" }, [checkIn], "Owner", now);
    expect(guide).toMatchObject({ step: 2, key: "waitCheckInConfirm" });
  });
  it("DepositPaid khách yêu cầu lập lại: bấm lập lại biên bản", () => {
    const guide = bookingFlowGuide({ ...base, status: "DepositPaid" }, [revisionCheckIn], "Owner", now);
    expect(guide).toMatchObject({ key: "createCheckIn", actionable: true });
  });
  it("DepositPaid khách đã xác nhận: chờ chuyến bắt đầu", () => {
    const guide = bookingFlowGuide({ ...base, status: "DepositPaid" }, [confirmedCheckIn], "Owner", now);
    expect(guide).toMatchObject({ key: "waitStart" });
  });
  it("InProgress: bấm lập biên bản trả xe", () => {
    const guide = bookingFlowGuide({ ...base, status: "InProgress" }, [checkIn], "Owner", now);
    expect(guide).toMatchObject({ step: 3, key: "createCheckOut", actionable: true });
  });
  it("Returning khách chưa xác nhận: chờ xác nhận trả xe", () => {
    const guide = bookingFlowGuide({ ...base, status: "Returning" }, [checkIn, checkOut], "Owner", now);
    expect(guide).toMatchObject({ step: 4, key: "waitCheckOutConfirm" });
  });
  it("Returning khách đã xác nhận: chờ hệ thống chốt", () => {
    const guide = bookingFlowGuide({ ...base, status: "Returning" }, [checkIn, confirmedCheckOut], "Owner", now);
    expect(guide).toMatchObject({ key: "waitReturnFinish" });
  });
  it("Returned: bấm xác nhận đã nhận xe", () => {
    const guide = bookingFlowGuide({ ...base, status: "Returned" }, [checkIn, confirmedCheckOut], "Owner", now);
    expect(guide).toMatchObject({ step: 5, key: "confirmReceipt", actionable: true });
  });
  it("Completed trong cửa sổ giữ cọc: chờ hết 48 giờ", () => {
    const booking = { ...base, status: "Completed", completedAt: "2026-10-21T12:00:00Z" };
    const guide = bookingFlowGuide(booking, [checkIn, confirmedCheckOut], "Owner", now);
    expect(guide).toMatchObject({ step: 6, key: "settleHold", actionable: false });
    expect(guide.hours).toBeGreaterThan(0);
  });
  it("Completed hết cửa sổ giữ cọc: bấm giải ngân", () => {
    const booking = { ...base, status: "Completed", completedAt: "2026-10-18T10:00:00Z" };
    const guide = bookingFlowGuide(booking, [checkIn, confirmedCheckOut], "Owner", now);
    expect(guide).toMatchObject({ step: 6, key: "settle", actionable: true });
  });
  it("Completed không còn giữ cọc: hoàn tất", () => {
    const booking = { ...base, status: "Completed", completedAt: "2026-10-18T10:00:00Z", escrowStatus: "Released" };
    const guide = bookingFlowGuide(booking, [checkIn, confirmedCheckOut], "Owner", now);
    expect(guide).toMatchObject({ key: "done", actionable: false });
  });
  it("Cancelled/Rejected: terminal", () => {
    expect(bookingFlowGuide({ ...base, status: "Cancelled" }, [], "Owner", now)).toMatchObject({ key: "cancelled", terminal: true });
    expect(bookingFlowGuide({ ...base, status: "Rejected" }, [], "Owner", now)).toMatchObject({ key: "rejected", terminal: true });
  });
});

describe("customer flow guide", () => {
  const futureStart = { ...base, startDate: "2026-10-24T10:00:00Z", endDate: "2026-10-26T10:00:00Z", statusHistory: [] };

  it("Pending: chờ chủ xe duyệt", () => {
    const guide = bookingFlowGuide({ ...base }, [], "Customer", now);
    expect(guide).toMatchObject({ step: 0, key: "waitApproval" });
  });
  it("Approved còn hạn cọc: bấm thanh toán cọc", () => {
    const guide = bookingFlowGuide({ ...futureStart, status: "Approved" }, [], "Customer", now);
    expect(guide).toMatchObject({ key: "payDeposit", actionable: true });
  });
  it("Approved quá hạn cọc: báo hạn đã qua", () => {
    const booking = { ...futureStart, status: "Approved", paymentDueAt: "2026-10-22T09:00:00Z" };
    expect(bookingFlowGuide(booking, [], "Customer", now)).toMatchObject({ key: "waitDepositExpired" });
  });
  it("DepositPaid có biên bản: bấm đồng ý nhận xe", () => {
    const guide = bookingFlowGuide({ ...futureStart, status: "DepositPaid" }, [checkIn], "Customer", now);
    expect(guide).toMatchObject({ key: "confirmCheckIn", actionable: true });
  });
  it("DepositPaid biên bản cần lập lại: chờ chủ xe gửi bản mới", () => {
    const guide = bookingFlowGuide({ ...futureStart, status: "DepositPaid" }, [revisionCheckIn], "Customer", now);
    expect(guide).toMatchObject({ key: "waitCheckInRevision" });
  });
  it("DepositPaid chưa có biên bản: chờ chủ xe lập", () => {
    const guide = bookingFlowGuide({ ...futureStart, status: "DepositPaid" }, [], "Customer", now);
    expect(guide).toMatchObject({ key: "waitPickupReport" });
  });
  it("DepositPaid quá giờ nhận mà chưa có biên bản: báo không đến nhận xe", () => {
    const guide = bookingFlowGuide({ ...base, status: "DepositPaid" }, [], "Customer", now);
    expect(guide).toMatchObject({ key: "reportNoShow", actionable: true });
  });
  it("InProgress: tạo biên bản trả xe khi trả", () => {
    const guide = bookingFlowGuide({ ...base, status: "InProgress" }, [checkIn], "Customer", now);
    expect(guide).toMatchObject({ key: "reportReturn", actionable: true });
  });
  it("Returning có biên bản: bấm đồng ý trả xe", () => {
    const guide = bookingFlowGuide({ ...base, status: "Returning" }, [checkIn, checkOut], "Customer", now);
    expect(guide).toMatchObject({ key: "confirmCheckOut", actionable: true });
  });
  it("Returned còn phụ phí: bấm thanh toán phụ phí", () => {
    const booking = { ...base, status: "Returned", outstandingSurchargeAmount: 100000 };
    const guide = bookingFlowGuide(booking, [checkIn, confirmedCheckOut], "Customer", now);
    expect(guide).toMatchObject({ key: "paySurcharge", actionable: true });
  });
  it("Completed: hoàn tất", () => {
    const booking = { ...base, status: "Completed", escrowStatus: "Released" };
    const guide = bookingFlowGuide(booking, [checkIn, confirmedCheckOut], "Customer", now);
    expect(guide).toMatchObject({ step: FLOW_STEPS, key: "done" });
  });
});

describe("web/mobile flow guide parity", () => {
  const reportSets = [
    [],
    [checkIn],
    [checkIn, checkOut],
    [revisionCheckIn],
    [confirmedCheckIn, confirmedCheckOut],
    [checkIn, { ...checkOut, isCustomerConfirmed: true }],
  ];
  for (const status of ["Pending", "Approved", "DepositPaid", "InProgress", "Returning", "Returned", "Completed", "Cancelled", "Rejected"]) {
    for (const role of ["Owner", "Customer"] as const) {
      it(`${role}: ${status} gives identical guide on web and mobile`, () => {
        for (const reports of reportSets) {
          const current = {
            ...base,
            status,
            completedAt: "2026-10-18T10:00:00Z",
            outstandingSurchargeAmount: 100000,
            externalPendingSurchargeAmount: 100000,
          };
          expect(bookingFlowGuide(current, reports, role, now)).toEqual(
            webBookingFlowGuide(current as never, reports as never, role, now),
          );
        }
      });
    }
  }
  it("settleHold hours identical on web and mobile", () => {
    const current = { ...base, status: "Completed", completedAt: "2026-10-21T12:00:00Z" };
    expect(bookingFlowGuide(current, [checkIn, confirmedCheckOut], "Owner", now)).toEqual(
      webBookingFlowGuide(current as never, [checkIn, confirmedCheckOut] as never, "Owner", now),
    );
  });
});
