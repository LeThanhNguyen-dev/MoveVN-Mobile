import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";

export function BookingHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { theme } = useTheme();
  return <View style={[styles.header, { borderBottomColor: theme.border }]}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.back}><ArrowLeft color={theme.text} size={22} /></Pressable> : null}
    <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
  </View>;
}

export function BookingButton({ title, onPress, disabled, busy, secondary, danger }: {
  title: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; danger?: boolean;
}) {
  const { theme } = useTheme();
  const color = secondary ? theme.brand : theme.onBrand;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
    onPress={onPress} disabled={disabled || busy}
    style={[styles.button, { backgroundColor: secondary ? theme.brandSoft : danger ? theme.danger : theme.brand, opacity: disabled || busy ? 0.5 : 1 }]}>
    {busy ? <ActivityIndicator color={color} /> : null}<Text style={[styles.buttonText, { color }]}>{title}</Text>
  </Pressable>;
}

export function BookingCard({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>{children}</View>;
}

export function BookingField({ label, value, onChangeText, multiline, numeric, placeholder, editable = true }: {
  label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; numeric?: boolean; placeholder?: string; editable?: boolean;
}) {
  const { theme } = useTheme();
  return <View style={styles.field}><Text style={{ color: theme.text, fontWeight: "600" }}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={editable}
      multiline={multiline} keyboardType={numeric ? "number-pad" : "default"} placeholder={placeholder}
      placeholderTextColor={theme.placeholder} maxLength={numeric ? 10 : multiline ? 2000 : 500}
      style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }, multiline && { minHeight: 90, textAlignVertical: "top" }]} />
  </View>;
}

const styles = StyleSheet.create({
  header: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, title: { fontSize: 20, fontWeight: "800", flex: 1 },
  button: { minHeight: 48, borderRadius: 12, padding: 12, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  buttonText: { fontSize: 15, fontWeight: "700", textAlign: "center" }, card: { padding: 16, borderWidth: 1, borderRadius: 16, gap: 12 },
  field: { gap: 8 }, input: { minHeight: 48, borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
});
