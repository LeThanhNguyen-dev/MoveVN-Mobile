import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, type TextInputProps } from "react-native";
import { ArrowLeft, ArrowRight, Check, Eye, EyeOff, KeyRound, LogOut } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { clearSession, useAuthStore } from "../hooks/useAuth";
import * as auth from "../services/authService";
import { completeSignIn, restoreSession, signOut } from "../services/authSession";
import { googleAvailable, signInWithGoogle } from "../services/googleAuth";
import { registerOwnerOnboarding } from "@/features/owner/services/ownerService";
import { getFriendlyAuthError } from "../utils/authErrors";
import { validateAuth, validateEmail, type AuthFields, type AuthScreen, type FieldErrors } from "../utils/validation";
import type { OtpPurpose } from "../types";

const emptyFields: AuthFields = { email: "", password: "", confirmPassword: "", fullName: "", phone: "", otp: "" };
const titles: Record<AuthScreen, string> = {
  login: "Đăng nhập", register: "Tạo tài khoản", owner: "Đăng ký chủ xe",
  forgot: "Quên mật khẩu", reset: "Đặt lại mật khẩu", verify: "Xác thực email",
};

function Button({ title, onPress, disabled, busy, secondary = false }: {
  title: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => [styles.button, secondary && styles.secondary, (disabled || busy || pressed) && styles.dim]}>
    {busy ? <ActivityIndicator color={secondary ? "#13745B" : "#FFFFFF"} /> : null}
    <Text style={[styles.buttonText, secondary && styles.link]}>{title}</Text>
    {!secondary && !busy ? <ArrowRight size={18} color="#FFFFFF" /> : null}
  </Pressable>;
}

function Field({ label, error, password, ...props }: TextInputProps & { label: string; error?: string; password?: boolean }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputRow, Boolean(error) && styles.invalid]}>
      <TextInput {...props} accessibilityLabel={label} accessibilityHint={error} autoCapitalize="none" autoCorrect={false}
        secureTextEntry={password && !visible} placeholderTextColor="#858B92" style={styles.input} />
      {password ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
        disabled={props.editable === false} onPress={() => setVisible(!visible)} hitSlop={8} style={styles.icon}>
        {visible ? <EyeOff size={20} color="#606873" /> : <Eye size={20} color="#606873" />}
      </Pressable> : null}
    </View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
  </View>;
}

