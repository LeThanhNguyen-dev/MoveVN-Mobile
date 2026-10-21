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
} {
  switch (status) {
    case "Pending":
      return { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" };
    case "Approved":
    case "DepositPaid":
      return { bg: theme.brandSoft, text: theme.brand, dot: theme.brand };
    case "InProgress":
    case "Returning":
    case "Returned":
      return { bg: theme.infoSoft, text: theme.info, dot: theme.info };
    case "Completed":
      return { bg: theme.successSoft, text: theme.success, dot: theme.success };
    case "Cancelled":
    case "Rejected":
      return { bg: theme.dangerSoft, text: theme.danger, dot: theme.danger };
    default:
      return { bg: theme.surfaceAlt, text: theme.muted, dot: theme.faint };
  }
}

function BookingStatusBadge({ status }: { status: string }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const s = getBookingStatusStyle(status, theme);
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]}>
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
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      maxWidth: 112,
      flexShrink: 0,
    },
    dot: { width: 7, height: 7, borderRadius: 4 },
    text: { fontSize: 11, fontWeight: "800" },
  });
