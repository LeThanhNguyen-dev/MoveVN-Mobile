import { Plus, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { VehicleListItemResponse } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import MyVehicleCard from "@/features/vehicles/components/MyVehicleCard";
import VehicleCardSkeleton from "@/features/vehicles/components/VehicleCardSkeleton";
import { getMyVehicles, toggleVehicleStatus } from "@/features/vehicles/services/vehicleService";

const PAGE_SIZE = 10;

type TypeFilter = "" | "Car" | "Motorbike";
type StatusFilter = "" | "Pending" | "Approved" | "Hidden" | "Rejected";

const TYPE_TABS: { value: TypeFilter; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "Car", label: "Ô tô" },
  { value: "Motorbike", label: "Xe máy" },
];

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Tất cả" },
  { value: "Pending", label: "Chờ duyệt" },
  { value: "Approved", label: "Đã duyệt" },
  { value: "Hidden", label: "Đã ẩn" },
  { value: "Rejected", label: "Từ chối" },
];

type Props = {
  onOpenDetail: (vehicleId: number) => void;
  onAdd: () => void;
  refreshToken?: number;
};

export default function MyVehiclesListScreen({ onOpenDetail, onAdd, refreshToken = 0 }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [keyword, setKeyword] = useState("");
  const [submittedKeyword, setSubmittedKeyword] = useState("");

  const [items, setItems] = useState<VehicleListItemResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchPage = useCallback(
    async (pageNum: number, replace: boolean, type: TypeFilter, status: StatusFilter, kw: string) => {
      if (replace) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await getMyVehicles({
          page: pageNum,
          pageSize: PAGE_SIZE,
          type: type || undefined,
          status: status || undefined,
          keyword: kw || undefined,
        });
        setItems((prev) => (replace ? result.items : [...prev, ...result.items]));
        setPage(result.page);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
      } catch {
        if (replace) setError("Không tải được danh sách xe. Kéo xuống để thử lại.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void fetchPage(1, true, typeFilter, statusFilter, submittedKeyword);
  }, [fetchPage, typeFilter, statusFilter, submittedKeyword, refreshToken]);

  function handleRefresh() {
    setRefreshing(true);
    void fetchPage(1, true, typeFilter, statusFilter, submittedKeyword);
  }

  function handleLoadMore() {
    if (loading || loadingMore || page >= totalPages) return;
    void fetchPage(page + 1, false, typeFilter, statusFilter, submittedKeyword);
  }

  async function handleToggleStatus(vehicle: VehicleListItemResponse) {
    if (togglingId !== null) return;
    setTogglingId(vehicle.id);
    const prev = items;
    setItems((list) =>
      list.map((v) =>
        v.id === vehicle.id
          ? { ...v, status: v.status === "Approved" ? "Hidden" : "Approved" }
          : v,
      ),
    );
    try {
      await toggleVehicleStatus(vehicle.id);
    } catch {
      setItems(prev);
    } finally {
      setTogglingId(null);
    }
  }

  const renderItem = useCallback(
    ({ item }: { item: VehicleListItemResponse }) => (
      <MyVehicleCard
        vehicle={item}
        onOpen={onOpenDetail}
        toggling={togglingId === item.id}
        onToggleStatus={handleToggleStatus}
      />
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onOpenDetail, togglingId],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.title}>Xe của tôi</Text>
            <Text style={styles.count}>
              {loading && items.length === 0 ? "Đang tải..." : `${totalCount} xe`}
            </Text>
          </View>
          <Pressable onPress={onAdd} style={styles.addButton}>
            <Plus color={theme.onBrand} size={18} />
            <Text style={styles.addText}>Thêm xe</Text>
          </Pressable>
        </View>

        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Search color={theme.placeholder} size={16} />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              onSubmitEditing={() => setSubmittedKeyword(keyword.trim())}
              returnKeyType="search"
              placeholder="Tìm biển số, mô tả..."
              placeholderTextColor={theme.placeholder}
              style={styles.searchInput}
            />
            {keyword ? (
              <Pressable
                onPress={() => {
                  setKeyword("");
                  setSubmittedKeyword("");
                }}
              >
                <X color={theme.muted} size={16} />
              </Pressable>
            ) : null}
          </View>
        </View>

        <View style={styles.tabRow}>
          {TYPE_TABS.map((t) => {
            const active = typeFilter === t.value;
            return (
              <Pressable
                key={t.label}
                onPress={() => setTypeFilter(t.value)}
                style={[styles.tab, active && styles.tabActive]}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.tabRow}>
          {STATUS_TABS.map((t) => {
            const active = statusFilter === t.value;
            return (
              <Pressable
                key={t.label}
                onPress={() => setStatusFilter(t.value)}
                style={[styles.tabSmall, active && styles.tabActive]}
              >
                <Text style={[styles.tabTextSmall, active && styles.tabTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 88 }]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.brand} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.skeletons}>
              <VehicleCardSkeleton />
              <VehicleCardSkeleton />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={handleRefresh} style={styles.retryBtn}>
                <Text style={styles.retryText}>Thử lại</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Chưa có xe nào</Text>
              <Text style={styles.emptyDesc}>Thêm xe đầu tiên để bắt đầu cho thuê.</Text>
              <Pressable onPress={onAdd} style={styles.retryBtn}>
                <Text style={styles.retryText}>Thêm xe ngay</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={theme.brand} style={styles.more} /> : null
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
      paddingTop: 8,
      paddingBottom: 10,
      gap: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    title: { color: theme.text, fontSize: 22, fontWeight: "800" },
    count: { color: theme.muted, fontSize: 12, fontWeight: "600", marginTop: 2 },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.brand,
      borderRadius: 12,
      paddingHorizontal: 14,
      height: 40,
    },
    addText: { color: theme.onBrand, fontSize: 13, fontWeight: "800" },
    searchRow: { flexDirection: "row", gap: 8 },
    searchBox: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      height: 42,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "500" },
    tabRow: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1,
      height: 38,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    tabSmall: {
      flex: 1,
      height: 34,
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    tabActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    tabText: { color: theme.muted, fontSize: 13, fontWeight: "800" },
    tabTextSmall: { color: theme.muted, fontSize: 11, fontWeight: "800" },
    tabTextActive: { color: theme.onBrand },
    list: { paddingHorizontal: 16, paddingTop: 12, gap: 12 },
    skeletons: { gap: 12 },
    center: { alignItems: "center", paddingVertical: 48, gap: 8 },
    emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    emptyDesc: { color: theme.muted, fontSize: 13 },
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
  });
