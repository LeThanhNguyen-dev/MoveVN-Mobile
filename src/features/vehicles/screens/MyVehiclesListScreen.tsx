import { Bike, Car, Check, ChevronDown, Plus, Search, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import type { VehicleListItemResponse } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import MyVehicleCard from "@/features/vehicles/components/MyVehicleCard";
import VehicleCardSkeleton from "@/features/vehicles/components/VehicleCardSkeleton";
import { getMyVehicles, toggleVehicleStatus } from "@/features/vehicles/services/vehicleService";

const PAGE_SIZE = 10;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

type TypeFilter = "" | "Car" | "Motorbike";
type StatusFilter = "" | "Pending" | "Approved" | "Hidden" | "Rejected";

const TYPE_TABS: { value: TypeFilter; label: string; icon?: typeof Car }[] = [
  { value: "", label: "Tất cả" },
  { value: "Car", label: "Ô tô", icon: Car },
  { value: "Motorbike", label: "Xe máy", icon: Bike },
];

const STATUS_TABS: { value: StatusFilter; label: string }[] = [
  { value: "", label: "Mọi trạng thái" },
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
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [keyword, setKeyword] = useState("");
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);
  const fetching = useRef(false);
  const scrollY = useRef(new Animated.Value(0)).current;
  const compactSize = (expanded: number, compact: number) => scrollY.interpolate({
    inputRange: [0, 96], outputRange: [expanded, compact], extrapolate: "clamp",
  });
  const controlHeight = compactSize(44, 30);

  useEffect(() => {
    const timer = setTimeout(() => setKeyword(searchText.trim()), 400);
    return () => clearTimeout(timer);
  }, [searchText]);

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
    async (pageNum: number, replace: boolean, type: TypeFilter, status: StatusFilter, query: string) => {
      if (!replace && fetching.current) return;
      fetching.current = true;
      const request = ++requestId.current;
      if (replace) {
        setItems([]);
        setPage(1);
        setTotalPages(0);
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
          keyword: query || undefined,
        });
        if (request !== requestId.current) return;
        setItems((prev) => (replace ? result.items : [...prev, ...result.items]));
        setPage(result.page);
        setTotalPages(result.totalPages);
        setTotalCount(result.totalCount);
      } catch {
        if (request !== requestId.current) return;
        if (replace) setError("Không tải được danh sách xe. Kéo xuống để thử lại.");
      } finally {
        if (request === requestId.current) {
          fetching.current = false;
          setLoading(false);
          setLoadingMore(false);
          setRefreshing(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void fetchPage(1, true, typeFilter, statusFilter, keyword);
    return () => { requestId.current++; fetching.current = false; };
  }, [fetchPage, typeFilter, statusFilter, keyword, refreshToken, reloadToken]);

  function handleRefresh() {
    setRefreshing(true);
    void fetchPage(1, true, typeFilter, statusFilter, keyword);
  }

  function handleLoadMore() {
    if (loading || loadingMore || refreshing || page >= totalPages) return;
    void fetchPage(page + 1, false, typeFilter, statusFilter, keyword);
  }

  async function handleToggleStatus(vehicle: VehicleListItemResponse) {
    if (togglingId !== null) return;
    setTogglingId(vehicle.id);
    const request = requestId.current;
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
      setReloadToken(value => value + 1);
    } catch {
      if (request === requestId.current) setItems(prev);
    } finally {
      setTogglingId(null);
    }
  }

  const renderItem = ({ item }: { item: VehicleListItemResponse }) => (
      <MyVehicleCard
        vehicle={item}
        onOpen={onOpenDetail}
        toggling={togglingId === item.id}
        onToggleStatus={handleToggleStatus}
      />
    );

  const filtered = !!(typeFilter || statusFilter || searchText.trim());
  const clearFilters = () => { setTypeFilter(""); setStatusFilter(""); setSearchText(""); setKeyword(""); };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={styles.titleRow}>
            <AppText display style={styles.title}>Xe của tôi</AppText>
            <AppText accessibilityLabel={loading ? "Đang tải xe" : error ? "Chưa tải được số lượng xe" : `${totalCount} xe phù hợp`} style={styles.count}>
              {loading || error ? "—" : totalCount}
            </AppText>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Thêm xe" onPress={onAdd} hitSlop={4} style={styles.addButton}>
            <Plus color={theme.onBrand} size={16} />
            <AppText style={styles.addText}>Thêm xe</AppText>
          </Pressable>
        </View>
      </View>

      <Animated.View style={[styles.filters, {
        paddingBottom: compactSize(12, 4),
        gap: compactSize(12, 4),
        marginTop: compactSize(12, 4),
        borderRadius: compactSize(16, 10),
      }]}>
        <View accessibilityRole="tablist" style={styles.tabRow}>
          {TYPE_TABS.map((t) => {
            const active = typeFilter === t.value;
            const Icon = t.icon;
            return (
              <AnimatedPressable
                key={t.label}
                accessibilityLabel={t.label}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                onPress={() => setTypeFilter(t.value)}
                hitSlop={{ top: 7, bottom: 7 }}
                style={[styles.tab, { minHeight: controlHeight, paddingVertical: compactSize(12, 5) }]}
              >
                {Icon ? <Icon color={active ? theme.brand : theme.muted} size={17} /> : null}
                <Animated.Text style={[styles.tabText, active && styles.tabTextActive, { fontSize: compactSize(13, 12) }]}>{t.label}</Animated.Text>
                {active ? <View style={styles.tabIndicator} /> : null}
              </AnimatedPressable>
            );
          })}
        </View>
        <View style={styles.filterRow}>
          <Animated.View style={[styles.searchField, { minHeight: controlHeight }]}>
            <Search color={theme.muted} size={16} />
            <AnimatedTextInput
              accessibilityLabel="Tìm xe theo tên hoặc biển số"
              placeholder="Tên xe, biển số…"
              placeholderTextColor={theme.placeholder}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={() => { setKeyword(searchText.trim()); Keyboard.dismiss(); }}
              returnKeyType="search"
              maxLength={100}
              autoCorrect={false}
              style={[styles.searchInput, { minHeight: compactSize(42, 28), paddingVertical: compactSize(10, 3) }]}
            />
            {searchText ? <Pressable accessibilityRole="button" accessibilityLabel="Xóa từ khóa" hitSlop={6} onPress={() => { setSearchText(""); setKeyword(""); }} style={styles.clearSearch}><X size={14} color={theme.muted} /></Pressable> : null}
          </Animated.View>
          <AnimatedPressable accessibilityRole="button" accessibilityLabel={`Lọc trạng thái: ${STATUS_TABS.find(t => t.value === statusFilter)?.label}`} accessibilityState={{ expanded: statusPickerOpen }} hitSlop={{ top: 7, bottom: 7 }} onPress={() => { Keyboard.dismiss(); setStatusPickerOpen(true); }} style={[styles.statusSelect, !!statusFilter && styles.statusSelectActive, { minHeight: controlHeight }]}>
            <AppText numberOfLines={1} style={[styles.statusText, !!statusFilter && styles.tabTextActive]}>{STATUS_TABS.find(t => t.value === statusFilter)?.label}</AppText>
            <ChevronDown size={15} color={statusFilter ? theme.brand : theme.muted} />
          </AnimatedPressable>
        </View>
      </Animated.View>

      <FlatList
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
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
              <AppText style={styles.errorText}>{error}</AppText>
              <Pressable onPress={handleRefresh} style={styles.retryBtn}>
                <AppText style={styles.retryText}>Thử lại</AppText>
              </Pressable>
            </View>
          ) : (
            <View style={styles.center}>
              <AppText display style={styles.emptyTitle}>{filtered ? "Không tìm thấy xe phù hợp" : "Chưa có xe nào"}</AppText>
              <AppText style={styles.emptyDesc}>{filtered ? "Thử từ khóa khác hoặc bỏ điều kiện lọc." : "Thêm xe đầu tiên để bắt đầu cho thuê."}</AppText>
              <Pressable accessibilityRole="button" onPress={filtered ? clearFilters : onAdd} style={styles.retryBtn}>
                <AppText style={styles.retryText}>{filtered ? "Xóa bộ lọc" : "Thêm xe ngay"}</AppText>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? <ActivityIndicator color={theme.brand} style={styles.more} /> : null
        }
      />
      <Modal visible={statusPickerOpen} transparent animationType="fade" presentationStyle="overFullScreen" onRequestClose={() => setStatusPickerOpen(false)}>
        <SafeAreaProvider>
          <View style={styles.modalBackdrop}>
            <Pressable accessibilityRole="button" accessibilityLabel="Đóng bộ lọc trạng thái" style={StyleSheet.absoluteFill} onPress={() => setStatusPickerOpen(false)} />
            <SafeAreaView edges={["top", "bottom", "left", "right"]} style={styles.sheetArea} pointerEvents="box-none">
              <View style={styles.sheet} accessibilityViewIsModal>
                <View style={styles.sheetHeader}><AppText style={styles.sheetTitle}>Trạng thái xe</AppText><Pressable accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setStatusPickerOpen(false)} style={styles.closeButton}><X size={19} color={theme.muted} /></Pressable></View>
                <ScrollView bounces={false}>
                  {STATUS_TABS.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: statusFilter === option.value }} onPress={() => { setStatusFilter(option.value); setStatusPickerOpen(false); }} style={[styles.statusOption, statusFilter === option.value && styles.selectedOption]}>
                    <AppText style={[styles.optionText, statusFilter === option.value && styles.tabTextActive]}>{option.label}</AppText>
                    {statusFilter === option.value ? <Check size={18} color={theme.brand} /> : null}
                  </Pressable>)}
                </ScrollView>
              </View>
            </SafeAreaView>
          </View>
        </SafeAreaProvider>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) => {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 12,
      gap: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.brandBorder,
      backgroundColor: theme.mode === "dark" ? theme.surface : "#FCFAFF",
    },
    headerTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    titleRow: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
    title: { color: theme.text, fontSize: 21, fontWeight: "700", flexShrink: 1 },
    count: { color: theme.brand, fontSize: 12, fontWeight: "500", backgroundColor: theme.brandSoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, overflow: "hidden" },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: theme.brand,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 38,
    },
    addText: { color: theme.onBrand, fontSize: 12, fontWeight: "600" },
    filters: { marginHorizontal: 16, marginTop: 12, paddingHorizontal: 12, paddingBottom: 12, gap: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.brandBorder, backgroundColor: theme.mode === "dark" ? theme.surface : "#FBF8FF" },
    tabRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.brandBorder },
    tab: {
      flex: 1,
      minHeight: 44,
      flexDirection: "row",
      gap: 7,
      paddingVertical: 12,
      alignItems: "center",
      justifyContent: "center",
    },
    tabIndicator: { position: "absolute", bottom: -1, left: 18, right: 18, height: 2, borderRadius: 2, backgroundColor: theme.brand },
    tabText: { color: theme.muted, fontSize: 13, fontWeight: "500" },
    tabTextActive: { color: theme.brand, fontWeight: "600" },
    filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    searchField: { flex: 1, minWidth: 0, minHeight: 44, paddingLeft: 10, paddingRight: 4, flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: theme.brandBorder, borderRadius: 11, backgroundColor: theme.surface },
    searchInput: { flex: 1, minWidth: 0, color: theme.text, fontSize: 12, paddingVertical: 10, paddingHorizontal: 0, minHeight: 42 },
    clearSearch: { height: 28, width: 28, justifyContent: "center", alignItems: "center" },
    statusSelect: { width: 142, maxWidth: "46%", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 11, borderWidth: 1, borderColor: theme.brandBorder, backgroundColor: theme.surface },
    statusSelectActive: { borderColor: theme.brandBorder, backgroundColor: theme.brandSoft },
    statusText: { flex: 1, minWidth: 0, color: theme.text, fontSize: 12, fontWeight: "500" },
    modalBackdrop: { flex: 1, backgroundColor: theme.overlay },
    sheetArea: { flex: 1, justifyContent: "flex-end", alignItems: "center", padding: 12 },
    sheet: { width: "100%", maxWidth: 480, maxHeight: "75%", borderRadius: 20, padding: 12, backgroundColor: theme.surface },
    sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingLeft: 4, marginBottom: 8 },
    sheetTitle: { color: theme.text, fontSize: 16, fontWeight: "700" },
    closeButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
    statusOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 12, paddingVertical: 14, minHeight: 48, borderRadius: 12 },
    selectedOption: { backgroundColor: theme.brandSoft },
    optionText: { color: theme.text, fontSize: 14, flexShrink: 1 },
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
};
