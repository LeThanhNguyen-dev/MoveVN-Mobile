import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, type TextInputProps } from "react-native";
import { ArrowLeft, Check, LockKeyhole, LogOut, Mail, Phone, RotateCcw, ShieldCheck, UserRound } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearSession, useAuthStore } from "../hooks/useAuth";
import * as auth from "../services/authService";
import { completeSignIn, restoreSession, signOut } from "../services/authSession";
import { signInWithGoogle } from "../services/googleAuth";
import { registerOwnerOnboarding } from "@/features/owner/services/ownerService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateAuth, validateEmail, type AuthFields, type AuthScreen, type FieldErrors } from "../utils/validation";
import type { OtpPurpose } from "../types";
import { AuthButton, AuthField, AuthNotice, OtpField } from "@/features/auth/components/AuthControls";
import { AuthLayout } from "@/features/auth/components/AuthLayout";
import { authCopy } from "@/features/auth/components/authCopy";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

const emptyFields: AuthFields = { email: "", password: "", confirmPassword: "", fullName: "", phone: "", otp: "" };

export default function AuthFlow() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.isHydrated);
  const storageError = useAuthStore((state) => state.storageError);
  const [startupError, setStartupError] = useState("");
  const [starting, setStarting] = useState(true);
  const [screen, setScreen] = useState<AuthScreen>("login");
  const [fields, setFields] = useState<AuthFields>(emptyFields);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [terms, setTerms] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [purpose, setPurpose] = useState<OtpPurpose>("Register");
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const locked = useRef(false);
  const authenticated = Boolean(token && user && hydrated);
  const registration = screen === "register" || screen === "owner";
  const showPassword = screen === "login" || registration || screen === "reset";
  const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/+$/, "");

  async function start() {
    setStarting(true); setStartupError("");
    try { await restoreSession(); } catch { setStartupError("Chưa thể kiểm tra phiên đăng nhập. Vui lòng thử lại."); } finally { setStarting(false); }
  }
  useEffect(() => { void start(); }, []);
  useEffect(() => { setScreen("login"); setFields(emptyFields); setTerms(false); setErrors({}); }, [authenticated]);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [resendAt]);
  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (locked.current) return true;
      if (!authenticated && screen !== "login") { navigate("login"); return true; }
      return false;
    });
    return () => subscription.remove();
  }, [authenticated, screen]);

  function navigate(next: AuthScreen, notice = "") {
    setScreen(next); setErrors({}); setError(""); setMessage(notice); setTerms(false);
    setFields((current) => ({ ...emptyFields, email: current.email }));
  }
  function update(key: keyof AuthFields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }
  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); } catch (failure) { setError(getFriendlyAuthError(failure) || "Yêu cầu không thành công. Vui lòng thử lại."); } finally { locked.current = false; setBusy(false); }
  }
  function submit() {
    const nextErrors = validateAuth(screen, fields, terms);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void run(async () => {
      const email = fields.email.trim();
      if (screen === "login") await completeSignIn(await auth.login({ email, password: fields.password }));
      else if (registration) {
        const payload = { email, fullName: fields.fullName.trim(), phone: fields.phone.trim(), password: fields.password, confirmPassword: fields.confirmPassword };
        if (screen === "owner") await registerOwnerOnboarding(payload); else await auth.register({ ...payload, role: "Customer" });
        setPurpose("Register"); setResendAt(Date.now() + 60000); navigate("verify", "Mã xác thực đã được gửi tới email của bạn.");
      } else if (screen === "forgot") {
        await auth.forgotPassword({ email }); setResendAt(Date.now() + 60000); navigate("reset", "Mã OTP đã được gửi tới email của bạn.");
      } else if (screen === "reset") {
        await auth.resetPassword({ email, otp: fields.otp, newPassword: fields.password, confirmPassword: fields.confirmPassword }); navigate("login", "Đã đặt lại mật khẩu. Bạn có thể đăng nhập.");
      } else {
        await auth.verifyOtp({ email, otp: fields.otp, purpose }); navigate("login", "Email đã được xác thực. Bạn có thể đăng nhập.");
      }
    });
  }
  function resend() {
    if (Date.now() < resendAt) return;
    const emailError = validateEmail(fields.email); setErrors({ email: emailError });
    if (emailError) return;
    void run(async () => {
      await auth.resendOtp({ email: fields.email.trim(), purpose: screen === "reset" ? "ForgotPassword" : purpose });
      setResendAt(Date.now() + 60000); setMessage("Đã gửi lại mã OTP. Vui lòng kiểm tra hộp thư của bạn.");
    });
  }
  function field(key: keyof AuthFields, label: string, icon: ReactNode, props: TextInputProps & { password?: boolean } = {}) {
    return <AuthField key={`${screen}-${key}`} editable={!busy} error={errors[key]} icon={icon} label={label} onChangeText={(value) => update(key, value)} value={fields[key]} {...props} />;
  }

  const heading = authCopy[screen];
  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.fill}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <AuthLayout>
          {starting ? <View style={styles.center}><ActivityIndicator color={theme.brand} size="large" /><Text style={styles.muted}>Đang kiểm tra phiên đăng nhập...</Text></View>
            : startupError || storageError ? <View style={styles.stack}>
              <AuthNotice error message={storageError || startupError} />
              <AuthButton busy={busy} icon={<RotateCcw size={18} color={theme.surface} />} onPress={() => { void run(async () => { if (storageError) await clearSession(); await start(); }); }} title="Thử lại" />
              <AuthButton busy={busy} onPress={() => { void run(async () => { await clearSession(); useAuthStore.setState({ isHydrated: true }); setStartupError(""); }); }} title="Về đăng nhập" variant="outline" />
            </View>
            : authenticated ? <View style={[styles.stack, styles.success]}>
              <View style={styles.successIcon}><Check size={30} color={theme.surface} /></View><Text style={styles.title}>Đăng nhập thành công</Text><Text style={[styles.muted, styles.centeredText]}>Chào mừng bạn trở lại với MoveVN.</Text>
              {error ? <AuthNotice error message={error} /> : null}<AuthButton busy={busy} icon={<LogOut size={18} color={theme.surface} />} onPress={() => { void run(signOut); }} title="Đăng xuất" />
            </View>
            : <View style={styles.stack}>
              {screen !== "login" ? <Pressable accessibilityLabel="Quay lại đăng nhập" accessibilityRole="button" disabled={busy} onPress={() => navigate("login")} style={styles.back}><ArrowLeft color={theme.brand} size={21} /></Pressable> : null}
              <View style={styles.heading}><Text style={styles.title}>{heading.title}</Text><Text style={styles.muted}>{heading.description}</Text></View>
              {error ? <AuthNotice error message={error} /> : null}{message ? <AuthNotice message={message} /> : null}
              {registration ? field("fullName", "Họ và tên", <UserRound size={19} color={theme.muted} />, { autoComplete: "name", maxLength: 200, placeholder: "Nguyễn Văn A" }) : null}
              {field("email", "Email", <Mail size={19} color={theme.muted} />, { autoComplete: "email", keyboardType: "email-address", maxLength: 256, placeholder: "ban@email.com" })}
              {registration ? field("phone", "Số điện thoại", <Phone size={19} color={theme.muted} />, { autoComplete: "tel", keyboardType: "phone-pad", maxLength: 10, placeholder: "0912345678" }) : null}
              {screen === "verify" || screen === "reset" ? <OtpField disabled={busy} error={errors.otp} onChange={(value) => update("otp", value)} value={fields.otp} /> : null}
              {showPassword ? field("password", screen === "reset" ? "Mật khẩu mới" : "Mật khẩu", <LockKeyhole size={19} color={theme.muted} />, { autoComplete: screen === "login" ? "current-password" : "new-password", password: true, placeholder: "Nhập mật khẩu" }) : null}
              {registration || screen === "reset" ? field("confirmPassword", screen === "reset" ? "Xác nhận mật khẩu mới" : "Xác nhận mật khẩu", <ShieldCheck size={19} color={theme.muted} />, { autoComplete: "new-password", password: true, placeholder: "Nhập lại mật khẩu" }) : null}
              {screen === "login" ? <LoginOptions busy={busy} rememberMe={rememberMe} onForgot={() => navigate("forgot")} onRemember={() => setRememberMe((current) => !current)} /> : null}
              {screen === "register" ? <Terms accepted={terms} error={errors.terms} onToggle={() => setTerms((current) => !current)} webBase={webBase} /> : null}
              <AuthButton busy={busy} onPress={submit} title={heading.action} />
              {screen === "verify" || screen === "reset" ? <AuthButton busy={busy} disabled={seconds > 0} onPress={resend} title={seconds > 0 ? `Gửi lại OTP (${seconds}s)` : "Gửi lại OTP"} variant="outline" /> : null}
              {screen === "login" ? <LoginFooter busy={busy} onGoogle={() => { void run(async () => { const result = await signInWithGoogle(); if (result) await completeSignIn(result); }); }} onRegister={() => navigate("register")} onVerify={() => { setPurpose("VerifyEmail"); navigate("verify"); }} />
                : <Text style={styles.bottomText}>Đã có tài khoản? <Text onPress={() => navigate("login")} style={styles.link}>Đăng nhập</Text></Text>}
            </View>}
        </AuthLayout>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

