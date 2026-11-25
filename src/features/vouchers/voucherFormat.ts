import i18n from "@/i18n";

/** Gradient chữ ký MoveVN dùng cho CTA / cuống vé (sáng + tối đều dùng). */
export const CTA_GRADIENT: readonly [string, string, string] = ["#6B19FF", "#7C3AED", "#D946EF"];

export function formatVnd(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

/** Locale đang dùng cho số/ngày (vi mặc định, en khi đổi ngôn ngữ). */
function numberLocale(): string {
  return i18n.language?.startsWith("en") ? "en-US" : "vi-VN";
}

/** Số tiền rút gọn cho thẻ voucher: 1500000 -> 1,5tr (vi) / 1.5M (en); 50000 -> 50k. */
export function formatVoucherAmount(value: number): string {
  const locale = numberLocale();
  const decimal = locale === "en-US" ? "." : ",";
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    const text = Number.isInteger(millions)
      ? String(millions)
      : millions.toFixed(1).replace(".", decimal);
    return locale === "en-US" ? `${text}M` : `${text}tr`;
  }
  if (value >= 1000) {
    const thousands = value / 1000;
    return `${Number.isInteger(thousands) ? thousands : Math.round(thousands)}k`;
  }
  return `${new Intl.NumberFormat(locale).format(value)}đ`;
}

/** Dòng giảm đầy đủ: "Giảm 50.000đ" / "Giảm 20%". */
export function formatDiscountLong(discountType: string | null | undefined, discountValue: number | null | undefined): string | null {
  if (discountValue == null) return null;
  const prefix = i18n.t("promo:voucherCard.discountLabel");
  if (discountType === "Fixed") return `${prefix} ${formatVnd(Number(discountValue))}`;
  return `${prefix} ${discountValue}%`;
}

/** Rút gọn mức giảm cho cuống vé (mirror web formatVoucherStub): 50000 -> 50k, 500 -> 500đ. */
export function formatVoucherStub(discountType?: string | null, discountValue?: number | null): string {
  if (discountValue == null) return "—";
  if (discountType === "Percentage") return `${discountValue}%`;
  return formatVoucherAmount(Number(discountValue));
}

/** Nhãn phương tiện dùng trên thẻ vé (mirror web formatVoucherVehicle). */
export function formatVehicleLabel(vehicleType?: string | null): string {
  if (vehicleType === "Motorbike") return i18n.t("common:motorbike");
  if (vehicleType === "Car") return i18n.t("common:car");
  return i18n.t("promo:voucherCard.vehicleAll");
}

/** Nhãn phương tiện rút gọn cho chip/sheet (mirror web PromotionDetailModal formatVehicleType). */
export function formatVehicleLabelShort(vehicleType?: string | null): string {
  if (vehicleType === "Motorbike") return i18n.t("common:motorbike");
  if (vehicleType === "Car") return i18n.t("common:car");
  return i18n.t("mobile:explore.banner.vehicleAll");
}

export function formatEndDate(endAt?: string | null): string | null {
  if (!endAt) return null;
  const d = new Date(endAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Ngày + giờ (vi: 16:53 14/11/2026) dùng hiển thị thời hạn chi tiết như web. */
export function formatVoucherDateTime(endAt?: string | null): string | null {
  if (!endAt) return null;
  const d = new Date(endAt);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(numberLocale(), { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Ngày không kèm giờ (vi: 20/11/2026) — mirror web formatVoucherDate. */
export function formatVoucherDate(value?: string | null): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(numberLocale(), { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Thời lượng còn lại dạng "2 ngày 3 giờ" — mirror web formatVoucherDuration. */
export function formatVoucherDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  const hours = Math.floor((totalSeconds % 86_400) / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const unit = (key: "day" | "hour" | "minute" | "second", count: number) =>
    i18n.t(`promo:voucherCard.unit.${key}`, { count });
  const parts: string[] = [];
  if (days > 0) {
    parts.push(unit("day", days));
    if (hours > 0) parts.push(unit("hour", hours));
  } else if (hours > 0) {
    parts.push(unit("hour", hours));
    if (minutes > 0) parts.push(unit("minute", minutes));
  } else if (minutes > 0) {
    parts.push(unit("minute", minutes));
    if (seconds > 0) parts.push(unit("second", seconds));
  } else {
    parts.push(unit("second", seconds));
  }
  return parts.join(" ");
}

export type VoucherCardPhase = "active" | "upcoming" | "ended" | "used" | "blocked";

/**
 * Nhãn thời gian gọn trên thẻ — mirror web useVoucherTiming:
 * sắp diễn ra → "Hiệu lực từ: <ngày>", đang diễn ra → "Hết hạn trong: <thời lượng>",
 * đã kết thúc/đã dùng → "Hiệu lực tới: <ngày>". Không in dải "từ ... đến ...".
 */
export function formatVoucherCardTiming(input: {
  status: VoucherCardPhase;
  startAt?: string | null;
  endAt?: string | null;
}): string {
  const { status, startAt, endAt } = input;
  if (status === "upcoming") {
    const date = formatVoucherDate(startAt);
    return date
      ? i18n.t("promo:voucherCard.effectiveFrom", { date })
      : i18n.t("promo:voucherCard.status.upcoming");
  }
  if (status === "active") {
    const end = endAt ? new Date(endAt).getTime() : Number.NaN;
    if (Number.isNaN(end)) return i18n.t("promo:voucherCard.noExpiry");
    return i18n.t("promo:voucherCard.expiresIn", { duration: formatVoucherDuration(end - Date.now()) });
  }
  const date = formatVoucherDate(endAt);
  return date
    ? i18n.t("promo:voucherCard.validUntil", { date })
    : i18n.t("promo:voucherCard.noExpiry");
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

/** Voucher chưa tới ngày bắt đầu (mirror web isUpcomingVoucher). */
export function isUpcomingStart(startAt?: string | null): boolean {
  if (!startAt) return false;
  const start = new Date(startAt).getTime();
  return !Number.isNaN(start) && start > Date.now();
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
