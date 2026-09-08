import Constants from "expo-constants";

import { DEFAULT_API_BASE_URL } from "@/constants/appConstants";

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, "");
}

export function getConfiguredApiBaseUrl() {
  const extraBaseUrl = Constants.expoConfig?.extra?.apiBaseUrl;
  const envBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  const baseUrl = typeof extraBaseUrl === "string" && extraBaseUrl.length > 0 ? extraBaseUrl : envBaseUrl;

  return normalizeBaseUrl(baseUrl ?? DEFAULT_API_BASE_URL);
}
