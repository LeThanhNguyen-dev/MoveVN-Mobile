import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import AppButton from "@/components/ui/AppButton";
import AppScreenHeader from "@/components/ui/AppScreenHeader";
import { contentStyle, surfaceStyle, typeScale } from "@/theme/layout";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import { supportTicketStatusLabels } from "./supportTicketConstants";

export function TicketButton({ title, onPress, disabled, busy, secondary, icon }: { title: string; onPress: () => void; disabled?: boolean; busy?: boolean; secondary?: boolean; icon?: ReactNode }) {
  return <AppButton title={title} onPress={onPress} disabled={disabled} busy={busy} icon={icon} variant={secondary ? "secondary" : "primary"} />;
}
export function TicketHeader({ title, subtitle, onBack, onRefresh, busy, refreshLabel = "Làm mới yêu cầu" }: { title: string; subtitle?: string; onBack: () => void; onRefresh?: () => void; busy?: boolean; refreshLabel?: string }) {
  return <AppScreenHeader title={title} subtitle={subtitle} onBack={onBack} onRefresh={onRefresh} refreshLabel={refreshLabel} busy={busy} />;
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
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, selected && { backgroundColor: theme.brandSolid, borderColor: theme.brand }, disabled && { opacity: 0.6 }]}><AppText style={{ color: selected ? theme.onBrand : theme.muted, fontSize: 13, fontWeight: "600" }}>{title}</AppText></Pressable>;
}
export const ticketStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: contentStyle(),
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider, backgroundColor: theme.surface },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  heading: { color: theme.text, fontSize: 20, fontWeight: "800" },
  title: { color: theme.text, ...typeScale.section },
  label: { color: theme.text, fontSize: 14, fontWeight: "700" },
  muted: { color: theme.muted, fontSize: 12, lineHeight: 19 },
  body: { color: theme.text, fontSize: 14, lineHeight: 22 },
  card: { ...surfaceStyle(theme), padding: 16, gap: 12 },
  row: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  input: { minHeight: 48, backgroundColor: theme.input, borderWidth: 1, borderColor: theme.border, borderRadius: 13, color: theme.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14 },
  textarea: { minHeight: 130, textAlignVertical: "top" },
  button: { minHeight: 46, borderRadius: 13, backgroundColor: theme.brandSolid, paddingHorizontal: 16, paddingVertical: 12, flexDirection: "row", gap: 8, justifyContent: "center", alignItems: "center" },
  secondary: { backgroundColor: theme.brandSoft, borderWidth: 1, borderColor: theme.brandBorder },
  buttonText: { color: theme.onBrand, fontSize: 14, fontWeight: "700" },
  chip: { minHeight: 40, borderRadius: 12, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, justifyContent: "center", paddingHorizontal: 13, paddingVertical: 9 },
  empty: { alignItems: "center", gap: 14, paddingVertical: 34, paddingHorizontal: 20 },
  count: { color: theme.muted, fontSize: 11, textAlign: "right" },
});
