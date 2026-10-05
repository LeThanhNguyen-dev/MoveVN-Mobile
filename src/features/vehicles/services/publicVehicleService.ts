import { bareApiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { PagedResult } from "@/features/admin/types";
import type {
  PublicVehicleAiSearchRequest,
  PublicVehicleAiSearchResponse,
  VehicleListItemResponse,
  VehicleResponse,
  VehicleAvailabilityResponse,
  VehicleImageResponse,
  PricingQuoteResponse,
} from "@/features/vehicles/types";

export async function getPublicVehicles(params: Record<string, string | number | boolean | undefined>) {
  const res = await bareApiClient.get<ApiResponse<PagedResult<VehicleListItemResponse>>>(endpoints.publicVehicles.list, { params });
  return res.data.data ?? { items: [], totalCount: 0, page: 1, pageSize: 12, totalPages: 0 };
}

export async function getPublicMapVehicles(params: Record<string, string | number | boolean | undefined>) {
  const res = await bareApiClient.get<ApiResponse<PagedResult<VehicleListItemResponse>>>(endpoints.publicVehicles.map, { params });
  return res.data.data ?? { items: [], totalCount: 0, page: 1, pageSize: 300, totalPages: 0 };
}

export async function aiFilterSearchPublicVehicles(request: PublicVehicleAiSearchRequest) {
  const res = await bareApiClient.post<ApiResponse<PublicVehicleAiSearchResponse>>(
    endpoints.publicVehicles.aiFilterSearch,
    request,
  );
  return res.data.data;
}

export async function aiFilterMapPublicVehicles(request: PublicVehicleAiSearchRequest) {
  const res = await bareApiClient.post<ApiResponse<PublicVehicleAiSearchResponse>>(
    endpoints.publicVehicles.aiFilterMap,
    request,
  );
  return res.data.data;
}

export async function getVehicleAvailability(id: number) {
  const res = await bareApiClient.get<ApiResponse<VehicleAvailabilityResponse>>(endpoints.publicVehicles.availability(id));
  return res.data.data;
}

export async function getPublicVehicleById(id: number) {
  const res = await bareApiClient.get<ApiResponse<VehicleResponse>>(endpoints.publicVehicles.byId(id));
  return res.data.data;
}

export async function getPublicVehicleImages(id: number) {
  const res = await bareApiClient.get<ApiResponse<VehicleImageResponse[]>>(endpoints.publicVehicles.images(id));
  return res.data.data ?? [];
}

export async function createPricingQuote(id: number, startDateTime: string, endDateTime: string) {
  const response = await bareApiClient.post<ApiResponse<PricingQuoteResponse>>(endpoints.publicVehicles.pricingQuote(id), { startDateTime, endDateTime });
  if (!response.data.data) throw new Error("Không lấy được báo giá thuê xe.");
  return response.data.data;
}

export async function getDeliveryConfig() {
  const response = await bareApiClient.get<ApiResponse<{ deliveryFreeRadiusKm?: number; deliveryFeePerKm?: number; deliveryMaxRadiusKm?: number }>>("/api/config/public");
  const config = response.data.data;
  return {
    freeKm: Math.max(0, config?.deliveryFreeRadiusKm ?? 5),
    perKm: Math.max(0, config?.deliveryFeePerKm ?? 10000),
    maxKm: Math.max(1, config?.deliveryMaxRadiusKm ?? 50),
  };
}
