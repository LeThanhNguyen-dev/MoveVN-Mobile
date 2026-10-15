import type { VehicleListItemResponse } from "@/features/vehicles/types";
import type { PagedResult } from "@/features/admin/types";

export const favoriteVehicle = (id = 1): VehicleListItemResponse => ({
  id,
  brandName: "Honda",
  modelName: `City ${id}`,
  variantName: null,
  vehicleType: "Car",
  year: 2025,
  licensePlate: "51A-12345",
  pricePerDay: 700000,
  depositPercent: 30,
  securityRequiresDeposit: false,
  securityDepositAmount: 0,
  areaName: "TP Hồ Chí Minh - Quận 1",
  pricingMode: "Fixed",
  fixedPricePerDay: 700000,
  autoMinPrice: null,
  autoMaxPrice: null,
  currentPricePerDay: 700000,
  status: "Approved",
  featuredImage: null,
  averageRating: 4.8,
  reviewCount: 5,
  distanceKm: null,
  latitude: null,
  longitude: null,
  totalDynamicPrice: null,
  rentalDays: null,
  averageDailyPrice: null,
  nextAvailableDate: null,
  createdAt: "2026-09-01T00:00:00Z",
});
export const favoritePage = (
  items = [favoriteVehicle()],
  page = 1,
  totalCount = items.length,
): PagedResult<VehicleListItemResponse> => ({
  items,
  page,
  pageSize: 12,
  totalCount,
  totalPages: Math.ceil(totalCount / 12),
});
export function favoriteDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
