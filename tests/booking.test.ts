import { describe, expect, it, vi } from "vitest";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";
import { formatVietnamDateTime, inspectionAvailability, inspectionWatermark, parseServerDate, validateInspectionFields } from "@/features/booking/bookingDisplay";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("@/services/apiClient", () => ({ apiClient: { post: mocks.post } }));
import { createInspectionForm } from "@/features/booking/inspectionForm";
import { createCheckInReport, createCheckOutReport } from "@/features/booking/bookingService";

const booking = { canCheckInNow: true, id: 42, status: "DepositPaid", startDate: "2026-10-04T02:00:00" } as BookingResponse;
const report = { id: 7, type: "CheckIn", isCustomerConfirmed: false } as InspectionReportResponse;
const beforePickup = Date.parse("2026-10-04T01:59:59Z");
const afterPickup = Date.parse("2026-10-04T02:00:00Z");

describe("Inspection workflow permissions and timing", () => {
  it("uses server vehicle availability for early check-in on both owner and customer screens", () => {
    const allowed = { ...booking, canCheckInNow: true };
    expect(inspectionAvailability(allowed, "Owner", "CheckIn", [], beforePickup).canCreate).toBe(true);
    expect(inspectionAvailability(allowed, "Customer", "CheckIn", [report], beforePickup).canConfirm).toBe(true);
    const busy = { ...booking, canCheckInNow: false };
    expect(inspectionAvailability(busy, "Owner", "CheckIn", [], afterPickup).canCreate).toBe(false);
    expect(inspectionAvailability(busy, "Customer", "CheckIn", [report], beforePickup).canConfirm).toBe(false);
  });
  it("lets only the owner create check-in after deposit and pickup time", () => {
    expect(inspectionAvailability({ ...booking, canCheckInNow: false }, "Owner", "CheckIn", [], beforePickup).canCreate).toBe(false);
    expect(inspectionAvailability(booking, "Owner", "CheckIn", [], afterPickup).canCreate).toBe(true);
    expect(inspectionAvailability(booking, "Customer", "CheckIn", [], afterPickup).canCreate).toBe(false);
    for (const status of ["Pending", "Approved", "Confirmed", "Cancelled", "Completed", "InProgress"]) {
      expect(inspectionAvailability({ ...booking, status }, "Owner", "CheckIn", [], afterPickup).canCreate).toBe(false);
    }
  });
  it("prevents duplicate reports and requires a report before customer confirmation", () => {
    expect(inspectionAvailability(booking, "Owner", "CheckIn", [report], afterPickup).canCreate).toBe(false);
    expect(inspectionAvailability(booking, "Customer", "CheckIn", [], afterPickup).canConfirm).toBe(false);
    expect(inspectionAvailability({ ...booking, canCheckInNow: false }, "Customer", "CheckIn", [report], beforePickup).canConfirm).toBe(false);
    expect(inspectionAvailability(booking, "Customer", "CheckIn", [report], afterPickup).canConfirm).toBe(true);
    expect(inspectionAvailability(booking, "Owner", "CheckIn", [report], afterPickup).canConfirm).toBe(false);
    expect(inspectionAvailability(booking, "Customer", "CheckIn", [{ ...report, isCustomerConfirmed: true }], afterPickup).canConfirm).toBe(false);
  });
  it("allows checkout only during an active rental and only for the correct report type", () => {
    expect(inspectionAvailability(booking, "Owner", "CheckOut", [], afterPickup).canCreate).toBe(false);
    const active = { ...booking, status: "InProgress" };
    expect(inspectionAvailability(active, "Owner", "CheckOut", [report], afterPickup).canCreate).toBe(true);
    expect(inspectionAvailability(active, "Customer", "CheckOut", [report], afterPickup).canConfirm).toBe(false);
    expect(inspectionAvailability(active, "Customer", "CheckOut", [{ ...report, type: "CheckOut" }], afterPickup).canConfirm).toBe(true);
  });
});

describe("Capture timestamp and inspection payload", () => {
  it("prints Vietnam time independently of device timezone, including midnight rollover", () => {
    expect(formatVietnamDateTime("2026-10-04T18:02:03Z")).toBe("05/10/2026 01:02:03");
    expect(formatVietnamDateTime("2026-10-05T01:02:03+07:00")).toBe("05/10/2026 01:02:03");
    expect(parseServerDate("2026-10-04T02:00:00").toISOString()).toBe("2026-10-04T02:00:00.000Z");
    expect(inspectionWatermark("MVN-42", "CheckOut", "2026-10-04T18:02:03Z")).toEqual([
      "MoveVN | MVN-42 | CHECK-OUT", "05/10/2026 01:02:03 (UTC+07:00)",
    ]);
  });
  it("enforces photo limits, integer odometer and damage descriptions", () => {
    expect(validateInspectionFields("0", false, "", 1)).toBeNull();
    expect(validateInspectionFields("", false, "", 12)).toBeNull();
    for (const count of [0, 13]) expect(validateInspectionFields("", false, "", count)).not.toBeNull();
    for (const km of ["-1", "1.5", "km", "2147483648"]) expect(validateInspectionFields(km, false, "", 1)).not.toBeNull();
    expect(validateInspectionFields("1200", true, "  ", 1)).not.toBeNull();
    expect(validateInspectionFields("1200", true, "Trầy cửa trái", 1)).toBeNull();
  });
  it("posts images and matching ASP.NET field names to both inspection endpoints", async () => {
    const jpeg = new Blob(["watermarked jpeg"], { type: "image/jpeg" });
    const data = createInspectionForm({ odometer: " 1200 ", fuelLevel: "75%", damageNoted: true, damageDescription: " Trầy cửa trái ",
      photos: [{ id: "1", uri: "file:///stamped.jpg", capturedAt: "2026-10-04T02:00:00Z", file: jpeg as never }] });
    expect(data.get("odometerKm")).toBe("1200");
    expect(data.get("fuelLevel")).toBe("75%");
    expect(data.get("damageNoted")).toBe("true");
    expect(data.get("damageDescription")).toBe("Trầy cửa trái");
    expect(await (data.get("images") as Blob).text()).toBe("watermarked jpeg");
    mocks.post.mockResolvedValue({ data: { data: report } });
    expect(await createCheckInReport(42, data)).toBe(report);
    expect(await createCheckOutReport(42, data)).toBe(report);
    expect(mocks.post).toHaveBeenNthCalledWith(1, "/api/bookings/42/check-in", data, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
    expect(mocks.post).toHaveBeenNthCalledWith(2, "/api/bookings/42/check-out", data, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
  });
  it("does not send a stale damage description when damage is switched off", () => {
    const data = createInspectionForm({ odometer: "", fuelLevel: "", damageNoted: false, damageDescription: "old description", photos: [
      { id: "1", uri: "file:///stamp.jpg", capturedAt: "2026-10-04T02:00:00Z", file: new Blob(["jpeg"]) as never },
    ] });
    expect(data.get("damageNoted")).toBe("false");
    expect(data.has("damageDescription")).toBe(false);
    expect(data.has("odometerKm")).toBe(false);
  });
});

it("allows owner resubmission and blocks renter confirmation while check-in needs revision", () => {
  const revision = { ...report, requiresRevision: true };
  expect(inspectionAvailability(booking, "Owner", "CheckIn", [revision], afterPickup).canCreate).toBe(true);
  expect(inspectionAvailability(booking, "Customer", "CheckIn", [revision], afterPickup).canConfirm).toBe(false);
});
