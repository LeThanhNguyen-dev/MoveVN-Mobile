import type { AxiosError } from "axios";
import { apiClient } from "@/services/apiClient";
import { endpoints } from "@/services/endpoints";
import { AppApiError, toApiError } from "@/features/auth/services/authService";
import type { ApiResponse } from "@/features/auth/types";
import type {
  PinChangeRequest,
  PinForgotResetRequest,
  PinSetupRequest,
  PinStatusResponse,
  PinVerifyViewDocumentRequest,
  ViewDocumentPlaintextResponse,
} from "@/features/pin/types";

function unwrap<T>(response: ApiResponse<T>): T {
  if (!response.status) {
    throw new Error(response.message || "Yêu cầu không thành công.");
  }
  return response.data as T;
}

/**
 * PIN-aware error parser.
 * Backend returns PIN_1104 (locked) with HTTP 429. The shared toApiError
 * replaces every 429 with a generic rate-limit message and drops the real
 * backend code, so lock state could never be detected. Parse the backend
 * code/message first; fall back to the shared parser for the rest.
 */
function toPinError(error: unknown): AppApiError {
  if (error instanceof AppApiError) {
    return error;
  }
  if (error instanceof Error && "response" in error) {
    const data = (error as AxiosError).response?.data as
      | { code?: unknown; message?: unknown; errors?: unknown }
      | undefined;
    const code = typeof data?.code === "string" ? data.code : undefined;
    const message = typeof data?.message === "string" ? data.message : undefined;
    if (code || message) {
      return new AppApiError({
        code: code ?? "UNKNOWN",
        message: message ?? "Yêu cầu không thành công.",
        errors: Array.isArray(data?.errors) ? (data.errors as string[]) : [],
      });
    }
  }
  return toApiError(error as AxiosError);
}

export async function getPinStatus(): Promise<PinStatusResponse> {
  try {
    const { data } = await apiClient.get<ApiResponse<PinStatusResponse>>(endpoints.userSecurity.pinStatus);
    return unwrap(data);
  } catch (error) {
    throw toPinError(error);
  }
}

export async function setupPin(payload: PinSetupRequest): Promise<void> {
  try {
    const { data } = await apiClient.post<ApiResponse<null>>(endpoints.userSecurity.pinSetup, payload);
    unwrap(data);
  } catch (error) {
    throw toPinError(error);
  }
}

export async function requestSetupPinOtp(): Promise<void> {
  try {
    const { data } = await apiClient.post<ApiResponse<null>>(endpoints.userSecurity.pinSetupOtp);
    unwrap(data);
  } catch (error) {
    throw toPinError(error);
  }
}

export async function changePin(payload: PinChangeRequest): Promise<void> {
  try {
    const { data } = await apiClient.post<ApiResponse<null>>(endpoints.userSecurity.pinChange, payload);
    unwrap(data);
  } catch (error) {
    throw toPinError(error);
  }
}

export async function verifyPinViewDocument(
  payload: PinVerifyViewDocumentRequest,
): Promise<ViewDocumentPlaintextResponse> {
  try {
    const { data } = await apiClient.post<ApiResponse<ViewDocumentPlaintextResponse>>(
      endpoints.userSecurity.pinVerifyView,
      payload,
    );
    return unwrap(data);
  } catch (error) {
    throw toPinError(error);
  }
}

export async function requestPinForgotOtp(payload: { email: string }): Promise<void> {
  try {
    const { data } = await apiClient.post<ApiResponse<null>>(endpoints.userSecurity.pinForgotOtp, payload);
    unwrap(data);
  } catch (error) {
    throw toPinError(error);
  }
}

export async function resetPinForgot(payload: PinForgotResetRequest): Promise<void> {
  try {
    const { data } = await apiClient.post<ApiResponse<null>>(endpoints.userSecurity.pinForgotReset, payload);
    unwrap(data);
  } catch (error) {
    throw toPinError(error);
  }
}
