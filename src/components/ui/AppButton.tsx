import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import AppText from "@/components/AppText";
import { radius, size, typeScale } from "@/theme/layout";
import { useTheme } from "@/theme/useTheme";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "danger";
  icon?: ReactNode;
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
};

export default function AppButton({ title, onPress, variant = "primary", icon, disabled, busy, style }: Props) {
  const { theme } = useTheme();
  const inactive = Boolean(disabled || busy);
  const color = variant === "primary" ? "#FFFFFF" : variant === "danger" ? theme.danger : theme.brand;
  const backgroundColor = variant === "primary" ? theme.brandSolid : variant === "danger" ? theme.dangerSoft : theme.brandSoft;
  return <Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityState={{ disabled: inactive, busy: Boolean(busy) }} disabled={inactive} onPress={onPress}
    style={({ pressed }) => [styles.button, { backgroundColor, borderColor: variant === "secondary" ? theme.brandBorder : "transparent" }, style, (inactive || pressed) && { opacity: inactive ? 0.45 : 0.8 }]}>
    {busy ? <ActivityIndicator color={color} /> : icon}
    <AppText style={[styles.text, { color }]}>{title}</AppText>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: size.control, borderRadius: radius.control, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  text: { ...typeScale.body, fontWeight: "700", textAlign: "center", flexShrink: 1 },
});
