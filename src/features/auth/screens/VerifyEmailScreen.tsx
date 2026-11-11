import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Mail } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AuthButton, AuthField, AuthNotice, OtpField } from "../components/AuthControls";
import { AuthScreenHeader } from "../components/AuthScreenHeader";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { resendOtp, verifyOtp } from "../services/authService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateEmail } from "../utils/validation";
import type { AuthStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "VerifyEmail">;

export default function VerifyEmailScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState(route.params.email); const [otp, setOtp] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const submit = async () => {
    const emailError = validateEmail(email);
    if (emailError || !/^\d{6}$/.test(otp)) { setError(emailError || t("common:validation.otpLength")); return; }
    setBusy(true); setError("");
    try { await verifyOtp({ email: email.trim(), otp, purpose: route.params.purpose }); navigation.replace("Login", { notice: t("mobile:auth.flow.emailVerifiedNotice") }); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? t("mobile:auth.errors.verifyFailed")); } finally { setBusy(false); }
  };
  const resend = async () => {
    const emailError = validateEmail(email); if (emailError) { setError(emailError); return; }
    setBusy(true); setError("");
    try { await resendOtp({ email: email.trim(), purpose: route.params.purpose }); setNotice(t("mobile:auth.flow.resendNoticeShort")); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? t("mobile:auth.errors.resendFailed")); } finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}><AuthScreenHeader description={t("mobile:auth.copy.verifyFormDescription")} onBack={() => navigation.goBack()} title={t("auth:verify.title")} />
    {error ? <AuthNotice error message={error} /> : null}{notice ? <AuthNotice message={notice} /> : null}<AuthField editable={!busy} icon={<Mail color={theme.muted} size={19} />} keyboardType="email-address" label={t("auth:fields.email")} onChangeText={setEmail} value={email} /><OtpField disabled={busy} onChange={setOtp} value={otp} />
    <AuthButton busy={busy} onPress={() => { void submit(); }} title={t("auth:verify.submit")} /><AuthButton busy={busy} onPress={() => { void resend(); }} title={t("auth:verify.resendOtp")} variant="outline" />
  </View></AuthScreenLayout>;
}
const createStyles = (_theme: Theme) => StyleSheet.create({ stack: { gap: 16 } });
