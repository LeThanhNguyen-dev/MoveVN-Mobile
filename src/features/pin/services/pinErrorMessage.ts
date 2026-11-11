import i18n from "@/i18n";
import { AppApiError } from "@/features/auth/services/authService";

export const PIN_DIGIT_COUNT = 6;
export const REVEAL_DURATION_SECONDS = 30;
// Mirrors backend PinService.MaxPinAttempts. Display only; lock is enforced by backend.
export const MAX_PIN_ATTEMPTS = 5;
export const PIN_INVALID_CODE = "PIN_1103";
export const PIN_LOCKED_CODE = "PIN_1104";
// Fallback lock display when backend says locked but status refresh fails.
// Mirrors backend LockoutDuration (15 minutes).
export const PIN_LOCKOUT_FALLBACK_SECONDS = 15 * 60;

/**
 * Maps backend/system error codes to locale keys.
 * The UI must never show raw backend or English system errors.
 * Keys are resolved at call time so the message follows the active language.
 */
const FRIENDLY_MESSAGE_KEYS: Record<string, string> = {
  PIN_1101: "accountSecurity:pin.errors.PIN_1101",
  PIN_1102: "accountSecurity:pin.errors.PIN_1102",
  PIN_1103: "accountSecurity:pin.errors.PIN_1103",
  PIN_1105: "accountSecurity:pin.errors.PIN_1105",
  AUTH_1010: "accountSecurity:pin.errors.AUTH_1010",
  AUTH_1011: "accountSecurity:pin.errors.AUTH_1011",
  AUTH_1012: "accountSecurity:pin.errors.AUTH_1012",
  AUTH_1014: "accountSecurity:pin.errors.AUTH_1014",
  AUTH_1013: "accountSecurity:pin.errors.AUTH_1013",
  "422": "accountSecurity:pin.errors.invalid",
  VALIDATION_ERROR: "accountSecurity:pin.errors.invalid",
  "429": "accountSecurity:pin.errors.tooMany",
  NETWORK: "accountSecurity:pin.errors.network",
  "401": "accountSecurity:pin.errors.sessionExpired",
  UNAUTHORIZED: "accountSecurity:pin.errors.sessionExpired",
  "403": "accountSecurity:pin.errors.forbidden",
  FORBIDDEN: "accountSecurity:pin.errors.forbidden",
  "404": "accountSecurity:pin.errors.notFound",
  NOT_FOUND: "accountSecurity:pin.errors.notFound",
  "500": "accountSecurity:pin.errors.server",
  INTERNAL_SERVER_ERROR: "accountSecurity:pin.errors.server",
};

const GENERIC_MESSAGE_KEY = "accountSecurity:pin.errors.generic";

/**
 * Backend messages already safe to show (curated Vietnamese,
 * may contain dynamic info such as remaining lock minutes).
 */
const TRUSTED_BACKEND_MESSAGE_CODES = new Set(["PIN_1104", "PIN_1106"]);

export function getPinErrorCode(error: unknown): string | undefined {
  return error instanceof AppApiError ? error.code : undefined;
}

const OTP_ERROR_CODES = new Set(["AUTH_1011", "AUTH_1012", "AUTH_1014"]);

export function isOtpErrorCode(code: string | undefined): boolean {
  return code !== undefined && OTP_ERROR_CODES.has(code);
}

export function getFriendlyPinMessage(error: unknown): string {
  if (error instanceof AppApiError) {
    if (TRUSTED_BACKEND_MESSAGE_CODES.has(error.code) && error.message) {
      return error.message;
    }
    const key = FRIENDLY_MESSAGE_KEYS[error.code];
    if (key) {
      return i18n.t(key);
    }
  }
  return i18n.t(GENERIC_MESSAGE_KEY);
}

export function formatCountdown(totalSeconds: number): string {
  const normalized = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(normalized / 60);
  const seconds = normalized % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
