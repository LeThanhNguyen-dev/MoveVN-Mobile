import * as DeviceStorage from "@/services/deviceStorage";

const SIGN_OTP_TTL_MS = 10 * 60 * 1000;

function signOtpStorageKey(userId: number, contractId: number) {
  return `movevn.contract-sign-otp:${userId}:${contractId}`;
}

export async function hasUnexpiredSignOtp(userId: number, contractId: number) {
  const key = signOtpStorageKey(userId, contractId);
  try {
    const sentAt = Number(await DeviceStorage.getItemAsync(key));
    if (Number.isFinite(sentAt) && sentAt > 0 && Date.now() - sentAt < SIGN_OTP_TTL_MS) return true;
    await DeviceStorage.deleteItemAsync(key);
  } catch {
    // OTP delivery must still work if device storage is unavailable.
  }
  return false;
}

export async function rememberSignOtp(userId: number, contractId: number) {
  try {
    await DeviceStorage.setItemAsync(signOtpStorageKey(userId, contractId), String(Date.now()));
  } catch {
    // The backend still limits duplicate OTP requests if local storage fails.
  }
}

export async function clearSignOtp(userId: number, contractId: number) {
  try {
    await DeviceStorage.deleteItemAsync(signOtpStorageKey(userId, contractId));
  } catch {
    // A stale timestamp expires automatically after the OTP validity window.
  }
}
