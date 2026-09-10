import { useMemo, useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LockKeyhole, ShieldCheck } from "lucide-react-native";
import { StyleSheet, View } from "react-native";
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
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [otp, setOtp] = useState(""); const [password, setPassword] = useState(""); const [confirmPassword, setConfirmPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async () => {
    const errors = validateAuth("reset", { email: route.params.email, otp, password, confirmPassword, fullName: "", phone: "" }, false);
    if (Object.keys(errors).length) { setError(Object.values(errors)[0] ?? "Dữ liệu chưa hợp lệ."); return; }
    setBusy(true); setError("");
    try { await resetPassword({ email: route.params.email, otp, newPassword: password, confirmPassword }); navigation.replace("Login", { notice: "Đã đặt lại mật khẩu. Bạn có thể đăng nhập." }); }
    catch (failure) { setError(getFriendlyAuthError(failure) ?? "Không thể đặt lại mật khẩu."); } finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}><AuthScreenHeader description="Nhập OTP và mật khẩu mới cho tài khoản MoveVN." onBack={() => navigation.goBack()} title="Đặt lại mật khẩu" />
    {error ? <AuthNotice error message={error} /> : null}<OtpField disabled={busy} error={undefined} onChange={setOtp} value={otp} />
    <AuthField editable={!busy} icon={<LockKeyhole color={theme.muted} size={19} />} label="Mật khẩu mới" onChangeText={setPassword} password value={password} />
    <AuthField editable={!busy} icon={<ShieldCheck color={theme.muted} size={19} />} label="Xác nhận mật khẩu mới" onChangeText={setConfirmPassword} password value={confirmPassword} />
    <AuthButton busy={busy} onPress={() => { void submit(); }} title="Đặt lại mật khẩu" />
  </View></AuthScreenLayout>;
}
const createStyles = (_theme: Theme) => StyleSheet.create({ stack: { gap: 16 } });
