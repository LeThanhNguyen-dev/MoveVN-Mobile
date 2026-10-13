import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getMyBookings } from "@/features/booking/bookingService";
import type { BookingResponse } from "@/features/booking/types";
import { bookingStatusLabel, formatDateTime, formatMoney, totalPages } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";

type ListNav = NativeStackNavigationProp<TripsStackParamList, "TripList">;

const PAGE_SIZE = 10;

const STATUS_FILTERS: { key: string; label: string }[] = [
  { key: "", label: "Tất cả" },
  { key: "Pending", label: "Chờ duyệt" },
  { key: "Approved", label: "Đã duyệt" },
  { key: "DepositPaid", label: "Đã cọc" },
  { key: "InProgress", label: "Đang thuê" },
  { key: "Returning", label: "Đang trả" },
  { key: "Completed", label: "Hoàn thành" },
  { key: "Cancelled", label: "Đã hủy" },
];

export default function TripListScreen({ navigation }: { navigation: ListNav }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = useState<BookingResponse[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const pages = totalPages(totalCount, PAGE_SIZE);

  const load = useCallback(
    async (targetPage: number, targetStatus: string, showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      setError("");
      try {
        const res = await getMyBookings({
          status: targetStatus || undefined,
          page: targetPage,
          pageSize: PAGE_SIZE,
        });
        setItems(res.items);
        setTotalCount(res.totalCount);
        setPage(res.page);
      } catch (err) {
        setError(getApiErrorMessage(err, "Không tải được danh sách chuyến đi."));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(1, status, true);
  }, [load, status]);

  function handleRefresh() {
    setRefreshing(true);
    void load(page, status, false);
  }

  function renderItem({ item }: { item: BookingResponse }) {
    return (
      <Pressable
        onPress={() => navigation.navigate("TripDetail", { bookingId: item.id })}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        <View style={styles.cardTop}>
          <Text numberOfLines={1} style={styles.code}>
            {item.bookingCode}
          </Text>
          <Text style={styles.status}>{bookingStatusLabel(item.status)}</Text>
        </View>
        <Text numberOfLines={1} style={styles.vehicle}>
          {item.vehicleName ?? `Xe #${item.vehicleId}`}
        </Text>
        <Text style={styles.muted}>
          {formatDateTime(item.startDate)} → {formatDateTime(item.endDate)}
        </Text>
        <Text style={styles.money}>Cọc {formatMoney(item.depositAmount)} · Tổng {formatMoney(item.totalAmount)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.header}>Chuyến đi của tôi</Text>
      <View style={styles.filters}>
        {STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setStatus(f.key)}
            style={[styles.chip, status === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => load(1, status, true)} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.muted}>Chưa có chuyến đi nào.</Text>}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.brand} />}
          ListFooterComponent={
            pages > 1 ? (
              <View style={styles.pager}>
                <Pressable
                  disabled={page <= 1}
                  onPress={() => load(page - 1, status, true)}
                  style={[styles.pageButton, page <= 1 && styles.pageButtonDisabled]}
                >
                  <Text style={styles.pageButtonText}>Trước</Text>
                </Pressable>
                <Text style={styles.muted}>
                  Trang {page}/{pages}
                </Text>
                <Pressable
                  disabled={page >= pages}
                  onPress={() => load(page + 1, status, true)}
                  style={[styles.pageButton, page >= pages && styles.pageButtonDisabled]}
                >
                  <Text style={styles.pageButtonText}>Sau</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background, paddingHorizontal: 16, paddingTop: 12 },
    header: { color: theme.text, fontSize: 20, fontWeight: "800", marginBottom: 8 },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
    chip: {
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      backgroundColor: theme.surfaceAlt,
    },
    chipActive: { backgroundColor: theme.brand },
    chipText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: theme.onBrand },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
    muted: { color: theme.muted, fontSize: 13 },
    retryButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    retryText: { color: theme.onBrand, fontWeight: "800" },
    list: { gap: 10, paddingBottom: 24 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    cardPressed: { opacity: 0.7 },
    cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    code: { color: theme.text, fontSize: 15, fontWeight: "800", flex: 1 },
    status: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    vehicle: { color: theme.text, fontSize: 14, fontWeight: "600" },
    money: { color: theme.text, fontSize: 13, fontWeight: "700" },
    pager: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 12,
    },
    pageButton: {
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pageButtonDisabled: { opacity: 0.4 },
    pageButtonText: { color: theme.text, fontWeight: "700" },
  });
