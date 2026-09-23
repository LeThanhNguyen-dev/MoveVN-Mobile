import { useMemo, useState } from "react";
import { ArrowLeft, KeyRound, LockKeyhole, ShieldCheck } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AuthButton, AuthField, AuthNotice } from "../components/AuthControls";
import { changePassword } from "../services/authService";
import { getFriendlyAuthError } from "../utils/authErrors";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type Step = 1 | 2 | 3;

const STEP_META: Record<Step, { progress: string; title: string; description: string }> = {
  1: {
    progress: "1/3",
    title: "Nhập mật khẩu hiện tại",
    description: "Nhập mật khẩu hiện tại để tiếp tục",
  },
  2: {
    progress: "2/3",
    title: "Tạo mật khẩu mới",
    description: "Nhập mật khẩu mới, ít nhất 8 ký tự",
  },
  3: {
    progress: "3/3",
    title: "Xác nhận mật khẩu mới",
    description: "Nhập lại mật khẩu mới để xác nhận",
  },
};

export default function ChangePasswordScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [step, setStep] = useState<Step>(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [busy, setBusy] = useState(false);

  function handleBack() {
    if (busy) return;
    if (step === 1) {
      onBack();
      return;
    }
    setError("");
    setStep((prev) => (prev === 3 ? 2 : 1));
  }

  async function handleContinue() {
    if (busy) return;
    if (step === 1) {
      if (!currentPassword) {
        setError("Vui lòng nhập mật khẩu hiện tại.");
        return;
      }
      setError("");
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!newPassword || newPassword.length < 8) {
        setError("Mật khẩu mới phải có ít nhất 8 ký tự.");
        return;
      }
      setError("");
      setStep(3);
      return;
    }
    if (!confirmPassword || newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setStep(1);
      setSuccess("Đổi mật khẩu thành công. Mật khẩu tài khoản đã được cập nhật.");
    } catch (failure) {
      setError(getFriendlyAuthError(failure) ?? "Đổi mật khẩu không thành công.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={handleBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Đổi mật khẩu</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.cardIcon}>
              <KeyRound color="#D97706" size={22} strokeWidth={2.3} />
            </View>
            <View style={styles.cardTitleWrap}>
              <Text style={styles.cardTitle}>Đổi mật khẩu</Text>
              <Text style={styles.cardDescription}>Cập nhật mật khẩu cho phiên đăng nhập hiện tại.</Text>
            </View>
          </View>

          <View style={styles.progressRow}>
            <Text style={styles.progressText}>{STEP_META[step].progress}</Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${(step / 3) * 100}%` }]} />
            </View>
          </View>

          <View style={styles.heading}>
            <ShieldCheck color={theme.brand} size={20} strokeWidth={2.3} />
            <Text style={styles.title}>{STEP_META[step].title}</Text>
          </View>
          <Text style={styles.description}>{STEP_META[step].description}</Text>

          {success ? <AuthNotice message={success} /> : null}
          {error ? <AuthNotice error message={error} /> : null}

          {step === 1 ? (
            <AuthField
              key="current-password"
              autoFocus
              editable={!busy}
              icon={<LockKeyhole color={theme.muted} size={19} />}
              label="Mật khẩu hiện tại"
              onChangeText={(value) => {
                setCurrentPassword(value);
                if (error) setError("");
                if (success) setSuccess("");
              }}
              password
              placeholder="Nhập mật khẩu hiện tại"
              value={currentPassword}
            />
          ) : null}
          {step === 2 ? (
            <AuthField
              key="new-password"
              autoFocus
              editable={!busy}
              icon={<ShieldCheck color={theme.muted} size={19} />}
              label="Mật khẩu mới"
              onChangeText={(value) => {
                setNewPassword(value);
                if (error) setError("");
                if (success) setSuccess("");
              }}
              password
              placeholder="Ít nhất 8 ký tự"
              value={newPassword}
            />
          ) : null}
          {step === 3 ? (
            <AuthField
              key="confirm-password"
              autoFocus
              editable={!busy}
              icon={<ShieldCheck color={theme.muted} size={19} />}
              label="Xác nhận mật khẩu mới"
              onChangeText={(value) => {
                setConfirmPassword(value);
                if (error) setError("");
                if (success) setSuccess("");
              }}
              password
              placeholder="Nhập lại mật khẩu mới"
              value={confirmPassword}
            />
          ) : null}

          <AuthButton
            busy={busy}
            onPress={() => { void handleContinue(); }}
            title={step === 3 ? "Xác nhận đổi mật khẩu" : "Tiếp tục"}
          />
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 4,
      minHeight: 48,
    },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    topBarTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 28 },
    card: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 16,
      gap: 14,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 12, alignSelf: "stretch" },
    cardIcon: {
      width: 46,
      height: 46,
      borderRadius: 14,
      backgroundColor: "#FEF3C7",
      alignItems: "center",
      justifyContent: "center",
    },
    cardTitleWrap: { flex: 1, minWidth: 0, gap: 2 },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    cardDescription: { color: theme.muted, fontSize: 12, lineHeight: 17, fontWeight: "600" },
    progressRow: { width: "100%", gap: 8 },
    progressText: { color: theme.muted, fontSize: 12, fontWeight: "800", textAlign: "center" },
    progressTrack: { height: 6, borderRadius: 999, backgroundColor: theme.surfaceAlt, overflow: "hidden" },
    progressFill: { height: 6, borderRadius: 999, backgroundColor: theme.brand },
    heading: { flexDirection: "row", alignItems: "center", alignSelf: "center", gap: 8 },
    title: { color: theme.text, fontSize: 16, fontWeight: "800", textAlign: "center" },
    description: { color: theme.muted, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "500" },
  });
