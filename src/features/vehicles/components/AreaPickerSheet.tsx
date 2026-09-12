import { ArrowLeft, Check, MapPin, Search, X } from "lucide-react-native";
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
import type { CatalogArea } from "@/features/vehicles/types";
import { getCatalogAreas, normalizeSearchText } from "@/features/vehicles/services/catalogService";

type AreaPickerSheetProps = {
  visible: boolean;
  province: string;
  district: string;
  onApply: (province: string, district: string, areaId?: number) => void;
  onClose: () => void;
};

type Step = "province" | "district";

export default function AreaPickerSheet({
  visible,
  province,
  district,
  onApply,
  onClose,
}: AreaPickerSheetProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const slideAnim = useRef(new Animated.Value(0)).current;

  const [areas, setAreas] = useState<CatalogArea[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>("province");
  const [draftProvince, setDraftProvince] = useState(province);
  const [draftDistrict, setDraftDistrict] = useState(district);
  const [keyword, setKeyword] = useState("");

  useEffect(() => {
    if (!visible) return;
    setDraftProvince(province);
    setDraftDistrict(district);
    setKeyword("");
    setStep("province");
    setLoadError("");
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const data = await getCatalogAreas();
        if (!cancelled) setAreas(data);
      } catch {
        if (!cancelled) setLoadError("Không tải được danh sách khu vực. Thử lại sau.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    Animated.timing(slideAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    return () => {
      cancelled = true;
    };
  }, [visible, province, district, slideAnim]);

  const provinces = useMemo(() => {
    const set = new Map<string, number>();
    for (const a of areas) {
      if (!a.province) continue;
      set.set(a.province, (set.get(a.province) ?? 0) + 1);
    }
    return [...set.entries()]
      .sort((x, y) => x[0].localeCompare(y[0], "vi"))
      .map(([name, count]) => ({ name, count }));
  }, [areas]);

  const districts = useMemo(() => {
    if (!draftProvince) return [];
    return areas
      .filter((a) => a.province === draftProvince)
      .map((a) => ({ name: a.district, id: a.id }))
      .filter((d) => d.name)
      .sort((x, y) => x.name.localeCompare(y.name, "vi"));
  }, [areas, draftProvince]);

  const filteredProvinces = useMemo(() => {
    const k = normalizeSearchText(keyword);
    if (!k) return provinces;
    return provinces.filter((p) => normalizeSearchText(p.name).includes(k));
  }, [provinces, keyword]);

  const filteredDistricts = useMemo(() => {
    const k = normalizeSearchText(keyword);
    if (!k) return districts;
    return districts.filter((d) => normalizeSearchText(d.name).includes(k));
  }, [districts, keyword]);

  function handleClose() {
    Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
      onClose(),
    );
  }

  function handleApply() {
    const match = areas.find(
      (a) => a.province === draftProvince && a.district === draftDistrict,
    );
    onApply(draftProvince, draftDistrict, match?.id);
    handleClose();
  }

  function handleClear() {
    setDraftProvince("");
    setDraftDistrict("");
    setStep("province");
  }

  const translateY = slideAnim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] });
  const canApply = Boolean(draftProvince);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Đóng chọn địa điểm" />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              {step === "district" ? (
                <Pressable onPress={() => setStep("province")} style={styles.backButton}>
                  <ArrowLeft color={theme.text} size={18} />
                </Pressable>
              ) : null}
              <View>
                <Text style={styles.headerTitle}>
                  {step === "province" ? "Chọn tỉnh / thành phố" : `Xã tại ${draftProvince}`}
                </Text>
                <Text style={styles.headerSub}>
                  {draftProvince
                    ? `${draftProvince}${draftDistrict ? ` · ${draftDistrict}` : ""}`
                    : "Chọn nơi bạn muốn thuê xe"}
                </Text>
              </View>
            </View>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <X color={theme.muted} size={18} />
            </Pressable>
          </View>

          <View style={styles.stepRow}>
            <View style={[styles.stepDot, styles.stepDone]} />
            <View style={[styles.stepLine, draftProvince && styles.stepDone]} />
            <View style={[styles.stepDot, draftProvince && styles.stepDone]} />
            <Text style={styles.stepText}>Tỉnh → Phường/Xã (xã tùy chọn)</Text>
          </View>

          <View style={styles.searchBox}>
            <Search color={theme.placeholder} size={16} />
            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              placeholder={step === "province" ? "Tìm tỉnh / thành phố..." : "Tìm phường / xã..."}
              placeholderTextColor={theme.placeholder}
              style={styles.searchInput}
            />
            {keyword ? (
              <Pressable onPress={() => setKeyword("")}>
                <X color={theme.muted} size={15} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={theme.brand} />
                <Text style={styles.muted}>Đang tải khu vực...</Text>
              </View>
            ) : loadError ? (
              <View style={styles.center}>
                <Text style={styles.error}>{loadError}</Text>
              </View>
            ) : step === "province" ? (
              filteredProvinces.map((p) => {
                const selected = p.name === draftProvince;
                return (
                  <Pressable
                    key={p.name}
                    onPress={() => {
                      setDraftProvince(p.name);
                      setDraftDistrict("");
                      setKeyword("");
                      setStep("district");
                    }}
                    style={[styles.item, selected && styles.itemSelected]}
                  >
                    <MapPin color={selected ? theme.brand : theme.muted} size={17} />
                    <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
                      {p.name}
                    </Text>
                    <Text style={styles.itemCount}>{p.count}</Text>
                    {selected ? <Check color={theme.brand} size={16} /> : null}
                  </Pressable>
                );
              })
            ) : filteredDistricts.length === 0 ? (
              <View style={styles.center}>
                <Text style={styles.muted}>Chưa có phường / xã cho khu vực này.</Text>
              </View>
            ) : (
              filteredDistricts.map((d) => {
                const selected = d.name === draftDistrict;
                return (
                  <Pressable
                    key={`${d.id}-${d.name}`}
                    onPress={() => setDraftDistrict(selected ? "" : d.name)}
                    style={[styles.item, selected && styles.itemSelected]}
                  >
                    <MapPin color={selected ? theme.brand : theme.muted} size={17} />
                    <Text style={[styles.itemText, selected && styles.itemTextSelected]}>
                      {d.name}
                    </Text>
                    {selected ? <Check color={theme.brand} size={16} /> : null}
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable onPress={handleClear}>
              <Text style={styles.clearText}>Xóa</Text>
            </Pressable>
            <View style={styles.footerButtons}>
              {step === "district" ? (
                <Pressable onPress={() => setStep("province")} style={styles.ghostButton}>
                  <Text style={styles.ghostText}>Đổi tỉnh</Text>
                </Pressable>
              ) : null}
              <Pressable
                disabled={!canApply}
                onPress={handleApply}
                style={[styles.doneButton, !canApply && styles.doneDisabled]}
              >
                <Text style={styles.doneText}>Áp dụng</Text>
              </Pressable>
            </View>
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
      height: "68%",
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
    header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
    headerLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    headerSub: { color: theme.muted, fontSize: 12, marginTop: 2 },
    closeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    stepRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 10 },
    stepDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: theme.border },
    stepLine: { width: 28, height: 2, borderRadius: 1, backgroundColor: theme.border },
    stepDone: { backgroundColor: theme.brand },
    stepText: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.input,
      paddingHorizontal: 12,
      height: 44,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 14 },
    list: { flex: 1, marginTop: 10 },
    item: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 10,
      borderRadius: 12,
    },
    itemSelected: { backgroundColor: theme.brandSoft },
    itemText: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "600" },
    itemTextSelected: { color: theme.brand, fontWeight: "800" },
    itemCount: { color: theme.faint, fontSize: 12 },
    center: { alignItems: "center", paddingVertical: 28, gap: 8 },
    muted: { color: theme.muted, fontSize: 13 },
    error: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingTop: 12,
      borderTopWidth: 1,
      borderTopColor: theme.divider,
    },
    clearText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    footerButtons: { flexDirection: "row", gap: 8 },
    ghostButton: {
      height: 44,
      paddingHorizontal: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    ghostText: { color: theme.text, fontSize: 14, fontWeight: "700" },
    doneButton: {
      height: 44,
      paddingHorizontal: 22,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
    },
    doneDisabled: { opacity: 0.4 },
    doneText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
