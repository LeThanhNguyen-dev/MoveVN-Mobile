import { Image } from "expo-image";
import {
  ArrowRight,
  Bike,
  Car,
  ChevronRight,
  CircleAlert,
  CircleCheck,
  Clock3,
  MapPin,
  Sparkles,
} from "lucide-react-native";
import { useMemo } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { formatCheckoutDate, formatCheckoutMeta } from "@/features/booking/utils/checkoutFormat";
import { formatVnd, vehicleTypeLabel } from "@/features/vehicles/ownerDisplay";
import type { VehicleResponse } from "@/features/vehicles/types";
import { checkoutFont, useCheckoutTheme } from "./checkoutTheme";
import CheckoutSectionHeader from "./CheckoutSectionHeader";

type Props = {
  vehicle: VehicleResponse;
  days: number;
  dailyPrice: number | null;
  startDate: string;
  endDate: string;
  availabilityLoading: boolean;
  availabilityError: boolean;
  overlapped: boolean;
  nextAvailableDate: string | null;
  onOpenPeriod: () => void;
  onApplyNextAvailable: () => void;
};

export default function CheckoutTripCard({
  vehicle,
  days,
  dailyPrice,
  startDate,
  endDate,
  availabilityLoading,
  availabilityError,
  overlapped,
  nextAvailableDate,
  onOpenPeriod,
  onApplyNextAvailable,
}: Props) {
  const { p } = useCheckoutTheme();
  const styles = useMemo(() => createStyles(p), [p]);

  const photo = vehicle.featuredImage || vehicle.images?.[0]?.imageUrl || null;
  const VehicleIcon = vehicle.vehicleType === "Car" ? Car : Bike;
  const title = [vehicle.modelName, vehicle.year].filter(Boolean).join(" ") || vehicle.brandName;
  const kicker = [vehicle.brandName, vehicle.variantName || vehicleTypeLabel(vehicle.vehicleType)]
    .filter(Boolean)
    .join(" · ");

  const status: { tone: "ready" | "busy" | "warn" | "loading"; text: string } = availabilityLoading
    ? { tone: "loading", text: "Đang kiểm tra lịch trống…" }
    : availabilityError
      ? { tone: "warn", text: "Chưa tải được lịch xe" }
      : overlapped
        ? { tone: "busy", text: "Xe đã bận trong khoảng này" }
        : days <= 0
          ? { tone: "warn", text: "Chọn ngày nhận & trả xe" }
          : { tone: "ready", text: "Xe còn trống" };

  const tone =
    status.tone === "ready"
      ? { fg: p.mint, bg: p.mintSoft, border: p.mintBorder }
      : status.tone === "busy"
        ? { fg: p.danger, bg: p.dangerSoft, border: p.dangerBorder }
        : status.tone === "warn"
          ? { fg: p.warning, bg: p.warningSoft, border: p.warningBorder }
          : { fg: p.brand, bg: p.brandSoft, border: p.brandBorder };

  const subtitle = days > 0 ? `${days} ngày thuê` : "Chọn thời gian nhận và trả xe";

  return (
    <View style={styles.card}>
      <CheckoutSectionHeader
        icon={VehicleIcon}
        subtitle={subtitle}
        title="Chuyến đi"
      />

      <View style={styles.vehicle}>
        <View style={styles.thumb}>
          {photo ? (
            <Image
              accessibilityIgnoresInvertColors
              contentFit="cover"
              source={{ uri: photo }}
              style={styles.thumbImage}
              transition={150}
            />
          ) : (
            <VehicleIcon color={p.faint} size={26} strokeWidth={1.8} />
          )}
        </View>

        <View style={styles.info}>
          <AppText style={styles.kicker} numberOfLines={1}>
            {kicker}
          </AppText>
          <AppText style={styles.name} numberOfLines={2}>
            {title}
          </AppText>
          <View style={styles.areaRow}>
            <MapPin color={p.muted} size={12} strokeWidth={2.1} />
            <AppText style={styles.area} numberOfLines={1}>
              {vehicle.areaName || vehicle.address || "Chưa cập nhật khu vực"}
            </AppText>
          </View>
        </View>

        <View style={styles.priceBlock}>
          <AppText style={styles.price} numberOfLines={1}>
            {formatVnd(dailyPrice)}
          </AppText>
          <AppText style={styles.priceUnit}>/ngày</AppText>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={[styles.status, { backgroundColor: tone.bg, borderColor: tone.border }]}>
          {status.tone === "loading" ? (
            <ActivityIndicator color={tone.fg} size="small" />
          ) : status.tone === "ready" ? (
            <CircleCheck color={tone.fg} size={15} strokeWidth={2.2} />
          ) : (
            <CircleAlert color={tone.fg} size={15} strokeWidth={2.2} />
          )}
          <AppText style={[styles.statusText, { color: tone.fg }]} numberOfLines={1}>
            {status.text}
          </AppText>
        </View>
      </View>

      <View style={styles.divider} />

      <Pressable
        accessibilityHint="Mở lịch chọn ngày và giờ nhận trả xe"
        accessibilityLabel="Thời gian thuê"
        accessibilityRole="button"
        onPress={onOpenPeriod}
        style={({ pressed }) => [styles.period, pressed && styles.pressed]}
      >
        <View style={styles.periodHead}>
          <AppText style={styles.periodTitle}>Thời gian thuê</AppText>
          <View style={styles.editPill}>
            <Clock3 color={p.brand} size={12} strokeWidth={2.2} />
            <AppText style={styles.editText}>Đổi</AppText>
          </View>
        </View>

        <View style={styles.periodRow}>
          <View style={styles.periodCol}>
            <AppText style={styles.periodLabel}>Nhận xe</AppText>
            <AppText style={[styles.periodDate, !startDate && styles.periodPlaceholder]} numberOfLines={1}>
              {startDate ? formatCheckoutDate(startDate) : "Chọn ngày"}
            </AppText>
            <AppText style={styles.periodMeta} numberOfLines={1}>
              {startDate ? formatCheckoutMeta(startDate) : "Chọn giờ"}
            </AppText>
          </View>

          <View style={styles.periodArrow}>
            <ArrowRight color={p.faint} size={17} strokeWidth={2} />
          </View>

          <View style={styles.periodCol}>
            <AppText style={styles.periodLabel}>Trả xe</AppText>
            <AppText style={[styles.periodDate, !endDate && styles.periodPlaceholder]} numberOfLines={1}>
              {endDate ? formatCheckoutDate(endDate) : "Chọn ngày"}
            </AppText>
            <AppText style={styles.periodMeta} numberOfLines={1}>
              {endDate ? formatCheckoutMeta(endDate) : "Chọn giờ"}
            </AppText>
          </View>

          <ChevronRight color={p.faint} size={17} strokeWidth={2.1} />
        </View>
      </Pressable>

      {nextAvailableDate ? (
        <View style={styles.nextBox}>
          <View style={styles.nextHead}>
            <Sparkles color={p.warning} size={15} strokeWidth={2.1} />
            <AppText style={styles.nextTitle}>Xe trống từ ngày khác</AppText>
          </View>
          <AppText style={styles.nextText}>
            Xe có thể thuê từ {new Date(nextAvailableDate).toLocaleDateString("vi-VN")}. Giữ nguyên số ngày
            thuê hiện tại.
          </AppText>
          <Pressable
            accessibilityRole="button"
            onPress={onApplyNextAvailable}
            style={({ pressed }) => [styles.nextButton, pressed && styles.pressed]}
          >
            <AppText style={styles.nextButtonText}>Dùng ngày này</AppText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useCheckoutTheme>["p"]) =>
  StyleSheet.create({
    card: {
      backgroundColor: p.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: p.line,
      padding: 16,
      gap: 13,
      shadowColor: p.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    vehicle: { flexDirection: "row", alignItems: "flex-start", gap: 11, marginTop: 1 },
    thumb: {
      width: 62,
      height: 62,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: p.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
    },
    thumbImage: { width: "100%", height: "100%" },
    info: { flex: 1, minWidth: 0 },
    kicker: {
      color: p.brand,
      fontFamily: checkoutFont.extraBold,
      fontSize: 9,
      letterSpacing: 0.9,
      textTransform: "uppercase",
      marginBottom: 3,
    },
    name: {
      color: p.ink,
      fontFamily: checkoutFont.display,
      fontSize: 16.5,
      lineHeight: 21,
      letterSpacing: -0.3,
    },
    areaRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
    area: { color: p.muted, fontFamily: checkoutFont.medium, fontSize: 10.5, flexShrink: 1 },
    priceBlock: { alignItems: "flex-end", maxWidth: 104, paddingTop: 2, flexShrink: 0 },
    price: {
      color: p.ink,
      fontFamily: checkoutFont.display,
      fontSize: 14,
      lineHeight: 18,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    priceUnit: { color: p.faint, fontFamily: checkoutFont.semibold, fontSize: 9, marginTop: 1 },
    statusRow: { flexDirection: "row", alignItems: "center" },
    status: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 5,
      flexShrink: 1,
    },
    statusText: { fontFamily: checkoutFont.bold, fontSize: 9.5, flexShrink: 1 },
    divider: { height: 1, backgroundColor: p.line },
    period: { gap: 9 },
    periodHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    periodTitle: { color: p.ink, fontFamily: checkoutFont.semibold, fontSize: 12.5 },
    editPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      backgroundColor: p.brandSoft,
    },
    editText: { color: p.brand, fontFamily: checkoutFont.bold, fontSize: 9.5 },
    periodRow: { flexDirection: "row", alignItems: "center", gap: 9 },
    periodCol: { flex: 1, minWidth: 0 },
    periodLabel: {
      color: p.faint,
      fontFamily: checkoutFont.bold,
      fontSize: 8.5,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    periodDate: {
      color: p.ink,
      fontFamily: checkoutFont.bold,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.2,
      marginTop: 2,
      fontVariant: ["tabular-nums"],
    },
    periodPlaceholder: { color: p.faint, fontFamily: checkoutFont.semibold, fontSize: 13, lineHeight: 18 },
    periodMeta: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 10, marginTop: 1 },
    periodArrow: { paddingTop: 16 },
    nextBox: {
      borderWidth: 1,
      borderColor: p.warningBorder,
      backgroundColor: p.warningSoft,
      borderRadius: 16,
      padding: 12,
      gap: 6,
    },
    nextHead: { flexDirection: "row", alignItems: "center", gap: 6 },
    nextTitle: { color: p.warning, fontFamily: checkoutFont.bold, fontSize: 11.5 },
    nextText: { color: p.muted, fontFamily: checkoutFont.regular, fontSize: 10.5, lineHeight: 15 },
    nextButton: {
      alignSelf: "flex-start",
      marginTop: 2,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.warningBorder,
    },
    nextButtonText: { color: p.warning, fontFamily: checkoutFont.bold, fontSize: 10.5 },
    pressed: { opacity: 0.72 },
  });
