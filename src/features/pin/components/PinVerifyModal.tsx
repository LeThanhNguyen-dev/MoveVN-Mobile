import { useEffect, useMemo, useRef, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import PinDigitInputs from "@/features/pin/components/PinDigitInputs";
import type { VerifyPinResult } from "@/features/pin/hooks/usePinReveal";
import {
  PIN_DIGIT_COUNT,
  PIN_LOCKED_CODE,
  formatCountdown,
  getFriendlyPinMessage,
} from "@/features/pin/services/pinErrorMessage";
import type { PinDocumentType } from "@/features/pin/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

export type PinVerifyModalProps = {
  documentType: PinDocumentType;
  visible: boolean;
  onClose: () => void;
  onVerified: (pinCode: string) => Promise<VerifyPinResult>;
  onForgotPin?: () => void;
  lockoutSeconds: number | null;
  remainingAttempts: number | null;
  /** Mô tả mục đích nhập PIN; mặc định là xem giấy tờ. */
  purposeDescription?: string;
};

export default function PinVerifyModal({
  documentType,
  visible,
  onClose,
  onVerified,
  onForgotPin,
  lockoutSeconds,
  remainingAttempts,
  purposeDescription,
}: PinVerifyModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [pin, setPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);

  const isLocked = lockoutSeconds !== null;
  const documentLabel = documentType === "CCCD" ? "Căn cước công dân" : "Giấy phép lái xe";
  const wasOpenRef = useRef(visible);
  const wasLockedRef = useRef(isLocked);

  // Reset only on closed -> open transition. Must NOT depend on
  // remainingAttempts: the hook updates it after every failed verify and
  // re-running a reset here would wipe the error message just displayed.
  useEffect(() => {
    if (visible && !wasOpenRef.current) {
      setPin("");
      setErrorMessage(null);
      setAttemptsLeft(remainingAttempts);
    }
    wasOpenRef.current = visible;
  }, [visible, remainingAttempts]);

  // Clear stale input/error whenever the view switches locked <-> verify.
  useEffect(() => {
    if (wasLockedRef.current !== isLocked) {
      setPin("");
      setErrorMessage(null);
      setAttemptsLeft(null);
    }
    wasLockedRef.current = isLocked;
  }, [isLocked]);

  function handlePinChange(next: string) {
    setPin(next);
    if (errorMessage !== null) {
      setErrorMessage(null);
      setAttemptsLeft(null);
    }
  }

  async function handleSubmit() {
    if (pin.length !== PIN_DIGIT_COUNT || isSubmitting || isLocked) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const result = await onVerified(pin);
      if (result.ok) {
        setPin("");
        return;
      }
      setPin("");
      if (result.code === PIN_LOCKED_CODE) return;
      const remaining = result.remainingAttempts ?? remainingAttempts;
      setAttemptsLeft(remaining);
      setErrorMessage(
        remaining !== null && remaining > 0
          ? `${result.message ?? "Mã PIN không chính xác."} Còn ${remaining} lần thử.`
          : (result.message ?? "Mã PIN không chính xác."),
      );
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          {isLocked ? (
            <View style={styles.center}>
              <View style={styles.lockIcon}>
                <Lock color={theme.danger} size={22} strokeWidth={2.3} />
              </View>
              <AppText display style={styles.title}>Mã PIN đã bị khóa</AppText>
              <AppText style={styles.description}>Mã PIN đã bị khóa tạm thời do nhập sai nhiều lần.</AppText>
              <AppText style={styles.countdownLabel}>Thử lại sau</AppText>
              <AppText style={styles.countdown}>{formatCountdown(lockoutSeconds ?? 0)}</AppText>
              <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                <AppText style={styles.secondaryText}>Đóng</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.stack}>
              <View style={styles.heading}>
                <ShieldCheck color={theme.brand} size={22} strokeWidth={2.3} />
                <AppText display style={styles.title}>Nhập mã PIN</AppText>
              </View>
              <AppText style={styles.description}>
                {purposeDescription ?? `Mã PIN dùng để hiển thị chi tiết giấy tờ ${documentLabel} của bạn.`}
              </AppText>

              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                hasError={errorMessage !== null}
                label="Mã PIN"
                onChange={handlePinChange}
                value={pin}
              />
              <AppText style={styles.counter}>
                {pin.length} / {PIN_DIGIT_COUNT}
              </AppText>

              {errorMessage !== null ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </AppText>
              ) : null}

              {attemptsLeft !== null && attemptsLeft > 0 && errorMessage === null ? (
                <AppText style={styles.muted}>Còn {attemptsLeft} lần thử.</AppText>
              ) : null}

              {onForgotPin !== undefined ? (
                <Pressable accessibilityRole="button" onPress={onForgotPin} style={styles.linkWrap}>
                  <AppText style={styles.link}>Quên mã PIN?</AppText>
                </Pressable>
              ) : null}

              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>Hủy</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={pin.length !== PIN_DIGIT_COUNT || isSubmitting}
                  onPress={() => { void handleSubmit(); }}
                  style={[styles.primaryButton, (pin.length !== PIN_DIGIT_COUNT || isSubmitting) && styles.disabled]}
                >
                  <AppText style={styles.primaryText}>{isSubmitting ? "Đang kiểm tra..." : "Xác nhận"}</AppText>
                </Pressable>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: theme.overlay,
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
    },
    card: {
      width: "100%",
      maxWidth: 360,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 20,
    },
    stack: { gap: 12 },
    center: { alignItems: "center", gap: 6 },
    heading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    title: { color: theme.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
    description: { color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "500" },
    counter: { color: theme.muted, fontSize: 12, textAlign: "center", fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 12, textAlign: "center", fontWeight: "600" },
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "600" },
    linkWrap: { alignItems: "center", paddingVertical: 2 },
    link: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
    primaryButton: {
      minHeight: 44,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    primaryText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
    secondaryButton: {
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 18,
    },
    secondaryText: { color: theme.text, fontSize: 14, fontWeight: "700" },
    disabled: { opacity: 0.55 },
    lockIcon: {
      width: 46,
      height: 46,
      borderRadius: 23,
      backgroundColor: theme.dangerSoft,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    countdownLabel: { color: theme.muted, fontSize: 13, fontWeight: "600", marginTop: 10 },
    countdown: { color: theme.text, fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"] },
  });
