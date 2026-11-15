import { Lock, TicketPercent } from "lucide-react-native";
import { memo, useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type GestureResponderEvent,
} from "react-native";
import AppText from "@/components/AppText";
import i18n from "@/i18n";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { showToast } from "@/features/notifications/toastStore";
import VoucherTicketStub from "@/features/vouchers/components/VoucherTicketStub";
import {
  formatVoucherAmount,
  formatVoucherCardTiming,
  isExpiringSoon,
} from "@/features/vouchers/voucherFormat";

export type VoucherCardStatus = "active" | "upcoming" | "ended" | "used";

/** Dữ liệu chuẩn hoá cho thẻ voucher, dùng chung giữa các màn ưu đãi. */
export type VoucherCardData = {
  key: string;
  code: string;
  name: string;
  description?: string | null;
  discountType: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  vehicleType: string;
  startAt?: string | null;
  endAt?: string | null;
  usageCount: number;
  maxUsageCount: number;
  status: VoucherCardStatus;
  usedAt?: string | null;
};

type VoucherTicketCardAction = {
  icon?: ReactNode;
  label: string;
  onClick: () => void;
  pending?: boolean;
  /** Chặn CTA khi bản thân chiến dịch không dùng được (campaign-level). */
  disabled?: boolean;
  /** Lý do hiển thị khi người dùng chạm vào nút bị chặn (thay cho tooltip trên web). */
  disabledReason?: string;
  tone?: "primary" | "success" | "ghost";
};

type VoucherTicketCardProps = {
  action?: VoucherTicketCardAction;
  badge?: ReactNode;
  data: VoucherCardData;
  highlight?: boolean;
  /** Mở bottom sheet chi tiết — chạm vào thân thẻ. */
  onOpenDetail?: () => void;
  /** Ghi đè nhãn trạng thái khi thẻ không có CTA (dùng cho trang Lịch sử). */
  statusLabel?: string | null;
};

type StatusMeta = {
  /** Khoá i18n cho nhãn trạng thái (namespace promo). */
  labelKey: string;
  dot: string;
};

const STATUS_META: Record<VoucherCardStatus, StatusMeta> = {
  active: { labelKey: "promo:voucherCard.status.active", dot: "#10B981" },
  upcoming: { labelKey: "promo:voucherCard.status.upcoming", dot: "#3B82F6" },
  ended: { labelKey: "promo:voucherCard.status.ended", dot: "#94A3B8" },
  used: { labelKey: "promo:voucherCard.status.used", dot: "#94A3B8" },
};

/**
 * Thẻ voucher gọn kiểu ticket (mirror web VoucherTicketCard, phong cách Shopee):
 * cuống vé gradient + tên + chip trạng thái + 4 dòng thông tin sát giữa
 * (mã / giảm / đơn tối thiểu / thời gian) + CTA góc phải.
 * Chạm vào thân thẻ để mở chi tiết; mã voucher, phạm vi và cảnh báo nằm trong sheet.
 */
