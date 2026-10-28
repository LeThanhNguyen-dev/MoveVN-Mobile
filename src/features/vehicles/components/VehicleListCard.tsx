import { Image } from "expo-image";
import { Bike, Car, MapPin, ShieldCheck, Sparkles, Star } from "lucide-react-native";
import FavoriteVehicleButton from "@/features/favorites/components/FavoriteVehicleButton";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { VehicleListItemResponse } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type VehicleListCardProps = {
  vehicle: VehicleListItemResponse;
  onOpen: (vehicleId: number) => void;
  onBook: (vehicleId: number) => void;
};

const currencyFormatter = new Intl.NumberFormat("vi-VN");

export function formatVehicleCurrency(price: number): string {
  return Number.isFinite(price) && price > 0 ? `${currencyFormatter.format(price)}đ` : "Liên hệ";
}

function getVehicleTitle(vehicle: VehicleListItemResponse): string {
  return [vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ");
}

function formatDistance(distanceKm: number | null | undefined): string | null {
  if (distanceKm == null || !Number.isFinite(distanceKm)) return null;
  if (distanceKm < 1) return `${Math.round(distanceKm * 1000)} m`;
  return `${distanceKm.toFixed(distanceKm < 10 ? 1 : 0)} km`;
}

function getStatusLabel(vehicle: VehicleListItemResponse): string | null {  const createdAt = new Date(vehicle.createdAt);
  const ageInDays = Number.isNaN(createdAt.getTime())
    ? Number.POSITIVE_INFINITY
    : (Date.now() - createdAt.getTime()) / 86_400_000;
  if (ageInDays >= 0 && ageInDays <= 30) return "Mới";
  if (vehicle.averageRating >= 4.5 && vehicle.reviewCount > 0) return "Nổi bật";
  return null;
}

function VehicleListCard({
  vehicle,
  onOpen,
  onBook,
}: VehicleListCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [imageFailed, setImageFailed] = useState(false);

  const title = getVehicleTitle(vehicle);
  const statusLabel = getStatusLabel(vehicle);
  const distanceLabel = formatDistance(vehicle.distanceKm);
  const hasRating = vehicle.averageRating > 0 && vehicle.reviewCount > 0;
  const totalPrice = vehicle.totalDynamicPrice || vehicle.pricePerDay;
  const avgPrice = vehicle.averageDailyPrice || vehicle.pricePerDay;
  const days = vehicle.rentalDays || 1;
  const VehicleIcon = vehicle.vehicleType === "Car" ? Car : Bike;
  const showImage = vehicle.featuredImage && !imageFailed;

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`Xem xe ${title}`} onPress={() => onOpen(vehicle.id)} style={styles.card}>
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
            <VehicleIcon color={theme.faint} size={44} />
            <AppText style={styles.fallbackText}>Chưa có hình ảnh</AppText>
          </View>
        )}
        {statusLabel ? (
          <View style={styles.badge}>
            <Sparkles color="#D97706" size={12} />
            <AppText style={styles.badgeText}>{statusLabel}</AppText>
          </View>
        ) : null}
        <FavoriteVehicleButton vehicleId={vehicle.id} style={styles.heart} overlay />
      </View>

      <View style={styles.info}>
        {!vehicle.securityRequiresDeposit ? (
          <View style={styles.freePill}>
            <ShieldCheck color={theme.success} size={13} />
            <AppText style={styles.freePillText}>Miễn thế chấp</AppText>
          </View>
        ) : null}

        <AppText display numberOfLines={1} style={styles.title}>
          {title}
        </AppText>

        <View style={styles.metaRow}>
          <VehicleIcon color={theme.brand} size={14} />
          <AppText numberOfLines={1} style={styles.metaText}>
            {vehicle.variantName || (vehicle.vehicleType === "Car" ? "Ô tô" : "Xe máy")}
          </AppText>
        </View>

        <View style={styles.metaRow}>
          <MapPin color={theme.muted} size={14} />
          <AppText numberOfLines={1} style={styles.area}>
            {distanceLabel ? `${distanceLabel} · ` : ""}
            {vehicle.areaName || "Chưa cập nhật khu vực"}
          </AppText>
        </View>

        <View style={styles.divider} />

        <View style={styles.priceRow}>
          <View style={styles.ratingCol}>
            {hasRating ? (
              <View style={styles.ratingWrap}>
                <Star color="#F59E0B" size={15} fill="#F59E0B" />
                <AppText style={styles.rating} numberOfLines={1}>
                  {vehicle.averageRating.toFixed(1)}
                </AppText>
                <AppText style={styles.ratingCount} numberOfLines={1}>
                  ({vehicle.reviewCount} đánh giá)
                </AppText>
              </View>
            ) : (
              <AppText style={styles.noRating} numberOfLines={1}>
                Chưa có đánh giá
              </AppText>
            )}
          </View>
          <View style={styles.priceWrap}>
            <AppText style={styles.price} numberOfLines={1}>
              {formatVehicleCurrency(totalPrice)}
            </AppText>
            {totalPrice > 0 ? (
              <AppText style={styles.perDay} numberOfLines={1}>
                {days} ngày · TB {formatVehicleCurrency(avgPrice)}/ngày
              </AppText>
            ) : null}
          </View>
        </View>

        <Pressable accessibilityRole="button" accessibilityLabel={`Đặt xe ${title}`} onPress={() => onBook(vehicle.id)} style={styles.bookButton}>
          <AppText style={styles.bookText}>Đặt ngay</AppText>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default memo(VehicleListCard);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: "transparent",
      overflow: "hidden",
    },
    imageWrap: {
      width: "100%",
      aspectRatio: 16 / 9,
      backgroundColor: theme.surfaceAlt,
    },
    image: { width: "100%", height: "100%" },
    imageFallback: { flex: 1, alignItems: "center", justifyContent: "center", gap: 6 },
    fallbackText: { color: theme.faint, fontSize: 12 },
    badge: {
      position: "absolute",
      left: 10,
      top: 10,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      backgroundColor: theme.surface,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
    },
    badgeText: { color: theme.text, fontSize: 11, fontWeight: "800" },
    heart: {
      position: "absolute",
      right: 10,
      top: 10,
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: "rgba(0, 0, 0, 0.35)",
      alignItems: "center",
      justifyContent: "center",
    },
    info: { padding: 13, gap: 6 },
    freePill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      alignSelf: "flex-start",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.success,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    freePillText: { color: theme.success, fontSize: 11, fontWeight: "800" },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    metaText: { color: theme.muted, fontSize: 12, fontWeight: "600", flexShrink: 1 },
    area: { color: theme.muted, fontSize: 13, fontWeight: "500", flexShrink: 1 },
    divider: { height: 1, backgroundColor: theme.divider, marginVertical: 3 },
    priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 8 },
    ratingCol: { flexShrink: 1, minWidth: 0 },
    ratingWrap: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
    rating: { color: theme.text, fontSize: 14, fontWeight: "800", flexShrink: 0 },
    ratingCount: { color: theme.muted, fontSize: 12, flexShrink: 1 },
    noRating: { color: theme.faint, fontSize: 12, fontStyle: "italic" },
    priceWrap: { alignItems: "flex-end", flexShrink: 1, minWidth: 0 },
    price: { color: theme.brand, fontSize: 16, fontWeight: "800" },
    perDay: { color: theme.muted, fontSize: 11, marginTop: 2 },
    bookButton: {
      height: 42,
      borderRadius: 12,
      backgroundColor: theme.brand,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    bookText: { color: theme.onBrand, fontSize: 14, fontWeight: "800" },
  });
