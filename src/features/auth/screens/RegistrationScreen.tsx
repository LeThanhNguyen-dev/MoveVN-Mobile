import { useState } from "react";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { LockKeyhole, Mail, Phone, ShieldCheck, UserRound } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AuthButton, AuthField, AuthNotice } from "../components/AuthControls";
import { AuthScreenHeader } from "../components/AuthScreenHeader";
import { AuthScreenLayout } from "../components/AuthScreenLayout";
import { register } from "../services/authService";
import { registerOwnerOnboarding } from "@/features/owner/services/ownerService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateAuth, type AuthFields } from "../utils/validation";
import type { AuthStackParamList } from "@/navigation/types";

type Props = NativeStackScreenProps<AuthStackParamList, "Register" | "OwnerRegister">;

export default function RegistrationScreen({ navigation, route }: Props) {
  const isOwner = route.name === "OwnerRegister";
  const [fields, setFields] = useState<AuthFields>({ email: "", password: "", confirmPassword: "", fullName: "", phone: "", otp: "" });
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key: keyof AuthFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const submit = async () => {
    const errors = validateAuth(isOwner ? "owner" : "register", fields, accepted);
    if (Object.keys(errors).length) { setError(Object.values(errors)[0] ?? "Dữ liệu chưa hợp lệ."); return; }
    setBusy(true); setError("");
    const payload = { email: fields.email.trim(), fullName: fields.fullName.trim(), phone: fields.phone.trim(), password: fields.password, confirmPassword: fields.confirmPassword };
    try {
      if (isOwner) await registerOwnerOnboarding(payload); else await register({ ...payload, role: "Customer" });
      navigation.replace("VerifyEmail", { email: payload.email, purpose: "Register" });
    } catch (failure) { setError(getFriendlyAuthError(failure) ?? "Đăng ký không thành công."); } finally { setBusy(false); }
  };
  return <AuthScreenLayout><View style={styles.stack}>
    <AuthScreenHeader description={isOwner ? "Chia sẻ chiếc xe của bạn với cộng đồng MoveVN." : "Bắt đầu hành trình cùng MoveVN."} onBack={() => navigation.goBack()} title={isOwner ? "Đăng ký chủ xe" : "Tạo tài khoản"} />
    {error ? <AuthNotice error message={error} /> : null}
    <AuthField editable={!busy} icon={<UserRound color="#746F7E" size={19} />} label="Họ và tên" maxLength={200} onChangeText={(value) => update("fullName", value)} placeholder="Nguyễn Văn A" value={fields.fullName} />
    <AuthField editable={!busy} icon={<Mail color="#746F7E" size={19} />} keyboardType="email-address" label="Email" onChangeText={(value) => update("email", value)} placeholder="ban@email.com" value={fields.email} />
    <AuthField editable={!busy} icon={<Phone color="#746F7E" size={19} />} keyboardType="phone-pad" label="Số điện thoại" maxLength={10} onChangeText={(value) => update("phone", value)} placeholder="0912345678" value={fields.phone} />
    <AuthField editable={!busy} icon={<LockKeyhole color="#746F7E" size={19} />} label="Mật khẩu" onChangeText={(value) => update("password", value)} password value={fields.password} />
    <AuthField editable={!busy} icon={<ShieldCheck color="#746F7E" size={19} />} label="Xác nhận mật khẩu" onChangeText={(value) => update("confirmPassword", value)} password value={fields.confirmPassword} />
    {!isOwner ? <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={() => setAccepted((value) => !value)} style={styles.terms}><View style={[styles.box, accepted && styles.boxSelected]}><Text style={styles.check}>{accepted ? "✓" : ""}</Text></View><Text style={styles.termsText}>Tôi đồng ý với chính sách bảo mật và điều khoản sử dụng.</Text></Pressable> : null}
    <AuthButton busy={busy} onPress={() => { void submit(); }} title={isOwner ? "Đăng ký chủ xe" : "Tạo tài khoản"} />
    <Pressable onPress={() => navigation.navigate("Login")}><Text style={styles.login}>Đã có tài khoản? <Text style={styles.link}>Đăng nhập</Text></Text></Pressable>
  </View></AuthScreenLayout>;
}

const styles = StyleSheet.create({ stack: { gap: 16 }, terms: { flexDirection: "row", alignItems: "flex-start", gap: 9 }, box: { width: 19, height: 19, borderRadius: 5, borderWidth: 1, borderColor: "#CFC5DD", alignItems: "center", justifyContent: "center" }, boxSelected: { borderColor: "#6B19FF", backgroundColor: "#6B19FF" }, check: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, termsText: { flex: 1, color: "#625B6B", fontSize: 13, lineHeight: 20 }, login: { color: "#625B6B", textAlign: "center", fontSize: 14 }, link: { color: "#6B19FF", fontWeight: "700" } });
