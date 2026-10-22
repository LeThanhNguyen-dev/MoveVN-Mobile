import { describe, expect, it, vi } from "vitest";
import {
  formatDiscountLong,
  formatVoucherStub,
  formatVehicleLabel,
  formatVehicleLabelShort,
  getDaysLeft,
  getUsageStats,
  isExpiringSoon,
  voucherUsagePercent,
} from "@/features/vouchers/voucherFormat";

describe("voucher format utils", () => {
  it("shortens the discount for the ticket stub like the web", () => {
    expect(formatVoucherStub("Fixed", 50000)).toBe("50k");
    expect(formatVoucherStub("Fixed", 1500)).toBe("1.5k");
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