export default function AuthFlow() {
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
  const locked = useRef(false);
  const [terms, setTerms] = useState(false);
  const [purpose, setPurpose] = useState<OtpPurpose>("Register");
  const [resendAt, setResendAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const authenticated = Boolean(token && user && hydrated);

  async function start() {
    setStarting(true);
    setStartupError("");
    try { await restoreSession(); }
    catch { setStartupError("Chưa thể kiểm tra phiên đăng nhập. Vui lòng thử lại."); }
    finally { setStarting(false); }
  }
  useEffect(() => { void start(); }, []);
  useEffect(() => {
    setScreen("login"); setFields(emptyFields); setTerms(false); setErrors({});
  }, [authenticated]);
  useEffect(() => {
    const tick = () => setSeconds(Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
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
    try { await action(); }
    catch (failure) { setError(getFriendlyAuthError(failure) || "Yêu cầu không thành công. Vui lòng thử lại."); }
    finally { locked.current = false; setBusy(false); }
  }
  function submit() {
    const nextErrors = validateAuth(screen, fields, terms);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    void run(async () => {
      const email = fields.email.trim();
      if (screen === "login") await completeSignIn(await auth.login({ email, password: fields.password }));
      else if (screen === "register" || screen === "owner") {
        const payload = { email, fullName: fields.fullName.trim(), phone: fields.phone.trim(), password: fields.password, confirmPassword: fields.confirmPassword };
        if (screen === "owner") await registerOwnerOnboarding(payload);
        else await auth.register({ ...payload, role: "Customer" });
        setPurpose("Register"); setResendAt(Date.now() + 60000);
        navigate("verify", "Mã xác thực đã được gửi tới email của bạn.");
      } else if (screen === "forgot") {
        await auth.forgotPassword({ email });
        setResendAt(Date.now() + 60000);
        navigate("reset", "Mã OTP đã được gửi tới email của bạn.");
      } else if (screen === "reset") {
        await auth.resetPassword({ email, otp: fields.otp, newPassword: fields.password, confirmPassword: fields.confirmPassword });
        navigate("login", "Đã đặt lại mật khẩu. Bạn có thể đăng nhập.");
      } else {
        await auth.verifyOtp({ email, otp: fields.otp, purpose });
        navigate("login", "Email đã được xác thực. Bạn có thể đăng nhập.");
      }
    });
  }
  function resend() {
    if (Date.now() < resendAt) return;
    const emailError = validateEmail(fields.email);
    setErrors({ email: emailError });
    if (emailError) return;
    void run(async () => {
      await auth.resendOtp({ email: fields.email.trim(), purpose: screen === "reset" ? "ForgotPassword" : purpose });
      setResendAt(Date.now() + 60000); setMessage("Đã gửi lại mã OTP.");
    });
  }
  const registration = screen === "register" || screen === "owner";
  const showPassword = screen === "login" || registration || screen === "reset";
  const webBase = process.env.EXPO_PUBLIC_WEB_BASE_URL?.replace(/\/+$/, "");
  const field = (key: keyof AuthFields, label: string, props: TextInputProps & { password?: boolean } = {}) =>
    <Field key={`${screen}-${key}`} label={label} value={fields[key]} error={errors[key]} editable={!busy}
      onChangeText={(value) => update(key, key === "otp" ? value.replace(/\D/g, "") : value)} {...props} />;

  return <SafeAreaView style={styles.safe}>
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === "ios" ? "padding" : "height"}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.scroll}>
        <View style={styles.content}>
          <View style={styles.brand}><KeyRound size={27} color="#13745B" /><Text style={styles.brandText}>MoveVN</Text></View>
          {starting ? <View style={styles.center}><ActivityIndicator size="large" color="#13745B" /><Text style={styles.muted}>Đang kiểm tra phiên đăng nhập...</Text></View>
            : startupError || storageError ? <View style={styles.stack}>
              <Text accessibilityRole="alert" style={styles.error}>{storageError || startupError}</Text>
              <Button title="Thử lại" busy={busy} onPress={() => { void run(async () => {
                if (storageError) await clearSession();
                await start();
              }); }} />
              <Button title="Về đăng nhập" secondary busy={busy} onPress={() => { void run(async () => {
                await clearSession(); useAuthStore.setState({ isHydrated: true }); setStartupError("");
              }); }} />
            </View>
            : authenticated ? <View style={styles.stack}>
              <Check size={36} color="#13745B" />
              <Text style={styles.title}>Đăng nhập thành công</Text>
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              <Pressable accessibilityRole="button" disabled={busy} style={styles.button} onPress={() => { void run(signOut); }}>
                {busy ? <ActivityIndicator color="#FFFFFF" /> : <LogOut size={19} color="#FFFFFF" />}
                <Text style={styles.buttonText}>Đăng xuất</Text>
              </Pressable>
            </View> : <View style={styles.stack}>
              {screen !== "login" ? <Pressable accessibilityRole="button" accessibilityLabel="Quay lại đăng nhập" disabled={busy} style={styles.back} onPress={() => navigate("login")}><ArrowLeft size={22} color="#13745B" /></Pressable> : null}
              <Text style={styles.title}>{titles[screen]}</Text>
              {screen === "login" ? <Text style={styles.muted}>Chào mừng bạn quay lại MoveVN.</Text> : null}
              {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
              {message ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{message}</Text> : null}
              {registration ? field("fullName", "Họ và tên", { maxLength: 200, autoComplete: "name" }) : null}
              {field("email", "Email", { keyboardType: "email-address", autoComplete: "email", maxLength: 256, placeholder: "ban@email.com" })}
              {registration ? field("phone", "Số điện thoại", { keyboardType: "phone-pad", autoComplete: "tel", maxLength: 10 }) : null}
              {screen === "verify" || screen === "reset" ? field("otp", "Mã OTP", { keyboardType: "number-pad", maxLength: 6, autoComplete: "one-time-code" }) : null}
              {showPassword ? field("password", screen === "reset" ? "Mật khẩu mới" : "Mật khẩu", { password: true, autoComplete: screen === "login" ? "current-password" : "new-password" }) : null}
              {registration || screen === "reset" ? field("confirmPassword", "Xác nhận mật khẩu", { password: true, autoComplete: "new-password" }) : null}
              {screen === "register" ? <View>
                <View style={styles.terms}><Switch accessibilityLabel="Đồng ý chính sách bảo mật và điều khoản sử dụng" value={terms} disabled={busy} onValueChange={setTerms} trackColor={{ true: "#13745B" }} />
                  <Text style={styles.termsText}>Tôi đồng ý với chính sách bảo mật và điều khoản sử dụng.</Text></View>
                {webBase ? <View style={styles.stack}>
                  <Text accessibilityRole="link" style={styles.link} onPress={() => { void run(async () => { await Linking.openURL(`${webBase}/policies/privacy-policy`); }); }}>Chính sách bảo mật</Text>
                  <Text accessibilityRole="link" style={styles.link} onPress={() => { void run(async () => { await Linking.openURL(`${webBase}/policies/terms-of-service`); }); }}>Điều khoản sử dụng</Text>
                </View> : null}
                {errors.terms ? <Text style={styles.error}>{errors.terms}</Text> : null}
              </View> : null}
              <Button title={screen === "forgot" ? "Gửi OTP" : screen === "verify" ? "Xác thực" : titles[screen]} busy={busy} onPress={submit} />
              {screen === "verify" || screen === "reset" ? <Button title={seconds > 0 ? `Gửi lại OTP (${seconds}s)` : "Gửi lại OTP"} secondary disabled={busy || seconds > 0} onPress={resend} /> : null}
              {screen === "login" ? <>
                <Button title="Quên mật khẩu?" secondary disabled={busy} onPress={() => navigate("forgot")} />
                {googleAvailable ? <Button title="Tiếp tục với Google" secondary disabled={busy} onPress={() => { void run(async () => {
                  const result = await signInWithGoogle(); if (result) await completeSignIn(result);
                }); }} /> : null}
                <View style={styles.divider} />
                <Button title="Tạo tài khoản" secondary disabled={busy} onPress={() => navigate("register")} />
                <Button title="Đăng ký chủ xe" secondary disabled={busy} onPress={() => navigate("owner")} />
                <Pressable accessibilityRole="button" disabled={busy} onPress={() => { setPurpose("VerifyEmail"); navigate("verify"); }} style={styles.textButton}>
                  <Text style={styles.link}>Xác thực email</Text>
                </Pressable>
              </> : null}
            </View>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAFBFC" }, fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28, justifyContent: "center" },
  content: { width: "100%", maxWidth: 440, alignSelf: "center" },
  brand: { flexDirection: "row", gap: 10, alignItems: "center", marginBottom: 32 },
  brandText: { fontSize: 29, fontWeight: "800", color: "#182426" },
  stack: { gap: 16 }, title: { fontSize: 27, lineHeight: 36, fontWeight: "700", color: "#182426" },
  muted: { fontSize: 15, lineHeight: 23, color: "#626B76" },
  center: { gap: 20, alignItems: "center", paddingVertical: 48 },
  field: { gap: 7 }, label: { fontSize: 14, fontWeight: "600", color: "#303B46" },
  inputRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#CDD3DA", borderRadius: 8, backgroundColor: "#FFFFFF" },
  input: { flex: 1, minWidth: 0, minHeight: 50, fontSize: 16, paddingHorizontal: 14, paddingVertical: 12, color: "#182426" },
  icon: { width: 46, height: 48, alignItems: "center", justifyContent: "center" },
  invalid: { borderColor: "#B42338" }, error: { color: "#B42338", fontSize: 14, lineHeight: 21 },
  notice: { color: "#13745B", fontSize: 14, lineHeight: 22 },
  button: { minHeight: 50, paddingHorizontal: 16, paddingVertical: 13, borderRadius: 8, backgroundColor: "#13745B", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  secondary: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#D4DBE1" },
  buttonText: { color: "#FFFFFF", fontSize: 15, lineHeight: 22, fontWeight: "600", flexShrink: 1, textAlign: "center" },
  link: { color: "#13745B", fontSize: 14, lineHeight: 22, fontWeight: "600" }, dim: { opacity: 0.5 },
  back: { width: 44, height: 44, justifyContent: "center" },
  terms: { flexDirection: "row", alignItems: "center", gap: 10 }, termsText: { flex: 1, color: "#626B76", fontSize: 13, lineHeight: 20 },
  divider: { height: 1, backgroundColor: "#E0E4E8", marginVertical: 3 },
  textButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
