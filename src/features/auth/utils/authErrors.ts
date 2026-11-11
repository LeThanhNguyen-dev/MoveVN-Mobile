import i18n from "@/i18n";
import { toApiError } from "@/features/auth/services/authService";

const errorCodeKeys: Record<string, string> = {
  "401": "auth:errors.401",
  "403": "auth:errors.403",
  "404": "auth:errors.404",
  "422": "auth:errors.422",
  "429": "auth:errors.429",
  "500": "auth:errors.500",
  AUTH_1001: "auth:errors.AUTH_1001",
  AUTH_1002: "auth:errors.AUTH_1002",
  AUTH_1003: "auth:errors.AUTH_1003",
  AUTH_1004: "auth:errors.AUTH_1004",
  AUTH_1005: "auth:errors.AUTH_1005",
  AUTH_1006: "auth:errors.AUTH_1006",
  AUTH_1010: "auth:errors.AUTH_1010",
  AUTH_1011: "auth:errors.AUTH_1011",
  AUTH_1012: "auth:errors.AUTH_1012",
  AUTH_1014: "auth:errors.AUTH_1014",
  AUTH_1013: "auth:errors.AUTH_1013",
  AUTH_1020: "auth:errors.AUTH_1020",
  AUTH_1021: "auth:errors.AUTH_1021",
  AUTH_1030: "auth:errors.AUTH_1030",
  AUTH_1031: "auth:errors.AUTH_1031",
  AUTH_1040: "auth:errors.AUTH_1040",
  GOOGLE_UNAVAILABLE: "mobile:auth.errors.GOOGLE_UNAVAILABLE",
  DEVELOPER_ERROR: "mobile:auth.errors.DEVELOPER_ERROR",
  AUTH_1007: "auth:errors.AUTH_1007",
  NETWORK: "auth:errors.NETWORK",
};

export function getFriendlyAuthError(error: unknown) {
  const apiError = toApiError(error);
  const key = errorCodeKeys[apiError.code];
  if (key) {
    return i18n.t(key);
  }

  const requestFailedShort = i18n.t("mobile:auth.errors.requestFailedShort");
  const generic = i18n.t("mobile:auth.errors.generic");
  if (apiError.message && apiError.message !== requestFailedShort && apiError.message !== generic) {
    return apiError.message;
  }

  return i18n.t("auth:errors.UNKNOWN");
}
