import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import PinDigitInputs from "@/features/pin/components/PinDigitInputs";
import { getAuthUser } from "@/features/auth/hooks/useAuth";
import { PIN_DIGIT_COUNT, getFriendlyPinMessage, getPinErrorCode, isOtpErrorCode } from "@/features/pin/services/pinErrorMessage";
import { requestPinForgotOtp, resetPinForgot } from "@/features/pin/services/pinService";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PinChangeModalProps = {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
};

type Step = "request-otp" | "enter-otp" | "new-pin" | "confirm-pin";

const RESEND_COUNTDOWN_SECONDS = 60;

/**
 * Đổi mã PIN xác thực bằng OTP gửi qua email, chia 3 màn riêng:
 * gửi OTP -> nhập OTP -> nhập PIN mới + xác nhận.
 * Backend không có API check OTP riêng nên OTP đúng/sai chỉ biết ở bước
 * cuối; sai thì tự quay về màn OTP kèm lỗi.
 */
export default function PinChangeModal({ visible, onClose, onSuccess }: PinChangeModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [step, setStep] = useState<Step>("request-otp");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [otpHasError, setOtpHasError] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const email = getAuthUser()?.email ?? "";

  useEffect(() => {
    if (!visible) return;
    setStep("request-otp");
    setOtp("");
    setNewPin("");
    setConfirmPin("");
    setErrorMessage(null);
    setOtpHasError(false);
    setInfoMessage(null);
    setSuccessMessage(null);
    setResendSeconds(0);
  }, [visible]);

  useEffect(() => {
    if (step === "request-otp" || resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [step, resendSeconds]);

  function handleNewPinContinue() {
    if (newPin.length !== PIN_DIGIT_COUNT) {
      setErrorMessage(t("mobile:pin.change.errorFillNewPin"));
      return;
    }
    setErrorMessage(null);
    setStep("confirm-pin");
  }

  useEffect(() => () => {
    if (doneTimer.current !== null) clearTimeout(doneTimer.current);
  }, []);

  const isOtpFilled = otp.length === PIN_DIGIT_COUNT;
  const isPinFilled = newPin.length === PIN_DIGIT_COUNT && confirmPin.length === PIN_DIGIT_COUNT;
  const hasMismatch =
    newPin.length === PIN_DIGIT_COUNT && confirmPin.length > 0 && newPin !== confirmPin;
  const canSubmit = isOtpFilled && isPinFilled && newPin === confirmPin;

  async function handleRequestOtp() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await requestPinForgotOtp({ email });
      setStep("enter-otp");
      setResendSeconds(RESEND_COUNTDOWN_SECONDS);
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (isResending || resendSeconds > 0) return;
    setIsResending(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await requestPinForgotOtp({ email });
      setResendSeconds(RESEND_COUNTDOWN_SECONDS);
      setInfoMessage(t("accountSecurity:pin.forgot.resendInfo"));
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  function handleOtpContinue() {
    if (!isOtpFilled) {
      setErrorMessage(t("accountSecurity:pin.forgot.errorOtp"));
      return;
    }
    setErrorMessage(null);
    setStep("new-pin");
  }

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) {
      if (!isPinFilled) {
        setErrorMessage(t("accountSecurity:pin.forgot.errorFill"));
      } else if (newPin !== confirmPin) {
        setErrorMessage(t("accountSecurity:pin.change.errorMismatch"));
      }
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setOtpHasError(false);
    try {
      await resetPinForgot({ email, otpCode: otp, newPinCode: newPin });
      setSuccessMessage(t("accountSecurity:pin.change.successTitle"));
      doneTimer.current = setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1200);
    } catch (error) {
      if (isOtpErrorCode(getPinErrorCode(error))) {
        // OTP sai/hết hạn: quay về màn OTP để nhập lại.
        setOtp("");
        setOtpHasError(true);
        setErrorMessage(getFriendlyPinMessage(error));
        setStep("enter-otp");
      } else {
        setErrorMessage(getFriendlyPinMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.heading}>
            <ShieldCheck color={theme.brand} size={22} strokeWidth={2.3} />
            <AppText display style={styles.title}>{t("accountSecurity:pin.change.title")}</AppText>
          </View>

          {step === "request-otp" ? (
            <View style={styles.stack}>
              <AppText style={styles.description}>
                {t("mobile:pin.change.otpIntro")}
              </AppText>
              <View style={styles.emailBox}>
                <AppText style={styles.emailText}>{email}</AppText>
              </View>
              {errorMessage !== null ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </AppText>
              ) : null}
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>{t("accountSecurity:pin.cancel")}</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() => { void handleRequestOtp(); }}
                  style={[styles.primaryButton, isSubmitting && styles.disabled]}
                >
                  <AppText style={styles.primaryText}>{isSubmitting ? t("accountSecurity:pin.setup.resendSending") : t("accountSecurity:pin.forgot.sendOtp")}</AppText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "enter-otp" ? (
            <View style={styles.stack}>
              <AppText style={styles.description}>
                {t("mobile:pin.change.otpEnterIntro")}
              </AppText>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                hasError={otpHasError}
                label={t("accountSecurity:pin.forgot.otpLabel")}
                onChange={(next) => {
                  setOtp(next);
                  if (otpHasError) {
                    setOtpHasError(false);
                    setErrorMessage(null);
                  }
                }}
                value={otp}
              />
              <AppText style={styles.muted}>
                {t("accountSecurity:pin.forgot.otpValidity")}{" "}
                <AppText
                  onPress={() => { void handleResend(); }}
                  style={[styles.link, (isResending || isSubmitting || resendSeconds > 0) && styles.disabledText]}
                >
                  {isResending ? t("accountSecurity:pin.setup.resendSending") : resendSeconds > 0 ? t("accountSecurity:pin.setup.resendCountdown", { seconds: resendSeconds }) : t("accountSecurity:pin.setup.resend")}
                </AppText>
              </AppText>
              {infoMessage !== null ? <AppText style={styles.muted}>{infoMessage}</AppText> : null}
              {errorMessage !== null ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </AppText>
              ) : null}
              <AppText style={styles.counter}>
                {t("accountSecurity:pin.setup.otpCounter", { current: otp.length, total: PIN_DIGIT_COUNT })}
              </AppText>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>{t("accountSecurity:pin.cancel")}</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isOtpFilled || isSubmitting}
                  onPress={handleOtpContinue}
                  style={[styles.primaryButton, (!isOtpFilled || isSubmitting) && styles.disabled]}
                >
                  <AppText style={styles.primaryText}>{t("accountSecurity:pin.setup.continue")}</AppText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "new-pin" ? (
            <View style={styles.stack}>
              <AppText style={styles.description}>
                {t("mobile:pin.change.newPinIntro")}
              </AppText>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                label={t("accountSecurity:pin.setup.newPin")}
                onChange={(next) => {
                  setNewPin(next);
                  if (errorMessage) setErrorMessage(null);
                }}
                value={newPin}
              />
              {errorMessage !== null ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </AppText>
              ) : null}
              <AppText style={styles.counter}>
                {t("accountSecurity:pin.setup.otpCounter", { current: newPin.length, total: PIN_DIGIT_COUNT })}
              </AppText>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>{t("accountSecurity:pin.cancel")}</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={newPin.length !== PIN_DIGIT_COUNT || isSubmitting}
                  onPress={handleNewPinContinue}
                  style={[styles.primaryButton, (newPin.length !== PIN_DIGIT_COUNT || isSubmitting) && styles.disabled]}
                >
                  <AppText style={styles.primaryText}>{t("accountSecurity:pin.setup.continue")}</AppText>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "confirm-pin" ? (
            <View style={styles.stack}>
              <AppText style={styles.description}>
                {t("mobile:pin.change.confirmIntro")}
              </AppText>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                hasError={hasMismatch}
                label={t("accountSecurity:pin.change.confirmLabel")}
                onChange={(next) => {
                  setConfirmPin(next);
                  if (errorMessage) setErrorMessage(null);
                }}
                value={confirmPin}
              />
              {hasMismatch ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {t("accountSecurity:pin.change.errorMismatch")}
                </AppText>
              ) : null}
              {errorMessage !== null ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </AppText>
              ) : null}
              {successMessage !== null ? (
                <AppText accessibilityRole="alert" style={styles.success}>
                  {successMessage}
                </AppText>
              ) : null}
              <AppText style={styles.counter}>
                {t("accountSecurity:pin.setup.otpCounter", { current: confirmPin.length, total: PIN_DIGIT_COUNT })}
              </AppText>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>{t("accountSecurity:pin.cancel")}</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!canSubmit || isSubmitting}
                  onPress={() => { void handleSubmit(); }}
                  style={[styles.primaryButton, (!canSubmit || isSubmitting) && styles.disabled]}
                >
                  <AppText style={styles.primaryText}>{isSubmitting ? t("mobile:pin.change.submitting") : t("mobile:pin.change.submit")}</AppText>
                </Pressable>
              </View>
            </View>
          ) : null}
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
      gap: 12,
      maxHeight: "92%",
    },
    stack: { gap: 12 },
    heading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    title: { color: theme.text, fontSize: 18, fontWeight: "800" },
    description: { color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "500" },
    emailBox: { borderRadius: 10, backgroundColor: theme.surfaceAlt, paddingHorizontal: 12, paddingVertical: 10 },
    emailText: { color: theme.text, fontSize: 14, textAlign: "center", fontWeight: "600" },
    muted: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "600" },
    counter: { color: theme.muted, fontSize: 12, textAlign: "center", fontWeight: "600" },
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "600" },
    success: { color: theme.success, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "700" },
    link: { color: theme.brand, fontWeight: "700" },
    disabledText: { opacity: 0.55 },
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
  });
