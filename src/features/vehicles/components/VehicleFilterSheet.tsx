import { Search, X } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { useTranslation } from "react-i18next";
import { localizedOption } from "@/i18n/liveLabels";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { CatalogBrand, CatalogModel } from "@/features/vehicles/types";
import {
  getCatalogBrands,
  getCatalogModels,
} from "@/features/vehicles/services/catalogService";
import AddressAutocomplete from "@/features/locations/components/AddressAutocomplete";
import { DualRangeSlider, SingleSlider, SliderCaption } from "@/features/vehicles/components/FilterSlider";
import { formatVehicleCurrency } from "@/features/vehicles/components/VehicleListCard";

export type VehicleListFilters = {
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
  localizedOption("Gasoline", "common", "fuel.Gasoline"),
  localizedOption("Diesel", "common", "fuel.Diesel"),
  localizedOption("Electric", "common", "fuel.Electric"),
  localizedOption("Hybrid", "common", "fuel.Hybrid"),
  localizedOption("Plug-in Hybrid", "common", "fuel.Plug-in Hybrid"),
];

export const TRANSMISSION_OPTIONS = [
  localizedOption("Automatic", "vehicleList", "options.transmission.automatic"),
  localizedOption("Manual", "vehicleList", "options.transmission.manual"),
  localizedOption("CVT", "vehicleList", "options.transmission.cvt"),
  localizedOption("DCT", "vehicleList", "options.transmission.dct"),
];

export const CAR_BODY_TYPES = [
  localizedOption("Sedan", "vehicleList", "options.bodyTypes.sedan"),
  localizedOption("SUV", "vehicleList", "options.bodyTypes.suv"),
  localizedOption("Hatchback", "vehicleList", "options.bodyTypes.hatchback"),
  localizedOption("Coupe", "vehicleList", "options.bodyTypes.coupe"),
  localizedOption("Convertible", "vehicleList", "options.bodyTypes.convertible"),
  localizedOption("Pickup", "vehicleList", "options.bodyTypes.pickup"),
  localizedOption("MPV/Minivan", "vehicleList", "options.bodyTypes.mpv"),
  localizedOption("Wagon", "vehicleList", "options.bodyTypes.wagon"),
];

export const BIKE_TYPE_OPTIONS = [
  localizedOption("Scooter", "common", "bikeType.Scooter"),
  localizedOption("Manual", "common", "bikeType.Manual"),
  localizedOption("Clutch", "common", "bikeType.Clutch"),
  localizedOption("Sport", "common", "bikeType.Sport"),
  localizedOption("Cruiser", "common", "bikeType.Cruiser"),
  localizedOption("Adventure", "common", "bikeType.Adventure"),
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
  initialAiQuery: string;
  searching: boolean;
  resultCount?: number;
  onApply: (filters: VehicleListFilters, aiQuery: string) => void;
  onClose: () => void;
};

