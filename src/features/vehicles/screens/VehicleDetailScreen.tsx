import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getPublicVehicleById } from "@/features/vehicles/services/publicVehicleService";
import type { VehicleResponse } from "@/features/vehicles/types";
import { formatPeriodSummary } from "@/features/vehicles/utils/rentalPeriod";

type DetailRoute = RouteProp<ExploreStackParamList, "VehicleDetail">;
type DetailNav = NativeStackNavigationProp<ExploreStackParamList, "VehicleDetail">;

export default function VehicleDetailScreen({
  route,
  navigation,
}: {
  route: DetailRoute;
  navigation: DetailNav;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { vehicleId, startDate, endDate } = route.params;
  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    getPublicVehicleById(vehicleId)
      .then((data) => {
        if (!cancelled) setVehicle(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setVehicle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Chi tiết xe
        </Text>
        <View style={styles.backButton} />
      </View>
      {vehicle === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
          <Text style={styles.muted}>Đang tải chi tiết xe...</Text>
        </View>
      ) : vehicle === null ? (
        <View style={styles.center}>
          <Text style={styles.title}>Không tải được xe #{vehicleId}</Text>
          <Text style={styles.muted}>Kéo về danh sách và thử lại.</Text>
        </View>
      ) : (
        <View style={styles.body}>
          <Text style={styles.title}>
            {[vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ")}
          </Text>
          <Text style={styles.muted}>{vehicle.areaName || "Chưa cập nhật khu vực"}</Text>
          {startDate || endDate ? (
            <Text style={styles.period}>{formatPeriodSummary(startDate ?? "", endDate ?? "")}</Text>
          ) : null}
          <Text style={styles.muted}>Gallery, bản đồ, đánh giá và đặt xe sẽ làm ở bước tiếp theo.</Text>
        </View>
      )}
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    body: { padding: 20, gap: 6 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
    title: { color: theme.text, fontSize: 18, fontWeight: "800" },
    period: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    muted: { color: theme.muted, fontSize: 13 },
  });
