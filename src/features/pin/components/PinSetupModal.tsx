import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, EyeOff, ShieldCheck } from "lucide-react-native";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import PinDigitInputs, { type PinDigitInputsHandle } from "@/features/pin/components/PinDigitInputs";
import type { VerifyPinResult } from "@/features/pin/hooks/usePinReveal";
import { getAuthUser } from "@/features/auth/hooks/useAuth";
import { PIN_DIGIT_COUNT, getFriendlyPinMessage, getPinErrorCode, isOtpErrorCode } from "@/features/pin/services/pinErrorMessage";
import { requestSetupPinOtp, setupPin } from "@/features/pin/services/pinService";
import type { PinDocumentType } from "@/features/pin/types";
import { maskEmail } from "@/features/pin/utils/maskEmail";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PinSetupModalProps = {
  documentType: PinDocumentType;
  visible: boolean;
  onClose: () => void;
  onSetupDone: (pinCode: string) => Promise<VerifyPinResult>;
};

type SetupStep = "pin" | "otp";

const RESEND_COUNTDOWN_SECONDS = 60;

export default function PinSetupModal({ documentType, visible, onClose, onSetupDone }: PinSetupModalProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [step, setStep] = useState<SetupStep>("pin");
  const [pinCode, setPinCode] = useState("");
  const [confirmPinCode, setConfirmPinCode] = useState("");
  const [otp, setOtp] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [otpHasError, setOtpHasError] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const confirmGroupRef = useRef<PinDigitInputsHandle | null>(null);

  const email = getAuthUser()?.email ?? "";
  const documentLabel = documentType === "CCCD" ? "Căn cước công dân" : "Giấy phép lái xe";

  useEffect(() => {
    if (!visible) return;
    setStep("pin");
    setPinCode("");
    setConfirmPinCode("");
    setOtp("");
    setShowValue(false);
    setErrorMessage(null);
    setOtpHasError(false);
    setInfoMessage(null);
    setResendSeconds(0);
  }, [visible]);

  useEffect(() => {
    if (step !== "otp" || resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(timer);
  }, [step, resendSeconds]);

  const isPinFilled = pinCode.length === PIN_DIGIT_COUNT && confirmPinCode.length === PIN_DIGIT_COUNT;
  const hasMismatch =
    confirmPinCode.length > 0 &&
    pinCode.length === PIN_DIGIT_COUNT &&
    confirmPinCode !== pinCode.slice(0, confirmPinCode.length);

  function handlePinChange(next: string) {
    setPinCode(next);
    if (errorMessage !== null && step === "pin") setErrorMessage(null);
  }

  function handleOtpChange(next: string) {
    setOtp(next);
    if (otpHasError) {
      setOtpHasError(false);
      setErrorMessage(null);
    }
  }

  async function handleContinue() {
    if (!isPinFilled || isSubmitting) {
      if (!isPinFilled) setErrorMessage("Vui lòng nhập đủ mã PIN 6 chữ số ở cả hai ô.");
      return;
    }
    if (pinCode !== confirmPinCode) {
      setErrorMessage("Mã PIN xác nhận không trùng khớp.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      await requestSetupPinOtp();
      setStep("otp");
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
      await requestSetupPinOtp();
      setResendSeconds(RESEND_COUNTDOWN_SECONDS);
      setInfoMessage("Đã gửi lại mã OTP. Mã có hiệu lực trong 10 phút.");
    } catch (error) {
      setErrorMessage(getFriendlyPinMessage(error));
    } finally {
      setIsResending(false);
    }
  }

  async function handleConfirm() {
    if (otp.length !== PIN_DIGIT_COUNT || isSubmitting) {
      if (otp.length !== PIN_DIGIT_COUNT) setErrorMessage("Vui lòng nhập mã OTP 6 chữ số.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage(null);
    setOtpHasError(false);
    try {
      await setupPin({ pinCode, otp });
      await onSetupDone(pinCode);
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
            <ShieldCheck color={theme.brand} size={22} strokeWidth={2.3} />
            <Text style={styles.title}>Thiết lập mã PIN</Text>
            {step === "pin" ? (
              <Pressable
                accessibilityLabel={showValue ? "Ẩn mã PIN" : "Hiển thị mã PIN"}
                accessibilityRole="button"
                onPress={() => setShowValue((prev) => !prev)}
                style={styles.eyeButton}
              >
                {showValue
                  ? <EyeOff color={theme.muted} size={18} strokeWidth={2.3} />
                  : <Eye color={theme.muted} size={18} strokeWidth={2.3} />}
              </Pressable>
            ) : null}
          </View>

          {step === "pin" ? (
            <View style={styles.stack}>
              <Text style={styles.description}>
                Tạo mã PIN 6 chữ số để hiển thị chi tiết giấy tờ {documentLabel}.
              </Text>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                label="Mã PIN mới"
                onChange={handlePinChange}
                onComplete={() => confirmGroupRef.current?.focusFirst()}
                showValue={showValue}
                value={pinCode}
              />
              <PinDigitInputs
                ref={confirmGroupRef}
                disabled={isSubmitting}
                hasError={hasMismatch}
                label="Xác nhận mã PIN"
                onChange={setConfirmPinCode}
                showValue={showValue}
                value={confirmPinCode}
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
              <View style={styles.actions}>
                <Pressable accessibilityRole="button" onPress={onClose} style={styles.secondaryButton}>
                  <Text style={styles.secondaryText}>Hủy</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  disabled={!isPinFilled || isSubmitting}
                  onPress={() => { void handleContinue(); }}
                  style={[styles.primaryButton, (!isPinFilled || isSubmitting) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>{isSubmitting ? "Đang gửi..." : "Tiếp tục"}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.stack}>
              <Text style={styles.description}>Mã OTP đã được gửi về email {maskEmail(email)}.</Text>
              <PinDigitInputs
                autoFocus={visible}
                disabled={isSubmitting}
                hasError={otpHasError}
                label="Mã OTP"
                onChange={handleOtpChange}
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
                  disabled={otp.length !== PIN_DIGIT_COUNT || isSubmitting}
                  onPress={() => { void handleConfirm(); }}
                  style={[styles.primaryButton, (otp.length !== PIN_DIGIT_COUNT || isSubmitting) && styles.disabled]}
                >
                  <Text style={styles.primaryText}>{isSubmitting ? "Đang tạo..." : "Xác nhận & Tạo PIN"}</Text>
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
    title: { color: theme.text, fontSize: 18, fontWeight: "800", flex: 1, textAlign: "center" },
    eyeButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", position: "absolute", right: 0 },
    description: { color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "500" },
    muted: { color: theme.muted, fontSize: 12, lineHeight: 18, textAlign: "center", fontWeight: "600" },
    counter: { color: theme.muted, fontSize: 12, textAlign: "center", fontWeight: "600" },
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "600" },
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
