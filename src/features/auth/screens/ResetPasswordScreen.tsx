import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LockKeyhole, ShieldCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AuthButton, AuthField, AuthNotice, OtpField } from "../components/AuthControls";
import { AuthScreenHeader } from "../components/AuthScreenHeader";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { resetPassword } from "../services/authService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateAuth } from "../utils/validation";
import type { AuthStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "ResetPassword">;

export default function ResetPasswordScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [otp, setOtp] = useState(""); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const errors = validateAuth("reset", { email: route.params.email, otp, password, confirmPassword, fullName: "", phone: "" }, false);
    if (Object.keys(errors).length) { setError(Object.values(errors)[0] ?? t("mobile:auth.invalidData")); return; }
    setBusy(true); setError("");
    try { await resetPassword({ email: route.params.email, otp, newPassword: password, confirmPassword }); navigation.replace("Login", { notice: t("mobile:auth.flow.passwordResetNotice") }); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? t("mobile:auth.errors.resetFailed")); } finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}><AuthScreenHeader description={t("auth:reset.description")} onBack={() => navigation.goBack()} title={t("auth:reset.title")} />
    {error ? <AuthNotice error message={error} /> : null}<OtpField disabled={busy} error={undefined} onChange={setOtp} value={otp} />
    <AuthField editable={!busy} icon={<LockKeyhole color={theme.muted} size={19} />} label={t("auth:fields.newPassword")} onChangeText={setPassword} password value={password} />
    <AuthField editable={!busy} icon={<ShieldCheck color={theme.muted} size={19} />} label={t("auth:fields.confirmNewPassword")} onChangeText={setConfirmPassword} password value={confirmPassword} />
    <AuthButton busy={busy} onPress={() => { void submit(); }} title={t("auth:reset.submit")} />
  </View></AuthScreenLayout>;
}
const createStyles = (_theme: Theme) => StyleSheet.create({ stack: { gap: 16 } });
