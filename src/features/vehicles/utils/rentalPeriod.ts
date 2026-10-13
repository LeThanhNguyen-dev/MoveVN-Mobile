export const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Availability is date-based on the public vehicle calendar, including both endpoints. */
export function getBusyDateKeys(periods: readonly { startDate: string; endDate: string }[]): Set<string> {
  const busy = new Set<string>();
  for (const period of periods) {
    const start = period.startDate.slice(0, 10);
    const end = period.endDate.slice(0, 10);
    const cursor = new Date(`${start}T00:00:00Z`);
    const last = new Date(`${end}T00:00:00Z`);
    if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(last.getTime())) continue;
    for (let days = 0; cursor <= last && days < 3660; days += 1) {
      busy.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return busy;
}

export function firstBusyDateInRange(startDate: string, endDate: string, busyDates: ReadonlySet<string>): string | null {
  const cursor = new Date(`${startDate.slice(0, 10)}T00:00:00Z`);
  const last = new Date(`${endDate.slice(0, 10)}T00:00:00Z`);
  if (!Number.isFinite(cursor.getTime()) || !Number.isFinite(last.getTime())) return null;
  for (let days = 0; cursor <= last && days < 3660; days += 1) {
    const key = cursor.toISOString().slice(0, 10);
    if (busyDates.has(key)) return key;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return null;
}

export const MONTHS_VI = [
  "Thg 1",
  "Thg 2",
  "Thg 3",
  "Thg 4",
  "Thg 5",
  "Thg 6",
  "Thg 7",
  "Thg 8",
  "Thg 9",
  "Thg 10",
  "Thg 11",
  "Thg 12",
];

export const DAYS_VI = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

export const DEFAULT_HOUR = "08:00";

export const HOUR_OPTIONS: string[] = Array.from(
  { length: 24 },
  (_, hour) => `${String(hour).padStart(2, "0")}:00`,
);

export function formatDateValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateValue(value: string): Date | null {
  if (!value) return null;
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function getHour(value: string): string {
  return value.slice(11, 16) || DEFAULT_HOUR;
}

export function withDateAndHour(date: Date, hour: string): string {
  return `${formatDateValue(date)}T${hour}`;
}

export function formatPeriodPart(value: string): string {
  const date = parseDateValue(value);
  if (!date) return "...";
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const weekday = DAYS_VI[date.getDay()] ?? "";
  return `${getHour(value)} ${weekday}, ${day}/${month}`;
}

export function formatPeriodSummary(startDate: string, endDate: string): string {
  if (!startDate && !endDate) return "Chọn ngày và giờ thuê xe";
  return `${formatPeriodPart(startDate)} - ${formatPeriodPart(endDate)}`;
}

export function calculateRentalDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;
  const duration = new Date(endDate).getTime() - new Date(startDate).getTime();
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.ceil(duration / MILLISECONDS_PER_DAY);
}

export function isPastHour(dateValue: string, hour: string, now = Date.now()): boolean {
  const date = parseDateValue(dateValue);
  if (!date) return false;
  const [hours, minutes] = hour.split(":").map(Number);
  date.setHours(hours ?? 0, minutes ?? 0, 0, 0);
  return date.getTime() <= now;
}

export function getFirstAvailableHour(date: Date, preferredHour: string): string | null {
  const dateValue = formatDateValue(date);
  if (!isPastHour(dateValue, preferredHour)) return preferredHour;
  return HOUR_OPTIONS.find((hour) => !isPastHour(dateValue, hour)) ?? null;
}

export function getRangeError(startDate: string, endDate: string): string {
  if (startDate && endDate && new Date(endDate) <= new Date(startDate)) {
    return "Thời gian trả xe phải sau thời gian nhận xe.";
  }
  return "";
}

export function getDefaultRentalPeriod(now = new Date()): { startDate: string; endDate: string } {
  const start = new Date(now);
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocal = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
  return { startDate: toLocal(start), endDate: toLocal(end) };
}
