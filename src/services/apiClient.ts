import axios, { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from "axios";

import { getConfiguredApiBaseUrl } from "@/config/apiConfig";
import { clearSession, getRefreshToken, getToken, setSession, getSessionGeneration } from "@/features/auth/hooks/useAuth";
import type { ApiResponse, AuthResponse } from "@/features/auth/types";
import { endpoints } from "@/services/endpoints";

export function getApiBaseUrl() {
  return getConfiguredApiBaseUrl();
}

export const apiClient = axios.create({
  timeout: 20000,
  baseURL: getApiBaseUrl(),
  headers: {
    Accept: "application/json",
  },
});

export const bareApiClient = axios.create({
  timeout: 20000,
  baseURL: getApiBaseUrl(),
  headers: {
    Accept: "application/json",
  },
});

type RetryableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _generation?: number;
};

let refreshPromise: Promise<AuthResponse> | null = null;
let refreshGeneration = -1;
let unauthorizedHandler: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler;
}

function shouldAttemptRefresh(error: AxiosError) {
  const config = error.config as RetryableRequestConfig | undefined;
  const requestUrl = config?.url ?? "";

  return (
    error.response?.status === 401 &&
    Boolean(config) &&
    !config?._retry &&
    !requestUrl.includes(endpoints.auth.refreshToken) &&
    !requestUrl.includes(endpoints.auth.login)
  );
}

export async function refreshAuthSession() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    throw new Error("Missing refresh token.");
  }

  if (!refreshPromise || refreshGeneration !== getSessionGeneration()) {
    const expected = getSessionGeneration();
    refreshGeneration = expected;
    refreshPromise = import("@/features/auth/services/authService")
      .then(({ refreshSession }) => refreshSession(refreshToken))
      .then(async (result) => {
        if (expected !== getSessionGeneration()) throw new Error("Session changed.");
        if (!result?.token?.accessToken || !result?.token?.refreshToken || !result?.user) {
          throw new Error("Invalid refresh response.");
        }
        await setSession({ token: result.token, user: result.user });
        return result;
      })
      .finally(() => {
        if (refreshGeneration === expected) refreshPromise = null;
      });
  }

  return refreshPromise;
}

apiClient.interceptors.request.use((config) => {
  const retryable = config as RetryableRequestConfig;
  if (retryable._generation !== undefined && retryable._generation !== getSessionGeneration()) {
    throw new axios.CanceledError("Session changed.");
  }
  retryable._generation = getSessionGeneration();
  const token = getToken();
  if (!token) {
    return config;
  }

  const headers = AxiosHeaders.from(config.headers);
  headers.set("Authorization", `Bearer ${token}`);
  config.headers = headers;

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const request = error.config as RetryableRequestConfig | undefined;
    if (request?._generation !== undefined && request._generation !== getSessionGeneration()) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401 && request?._retry) {
      await clearSession();
      unauthorizedHandler?.();
      return Promise.reject(error);
    }
    if (!shouldAttemptRefresh(error)) {
      return Promise.reject(error);
    }

    const originalRequest = error.config as RetryableRequestConfig;
    originalRequest._retry = true;

    try {
      const sentToken = AxiosHeaders.from(originalRequest.headers).get("Authorization");
      const currentToken = getToken();
      const accessToken = currentToken && sentToken !== `Bearer ${currentToken}`
        ? currentToken : (await refreshAuthSession()).token.accessToken;
      const headers = AxiosHeaders.from(originalRequest.headers);
      headers.set("Authorization", `Bearer ${accessToken}`);
      originalRequest.headers = headers;
      return apiClient(originalRequest);
    } catch (refreshError) {
      if (originalRequest._generation === getSessionGeneration()) {
        await clearSession();
        unauthorizedHandler?.();
      }
      return Promise.reject(refreshError);
    }
  },
);

export async function requestJson<T>(path: string) {
  const res = await apiClient.get<T>(path);
  return res.data;
}

export function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as Partial<ApiResponse<unknown>> | undefined;
    return payload?.errors?.filter(Boolean).join(" ") || payload?.message || fallback;
  }
  return fallback;
}
