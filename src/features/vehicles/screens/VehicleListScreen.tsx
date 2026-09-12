import { ArrowLeft, CalendarDays, Check, ChevronDown, MapPin, SlidersHorizontal, X } from "lucide-react-native";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import VehicleListCard, { formatVehicleCurrency } from "@/features/vehicles/components/VehicleListCard";
import VehicleFilterSheet, {
  EMPTY_FILTERS,
  getFuelLabel,
  getTransmissionLabel,
  type VehicleListFilters,
} from "@/features/vehicles/components/VehicleFilterSheet";
import AreaPickerSheet from "@/features/vehicles/components/AreaPickerSheet";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import { saveSearchPrefs } from "@/features/vehicles/utils/searchPrefs";
import { getPublicVehicles } from "@/features/vehicles/services/publicVehicleService";
import {
  addFavoriteVehicle,
  getFavoriteVehicleIds,
  removeFavoriteVehicle,
} from "@/features/vehicles/services/favoriteVehicleService";
import {
  calculateRentalDays,
  formatPeriodSummary,
} from "@/features/vehicles/utils/rentalPeriod";
import type { VehicleListItemResponse } from "@/features/vehicles/types";

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "", label: "Mới nhất" },
  { value: "price_asc", label: "Giá thấp đến cao" },
  { value: "price_desc", label: "Giá cao đến thấp" },
  { value: "rating_desc", label: "Đánh giá tốt nhất" },
];

type VehicleListRoute = RouteProp<ExploreStackParamList, "VehicleList">;
type VehicleListNav = NativeStackNavigationProp<ExploreStackParamList, "VehicleList">;

type Chip = { key: string; label: string; clear: () => void };

