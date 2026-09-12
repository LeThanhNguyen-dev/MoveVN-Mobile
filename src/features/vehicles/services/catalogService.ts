import { bareApiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { CatalogArea, CatalogBrand, CatalogModel } from "@/features/vehicles/types";

export async function getCatalogAreas(): Promise<CatalogArea[]> {
  const res = await bareApiClient.get<ApiResponse<CatalogArea[]>>(endpoints.catalog.areas);
  return res.data.data ?? [];
}

export async function getCatalogBrands(vehicleType?: string): Promise<CatalogBrand[]> {
  const res = await bareApiClient.get<ApiResponse<CatalogBrand[]>>(endpoints.catalog.brands, {
    params: vehicleType ? { vehicleType } : undefined,
  });
  return res.data.data ?? [];
}

export async function getCatalogModels(brandId?: number): Promise<CatalogModel[]> {
  const res = await bareApiClient.get<ApiResponse<CatalogModel[]>>(endpoints.catalog.models, {
    params: brandId ? { brandId } : undefined,
  });
  return res.data.data ?? [];
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
