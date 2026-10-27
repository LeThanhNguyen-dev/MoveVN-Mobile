import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { ArrowLeft, RefreshCw } from "lucide-react-native";
import AppText from "@/components/AppText";
import { radius, size, space, typeScale } from "@/theme/layout";
import { useTheme } from "@/theme/useTheme";

export type AppScreenHeaderProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  backLabel?: string;
  backDisabled?: boolean;
  onRefresh?: () => void;
  refreshLabel?: string;
  busy?: boolean;
  actions?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Compact header, shared by full screens and safe-area modal contents. */
export default function AppScreenHeader({ title, subtitle, onBack, backLabel = "Quay lại", backDisabled, onRefresh, refreshLabel = "Làm mới", busy, actions, style }: AppScreenHeaderProps) {
  const { theme } = useTheme();
  return <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.divider }, style]}>
    {onBack && <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack} disabled={backDisabled} accessibilityState={{ disabled: Boolean(backDisabled) }}
      style={({ pressed }) => [styles.icon, { backgroundColor: theme.surfaceAlt }, (pressed || backDisabled) && { opacity: 0.65 }]}>
      <ArrowLeft size={size.icon} color={theme.text} />
    </Pressable>}
    <View style={styles.copy}>
      <AppText display accessibilityRole="header" style={[styles.title, { color: theme.brand }]}>{title}</AppText>
      {Boolean(subtitle) && <AppText style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</AppText>}
    </View>
    {actions}
    {onRefresh && <Pressable accessibilityRole="button" accessibilityLabel={refreshLabel}
      accessibilityState={{ disabled: Boolean(busy), busy: Boolean(busy) }} disabled={busy} onPress={onRefresh}
      style={({ pressed }) => [styles.icon, { backgroundColor: theme.brandSoft }, (pressed || busy) && { opacity: 0.5 }]}>
      <RefreshCw size={size.icon} color={theme.brand} />
    </Pressable>}
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.sm, borderBottomWidth: 1 },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { ...typeScale.title, fontSize: 21, lineHeight: 29 },
  subtitle: { ...typeScale.caption },
  icon: { width: size.touch, minHeight: size.touch, borderRadius: radius.control, alignItems: "center", justifyContent: "center", flexShrink: 0 },
});
