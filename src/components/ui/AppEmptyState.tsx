import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import AppButton from "./AppButton";
import { typeScale } from "@/theme/layout";
import { useTheme } from "@/theme/useTheme";

export default function AppEmptyState({ title, description, icon, action }: { title: string; description?: string; icon?: ReactNode; action?: { label: string; onPress: () => void } }) {
  const { theme } = useTheme();
  return <View style={styles.container}>
    {icon && <View style={[styles.icon, { backgroundColor: theme.brandSoft }]}>{icon}</View>}
    <AppText display style={[typeScale.section, styles.center, { color: theme.text }]}>{title}</AppText>
    {description && <AppText style={[typeScale.body, styles.center, { color: theme.muted }]}>{description}</AppText>}
    {action && <AppButton title={action.label} onPress={action.onPress} variant="secondary" />}
  </View>;
}

const styles = StyleSheet.create({
  container: { alignItems: "center", paddingHorizontal: 24, paddingVertical: 36, gap: 12 },
  icon: { width: 64, height: 64, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  center: { textAlign: "center" },
});
