import { Check, Copy, TicketPercent } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { memo, useMemo, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import VoucherTicketStub from "@/features/vouchers/components/VoucherTicketStub";
import {
  CTA_GRADIENT,
  formatEndDate,
  formatVnd,
  formatVehicleLabel,
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
 * Thẻ voucher dùng chung cho cả 3 màn ưu đãi (mirror web VoucherTicketCard):
 * cuống vé gradient + nhãn trạng thái + mã ưu đãi (copy) + thanh lượt dùng + nút hành động.
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

  const capLabel = data.maxDiscountAmount
    ? `Tối đa ${formatVnd(data.maxDiscountAmount)}`
    : data.minOrderAmount
      ? `Đơn từ ${formatVnd(data.minOrderAmount)}`
      : "Ưu đãi MoveVN";

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
        caption={capLabel}
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
            <AppText style={[styles.statusText, { color: dark ? status.dot : status.chipText }]}>
              {status.label}
            </AppText>
          </View>

          {expiringSoon ? (
            <View
              style={[
                styles.expiringChip,
                {
                  backgroundColor: dark ? "rgba(245,158,11,0.15)" : "#FFFBEB",
                  borderColor: dark ? "rgba(245,158,11,0.35)" : "#FDE68A",
                },
              ]}
            >
              <AppText style={[styles.expiringText, { color: dark ? "#FBBF24" : "#B45309" }]}>
                ⏰ Sắp hết hạn
              </AppText>
            </View>
          ) : null}

          {badge}
        </View>

        <AppText style={styles.name} numberOfLines={2}>
          {data.name}
        </AppText>
        {data.description ? (
          <AppText style={styles.description} numberOfLines={2}>
            {data.description}
          </AppText>
        ) : null}

        <View style={styles.metaRow}>
          <AppText style={styles.metaText}>{formatVehicleLabel(data.vehicleType)}</AppText>
          {endLabel ? <AppText style={styles.metaText}>HSD: {endLabel}</AppText> : null}
        </View>

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
                  <Check color="#FFFFFF" size={13} />
                ) : (
                  <Copy color="#FFFFFF" size={13} />
                )}
                <AppText style={styles.copyButtonText}>{copied ? "Đã copy" : "Copy"}</AppText>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {usagePercent !== null ? (
          <View style={styles.usageWrap}>
            <View style={styles.usageHead}>
              <AppText style={styles.usageLabel}>Đã dùng</AppText>
              <AppText style={styles.usagePercent}>{Math.round(usagePercent)}%</AppText>
            </View>
            <View style={styles.usageTrack}>
              {usagePercent >= 80 ? (
                <LinearGradient
                  colors={["#F59E0B", "#F43F5E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.usageFill, { width: `${usagePercent}%` }]}
                />
              ) : (
                <LinearGradient
                  colors={["#8B5CF6", "#6366F1"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.usageFill, { width: `${usagePercent}%` }]}
                />
              )}
            </View>
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
              >
                {action.pending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  action.icon ?? <TicketPercent color="#FFFFFF" size={14} />
                )}
                <AppText style={styles.actionButtonText} numberOfLines={1}>
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    cardMuted: { opacity: 0.78 },
    cardHighlight: {
      borderWidth: 2,
      borderColor: theme.brand,
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.12)" : "rgba(107,25,255,0.06)",
    },
    divider: {
      width: 0,
      borderLeftWidth: 2,
      borderStyle: "dashed",
      borderColor: theme.mode === "dark" ? "#3F3F46" : "#DDD6FE",
      marginVertical: 10,
    },
    body: { flex: 1, minWidth: 0, padding: 14, gap: 7 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
    statusChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    statusDot: { width: 6, height: 6, borderRadius: 3 },
    statusText: { fontSize: 10, fontWeight: "800" },
    expiringChip: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    expiringText: { fontSize: 10, fontWeight: "800" },
    name: { color: theme.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
    description: { color: theme.muted, fontSize: 12, lineHeight: 17 },
    metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    metaText: { color: theme.muted, fontSize: 12 },
    codeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 1 },
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
    codeText: { color: theme.brand, fontSize: 12, fontWeight: "800", fontFamily: "monospace" },
    copyButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 10,
      backgroundColor: "#7C3AED",
      paddingHorizontal: 12,
      paddingVertical: 8,
      flexShrink: 0,
    },
    copyButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "700" },
    usageWrap: { gap: 4, marginTop: 1 },
    usageHead: { flexDirection: "row", justifyContent: "space-between", gap: 6 },
    usageLabel: { color: theme.faint, fontSize: 10, fontWeight: "700" },
    usagePercent: { color: theme.brand, fontSize: 10, fontWeight: "800" },
    usageTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F1F5F9",
      overflow: "hidden",
    },
    usageFill: { height: "100%", borderRadius: 3 },
    actionRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
    detailButton: {
      flexShrink: 0,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 10,
      backgroundColor: theme.brandSoft,
      paddingVertical: 9,
      paddingHorizontal: 11,
    },
    detailButtonText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    actionButton: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 10,
      paddingVertical: 9,
      paddingHorizontal: 11,
    },
    actionPrimary: { backgroundColor: "#7C3AED" },
    actionSuccess: { backgroundColor: "#059669" },
    actionGhost: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    actionDisabled: { opacity: 0.6 },
    actionButtonText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  });
