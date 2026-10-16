import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { CalendarCheck } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getMyBookings } from "@/features/booking/bookingService";
import type { BookingResponse } from "@/features/booking/types";
import { BOOKING_PAGE_SIZE, BOOKING_STATUS_FILTERS } from "@/features/booking/constants";
import BookingCard from "@/features/booking/components/BookingCard";
import BookingCardSkeleton from "@/features/booking/components/BookingCardSkeleton";
import { getApiErrorMessage } from "@/services/apiClient";

type ListNav = NativeStackNavigationProp<TripsStackParamList, "TripList">;

export default function TripListScreen({ navigation }: { navigation: ListNav }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = useState<BookingResponse[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const hasMore = items.length < totalCount;
  const remaining = Math.max(0, totalCount - items.length);

  const fetchPage = useCallback(
    async (targetPage: number, targetStatus: string, replace: boolean) => {
      if (replace) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await getMyBookings({
          status: targetStatus || undefined,
          page: targetPage,
          pageSize: BOOKING_PAGE_SIZE,
        });
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setTotalCount(res.totalCount);
        setPage(res.page);
      } catch (err) {
        if (replace) setError(getApiErrorMessage(err, "Không tải được danh sách chuyến đi."));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchPage(1, status, true);
  }, [fetchPage, status]);

  function handleRefresh() {
    setRefreshing(true);
    void fetchPage(1, status, true);
  }

  function handleLoadMore() {
    if (loading || loadingMore || refreshing || !hasMore) return;
    void fetchPage(page + 1, status, false);
  }

  const renderItem = useCallback(
    ({ item }: { item: BookingResponse }) => (
      <BookingCard
        booking={item}
        variant="customer"
        onPress={() => navigation.navigate("TripDetail", { bookingId: item.id })}
      />
    ),
    [navigation],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View>
          <AppText display style={styles.title}>Chuyến đi của tôi</AppText>
          <AppText style={styles.count}>
            {loading && items.length === 0 ? "Đang tải..." : `${totalCount} chuyến`}
          </AppText>
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filterBar}
      >
        {BOOKING_STATUS_FILTERS.map((f) => {
          const active = status === f.key;
          return (
            <Pressable
              key={f.key || "all"}
              onPress={() => setStatus(f.key)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <AppText style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 24 }]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.brand} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              <BookingCardSkeleton />
              <BookingCardSkeleton />
              <BookingCardSkeleton />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <AppText style={styles.errorText}>{error}</AppText>
              <Pressable onPress={handleRefresh} style={styles.retryBtn}>
                <AppText style={styles.retryText}>Thử lại</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <CalendarCheck color={theme.brand} size={32} />
              </View>
              <AppText display style={styles.emptyTitle}>Chưa có chuyến đi nào</AppText>
              <AppText style={styles.emptyDesc}>Các chuyến bạn đặt sẽ hiện ở đây để dễ theo dõi.</AppText>
            </View>
          )
        }
        ListFooterComponent={
          loading || items.length === 0 ? null : loadingMore ? (
            <ActivityIndicator color={theme.brand} style={styles.more} />
          ) : hasMore ? (
            <Pressable onPress={handleLoadMore} style={styles.moreButton}>
              <AppText style={styles.moreText}>Xem thêm ({remaining})</AppText>
            </Pressable>
          ) : (
            <AppText style={styles.endText}>Đã hiển thị hết</AppText>
          )
        }
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 8,
    },
    title: { color: theme.text, fontSize: 17, fontWeight: "800" },
    count: { color: theme.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
    filterBar: { flexGrow: 0, flexShrink: 0 },
    filters: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 8 },
    chip: {
      height: 34,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16,
    },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: theme.onBrand, fontWeight: "800" },
    list: { paddingHorizontal: 16, paddingTop: 4, gap: 12 },
    skeletons: { gap: 12 },
    center: { alignItems: "center", paddingVertical: 48, gap: 8 },
    emptyIcon: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    emptyDesc: { color: theme.muted, fontSize: 13, textAlign: "center" },
    errorText: { color: theme.danger, fontSize: 13, fontWeight: "600", textAlign: "center" },
    retryBtn: {
      marginTop: 8,
      height: 40,
      paddingHorizontal: 18,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    retryText: { color: theme.onBrand, fontSize: 13, fontWeight: "800" },
    more: { marginVertical: 12 },
    moreButton: {
      alignSelf: "center",
      paddingHorizontal: 18,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: theme.brandSoft,
      marginTop: 4,
    },
    moreText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    endText: { color: theme.faint, fontSize: 12, textAlign: "center", marginTop: 8 },
  });
