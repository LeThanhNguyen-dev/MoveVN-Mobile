import {
  Bike,
  CalendarDays,
  Car,
  Gauge,
  MapPin,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { VehicleResponse } from "@/features/vehicles/types";
import { formatVnd, vehicleTypeLabel } from "@/features/vehicles/ownerDisplay";
import { detailFont, useDetailTheme } from "./detailTheme";

type Props = {
  vehicle: VehicleResponse;
  dailyPrice: number | null;
  averageRating: number | null;
  reviewCount: number;
  reviewState: "loading" | "ready" | "error";
};

type Fact = {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: "brand" | "mint";
};

export default function VehicleSummaryCard({
  vehicle,
  dailyPrice,
  averageRating,
  reviewCount,
  reviewState,
}: Props) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  const kicker = [vehicle.brandName, vehicle.variantName || vehicleTypeLabel(vehicle.vehicleType)]
    .filter(Boolean)
    .join(" · ");
  const displayTitle =
    [vehicle.modelName, vehicle.year].filter(Boolean).join(" ") ||
    [vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ");
  const VehicleIcon = vehicle.vehicleType === "Car" ? Car : Bike;
  const freeSecurity = !vehicle.securityRequiresDeposit;
  const securityValue = freeSecurity
    ? "Miễn"
    : vehicle.securityDepositAmount != null && vehicle.securityDepositAmount > 0
      ? formatVnd(vehicle.securityDepositAmount)
      : "Theo thoả thuận";

  const facts: Fact[] = [
    { icon: CalendarDays, label: "Năm SX", value: vehicle.year ? String(vehicle.year) : "—", tone: "brand" },
    {
      icon: Gauge,
      label: "Đã đi",
      value: vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString("vi-VN")} km` : "—",
      tone: "brand",
    },
    { icon: VehicleIcon, label: "Loại xe", value: vehicleTypeLabel(vehicle.vehicleType), tone: "brand" },
    {
      icon: ShieldCheck,
      label: "Thế chấp",
      value: securityValue,
      tone: freeSecurity ? "mint" : "brand",
    },
  ];

  const ratingText =
    averageRating != null
      ? `${averageRating.toFixed(1)} (${reviewCount})`
      : reviewState === "loading"
        ? "Đang tải đánh giá…"
        : reviewState === "error"
          ? "Chưa tải được đánh giá"
          : "Chưa có đánh giá";

  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={styles.titleBlock}>
          <AppText style={styles.kicker} numberOfLines={1}>
            {kicker}
          </AppText>
          <AppText style={styles.title} numberOfLines={2}>
            {displayTitle}
          </AppText>
          <View style={styles.meta}>
            <View style={styles.metaItem}>
              <MapPin color={p.muted} size={12} strokeWidth={2.1} />
              <AppText style={styles.metaText} numberOfLines={1}>
                {vehicle.areaName || "Chưa cập nhật khu vực"}
              </AppText>
            </View>
            <View style={styles.dot} />
            <View style={styles.metaItem}>
              <Star color={p.rating} fill={averageRating != null ? p.rating : "transparent"} size={12} />
              <AppText style={styles.ratingText} numberOfLines={1}>
                {ratingText}
              </AppText>
            </View>
          </View>
        </View>

        <View style={styles.priceBlock}>
          <AppText style={styles.price} numberOfLines={1}>
            {formatVnd(dailyPrice)}
          </AppText>
          <AppText style={styles.unit}>/ngày</AppText>
          <AppText style={styles.priceNote}>Chưa gồm phí</AppText>
        </View>
      </View>

      <View style={styles.facts}>
        {facts.map((fact) => {
          const Icon = fact.icon;
          const tint = fact.tone === "mint" ? p.mint : p.brand;
          const tintSoft = fact.tone === "mint" ? p.mintSoft : p.brandSoft;
          return (
            <View key={fact.label} style={styles.fact}>
              <View style={[styles.factIcon, { backgroundColor: tintSoft }]}>
                <Icon color={tint} size={14} strokeWidth={2} />
              </View>
              <AppText style={styles.factLabel} numberOfLines={1}>
                {fact.label}
              </AppText>
              <AppText style={styles.factValue} numberOfLines={2}>
                {fact.value}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    card: {
      marginTop: -30,
      marginHorizontal: 14,
      zIndex: 2,
      backgroundColor: p.surface,
      borderRadius: 26,
      borderWidth: 1,
      borderColor: p.line,
      paddingTop: 18,
      paddingHorizontal: 18,
      shadowColor: p.shadow,
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 12 },
      elevation: 3,
    },
    top: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    titleBlock: { flex: 1, minWidth: 0 },
    kicker: {
      color: p.brand,
      fontFamily: detailFont.extraBold,
      fontSize: 9.5,
      letterSpacing: 1.2,
      textTransform: "uppercase",
      marginBottom: 5,
    },
    title: {
      color: p.ink,
      fontFamily: detailFont.display,
      fontSize: 23,
      lineHeight: 28,
      letterSpacing: -0.4,
      marginBottom: 7,
    },
    meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
    metaText: { color: p.muted, fontFamily: detailFont.medium, fontSize: 11.5, maxWidth: 190 },
    dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: p.faint },
    ratingText: { color: p.ink, fontFamily: detailFont.semibold, fontSize: 11.5 },
    priceBlock: { alignItems: "flex-end", flexShrink: 0, maxWidth: 132, paddingTop: 3 },
    price: {
      color: p.brand,
      fontFamily: detailFont.display,
      fontSize: 18.5,
      lineHeight: 22,
      letterSpacing: -0.4,
      fontVariant: ["tabular-nums"],
    },
    unit: { color: p.muted, fontFamily: detailFont.semibold, fontSize: 10, marginTop: 1 },
    priceNote: { color: p.faint, fontFamily: detailFont.regular, fontSize: 9.5, marginTop: 3 },
    facts: {
      flexDirection: "row",
      marginTop: 16,
      marginHorizontal: -18,
      paddingHorizontal: 8,
      paddingTop: 13,
      paddingBottom: 14,
      borderTopWidth: 1,
      borderTopColor: p.line,
      backgroundColor: p.surfaceSoft,
      borderBottomLeftRadius: 25,
      borderBottomRightRadius: 25,
    },
    fact: { flex: 1, alignItems: "center", justifyContent: "center", gap: 5, paddingHorizontal: 3 },
    factIcon: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center" },
    factLabel: {
      color: p.faint,
      fontFamily: detailFont.semibold,
      fontSize: 8.5,
      letterSpacing: 0.4,
      textTransform: "uppercase",
    },
    factValue: { color: p.ink, fontFamily: detailFont.bold, fontSize: 11, lineHeight: 14, textAlign: "center", maxWidth: "100%" },
  });
