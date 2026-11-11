import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LockKeyhole, Mail } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native"
import { useTranslation } from "react-i18next";
import AppText from "@/components/AppText";
import { AuthButton, AuthField, AuthNotice } from "../components/AuthControls";
import { AuthScreenHeader } from "../components/AuthScreenHeader";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { completeSignIn } from "../services/authSession";
import { signInWithGoogle } from "../services/googleAuth";
import { login } from "../services/authService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateEmail } from "../utils/validation";
import type { AuthStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export default function LoginScreen({ navigation, route }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const emailError = validateEmail(email);
    if (emailError || !password) { setError(emailError || t("auth:login.passwordRequired")); return; }
    setBusy(true); setError("");
    try { await completeSignIn(await login({ email: email.trim(), password })); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? t("mobile:auth.errors.loginFailed")); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError("");
    try { const result = await signInWithGoogle(); if (result) await completeSignIn(result); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? t("mobile:auth.errors.googleLoginFailed")); }
    finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}>
    <AuthScreenHeader description={t("auth:login.description")} title={t("auth:login.title")} />
    {route.params?.notice ? <AuthNotice message={route.params.notice} /> : null}{error ? <AuthNotice error message={error} /> : null}
    <AuthField autoComplete="email" editable={!busy} icon={<Mail color={theme.muted} size={19} />} keyboardType="email-address" label={t("auth:fields.email")} onChangeText={setEmail} placeholder={t("auth:placeholders.email")} value={email} />
    <AuthField autoComplete="current-password" editable={!busy} icon={<LockKeyhole color={theme.muted} size={19} />} label={t("auth:fields.password")} onChangeText={setPassword} password placeholder={t("auth:placeholders.password")} value={password} />
    <View style={styles.options}><AppText style={styles.remember}>{t("auth:login.rememberMe")}</AppText><Pressable onPress={() => navigation.navigate("ForgotPassword")}><AppText style={styles.link}>{t("auth:login.forgotPassword")}</AppText></Pressable></View>
    <AuthButton busy={busy} onPress={() => { void submit(); }} title={t("auth:login.submit")} />
    <Pressable disabled={busy} onPress={() => { void google(); }} style={styles.google}><AppText style={styles.googleMark}>G</AppText><AppText style={styles.googleText}>{t("mobile:auth.flow.continueWithGoogle")}</AppText></Pressable>
    <View style={styles.divider}><View style={styles.line} /><AppText style={styles.dividerText}>{t("mobile:auth.flow.or")}</AppText><View style={styles.line} /></View>
    <Pressable onPress={() => navigation.navigate("Register")}><AppText style={styles.bottom}>{t("auth:login.noAccount")} <AppText style={styles.link}>{t("auth:login.registerNow")}</AppText></AppText></Pressable>
    <Pressable onPress={() => navigation.navigate("VerifyEmail", { email, purpose: "VerifyEmail" })}><AppText style={styles.mutedCenter}>{t("auth:verify.title")}</AppText></Pressable>
  </View></AuthScreenLayout>;
}

const createStyles = (theme: Theme) => StyleSheet.create({ stack: { gap: 16 }, options: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, remember: { color: theme.muted, fontSize: 13, fontWeight: "600" }, link: { color: theme.brand, fontSize: 14, lineHeight: 21, fontWeight: "700" }, google: { minHeight: 52, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, googleMark: { color: "#4285F4", fontSize: 21, fontWeight: "800" }, googleText: { color: theme.text, fontSize: 15, fontWeight: "700" }, divider: { flexDirection: "row", alignItems: "center", gap: 12 }, line: { flex: 1, height: 1, backgroundColor: theme.divider }, dividerText: { color: theme.faint, fontSize: 13, fontWeight: "600" }, bottom: { color: theme.muted, textAlign: "center", fontSize: 14, lineHeight: 22, fontWeight: "500" }, linkCenter: { color: theme.brand, textAlign: "center", fontSize: 14, fontWeight: "700" }, mutedCenter: { color: theme.muted, textAlign: "center", fontSize: 14, fontWeight: "600" } });
