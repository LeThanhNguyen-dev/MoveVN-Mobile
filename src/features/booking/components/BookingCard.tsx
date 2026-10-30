import { Image } from "expo-image";
import {
  CalendarDays,
  Car,
  ChevronRight,
  Clock,
  MapPin,
  UserRound,
} from "lucide-react-native";
import { memo, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { BookingResponse } from "@/features/booking/types";
import { formatDateTime, formatMoney, rentalProgress } from "@/features/booking/utils/format";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import BookingStatusBadge from "./BookingStatusBadge";

type BookingCardProps = {
  booking: BookingResponse;
  variant: "customer" | "owner";
  onPress: () => void;
  /** Mở hồ sơ công khai của khách (danh sách đơn của chủ xe). */
  onOpenUserProfile?: (userId: number) => void;
};

type ActionTone = "primary" | "soft" | "ghost";

/** Nhãn CTA chỉ để mở trang chi tiết — mọi thao tác duyệt/trả xe nằm ở màn chi tiết. */
function primaryAction(booking: BookingResponse, variant: "customer" | "owner"): { label: string; tone: ActionTone } {
  const s = booking.status;
  const finished = s === "Completed" || s === "Cancelled" || s === "Rejected";
  if (finished) return { label: s === "Completed" ? "Xem lại" : "Chi tiết", tone: "ghost" };

  if (variant === "owner") {
    switch (s) {
      case "Pending":
        return { label: "Xử lý đơn", tone: "primary" };
      case "InProgress":
        return { label: "Theo dõi", tone: "primary" };
      case "Returning":
        return { label: "Nhận xe", tone: "primary" };
      case "Returned":
        return { label: "Xem biên bản", tone: "soft" };
      default:
        return { label: "Chi tiết", tone: "soft" };
    }
  }

  switch (s) {
    case "Pending":
      return { label: "Xem đơn", tone: "soft" };
    case "Approved":
      return { label: "Thanh toán cọc", tone: "primary" };
    case "InProgress":
      return { label: "Trả xe", tone: "primary" };
    case "Returning":
      return { label: "Bàn giao trả", tone: "primary" };
    case "Returned":
      return { label: "Xem biên bản", tone: "soft" };
    default:
      return { label: "Chi tiết", tone: "soft" };
  }
}

/** "29/10/2026 09:00" → "29/10 09:00" cho dòng thời gian gọn trên thẻ. */
function shortDateTime(value?: string | null): string {
  return formatDateTime(value).replace(/^(\d{2}\/\d{2})\/\d{4}/, "$1");
}

function initials(name?: string): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "KH";
  const first = parts[0]?.charAt(0) ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1]?.charAt(0) ?? "" : "";
  return `${first}${last}`.toUpperCase();
}

function priceNote(booking: BookingResponse, variant: "customer" | "owner"): { text: string; success: boolean } {
  const s = booking.status;
  if (s === "Completed") return { text: "Đã kết thúc", success: false };
  if (s === "Cancelled") return { text: "Đã hủy", success: false };
  if (s === "Rejected") return { text: "Đã từ chối", success: false };
  if (variant === "owner" && (s === "Pending" || s === "Approved")) {
    return { text: `Cọc dự kiến ${formatMoney(booking.depositAmount)}`, success: false };
  }
  if (s === "DepositPaid" || s === "Confirmed" || s === "InProgress" || s === "Returning" || s === "Returned") {
    return { text: `Đã cọc ${formatMoney(booking.depositAmount)}`, success: true };
  }
  return { text: `Cọc ${formatMoney(booking.depositAmount)}`, success: false };
}

