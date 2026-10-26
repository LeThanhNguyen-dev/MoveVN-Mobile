import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/features/auth/types";
import type { PagedResult } from "@/features/admin/types";

import { alertPeriodError, alertTimestamp, type AvailabilityAlert } from "./alertModel";
export * from "./alertModel";
const path = "/api/vehicle-availability-alerts";
const positiveId = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value > 0;
function isPeriod(value: Pick<AvailabilityAlert, "startDate" | "endDate">) {
  return typeof value.startDate === "string" && typeof value.endDate === "string"
    && Number.isFinite(alertTimestamp(value.startDate)) && alertTimestamp(value.endDate) > alertTimestamp(value.startDate);
}
function isRegistration(value: unknown): value is Pick<AvailabilityAlert, "id" | "vehicleId" | "startDate" | "endDate" | "status"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as AvailabilityAlert;
  return positiveId(item.id) && positiveId(item.vehicleId) && isPeriod(item)
    && ["Active", "Notified", "Cancelled", "Expired", "Booked"].includes(item.status);
}
function isAlert(value: unknown): value is AvailabilityAlert {
  if (!isRegistration(value)) return false;
  const item = value as AvailabilityAlert;
  return typeof item.vehicleName === "string" && typeof item.licensePlate === "string"
    && typeof item.createdAt === "string" && Number.isFinite(alertTimestamp(item.createdAt))
    && (item.closedAt == null || (typeof item.closedAt === "string" && Number.isFinite(alertTimestamp(item.closedAt))));
}
export async function listAvailabilityAlerts(page = 1, vehicleId?: number) {
  if (!positiveId(page) || (vehicleId !== undefined && !positiveId(vehicleId))) throw new Error("Trang hoặc mã xe không hợp lệ.");
  const response = await apiClient.get<ApiResponse<PagedResult<AvailabilityAlert>>>(path, { params: { page, pageSize: 20, vehicleId } });
  const data = response.data.data;
  if (!response.data.status || !data || !Array.isArray(data.items) || !data.items.every(isAlert)
    || !positiveId(data.page) || data.page !== page || !positiveId(data.pageSize) || data.pageSize > 50
    || !Number.isSafeInteger(data.totalCount) || data.totalCount < data.items.length || data.items.length > data.pageSize
    || (vehicleId !== undefined && data.items.some(item => item.vehicleId !== vehicleId))
    || new Set(data.items.map(item => item.id)).size !== data.items.length)
    throw new Error("Không tải được danh sách theo dõi hợp lệ. Vui lòng thử lại.");
  return { ...data, totalPages: Math.ceil(data.totalCount / data.pageSize) };
}
export async function registerAvailabilityAlert(vehicleId: number, startDate: string, endDate: string) {
  if (!positiveId(vehicleId)) throw new Error("Mã xe không hợp lệ.");
  const error = alertPeriodError(startDate, endDate);
  if (error) throw new Error(error);
  const response = await apiClient.post<ApiResponse<Pick<AvailabilityAlert, "id" | "vehicleId" | "startDate" | "endDate" | "status">>>(path, {
    vehicleId, startDate: new Date(alertTimestamp(startDate)).toISOString(), endDate: new Date(alertTimestamp(endDate)).toISOString(),
  });
  const item = response.data.data;
  if (!response.data.status || !isRegistration(item) || item.vehicleId !== vehicleId
    || alertTimestamp(item.startDate) !== alertTimestamp(startDate) || alertTimestamp(item.endDate) !== alertTimestamp(endDate))
    throw new Error("Máy chủ chưa xác nhận đúng đăng ký. Hãy làm mới danh sách theo dõi.");
  return item;
}
export async function cancelAvailabilityAlert(id: number) {
  if (!positiveId(id)) throw new Error("Mã đăng ký không hợp lệ.");
  const response = await apiClient.delete<ApiResponse<{ id: number }>>(`${path}/${id}`);
  if (!response.data.status || response.data.data?.id !== id) throw new Error("Máy chủ chưa xác nhận hủy đăng ký. Vui lòng thử lại.");
}
