import { DAYS_VI, parseDateValue } from "@/features/vehicles/utils/rentalPeriod";
import { pad2 } from "@/features/booking/utils/format";

/**
 * Booking nhận cả chuỗi ISO (có múi giờ) lẫn "YYYY-MM-DDTHH:mm". Ưu tiên `Date`
 * để quy đổi đúng giờ/ngày theo thiết bị, chỉ fallback khi chuỗi không parse được.
 */
function toDate(value: string): Date | null {
  if (!value) return null;
  // Chuỗi chỉ có ngày ("YYYY-MM-DD"): parse theo giờ địa phương để không lệch ngày.
  const date = value.length <= 10 ? parseDateValue(value) : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return parseDateValue(value);
  return date;
}

function hasTime(value: string): boolean {
  const timePart = value.split(/[T ]/)[1];
  return Boolean(timePart && timePart.includes(":"));
}

/** 12/11, hoặc 12/11/2027 nếu khác năm hiện tại. */
export function formatCheckoutDate(value: string): string {
  const date = toDate(value);
  if (!date) return "Chưa chọn";
  const dayMonth = `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}`;
  return date.getFullYear() === new Date().getFullYear()
    ? dayMonth
    : `${dayMonth}/${date.getFullYear()}`;
}

/** T5 · 09:00 (chỉ hiện thứ nếu chuỗi không có giờ). */
export function formatCheckoutMeta(value: string): string {
  const date = toDate(value);
  if (!date) return "Chưa chọn giờ";
  const weekday = DAYS_VI[date.getDay()] ?? "";
  if (!hasTime(value)) return weekday;
  return `${weekday} · ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * ISO/chuỗi ngày giờ → "YYYY-MM-DDTHH:mm" theo giờ địa phương, đúng định dạng
 * mà RentalPeriodSheet (picker của trang chi tiết) đang dùng.
 */
export function toRentalSheetValue(value: string): string {
  if (!value) return "";
  const date = toDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/** Giá trị picker (giờ địa phương) → ISO để giữ nguyên payload gửi API. */
export function fromRentalSheetValue(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
