import { Check, Copy, TicketPercent } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import { brandPalette, type Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import VoucherTicketStub from "@/features/vouchers/components/VoucherTicketStub";
import {
  formatEndDate,
  formatVnd,
  formatVehicleLabelShort,
  isExpiringSoon,
  voucherUsagePercent,
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
  tone?: "primary" | "success" | "ghost";
};

type VoucherTicketCardProps = {
  action?: VoucherTicketCardAction;
  badge?: ReactNode;
  copied?: boolean;
  data: VoucherCardData;
  highlight?: boolean;
  onCopyCode?: () => void;
  onOpenDetail?: () => void;
  showCode?: boolean;
};

type StatusMeta = {
  label: string;
  chipBg: string;
  chipText: string;
  chipBorder: string;
  dot: string;
};

const STATUS_META: Record<VoucherCardStatus, StatusMeta> = {
  active: {
    label: "Đang diễn ra",
    chipBg: "#ECFDF5",
    chipText: "#047857",
    chipBorder: "#A7F3D0",
    dot: "#10B981",
  },
  upcoming: {
    label: "Sắp diễn ra",
    chipBg: "#EFF6FF",
    chipText: "#1D4ED8",
    chipBorder: "#BFDBFE",
    dot: "#3B82F6",
  },
  ended: {
    label: "Đã kết thúc",
    chipBg: "#F1F5F9",
    chipText: "#475569",
    chipBorder: "#E2E8F0",
    dot: "#94A3B8",
  },
  used: {
    label: "Đã dùng",
    chipBg: "#F1F5F9",
    chipText: "#475569",
    chipBorder: "#E2E8F0",
    dot: "#94A3B8",
  },
};

/**
 * Thẻ ưu đãi gọn dùng chung cho khuyến mãi, săn mã và ví voucher.
 */
function VoucherTicketCard({
  action,
  badge,
  copied = false,
  data,
  highlight = false,
  onCopyCode,
  onOpenDetail,
  showCode = false,
}: VoucherTicketCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const endLabel = formatEndDate(data.endAt);
  const usagePercent = voucherUsagePercent(data.usageCount, data.maxUsageCount);
  const expiringSoon = data.status === "active" && isExpiringSoon(data.endAt);
  const status = STATUS_META[data.status];
  const muted = data.status === "used" || data.status === "ended";

  const conditions = [
    data.minOrderAmount ? `Đơn từ ${formatVnd(data.minOrderAmount)}` : null,
    data.maxDiscountAmount
      ? `Tối đa ${formatVnd(data.maxDiscountAmount)}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const dark = theme.mode === "dark";

  return (
    <View
      style={[
        styles.card,
        muted && styles.cardMuted,
        highlight && styles.cardHighlight,
      ]}
    >
      <VoucherTicketStub
        discountType={data.discountType}
        discountValue={data.discountValue}
        dimmed={muted}
      />
      <View style={styles.divider} />

      <View style={styles.body}>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.statusChip,
              {
                backgroundColor: dark ? `${status.dot}1F` : status.chipBg,
                borderColor: dark ? `${status.dot}55` : status.chipBorder,
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: status.dot }]} />
            <AppText
              style={[
                styles.statusText,
                { color: dark ? status.dot : status.chipText },
              ]}
            >
              {status.label}
            </AppText>
          </View>

          {expiringSoon && !badge ? (
            <View
              style={[
                styles.expiringChip,
                {
                  backgroundColor: dark ? "rgba(245,158,11,0.15)" : "#FFFBEB",
                  borderColor: dark ? "rgba(245,158,11,0.35)" : "#FDE68A",
                },
              ]}
            >
              <AppText
                style={[
                  styles.expiringText,
                  { color: dark ? "#FBBF24" : "#B45309" },
                ]}
              >
                Sắp hết hạn
              </AppText>
            </View>
          ) : null}

          {badge}
        </View>

        <AppText style={styles.name} numberOfLines={2}>
          {data.name}
        </AppText>
        {data.description && !onOpenDetail ? (
          <AppText style={styles.description} numberOfLines={1}>
            {data.description}
          </AppText>
        ) : null}

        <View style={styles.metaRow}>
          <AppText style={styles.metaText}>
            {formatVehicleLabelShort(data.vehicleType)}
          </AppText>
          {endLabel ? (
            <AppText
              style={[
                styles.metaText,
                expiringSoon && { color: theme.warning },
              ]}
            >
              HSD {endLabel}
            </AppText>
          ) : null}
        </View>
        {conditions ? (
          <AppText style={styles.metaText}>{conditions}</AppText>
        ) : null}

        {showCode ? (
          <View style={styles.codeRow}>
            <View style={styles.codeBox}>
              <AppText style={styles.codeText} numberOfLines={1}>
                {data.code}
              </AppText>
            </View>
            {onCopyCode ? (
              <Pressable
                onPress={onCopyCode}
                style={styles.copyButton}
                accessibilityRole="button"
                accessibilityLabel="Sao chép mã"
              >
                {copied ? (
                  <Check color={theme.brand} size={13} />
                ) : (
                  <Copy color={theme.brand} size={13} />
                )}
                <AppText style={styles.copyButtonText}>
                  {copied ? "Đã chép" : "Sao chép"}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {usagePercent !== null && usagePercent > 0 ? (
          <View style={styles.usageWrap}>
            <AppText style={styles.usageLabel}>
              Đã dùng {Math.round(usagePercent)}% lượt
            </AppText>
            {usagePercent >= 80 ? (
              <View style={styles.usageTrack}>
                <LinearGradient
                  colors={["#F59E0B", "#F43F5E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.usageFill, { width: `${usagePercent}%` }]}
                />
              </View>
            ) : null}
          </View>
        ) : null}

        {onOpenDetail || action ? (
          <View style={styles.actionRow}>
            {onOpenDetail ? (
              <Pressable
                onPress={onOpenDetail}
                style={styles.detailButton}
                accessibilityRole="button"
                accessibilityLabel="Xem chi tiết"
              >
                <AppText style={styles.detailButtonText}>Chi tiết</AppText>
              </Pressable>
            ) : null}
            {action ? (
              <Pressable
                onPress={action.onClick}
                disabled={action.pending}
                style={[
                  styles.actionButton,
                  action.tone === "success"
                    ? styles.actionSuccess
                    : action.tone === "ghost"
                      ? styles.actionGhost
                      : styles.actionPrimary,
                  action.pending && styles.actionDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel={action.label}
                accessibilityState={{
                  disabled: Boolean(action.pending),
                  busy: Boolean(action.pending),
                }}
              >
                {(!action.tone || action.tone === "primary") && (
                  <LinearGradient
                    colors={brandPalette.softGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[StyleSheet.absoluteFill, { borderRadius: 10 }]}
                  />
                )}
                {action.pending ? (
                  <ActivityIndicator
                    color={action.tone === "ghost" ? theme.brand : "#FFFFFF"}
                    size="small"
                  />
                ) : (
                  (action.icon ?? (
                    <TicketPercent
                      color={action.tone === "ghost" ? theme.brand : "#FFFFFF"}
                      size={14}
                    />
                  ))
                )}
                <AppText
                  style={[
                    styles.actionButtonText,
                    action.tone === "ghost" && { color: theme.brand },
                  ]}
                >
                  {action.label}
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default memo(VoucherTicketCard);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    card: {
      flexDirection: "row",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    cardMuted: { backgroundColor: theme.surface },
    cardHighlight: {
      borderWidth: 1,
      borderColor: theme.brand,
      backgroundColor: theme.surface,
    },
    divider: {
      width: 0,
      borderLeftWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.brandBorder,
      marginVertical: 8,
    },
    body: { flex: 1, minWidth: 0, padding: 10, gap: 6 },
    badgeRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "center",
      gap: 6,
    },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: "500" },
    expiringChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    expiringText: { fontSize: 10, fontWeight: "600" },
    name: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "700",
      lineHeight: 19,
    },
    description: { color: theme.muted, fontSize: 12, lineHeight: 17 },
    metaRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      columnGap: 10,
      rowGap: 2,
    },
    metaText: { color: theme.muted, fontSize: 11 },
    codeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 1,
    },
    codeBox: {
      flex: 1,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    codeText: {
      color: theme.brand,
      fontSize: 12,
      fontWeight: "800",
      fontFamily: "monospace",
    },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 10,
      backgroundColor: theme.brandSoft,
      minHeight: 44,
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexShrink: 0,
    },
    copyButtonText: { color: theme.brand, fontSize: 11, fontWeight: "600" },
    usageWrap: { gap: 4, marginTop: 1 },
    usageLabel: { color: theme.faint, fontSize: 10, fontWeight: "700" },
    usageTrack: {
      height: 3,
      borderRadius: 3,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F1F5F9",
      overflow: "hidden",
    },
    usageFill: { height: "100%", borderRadius: 3 },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    detailButton: {
      minHeight: 44,
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 10,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },
    detailButtonText: { color: theme.brand, fontSize: 12, fontWeight: "600" },
    actionButton: {
      minHeight: 44,
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 11,
    },
    actionPrimary: { backgroundColor: theme.brandSolid },
    actionSuccess: { backgroundColor: "#059669" },
    actionGhost: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    actionDisabled: { opacity: 0.6 },
    actionButtonText: {
      color: "#FFFFFF",
      fontSize: 12,
      fontWeight: "600",
      flexShrink: 1,
      textAlign: "center",
    },
  });
