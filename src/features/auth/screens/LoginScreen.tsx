import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LockKeyhole, Mail } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
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
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const emailError = validateEmail(email);
    if (emailError || !password) { setError(emailError || "Vui lòng nhập mật khẩu."); return; }
    setBusy(true); setError("");
    try { await completeSignIn(await login({ email: email.trim(), password })); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? "Đăng nhập không thành công."); }
    finally { setBusy(false); }
  };
  const google = async () => {
    setBusy(true); setError("");
    try { const result = await signInWithGoogle(); if (result) await completeSignIn(result); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? "Đăng nhập Google không thành công."); }
    finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}>
    <AuthScreenHeader description="Chào mừng bạn quay lại MoveVN!" title="Đăng nhập" />
    {route.params?.notice ? <AuthNotice message={route.params.notice} /> : null}{error ? <AuthNotice error message={error} /> : null}
    <AuthField autoComplete="email" editable={!busy} icon={<Mail color={theme.muted} size={19} />} keyboardType="email-address" label="Email" onChangeText={setEmail} placeholder="ban@email.com" value={email} />
    <AuthField autoComplete="current-password" editable={!busy} icon={<LockKeyhole color={theme.muted} size={19} />} label="Mật khẩu" onChangeText={setPassword} password placeholder="Nhập mật khẩu" value={password} />
    <View style={styles.options}><Text style={styles.remember}>Ghi nhớ đăng nhập</Text><Pressable onPress={() => navigation.navigate("ForgotPassword")}><Text style={styles.link}>Quên mật khẩu?</Text></Pressable></View>
    <AuthButton busy={busy} onPress={() => { void submit(); }} title="Đăng nhập" />
    <Pressable disabled={busy} onPress={() => { void google(); }} style={styles.google}><Text style={styles.googleMark}>G</Text><Text style={styles.googleText}>Tiếp tục với Google</Text></Pressable>
    <View style={styles.divider}><View style={styles.line} /><Text style={styles.dividerText}>hoặc</Text><View style={styles.line} /></View>
    <Pressable onPress={() => navigation.navigate("Register")}><Text style={styles.bottom}>Chưa có tài khoản? <Text style={styles.link}>Đăng ký ngay</Text></Text></Pressable>
    <Pressable onPress={() => navigation.navigate("VerifyEmail", { email, purpose: "VerifyEmail" })}><Text style={styles.mutedCenter}>Xác thực email</Text></Pressable>
  </View></AuthScreenLayout>;
}

const createStyles = (theme: Theme) => StyleSheet.create({ stack: { gap: 16 }, options: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, remember: { color: theme.muted, fontSize: 13, fontWeight: "600" }, link: { color: theme.brand, fontSize: 14, lineHeight: 21, fontWeight: "700" }, google: { minHeight: 52, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 }, googleMark: { color: "#4285F4", fontSize: 21, fontWeight: "800" }, googleText: { color: theme.text, fontSize: 15, fontWeight: "700" }, divider: { flexDirection: "row", alignItems: "center", gap: 12 }, line: { flex: 1, height: 1, backgroundColor: theme.divider }, dividerText: { color: theme.faint, fontSize: 13, fontWeight: "600" }, bottom: { color: theme.muted, textAlign: "center", fontSize: 14, lineHeight: 22, fontWeight: "500" }, linkCenter: { color: theme.brand, textAlign: "center", fontSize: 14, fontWeight: "700" }, mutedCenter: { color: theme.muted, textAlign: "center", fontSize: 14, fontWeight: "600" } });
