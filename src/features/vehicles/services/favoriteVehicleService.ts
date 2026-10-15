import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { PagedResult } from "@/features/admin/types";
import type { VehicleListItemResponse } from "@/features/vehicles/types";

export async function getFavoriteVehicleIds() {
  const response = await apiClient.get<ApiResponse<number[]>>(
    endpoints.favoriteVehicles.ids,
  );
  const ids = response.data.data;
  if (
    !Array.isArray(ids) ||
    ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
  )
    throw new Error("Invalid favorite IDs response.");
  return [...new Set(ids)];
}

export async function getFavoriteVehicles(page = 1, pageSize = 12) {
  const response = await apiClient.get<
    ApiResponse<PagedResult<VehicleListItemResponse>>
  >(endpoints.favoriteVehicles.list, { params: { page, pageSize } });
  const data = response.data.data;
  if (
    !data ||
    !Array.isArray(data.items) ||
    !Number.isInteger(data.page) ||
    data.page < 1 ||
    !Number.isInteger(data.pageSize) ||
    data.pageSize < 1 ||
    !Number.isInteger(data.totalCount) ||
    data.totalCount < 0
  )
    throw new Error("Invalid favorite list response.");
  return { ...data, totalPages: Math.ceil(data.totalCount / data.pageSize) };
}

export async function addFavoriteVehicle(vehicleId: number) {
  await apiClient.put(endpoints.favoriteVehicles.byVehicle(vehicleId));
}

export async function removeFavoriteVehicle(vehicleId: number) {
  await apiClient.delete(endpoints.favoriteVehicles.byVehicle(vehicleId));
}
