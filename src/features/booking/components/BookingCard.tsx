import { Image } from "expo-image";
import {
  CalendarCheck,
  CalendarClock,
  Car,
  ChevronRight,
  MapPin,
} from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { BookingResponse } from "@/features/booking/types";
import {
  formatDateTime,
  formatMoney,
  rentalProgress,
} from "@/features/booking/utils/format";
import BookingStatusBadge from "./BookingStatusBadge";

type BookingCardProps = {
  booking: BookingResponse;
  variant: "customer" | "owner";
  onPress: () => void;
  /** Mở hồ sơ công khai của khách (danh sách đơn của chủ xe). */
  onOpenUserProfile?: (userId: number) => void;
};

function actionHint(
  booking: BookingResponse,
  variant: "customer" | "owner",
): string | null {
  switch (booking.status) {
    case "Pending":
      return variant === "owner" ? "Cần phản hồi yêu cầu" : "Chờ chủ xe duyệt";
    case "Approved":
      return variant === "customer"
        ? "Cần đặt cọc giữ xe"
        : "Chờ khách đặt cọc";
    case "DepositPaid":
      return "Sẵn sàng nhận xe";
    case "InProgress":
      return "Đang trong thời gian thuê";
    case "Returning":
      return "Đang bàn giao trả xe";
    default:
      return null;
  }
}

function BookingCard({
  booking,
  variant,
  onPress,
  onOpenUserProfile,
}: BookingCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!booking.vehicleImage && !imageFailed;
  // Quá hạn là hiển thị phụ: backend giữ status InProgress/Returning và chỉ gửi
  // notification, nên list phải tự tính theo endDate.
  const progress =
    booking.status === "InProgress" || booking.status === "Returning"
      ? rentalProgress(booking.startDate, booking.endDate)
      : null;
  const overdue = progress?.overdue === true;
  const hint =
    overdue && progress ? progress.summary : actionHint(booking, variant);
  const isUrgent = overdue;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Xem chuyến thuê ${booking.bookingCode ?? ""}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <AppText numberOfLines={1} style={styles.code}>
          {(booking.bookingCode ?? "").toUpperCase()}
        </AppText>
        <View style={{ maxWidth: "65%" }}>
          <BookingStatusBadge status={booking.status} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.imageWrap}>
          {showImage ? (
            <Image
              source={{ uri: booking.vehicleImage ?? "" }}
              style={styles.image}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={200}
              onError={() => setImageFailed(true)}
            />
          ) : (
            <View style={styles.fallback}>
              <Car color={theme.faint} size={30} />
            </View>
          )}
        </View>

        <View style={styles.info}>
          <AppText numberOfLines={2} style={styles.vehicle}>
            {booking.vehicleName ?? `Xe #${booking.vehicleId}`}
          </AppText>
          {variant === "owner" ? (
            onOpenUserProfile && booking.customerId ? (
              <Pressable
                onPress={() => onOpenUserProfile(booking.customerId)}
                accessibilityRole="link"
                accessibilityLabel={`Xem hồ sơ ${booking.customerName || `khách #${booking.customerId}`}`}
                style={styles.customerRow}
              >
                <AppText
                  numberOfLines={1}
                  style={[styles.sub, styles.customerName]}
                >
                  {booking.customerName
                    ? `Khách: ${booking.customerName}`
                    : `Khách #${booking.customerId}`}
                </AppText>
                <ChevronRight color={theme.brand} size={14} />
              </Pressable>
            ) : (
              <AppText numberOfLines={1} style={styles.sub}>
                {booking.customerName
                  ? `Khách: ${booking.customerName}`
                  : `Khách #${booking.customerId}`}
              </AppText>
            )
          ) : null}

          <View style={styles.metaRow}>
            <CalendarClock color={theme.faint} size={14} />
            <AppText style={styles.meta}>
              <AppText style={styles.metaLabel}>Nhận: </AppText>
              {formatDateTime(booking.startDate)}
            </AppText>
          </View>
          <View style={styles.metaRow}>
            <CalendarCheck color={theme.faint} size={14} />
            <AppText style={styles.meta}>
              <AppText style={styles.metaLabel}>Trả: </AppText>
              {formatDateTime(booking.endDate)}
            </AppText>
          </View>
        </View>
      </View>
      {booking.pickupAddress ? (
        <View style={styles.metaRow}>
          <MapPin color={theme.faint} size={14} />
          <AppText numberOfLines={1} style={styles.address}>
            {booking.pickupAddress}
          </AppText>
        </View>
      ) : null}

      <View style={styles.divider} />

      <View style={styles.priceRow}>
        <View style={styles.priceLeft}>
          <View style={styles.amountCol}>
            <AppText style={styles.amountLabel}>
              {booking.totalDays} ngày · Tổng tiền
            </AppText>
            <AppText style={styles.total}>
              {formatMoney(booking.totalAmount)}
            </AppText>
          </View>
          {booking.depositAmount > 0 ? (
            <View style={styles.amountCol}>
              <AppText style={styles.amountLabel}>Tiền cọc</AppText>
              <AppText style={styles.depositText}>
                {formatMoney(booking.depositAmount)}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.chevronWrap}>
          <ChevronRight color={theme.muted} size={16} />
        </View>
      </View>

      {hint ? (
        <View style={[styles.hint, isUrgent && styles.hintUrgent]}>
          <View style={[styles.hintBar, isUrgent && styles.hintBarUrgent]} />
          <AppText style={[styles.hintText, isUrgent && styles.hintTextUrgent]}>
            {hint}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

export default memo(BookingCard);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 12,
      gap: 9,
      // Nổi nhẹ khỏi nền để hết cảm giác phẳng/thô.
      shadowColor: theme.shadow,
      shadowOpacity: 0.025,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    pressed: { opacity: 0.7 },
    row: { flexDirection: "row", gap: 12 },
    imageWrap: {
      width: 64,
      height: 68,
      borderRadius: 12,
      flexShrink: 0,
      backgroundColor: theme.surfaceAlt,
      overflow: "hidden",
      alignSelf: "flex-start",
    },
    image: { width: "100%", height: "100%" },
    fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
    info: { flex: 1, gap: 4, minWidth: 0, justifyContent: "center" },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8,
    },
    code: {
      color: theme.muted,
      fontSize: 11,
      fontWeight: "500",
      letterSpacing: 0.2,
      flex: 1,
      minWidth: 0,
    },
    vehicle: { color: theme.text, fontSize: 15, fontWeight: "700" },
    sub: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    customerRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    customerName: { color: theme.brand, flexShrink: 1 },
    metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    meta: { color: theme.muted, fontSize: 12, fontWeight: "500", flex: 1 },
    metaLabel: { color: theme.text, fontSize: 12, fontWeight: "600" },
    address: { color: theme.muted, fontSize: 11, flex: 1 },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.divider,
    },
    priceRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
    },
    priceLeft: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      columnGap: 24,
      rowGap: 8,
      flex: 1,
    },
    amountCol: { gap: 2 },
    amountLabel: { color: theme.faint, fontSize: 10 },
    total: { color: theme.brand, fontSize: 15, fontWeight: "600" },
    depositText: { color: theme.text, fontSize: 12, fontWeight: "500" },
    chevronWrap: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    hint: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
      paddingTop: 8,
    },
    hintUrgent: {},
    hintBar: {
      width: 3,
      height: 16,
      borderRadius: 2,
      backgroundColor: theme.brand,
    },
    hintBarUrgent: { backgroundColor: theme.danger },
    hintText: { color: theme.muted, fontSize: 11, fontWeight: "600", flex: 1 },
    hintTextUrgent: { color: theme.danger },
  });
