import { describe, expect, it } from "vitest";
import priceCases from "./fixtures/booking-pricing.json";

import {
  calcDeliveryPreview,
  calcPricePreview,
  effectiveDeliveryConfig,
  getDiscountPercent,
  haversineKm,
  isPeriodOverlapping,
} from "@/features/booking/utils/bookingPricing";
import type { BusyPeriod, PricingQuoteResponse } from "@/features/vehicles/types";

describe("bookingPricing", () => {
  it("matches the shared web/mobile pricing scenarios", () => {
    for (const c of priceCases) {
      const { promoAmt, ...actual } = calcPricePreview(c.vehicle, c.days, c.quote as PricingQuoteResponse | null, c.promo, c.delivery)!;
      expect(promoAmt).toBe(c.promo);
      expect(actual, c.name).toEqual(c.expected);
    }
  });
  it("applies the same long-rental discount tiers as web", () => {
    expect(getDiscountPercent(1)).toBe(0);
    expect(getDiscountPercent(3)).toBe(5);
    expect(getDiscountPercent(5)).toBe(10);
    expect(getDiscountPercent(7)).toBe(15);
    expect(getDiscountPercent(30)).toBe(25);
  });

  it("computes delivery fee with free radius and max range", () => {
    const config = { freeKm: 5, perKm: 10000, maxKm: 50 };
    expect(haversineKm(16.05, 108.22, 16.05, 108.22)).toBeCloseTo(0, 6);
    // Da Nang -> Hoi An is ~25km: fee = (25-5)*10000.
    const preview = calcDeliveryPreview(16.0544, 108.2022, { lat: 15.8801, lng: 108.338 }, config);
    expect(preview).not.toBeNull();
    expect(preview!.overMax).toBe(false);
    expect(preview!.distanceKm).toBeGreaterThan(5);
    expect(preview!.fee).toBe(Math.round((preview!.distanceKm - 5) * 10000));
    expect(calcDeliveryPreview(16.05, 108.22, { lat: 16.06, lng: 108.23 }, config)?.fee).toBe(0);
    expect(calcDeliveryPreview(16.05, 108.22, { lat: 18.8, lng: 105.78 }, config)?.overMax).toBe(true);
    expect(calcDeliveryPreview(null, null, { lat: 16.05, lng: 108.22 }, config)).toBeNull();
  });

  it("prefers vehicle delivery settings over platform defaults", () => {
    const fallback = { freeKm: 5, perKm: 10000, maxKm: 50 };
    expect(effectiveDeliveryConfig({ deliveryFreeRadiusKm: 10 }, fallback)).toEqual({ freeKm: 10, perKm: 10000, maxKm: 50 });
    expect(effectiveDeliveryConfig(null, fallback)).toEqual(fallback);
  });

  it("detects overlapping busy periods with turnaround buffer", () => {
    const busy: BusyPeriod[] = [{ startDate: "2026-10-10T08:00:00+07:00", endDate: "2026-10-12T08:00:00+07:00", type: "booking" }];
    expect(isPeriodOverlapping("2026-10-12T08:30:00+07:00", "2026-10-13T08:00:00+07:00", busy)).toBe(true);
    expect(isPeriodOverlapping("2026-10-12T10:00:00+07:00", "2026-10-13T08:00:00+07:00", busy)).toBe(false);
    expect(isPeriodOverlapping("2026-10-08T08:00:00+07:00", "2026-10-09T08:00:00+07:00", busy)).toBe(false);
    expect(isPeriodOverlapping("", "", busy)).toBe(false);
  });

  it("builds the full price preview like web", () => {
    const vehicle = {
      pricePerDay: 500000,
      platformFeeType: "Percent",
      platformFeeValue: 10,
      platformFeeMinFee: 0,
      platformFeeMaxFee: null,
      depositPercent: 30,
    };
    const preview = calcPricePreview(vehicle, 5, null, 50000, 20000);
    expect(preview).not.toBeNull();
    // base 2.500.000 - 10% (5 ngay) = 2.250.000 - 50.000 promo + 20.000 ship = 2.220.000
    expect(preview!.base).toBe(2500000);
    expect(preview!.discPct).toBe(10);
    expect(preview!.discAmt).toBe(250000);
    expect(preview!.total).toBe(2220000);
    expect(preview!.depositPercent).toBe(30);
    expect(preview!.deposit).toBe(666000);
    expect(preview!.remaining).toBe(2220000 - 666000);
    expect(calcPricePreview(vehicle, 0, null, 0, 0)).toBeNull();
  });
});
