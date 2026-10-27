import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import AppText from "@/components/AppText";
import AppButton from "@/components/ui/AppButton";
import AppInput from "@/components/ui/AppInput";
import AppScreenHeader from "@/components/ui/AppScreenHeader";
import { AppCard } from "@/components/ui/AppSurface";

export function BookingHeader({ title, onBack }: { title: string; onBack?: () => void }) {
  return <AppScreenHeader title={title} onBack={onBack} />;
}

export function BookingButton({ title, onPress, disabled, busy, secondary, danger }: {
  title: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; danger?: boolean;
}) {
  return <AppButton title={title} onPress={onPress} disabled={disabled} busy={busy} variant={danger ? "danger" : secondary ? "secondary" : "primary"} />;
}

export function BookingCard({ children }: { children: ReactNode }) {
  return <AppCard>{children}</AppCard>;
}

export function BookingField({ label, value, onChangeText, multiline, numeric, placeholder, editable = true }: {
  label: string; value: string; onChangeText: (value: string) => void; multiline?: boolean; numeric?: boolean; placeholder?: string; editable?: boolean;
}) {
  const { theme } = useTheme();
  return <View style={styles.field}><AppText style={{ color: theme.text, fontWeight: "600" }}>{label}</AppText>
    <AppInput accessibilityLabel={label} value={value} onChangeText={onChangeText} editable={editable}
      multiline={multiline} keyboardType={numeric ? "number-pad" : "default"} placeholder={placeholder}
      maxLength={numeric ? 10 : multiline ? 2000 : 500}
      style={multiline && { minHeight: 110, textAlignVertical: "top" }} />
  </View>;
}

const styles = StyleSheet.create({
  field: { gap: 8 },
});
