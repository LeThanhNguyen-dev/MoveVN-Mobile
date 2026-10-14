export interface DeliveryCoords {
  lat: number;
  lng: number;
}

export interface DeliveryConfig {
  freeKm: number;
  perKm: number;
  maxKm: number;
}

export interface DeliveryPreview {
  distanceKm: number;
  fee: number;
  overMax: boolean;
}

/** Mặc định nền tảng khi chưa tải được cấu hình hệ thống. */
export const DEFAULT_DELIVERY_CONFIG: DeliveryConfig = { freeKm: 5, perKm: 10000, maxKm: 50 };

/** Khoảng cách Haversine (km). Khớp backend DeliveryPricing.HaversineKm. */
export function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Tạm tính phí giao xe từ vị trí xe đến điểm nhận.
 * Trả null khi thiếu tọa độ. Khớp backend DeliveryPricing.Calculate.
 */
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

/** Cấu hình riêng của xe thắng; thiếu giá trị nào thì lấy mặc định nền tảng. */
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
