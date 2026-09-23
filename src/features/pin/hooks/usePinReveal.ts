import { useCallback, useEffect, useRef, useState } from "react";
import { AppApiError } from "@/features/auth/services/authService";
import {
  MAX_PIN_ATTEMPTS,
  PIN_LOCKED_CODE,
  PIN_LOCKOUT_FALLBACK_SECONDS,
  REVEAL_DURATION_SECONDS,
  getFriendlyPinMessage,
} from "@/features/pin/services/pinErrorMessage";
import { getPinStatus, verifyPinViewDocument } from "@/features/pin/services/pinService";
import type { PinDocumentType, PinStatusResponse, PinVehicleType } from "@/features/pin/types";

export type PinRevealMode = "verify" | "setup";

export type VerifyPinResult = {
  ok: boolean;
  code?: string;
  message?: string;
  remainingAttempts?: number | null;
};

export type UsePinRevealResult = {
  // Số giấy tờ thật, chỉ giữ trong RAM (React state), không persist.
  plaintext: string | null;
  isRevealed: boolean;
  secondsLeft: number;
  isModalOpen: boolean;
  isPinSet: boolean;
  mode: PinRevealMode;
  lockoutSeconds: number | null;
  remainingAttempts: number | null;
  openModal: () => Promise<void>;
  refreshStatus: () => Promise<PinStatusResponse>;
  closeModal: () => void;
  handleVerified: (pinCode: string) => Promise<VerifyPinResult>;
  handleSetupDone: (pinCode: string) => Promise<VerifyPinResult>;
  hide: () => void;
};

export function usePinReveal(documentType: PinDocumentType, vehicleType?: PinVehicleType): UsePinRevealResult {
  const [plaintext, setPlaintext] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REVEAL_DURATION_SECONDS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPinSet, setIsPinSet] = useState(true);
  const [mode, setMode] = useState<PinRevealMode>("verify");
  const [lockoutSeconds, setLockoutSeconds] = useState<number | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const revealTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hide = useCallback(() => {
    if (revealTimer.current !== null) {
      clearInterval(revealTimer.current);
      revealTimer.current = null;
    }
    setPlaintext(null);
    setSecondsLeft(REVEAL_DURATION_SECONDS);
  }, []);

  useEffect(() => () => {
    if (revealTimer.current !== null) clearInterval(revealTimer.current);
    if (lockTimer.current !== null) clearTimeout(lockTimer.current);
  }, []);

  const applyStatus = useCallback(
    (status: { isPinSet: boolean; failedPinAttempts: number; lockoutRemainingSeconds: number | null }) => {
      setIsPinSet(status.isPinSet);
      setLockoutSeconds(status.lockoutRemainingSeconds ?? null);
      setRemainingAttempts(
        status.failedPinAttempts > 0 ? Math.max(0, MAX_PIN_ATTEMPTS - status.failedPinAttempts) : null,
      );
    },
    [],
  );

  const refreshStatus = useCallback(async () => {
    const status = await getPinStatus();
    applyStatus(status);
    return status;
  }, [applyStatus]);

  useEffect(() => {
    if (plaintext === null) return;
    revealTimer.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (revealTimer.current !== null) {
            clearInterval(revealTimer.current);
            revealTimer.current = null;
          }
          setPlaintext(null);
          return REVEAL_DURATION_SECONDS;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (revealTimer.current !== null) {
        clearInterval(revealTimer.current);
        revealTimer.current = null;
      }
    };
  }, [plaintext]);

  // Lock countdown. Backend is the source of truth; when the countdown
  // reaches zero we re-fetch status so a refresh can never bypass the lock.
  useEffect(() => {
    if (lockoutSeconds === null) return;
    if (lockoutSeconds <= 0) {
      setLockoutSeconds(null);
      void refreshStatus().catch(() => undefined);
      return;
    }
    lockTimer.current = setTimeout(() => {
      setLockoutSeconds((prev) => (prev === null ? null : prev - 1));
    }, 1000);
    return () => {
      if (lockTimer.current !== null) clearTimeout(lockTimer.current);
    };
  }, [lockoutSeconds, refreshStatus]);

  const openModal = useCallback(async () => {
    hide();
    try {
      const status = await getPinStatus();
      applyStatus(status);
      setMode(status.isPinSet ? "verify" : "setup");
    } catch {
      setMode("setup");
      setLockoutSeconds(null);
      setRemainingAttempts(null);
    }
    setIsModalOpen(true);
  }, [applyStatus, hide]);

  const closeModal = useCallback(() => setIsModalOpen(false), []);

  const handleVerified = useCallback(
    async (pinCode: string): Promise<VerifyPinResult> => {
      try {
        const result = await verifyPinViewDocument({
          pinCode,
          documentType,
          ...(vehicleType ? { vehicleType } : {}),
        });
        setPlaintext(result.documentNumber);
        setSecondsLeft(REVEAL_DURATION_SECONDS);
        setIsModalOpen(false);
        setRemainingAttempts(null);
        return { ok: true };
      } catch (error) {
        const code = error instanceof AppApiError ? error.code : undefined;
        const message = getFriendlyPinMessage(error);
        let remaining: number | null = null;
        try {
          const status = await getPinStatus();
          applyStatus(status);
          remaining =
            status.failedPinAttempts > 0
              ? Math.max(0, MAX_PIN_ATTEMPTS - status.failedPinAttempts)
              : null;
        } catch {
          if (code === PIN_LOCKED_CODE) {
            setLockoutSeconds((prev) => prev ?? PIN_LOCKOUT_FALLBACK_SECONDS);
          }
        }
        return { ok: false, code, message, remainingAttempts: remaining };
      }
    },
    [applyStatus, documentType, vehicleType],
  );

  const handleSetupDone = useCallback(
    async (pinCode: string): Promise<VerifyPinResult> => {
      setIsPinSet(true);
      // The PIN was just created from this same in-memory value, so verify
      // it immediately to reveal the document without asking the user
      // to type it again.
      const result = await handleVerified(pinCode);
      if (!result.ok) {
        setMode("verify");
      }
      return result;
    },
    [handleVerified],
  );

  return {
    plaintext,
    isRevealed: plaintext !== null,
    secondsLeft,
    isModalOpen,
    isPinSet,
    mode,
    lockoutSeconds,
    remainingAttempts,
    openModal,
    refreshStatus,
    closeModal,
    handleVerified,
    handleSetupDone,
    hide,
  };
}
