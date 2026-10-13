import { describe, expect, it } from "vitest";
import { bookingStatusLabel, formatDate, formatDateTime, formatMoney, totalPages } from "@/features/booking/utils/format";

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
