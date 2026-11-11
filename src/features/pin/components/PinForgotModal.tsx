import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import PinDigitInputs, { type PinDigitInputsHandle } from "@/features/pin/components/PinDigitInputs";
import { getAuthUser } from "@/features/auth/hooks/useAuth";
import { PIN_DIGIT_COUNT, getFriendlyPinMessage, getPinErrorCode, isOtpErrorCode } from "@/features/pin/services/pinErrorMessage";
import { requestPinForgotOtp, resetPinForgot } from "@/features/pin/services/pinService";
import { maskEmail } from "@/features/pin/utils/maskEmail";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PinForgotModalProps = {
  visible: boolean;
  onClose: () => void;
  onResetDone: () => void;
};

type Step = "request-otp" | "enter-otp";

export default function PinForgotModal({ visible, onClose, onResetDone }: PinForgotModalProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [step, setStep] = useState<Step>("request-otp");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [otpHasError, setOtpHasError] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const newPinGroupRef = useRef<PinDigitInputsHandle | null>(null);
  const confirmPinGroupRef = useRef<PinDigitInputsHandle | null>(null);

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
  }, [visible]);

  useEffect(() => () => {
    if (doneTimer.current !== null) clearTimeout(doneTimer.current);
  }, []);

  const isResetFilled =
    otp.length === PIN_DIGIT_COUNT &&
    newPin.length === PIN_DIGIT_COUNT &&
    confirmPin.length === PIN_DIGIT_COUNT;
  const hasMismatch = newPin.length === PIN_DIGIT_COUNT && confirmPin.length > 0 && newPin !== confirmPin;

  async function handleRequestOtp() {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await requestPinForgotOtp({ email });
      setStep("enter-otp");
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResendOtp() {
    if (isResending) return;
    setIsResending(true);
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      await requestPinForgotOtp({ email });
      setInfoMessage(t("accountSecurity:pin.forgot.resendInfo"));
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  async function handleReset() {
    if (!isResetFilled || isSubmitting) {
      if (!isResetFilled) {
        setErrorMessage(
          otp.length !== PIN_DIGIT_COUNT
            ? t("accountSecurity:pin.forgot.errorOtp")
            : t("accountSecurity:pin.forgot.errorFill"),
        );
      }
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMessage(t("accountSecurity:pin.forgot.errorMismatch"));
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setOtpHasError(false);
    try {
      await resetPinForgot({ email, otpCode: otp, newPinCode: newPin });
      setSuccessMessage(t("accountSecurity:pin.forgot.success"));
      doneTimer.current = setTimeout(() => onResetDone(), 1200);
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
      if (isOtpErrorCode(getPinErrorCode(error))) setOtpHasError(true);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.heading}>
            <KeyRound color={theme.brand} size={22} strokeWidth={2.3} />
            <AppText display style={styles.title}>{t("accountSecurity:pin.forgot.title")}</AppText>
          </View>
          <AppText style={styles.description}>
            {step === "request-otp"
              ? t("accountSecurity:pin.forgot.introRequest")
              : t("accountSecurity:pin.forgot.introEnter")}
          </AppText>

          {step === "request-otp" ? (
            <View style={styles.stack}>
              <View style={styles.emailBox}>
                <AppText style={styles.emailText}>{maskEmail(email)}</AppText>
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
                  <AppText style={styles.primaryText}>{isSubmitting ? t("accountSecurity:pin.forgot.resendSending") : t("accountSecurity:pin.forgot.sendOtp")}</AppText>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
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
                onComplete={() => newPinGroupRef.current?.focusFirst()}
                value={otp}
              />
              <AppText style={styles.muted}>
                {t("accountSecurity:pin.forgot.otpValidity")}{" "}
                <AppText
                  onPress={() => { void handleResendOtp(); }}
                  style={[styles.link, (isResending || isSubmitting) && styles.disabledText]}
                >
                  {isResending ? t("accountSecurity:pin.forgot.resendSending") : t("accountSecurity:pin.forgot.resend")}
                </AppText>
              </AppText>
              <PinDigitInputs
                ref={newPinGroupRef}
                disabled={isSubmitting}
                label={t("accountSecurity:pin.forgot.newPin")}
                onChange={setNewPin}
                onComplete={() => confirmPinGroupRef.current?.focusFirst()}
                value={newPin}
              />
              <PinDigitInputs
                ref={confirmPinGroupRef}
                disabled={isSubmitting}
                hasError={hasMismatch}
                label={t("accountSecurity:pin.forgot.confirmPin")}
                onChange={setConfirmPin}
                value={confirmPin}
              />
              {hasMismatch ? (
                <AppText accessibilityRole="alert" style={styles.error}>
                  {t("accountSecurity:pin.forgot.errorMismatch")}
                </AppText>
              ) : null}
              {infoMessage !== null ? <AppText style={styles.muted}>{infoMessage}</AppText> : null}
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
                {t("accountSecurity:pin.forgot.counter", {
                  otp: otp.length,
                  total: PIN_DIGIT_COUNT,
                  pin: newPin.length,
                  confirm: confirmPin.length,
                })}
              </AppText>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <AppText style={styles.secondaryText}>{t("accountSecurity:pin.cancel")}</AppText>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isResetFilled || isSubmitting}
                  onPress={() => { void handleReset(); }}
                  style={[styles.primaryButton, (!isResetFilled || isSubmitting) && styles.disabled]}
                >
                  <AppText style={styles.primaryText}>{isSubmitting ? t("mobile:pin.forgot.submitting") : t("accountSecurity:pin.forgot.submit")}</AppText>
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
      gap: 12,
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
