import type { VehicleListItemResponse, VehicleResponse } from "@/features/vehicles/types";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export function formatVnd(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) && value > 0
    ? `${currencyFormatter.format(value)}đ`
    : "Liên hệ";
}

type PricedVehicle = Pick<
  VehicleListItemResponse | VehicleResponse,
  "pricePerDay"
> & {
  currentPricePerDay?: number | null;
  pricingMode?: "Fixed" | "Auto" | null;
  autoMinPrice?: number | null;
};

/** Giá min dùng cho card + detail: Auto -> autoMin, còn lại currentPrice ?? pricePerDay. */
export function getMinPrice(vehicle: PricedVehicle): number | null {
  if (vehicle.pricingMode === "Auto" && vehicle.autoMinPrice != null && vehicle.autoMinPrice > 0) {
    return vehicle.autoMinPrice;
  }
  const current = (vehicle as { currentPricePerDay?: number | null }).currentPricePerDay;
  if (current != null && current > 0) return current;
  return vehicle.pricePerDay > 0 ? vehicle.pricePerDay : null;
}

/** Chuỗi hiển thị duy nhất cho giá: "từ Xđ/ngày". */
export function formatMinPrice(vehicle: PricedVehicle): string {
  const min = getMinPrice(vehicle);
  return min != null ? `từ ${formatVnd(min)}/ngày` : "Liên hệ";
}

export type OwnerVehicleStatus = "Pending" | "Approved" | "Hidden" | "Rejected";

export const OWNER_STATUS_META: Record<string, { label: string }> = {
  Pending: { label: "Chờ duyệt" },
  Approved: { label: "Đã duyệt" },
  Hidden: { label: "Đã ẩn" },
  Rejected: { label: "Từ chối" },
};

export function getOwnerStatusLabel(status: string): string {
  return OWNER_STATUS_META[status]?.label ?? status;
}

export function canToggleStatus(status: string): boolean {
  return status === "Approved" || status === "Hidden";
}

export function canDeleteVehicle(status: string): boolean {
  return status !== "Approved";
}

export function canUploadReplacementDocument(verificationStatus: string | undefined): boolean {
  return !verificationStatus || ["NeedMoreInfo", "Rejected", "Failed"].includes(verificationStatus);
}

export function vehicleTypeLabel(value: string): string {
  return value === "Car" ? "Ô tô" : "Xe máy";
}
