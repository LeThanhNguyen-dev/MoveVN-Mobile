import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Mail } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
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
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [email, setEmail] = useState(route.params.email); const [otp, setOtp] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [notice, setNotice] = useState("");
  const submit = async () => {
    const emailError = validateEmail(email);
    if (emailError || !/^\d{6}$/.test(otp)) { setError(emailError || "Mã OTP phải gồm đúng 6 chữ số."); return; }
    setBusy(true); setError("");
    try { await verifyOtp({ email: email.trim(), otp, purpose: route.params.purpose }); navigation.replace("Login", { notice: "Email đã được xác thực. Bạn có thể đăng nhập." }); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? "Không thể xác thực email."); } finally { setBusy(false); }
  };
  const resend = async () => {
    const emailError = validateEmail(email); if (emailError) { setError(emailError); return; }
    setBusy(true); setError("");
    try { await resendOtp({ email: email.trim(), purpose: route.params.purpose }); setNotice("Đã gửi lại OTP. Vui lòng kiểm tra email của bạn."); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? "Không thể gửi lại OTP."); } finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}><AuthScreenHeader description="Nhập email và mã gồm 6 chữ số MoveVN đã gửi tới bạn." onBack={() => navigation.goBack()} title="Xác thực email" />
    {error ? <AuthNotice error message={error} /> : null}{notice ? <AuthNotice message={notice} /> : null}<AuthField editable={!busy} icon={<Mail color={theme.muted} size={19} />} keyboardType="email-address" label="Email" onChangeText={setEmail} value={email} /><OtpField disabled={busy} onChange={setOtp} value={otp} />
    <AuthButton busy={busy} onPress={() => { void submit(); }} title="Xác thực" /><AuthButton busy={busy} onPress={() => { void resend(); }} title="Gửi lại OTP" variant="outline" />
  </View></AuthScreenLayout>;
}
const createStyles = (_theme: Theme) => StyleSheet.create({ stack: { gap: 16 } });
