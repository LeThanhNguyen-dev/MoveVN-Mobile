import type { BusyPeriod, PricingQuoteResponse } from "@/features/vehicles/types";

// Port từ web: discountTiers trong CustomerCreateBookingPage + delivery.ts + rentalAvailability.

export type DeliveryCoords = { lat: number; lng: number };
export type DeliveryConfig = { freeKm: number; perKm: number; maxKm: number };
export type DeliveryPreview = { distanceKm: number; fee: number; overMax: boolean };

const DISCOUNT_TIERS = [
  { min: 3, max: 4, pct: 5 },
  { min: 5, max: 6, pct: 10 },
  { min: 7, max: 29, pct: 15 },
  { min: 30, max: Number.POSITIVE_INFINITY, pct: 25 },
];

export function getDiscountPercent(days: number): number {
  for (const tier of DISCOUNT_TIERS) {
    if (days >= tier.min && days <= tier.max) return tier.pct;
  }
  return 0;
}

/** Haversine distance in km. Mirrors backend DeliveryPricing.HaversineKm. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function calcDeliveryPreview(
  vehicleLat: number | null | undefined,
  vehicleLng: number | null | undefined,
  pickup: DeliveryCoords | null,
  config: DeliveryConfig,
): DeliveryPreview | null {
  if (vehicleLat == null || vehicleLng == null || !pickup) return null;
  const distanceKm = Math.round(haversineKm(vehicleLat, vehicleLng, pickup.lat, pickup.lng) * 10) / 10;
  if (distanceKm > config.maxKm) return { distanceKm, fee: 0, overMax: true };
  if (distanceKm <= config.freeKm) return { distanceKm, fee: 0, overMax: false };
  return { distanceKm, fee: Math.round((distanceKm - config.freeKm) * config.perKm), overMax: false };
}

export function effectiveDeliveryConfig(
  vehicle: {
    deliveryFreeRadiusKm?: number | null;
    deliveryFeePerKm?: number | null;
    deliveryMaxRadiusKm?: number | null;
  } | null | undefined,
  fallback: DeliveryConfig,
): DeliveryConfig {
  return {
    freeKm: vehicle?.deliveryFreeRadiusKm ?? fallback.freeKm,
    perKm: vehicle?.deliveryFeePerKm ?? fallback.perKm,
    maxKm: vehicle?.deliveryMaxRadiusKm ?? fallback.maxKm,
  };
}

const TURNAROUND_MS = 60 * 60 * 1000;

/** True khi khoảng thuê giao với lịch bận (đệm 60 phút vệ sinh giữa 2 chuyến như web). */
export function isPeriodOverlapping(startDate: string, endDate: string, busyPeriods: BusyPeriod[]): boolean {
  const from = new Date(startDate).getTime();
  const until = new Date(endDate).getTime();
  if (!startDate || !endDate || !Number.isFinite(from) || !Number.isFinite(until) || until <= from) return false;
  return busyPeriods.some((period) => {
    const busyStart = new Date(period.startDate).getTime();
    const busyEnd = new Date(period.endDate).getTime() + TURNAROUND_MS;
    if (!Number.isFinite(busyStart) || !Number.isFinite(busyEnd)) return false;
    return from < busyEnd && until > busyStart;
  });
}

export type PricePreview = {
  base: number;
  discPct: number;
  discAmt: number;
  promoAmt: number;
  deliveryFee: number;
  total: number;
  fee: number;
  deposit: number;
  depositPercent: number;
  remaining: number;
};

export type PriceVehicle = {
  pricePerDay: number;
  platformFeeType?: string | null;
  platformFeeValue?: number | null;
  platformFeeMinFee?: number | null;
  platformFeeMaxFee?: number | null;
  depositPercent?: number | null;
};

export function calcPricePreview(
  vehicle: PriceVehicle,
  totalDays: number,
  quote: PricingQuoteResponse | null,
  promoDiscount: number,
  deliveryFee: number,
): PricePreview | null {
  if (totalDays <= 0) return null;
  const base = quote?.totalDynamicPrice ?? vehicle.pricePerDay * totalDays;
  const discPct = getDiscountPercent(totalDays);
  const discAmt = Math.round((base * discPct) / 100);
  const afterDisc = base - discAmt;
  const total = Math.max(afterDisc - promoDiscount, 0) + deliveryFee;
  // Phí nền tảng tính trên giá thuê sau giảm giá dài hạn, TRƯỚC voucher và
  // phí giao xe — khớp BookingService.CalculatePlatformFee + bản web.
  const feeBase = afterDisc;
  const feeValue = vehicle.platformFeeValue ?? 10;
  const fee =
    vehicle.platformFeeType === "Fixed"
      ? Math.min(Math.max(feeValue, vehicle.platformFeeMinFee ?? 0), vehicle.platformFeeMaxFee ?? Number.POSITIVE_INFINITY)
      : Math.round(Math.min(Math.max((feeBase * feeValue) / 100, vehicle.platformFeeMinFee ?? 0), vehicle.platformFeeMaxFee ?? feeBase));
  const depositPercent = Math.max(20, vehicle.depositPercent || 0);
  const deposit = Math.round((total * depositPercent) / 100);
  return { base, discPct, discAmt, promoAmt: promoDiscount, deliveryFee, total, fee, deposit, depositPercent, remaining: Math.max(total - deposit, 0) };
}