function LoginOptions({ busy, rememberMe, onForgot, onRemember }: { busy: boolean; rememberMe: boolean; onForgot: () => void; onRemember: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.loginOptions}>
    <Pressable accessibilityLabel="Ghi nhớ đăng nhập" accessibilityRole="checkbox" accessibilityState={{ checked: rememberMe }} disabled={busy} onPress={onRemember} style={styles.remember}><View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>{rememberMe ? <Check size={13} color={theme.surface} /> : null}</View><Text style={styles.rememberText}>Ghi nhớ đăng nhập</Text></Pressable>
    <Pressable accessibilityLabel="open-forgot-password" accessibilityRole="button" disabled={busy} onPress={onForgot}><Text style={styles.link}>Quên mật khẩu?</Text></Pressable>
  </View>;
}

function Terms({ accepted, error, onToggle, webBase }: { accepted: boolean; error?: string; onToggle: () => void; webBase?: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={styles.termsBlock}>
    <Pressable accessibilityLabel="Đồng ý chính sách bảo mật và điều khoản sử dụng" accessibilityRole="checkbox" accessibilityState={{ checked: accepted }} onPress={onToggle} style={styles.terms}><View style={[styles.checkbox, styles.termsCheckbox, accepted && styles.checkboxChecked]}>{accepted ? <Check size={13} color={theme.surface} /> : null}</View><Text style={styles.termsText}>Tôi đồng ý với chính sách bảo mật và điều khoản sử dụng.</Text></Pressable>
    {webBase ? <View style={styles.policyLinks}><Pressable onPress={() => { void Linking.openURL(`${webBase}/policies/privacy-policy`); }}><Text style={styles.link}>Chính sách bảo mật</Text></Pressable><Text style={styles.policyDot}>•</Text><Pressable onPress={() => { void Linking.openURL(`${webBase}/policies/terms-of-service`); }}><Text style={styles.link}>Điều khoản sử dụng</Text></Pressable></View> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

function LoginFooter({ busy, onGoogle, onRegister, onVerify }: { busy: boolean; onGoogle: () => void; onRegister: () => void; onVerify: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onGoogle} style={({ pressed }) => [styles.googleButton, (busy || pressed) && styles.dim]}><Text style={styles.googleMark}>G</Text><Text style={styles.googleText}>Tiếp tục với Google</Text></Pressable>
    <View style={styles.divider}><View style={styles.dividerLine} /><Text style={styles.dividerText}>hoặc</Text><View style={styles.dividerLine} /></View>
    <Pressable accessibilityLabel="open-register" accessibilityRole="button" disabled={busy} onPress={onRegister}><Text style={styles.bottomText}>Chưa có tài khoản? <Text style={styles.link}>Đăng ký ngay</Text></Text></Pressable>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onVerify} style={styles.textAction}><Text style={styles.mutedLink}>Xác thực email</Text></Pressable>
  </>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background }, fill: { flex: 1 }, scroll: { flexGrow: 1 }, stack: { gap: 16 }, heading: { gap: 7, marginBottom: 3 }, title: { color: theme.text, fontSize: 30, lineHeight: 38, fontWeight: "800" }, muted: { color: theme.muted, fontSize: 15, lineHeight: 23, fontWeight: "500" }, centeredText: { textAlign: "center" }, center: { gap: 18, alignItems: "center", paddingVertical: 54 },
  back: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", marginBottom: 2 }, loginOptions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginTop: -2 }, remember: { flexDirection: "row", alignItems: "center", gap: 8 }, checkbox: { width: 19, height: 19, borderWidth: 1, borderColor: theme.border, borderRadius: 5, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }, checkboxChecked: { borderColor: theme.brand, backgroundColor: theme.brand }, rememberText: { color: theme.muted, fontSize: 13, fontWeight: "600" }, link: { color: theme.brand, fontSize: 14, lineHeight: 21, fontWeight: "700" }, mutedLink: { color: theme.muted, fontSize: 14, lineHeight: 21, fontWeight: "600" },
  termsBlock: { gap: 8 }, terms: { flexDirection: "row", alignItems: "flex-start", gap: 9 }, termsCheckbox: { marginTop: 1, flexShrink: 0 }, termsText: { flex: 1, color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" }, policyLinks: { flexDirection: "row", alignItems: "center", gap: 8, marginLeft: 28 }, policyDot: { color: theme.faint, fontSize: 12 }, error: { color: theme.error, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  googleButton: { minHeight: 52, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 10 }, googleMark: { color: "#4285F4", fontSize: 21, lineHeight: 25, fontWeight: "800" }, googleText: { color: theme.text, fontSize: 15, fontWeight: "700" }, divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 2 }, dividerLine: { height: 1, flex: 1, backgroundColor: theme.divider }, dividerText: { color: theme.faint, fontSize: 13, fontWeight: "600" }, bottomText: { color: theme.muted, textAlign: "center", fontSize: 14, lineHeight: 22, fontWeight: "500" }, textAction: { alignItems: "center", paddingVertical: 2 }, dim: { opacity: 0.52 }, success: { alignItems: "center", paddingVertical: 24 }, successIcon: { width: 60, height: 60, borderRadius: 30, backgroundColor: theme.brand, alignItems: "center", justifyContent: "center", marginBottom: 4 },
});
