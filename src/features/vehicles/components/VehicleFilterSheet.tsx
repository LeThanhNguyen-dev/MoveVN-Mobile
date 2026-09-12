import { MapPin, Search, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { CatalogBrand, CatalogModel } from "@/features/vehicles/types";
import type { GoongPlacePrediction } from "@/features/locations/types";
import {
  getCatalogBrands,
  getCatalogModels,
} from "@/features/vehicles/services/catalogService";
import {
  autocompleteGoongPlaces,
  getGoongPlaceDetail,
} from "@/features/locations/services/locationService";
import { DualRangeSlider, SingleSlider, SliderCaption } from "@/features/vehicles/components/FilterSlider";
import { formatVehicleCurrency } from "@/features/vehicles/components/VehicleListCard";

export type VehicleListFilters = {
  keyword: string;
  type: "" | "Car" | "Motorbike";
  brandId: string;
  brandName: string;
  modelId: string;
  modelName: string;
  seatCount: string;
  minPrice: string;
  maxPrice: string;
  fuelType: string;
  transmission: string;
  bodyType: string;
  bikeType: string;
  pickupAddress: string;
  customerLat: string;
  customerLng: string;
  radiusKm: string;
};

export const EMPTY_FILTERS: VehicleListFilters = {
  keyword: "",
  type: "",
  brandId: "",
  brandName: "",
  modelId: "",
  modelName: "",
  seatCount: "",
  minPrice: "",
  maxPrice: "",
  fuelType: "",
  transmission: "",
  bodyType: "",
  bikeType: "",
  pickupAddress: "",
  customerLat: "",
  customerLng: "",
  radiusKm: "10",
};

export const SEAT_OPTIONS = ["2", "4", "5", "7", "8", "9", "16", "29", "30"];

export const FUEL_OPTIONS = [
  { value: "Gasoline", label: "Xăng" },
  { value: "Diesel", label: "Dầu" },
  { value: "Electric", label: "Điện" },
  { value: "Hybrid", label: "Hybrid" },
  { value: "Plug-in Hybrid", label: "Plug-in Hybrid" },
];

export const TRANSMISSION_OPTIONS = [
  { value: "Automatic", label: "Số tự động" },
  { value: "Manual", label: "Số sàn" },
  { value: "CVT", label: "CVT" },
  { value: "DCT", label: "DCT" },
];

export const CAR_BODY_TYPES = [
  { value: "Sedan", label: "Sedan" },
  { value: "SUV", label: "SUV" },
  { value: "Hatchback", label: "Hatchback" },
  { value: "Coupe", label: "Coupe" },
  { value: "Convertible", label: "Mui trần" },
  { value: "Pickup", label: "Bán tải" },
  { value: "MPV/Minivan", label: "MPV / Minivan" },
  { value: "Wagon", label: "Wagon" },
];

export const BIKE_TYPE_OPTIONS = [
  { value: "Scooter", label: "Xe tay ga" },
  { value: "Manual", label: "Xe số" },
  { value: "Clutch", label: "Xe côn tay" },
  { value: "Sport", label: "Xe thể thao" },
  { value: "Cruiser", label: "Cruiser" },
  { value: "Adventure", label: "Adventure" },
];

export const MIN_PRICE_LIMIT = 0;
export const MAX_PRICE_LIMIT = 2_000_000;
export const PRICE_STEP = 50_000;
export const MIN_RADIUS_KM = 1;
export const MAX_RADIUS_KM = 200;

export function getFuelLabel(value: string): string {
  return FUEL_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function getTransmissionLabel(value: string): string {
  return TRANSMISSION_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

type VehicleFilterSheetProps = {
  visible: boolean;
  initial: VehicleListFilters;
  resultCount?: number;
  onApply: (filters: VehicleListFilters) => void;
  onClose: () => void;
};

export default function VehicleFilterSheet({
  visible,
  initial,
  resultCount,
  onApply,
  onClose,
}: VehicleFilterSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [draft, setDraft] = useState<VehicleListFilters>(initial);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  const [predictions, setPredictions] = useState<GoongPlacePrediction[]>([]);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [sliding, setSliding] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setPredictions([]);
    let cancelled = false;
    async function load() {
      setLoadingBrands(true);
      try {
        const data = await getCatalogBrands(initial.type || undefined);
        if (!cancelled) setBrands(data);
      } catch {
        if (!cancelled) setBrands([]);
      } finally {
        if (!cancelled) setLoadingBrands(false);
      }
    }
    void load();
    Animated.timing(slideAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible || !draft.brandId) {
      setModels([]);
      return;
    }
    let cancelled = false;
    getCatalogModels(Number(draft.brandId))
      .then((data) => {
        if (!cancelled) setModels(data);
      })
      .catch(() => {
        if (!cancelled) setModels([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, draft.brandId]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function handleClose() {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      onClose(),
    );
  }

  function set<K extends keyof VehicleListFilters>(key: K, value: VehicleListFilters[K]) {
    setDraft((prev) => ({ ...prev, [key]: value }));
  }

  function handleClear() {
    setDraft(EMPTY_FILTERS);
    setModels([]);
    setPredictions([]);
  }

  function handleAddressChange(text: string) {
    set("pickupAddress", text);
    set("customerLat", "");
    set("customerLng", "");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (text.trim().length < 3) {
      setPredictions([]);
      setLoadingPlaces(false);
      return;
    }
    setLoadingPlaces(true);
    debounceRef.current = setTimeout(() => {
      autocompleteGoongPlaces(text.trim(), 5)
        .then((list) => setPredictions(list))
        .catch(() => setPredictions([]))
        .finally(() => setLoadingPlaces(false));
    }, 350);
  }

  async function handleSelectPlace(item: GoongPlacePrediction) {
    set("pickupAddress", item.description);
    setPredictions([]);
    try {
      const detail = await getGoongPlaceDetail(item.placeId);
      if (detail) {
        set("customerLat", String(detail.latitude));
        set("customerLng", String(detail.longitude));
        if (!draft.radiusKm) set("radiusKm", "10");
      }
    } catch {
      // giữ địa chỉ text, không có tọa độ thì không lọc khoảng cách
    }
  }

  const priceLow = draft.minPrice ? Number(draft.minPrice) : MIN_PRICE_LIMIT;
  const priceHigh = draft.maxPrice ? Number(draft.maxPrice) : MAX_PRICE_LIMIT;
  const radiusValue = draft.radiusKm ? Number(draft.radiusKm) : 10;
  const showBodyType = draft.type !== "Motorbike";
  const showBikeType = draft.type !== "Car";
  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });

  function formatCompact(v: number): string {
    return `${v.toLocaleString("vi-VN")}đ`;
  }

  function normalizePriceBounds() {
    const lo = draft.minPrice ? Math.max(MIN_PRICE_LIMIT, Math.min(Number(draft.minPrice), priceHigh)) : MIN_PRICE_LIMIT;
    const hi = draft.maxPrice ? Math.min(MAX_PRICE_LIMIT, Math.max(Number(draft.maxPrice), lo)) : MAX_PRICE_LIMIT;
    set("minPrice", lo <= MIN_PRICE_LIMIT ? "" : String(lo));
    set("maxPrice", hi >= MAX_PRICE_LIMIT ? "" : String(hi));
  }

  function normalizeRadius() {
    const v = draft.radiusKm ? Number(draft.radiusKm) : 10;
    const clamped = Math.min(MAX_RADIUS_KM, Math.max(MIN_RADIUS_KM, Number.isFinite(v) ? v : 10));
    set("radiusKm", String(clamped));
  }

  function renderChips(
    options: { value: string; label: string }[],
    current: string,
    onPick: (value: string) => void,
  ) {
    return (
      <View style={styles.chipWrap}>
        <Pressable
          onPress={() => onPick("")}
          style={[styles.chip, !current && styles.chipActive]}
        >
          <Text style={[styles.chipText, !current && styles.chipTextActive]}>Tất cả</Text>
        </Pressable>
        {options.map((o) => {
          const active = current === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onPick(active ? "" : o.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Đóng bộ lọc" />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Bộ lọc</Text>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X color={theme.muted} size={18} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.body}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            scrollEnabled={!sliding}
          >
            <Text style={styles.label}>Từ khóa</Text>
            <View style={styles.searchBox}>
              <Search color={theme.placeholder} size={15} />
              <TextInput
                value={draft.keyword}
                onChangeText={(v) => set("keyword", v)}
                placeholder="Tìm theo tên xe, hãng xe..."
                placeholderTextColor={theme.placeholder}
                style={styles.searchInput}
              />
            </View>

            <Text style={styles.label}>Địa chỉ nhận xe</Text>
            <View style={styles.searchBox}>
              <MapPin color={theme.placeholder} size={15} />
              <TextInput
                value={draft.pickupAddress}
                onChangeText={handleAddressChange}
                placeholder="Nhập địa chỉ để lọc theo khoảng cách"
                placeholderTextColor={theme.placeholder}
                style={styles.searchInput}
              />
              {loadingPlaces ? (
                <ActivityIndicator color={theme.brand} size="small" />
              ) : draft.pickupAddress ? (
                <Pressable
                  onPress={() => {
                    set("pickupAddress", "");
                    set("customerLat", "");
                    set("customerLng", "");
                    setPredictions([]);
                  }}
                >
                  <X color={theme.muted} size={15} />
                </Pressable>
              ) : null}
            </View>
            {predictions.length > 0 ? (
              <View style={styles.placeList}>
                {predictions.map((p) => (
                  <Pressable
                    key={p.placeId}
                    onPress={() => void handleSelectPlace(p)}
                    style={styles.placeItem}
                  >
                    <MapPin color={theme.brand} size={15} />
                    <View style={styles.placeText}>
                      <Text numberOfLines={1} style={styles.placeMain}>
                        {p.structuredFormatting?.mainText || p.description}
                      </Text>
                      <Text numberOfLines={1} style={styles.placeSub}>
                        {p.structuredFormatting?.secondaryText || ""}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Bán kính tìm kiếm</Text>
              <View style={styles.kmBox}>
                <TextInput
                  value={draft.radiusKm}
                  onChangeText={(v) => set("radiusKm", v.replace(/[^0-9]/g, ""))}
                  onBlur={normalizeRadius}
                  keyboardType="numeric"
                  style={styles.kmInput}
                />
                <Text style={styles.kmSuffix}>km</Text>
              </View>
            </View>
            <SingleSlider
              min={MIN_RADIUS_KM}
              max={MAX_RADIUS_KM}
              step={1}
              value={radiusValue}
              onChange={(v) => set("radiusKm", String(v))}
              onDragStateChange={setSliding}
            />
            <SliderCaption left="1km" right="200km" />
            {!draft.customerLat || !draft.customerLng ? (
              <Text style={styles.hint}>Chọn địa chỉ nhận xe ở trên để áp dụng lọc khoảng cách.</Text>
            ) : null}

            <Text style={styles.label}>Loại xe</Text>
            <View style={styles.chipRow}>
              {[
                { value: "", label: "Tất cả" },
                { value: "Car", label: "Ô tô" },
                { value: "Motorbike", label: "Xe máy" },
              ].map((o) => {
                const active = draft.type === o.value;
                return (
                  <Pressable
                    key={o.label}
                    onPress={() => {
                      set("type", o.value as VehicleListFilters["type"]);
                      set("brandId", "");
                      set("brandName", "");
                      set("modelId", "");
                      set("modelName", "");
                      set("bodyType", "");
                      set("bikeType", "");
                      setModels([]);
                      getCatalogBrands(o.value || undefined)
                        .then(setBrands)
                        .catch(() => setBrands([]));
                    }}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Hãng xe</Text>
            {loadingBrands ? (
              <ActivityIndicator color={theme.brand} style={styles.loader} />
            ) : (
              <View style={styles.chipWrap}>
                <Pressable
                  onPress={() => {
                    set("brandId", "");
                    set("brandName", "");
                    set("modelId", "");
                    set("modelName", "");
                  }}
                  style={[styles.chip, !draft.brandId && styles.chipActive]}
                >
                  <Text style={[styles.chipText, !draft.brandId && styles.chipTextActive]}>
                    Tất cả
                  </Text>
                </Pressable>
                {brands.map((b) => {
                  const active = draft.brandId === String(b.id);
                  return (
                    <Pressable
                      key={b.id}
                      onPress={() => {
                        set("brandId", active ? "" : String(b.id));
                        set("brandName", active ? "" : b.name);
                        set("modelId", "");
                        set("modelName", "");
                      }}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{b.name}</Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {draft.brandId ? (
              <>
                <Text style={styles.label}>Dòng xe</Text>
                <View style={styles.chipWrap}>
                  <Pressable
                    onPress={() => {
                      set("modelId", "");
                      set("modelName", "");
                    }}
                    style={[styles.chip, !draft.modelId && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, !draft.modelId && styles.chipTextActive]}>
                      Tất cả
                    </Text>
                  </Pressable>
                  {models.map((m) => {
                    const active = draft.modelId === String(m.id);
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => {
                          set("modelId", active ? "" : String(m.id));
                          set("modelName", active ? "" : m.name);
                        }}
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {m.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {showBodyType ? (
              <>
                <Text style={styles.label}>Kiểu thân xe</Text>
                {renderChips(CAR_BODY_TYPES, draft.bodyType, (v) => set("bodyType", v))}
              </>
            ) : null}

            {showBikeType ? (
              <>
                <Text style={styles.label}>Loại xe máy</Text>
                {renderChips(BIKE_TYPE_OPTIONS, draft.bikeType, (v) => set("bikeType", v))}
              </>
            ) : null}

            <Text style={styles.label}>Nhiên liệu</Text>
            {renderChips(FUEL_OPTIONS, draft.fuelType, (v) => set("fuelType", v))}

            <Text style={styles.label}>Hộp số</Text>
            {renderChips(TRANSMISSION_OPTIONS, draft.transmission, (v) => set("transmission", v))}

            <Text style={styles.label}>Số chỗ</Text>
            <View style={styles.chipWrap}>
              <Pressable
                onPress={() => set("seatCount", "")}
                style={[styles.chip, !draft.seatCount && styles.chipActive]}
              >
                <Text style={[styles.chipText, !draft.seatCount && styles.chipTextActive]}>
                  Tất cả
                </Text>
              </Pressable>
              {SEAT_OPTIONS.map((s) => {
                const active = draft.seatCount === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => set("seatCount", active ? "" : s)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s} chỗ</Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionLabel}>Khoảng giá</Text>
              <Text style={styles.sectionSummary}>
                {formatCompact(priceLow)} – {formatCompact(priceHigh)}
              </Text>
            </View>
            <View style={styles.priceInputs}>
              <View style={styles.priceField}>
                <Text style={styles.miniLabel}>Giá từ</Text>
                <TextInput
                  value={draft.minPrice}
                  onChangeText={(v) => set("minPrice", v.replace(/[^0-9]/g, ""))}
                  onBlur={normalizePriceBounds}
                  placeholder="0"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  style={styles.priceInput}
                />
              </View>
              <View style={styles.priceField}>
                <Text style={styles.miniLabel}>Giá đến</Text>
                <TextInput
                  value={draft.maxPrice}
                  onChangeText={(v) => set("maxPrice", v.replace(/[^0-9]/g, ""))}
                  onBlur={normalizePriceBounds}
                  placeholder="2.000.000"
                  placeholderTextColor={theme.placeholder}
                  keyboardType="numeric"
                  style={styles.priceInput}
                />
              </View>
            </View>
            <DualRangeSlider
              min={MIN_PRICE_LIMIT}
              max={MAX_PRICE_LIMIT}
              step={PRICE_STEP}
              low={priceLow}
              high={priceHigh}
              onLowChange={(v) => set("minPrice", v <= MIN_PRICE_LIMIT ? "" : String(v))}
              onHighChange={(v) => set("maxPrice", v >= MAX_PRICE_LIMIT ? "" : String(v))}
              onDragStateChange={setSliding}
            />
            <SliderCaption left="0đ" right="2.000.000đ" />
            <View style={styles.bottomPad} />
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleClear}>
              <Text style={styles.clearText}>Reset</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                onApply(draft);
                handleClose();
              }}
              style={styles.doneButton}
            >
              <Text style={styles.doneText}>
                Áp dụng{resultCount !== undefined ? ` (${resultCount})` : ""}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: theme.overlay },
    backdrop: { ...StyleSheet.absoluteFill },
    sheet: {
      width: "100%",
      height: "82%",
      backgroundColor: theme.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 16,
    },
    handle: {
      alignSelf: "center",
      width: 44,
      height: 5,
      borderRadius: 3,
      backgroundColor: theme.border,
      marginBottom: 10,
    },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, marginTop: 8 },
    label: { color: theme.text, fontSize: 13, fontWeight: "800", marginTop: 14, marginBottom: 8 },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.input,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 14 },
    sectionHead: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 14,
      marginBottom: 8,
    },
    sectionLabel: { color: theme.text, fontSize: 13, fontWeight: "800" },
    sectionSummary: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    priceInputs: { flexDirection: "row", gap: 8, marginBottom: 6 },
    priceField: { flex: 1, gap: 4 },
    miniLabel: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    priceInput: {
      height: 44,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.input,
      paddingHorizontal: 12,
      color: theme.text,
      fontSize: 14,
    },
    kmBox: {
      flexDirection: "row",
      alignItems: "center",
      width: 96,
      height: 38,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.input,
      paddingHorizontal: 10,
    },
    kmInput: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "700" },
    kmSuffix: { color: theme.placeholder, fontSize: 12 },
    chipRow: { flexDirection: "row", gap: 8 },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingHorizontal: 14,
      height: 36,
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: theme.onBrand },
    loader: { marginVertical: 8 },
    placeList: {
      marginTop: 6,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      overflow: "hidden",
    },
    placeItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    placeText: { flex: 1 },
    placeMain: { color: theme.text, fontSize: 13, fontWeight: "700" },
    placeSub: { color: theme.muted, fontSize: 11, marginTop: 1 },
    hint: { color: theme.muted, fontSize: 12, marginTop: 6 },
    bottomPad: { height: 12 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
      marginTop: 8,
    },
    clearText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    doneButton: {
      height: 44,
      paddingHorizontal: 22,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    doneText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
