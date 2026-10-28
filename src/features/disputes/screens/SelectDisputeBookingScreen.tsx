import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { BookingResponse } from "@/features/booking/types";
import { formatDateTime, formatMoney } from "@/features/booking/utils/format";
import BookingStatusBadge from "@/features/booking/components/BookingStatusBadge";

// Màn chọn booking riêng cho luồng tạo tranh chấp — thay cho list inline
// trong form (từng bị tràn đè các trường khác). Dùng FlatList ảo hóa nên
// danh sách dài vẫn mượt, mỗi dòng có badge trạng thái TV + thông tin đủ để chọn.
export default function SelectDisputeBookingScreen({
  role,
  reportType,
  bookings,
  loading,
  selectedId,
  lockedBooking,
  onSelect,
  onBack,
}: {
  role: "Customer" | "Owner";
  reportType: string;
  bookings: BookingResponse[];
  loading: boolean;
  selectedId: string;
  lockedBooking: BookingResponse | null;
  onSelect: (booking: BookingResponse) => void;
  onBack: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState("");

  const eligible = useMemo(() => {
    const allowed =
      reportType === "TrafficFine"
        ? ["Completed", "Returned", "Returning", "InProgress"]
        : ["Completed", "Returned", "Returning"];
    const q = query.trim().toLowerCase();
    const list = bookings.filter(
      (b) => allowed.includes(b.status) && (!q || b.bookingCode.toLowerCase().includes(q)),
    );
    // Luôn giữ booking được ghim ở đầu dù nó không lọt bộ lọc trạng thái.
    if (lockedBooking && !list.some((b) => b.id === lockedBooking.id)) return [lockedBooking, ...list];
    return list;
  }, [bookings, reportType, query, lockedBooking]);

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại form tạo"
          onPress={onBack}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Chọn booking</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      <View style={styles.searchWrap}>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Tìm theo mã booking..."
          placeholderTextColor={theme.placeholder}
          style={styles.input}
        />
        <Text style={styles.muted}>
          {reportType === "TrafficFine"
            ? "Booking đã/đang thuê đều được chấp nhận cho phạt nguội."
            : "Chỉ booking đã hoàn tất / đã trả xe."}{" "}
          {eligible.length} booking
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color={theme.brand} style={styles.loader} />
      ) : (
        <FlatList
          data={eligible}
          keyExtractor={(b) => String(b.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>Không có booking phù hợp.</Text>}
          renderItem={({ item }) => {
            const active = selectedId === String(item.id);
            const counterpart = role === "Owner" ? item.customerName : item.ownerName;
            return (
              <Pressable
                onPress={() => onSelect(item)}
                style={[styles.card, active && styles.cardActive]}
              >
                <View style={styles.cardHeader}>
                  <Text numberOfLines={1} style={[styles.bookingCode, active && styles.bookingCodeActive]}>
                    {item.bookingCode}
                  </Text>
                  <BookingStatusBadge status={item.status} />
                </View>
                {item.vehicleName ? (
                  <Text numberOfLines={1} style={styles.vehicle}>{item.vehicleName}</Text>
                ) : null}
                <Text style={styles.muted}>
                  {formatDateTime(item.startDate)} → {formatDateTime(item.endDate)}
                </Text>
                <View style={styles.cardFooter}>
                  <Text style={styles.money}>{formatMoney(item.totalAmount)}</Text>
                  {counterpart ? (
                    <Text numberOfLines={1} style={styles.counterpart}>{counterpart}</Text>
                  ) : null}
                  {active ? <Text style={styles.picked}>✓ Đang chọn</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonPlaceholder: { width: 32, height: 32 },
    backText: { color: theme.text, fontSize: 22, fontWeight: "700", marginTop: -2 },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    searchWrap: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 14,
    },
    muted: { color: theme.muted, fontSize: 13 },
    loader: { marginTop: 32 },
    list: { gap: 10, paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24 },
    card: {
      gap: 4,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 16,
      padding: 14,
    },
    cardActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    bookingCode: { color: theme.text, fontSize: 15, fontWeight: "800", flex: 1 },
    bookingCodeActive: { color: theme.brand },
    vehicle: { color: theme.text, fontSize: 13, fontWeight: "700" },
    cardFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
    money: { color: theme.text, fontSize: 13, fontWeight: "800" },
    counterpart: { color: theme.muted, fontSize: 12, flex: 1 },
    picked: { color: theme.brand, fontSize: 12, fontWeight: "800" },
  });