function BookingCard({ booking, variant, onPress, onOpenUserProfile }: BookingCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const warning = theme.mode === "dark" ? "#FBBF24" : "#D97706";
  const warningSoft = theme.mode === "dark" ? "#3A2A0F" : "#FFF7E6";
  const warningBorder = theme.mode === "dark" ? "#5A4318" : "#F5E0B8";
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = !!booking.vehicleImage && !imageFailed;

  // Backend giữ status InProgress/Returning khi quá hạn (chỉ gửi notification)
  // nên list tự tính tiến độ theo endDate.
  const progress =
    booking.status === "InProgress" || booking.status === "Returning"
      ? rentalProgress(booking.startDate, booking.endDate)
      : null;
  const overdue = progress?.overdue === true;
  const percent = progress
    ? overdue
      ? 100
      : Math.min(100, Math.max(4, Math.round((progress.currentDay / Math.max(1, progress.totalDays)) * 100)))
    : 0;
  const remainLabel = progress
    ? progress.overdue
      ? progress.summary
      : progress.summary.split(" · ")[1] ?? progress.summary
    : "";

  const action = primaryAction(booking, variant);
  const note = priceNote(booking, variant);
  const ctaColor =
    action.tone === "primary" ? theme.onBrand : action.tone === "soft" ? theme.brand : theme.muted;
  const ctaBg =
    action.tone === "primary" ? theme.brand : action.tone === "soft" ? theme.brandSoft : theme.surfaceAlt;
  const ctaBorder =
    action.tone === "primary" ? theme.brand : action.tone === "soft" ? theme.brandBorder : theme.border;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${booking.vehicleName ?? `Xe #${booking.vehicleId}`} · ${booking.bookingCode}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={styles.thumbWrap}>
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
              <Car color={theme.brand} size={36} strokeWidth={1.6} />
            </View>
          )}
          <View style={styles.daysBadge}>
            <Clock color="#FFFFFF" size={9} strokeWidth={2.4} />
            <AppText style={styles.daysBadgeText}>{booking.totalDays} ngày</AppText>
          </View>
        </View>

        <View style={styles.info}>
          <View style={styles.codeRow}>
            <AppText numberOfLines={1} style={styles.code}>
              {(booking.bookingCode ?? "").toUpperCase()}
            </AppText>
            <BookingStatusBadge status={booking.status} />
          </View>

          <AppText numberOfLines={1} style={styles.vehicle}>
            {booking.vehicleName ?? `Xe #${booking.vehicleId}`}
          </AppText>

          {variant === "owner" ? (
            <View style={styles.partyRow}>
              <View style={styles.avatar}>
                <AppText style={styles.avatarText}>{initials(booking.customerName)}</AppText>
              </View>
              <AppText numberOfLines={1} style={styles.partyName}>
                {booking.customerName || `Khách #${booking.customerId}`}
              </AppText>
              {onOpenUserProfile && booking.customerId ? (
                <Pressable
                  onPress={() => onOpenUserProfile(booking.customerId)}
                  accessibilityRole="link"
                  accessibilityLabel={`Xem hồ sơ ${booking.customerName || `khách #${booking.customerId}`}`}
                  hitSlop={6}
                  style={styles.profileLink}
                >
                  <AppText style={styles.profileLinkText}>Hồ sơ</AppText>
                  <ChevronRight color={theme.brand} size={11} strokeWidth={2.4} />
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.partyRow}>
              <UserRound color={theme.faint} size={11} strokeWidth={2.2} />
              <AppText numberOfLines={1} style={styles.partyName}>
                {booking.ownerName || "Chủ xe"}
              </AppText>
            </View>
          )}

          <View style={styles.timeRow}>
            <CalendarDays color={theme.faint} size={12} strokeWidth={2.2} />
            <AppText numberOfLines={1} style={styles.timeText}>
              <AppText style={styles.timeStrong}>{shortDateTime(booking.startDate)}</AppText>
              <AppText style={styles.timeArrow}>  →  </AppText>
              <AppText style={styles.timeStrong}>{shortDateTime(booking.endDate)}</AppText>
            </AppText>
          </View>

          {/* Địa điểm nhận xe dài → xuống dưới dòng thời gian, chữ nhỏ hơn. */}
          <View style={styles.addressRow}>
            <MapPin color={theme.faint} size={11} strokeWidth={2.2} style={styles.addressIcon} />
            <AppText numberOfLines={2} style={styles.address}>
              {booking.pickupAddress}
            </AppText>
          </View>
        </View>
      </View>

      {progress ? (
        <View style={styles.state}>
          <View style={styles.stateTop}>
            <View
              style={[
                styles.statePill,
                overdue
                  ? { backgroundColor: theme.dangerSoft, borderColor: theme.dangerBorder }
                  : { backgroundColor: theme.brandSoft, borderColor: theme.brandBorder },
              ]}
            >
              <AppText style={[styles.statePillText, { color: overdue ? theme.danger : theme.brand }]}>
                {remainLabel}
              </AppText>
            </View>
            <AppText style={styles.stateMeta}>
              Ngày {progress.currentDay}/{progress.totalDays}
            </AppText>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.trackFill,
                {
                  width: `${percent}%`,
                  backgroundColor: overdue ? theme.danger : theme.brand,
                },
              ]}
            />
          </View>
        </View>
      ) : variant === "owner" && booking.status === "Pending" ? (
        <View style={[styles.urgent, { borderColor: warningBorder, backgroundColor: warningSoft }]}>
          <Clock color={warning} size={12} strokeWidth={2.2} />
          <AppText style={[styles.urgentText, { color: warning }]}>Đơn đang chờ bạn duyệt · phản hồi sớm để khách không hủy.</AppText>
        </View>
      ) : variant === "customer" && booking.status === "Approved" ? (
        <View style={styles.infoBand}>
          <Clock color={theme.brand} size={12} strokeWidth={2.2} />
          <AppText numberOfLines={1} style={styles.infoBandText}>
            {booking.paymentDueAt
              ? `Hạn cọc ${formatDateTime(booking.paymentDueAt)}`
              : "Hoàn tất cọc để giữ chuyến."}
          </AppText>
        </View>
      ) : null}

      <View style={styles.footer}>
        <View style={styles.priceCol}>
          <AppText style={styles.amount}>{formatMoney(booking.totalAmount)}</AppText>
          <AppText style={[styles.priceNote, note.success && styles.priceNoteOk]}>{note.text}</AppText>
        </View>
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          hitSlop={4}
          style={({ pressed }) => [
            styles.cta,
            { backgroundColor: ctaBg, borderColor: ctaBorder },
            pressed && styles.pressed,
          ]}
        >
          <AppText style={[styles.ctaText, { color: ctaColor }]}>{action.label}</AppText>
          <ChevronRight color={ctaColor} size={13} strokeWidth={2.4} />
        </Pressable>
      </View>
    </Pressable>
  );
}

