import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { BookingStatusHistoryDto } from "@/features/booking/types";
import { bookingStatusLabel, formatDateTime } from "@/features/booking/utils/format";

const STATUS_DOT: Record<string, string> = {
  Cancelled: "#ef4444",
  Rejected: "#ef4444",
  Completed: "#10b981",
  DepositPaid: "#10b981",
  InProgress: "#0ea5e9",
  Returning: "#0ea5e9",
  Returned: "#0ea5e9",
};

/** Dòng thời gian đổi trạng thái của booking (mới nhất trước). */
export default function BookingTimeline({ history }: { history: BookingStatusHistoryDto[] }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!history || history.length === 0) return null;
  const items = [...history].reverse();
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Lịch sử trạng thái</Text>
      {items.map((h, i) => (
        <View key={`${h.createdAt}-${i}`} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: STATUS_DOT[h.toStatus] ?? theme.brand }]} />
          <View style={styles.info}>
            <Text style={styles.status}>
              {h.fromStatus ? `${bookingStatusLabel(h.fromStatus)} → ` : ""}
              {bookingStatusLabel(h.toStatus)}
            </Text>
            {h.note ? (
              <Text numberOfLines={2} style={styles.note}>
                {h.note}
              </Text>
            ) : null}
            <Text style={styles.time}>{formatDateTime(h.createdAt)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 8,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 2 },
    row: { flexDirection: "row", gap: 10 },
    dot: { width: 9, height: 9, borderRadius: 5, marginTop: 5 },
    info: { flex: 1, gap: 1, paddingBottom: 8 },
    status: { color: theme.text, fontSize: 13, fontWeight: "700" },
    note: { color: theme.muted, fontSize: 12 },
    time: { color: theme.placeholder, fontSize: 11 },
  });
