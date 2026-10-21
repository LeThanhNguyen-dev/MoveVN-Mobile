import { useCallback, useEffect, useRef, useState } from "react";
import { AppApiError } from "@/features/auth/services/authService";
import type { VerifyPinResult } from "@/features/pin/hooks/usePinReveal";
import {
  MAX_PIN_ATTEMPTS,
  PIN_LOCKED_CODE,
  PIN_LOCKOUT_FALLBACK_SECONDS,
  getFriendlyPinMessage,
} from "@/features/pin/services/pinErrorMessage";
import { getPinStatus, verifyPin } from "@/features/pin/services/pinService";
import type { PinStatusResponse } from "@/features/pin/types";

export type WalletPinGateStatus = "checking" | "setup" | "verify" | "unlocked";

export type UseWalletPinGateResult = {
  status: WalletPinGateStatus;
  unlocked: boolean;
  pinStatus: PinStatusResponse | null;
  lockoutSeconds: number | null;
  remainingAttempts: number | null;
  loadError: string | null;
  check: () => Promise<void>;
  verify: (pinCode: string) => Promise<VerifyPinResult>;
  afterSetup: (pinCode: string) => Promise<VerifyPinResult>;
};

/**
 * Gate PIN cho ví (xem số dư + rút tiền).
 * Trạng thái mở khóa chỉ giữ trong RAM của WalletNavigator: thoát ví là khóa lại.
 * Verify thật qua POST pin/verify của backend (đếm sai + khóa 15 phút do BE enforce).
 */
export function useWalletPinGate(): UseWalletPinGateResult {
  const [status, setStatus] = useState<WalletPinGateStatus>("checking");
  const [pinStatus, setPinStatus] = useState<PinStatusResponse | null>(null);
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (lockTimer.current !== null) clearTimeout(lockTimer.current);
  }, []);

  const applyStatus = useCallback((s: PinStatusResponse) => {
    setPinStatus(s);
    setLockoutSeconds(s.lockoutRemainingSeconds ?? null);
    setRemainingAttempts(
      s.failedPinAttempts > 0 ? Math.max(0, MAX_PIN_ATTEMPTS - s.failedPinAttempts) : null,
    );
  }, []);

  const check = useCallback(async () => {
    setLoadError(null);
    try {
      const s = await getPinStatus();
      applyStatus(s);
      setStatus(s.isPinSet ? "verify" : "setup");
    } catch (error) {
      setLoadError(getFriendlyPinMessage(error));
    }
  }, [applyStatus]);

  useEffect(() => {
    void check();
  }, [check]);

  // Đếm ngược khóa. BE là source of truth: hết giờ thì fetch lại status,
  // refresh không bao giờ bypass được khóa.
  useEffect(() => {
    if (lockoutSeconds === null) return;
    if (lockoutSeconds <= 0) {
      setLockoutSeconds(null);
      void check().catch(() => undefined);
      return;
    }
    lockTimer.current = setTimeout(() => {
      setLockoutSeconds((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => {
      if (lockTimer.current !== null) clearTimeout(lockTimer.current);
    };
  }, [lockoutSeconds, check]);

  const verify = useCallback(
    async (pinCode: string): Promise<VerifyPinResult> => {
      try {
        await verifyPin({ pinCode });
        setRemainingAttempts(null);
        setStatus("unlocked");
        return { ok: true };
      } catch (error) {
        const code = error instanceof AppApiError ? error.code : undefined;
        const message = getFriendlyPinMessage(error);
        let remaining: number | null = null;
        try {
          const s = await getPinStatus();
          applyStatus(s);
          remaining =
            s.failedPinAttempts > 0 ? Math.max(0, MAX_PIN_ATTEMPTS - s.failedPinAttempts) : null;
        } catch {
          if (code === PIN_LOCKED_CODE) {
            setLockoutSeconds((prev) => prev ?? PIN_LOCKOUT_FALLBACK_SECONDS);
          }
        }
        return { ok: false, code, message, remainingAttempts: remaining };
      }
    },
    [applyStatus],
  );

  // PIN vừa tạo từ cùng giá trị trong RAM: verify ngay để mở khóa,
  // không bắt user nhập lại.
  const afterSetup = useCallback(
    async (pinCode: string): Promise<VerifyPinResult> => {
      const result = await verify(pinCode);
      if (!result.ok) {
        setStatus("verify");
      }
      return result;
    },
    [verify],
  );

  return {
    status,
    unlocked: status === "unlocked",
    pinStatus,
    lockoutSeconds,
    remainingAttempts,
    loadError,
    check,
    verify,
    afterSetup,
  };
}
