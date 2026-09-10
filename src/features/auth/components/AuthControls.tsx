import { useMemo, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { ArrowRight, CheckCircle2, CircleAlert, Eye, EyeOff } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";

export function AuthButton({ title, onPress, disabled, busy, variant = "primary", icon }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean; variant?: "primary" | "outline"; icon?: ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const inactive = disabled || busy;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: inactive, busy }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.button, variant === "outline" && styles.buttonOutline, (inactive || pressed) && styles.dim]}>
    {busy ? <ActivityIndicator color={variant === "primary" ? theme.surface : theme.brand} /> : icon}
    <Text style={[styles.buttonLabel, variant === "outline" && styles.buttonLabelAlt]}>{title}</Text>
    {variant === "primary" && !busy ? <ArrowRight size={18} color={theme.surface} /> : null}
  </Pressable>;
}

export function AuthField({ label, error, password, icon, ...props }: TextInputProps & { label: string; error?: string; password?: boolean; icon: ReactNode }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputRow, Boolean(error) && styles.invalid]}>
      <View style={styles.leadingIcon}>{icon}</View>
      <TextInput {...props} accessibilityLabel={label} accessibilityHint={error} autoCapitalize="none" autoCorrect={false}
        placeholderTextColor={theme.placeholder} secureTextEntry={password && !visible} style={styles.input} />
      {password ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} disabled={props.editable === false}
        hitSlop={8} onPress={() => setVisible((current) => !current)} style={styles.trailingIcon}>
        {visible ? <EyeOff size={19} color={theme.muted} /> : <Eye size={19} color={theme.muted} />}
      </Pressable> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

export function OtpField({ value, error, disabled, onChange }: { value: string; error?: string; disabled?: boolean; onChange: (value: string) => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const input = useRef<TextInput>(null);
  return <View style={styles.field}>
    <Text style={styles.label}>Mã OTP</Text>
    <Pressable accessibilityRole="button" accessibilityLabel="Nhập mã OTP" disabled={disabled} onPress={() => input.current?.focus()} style={styles.otpRow}>
      {Array.from({ length: 6 }, (_, index) => <View key={index} style={[styles.otpCell, Boolean(error) && styles.otpInvalid, value[index] ? styles.otpFilled : null]}><Text style={styles.otpText}>{value[index] ?? ""}</Text></View>)}
      <TextInput ref={input} accessibilityLabel="Mã OTP" accessibilityHint={error} editable={!disabled} keyboardType="number-pad" maxLength={6}
        onChangeText={(next) => onChange(next.replace(/\D/g, ""))} style={styles.otpNativeInput} textContentType="oneTimeCode" value={value} />
    </Pressable>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

export function AuthNotice({ message, error = false }: { message: string; error?: boolean }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  return <View style={[styles.notice, error && styles.noticeError]}>
    {error ? <CircleAlert size={18} color={theme.error} /> : <CheckCircle2 size={18} color={theme.brand} />}
    <Text accessibilityRole={error ? "alert" : undefined} style={[styles.noticeText, error && styles.noticeErrorText]}>{message}</Text>
  </View>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  field: { gap: 7 }, label: { color: theme.text, fontSize: 14, fontWeight: "700" },
  inputRow: { minHeight: 52, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface },
  invalid: { borderColor: theme.error },
  leadingIcon: { width: 47, alignItems: "center", justifyContent: "center" }, trailingIcon: { width: 46, height: 50, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 51, color: theme.text, fontSize: 16, paddingRight: 10, paddingVertical: 12 }, error: { color: theme.error, fontSize: 13, lineHeight: 19, fontWeight: "500" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: theme.infoBorder, borderRadius: 12, backgroundColor: theme.infoSoft, paddingHorizontal: 13, paddingVertical: 12 }, noticeError: { backgroundColor: theme.errorSoft, borderColor: theme.errorBorder }, noticeText: { flex: 1, color: theme.info, fontSize: 13, lineHeight: 20, fontWeight: "600" }, noticeErrorText: { color: theme.error },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: theme.brand, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 18, shadowColor: theme.brand, shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, buttonOutline: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, shadowOpacity: 0, elevation: 0 }, buttonLabel: { color: theme.surface, fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" }, buttonLabelAlt: { color: theme.brand }, dim: { opacity: 0.52 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 7, position: "relative" }, otpCell: { flex: 1, height: 52, borderWidth: 1, borderColor: theme.border, borderRadius: 12, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }, otpFilled: { borderColor: theme.brand, backgroundColor: theme.brandSoft }, otpInvalid: { borderColor: theme.error }, otpText: { color: theme.text, fontSize: 20, lineHeight: 24, fontWeight: "800" }, otpNativeInput: { position: "absolute", width: "100%", height: "100%", opacity: 0.01, color: "transparent" },
});
