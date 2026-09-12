import { CalendarDays, Car, MapPin, Motorbike, Search } from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AppDashboardHeader from "@/features/app/components/AppDashboardHeader";
import type { AuthUser } from "@/features/auth/types";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import AreaPickerSheet from "@/features/vehicles/components/AreaPickerSheet";
import {
  calculateRentalDays,
  formatPeriodSummary,
  getDefaultRentalPeriod,
} from "@/features/vehicles/utils/rentalPeriod";
import { loadSearchPrefs, saveSearchPrefs } from "@/features/vehicles/utils/searchPrefs";
import { useFocusEffect } from "@react-navigation/native";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type VehicleTab = "Car" | "Motorbike";

export default function CustomerExploreScreen({
  onAvatarPress,
  onSearch,
  user,
}: {
  onAvatarPress?: () => void;
  onSearch?: (params: ExploreStackParamList["VehicleList"]) => void;
  user: AuthUser;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [searchTab, setSearchTab] = useState<VehicleTab>("Car");
  const [province, setProvince] = useState("");
  const [district, setDistrict] = useState("");
  const [areaId, setAreaId] = useState<number | undefined>(undefined);
  const [defaultPeriod] = useState(() => getDefaultRentalPeriod());
  const [startDate, setStartDate] = useState(defaultPeriod.startDate);
  const [endDate, setEndDate] = useState(defaultPeriod.endDate);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [areaVisible, setAreaVisible] = useState(false);
  const [error, setError] = useState("");

  // Hiện sẵn địa điểm đã chọn lần gần nhất (lưu trên máy).
  // Dùng focus (không chỉ mount) để quay về từ màn List vẫn thấy chỗ mới chọn.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadSearchPrefs().then((prefs) => {
        if (cancelled || !prefs) return;
        setProvince(prefs.province);
        setDistrict(prefs.district);
        setAreaId(prefs.areaId);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  const rentalDays = calculateRentalDays(startDate, endDate);
  const periodText = formatPeriodSummary(startDate, endDate);
  const areaText = province ? `${province}${district ? ` · ${district}` : ""}` : "";

  function handleSearch() {
    if (!province) {
      setError("Vui lòng chọn địa điểm thuê xe.");
      return;
    }
    if (!startDate || !endDate) {
      setError("Vui lòng chọn thời gian thuê xe.");
      return;
    }
    if (rentalDays <= 0) {
      setError("Thời gian trả xe phải sau thời gian nhận xe.");
      return;
    }
    setError("");
    void saveSearchPrefs({ province, district, areaId });
    onSearch?.({
      type: searchTab,
      province,
      district,
      areaId,
      startDate,
      endDate,
    });
  }

  return (
    <View style={styles.content}>
      <AppDashboardHeader onAvatarPress={onAvatarPress} user={user} />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.searchCard}>
          <View style={styles.tabs}>
            <Pressable
              onPress={() => setSearchTab("Car")}
              style={[styles.tab, searchTab === "Car" && styles.tabActive]}
            >
              <Car
                color={searchTab === "Car" ? theme.onBrand : theme.muted}
                size={16}
              />
              <Text style={[styles.tabText, searchTab === "Car" && styles.tabTextActive]}>
                Ô tô
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSearchTab("Motorbike")}
              style={[styles.tab, searchTab === "Motorbike" && styles.tabActive]}
            >
              <Motorbike
                color={searchTab === "Motorbike" ? theme.onBrand : theme.muted}
                size={16}
              />
              <Text style={[styles.tabText, searchTab === "Motorbike" && styles.tabTextActive]}>
                Xe máy
              </Text>
            </Pressable>
          </View>

          <Pressable style={styles.field} onPress={() => setAreaVisible(true)}>
            <MapPin color={theme.brand} size={18} />
            <View style={styles.fieldTextWrap}>
              <Text style={styles.fieldLabel}>Địa điểm</Text>
              <Text
                style={[styles.fieldValue, !areaText && styles.fieldPlaceholder]}
                numberOfLines={1}
              >
                {areaText || "Chọn tỉnh / thành phố, phường / xã"}
              </Text>
            </View>
          </Pressable>

          <Pressable style={styles.field} onPress={() => setSheetVisible(true)}>
            <CalendarDays color={theme.brand} size={18} />
            <View style={styles.fieldTextWrap}>
              <Text style={styles.fieldLabel}>Thời gian thuê</Text>
              <Text
                style={[
                  styles.fieldValue,
                  !startDate && !endDate && styles.fieldPlaceholder,
                ]}
                numberOfLines={2}
              >
                {periodText}
              </Text>
            </View>
          </Pressable>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable style={styles.searchButton} onPress={handleSearch}>
            <Search color={theme.onBrand} size={18} />
            <Text style={styles.searchButtonText}>TÌM XE</Text>
          </Pressable>
        </View>

        <View style={styles.placeholder}>
          <Text style={styles.placeholderTitle}>Gợi ý xe nổi bật</Text>
          <Text style={styles.placeholderDesc}>
            Danh sách xe, promo và địa điểm sẽ gắn API ở bước tiếp theo.
          </Text>
        </View>
      </ScrollView>

      <RentalPeriodSheet
        visible={sheetVisible}
        startDate={startDate}
        endDate={endDate}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onClose={() => setSheetVisible(false)}
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
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { flex: 1, paddingHorizontal: 20, paddingTop: 8 },
    scroll: { flex: 1 },
    searchCard: {
      marginTop: 96,
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.16)" : "rgba(107,25,255,0.08)",
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      padding: 10,
      gap: 8,
    },
    tabs: { flexDirection: "row", gap: 8 },
    tab: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.10)" : "rgba(107,25,255,0.05)",
    },
    tabActive: { backgroundColor: theme.brand },
    tabText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    tabTextActive: { color: theme.onBrand },
    field: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: "transparent",
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    fieldTextWrap: { flex: 1 },
    fieldLabel: { color: theme.muted, fontSize: 10, fontWeight: "700" },
    fieldValue: { color: theme.text, fontSize: 13, fontWeight: "700", marginTop: 2 },
    fieldPlaceholder: { color: theme.placeholder, fontWeight: "500" },
    error: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    searchButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.brand,
    },
    searchButtonText: { color: theme.onBrand, fontSize: 14, fontWeight: "800", letterSpacing: 1 },
    placeholder: { paddingVertical: 20 },
    placeholderTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    placeholderDesc: { color: theme.muted, fontSize: 13, marginTop: 4 },
  });
