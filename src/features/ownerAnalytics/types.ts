export type AnalyticsFilters = { fromDate: string; toDate: string; granularity: "day" | "week" | "month"; vehicleId?: number; sort: "income" | "bookings" | "utilization"; page: number; pageSize: number };
export type AnalyticsMetrics = { vehicles: number; bookingsCreated: number; confirmedBookings: number; cancelledBookings: number; rejectedBookings: number; completedTrips: number; completedTripValue: number; walletIncome: number; bookingEarnings: number; sponsorIncome: number; incomeReversals: number; bookedDays: number; fleetDays: number; vehiclesWithoutBookings: number; reviewCount: number; averageRating: number | null; cancellationRate: number; utilizationRate: number };
export type VehicleAnalytics = AnalyticsMetrics & { vehicleId: number; name: string; licensePlate: string; vehicleType: string; status: string; imageUrl: string | null };
export type OwnerTrendPoint = { period: string; label: string; bookingsCreated: number; confirmedBookings: number; completedTrips: number; completedTripValue: number; walletIncome: number };
export type AnalyticsPeriod = { fromDate: string; toDate: string; granularity: string; days: number };
export type OwnerAnalytics = { period: AnalyticsPeriod; comparisonPeriod: AnalyticsPeriod; generatedAt: string; timeZone: string; summary: AnalyticsMetrics; previousSummary: AnalyticsMetrics; completedWithoutDateCount: number; vehicleOptions: { vehicleId: number; name: string; licensePlate: string }[]; trend: OwnerTrendPoint[]; topBookedVehicles: VehicleAnalytics[]; topIncomeVehicles: VehicleAnalytics[]; vehicles: { items: VehicleAnalytics[]; totalCount: number; page: number; pageSize: number; totalPages: number }; definitions: { key: string; label: string; description: string }[] };
export type AnalyticsPreset = "7" | "30" | "90" | "month" | "previousMonth";
export const presetLabels: { key: AnalyticsPreset; label: string }[] = [{ key: "7", label: "7 ngày" }, { key: "30", label: "30 ngày" }, { key: "90", label: "90 ngày" }, { key: "month", label: "Tháng này" }, { key: "previousMonth", label: "Tháng trước" }];
export const money = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value);
export const number = (value: number) => new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(value);
export const percent = (value: number) => number(value) + "%";
export const shortDate = (value: string) => value.split("-").reverse().join("/");
export const vietnamToday = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
const iso = (date: Date) => date.toISOString().slice(0, 10);
export function datePreset(preset: AnalyticsPreset, today = vietnamToday()) {
  const end = new Date(today + "T00:00:00Z"); const start = new Date(end);
  if (preset === "month") start.setUTCDate(1);
  else if (preset === "previousMonth") { end.setUTCDate(0); start.setUTCDate(1); start.setUTCMonth(start.getUTCMonth() - 1); }
  else start.setUTCDate(start.getUTCDate() - Number(preset) + 1);
  return { fromDate: iso(start), toDate: iso(end) };
}
export function defaultFilters(): AnalyticsFilters { return { ...datePreset("30"), granularity: "week", sort: "income", page: 1, pageSize: 10 }; }
export function validateDates(from: string, to: string, today = vietnamToday()) {
  const valid = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && iso(new Date(s)) === s;
  if (!valid(from) || !valid(to)) return "Nhập ngày hợp lệ theo định dạng YYYY-MM-DD.";
  if (from < "2000-01-01" || from > to) return "Ngày bắt đầu không được sau ngày kết thúc, và phải từ năm 2000.";
  if (to > today) return "Ngày kết thúc không được ở tương lai.";
  if ((Date.parse(to) - Date.parse(from)) / 86400000 + 1 > 366) return "Khoảng thống kê tối đa 366 ngày.";
  return "";
}
export function comparison(current: number, previous: number) {
  if (current === previous) return "Không đổi so với kỳ trước";
  if (previous === 0) return current > 0 ? "Mới phát sinh trong kỳ" : "Phát sinh điều chỉnh giảm";
  const change = (current - previous) / Math.abs(previous) * 100;
  return (change >= 0 ? "+" : "") + number(change) + "% so với kỳ trước";
}
