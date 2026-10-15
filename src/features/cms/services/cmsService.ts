import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { CmsPageResponse, CmsPageNavigationItem } from "@/features/cms/types";

export async function getCmsPageNavigation(contentType?: string, category?: string) {
  const res = await apiClient.get<ApiResponse<CmsPageNavigationItem[]>>(endpoints.publicCmsPages.navigation, {
    params: {
      ...(contentType ? { contentType } : {}),
      ...(category ? { category } : {}),
    },
  });
  return res.data.data ?? [];
}

export async function getCmsPageBySlug(slug: string) {
  const res = await apiClient.get<ApiResponse<CmsPageResponse | null>>(endpoints.publicCmsPages.bySlug(slug));
  return res.data.data;
}
