import { memo, useMemo } from "react";
import { StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { bookingStatusLabel } from "@/features/booking/utils/format";

export function getBookingStatusStyle(status: string, theme: Theme): {
  bg: string;
  text: string;
  dot: string;
  border: string;
} {
  const successBorder = theme.mode === "dark" ? "#1F5644" : "#BCEBD9";
  switch (status) {
    case "Pending":
      return {
        bg: theme.mode === "dark" ? "#3A2A0F" : "#FEF3C7",
        text: theme.mode === "dark" ? "#FBBF24" : "#B45309",
        dot: "#F59E0B",
        border: theme.mode === "dark" ? "#5A4318" : "#F5E0B8",
      };
    case "Approved":
    case "DepositPaid":
    case "Confirmed":
      return { bg: theme.brandSoft, text: theme.brand, dot: theme.brand, border: theme.brandBorder };
    case "InProgress":
    case "Returning":
    case "Returned":
      return { bg: theme.infoSoft, text: theme.info, dot: theme.info, border: theme.infoBorder };
    case "Completed":
      return { bg: theme.successSoft, text: theme.success, dot: theme.success, border: successBorder };
    case "Cancelled":
    case "Rejected":
      return { bg: theme.dangerSoft, text: theme.danger, dot: theme.danger, border: theme.dangerBorder };
    default:
      return { bg: theme.surfaceAlt, text: theme.muted, dot: theme.faint, border: theme.border };
  }
}

function BookingStatusBadge({ status }: { status: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const s = getBookingStatusStyle(status, theme);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg, borderColor: s.border }]}>
      <View style={[styles.dot, { backgroundColor: s.dot }]} />
      <AppText numberOfLines={1} style={[styles.text, { color: s.text }]}>
        {bookingStatusLabel(status)}
      </AppText>
    </View>
  );
}

export default memo(BookingStatusBadge);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
      maxWidth: 118,
      flexShrink: 0,
    },
    dot: { width: 5, height: 5, borderRadius: 3 },
    text: { fontSize: 9.5, fontWeight: "800" },
  });
