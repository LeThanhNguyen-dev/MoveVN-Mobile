import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Mail } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import { AuthButton, AuthField, AuthNotice } from "../components/AuthControls";
import { AuthScreenHeader } from "../components/AuthScreenHeader";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { forgotPassword } from "../services/authService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateEmail } from "../utils/validation";
import type { AuthStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export default function ForgotPasswordScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const emailError = validateEmail(email); if (emailError) { setError(emailError); return; }
    setBusy(true); setError("");
    try { await forgotPassword({ email: email.trim() }); navigation.replace("ResetPassword", { email: email.trim() }); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? t("mobile:auth.errors.otpSendFailed")); } finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}><AuthScreenHeader description={t("mobile:auth.copy.forgotDescription")} onBack={() => navigation.goBack()} title={t("auth:forgot.title")} />
    {error ? <AuthNotice error message={error} /> : null}<AuthField editable={!busy} icon={<Mail color={theme.muted} size={19} />} keyboardType="email-address" label={t("auth:fields.email")} onChangeText={setEmail} placeholder={t("auth:placeholders.email")} value={email} />
    <AuthButton busy={busy} onPress={() => { void submit(); }} title={t("auth:forgot.submit")} />
  </View></AuthScreenLayout>;
}
const createStyles = (_theme: Theme) => StyleSheet.create({ stack: { gap: 16 } });
