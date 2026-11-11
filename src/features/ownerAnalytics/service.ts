import { apiClient } from "@/services/apiClient";
import i18n from "@/i18n";
import type { ApiResponse } from "@/features/auth/types";
import type { AnalyticsFilters, OwnerAnalytics } from "./types";

export async function getOwnerAnalytics(filters: AnalyticsFilters, signal?: AbortSignal) {
  const response = await apiClient.get<ApiResponse<OwnerAnalytics>>("/api/owner/analytics", { params: filters, signal });
  if (!response.data.status || !response.data.data) throw new Error(response.data.message || i18n.t("owner:analytics.errors.loadFailed"));
  return response.data.data;
}
export async function getOwnerWorkbook(filters: AnalyticsFilters) {
  const response = await apiClient.get<ArrayBuffer>("/api/owner/analytics/export", { params: filters, responseType: "arraybuffer", timeout: 60000 });
  const bytes = new Uint8Array(response.data);
  if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) throw new Error(i18n.t("owner:analytics.errors.invalidExport"));
  return response.data;
}
