import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, TextInput, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { ContractContent, ContractSummary } from "@/features/contracts/types";
import { verifyViewPin } from "@/features/contracts/contractService";
import {
  getPinStatus,
  isValidPinCode,
  requestForgotPinOtp,
  requestSetupPinOtp,
  resetForgotPin,
  setupPin,
} from "@/features/userSecurity/pinService";
import { getApiErrorMessage } from "@/services/apiClient";

type Step = "loading" | "verify" | "setup" | "forgot";

/** Xem hợp đồng bằng mã PIN của app (đúng như bản web): chưa có PIN thì tạo, quên thì đặt lại qua OTP mail. */
export default function ContractPinFlow({
  contract,
  userEmail,
  onClose,
  onVerified,
}: {
  contract: ContractSummary;
  userEmail: string;
  onClose: () => void;
  onVerified: (content: ContractContent) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [step, setStep] = useState<Step>("loading");
  const [pin, setPin] = useState("");
  const [otp, setOtp] = useState("");
  const [newPin, setNewPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockSeconds, setLockSeconds] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const status = await getPinStatus();
        if (cancelled) return;
        if (status.lockoutRemainingSeconds != null && status.lockoutRemainingSeconds > 0) {
          setLockSeconds(status.lockoutRemainingSeconds);
        }
        if (status.isPinSet) {
          setStep("verify");
        } else {
          setStep("setup");
          await requestSetupPinOtp().catch(() => undefined);
        }
      } catch {
        if (!cancelled) {
          Alert.alert("Thất bại", "Không kiểm tra được mã PIN. Vui lòng thử lại.");
          onClose();
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify() {
    if (!isValidPinCode(pin)) {
      Alert.alert("Thiếu mã", "Vui lòng nhập đủ 6 chữ số PIN.");
      return;
    }
    setBusy(true);
    try {
      const content = await verifyViewPin(contract.id, pin.trim());
      onVerified(content);
    } catch (err) {
      try {
        const status = await getPinStatus().catch(() => null);
        if (status?.lockoutRemainingSeconds != null && status.lockoutRemainingSeconds > 0) {
          setLockSeconds(status.lockoutRemainingSeconds);
        }
      } catch {
        // Bỏ qua lỗi phụ.
      }
      Alert.alert("Thất bại", getApiErrorMessage(err, "Mã PIN không đúng."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup() {
    if (otp.trim().length < 6) {
      Alert.alert("Thiếu mã", "Vui lòng nhập mã OTP gửi đến email.");
      return;
    }
    if (!isValidPinCode(newPin)) {
      Alert.alert("Thiếu mã", "Mã PIN mới phải đúng 6 chữ số.");
      return;
    }
    setBusy(true);
    try {
      await setupPin(newPin.trim(), otp.trim());
      const content = await verifyViewPin(contract.id, newPin.trim());
      onVerified(content);
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không tạo được mã PIN."));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (otp.trim().length < 6) {
      Alert.alert("Thiếu mã", "Vui lòng nhập mã OTP gửi đến email.");
      return;
    }
    if (!isValidPinCode(newPin)) {
      Alert.alert("Thiếu mã", "Mã PIN mới phải đúng 6 chữ số.");
      return;
    }
    setBusy(true);
    try {
      await resetForgotPin(userEmail, otp.trim(), newPin.trim());
      const content = await verifyViewPin(contract.id, newPin.trim());
      onVerified(content);
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không đặt lại được mã PIN."));
    } finally {
      setBusy(false);
    }
  }

  async function sendForgotOtp() {
    setBusy(true);
    try {
      await requestForgotPinOtp(userEmail);
      Alert.alert("Đã gửi", "Mã OTP đặt lại PIN đã gửi đến email của bạn.");
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không gửi được mã OTP."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <AppText display style={styles.title}>Xem hợp đồng</AppText>
          {step === "loading" && <ActivityIndicator color={theme.brand} />}

          {step === "verify" && (
            <>
              <AppText style={styles.muted}>Nhập mã PIN của app để mở hợp đồng (không gửi OTP).</AppText>
              {lockSeconds != null && lockSeconds > 0 && (
                <AppText style={styles.warn}>Nhập sai nhiều lần, thử lại sau {lockSeconds}s.</AppText>
              )}
              <PinInput value={pin} onChange={setPin} />
              <RowButtons
                busy={busy}
                onClose={onClose}
                onSubmit={handleVerify}
                submitLabel="Mở hợp đồng"
                extra={
                  <Pressable onPress={() => { setStep("forgot"); setOtp(""); setNewPin(""); }}>
                    <AppText style={styles.link}>Quên mã PIN?</AppText>
                  </Pressable>
                }
              />
            </>
          )}

          {step === "setup" && (
            <>
              <AppText style={styles.muted}>
                Bạn chưa có mã PIN. Mã OTP vừa gửi đến email — nhập OTP rồi đặt PIN 6 số để mở hợp đồng.
              </AppText>
              <AppText style={styles.fieldLabel}>Mã OTP email</AppText>
              <OtpInput value={otp} onChange={setOtp} />
              <AppText style={styles.fieldLabel}>Mã PIN mới (6 số)</AppText>
              <PinInput value={newPin} onChange={setNewPin} />
              <RowButtons busy={busy} onClose={onClose} onSubmit={handleSetup} submitLabel="Tạo PIN & mở" />
            </>
          )}

          {step === "forgot" && (
            <>
              <AppText style={styles.muted}>Nhập mã OTP gửi đến {userEmail} rồi đặt PIN mới.</AppText>
              <Pressable onPress={sendForgotOtp} disabled={busy} style={styles.otpButton}>
                <AppText style={styles.otpButtonText}>Gửi mã OTP</AppText>
              </Pressable>
              <AppText style={styles.fieldLabel}>Mã OTP email</AppText>
              <OtpInput value={otp} onChange={setOtp} />
              <AppText style={styles.fieldLabel}>Mã PIN mới (6 số)</AppText>
              <PinInput value={newPin} onChange={setNewPin} />
              <RowButtons busy={busy} onClose={onClose} onSubmit={handleForgot} submitLabel="Đặt lại & mở" />
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function OtpInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="6 chữ số OTP"
      placeholderTextColor={theme.placeholder}
      keyboardType="number-pad"
      maxLength={6}
      style={styles.input}
    />
  );
}

function PinInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder="6 chữ số PIN"
      placeholderTextColor={theme.placeholder}
      keyboardType="number-pad"
      maxLength={6}
      secureTextEntry
      style={styles.input}
    />
  );
}

function RowButtons({
  busy,
  onClose,
  onSubmit,
  submitLabel,
  extra,
}: {
  busy: boolean;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  extra?: React.ReactNode;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      {extra}
      <View style={styles.actions}>
        <Pressable onPress={onClose} style={styles.ghostButton}>
          <AppText style={styles.ghostText}>Đóng</AppText>
        </Pressable>
        <Pressable onPress={onSubmit} disabled={busy} style={[styles.primaryButton, busy && styles.disabled]}>
          {busy ? (
            <ActivityIndicator color={theme.onBrand} />
          ) : (
            <AppText style={styles.primaryText}>{submitLabel}</AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 18 },
    warn: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    fieldLabel: { color: theme.text, fontSize: 13, fontWeight: "700" },
    link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 15,
      letterSpacing: 4,
      textAlign: "center",
    },
    row: { gap: 8 },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: theme.muted, fontWeight: "700" },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: theme.brandSolid,
      paddingHorizontal: 18,
      paddingVertical: 10,
      minWidth: 110,
      alignItems: "center",
    },
    primaryText: { color: theme.onBrand, fontWeight: "800" },
    disabled: { opacity: 0.6 },
    otpButton: {
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      paddingVertical: 10,
      alignItems: "center",
    },
    otpButtonText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  });
