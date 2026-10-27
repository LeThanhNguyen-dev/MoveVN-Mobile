import Text from "@/components/AppText";
import BookingDisclosure from "./BookingDisclosure";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { BookingStatusHistoryDto } from "@/features/booking/types";
import { bookingStatusLabel, formatDateTime } from "@/features/booking/utils/format";

/** Keep the API's chronological order, matching the web booking detail. */
export default function BookingTimeline({ history }: { history: BookingStatusHistoryDto[] }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  if (!history || history.length === 0) return null;
  return (
    <BookingDisclosure title="Lịch sử giao dịch & Trạng thái">
      {history.map((h, i) => (
        <View key={`${h.createdAt}-${i}`} style={styles.row}>
          <View style={styles.markerColumn}>
            <View style={styles.dotOuter}><View style={[styles.dot, { backgroundColor: theme.brandSolid }]} /></View>
            {i < history.length - 1 ? <View style={styles.connector} /> : null}
          </View>
          <View style={styles.info}>
            <View style={styles.headingRow}>
              <View style={styles.transition}>
                {h.fromStatus ? <>
                  <Text style={styles.previousStatus}>{bookingStatusLabel(h.fromStatus)}</Text>
                  <Text style={styles.arrow}>→</Text>
                </> : null}
                <Text style={styles.status}>{bookingStatusLabel(h.toStatus)}</Text>
              </View>
              <Text style={styles.time}>{formatDateTime(h.createdAt)}</Text>
            </View>
            {h.note ? <Text style={styles.note}>Nội dung: “{h.note}”</Text> : null}
          </View>
        </View>
      ))}
    </BookingDisclosure>
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
      gap: 0,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 12 },
    row: { flexDirection: "row", gap: 10 },
    markerColumn: { width: 14, alignItems: "center" },
    dotOuter: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: theme.brand, backgroundColor: theme.surface, alignItems: "center", justifyContent: "center", zIndex: 1 },
    dot: { width: 5, height: 5, borderRadius: 3 },
    connector: { width: 1, flex: 1, minHeight: 38, backgroundColor: theme.border },
    info: { flex: 1, gap: 5, paddingBottom: 16 },
    headingRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", alignItems: "baseline", gap: 4 },
    transition: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 5, flex: 1 },
    previousStatus: { color: theme.muted, fontSize: 12, fontWeight: "500" },
    arrow: { color: theme.placeholder, fontSize: 12 },
    status: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    note: { color: theme.muted, backgroundColor: theme.surfaceAlt, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, padding: 9, fontSize: 12, lineHeight: 18 },
    time: { color: theme.placeholder, fontSize: 11, fontWeight: "500" },
  });
