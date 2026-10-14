import { apiClient } from "@/services/apiClient";
import type { ApiResponse } from "@/features/auth/types";

const BASE = "/api/v1/user";

export interface PinStatus {
  isPinSet: boolean;
  failedPinAttempts: number;
  pinLockoutEnd?: string | null;
  lockoutRemainingSeconds?: number | null;
}

export function isValidPinCode(pin: string): boolean {
  return /^\d{6}$/.test(pin.trim());
}

export async function getPinStatus(): Promise<PinStatus> {
  const res = await apiClient.get<ApiResponse<PinStatus>>(`${BASE}/pin/status`);
  return res.data.data!;
}

export async function requestSetupPinOtp(): Promise<void> {
  await apiClient.post<ApiResponse<boolean>>(`${BASE}/pin/setup/request-otp`);
}

export async function setupPin(pinCode: string, otp: string): Promise<void> {
  await apiClient.post<ApiResponse<boolean>>(`${BASE}/pin/setup`, { pinCode, otp });
}

export async function requestForgotPinOtp(email: string): Promise<void> {
  await apiClient.post<ApiResponse<boolean>>(`${BASE}/pin/forgot/request-otp`, { email });
}

export async function resetForgotPin(email: string, otpCode: string, newPinCode: string): Promise<void> {
  await apiClient.post<ApiResponse<boolean>>(`${BASE}/pin/forgot/reset`, { email, otpCode, newPinCode });
}
