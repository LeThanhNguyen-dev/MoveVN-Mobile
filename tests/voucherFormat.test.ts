import { describe, expect, it, vi } from "vitest";
import {
  formatDiscountLong,
  formatVoucherCardTiming,
  formatVoucherDate,
  formatVoucherDateTime,
  formatVoucherStub,
  formatVehicleLabel,
  formatVehicleLabelShort,
  getDaysLeft,
  getUsageStats,
  isExpiringSoon,
  isUpcomingStart,
  voucherUsagePercent,
} from "@/features/vouchers/voucherFormat";

describe("voucher format utils", () => {
  it("shortens the discount for the ticket stub like the web", () => {
    expect(formatVoucherStub("Fixed", 50000)).toBe("50k");
    expect(formatVoucherStub("Fixed", 1500)).toBe("2k");
    expect(formatVoucherStub("Fixed", 1_500_000)).toBe("1,5tr");
    expect(formatVoucherStub("Fixed", 500)).toBe("500đ");
    expect(formatVoucherStub("Percentage", 30)).toBe("30%");
    expect(formatVoucherStub("Fixed", null)).toBe("—");
  });

  it("formats the long discount line", () => {
    expect(formatDiscountLong("Fixed", 50000)).toBe("Giảm 50.000đ");
    expect(formatDiscountLong("Percentage", 30)).toBe("Giảm 30%");
    expect(formatDiscountLong("Fixed", null)).toBeNull();
  });

  it("labels vehicle types", () => {
    expect(formatVehicleLabel("Car")).toBe("Ô tô");
    expect(formatVehicleLabel("Motorbike")).toBe("Xe máy");
    expect(formatVehicleLabel("All")).toBe("Tất cả phương tiện");
    expect(formatVehicleLabelShort("All")).toBe("Tất cả xe");
  });

  it("formats validity with both date and time like the web", () => {
    const local = new Date(2026, 10, 14, 16, 53);
    expect(formatVoucherDateTime(local.toISOString())).toBe("16:53 14/11/2026");
    expect(formatVoucherDateTime(null)).toBeNull();
    expect(formatVoucherDateTime("not-a-date")).toBeNull();
  });

  it("formats date-only validity for the compact card", () => {
    const local = new Date(2026, 10, 20, 19, 41);
    expect(formatVoucherDate(local.toISOString())).toBe("20/11/2026");
    expect(formatVoucherDate(null)).toBeNull();
    expect(formatVoucherDate("not-a-date")).toBeNull();
  });

  it("shows a single timing chip instead of a from-to range", () => {
    const start = new Date(2026, 10, 20, 19, 41).toISOString();
    const end = new Date(2026, 10, 25, 19, 41).toISOString();
    expect(formatVoucherCardTiming({ status: "upcoming", startAt: start, endAt: end })).toBe(
      "Hiệu lực từ: 20/11/2026",
    );
    expect(formatVoucherCardTiming({ status: "ended", startAt: start, endAt: end })).toBe(
      "Hiệu lực tới: 25/11/2026",
    );
    expect(formatVoucherCardTiming({ status: "used", startAt: start, endAt: end })).toBe(
      "Hiệu lực tới: 25/11/2026",
    );
    const activeEnd = new Date(Date.now() + (2 * 24 + 3) * 3_600_000 + 60_000).toISOString();
    expect(formatVoucherCardTiming({ status: "active", startAt: start, endAt: activeEnd })).toBe(
      "Hết hạn trong: 2 ngày 3 giờ",
    );
    expect(formatVoucherCardTiming({ status: "active", startAt: start, endAt: null })).toBe(
      "Không giới hạn thời gian",
    );
  });
});

describe("voucher expiry helpers", () => {
  it("counts the remaining days", () => {
    const endAt = new Date(Date.now() + 2 * 86_400_000).toISOString();
    expect(getDaysLeft(endAt)).toBe(2);
    expect(getDaysLeft(undefined)).toBeNull();
  });

  it("flags vouchers expiring within three days", () => {
    const soon = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const later = new Date(Date.now() + 10 * 86_400_000).toISOString();
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isExpiringSoon(soon)).toBe(true);
    expect(isExpiringSoon(later)).toBe(false);
    expect(isExpiringSoon(past)).toBe(false);
    expect(isExpiringSoon(undefined)).toBe(false);
  });

  it("detects vouchers that have not started yet", () => {
    expect(isUpcomingStart(new Date(Date.now() + 86_400_000).toISOString())).toBe(true);
    expect(isUpcomingStart(new Date(Date.now() - 86_400_000).toISOString())).toBe(false);
    expect(isUpcomingStart(undefined)).toBe(false);
  });
});

describe("voucher usage helpers", () => {
  it("computes the used percentage", () => {
    expect(voucherUsagePercent(50, 200)).toBe(25);
    expect(voucherUsagePercent(400, 200)).toBe(100);
    expect(voucherUsagePercent(0, 0)).toBeNull();
  });

  it("computes remaining slots and the almost-gone flag", () => {
    expect(getUsageStats(100, 90)).toEqual({ percent: 90, almostGone: true, remaining: 10 });
    expect(getUsageStats(100, 10)).toEqual({ percent: 10, almostGone: false, remaining: 90 });
  });
});
