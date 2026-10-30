import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { ArrowLeft, RefreshCw, Search } from "lucide-react-native";
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
export function TicketHeader({ title, subtitle, onBack, onRefresh, busy, compact = false, refreshLabel = "Làm mới yêu cầu" }: { title: string; subtitle?: string; onBack: () => void; onRefresh?: () => void; busy?: boolean; compact?: boolean; refreshLabel?: string }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <View style={[styles.header, compact && styles.compactHeader]}>
    <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" hitSlop={4} onPress={onBack} style={[styles.iconButton, compact && styles.compactHeaderIcon]}><ArrowLeft color={theme.text} size={compact ? 21 : 23} /></Pressable>
    <View style={{ flex: 1, minWidth: 0 }}><AppText display numberOfLines={compact ? 1 : undefined} style={[styles.heading, compact && styles.compactHeading]}>{title}</AppText>{subtitle && <AppText numberOfLines={1} style={styles.muted}>{subtitle}</AppText>}</View>
    {onRefresh && <Pressable accessibilityRole="button" accessibilityLabel={refreshLabel} disabled={busy} hitSlop={4} onPress={onRefresh} style={[styles.iconButton, compact && styles.compactHeaderIcon]}>{busy ? <ActivityIndicator size="small" color={theme.brand} /> : <RefreshCw color={theme.brand} size={compact ? 18 : 20} />}</Pressable>}
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
export function TicketChoice({ title, selected, onPress, disabled, compact = false }: { title: string; selected: boolean; onPress: () => void; disabled?: boolean; compact?: boolean }) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <Pressable accessibilityRole="button" accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress} style={[styles.chip, compact && styles.compactChip, selected && { backgroundColor: compact ? theme.brandSoft : theme.brand, borderColor: compact ? theme.brandBorder : theme.brand }, disabled && { opacity: 0.6 }]}><AppText style={{ color: selected ? compact ? theme.brand : theme.onBrand : theme.muted, fontSize: compact ? 12 : 13, fontWeight: "600" }}>{title}</AppText></Pressable>;
}

export function TicketSearchField({ value, onChangeText, onSearch, placeholder, label }: {
  value: string; onChangeText: (value: string) => void; onSearch: () => void;
  placeholder: string; label: string;
}) {
  const { theme } = useTheme(); const styles = ticketStyles(theme);
  return <View style={styles.searchField}>
    <Search size={17} color={theme.muted} />
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
      maxLength={100} placeholder={placeholder} placeholderTextColor={theme.placeholder}
      returnKeyType="search" onSubmitEditing={onSearch} style={styles.searchInput} />
    <Pressable accessibilityRole="button" accessibilityLabel="Tìm kiếm" onPress={onSearch}
      style={styles.searchButton}>
      <Search size={17} color={theme.onBrand} />
    </Pressable>
  </View>;
}

export const ticketStyles = (theme: Theme) => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.background },
  content: { padding: 18, paddingBottom: 36, gap: 16 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: theme.divider, backgroundColor: theme.surface },
  iconButton: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 14 },
  heading: { color: theme.text, fontSize: 20, fontWeight: "800" },
  compactHeader: { minHeight: 56, paddingVertical: 6, gap: 9 },
  compactHeaderIcon: { minWidth: 38, minHeight: 38, borderRadius: 12, backgroundColor: theme.surfaceAlt },
  compactHeading: { fontSize: 17, lineHeight: 23, fontWeight: "700" },
  listContent: { padding: 14, paddingBottom: 30, gap: 12 },
  intro: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.brandBorder,
    backgroundColor: theme.mode === "light" ? "#F8F3FF" : theme.brandSoft },
  introIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: theme.surface,
    alignItems: "center", justifyContent: "center" },
  introTitle: { color: theme.text, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  introText: { color: theme.muted, fontSize: 12, lineHeight: 18, marginTop: 3 },
  createButton: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 4, paddingHorizontal: 10, borderRadius: 11, backgroundColor: theme.brand },
  createText: { color: theme.onBrand, fontSize: 12, fontWeight: "700" },
  filterCard: { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border, borderRadius: 15, padding: 12, gap: 12 },
  filterLabel: { color: theme.muted, fontSize: 11, fontWeight: "600", marginBottom: 5 },
  filterChips: { gap: 6, paddingVertical: 2 },
  compactChip: { minHeight: 34, paddingHorizontal: 11, paddingVertical: 6, borderRadius: 10 },
  searchField: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 8,
    paddingLeft: 11, paddingRight: 4, borderRadius: 12, borderWidth: 1,
    borderColor: theme.border, backgroundColor: theme.surface },
  searchInput: { flex: 1, minWidth: 0, fontSize: 13, color: theme.text, paddingVertical: 10 },
  searchButton: { width: 36, height: 36, alignItems: "center", justifyContent: "center", borderRadius: 9, backgroundColor: theme.brand },
  resetLink: { alignSelf: "flex-end", paddingVertical: 4 },
  resetText: { color: theme.brand, fontSize: 12, fontWeight: "600" },
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