export default function VehicleFilterSheet({
  visible,
  initial,
  initialAiQuery,
  searching,
  resultCount,
  onApply,
  onClose,
}: VehicleFilterSheetProps) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [draft, setDraft] = useState<VehicleListFilters>(initial);
  const [draftAiQuery, setDraftAiQuery] = useState(initialAiQuery);
  const [brands, setBrands] = useState<CatalogBrand[]>([]);
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [loadingBrands, setLoadingBrands] = useState(false);

  const [sliding, setSliding] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDraft(initial);
    setDraftAiQuery(initialAiQuery);
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
    setDraftAiQuery("");
    setModels([]);
  }

  function handleSelectPickupAddress(address: string, latitude: number | null, longitude: number | null) {
    set("pickupAddress", address);
    set("customerLat", latitude != null ? String(latitude) : "");
    set("customerLng", longitude != null ? String(longitude) : "");
    if (latitude != null && longitude != null && !draft.radiusKm) set("radiusKm", "10");
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
          <AppText style={[styles.chipText, !current && styles.chipTextActive]}>
            {t("vehicleList:options.all")}
          </AppText>
        </Pressable>
        {options.map((o) => {
          const active = current === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onPick(active ? "" : o.value)}
              style={[styles.chip, active && styles.chipActive]}
            >
              <AppText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</AppText>
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel={t("mobile:vehicleList.filters.closeAria")} />
      <Animated.View
        style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16), transform: [{ translateY }] }]}
      >
          <View style={styles.handle} />
          <View style={styles.header}>
            <AppText display style={styles.headerTitle}>{t("vehicleList:filters.toggle")}</AppText>
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
            <AppText style={styles.label}>{t("mobile:vehicleList.filters.smartSearch")}</AppText>
            <View style={styles.searchBox}>
              <Search color={theme.placeholder} size={15} />
              <TextInput
                value={draftAiQuery}
                onChangeText={setDraftAiQuery}
                placeholder={t("mobile:vehicleList.filters.smartSearchPlaceholder")}
                placeholderTextColor={theme.placeholder}
                style={styles.searchInput}
              />
              {draftAiQuery ? (
                <Pressable onPress={() => setDraftAiQuery("")} accessibilityLabel={t("mobile:vehicleList.filters.clearSmartSearchAria")}>
                  <X color={theme.muted} size={16} />
                </Pressable>
              ) : null}
            </View>

            <AddressAutocomplete
              value={draft.pickupAddress}
              onChange={(text) => set("pickupAddress", text)}
              onSelect={(selected) => handleSelectPickupAddress(selected.address, selected.latitude, selected.longitude)}
              onManualChange={() => {
                set("customerLat", "");
                set("customerLng", "");
              }}
              label={t("vehicleList:filters.pickupAddress")}
              placeholder={t("mobile:vehicleList.filters.pickupPlaceholder")}
            />

            <View style={styles.sectionHead}>
              <AppText style={styles.sectionLabel}>{t("vehicleList:radius.label")}</AppText>
              <View style={styles.kmBox}>
                <TextInput
                  value={draft.radiusKm}
                  onChangeText={(v) => set("radiusKm", v.replace(/[^0-9]/g, ""))}
                  onBlur={normalizeRadius}
                  keyboardType="numeric"
                  style={styles.kmInput}
                />
                <AppText style={styles.kmSuffix}>km</AppText>
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
              <AppText style={styles.hint}>{t("mobile:vehicleList.filters.radiusHint")}</AppText>
            ) : null}

            <AppText style={styles.label}>{t("vehicleList:filters.type")}</AppText>
            <View style={styles.chipRow}>
              {[
                { value: "", label: t("vehicleList:options.all") },
                { value: "Car", label: t("common:car") },
                { value: "Motorbike", label: t("common:motorbike") },
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
                    <AppText style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</AppText>
                  </Pressable>
                );
              })}
            </View>

            <AppText style={styles.label}>{t("vehicleList:filters.brand")}</AppText>
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
                  <AppText style={[styles.chipText, !draft.brandId && styles.chipTextActive]}>
                    {t("vehicleList:options.all")}
                  </AppText>
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
                      <AppText style={[styles.chipText, active && styles.chipTextActive]}>{b.name}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {draft.brandId ? (
              <>
                <AppText style={styles.label}>{t("vehicleList:filters.model")}</AppText>
                <View style={styles.chipWrap}>
                  <Pressable
                    onPress={() => {
                      set("modelId", "");
                      set("modelName", "");
                    }}
                    style={[styles.chip, !draft.modelId && styles.chipActive]}
                  >
                    <AppText style={[styles.chipText, !draft.modelId && styles.chipTextActive]}>
                      {t("vehicleList:options.all")}
                    </AppText>
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
                        <AppText style={[styles.chipText, active && styles.chipTextActive]}>
                          {m.name}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            {showBodyType ? (
              <>
                <AppText style={styles.label}>{t("mobile:vehicleList.filters.bodyTypeLabel")}</AppText>
                {renderChips(CAR_BODY_TYPES, draft.bodyType, (v) => set("bodyType", v))}
              </>
            ) : null}

            {showBikeType ? (
              <>
                <AppText style={styles.label}>{t("vehicleList:filters.bikeType")}</AppText>
                {renderChips(BIKE_TYPE_OPTIONS, draft.bikeType, (v) => set("bikeType", v))}
              </>
            ) : null}

            <AppText style={styles.label}>{t("vehicleList:filters.fuel")}</AppText>
            {renderChips(FUEL_OPTIONS, draft.fuelType, (v) => set("fuelType", v))}

            <AppText style={styles.label}>{t("vehicleList:filters.transmission")}</AppText>
            {renderChips(TRANSMISSION_OPTIONS, draft.transmission, (v) => set("transmission", v))}

            <AppText style={styles.label}>{t("vehicleList:filters.seats")}</AppText>
            <View style={styles.chipWrap}>
              <Pressable
                onPress={() => set("seatCount", "")}
                style={[styles.chip, !draft.seatCount && styles.chipActive]}
              >
                <AppText style={[styles.chipText, !draft.seatCount && styles.chipTextActive]}>
                  {t("vehicleList:options.all")}
                </AppText>
              </Pressable>
              {SEAT_OPTIONS.map((s) => {
                const active = draft.seatCount === s;
                return (
                  <Pressable
                    key={s}
                    onPress={() => set("seatCount", active ? "" : s)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <AppText style={[styles.chipText, active && styles.chipTextActive]}>
                      {t("vehicleList:options.seats", { seats: s })}
                    </AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.sectionHead}>
              <AppText style={styles.sectionLabel}>{t("vehicleList:price.rangeLabel")}</AppText>
              <AppText style={styles.sectionSummary}>
                {formatCompact(priceLow)} – {formatCompact(priceHigh)}
              </AppText>
            </View>
            <View style={styles.priceInputs}>
              <View style={styles.priceField}>
                <AppText style={styles.miniLabel}>{t("vehicleList:price.from")}</AppText>
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
                <AppText style={styles.miniLabel}>{t("vehicleList:price.to")}</AppText>
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
              <AppText style={styles.clearText}>{t("mobile:vehicleList.filters.reset")}</AppText>
            </Pressable>
            <Pressable
              disabled={searching}
              onPress={() => {
                onApply(draft, draftAiQuery.trim());
                handleClose();
              }}
              style={[styles.doneButton, searching && styles.doneButtonDisabled]}
            >
              {searching ? <ActivityIndicator size="small" color={theme.onBrand} /> : (
                <AppText style={styles.doneText}>
                  {t("vehicleList:filters.apply")}{resultCount !== undefined ? ` (${resultCount})` : ""}
                </AppText>
              )}
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
    doneButtonDisabled: { opacity: 0.55 },
    doneText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
