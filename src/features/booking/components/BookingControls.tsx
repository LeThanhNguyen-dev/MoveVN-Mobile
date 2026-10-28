import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";

export function BookingHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  const { theme } = useTheme();
  return <View style={styles.header}>
    {onBack ? <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={6} onPress={onBack} style={({ pressed }) => [styles.back, { backgroundColor: theme.surface, borderColor: theme.border }, pressed && styles.pressed]}><ArrowLeft color={theme.text} size={20} strokeWidth={2.2} /></Pressable> : null}
    <Text accessibilityRole="header" numberOfLines={1} style={[styles.title, { color: theme.text }]}>{title}</Text>
  </View>;
}

export function BookingButton({ title, onPress, disabled, busy, secondary, danger, regular }: {
  title: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; danger?: boolean; regular?: boolean;
}) {
  const { theme } = useTheme();
  const color = secondary ? theme.brand : danger ? theme.danger : theme.onBrand;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!busy, busy: !!busy }}
    onPress={onPress} disabled={disabled || busy}
    style={[styles.button, {
      backgroundColor: secondary ? theme.brandSoft : danger ? theme.dangerSoft : theme.brand,
      borderColor: secondary ? theme.brandBorder : danger ? theme.dangerBorder : theme.brand,
      opacity: disabled || busy ? 0.5 : 1,
    }]}>
    {busy ? <ActivityIndicator color={color} /> : null}<Text style={[styles.buttonText, regular && styles.buttonTextRegular, { color }]}>{title}</Text>
  </Pressable>;
}

export function BookingCard({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border, shadowColor: theme.shadow }]}>{children}</View>;
}

export function BookingField({ label, value, onChangeText, multiline, numeric, placeholder, editable = true }: {
  label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; numeric?: boolean; placeholder?: string; editable?: boolean;
}) {
  const { theme } = useTheme();
  return <View style={styles.field}><Text style={[styles.fieldLabel, { color: theme.faint }]}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={editable}
      multiline={multiline} keyboardType={numeric ? "number-pad" : "default"} placeholder={placeholder}
      placeholderTextColor={theme.placeholder} maxLength={numeric ? 10 : multiline ? 2000 : 500}
      style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }, multiline && styles.multiline]} />
  </View>;
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  title: { fontSize: 19, fontFamily: font.display, letterSpacing: -0.3, flex: 1 },
  pressed: { opacity: 0.72 },
  button: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontSize: 13, fontFamily: font.bold, textAlign: "center" },
  buttonTextRegular: { fontFamily: font.medium, fontSize: 12.5 },
  card: {
    padding: 16,
    borderWidth: 1,
    borderRadius: 24,
    gap: 13,
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 8.5,
    fontFamily: font.bold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 12.5,
    fontFamily: font.regular,
  },
  multiline: { minHeight: 90, textAlignVertical: "top" },
});
