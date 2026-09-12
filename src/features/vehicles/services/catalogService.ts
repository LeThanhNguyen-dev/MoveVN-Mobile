import { bareApiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { CatalogArea } from "@/features/vehicles/types";

export async function getCatalogAreas(): Promise<CatalogArea[]> {
  const res = await bareApiClient.get<ApiResponse<CatalogArea[]>>(endpoints.catalog.areas);
  return res.data.data ?? [];
}

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
