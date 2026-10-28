import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { ArrowLeft, RefreshCw } from "lucide-react-native";
import AppText from "@/components/AppText";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import { supportTicketStatusLabels } from "./supportTicketConstants";

export function TicketButton({ title, onPress, disabled, busy, secondary, icon }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; icon?: ReactNode }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: Boolean(disabled || busy), busy: Boolean(busy) }} disabled={disabled || busy} onPress={onPress} style={[styles.button, secondary && styles.secondary, (disabled || busy) && { opacity: 0.5 }]}>
    {busy ? <ActivityIndicator color={secondary ? theme.brand : theme.onBrand} /> : icon}
    <AppText style={[styles.buttonText, secondary && { color: theme.brand }]}>{title}</AppText>
  </Pressable>;
}
export function TicketHeader({ title, subtitle, onBack, onRefresh, busy, refreshLabel = "Làm mới yêu cầu" }: { title: string; subtitle?: string; onBack: () => void; onRefresh?: () => void; busy?: boolean; refreshLabel?: string }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={onBack} style={styles.iconButton}><ArrowLeft color={theme.text} size={23} /></Pressable>
    <View style={{ flex: 1, minWidth: 0 }}><AppText display style={styles.heading}>{title}</AppText>{subtitle && <AppText numberOfLines={1} style={styles.muted}>{subtitle}</AppText>}</View>
    {onRefresh && <Pressable accessibilityRole="button" accessibilityLabel={refreshLabel} disabled={busy} onPress={onRefresh} style={styles.iconButton}><RefreshCw color={theme.brand} size={20} /></Pressable>}
  </View>;
}
export function TicketNotice({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <View accessibilityRole="alert" style={[styles.card, { backgroundColor: theme.errorSoft, borderColor: theme.errorBorder }]}><AppText style={{ color: theme.error, lineHeight: 21 }}>{message}</AppText>{onRetry && <TicketButton secondary title="Thử lại" onPress={onRetry} />}</View>;
}
export function TicketStatus({ status }: { status: string }) {
  const { theme } = useTheme();
  const color = status === "Open" ? theme.brand : status === "InProgress" ? (theme.mode === "dark" ? "#FBBF24" : "#A16207") : status === "Resolved" ? theme.success : theme.muted;
  return <View style={{ alignSelf: "flex-start", backgroundColor: color + "15", borderColor: color + "40", borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }}><AppText style={{ color, fontSize: 12, fontWeight: "700" }}>{supportTicketStatusLabels[status] ?? status}</AppText></View>;
}
export function TicketChoice({ title, selected, onPress, disabled }: { title: string; selected: boolean; onPress: () => void; disabled?: boolean }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && { backgroundColor: theme.brand, borderColor: theme.brand }, disabled && { opacity: 0.6 }]}><AppText style={{ color: selected ? theme.onBrand : theme.muted, fontSize: 13, fontWeight: "600" }}>{title}</AppText></Pressable>;
}
export const ticketStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider, backgroundColor: theme.surface },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  heading: { color: theme.text, fontSize: 20, fontWeight: "800" },
  title: { color: theme.text, fontSize: 17, fontWeight: "800", lineHeight: 25 },
  label: { color: theme.text, fontSize: 14, fontWeight: "700" },
  muted: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  body: { color: theme.text, fontSize: 14, lineHeight: 22 },
  card: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 20, padding: 18, gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  input: { minHeight: 48, backgroundColor: theme.input, borderWidth: 1, borderColor: theme.border, borderRadius: 13, color: theme.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { minHeight: 130, textAlignVertical: "top" },
  button: { minHeight: 46, borderRadius: 13, backgroundColor: theme.brand, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  secondary: { backgroundColor: theme.brandSoft, borderWidth: 1, borderColor: theme.brandBorder },
  buttonText: { color: theme.onBrand, fontSize: 14, fontWeight: "700" },
  chip: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, justifyContent: "center", paddingHorizontal: 13, paddingVertical: 9 },
  empty: { alignItems: "center", gap: 14, paddingVertical: 34, paddingHorizontal: 20 },
  count: { color: theme.muted, fontSize: 11, textAlign: "right" },
});