function VoucherTicketCard({
  action,
  badge,
  data,
  highlight = false,
  onOpenDetail,
  statusLabel = null,
}: VoucherTicketCardProps) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const muted = data.status === "used" || data.status === "ended";
  const status = STATUS_META[data.status];
  const expiringSoon = data.status === "active" && isExpiringSoon(data.endAt);
  const urgentColor = theme.mode === "dark" ? "#FBBF24" : "#B45309";

  const percent = new Intl.NumberFormat(i18n.language?.startsWith("en") ? "en-US" : "vi-VN", {
    maximumFractionDigits: 1,
  }).format(data.discountValue);

  const headline =
    data.discountType === "Percentage"
      ? data.maxDiscountAmount && data.maxDiscountAmount > 0
        ? t("promo:voucherCard.headlinePercentCap", {
            percent,
            max: formatVoucherAmount(data.maxDiscountAmount),
          })
        : t("promo:voucherCard.headlinePercent", { percent })
      : t("promo:voucherCard.headlineFixed", { amount: formatVoucherAmount(data.discountValue) });

  const minOrder =
    data.minOrderAmount && data.minOrderAmount > 0
      ? t("promo:voucherCard.minOrder", { amount: formatVoucherAmount(data.minOrderAmount) })
      : t("promo:voucherCard.noMinOrder");

  const timeText = formatVoucherCardTiming({
    status: data.status,
    startAt: data.startAt,
    endAt: data.endAt,
  });

  const disabledReason = action?.disabled
    ? action.disabledReason ?? t("promo:voucherCard.reasonUnavailable")
    : null;

  const resolvedStatusLabel = statusLabel ?? t(status.labelKey);
  /** Chip trạng thái trên tiêu đề chỉ dành cho voucher đang diễn ra (không trùng nhãn Lịch sử). */
  const showStatusChip =
    statusLabel === null && (data.status === "active" || data.status === "upcoming");

  function handleActionPress(event: GestureResponderEvent) {
    event.stopPropagation();
    if (!action || action.pending) return;
    if (action.disabled) {
      showToast({ type: "info", title: action.label, message: disabledReason ?? undefined });
      return;
    }
    action.onClick();
  }

  return (
    <Pressable
      onPress={onOpenDetail}
      disabled={!onOpenDetail}
      accessibilityRole={onOpenDetail ? "button" : undefined}
      accessibilityLabel={onOpenDetail ? t("mobile:voucher.card.detailAria") : undefined}
      accessibilityHint={onOpenDetail ? data.name : undefined}
      android_ripple={onOpenDetail ? { color: theme.brandSoft } : undefined}
      style={({ pressed }) => [
        styles.card,
        muted && styles.cardMuted,
        highlight && styles.cardHighlight,
        pressed && onOpenDetail ? styles.cardPressed : null,
      ]}
    >
      <VoucherTicketStub
        discountType={data.discountType}
        discountValue={data.discountValue}
        dimmed={muted}
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <AppText style={styles.name} numberOfLines={2}>
            {data.name}
          </AppText>
          {badge ? <View style={styles.badgeSlot}>{badge}</View> : null}
          {showStatusChip ? (
            <View style={styles.statusChip}>
              <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
              <AppText style={styles.statusChipText}>{resolvedStatusLabel}</AppText>
            </View>
          ) : null}
        </View>

        {/* 4 dòng thông tin sát giữa (mã / giảm / đơn tối thiểu / thời gian) */}
        <View style={styles.infoBlock}>
          <AppText style={styles.infoCode} numberOfLines={1}>
            {t("promo:voucherCard.codeLabel", { code: data.code })}
          </AppText>
          <AppText style={[styles.infoHeadline, muted && styles.infoHeadlineMuted]} numberOfLines={1}>
            {headline}
          </AppText>
          <AppText style={styles.infoMinOrder} numberOfLines={1}>
            {minOrder}
          </AppText>
          <AppText
            style={[styles.infoTime, expiringSoon && { color: urgentColor, fontWeight: "800" }]}
            numberOfLines={1}
          >
            {timeText}
          </AppText>
        </View>

        <View style={styles.footerRow}>
          {action ? (
            <Pressable
              onPress={handleActionPress}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={disabledReason ? `${action.label} — ${disabledReason}` : action.label}
              accessibilityHint={disabledReason ?? undefined}
              accessibilityState={{ disabled: action.disabled === true, busy: action.pending === true }}
              style={({ pressed }) => [
                styles.actionButton,
                action.tone === "success"
                  ? styles.actionSuccess
                  : action.tone === "ghost"
                    ? styles.actionGhost
                    : styles.actionPrimary,
                action.disabled && styles.actionDisabled,
                pressed && !action.disabled && !action.pending ? styles.actionPressed : null,
              ]}
            >
              {action.pending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : action.disabled ? (
                <Lock color={theme.muted} size={12} />
              ) : (
                action.icon ?? <TicketPercent color="#FFFFFF" size={13} />
              )}
              <AppText
                style={[styles.actionText, action.disabled && styles.actionTextDisabled]}
                numberOfLines={1}
              >
                {action.label}
              </AppText>
            </Pressable>
          ) : (
            <View style={styles.statusPill}>
              <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
              <AppText style={styles.statusText}>{resolvedStatusLabel}</AppText>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

export default memo(VoucherTicketCard);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    cardMuted: { opacity: 0.8 },
    cardPressed: { opacity: 0.92 },
    cardHighlight: {
      borderWidth: 2,
      borderColor: theme.brand,
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.12)" : "rgba(107,25,255,0.05)",
    },
    body: {
      flex: 1,
      minWidth: 0,
      paddingHorizontal: 11,
      paddingVertical: 10,
      gap: 6,
    },
    titleRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 8,
    },
    name: {
      flex: 1,
      minWidth: 0,
      color: theme.text,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 18,
    },
    badgeSlot: { alignSelf: "flex-start", flexShrink: 0, maxWidth: "48%" },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      paddingVertical: 2,
      borderRadius: 6,
      backgroundColor: theme.mode === "dark" ? "rgba(107,25,255,0.12)" : "rgba(107,25,255,0.08)",
      flexShrink: 0,
    },
    statusDot: { width: 5, height: 5, borderRadius: 3 },
    statusChipText: { color: theme.brand, fontSize: 10, fontWeight: "800" },
    infoBlock: { gap: 2 },
    infoCode: { color: theme.muted, fontSize: 11, lineHeight: 14 },
    infoHeadline: { color: theme.brand, fontSize: 13, fontWeight: "800", lineHeight: 17 },
    infoHeadlineMuted: { color: theme.muted },
    infoMinOrder: { color: theme.muted, fontSize: 11, lineHeight: 14 },
    infoTime: { color: theme.faint, fontSize: 11, lineHeight: 14, flexShrink: 1 },
    footerRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      justifyContent: "flex-end",
      gap: 8,
      marginTop: 4,
    },
    actionButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      height: 34,
      minWidth: 78,
      maxWidth: 132,
      borderRadius: 9,
      paddingHorizontal: 12,
      flexShrink: 0,
    },
    actionPrimary: { backgroundColor: theme.brand },
    actionSuccess: { backgroundColor: theme.success },
    actionGhost: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    actionDisabled: { backgroundColor: theme.surfaceAlt },
    actionPressed: { opacity: 0.85 },
    actionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
    actionTextDisabled: { color: theme.muted },
    statusPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 10,
      flexShrink: 0,
    },
    statusText: { color: theme.muted, fontSize: 11, fontWeight: "800" },
  });
