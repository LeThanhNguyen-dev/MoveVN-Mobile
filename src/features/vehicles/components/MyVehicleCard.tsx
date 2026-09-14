import { Image } from "expo-image";
import { Bike, Car, MapPin } from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import type { VehicleListItemResponse } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  canToggleStatus,
  formatMinPrice,
  getOwnerStatusLabel,
  vehicleTypeLabel,
} from "@/features/vehicles/ownerDisplay";

type MyVehicleCardProps = {
  vehicle: VehicleListItemResponse;
  onOpen: (vehicleId: number) => void;
  toggling?: boolean;
  onToggleStatus?: (vehicle: VehicleListItemResponse) => void;
};

function statusStyle(status: string, theme: Theme): { bg: string; text: string; dot: string } {
  switch (status) {
    case "Approved":
      return { bg: theme.successSoft, text: theme.success, dot: theme.success };
    case "Rejected":
      return { bg: theme.dangerSoft, text: theme.danger, dot: theme.danger };
    case "Hidden":
      return { bg: theme.surfaceAlt, text: theme.muted, dot: theme.faint };
    default:
      return { bg: "#FEF3C7", text: "#B45309", dot: "#F59E0B" };
  }
}

function MyVehicleCard({ vehicle, onOpen, toggling = false, onToggleStatus }: MyVehicleCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [imageFailed, setImageFailed] = useState(false);
  const status = statusStyle(vehicle.status, theme);
  const VehicleIcon = vehicle.vehicleType === "Car" ? Car : Bike;
  const showImage = !!vehicle.featuredImage && !imageFailed;
  const showToggle = canToggleStatus(vehicle.status) && onToggleStatus;

  return (
    <Pressable onPress={() => onOpen(vehicle.id)} style={styles.card}>
      <View style={styles.imageWrap}>
        {showImage ? (
          <Image
            source={{ uri: vehicle.featuredImage ?? "" }}
            style={styles.image}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={250}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <VehicleIcon color={theme.faint} size={42} />
            <Text style={styles.fallbackText}>Chưa có hình ảnh</Text>
          </View>
        )}
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <View style={[styles.dot, { backgroundColor: status.dot }]} />
          <Text style={[styles.statusText, { color: status.text }]}>
            {getOwnerStatusLabel(vehicle.status)}
          </Text>
        </View>
        {showToggle ? (
          <View style={styles.toggleWrap}>
            <Switch
              value={vehicle.status === "Approved"}
              disabled={toggling}
              onValueChange={() => onToggleStatus?.(vehicle)}
              trackColor={{ false: theme.faint, true: theme.success }}
              thumbColor="#FFFFFF"
            />
          </View>
        ) : null}
      </View>

      <View style={styles.info}>
        <Text numberOfLines={1} style={styles.brandLine}>
          {vehicle.brandName} {vehicle.modelName}
          {vehicle.variantName ? ` · ${vehicle.variantName}` : ""}
        </Text>
        <View style={styles.plateRow}>
          <Text numberOfLines={1} style={styles.plate}>
            {vehicle.licensePlate}
          </Text>
          <Text style={styles.year}>
            {vehicleTypeLabel(vehicle.vehicleType)} · {vehicle.year}
          </Text>
        </View>
        {vehicle.areaName ? (
          <View style={styles.metaRow}>
            <MapPin color={theme.muted} size={13} />
            <Text numberOfLines={1} style={styles.area}>
              {vehicle.areaName}
            </Text>
          </View>
        ) : null}
        <View style={styles.priceRow}>
          <Text style={styles.price}>{formatMinPrice(vehicle)}</Text>
          {vehicle.pricingMode === "Auto" ? (
            <View style={styles.autoTag}>
              <Text style={styles.autoTagText}>Giá tự động</Text>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(MyVehicleCard);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    imageWrap: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: theme.surfaceAlt,
    },
    image: { width: "100%", height: "100%" },
    imageFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
    fallbackText: { color: theme.faint, fontSize: 12, fontWeight: "600" },
    statusBadge: {
      position: "absolute",
      left: 10,
      top: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    dot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 11, fontWeight: "800" },
    toggleWrap: {
      position: "absolute",
      right: 6,
      top: 6,
      borderRadius: 999,
      backgroundColor: "rgba(0,0,0,0.35)",
      paddingHorizontal: 2,
      paddingVertical: 1,
    },
    info: { padding: 13, gap: 6 },
    brandLine: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    plateRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
    plate: { color: theme.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
    year: { color: theme.faint, fontSize: 12, fontWeight: "600" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    area: { color: theme.muted, fontSize: 12, fontWeight: "500", flexShrink: 1 },
    priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 2 },
    price: { color: theme.brand, fontSize: 16, fontWeight: "800" },
    autoTag: {
      borderRadius: 999,
      backgroundColor: theme.brandSoft,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    autoTagText: { color: theme.brand, fontSize: 11, fontWeight: "800" },
  });
