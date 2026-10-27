import { EMPTY_SEARCH } from "../components/BookingSearchFilters";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getMyBookings, getOwnerBookings } from "../bookingService";
import { BOOKING_STATUS_LABELS, formatMoney, formatVietnamDateTime, type BookingRole } from "../bookingDisplay";
import type { BookingResponse } from "../types";
import { BookingButton, BookingHeader } from "../components/BookingControls";

const PAGE_SIZE = 15;
const filters = ["", "Pending", "Approved", "DepositPaid", "InProgress", "Returning", "Returned", "Completed", "Cancelled", "Rejected"];

export default function BookingListScreen({ role, onOpen }: { role: BookingRole; onOpen: (id: number) => void }) {
  const { theme } = useTheme();
  const [status, setStatus] = useState("");
  const search = EMPTY_SEARCH;
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BookingResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestId = useRef(0);
  const mounted = useRef(true);
  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError("");
    try {
      const result = await (role === "Owner" ? getOwnerBookings : getMyBookings)({ ...search, status: status || undefined, page, pageSize: PAGE_SIZE });
      if (mounted.current && request === requestId.current) { setItems(result.items); setTotal(result.totalCount); }
    } catch (err) {
      if (mounted.current && request === requestId.current) { setItems([]); setError(getApiErrorMessage(err, "Không tải được danh sách đơn thuê.")); }
    } finally { if (mounted.current && request === requestId.current) setLoading(false); }
  }, [role, status, page]);
  useEffect(() => { mounted.current = true; void load(); return () => { mounted.current = false; requestId.current++; }; }, [load]);

  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <BookingHeader title={role === "Owner" ? "Đơn thuê của khách" : "Chuyến đi của tôi"} />
    <View><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      {filters.map((value) => <Pressable key={value} accessibilityRole="button" accessibilityState={{ selected: status === value }} onPress={() => { setStatus(value); setPage(1); }}
        style={[styles.filter, { backgroundColor: value === status ? theme.brand : theme.surfaceAlt }]}><Text style={{ color: value === status ? theme.onBrand : theme.text, fontWeight: "600" }}>{BOOKING_STATUS_LABELS[value] || "Tất cả"}</Text></Pressable>)}
    </ScrollView></View>
    <FlatList data={loading ? [] : items} keyExtractor={(item) => String(item.id)} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} tintColor={theme.brand} />}
      ListEmptyComponent={<View style={styles.empty}>{loading ? <ActivityIndicator color={theme.brand} /> : <>
        <Text accessibilityRole={error ? "alert" : undefined} style={{ color: error ? theme.danger : theme.muted, textAlign: "center" }}>{error || (status ? "Chưa có đơn thuê ở trạng thái này." : "Bạn chưa có đơn thuê nào.")}</Text>
        {error ? <BookingButton title="Thử lại" onPress={() => void load()} /> : <Text style={{ color: theme.muted, textAlign: "center" }}>{role === "Owner" ? "Yêu cầu thuê xe sẽ xuất hiện tại đây." : "Chọn xe trong mục Khám phá để tạo yêu cầu thuê."}</Text>}
      </>}</View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Xem đơn ${item.bookingCode}`} onPress={() => onOpen(item.id)} style={[styles.booking, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        {item.vehicleImage ? <Image source={{ uri: item.vehicleImage }} style={styles.image} /> : null}
        <View style={styles.copy}><Text style={{ color: theme.muted, fontSize: 12 }}>{item.bookingCode}</Text>
          <Text style={{ color: theme.text, fontWeight: "800", fontSize: 16 }}>{item.vehicleName || `Xe #${item.vehicleId}`}</Text>
          <Text style={{ color: theme.brand, fontWeight: "600" }}>{BOOKING_STATUS_LABELS[item.status] || item.status}</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>Nhận: {formatVietnamDateTime(item.startDate)}</Text>
          <Text style={{ color: theme.muted, fontSize: 12 }}>Trả: {formatVietnamDateTime(item.endDate)}</Text>
          <Text style={{ color: theme.text, fontWeight: "700" }}>{formatMoney(item.totalAmount)}</Text>
        </View>
      </Pressable>}
      ListFooterComponent={!loading && !error && total > 0 ? <View style={styles.pagination}>
        <Text style={{ color: theme.muted, textAlign: "center" }}>{total} đơn · Trang {page}/{Math.max(1, Math.ceil(total / PAGE_SIZE))}</Text>
        <View style={styles.pages}><View style={{ flex: 1 }}><BookingButton secondary title="Trang trước" disabled={page <= 1} onPress={() => setPage(page - 1)} /></View>
          <View style={{ flex: 1 }}><BookingButton secondary title="Trang sau" disabled={page * PAGE_SIZE >= total} onPress={() => setPage(page + 1)} /></View></View>
      </View> : null} />
  </View>;
}

const styles = StyleSheet.create({
  filters: { padding: 16, gap: 8 }, filter: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18 },
  content: { padding: 16, paddingBottom: 24, gap: 12, flexGrow: 1 }, empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  booking: { flexDirection: "row", padding: 14, gap: 12, borderRadius: 16, borderWidth: 1 }, image: { width: 75, height: 85, borderRadius: 10 }, copy: { flex: 1, gap: 6 },
  pagination: { gap: 12, marginTop: 12 }, pages: { flexDirection: "row", gap: 12 },
});
