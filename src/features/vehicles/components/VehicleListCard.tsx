import { Bike, Car, Heart, MapPin, ShieldCheck, Sparkles, Star } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { VehicleListItemResponse } from "@/features/vehicles/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type VehicleListCardProps = {
  vehicle: VehicleListItemResponse;
  onOpen: () => void;
  onBook: () => void;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  favoriteLoading?: boolean;
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

export default function VehicleListCard({
  vehicle,
  onOpen,
  onBook,
  isFavorite = false,
  onToggleFavorite,
  favoriteLoading = false,
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
    <Pressable onPress={onOpen} style={styles.card}>
      <View style={styles.imageWrap}>
        {showImage ? (
          <Image
            source={{ uri: vehicle.featuredImage ?? "" }}
            style={styles.image}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <View style={styles.imageFallback}>
            <VehicleIcon color={theme.faint} size={44} />
            <Text style={styles.fallbackText}>Chưa có hình ảnh</Text>
          </View>
        )}
        {statusLabel ? (
          <View style={styles.badge}>
            <Sparkles color="#D97706" size={12} />
            <Text style={styles.badgeText}>{statusLabel}</Text>
          </View>
        ) : null}
        {onToggleFavorite ? (
          <Pressable
            disabled={favoriteLoading}
            onPress={onToggleFavorite}
            style={styles.heart}
            accessibilityLabel={isFavorite ? "Bỏ yêu thích" : "Yêu thích"}
          >
            <Heart
              color={isFavorite ? "#F43F5E" : "#FFFFFF"}
              size={17}
              fill={isFavorite ? "#F43F5E" : "transparent"}
            />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.info}>
        {!vehicle.securityRequiresDeposit ? (
          <View style={styles.freePill}>
            <ShieldCheck color={theme.success} size={13} />
            <Text style={styles.freePillText}>Miễn thế chấp</Text>
          </View>
        ) : null}

        <Text numberOfLines={1} style={styles.title}>
          {title}
        </Text>

        <View style={styles.metaRow}>
          <VehicleIcon color={theme.brand} size={14} />
          <Text numberOfLines={1} style={styles.metaText}>
            {vehicle.variantName || (vehicle.vehicleType === "Car" ? "Ô tô" : "Xe máy")}
          </Text>
        </View>

        <View style={styles.metaRow}>
          <MapPin color={theme.muted} size={14} />
          <Text numberOfLines={1} style={styles.area}>
            {distanceLabel ? `${distanceLabel} · ` : ""}
            {vehicle.areaName || "Chưa cập nhật khu vực"}
          </Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.priceRow}>
          <View>
            {hasRating ? (
              <View style={styles.ratingWrap}>
                <Star color="#F59E0B" size={15} fill="#F59E0B" />
                <Text style={styles.rating}>{vehicle.averageRating.toFixed(1)}</Text>
                <Text style={styles.ratingCount}>({vehicle.reviewCount} đánh giá)</Text>
              </View>
            ) : (
              <Text style={styles.noRating}>Chưa có đánh giá</Text>
            )}
          </View>
          <View style={styles.priceWrap}>
            <Text style={styles.price}>{formatVehicleCurrency(totalPrice)}</Text>
            {totalPrice > 0 ? (
              <Text style={styles.perDay}>
                {days} ngày · TB {formatVehicleCurrency(avgPrice)}/ngày
              </Text>
            ) : null}
          </View>
        </View>

        <Pressable onPress={onBook} style={styles.bookButton}>
          <Text style={styles.bookText}>Đặt ngay</Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

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
      width: 34,
      height: 34,
      borderRadius: 17,
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
    priceRow: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
    ratingWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
    rating: { color: theme.text, fontSize: 14, fontWeight: "800" },
    ratingCount: { color: theme.muted, fontSize: 12 },
    noRating: { color: theme.faint, fontSize: 12 },
    priceWrap: { alignItems: "flex-end" },
    price: { color: theme.brand, fontSize: 16, fontWeight: "800" },
    perDay: { color: theme.muted, fontSize: 11 },
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