export default function VehicleListScreen({
  route,
  navigation,
}: {
  route: VehicleListRoute;
  navigation: VehicleListNav;
}) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const base = route.params;

  const [filters, setFilters] = useState<VehicleListFilters>(() => ({
    ...EMPTY_FILTERS,
    type: base.type,
  }));
  const [sortBy, setSortBy] = useState("");
  const [filterVisible, setFilterVisible] = useState(false);
  const [sortVisible, setSortVisible] = useState(false);
  const [areaVisible, setAreaVisible] = useState(false);
  const [periodVisible, setPeriodVisible] = useState(false);

  // Địa điểm + thời gian đổi được ngay trong list, không cần thoát ra.
  const [province, setProvince] = useState(base.province);
  const [district, setDistrict] = useState(base.district);
  const [areaId, setAreaId] = useState<number | undefined>(base.areaId);
  const [startDate, setStartDate] = useState(base.startDate);
  const [endDate, setEndDate] = useState(base.endDate);

  const [items, setItems] = useState<VehicleListItemResponse[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const [favoriteIds, setFavoriteIds] = useState<Set<number>>(new Set());
  const [favLoadingId, setFavLoadingId] = useState<number | null>(null);

  const rentalDays = calculateRentalDays(startDate, endDate);
  const areaText = province ? `${province}${district ? ` · ${district}` : ""}` : "Toàn quốc";

  const fetchPage = useCallback(
    async (
      pageNum: number,
      replace: boolean,
      active: VehicleListFilters,
      sort: string,
      loc: { areaId?: number; province: string; district: string; startDate: string; endDate: string },
    ) => {
      if (replace) {
        setLoading(true);
        setError("");
      } else {
        setLoadingMore(true);
      }
      try {
        const result = await getPublicVehicles({
          page: pageNum,
          pageSize: PAGE_SIZE,
          sortBy: sort || undefined,
          type: active.type || undefined,
          brandId: active.brandId || undefined,
          modelId: active.modelId || undefined,
          seatCount: active.seatCount || undefined,
          keyword: active.keyword || undefined,
          minPrice: active.minPrice || undefined,
          maxPrice: active.maxPrice || undefined,
          fuelType: active.fuelType || undefined,
          transmission: active.transmission || undefined,
          bodyType: active.bodyType || undefined,
          bikeType: active.bikeType || undefined,
          pickupAddress: active.customerLat && active.customerLng ? active.pickupAddress : undefined,
          customerLat: active.customerLat && active.customerLng ? active.customerLat : undefined,
          customerLng: active.customerLat && active.customerLng ? active.customerLng : undefined,
          radiusKm: active.customerLat && active.customerLng ? active.radiusKm : undefined,
          areaId: loc.areaId,
          province: loc.province || undefined,
          district: loc.district || undefined,
          startDate: loc.startDate || undefined,
          endDate: loc.endDate || undefined,
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
      }
    },
    [],
  );

  const currentLoc = { areaId, province, district, startDate, endDate };

  useEffect(() => {
    void fetchPage(1, true, filters, sortBy, currentLoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, sortBy, areaId, province, district, startDate, endDate]);

  useEffect(() => {
    getFavoriteVehicleIds()
      .then((ids) => setFavoriteIds(new Set(ids)))
      .catch(() => undefined);
  }, []);

  function handleLoadMore() {
    if (loading || loadingMore || page >= totalPages) return;
    void fetchPage(page + 1, false, filters, sortBy, currentLoc);
  }

  async function handleToggleFavorite(vehicleId: number) {
    if (favLoadingId !== null) return;
    const isFav = favoriteIds.has(vehicleId);
    setFavLoadingId(vehicleId);
    try {
      if (isFav) {
        await removeFavoriteVehicle(vehicleId);
        setFavoriteIds((prev) => {
          const next = new Set(prev);
          next.delete(vehicleId);
          return next;
        });
      } else {
        await addFavoriteVehicle(vehicleId);
        setFavoriteIds((prev) => new Set(prev).add(vehicleId));
      }
    } catch {
      // guest hoặc lỗi mạng: bỏ qua
    } finally {
      setFavLoadingId(null);
    }
  }

  function openDetail(vehicleId: number) {
    navigation.navigate("VehicleDetail", {
      vehicleId,
      startDate,
      endDate,
    });
  }

  const chips: Chip[] = useMemo(() => {
    const list: Chip[] = [];
    if (filters.type) {
      list.push({
        key: "type",
        label: filters.type === "Car" ? "Ô tô" : "Xe máy",
        clear: () => setFilters((p) => ({ ...p, type: "" })),
      });
    }
    if (filters.brandName) {
      list.push({
        key: "brand",
        label: filters.brandName,
        clear: () =>
          setFilters((p) => ({ ...p, brandId: "", brandName: "", modelId: "", modelName: "" })),
      });
    }
    if (filters.modelName) {
      list.push({
        key: "model",
        label: filters.modelName,
        clear: () => setFilters((p) => ({ ...p, modelId: "", modelName: "" })),
      });
    }
    if (filters.seatCount) {
      list.push({
        key: "seat",
        label: `${filters.seatCount} chỗ`,
        clear: () => setFilters((p) => ({ ...p, seatCount: "" })),
      });
    }
    if (filters.minPrice || filters.maxPrice) {
      const min = filters.minPrice ? formatVehicleCurrency(Number(filters.minPrice)) : "0đ";
      const max = filters.maxPrice ? formatVehicleCurrency(Number(filters.maxPrice)) : "∞";
      list.push({
        key: "price",
        label: `${min} - ${max}`,
        clear: () => setFilters((p) => ({ ...p, minPrice: "", maxPrice: "" })),
      });
    }
    if (filters.keyword) {
      list.push({
        key: "keyword",
        label: `“${filters.keyword}”`,
        clear: () => setFilters((p) => ({ ...p, keyword: "" })),
      });
    }
    if (filters.fuelType) {
      list.push({
        key: "fuel",
        label: getFuelLabel(filters.fuelType),
        clear: () => setFilters((p) => ({ ...p, fuelType: "" })),
      });
    }
    if (filters.transmission) {
      list.push({
        key: "transmission",
        label: getTransmissionLabel(filters.transmission),
        clear: () => setFilters((p) => ({ ...p, transmission: "" })),
      });
    }
    if (filters.bodyType) {
      list.push({
        key: "body",
        label: filters.bodyType,
        clear: () => setFilters((p) => ({ ...p, bodyType: "" })),
      });
    }
    if (filters.bikeType) {
      list.push({
        key: "bike",
        label: filters.bikeType,
        clear: () => setFilters((p) => ({ ...p, bikeType: "" })),
      });
    }
    if (filters.customerLat && filters.customerLng) {
      list.push({
        key: "nearby",
        label: `Quanh đây ${filters.radiusKm || "10"}km`,
        clear: () =>
          setFilters((p) => ({
            ...p,
            pickupAddress: "",
            customerLat: "",
            customerLng: "",
            radiusKm: "10",
          })),
      });
    }
    return list;
  }, [filters]);

  const activeFilterCount =
    (filters.brandId ? 1 : 0) +
    (filters.modelId ? 1 : 0) +
    (filters.seatCount ? 1 : 0) +
    (filters.minPrice || filters.maxPrice ? 1 : 0) +
    (filters.keyword ? 1 : 0) +
    (filters.fuelType ? 1 : 0) +
    (filters.transmission ? 1 : 0) +
    (filters.bodyType ? 1 : 0) +
    (filters.bikeType ? 1 : 0) +
    (filters.customerLat && filters.customerLng ? 1 : 0);

  const sortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? "Mới nhất";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <View style={styles.headerText}>
          <Pressable onPress={() => setAreaVisible(true)} style={styles.headerRow}>
            <MapPin color={theme.brand} size={14} />
            <Text numberOfLines={1} style={styles.headerArea}>
              {areaText}
            </Text>
          </Pressable>
          <Pressable onPress={() => setPeriodVisible(true)} style={styles.headerRow}>
            <CalendarDays color={theme.brand} size={14} />
            <Text numberOfLines={1} style={styles.headerTime}>
              {formatPeriodSummary(startDate, endDate)}
            </Text>
          </Pressable>
        </View>
        <Pressable onPress={() => setFilterVisible(true)} style={styles.filterButton}>
          <SlidersHorizontal color={theme.brand} size={18} />
          {activeFilterCount > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            {chips.length > 0 ? (
              <View style={styles.chips}>
                {chips.map((chip) => (
                  <Pressable key={chip.key} onPress={chip.clear} style={styles.chip}>
                    <Text numberOfLines={1} style={styles.chipText}>
                      {chip.label}
                    </Text>
                    <X color={theme.brand} size={13} />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.countRow}>
              <Text style={styles.countText}>
                {loading
                  ? "Đang tìm xe..."
                  : `Tìm thấy ${totalCount} xe${rentalDays > 0 ? ` · ${rentalDays} ngày` : ""}`}
              </Text>
              <Pressable onPress={() => setSortVisible(true)} style={styles.sortButton}>
                <Text numberOfLines={1} style={styles.sortText}>
                  {sortLabel}
                </Text>
                <ChevronDown color={theme.muted} size={15} />
              </Pressable>
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <VehicleListCard
            vehicle={item}
            onOpen={() => openDetail(item.id)}
            onBook={() => openDetail(item.id)}
            isFavorite={favoriteIds.has(item.id)}
            favoriteLoading={favLoadingId === item.id}
            onToggleFavorite={() => void handleToggleFavorite(item.id)}
          />
        )}
        ListEmptyComponent={
          loading ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.brand} />
              <Text style={styles.muted}>Đang tìm xe phù hợp...</Text>
            </View>
          ) : (
            <View style={styles.center}>
              <Text style={styles.emptyTitle}>Chưa có xe phù hợp</Text>
              <Text style={styles.muted}>Thử đổi địa điểm, thời gian hoặc bộ lọc.</Text>
              <Pressable
                onPress={() => {
                  setFilters({ ...EMPTY_FILTERS, type: base.type });
                  setSortBy("");
                }}
                style={styles.resetButton}
              >
                <Text style={styles.resetText}>Đặt lại bộ lọc</Text>
              </Pressable>
            </View>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={theme.brand} style={styles.moreLoader} />
          ) : null
        }
      />

      <VehicleFilterSheet
        visible={filterVisible}
        initial={filters}
        resultCount={totalCount}
        onApply={setFilters}
        onClose={() => setFilterVisible(false)}
      />

      <AreaPickerSheet
        visible={areaVisible}
        province={province}
        district={district}
        onApply={(p, d, id) => {
          setProvince(p);
          setDistrict(d);
          setAreaId(id);
          void saveSearchPrefs({ province: p, district: d, areaId: id });
        }}
        onClose={() => setAreaVisible(false)}
      />

      <RentalPeriodSheet
        visible={periodVisible}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClose={() => setPeriodVisible(false)}
      />

      <Modal visible={sortVisible} transparent animationType="fade" onRequestClose={() => setSortVisible(false)}>
        <View style={styles.sortOverlay}>
          <Pressable style={styles.sortBackdrop} onPress={() => setSortVisible(false)} />
          <View style={styles.sortSheet}>
            <Text style={styles.sortTitle}>Sắp xếp</Text>
            {SORT_OPTIONS.map((o) => {
              const active = sortBy === o.value;
              return (
                <Pressable
                  key={o.label}
                  onPress={() => {
                    setSortBy(o.value);
                    setSortVisible(false);
                  }}
                  style={styles.sortOption}
                >
                  <Text style={[styles.sortOptionText, active && styles.sortOptionActive]}>
                    {o.label}
                  </Text>
                  {active ? <Check color={theme.brand} size={17} /> : null}
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: "transparent",
      alignItems: "center",
      justifyContent: "center",
    },
    headerText: { flex: 1, gap: 2 },
    headerRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    headerArea: { color: theme.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
    headerTime: { color: theme.muted, fontSize: 12, fontWeight: "600", flexShrink: 1 },
    filterButton: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    badge: {
      position: "absolute",
      right: -5,
      top: -5,
      minWidth: 18,
      height: 18,
      borderRadius: 9,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    badgeText: { color: theme.onBrand, fontSize: 10, fontWeight: "800" },
    list: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 32, gap: 12 },
    listHeader: { gap: 10, marginBottom: 2 },
    chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      maxWidth: "100%",
      borderRadius: 999,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    chipText: { color: theme.brand, fontSize: 12, fontWeight: "700", flexShrink: 1 },
    countRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    countText: { color: theme.text, fontSize: 13, fontWeight: "700", flex: 1 },
    sortButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: 180,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 11,
      paddingVertical: 6,
    },
    sortText: { color: theme.muted, fontSize: 12, fontWeight: "700", flexShrink: 1 },
    error: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    center: { alignItems: "center", paddingVertical: 48, gap: 8 },
    muted: { color: theme.muted, fontSize: 13 },
    emptyTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    resetButton: {
      marginTop: 8,
      height: 40,
      paddingHorizontal: 18,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    resetText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    moreLoader: { marginVertical: 12 },
    sortOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
    sortBackdrop: { ...StyleSheet.absoluteFill },
    sortSheet: {
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 28,
    },
    sortTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 6 },
    sortOption: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: 13,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    sortOptionText: { color: theme.text, fontSize: 14, fontWeight: "600" },
    sortOptionActive: { color: theme.brand, fontWeight: "800" },
  });
