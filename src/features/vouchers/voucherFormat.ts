import { brandPalette } from "@/theme/tokens";

/** Same brand colours as search and shared primary controls. */
export const CTA_GRADIENT: readonly [string, string, string] = brandPalette.gradient;

export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

/** Dòng giảm đầy đủ: "Giảm 50.000đ" / "Giảm 20%". */
export function formatDiscountLong(discountType: string | null | undefined, discountValue: number | null | undefined): string | null {
  if (discountValue == null) return null;
  if (discountType === "Fixed") return `Giảm ${formatVnd(Number(discountValue))}`;
  return `Giảm ${discountValue}%`;
}

/** Rút gọn mức giảm cho cuống vé (mirror web formatVoucherStub): 50000 -> 50k, 500 -> 500đ. */
export function formatVoucherStub(discountType?: string | null, discountValue?: number | null): string {
  if (discountValue == null) return "—";
  if (discountType === "Percentage") return `${discountValue}%`;
  const value = Number(discountValue);
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return formatVnd(value);
}

/** Nhãn phương tiện dùng trên thẻ vé (mirror web formatVoucherVehicle). */
export function formatVehicleLabel(vehicleType?: string | null): string {
  if (vehicleType === "Motorbike") return "Xe máy";
  if (vehicleType === "Car") return "Ô tô";
  return "Tất cả phương tiện";
}

/** Nhãn phương tiện rút gọn cho chip/sheet (mirror web PromotionDetailModal formatVehicleType). */
export function formatVehicleLabelShort(vehicleType?: string | null): string {
  if (vehicleType === "Motorbike") return "Xe máy";
  if (vehicleType === "Car") return "Ô tô";
  return "Tất cả xe";
}

export function formatEndDate(endAt?: string | null): string | null {
  if (!endAt) return null;
  const d = new Date(endAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Số ngày còn lại (làm tròn lên), null khi không có HSD. */
export function getDaysLeft(endAt?: string | null): number | null {
  if (!endAt) return null;
  const diff = new Date(endAt).getTime() - Date.now();
  if (Number.isNaN(diff)) return null;
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

/** Sắp hết hạn: còn hạn và <= 3 ngày (mirror web isExpiringSoon). */
export function isExpiringSoon(endAt?: string | null): boolean {
  if (!endAt) return false;
  const diff = new Date(endAt).getTime() - Date.now();
  return diff > 0 && diff <= 3 * 86_400_000;
}

/** % đã dùng (null khi không có giới hạn lượt) — mirror web voucherUsagePercent. */
export function voucherUsagePercent(usageCount: number, maxUsageCount: number): number | null {
  if (!maxUsageCount || maxUsageCount <= 0) return null;
  return Math.min(100, Math.max(0, (usageCount / maxUsageCount) * 100));
}

/** Số lượt còn lại + cờ "gần hết" (mirror web thanh lượt dùng). */
export function getUsageStats(maxUsageCount: number, usageCount: number): {
  percent: number;
  almostGone: boolean;
  remaining: number;
} {
  const percent = maxUsageCount > 0 ? Math.min(100, (usageCount / maxUsageCount) * 100) : 0;
  return {
    percent,
    almostGone: percent >= 80,
    remaining: Math.max(0, maxUsageCount - usageCount),
  };
}
