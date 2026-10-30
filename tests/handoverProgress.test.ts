import { describe, expect, it } from "vitest";
import { handoverProgress } from "@/features/booking/handoverProgress";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";

const booking = (status: string, extra: Partial<BookingResponse> = {}) => ({ status, ...extra }) as BookingResponse;
const report = (extra: Partial<InspectionReportResponse> = {}) => ({ isCustomerConfirmed: false, ...extra }) as InspectionReportResponse;

describe("handover status outside the report screen", () => {
  it("shows who needs to act before and after the check-in report is submitted", () => {
    expect(handoverProgress(booking("Approved"), "CheckIn").label).toBe("Chưa đến bước nhận xe");
    expect(handoverProgress(booking("DepositPaid", { canCheckInNow: false, checkInUnavailableReason: "Xe chưa sẵn sàng" }), "CheckIn").guidance).toBe("Xe chưa sẵn sàng");
    expect(handoverProgress(booking("DepositPaid", { canCheckInNow: true }), "CheckIn").label).toBe("Chờ chủ xe lập biên bản");
    expect(handoverProgress(booking("DepositPaid"), "CheckIn", report()).label).toBe("Chờ khách xác nhận");
    expect(handoverProgress(booking("DepositPaid"), "CheckIn", report({ requiresRevision: true, revisionReason: "Thiếu ảnh" }))).toMatchObject({ label: "Chờ chủ xe lập lại", guidance: "Thiếu ảnh" });
    expect(handoverProgress(booking("InProgress"), "CheckIn").tone).toBe("done");
  });

  it("distinguishes renting, inspection, customer confirmation, payment and owner receipt", () => {
    expect(handoverProgress(booking("InProgress"), "CheckOut").label).toBe("Đang thuê xe");
    expect(handoverProgress(booking("Returning"), "CheckOut").label).toBe("Chờ chủ xe kiểm tra xe");
    expect(handoverProgress(booking("Returning"), "CheckOut", report()).label).toBe("Chờ khách xác nhận");
    expect(handoverProgress(booking("Returned"), "CheckOut", report({ isCustomerConfirmed: true })).label).toBe("Chờ chủ xe nhận lại");
    expect(handoverProgress(booking("Completed"), "CheckOut").tone).toBe("done");
    expect(handoverProgress(booking("Completed"), "CheckOut", report({ externalPendingSurchargeAmount: 50000 })).label).toBe("Còn phụ thu cần xử lý");
  });

  it.each(["Cancelled", "Rejected"])("never asks either party to continue a %s booking", status => {
    for (const type of ["CheckIn", "CheckOut"] as const) expect(handoverProgress(booking(status), type, report()).label).toBe("Đã dừng");
  });
});
