/** Gradient chữ ký MoveVN dùng cho CTA / cuống vé (sáng + tối đều dùng). */
export const CTA_GRADIENT: readonly [string, string, string] = ["#6B19FF", "#7C3AED", "#D946EF"];

export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

/** Giá trị giảm gọn cho cuống vé: "50K" hoặc "20%" (mirror web). */
export function formatDiscountShort(discountType: string | null | undefined, discountValue: number | null | undefined): string {
  if (discountValue == null) return "";
  if (discountType === "Fixed") return `${Math.round(Number(discountValue) / 1000)}K`;
  return `${discountValue}%`;
}

/** Dòng giảm đầy đủ: "Giảm 50.000đ" / "Giảm 20%". */
export function formatDiscountLong(discountType: string | null | undefined, discountValue: number | null | undefined): string | null {
  if (discountValue == null) return null;
  if (discountType === "Fixed") return `Giảm ${formatVnd(Number(discountValue))}`;
  return `Giảm ${discountValue}%`;
}

export function formatVehicleLabel(vehicleType?: string | null): string {
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
