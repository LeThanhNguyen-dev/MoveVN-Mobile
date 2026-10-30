import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useRef, useState } from "react";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "@/navigation/types";
import { getMyBookings } from "@/features/booking/bookingService";
import type { BookingResponse } from "@/features/booking/types";
import { BOOKING_PAGE_SIZE } from "@/features/booking/constants";
import BookingListShell from "@/features/booking/components/BookingListShell";
import { EMPTY_SEARCH, type SearchFilters } from "@/features/booking/components/BookingSearchFilters";
import { getApiErrorMessage } from "@/services/apiClient";

type ListNav = NativeStackNavigationProp<TripsStackParamList, "TripList">;

export default function TripListScreen({ navigation }: { navigation: ListNav }) {
  const [items, setItems] = useState<BookingResponse[]>([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState<SearchFilters>(EMPTY_SEARCH);
  const requestId = useRef(0);
  const fetching = useRef(false);
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
      if (!replace && fetching.current) return;
      fetching.current = true;
      const request = ++requestId.current;
      if (replace) {
        setItems([]); setPage(1);
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const res = await getMyBookings({
          ...search,
          status: targetStatus || undefined,
          page: targetPage,
          pageSize: BOOKING_PAGE_SIZE,
        });
        if (request !== requestId.current) return;
        setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
        setTotalCount(res.totalCount);
        setPage(res.page);
      } catch (err) {
        if (request !== requestId.current) return;
        if (replace) setError(getApiErrorMessage(err, "Không tải được danh sách chuyến đi."));
      } finally {
        if (request === requestId.current) {
          fetching.current = false;
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [search],
  );

  useFocusEffect(useCallback(() => {
    void fetchPage(1, status, true);
    return () => { requestId.current++; fetching.current = false; };
  }, [fetchPage, status]));

  function handleRefresh() {
    setRefreshing(true);
    void fetchPage(1, status, true);
  }

  function handleLoadMore() {
    if (loading || loadingMore || refreshing || !hasMore) return;
    void fetchPage(page + 1, status, false);
  }

  return (
    <BookingListShell
      variant="customer"
      items={items}
      totalCount={totalCount}
      status={status}
      onStatusChange={setStatus}
      search={search}
      onSearchChange={setSearch}
      loading={loading}
      loadingMore={loadingMore}
      refreshing={refreshing}
      error={error}
      hasMore={hasMore}
      remaining={remaining}
      onRefresh={handleRefresh}
      onLoadMore={handleLoadMore}
      onPressBooking={(booking) => navigation.navigate("TripDetail", { bookingId: booking.id })}
    />
  );
}