export default memo(BookingCard);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      borderRadius: 24,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 13,
      gap: 10,
      shadowColor: theme.shadow,
      shadowOpacity: 0.06,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 2,
    },
    pressed: { opacity: 0.78 },
    row: { flexDirection: "row", gap: 11 },
    thumbWrap: {
      width: 86,
      height: 86,
      borderRadius: 18,
      backgroundColor: theme.brandSoft,
      overflow: "hidden",
      flexShrink: 0,
    },
    image: { width: "100%", height: "100%" },
    fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
    daysBadge: {
      position: "absolute",
      left: 6,
      bottom: 6,
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: "rgba(12, 8, 24, 0.55)",
      borderWidth: 1,
      borderColor: "rgba(255, 255, 255, 0.22)",
    },
    daysBadgeText: { color: "#FFFFFF", fontFamily: font.bold, fontSize: 8.5 },
    info: { flex: 1, minWidth: 0, gap: 4, justifyContent: "center" },
    codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 7 },
    code: {
      color: theme.faint,
      fontFamily: font.extraBold,
      fontSize: 8.5,
      letterSpacing: 0.8,
      flex: 1,
    },
    vehicle: {
      color: theme.text,
      fontFamily: font.display,
      fontSize: 15,
      lineHeight: 20,
      letterSpacing: -0.3,
    },
    partyRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    avatar: {
      width: 20,
      height: 20,
      borderRadius: 7,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
      flexShrink: 0,
    },
    avatarText: { color: theme.brand, fontFamily: font.extraBold, fontSize: 8 },
    partyName: {
      color: theme.muted,
      fontFamily: font.medium,
      fontSize: 10.5,
      lineHeight: 14,
      flexShrink: 1,
    },
    profileLink: { flexDirection: "row", alignItems: "center", gap: 1, marginLeft: "auto", flexShrink: 0 },
    profileLinkText: { color: theme.brand, fontFamily: font.semibold, fontSize: 9.5 },
    timeRow: { flexDirection: "row", alignItems: "center", gap: 5, minWidth: 0 },
    timeText: { color: theme.muted, fontFamily: font.medium, fontSize: 10.5, flexShrink: 1 },
    timeStrong: { color: theme.text, fontFamily: font.semibold, fontSize: 10.5 },
    timeArrow: { color: theme.faint, fontSize: 10 },
    addressRow: { flexDirection: "row", alignItems: "flex-start", gap: 4, minWidth: 0 },
    addressIcon: { marginTop: 1 },
    address: {
      color: theme.faint,
      fontFamily: font.regular,
      fontSize: 9.5,
      lineHeight: 13,
      flex: 1,
    },
    state: { gap: 6, paddingTop: 2 },
    stateTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    statePill: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 3 },
    statePillText: { fontFamily: font.bold, fontSize: 9.5 },
    stateMeta: { color: theme.muted, fontFamily: font.medium, fontSize: 9.5 },
    track: {
      height: 6,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: "hidden",
    },
    trackFill: { height: "100%", borderRadius: 999 },
    urgent: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 11,
      borderWidth: 1,
      paddingHorizontal: 9,
      paddingVertical: 7,
    },
    urgentText: { fontFamily: font.semibold, fontSize: 9.5, flex: 1 },
    infoBand: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      borderRadius: 11,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 9,
      paddingVertical: 7,
    },
    infoBandText: { color: theme.brand, fontFamily: font.semibold, fontSize: 9.5, flex: 1 },
    footer: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      paddingTop: 10,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.divider,
    },
    priceCol: { minWidth: 0, flex: 1, gap: 1 },
    amount: {
      color: theme.text,
      fontFamily: font.display,
      fontSize: 16,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    priceNote: { color: theme.muted, fontFamily: font.medium, fontSize: 9.5 },
    priceNoteOk: { color: theme.success },
    cta: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      minHeight: 34,
      paddingHorizontal: 12,
      borderRadius: 12,
      borderWidth: 1,
      flexShrink: 0,
    },
    ctaText: { fontFamily: font.bold, fontSize: 11 },
  });
