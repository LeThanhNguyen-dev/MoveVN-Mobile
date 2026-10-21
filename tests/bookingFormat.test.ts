import { describe, expect, it } from "vitest";
import { bookingStatusLabel, formatDate, formatDateTime, formatMoney, rentalProgress, totalPages } from "@/features/booking/utils/format";
import { parseBookingTarget } from "@/features/notifications/utils/target";

describe("booking format utils", () => {
  it("formats date as dd/MM/yyyy", () => {
    expect(formatDate("2026-10-04T08:00:00")).toBe("04/10/2026");
  });

  it("formats datetime with hours and minutes", () => {
    expect(formatDateTime("2026-10-04T08:05:00")).toBe("04/10/2026 08:05");
  });

  it("returns dash for missing or invalid dates", () => {
    expect(formatDate(undefined)).toBe("-");
    expect(formatDateTime(null)).toBe("-");
    expect(formatDate("not-a-date")).toBe("-");
  });

  it("formats money in VND", () => {
    expect(formatMoney(1500000)).toBe("1.500.000đ");
    expect(formatMoney(null)).toBe("-");
  });

  it("labels known statuses and falls back to raw status", () => {
    expect(bookingStatusLabel("DepositPaid")).toBe("Đã đặt cọc");
    expect(bookingStatusLabel("SomethingNew")).toBe("SomethingNew");
  });

  it("computes total pages with at least one page", () => {
    expect(totalPages(0, 10)).toBe(1);
    expect(totalPages(25, 10)).toBe(3);
    expect(totalPages(20, 10)).toBe(2);
  });
});

describe("rentalProgress", () => {
  const start = "2026-10-08T08:00:00";
  const end = "2026-10-11T08:00:00";

  it("reports current day and remaining time mid-rental", () => {
    const p = rentalProgress(start, end, new Date("2026-10-09T08:00:00").getTime());
    expect(p?.totalDays).toBe(3);
    expect(p?.currentDay).toBe(2);
    expect(p?.overdue).toBe(false);
    expect(p?.summary).toContain("2/3");
  });

  it("flags overdue returns", () => {
    const p = rentalProgress(start, end, new Date("2026-10-12T10:00:00").getTime());
    expect(p?.overdue).toBe(true);
    expect(p?.summary).toContain("Quá hạn");
  });

  it("returns null for invalid input", () => {
    expect(rentalProgress(undefined, end)).toBeNull();
    expect(rentalProgress(end, start)).toBeNull();
  });
});

describe("parseBookingTarget", () => {
  it("extracts bookingId and roleTarget", () => {
    expect(parseBookingTarget('{"bookingId":93,"roleTarget":"customer"}')).toEqual({
      bookingId: 93,
      roleTarget: "customer",
    });
  });

  it("returns null for missing or invalid payloads", () => {
    expect(parseBookingTarget(null)).toBeNull();
    expect(parseBookingTarget("")).toBeNull();
    expect(parseBookingTarget("not-json")).toBeNull();
    expect(parseBookingTarget('{"roleTarget":"owner"}')).toBeNull();
  });
});
