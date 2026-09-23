import { useEffect, useMemo, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
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
      setErrorMessage("Vui lòng nhập đủ mã PIN mới 6 chữ số.");
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
      setInfoMessage("Đã gửi lại mã OTP. Mã có hiệu lực trong 10 phút.");
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  function handleOtpContinue() {
    if (!isOtpFilled) {
      setErrorMessage("Vui lòng nhập mã OTP 6 chữ số.");
      return;
    }
    setErrorMessage(null);
    setStep("new-pin");
  }

  async function handleSubmit() {
    if (!canSubmit || isSubmitting) {
      if (!isPinFilled) {
        setErrorMessage("Vui lòng nhập và xác nhận mã PIN mới 6 chữ số.");
      } else if (newPin !== confirmPin) {
        setErrorMessage("Mã PIN xác nhận không trùng khớp.");
      }
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setOtpHasError(false);
    try {
      await resetPinForgot({ email, otpCode: otp, newPinCode: newPin });
      setSuccessMessage("Đổi mã PIN thành công!");
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
            <Text style={styles.title}>Đổi mã PIN</Text>
          </View>

          {step === "request-otp" ? (
            <View style={styles.stack}>
              <Text style={styles.description}>
                Mã OTP xác thực sẽ được gửi đến email của bạn.
              </Text>
              <View style={styles.emailBox}>
                <Text style={styles.emailText}>{email}</Text>
              </View>
              {errorMessage !== null ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </Text>
              ) : null}
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={isSubmitting}
                  onPress={() => { void handleRequestOtp(); }}
                  style={[styles.primaryButton, isSubmitting && styles.disabled]}
                >
                  <Text style={styles.primaryText}>{isSubmitting ? "Đang gửi..." : "Gửi mã OTP"}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "enter-otp" ? (
            <View style={styles.stack}>
              <Text style={styles.description}>
                Nhập mã OTP đã gửi về email của bạn.
              </Text>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                hasError={otpHasError}
                label="Mã OTP"
                onChange={(next) => {
                  setOtp(next);
                  if (otpHasError) {
                    setOtpHasError(false);
                    setErrorMessage(null);
                  }
                }}
                value={otp}
              />
              <Text style={styles.muted}>
                Mã OTP có hiệu lực trong 10 phút.{" "}
                <Text
                  onPress={() => { void handleResend(); }}
                  style={[styles.link, (isResending || isSubmitting || resendSeconds > 0) && styles.disabledText]}
                >
                  {isResending ? "Đang gửi..." : resendSeconds > 0 ? `Gửi lại mã (${resendSeconds}s)` : "Gửi lại mã"}
                </Text>
              </Text>
              {infoMessage !== null ? <Text style={styles.muted}>{infoMessage}</Text> : null}
              {errorMessage !== null ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </Text>
              ) : null}
              <Text style={styles.counter}>
                {otp.length} / {PIN_DIGIT_COUNT}
              </Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isOtpFilled || isSubmitting}
                  onPress={handleOtpContinue}
                  style={[styles.primaryButton, (!isOtpFilled || isSubmitting) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>Tiếp tục</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "new-pin" ? (
            <View style={styles.stack}>
              <Text style={styles.description}>
                Nhập mã PIN mới gồm 6 chữ số.
              </Text>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                label="Mã PIN mới"
                onChange={(next) => {
                  setNewPin(next);
                  if (errorMessage) setErrorMessage(null);
                }}
                value={newPin}
              />
              {errorMessage !== null ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </Text>
              ) : null}
              <Text style={styles.counter}>
                {newPin.length} / {PIN_DIGIT_COUNT}
              </Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={newPin.length !== PIN_DIGIT_COUNT || isSubmitting}
                  onPress={handleNewPinContinue}
                  style={[styles.primaryButton, (newPin.length !== PIN_DIGIT_COUNT || isSubmitting) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>Tiếp tục</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {step === "confirm-pin" ? (
            <View style={styles.stack}>
              <Text style={styles.description}>
                Nhập lại mã PIN mới để xác nhận.
              </Text>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                hasError={hasMismatch}
                label="Xác nhận mã PIN mới"
                onChange={(next) => {
                  setConfirmPin(next);
                  if (errorMessage) setErrorMessage(null);
                }}
                value={confirmPin}
              />
              {hasMismatch ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  Mã PIN xác nhận không trùng khớp.
                </Text>
              ) : null}
              {errorMessage !== null ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  {errorMessage}
                </Text>
              ) : null}
              {successMessage !== null ? (
                <Text accessibilityRole="alert" style={styles.success}>
                  {successMessage}
                </Text>
              ) : null}
              <Text style={styles.counter}>
                {confirmPin.length} / {PIN_DIGIT_COUNT}
              </Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!canSubmit || isSubmitting}
                  onPress={() => { void handleSubmit(); }}
                  style={[styles.primaryButton, (!canSubmit || isSubmitting) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>{isSubmitting ? "Đang đổi..." : "Xác nhận đổi PIN"}</Text>
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
