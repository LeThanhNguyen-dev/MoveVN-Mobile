import type { ReactNode } from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import AppText from "@/components/AppText";
import { radius, space, surfaceStyle, typeScale } from "@/theme/layout";
import { useTheme } from "@/theme/useTheme";

export function AppCard({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return <View style={[surfaceStyle(theme), styles.card, style]}>{children}</View>;
}

export function AppPageIntro({ title, description, icon, actions }: { title: string; description?: string; icon?: ReactNode; actions?: ReactNode }) {
  const { theme } = useTheme();
  return <View style={[styles.intro, { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder }]}>
    <View style={styles.row}>
      {icon && <View style={[styles.introIcon, { backgroundColor: theme.surface }]}>{icon}</View>}
      <AppText display accessibilityRole="header" style={[styles.introTitle, { color: theme.brand }]}>{title}</AppText>
    </View>
    {description && <AppText style={[typeScale.body, { color: theme.muted }]}>{description}</AppText>}
    {actions && <View style={styles.actions}>{actions}</View>}
  </View>;
}

const styles = StyleSheet.create({
  card: { padding: space.lg, gap: space.md },
  intro: { padding: space.lg, gap: space.sm, borderRadius: radius.card, borderWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: space.md },
  introIcon: { width: 40, minHeight: 40, borderRadius: radius.control, alignItems: "center", justifyContent: "center" },
  introTitle: { ...typeScale.title, flex: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.xs },
});
