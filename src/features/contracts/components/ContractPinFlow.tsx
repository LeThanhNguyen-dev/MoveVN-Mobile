import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from "react-native"
import { showAppAlert } from "@/components/appDialog/dialogStore";
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import CodeDigitInput from "@/components/CodeDigitInput";
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
  const { t } = useTranslation();
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
          showAppAlert(t("mobile:contract.alerts.failureTitle"), t("mobile:contract.pin.checkFailed"));
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
      showAppAlert(t("mobile:contract.alerts.missingCodeTitle"), t("mobile:contract.pin.incomplete"));
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
      showAppAlert(t("mobile:contract.alerts.failureTitle"), getApiErrorMessage(err, t("mobile:contract.pin.wrong")));
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup() {
    if (otp.trim().length < 6) {
      showAppAlert(t("mobile:contract.alerts.missingCodeTitle"), t("mobile:contract.pin.otpMissing"));
      return;
    }
    if (!isValidPinCode(newPin)) {
      showAppAlert(t("mobile:contract.alerts.missingCodeTitle"), t("mobile:contract.pin.invalidNew"));
      return;
    }
    setBusy(true);
    try {
      await setupPin(newPin.trim(), otp.trim());
      const content = await verifyViewPin(contract.id, newPin.trim());
      onVerified(content);
    } catch (err) {
      showAppAlert(t("mobile:contract.alerts.failureTitle"), getApiErrorMessage(err, t("mobile:contract.pin.setupFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function handleForgot() {
    if (otp.trim().length < 6) {
      showAppAlert(t("mobile:contract.alerts.missingCodeTitle"), t("mobile:contract.pin.otpMissing"));
      return;
    }
    if (!isValidPinCode(newPin)) {
      showAppAlert(t("mobile:contract.alerts.missingCodeTitle"), t("mobile:contract.pin.invalidNew"));
      return;
    }
    setBusy(true);
    try {
      await resetForgotPin(userEmail, otp.trim(), newPin.trim());
      const content = await verifyViewPin(contract.id, newPin.trim());
      onVerified(content);
    } catch (err) {
      showAppAlert(t("mobile:contract.alerts.failureTitle"), getApiErrorMessage(err, t("mobile:contract.pin.resetFailed")));
    } finally {
      setBusy(false);
    }
  }

  async function sendForgotOtp() {
    setBusy(true);
    try {
      await requestForgotPinOtp(userEmail);
      showAppAlert(t("mobile:contract.alerts.sentTitle"), t("mobile:contract.pin.resetOtpSent"));
    } catch (err) {
      showAppAlert(t("mobile:contract.alerts.failureTitle"), getApiErrorMessage(err, t("mobile:contract.pin.otpSendFailed")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.modal}>
          <AppText display style={styles.title}>{t("mobile:contract.pin.title")}</AppText>
          {step === "loading" && <ActivityIndicator color={theme.brand} />}

          {step === "verify" && (
            <>
              <AppText style={styles.muted}>{t("mobile:contract.pin.verifyHint")}</AppText>
              {lockSeconds != null && lockSeconds > 0 && (
                <AppText style={styles.warn}>{t("mobile:contract.pin.locked", { seconds: lockSeconds })}</AppText>
              )}
              <CodeDigitInput label={t("mobile:contract.pin.pinPlaceholder")} value={pin} onChange={setPin} secure />
              <RowButtons
                busy={busy}
                onClose={onClose}
                onSubmit={handleVerify}
                submitLabel={t("mobile:contract.pin.open")}
                extra={
                  <Pressable onPress={() => { setStep("forgot"); setOtp(""); setNewPin(""); }}>
                    <AppText style={styles.link}>{t("mobile:contract.pin.forgot")}</AppText>
                  </Pressable>
                }
              />
            </>
          )}

          {step === "setup" && (
            <>
              <AppText style={styles.muted}>
                {t("mobile:contract.pin.setupHint")}
              </AppText>
              <CodeDigitInput label={t("mobile:contract.pin.emailOtpLabel")} value={otp} onChange={setOtp} />
              <CodeDigitInput label={t("mobile:contract.pin.newPinLabel")} value={newPin} onChange={setNewPin} secure />
              <RowButtons busy={busy} onClose={onClose} onSubmit={handleSetup} submitLabel={t("mobile:contract.pin.createAndOpen")} />
            </>
          )}

          {step === "forgot" && (
            <>
              <AppText style={styles.muted}>{t("mobile:contract.pin.forgotHint", { email: userEmail })}</AppText>
              <Pressable onPress={sendForgotOtp} disabled={busy} style={styles.otpButton}>
                <AppText style={styles.otpButtonText}>{t("mobile:contract.pin.sendOtp")}</AppText>
              </Pressable>
              <CodeDigitInput label={t("mobile:contract.pin.emailOtpLabel")} value={otp} onChange={setOtp} />
              <CodeDigitInput label={t("mobile:contract.pin.newPinLabel")} value={newPin} onChange={setNewPin} secure />
              <RowButtons busy={busy} onClose={onClose} onSubmit={handleForgot} submitLabel={t("mobile:contract.pin.resetAndOpen")} />
            </>
          )}
        </View>
      </View>
    </Modal>
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
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      {extra}
      <View style={styles.actions}>
        <Pressable onPress={onClose} style={styles.ghostButton}>
          <AppText style={styles.ghostText}>{t("contract:drawer.close")}</AppText>
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
    link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    row: { gap: 8 },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: theme.muted, fontWeight: "700" },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
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
