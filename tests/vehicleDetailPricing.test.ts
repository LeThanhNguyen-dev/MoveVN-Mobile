import { describe, expect, it } from "vitest";
import {
  buildRentalPricing,
  formatDateMeta,
  formatDateShort,
  formatShortRange,
} from "@/features/vehicles/components/detail/rentalPricing";
import type { PricingQuoteResponse } from "@/features/vehicles/types";

function quote(totalDynamicPrice: number, rentalDays = 0): PricingQuoteResponse {
  return {
    quoteId: "test-quote",
    vehicleId: 1,
    startDateTime: "2026-11-12T09:00",
    endDateTime: "2026-11-19T09:00",
    dailyPrices: [],
    totalDynamicPrice,
    rentalDays,
    averageDailyPrice: rentalDays > 0 ? Math.round(totalDynamicPrice / rentalDays) : 0,
    expiresAt: "2026-11-12T09:10",
  };
}

describe("vehicle detail rental pricing", () => {
  it("returns null without a quote or a positive day count", () => {
    expect(buildRentalPricing(null, 3)).toBeNull();
    expect(buildRentalPricing(quote(900_000, 3), 0)).toBeNull();
  });

  it("applies the long-rental discount tiers used by booking", () => {
    expect(buildRentalPricing(quote(900_000, 3), 3)).toEqual({
      days: 3,
      base: 900_000,
      discountPercent: 5,
      discountAmount: 45_000,
      payable: 855_000,
      averagePerDay: 285_000,
    });
    expect(buildRentalPricing(quote(1_000_000, 7), 7)).toEqual({
      days: 7,
      base: 1_000_000,
      discountPercent: 15,
      discountAmount: 150_000,
      payable: 850_000,
      averagePerDay: 121_429,
    });
  });

  it("keeps short rentals at full price and never goes negative", () => {
    expect(buildRentalPricing(quote(500_000, 1), 1)?.payable).toBe(500_000);
    expect(buildRentalPricing(quote(-100, 2), 2)).toEqual({
      days: 2,
      base: 0,
      discountPercent: 0,
      discountAmount: 0,
      payable: 0,
      averagePerDay: 0,
    });
  });
});

describe("vehicle detail date formatting", () => {
  it("formats compact dates and meta for the rental card", () => {
    expect(formatDateShort("2026-11-12T09:00")).toBe("12/11");
    expect(formatDateShort("2026-11-12T09:00", true)).toBe("12/11/2026");
    expect(formatDateShort("")).toBe("Chọn ngày");
    expect(formatDateMeta("2026-11-12T09:00")).toBe("T5 · 09:00");
    expect(formatDateMeta("")).toBe("Chạm để chọn");
  });

  it("formats ranges inside a month, across months and across years", () => {
    expect(formatShortRange("2026-11-12T09:00", "2026-11-15T09:00")).toBe("12 – 15/11");
    expect(formatShortRange("2026-11-30T09:00", "2026-12-02T09:00")).toBe("30/11 – 02/12");
    expect(formatShortRange("2026-12-30T09:00", "2027-01-02T09:00")).toBe(
      "30/12/2026 – 02/01/2027",
    );
    expect(formatShortRange("2026-11-12T09:00", "2026-11-12T09:00")).toBe("12/11");
  });
});
