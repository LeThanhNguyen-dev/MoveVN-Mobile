import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Car, Clock3, KeyRound, PackageCheck, UserRound, Wallet } from "lucide-react-native";
import {
  detailFont as font,
  useDetailTheme,
  type DetailPalette,
} from "@/features/vehicles/components/detail/detailTheme";
import type { BookingResponse } from "@/features/booking/types";
import { bookingStatusLabel, formatDate, formatMoney } from "@/features/booking/utils/format";
import { DetailPill, DetailStat, DetailSummaryCard } from "./BookingDetailUI";

type PillTone = "brand" | "mint" | "warn" | "danger" | "neutral";

function statusTone(status: string): PillTone {
  if (status === "Completed") return "mint";
  if (status === "Cancelled" || status === "Rejected") return "danger";
  if (status === "Pending" || status === "Approved") return "warn";
  return "brand";
}

/** Card tóm tắt chuyến đi / đơn thuê: ảnh xe vuông nhỏ, thông tin hai bên và mốc nhận - trả xe. */
export default function BookingSummaryCard({
  booking,
  imageUri,
  onOpenVehicle,
  onOpenUserProfile,
}: {
  booking: BookingResponse;
  imageUri: string | null;
  onOpenVehicle?: () => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const vehicleName = booking.vehicleName || `Xe #${booking.vehicleId}`;
  const ownerName = booking.ownerName || `#${booking.ownerId}`;
  const customerName = booking.customerName || `#${booking.customerId}`;

  return (
    <DetailSummaryCard style={styles.card}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole={onOpenVehicle ? "link" : undefined}
          accessibilityLabel={`Xem xe ${vehicleName}`}
          onPress={onOpenVehicle}
          style={styles.photoWrap}
        >
          {imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.photo} resizeMode="cover" />
          ) : (
            <View style={[styles.photo, styles.photoFallback]}>
              <Car color={p.faint} size={28} strokeWidth={1.8} />
              <Text style={styles.photoFallbackText}>MoveVN</Text>
            </View>
          )}
        </Pressable>

        <View style={styles.info}>
          <Text style={styles.kicker} numberOfLines={1}>
            {booking.bookingCode}
          </Text>
          <Pressable accessibilityRole={onOpenVehicle ? "link" : undefined} onPress={onOpenVehicle}>
            <Text style={styles.title} numberOfLines={2}>
              {vehicleName}
            </Text>
          </Pressable>
          <View style={styles.meta}>
            <Pressable
              accessibilityRole={onOpenUserProfile ? "link" : undefined}
              disabled={!onOpenUserProfile}
              onPress={() => onOpenUserProfile?.(booking.ownerId)}
              style={styles.metaItem}
            >
              <UserRound color={p.muted} size={12} strokeWidth={2.1} />
              <Text style={styles.metaText} numberOfLines={1}>
                Chủ xe · {ownerName}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole={onOpenUserProfile ? "link" : undefined}
              disabled={!onOpenUserProfile}
              onPress={() => onOpenUserProfile?.(booking.customerId)}
              style={styles.metaItem}
            >
              <UserRound color={p.muted} size={12} strokeWidth={2.1} />
              <Text style={styles.metaText} numberOfLines={1}>
                Khách · {customerName}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.facts}>
        <DetailStat icon={KeyRound} label="Nhận xe" value={formatDate(booking.startDate)} />
        <DetailStat icon={PackageCheck} label="Trả xe" value={formatDate(booking.endDate)} />
        <DetailStat icon={Clock3} label="Thời lượng" value={`${booking.totalDays} ngày`} tone="brand" />
        <DetailStat icon={Wallet} label="Đặt cọc" value={formatMoney(booking.depositAmount)} />
      </View>

      <View style={styles.priceRow}>
        <View style={styles.priceMeta}>
          <DetailPill label={bookingStatusLabel(booking.status)} tone={statusTone(booking.status)} />
          <Text style={styles.created} numberOfLines={1}>
            Đặt {formatDate(booking.createdAt)}
          </Text>
        </View>
        <View style={styles.priceBlock}>
          <Text style={styles.priceLabel}>Tổng cộng</Text>
          <Text style={styles.price} numberOfLines={1}>
            {formatMoney(booking.totalAmount)}
          </Text>
        </View>
      </View>
    </DetailSummaryCard>
  );
}

const createStyles = (p: DetailPalette) =>
  StyleSheet.create({
    // Rộng hơn các card nội dung một chút để card nhận/trả xe nổi bật hơn.
    card: { marginTop: 12, marginHorizontal: 10 },
    top: { flexDirection: "row", gap: 12 },
    photoWrap: { flexShrink: 0 },
    photo: { width: 104, height: 104, borderRadius: 18, backgroundColor: p.surfaceAlt },
    photoFallback: { alignItems: "center", justifyContent: "center", gap: 3 },
    photoFallbackText: { color: p.faint, fontFamily: font.bold, fontSize: 9.5, letterSpacing: 0.5 },
    info: { flex: 1, minWidth: 0, gap: 4 },
    kicker: {
      color: p.brand,
      fontFamily: font.extraBold,
      fontSize: 9.5,
      letterSpacing: 1.2,
      textTransform: "uppercase",
    },
    title: {
      color: p.ink,
      fontFamily: font.display,
      fontSize: 20,
      lineHeight: 24,
      letterSpacing: -0.4,
    },
    meta: { gap: 3, marginTop: 2 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { color: p.muted, fontFamily: font.medium, fontSize: 11, flexShrink: 1 },
    priceRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "space-between",
      gap: 10,
      marginTop: 12,
    },
    priceMeta: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    created: { color: p.faint, fontFamily: font.medium, fontSize: 10 },
    priceBlock: { alignItems: "flex-end", flexShrink: 0 },
    priceLabel: {
      color: p.faint,
      fontFamily: font.bold,
      fontSize: 8.5,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      marginBottom: 1,
    },
    price: {
      color: p.brand,
      fontFamily: font.display,
      fontSize: 18,
      letterSpacing: -0.4,
      fontVariant: ["tabular-nums"],
    },
    facts: {
      flexDirection: "row",
      alignItems: "stretch",
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: p.line,
      backgroundColor: p.surfaceSoft,
    },
  });
