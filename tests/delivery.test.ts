import { describe, expect, it } from "vitest";
import {
  calcDeliveryPreview,
  effectiveDeliveryConfig,
  haversineKm,
  DEFAULT_DELIVERY_CONFIG,
  type DeliveryConfig,
} from "@/features/locations/utils/delivery";
import { getVolumeDiscountPercent } from "@/features/booking/utils/format";

const config: DeliveryConfig = { freeKm: 5, perKm: 10000, maxKm: 50 };

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm(21.0285, 105.8542, 21.0285, 105.8542)).toBe(0);
  });

  it("approximates one degree of latitude", () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });
});

describe("calcDeliveryPreview", () => {
  it("returns null without coordinates or pickup", () => {
    expect(calcDeliveryPreview(null, null, { lat: 0, lng: 0 }, config)).toBeNull();
    expect(calcDeliveryPreview(0, 0, null, config)).toBeNull();
  });

  it("is free within the free radius", () => {
    const preview = calcDeliveryPreview(0, 0, { lat: 0.02, lng: 0 }, config);
    expect(preview?.distanceKm).toBe(2.2);
    expect(preview?.fee).toBe(0);
    expect(preview?.overMax).toBe(false);
  });

  it("charges per km beyond the free radius", () => {
    const preview = calcDeliveryPreview(0, 0, { lat: 0.1, lng: 0 }, config);
    expect(preview?.distanceKm).toBe(11.1);
    expect(preview?.fee).toBe(61000);
    expect(preview?.overMax).toBe(false);
  });

  it("flags pickup beyond the max radius", () => {
    const preview = calcDeliveryPreview(0, 0, { lat: 1, lng: 0 }, config);
    expect(preview?.distanceKm).toBe(111.2);
    expect(preview?.overMax).toBe(true);
    expect(preview?.fee).toBe(0);
  });
});

describe("effectiveDeliveryConfig", () => {
  it("falls back to platform defaults when vehicle has no override", () => {
    expect(effectiveDeliveryConfig(null, DEFAULT_DELIVERY_CONFIG)).toEqual(DEFAULT_DELIVERY_CONFIG);
    expect(effectiveDeliveryConfig({ deliveryFreeRadiusKm: null }, DEFAULT_DELIVERY_CONFIG).freeKm).toBe(5);
  });

  it("prefers the vehicle settings", () => {
    const result = effectiveDeliveryConfig(
      { deliveryFreeRadiusKm: 2, deliveryFeePerKm: 8000, deliveryMaxRadiusKm: 30 },
      DEFAULT_DELIVERY_CONFIG,
    );
    expect(result).toEqual({ freeKm: 2, perKm: 8000, maxKm: 30 });
  });
});

describe("getVolumeDiscountPercent", () => {
  it("maps day counts to the platform tiers", () => {
    expect(getVolumeDiscountPercent(1)).toBe(0);
    expect(getVolumeDiscountPercent(3)).toBe(5);
    expect(getVolumeDiscountPercent(5)).toBe(10);
    expect(getVolumeDiscountPercent(10)).toBe(15);
    expect(getVolumeDiscountPercent(29)).toBe(15);
    expect(getVolumeDiscountPercent(30)).toBe(25);
  });
});
