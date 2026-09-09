import { useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { ArrowRight, CheckCircle2, CircleAlert, Eye, EyeOff } from "lucide-react-native";

export function AuthButton({ title, onPress, disabled, busy, variant = "primary", icon }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean; variant?: "primary" | "outline"; icon?: ReactNode }) {
  const inactive = disabled || busy;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: inactive, busy }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.button, variant === "outline" && styles.buttonOutline, (inactive || pressed) && styles.dim]}>
    {busy ? <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : "#6B19FF"} /> : icon}
    <Text style={[styles.buttonLabel, variant === "outline" && styles.buttonLabelAlt]}>{title}</Text>
    {variant === "primary" && !busy ? <ArrowRight size={18} color="#FFFFFF" /> : null}
  </Pressable>;
}

export function AuthField({ label, error, password, icon, ...props }: TextInputProps & { label: string; error?: string; password?: boolean; icon: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputRow, Boolean(error) && styles.invalid]}>
      <View style={styles.leadingIcon}>{icon}</View>
      <TextInput {...props} accessibilityLabel={label} accessibilityHint={error} autoCapitalize="none" autoCorrect={false}
        placeholderTextColor="#8B8695" secureTextEntry={password && !visible} style={styles.input} />
      {password ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"} disabled={props.editable === false}
        hitSlop={8} onPress={() => setVisible((current) => !current)} style={styles.trailingIcon}>
        {visible ? <EyeOff size={19} color="#746F7E" /> : <Eye size={19} color="#746F7E" />}
      </Pressable> : null}
    </View>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

export function OtpField({ value, error, disabled, onChange }: { value: string; error?: string; disabled?: boolean; onChange: (value: string) => void }) {
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
  return <View style={[styles.notice, error && styles.noticeError]}>
    {error ? <CircleAlert size={18} color="#B4235A" /> : <CheckCircle2 size={18} color="#6B19FF" />}
    <Text accessibilityRole={error ? "alert" : undefined} style={[styles.noticeText, error && styles.noticeErrorText]}>{message}</Text>
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 7 }, label: { color: "#343042", fontSize: 14, fontWeight: "700" },
  inputRow: { minHeight: 52, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E2DDEA", borderRadius: 12, backgroundColor: "#FFFFFF" },
  invalid: { borderColor: "#C62C66" },
  leadingIcon: { width: 47, alignItems: "center", justifyContent: "center" }, trailingIcon: { width: 46, height: 50, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, minWidth: 0, minHeight: 51, color: "#101936", fontSize: 16, paddingRight: 10, paddingVertical: 12 }, error: { color: "#B4235A", fontSize: 13, lineHeight: 19, fontWeight: "500" },
  notice: { flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1, borderColor: "#DDCCFA", borderRadius: 12, backgroundColor: "#F7F1FF", paddingHorizontal: 13, paddingVertical: 12 }, noticeError: { backgroundColor: "#FFF2F6", borderColor: "#F5C4D7" }, noticeText: { flex: 1, color: "#5215A2", fontSize: 13, lineHeight: 20, fontWeight: "600" }, noticeErrorText: { color: "#A51E50" },
  button: { minHeight: 52, borderRadius: 12, backgroundColor: "#6B19FF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9, paddingHorizontal: 18, shadowColor: "#6B19FF", shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 }, buttonOutline: { backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDD4EA", shadowOpacity: 0, elevation: 0 }, buttonLabel: { color: "#FFFFFF", fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" }, buttonLabelAlt: { color: "#6B19FF" }, dim: { opacity: 0.52 },
  otpRow: { flexDirection: "row", justifyContent: "space-between", gap: 7, position: "relative" }, otpCell: { flex: 1, height: 52, borderWidth: 1, borderColor: "#E2DDEA", borderRadius: 12, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center" }, otpFilled: { borderColor: "#B996FF", backgroundColor: "#FCFAFF" }, otpInvalid: { borderColor: "#C62C66" }, otpText: { color: "#101936", fontSize: 20, lineHeight: 24, fontWeight: "800" }, otpNativeInput: { position: "absolute", width: "100%", height: "100%", opacity: 0.01, color: "transparent" },
});
