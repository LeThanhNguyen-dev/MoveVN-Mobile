import { bareApiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import type { ApiResponse } from "@/features/auth/types";
import type { HomepageBanner } from "../types";

/**
 * Banner Homepage public: không cần auth, dùng bareApiClient.
 * Backend đã lọc IsActive + StartAt/EndAt và sort DisplayOrder —
 * frontend render đúng thứ tự API trả về, không filter/sort lại.
 */
export async function getHomepageBanners(): Promise<HomepageBanner[]> {
  const res = await bareApiClient.get<ApiResponse<HomepageBanner[]>>(endpoints.banners.homepage);
  return res.data.data ?? [];
}
