import { useEffect, useMemo, useRef, useState } from "react";
import { KeyRound } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import PinDigitInputs from "@/features/pin/components/PinDigitInputs";
import { getAuthUser } from "@/features/auth/hooks/useAuth";
import { PIN_DIGIT_COUNT, getFriendlyPinMessage, getPinErrorCode, isOtpErrorCode } from "@/features/pin/services/pinErrorMessage";
import { requestPinForgotOtp, resetPinForgot } from "@/features/pin/services/pinService";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PinForgotModalProps = {
  visible: boolean;
  onClose: () => void;
  onResetDone: () => void;
};

type Step = "request-otp" | "enter-otp";

function maskEmail(email: string) {
  const [head, ...rest] = email.split("@");
  if (rest.length === 0) return email;
  return `${head?.slice(0, 1) ?? ""}***@${rest.join("@")}`;
}

export default function PinForgotModal({ visible, onClose, onResetDone }: PinForgotModalProps) {
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
      setInfoMessage("Đã gửi lại mã OTP. Mã có hiệu lực trong 10 phút.");
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
            ? "Vui lòng nhập mã OTP 6 chữ số."
            : "Vui lòng nhập và xác nhận mã PIN mới 6 chữ số.",
        );
      }
      return;
    }
    if (newPin !== confirmPin) {
      setErrorMessage("Mã PIN xác nhận không khớp.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setOtpHasError(false);
    try {
      await resetPinForgot({ email, otpCode: otp, newPinCode: newPin });
      setSuccessMessage("Đặt lại mã PIN thành công!");
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
            <Text style={styles.title}>Quên mã PIN</Text>
          </View>
          <Text style={styles.description}>
            {step === "request-otp"
              ? "Mã OTP sẽ được gửi đến email của tài khoản của bạn."
              : "Nhập mã OTP và mã PIN mới bên dưới."}
          </Text>

          {step === "request-otp" ? (
            <View style={styles.stack}>
              <View style={styles.emailBox}>
                <Text style={styles.emailText}>{maskEmail(email)}</Text>
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
          ) : (
            <View style={styles.stack}>
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
                  onPress={() => { void handleResendOtp(); }}
                  style={[styles.link, (isResending || isSubmitting) && styles.disabledText]}
                >
                  {isResending ? "Đang gửi..." : "Gửi lại mã"}
                </Text>
              </Text>
              <PinDigitInputs disabled={isSubmitting} label="Mã PIN mới" onChange={setNewPin} value={newPin} />
              <PinDigitInputs
                disabled={isSubmitting}
                hasError={hasMismatch}
                label="Xác nhận mã PIN"
                onChange={setConfirmPin}
                value={confirmPin}
              />
              {hasMismatch ? (
                <Text accessibilityRole="alert" style={styles.error}>
                  Mã PIN xác nhận không khớp.
                </Text>
              ) : null}
              {infoMessage !== null ? <Text style={styles.muted}>{infoMessage}</Text> : null}
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
                {otp.length} / {PIN_DIGIT_COUNT} OTP · {newPin.length} / {PIN_DIGIT_COUNT} PIN mới ·{" "}
                {confirmPin.length} / {PIN_DIGIT_COUNT} xác nhận
              </Text>
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isResetFilled || isSubmitting}
                  onPress={() => { void handleReset(); }}
                  style={[styles.primaryButton, (!isResetFilled || isSubmitting) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>{isSubmitting ? "Đang đặt lại..." : "Đặt lại mã PIN"}</Text>
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
