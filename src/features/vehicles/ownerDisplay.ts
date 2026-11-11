import i18n from "@/i18n";
import type { VehicleListItemResponse, VehicleResponse } from "@/features/vehicles/types";

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export function formatVnd(value: number | null | undefined): string {
  return value != null && Number.isFinite(value) && value > 0
    ? `${currencyFormatter.format(value)}đ`
    : i18n.t("mobile:ownerVehicle.price.contact");
}

type PricedVehicle = Pick<
  VehicleListItemResponse | VehicleResponse,
  "pricePerDay"
> & {
  currentPricePerDay?: number | null;
  pricingMode?: "Fixed" | "Auto" | null;
  fixedPricePerDay?: number | null;
  autoMinPrice?: number | null;
};

/** Giá min dùng cho card + detail: Auto -> autoMin, còn lại currentPrice ?? pricePerDay. */
export function getMinPrice(vehicle: PricedVehicle): number | null {
  if (vehicle.pricingMode === "Auto" && vehicle.autoMinPrice != null && vehicle.autoMinPrice > 0) {
    return vehicle.autoMinPrice;
  }
  if (vehicle.fixedPricePerDay != null && vehicle.fixedPricePerDay > 0) {
    return vehicle.fixedPricePerDay;
  }
  const current = (vehicle as { currentPricePerDay?: number | null }).currentPricePerDay;
  if (current != null && current > 0) return current;
  return vehicle.pricePerDay > 0 ? vehicle.pricePerDay : null;
}

/** Chuỗi hiển thị duy nhất cho giá: "từ Xđ/ngày". */
export function formatMinPrice(vehicle: PricedVehicle): string {
  const min = getMinPrice(vehicle);
  return min != null
    ? i18n.t("mobile:ownerVehicle.price.fromPerDay", { price: formatVnd(min) })
    : i18n.t("mobile:ownerVehicle.price.contact");
}

export type OwnerVehicleStatus = "Pending" | "Approved" | "Hidden" | "Rejected";

export function formatOwnerVehiclePrice(vehicle: PricedVehicle): string {
  const price = getMinPrice(vehicle);
  if (price == null) return i18n.t("mobile:ownerVehicle.price.contact");
  return vehicle.pricingMode === "Auto"
    ? i18n.t("mobile:ownerVehicle.price.fromPerDay", { price: formatVnd(price) })
    : i18n.t("mobile:ownerVehicle.price.perDay", { price: formatVnd(price) });
}

// Nhãn trạng thái đọc bản dịch mỗi lần truy cập để đổi theo ngôn ngữ đang chọn.
export const OWNER_STATUS_META: Record<string, { label: string }> = {
  Pending: { get label() { return i18n.t("mobile:ownerVehicle.status.pending"); } },
  Approved: { get label() { return i18n.t("mobile:ownerVehicle.status.approved"); } },
  Hidden: { get label() { return i18n.t("mobile:ownerVehicle.status.hidden"); } },
  Rejected: { get label() { return i18n.t("mobile:ownerVehicle.status.rejected"); } },
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
  return value === "Car" ? i18n.t("common:car") : i18n.t("common:motorbike");
}
