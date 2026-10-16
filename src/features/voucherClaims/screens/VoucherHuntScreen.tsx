import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { Clock, Copy, Sparkles, TicketPercent } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "@/navigation/types";
import { showToast } from "@/features/notifications/toastStore";
import DealsSegmentedNav from "@/features/vouchers/components/DealsSegmentedNav";
import VoucherTicketStub from "@/features/vouchers/components/VoucherTicketStub";
import {
  CTA_GRADIENT,
  formatVehicleLabel,
  formatVnd,
  getDaysLeft,
  getUsageStats,
} from "@/features/vouchers/voucherFormat";
import { claimVoucher, getVoucherHunt } from "@/features/voucherClaims/services/voucherClaimService";
import type { VoucherHuntItem } from "@/features/voucherClaims/types";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type HuntRoute = RouteProp<DealsStackParamList, "VoucherHunt">;

function HuntVoucherCard({
  item,
  highlighted,
  onClaimed,
  onLayoutY,
}: {
  item: VoucherHuntItem;
  highlighted: boolean;
  onClaimed: (promotionId: number) => void;
  onLayoutY: (promotionId: number, y: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [claiming, setClaiming] = useState(false);

  const daysLeft = getDaysLeft(item.endAt);
  const { percent, almostGone, remaining } = getUsageStats(item.maxUsageCount, item.usageCount);

  async function handleClaim() {
    if (claiming) return;
    setClaiming(true);
    try {
      await claimVoucher(item.promotionId);
      showToast({
        type: "success",
        title: "Nhận thành công!",
        message: `${item.name} đã thêm vào ví voucher.`,
      });
      onClaimed(item.promotionId);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string; errors?: string[] } } })
        ?.response?.data;
      showToast({
        type: "error",
        title: "Lỗi",
        message: response?.message || response?.errors?.[0] || "Không thể nhận voucher.",
      });
    } finally {
      setClaiming(false);
    }
  }

  function handleCopyCode() {
    void Clipboard.setStringAsync(item.code);
  }

  return (
    <View onLayout={(e) => onLayoutY(item.promotionId, e.nativeEvent.layout.y)}>
      <View style={[styles.ticket, highlighted && styles.ticketHighlighted]}>
        <VoucherTicketStub discountType={item.discountType} discountValue={item.discountValue} />
        <View style={styles.ticketDivider} />

        <View style={styles.ticketBody}>
          <View style={styles.nameRow}>
            <AppText style={styles.ticketName} numberOfLines={1}>
              {item.name}
            </AppText>
            {daysLeft !== null ? (
              <View
                style={[
                  styles.daysBadge,
                  daysLeft <= 3 ? styles.daysBadgeUrgent : styles.daysBadgeNormal,
                ]}
              >
                <Clock
                  color={daysLeft <= 3 ? (theme.mode === "dark" ? "#FB7185" : "#B91C1C") : theme.muted}
                  size={11}
                />
                <AppText
                  style={[
                    styles.daysBadgeText,
                    daysLeft <= 3
                      ? { color: theme.mode === "dark" ? "#FB7185" : "#B91C1C" }
                      : { color: theme.muted },
                  ]}
                >
                  ⏰ {daysLeft > 0 ? `Còn ${daysLeft} ngày` : "Hôm nay!"}
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <AppText style={styles.tagText}>{formatVehicleLabel(item.vehicleType)}</AppText>
            </View>
            {!!item.minOrderAmount && (
              <View style={styles.tag}>
                <AppText style={[styles.tagText, styles.tagAmber]}>Đơn từ {formatVnd(item.minOrderAmount)}</AppText>
              </View>
            )}
            <Pressable
              onPress={handleCopyCode}
              style={styles.codeTag}
              accessibilityRole="button"
              accessibilityLabel={`Sao chép mã ${item.code}`}
            >
              <Copy color={theme.brand} size={11} />
              <AppText style={styles.codeTagText}>🎟️ {item.code}</AppText>
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={almostGone ? (["#FB923C", "#EF4444"] as const) : [CTA_GRADIENT[1], CTA_GRADIENT[2]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${percent}%` }]}
              />
            </View>
            <AppText style={[styles.remainingText, almostGone && styles.remainingUrgent]}>
              Còn {remaining} lượt
            </AppText>
          </View>

          <Pressable
            onPress={handleClaim}
            disabled={claiming}
            style={[styles.claimTouch, claiming && styles.claimDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Nhận voucher"
          >
            <LinearGradient
              colors={[CTA_GRADIENT[0], CTA_GRADIENT[1], CTA_GRADIENT[2]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.claimBg}
            >
              {claiming ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <AppText style={styles.claimText}>✨ Nhận voucher</AppText>
                  <Sparkles color="#FFFFFF" size={14} />
                </>
              )}
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const MemoHuntCard = memo(HuntVoucherCard);

export default function VoucherHuntScreen() {
  const navigation = useNavigation<DealsNav>();
  const route = useRoute<HuntRoute>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [vouchers, setVouchers] = useState<VoucherHuntItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<number | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const yMap = useRef(new Map<number, number>());
  const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const deepPromotionId = route.params?.promotionId ?? null;

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVoucherHunt();
      setVouchers(Array.isArray(data) ? data : []);
    } catch {
      showToast({ type: "error", title: "Lỗi", message: "Không thể tải danh sách voucher." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchVouchers();
  }, [fetchVouchers]);

  useEffect(() => {
    if (loading || deepPromotionId === null) return;
    if (!vouchers.some((v) => v.promotionId === deepPromotionId)) return;
    const y = yMap.current.get(deepPromotionId);
    if (y != null) scrollRef.current?.scrollTo({ y: Math.max(0, y - 120), animated: true });
    setHighlightId(deepPromotionId);
    if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    highlightTimer.current = setTimeout(() => setHighlightId(null), 2500);
    return () => {
      if (highlightTimer.current !== null) clearTimeout(highlightTimer.current);
    };
  }, [loading, vouchers, deepPromotionId]);

  const handleClaimed = useCallback((promotionId: number) => {
    setVouchers((prev) => prev.filter((v) => v.promotionId !== promotionId));
  }, []);

  const handleLayoutY = useCallback((promotionId: number, y: number) => {
    yMap.current.set(promotionId, y);
  }, []);

  const deepMissed =
    !loading && deepPromotionId !== null && !vouchers.some((v) => v.promotionId === deepPromotionId);

  return (
    <View style={styles.root}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText display style={styles.pageTitle}>Săn voucher</AppText>
        <AppText style={styles.pageDesc}>Nhận voucher và lưu vào ví để dùng khi đặt xe.</AppText>

        <DealsSegmentedNav />

        {deepMissed ? (
          <View style={styles.warnBox}>
            <AppText style={styles.warnText}>
              Voucher này có thể bạn đã nhận hoặc hiện không còn khả dụng.
            </AppText>
            <Pressable onPress={() => navigation.navigate("VoucherWallet")} style={styles.warnButton}>
              <AppText style={styles.warnButtonText}>Xem voucher đã nhận →</AppText>
            </Pressable>
          </View>
        ) : null}

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        ) : vouchers.length === 0 && deepPromotionId === null ? (
          <View style={styles.emptyBox}>
            <TicketPercent color={theme.faint} size={44} />
            <AppText display style={styles.emptyTitle}>Tất cả voucher đã được nhận hết.</AppText>
            <AppText style={styles.emptyDesc}>Quay lại sau nhé!</AppText>
          </View>
        ) : vouchers.length === 0 ? (
          <View style={styles.emptyBox}>
            <AppText style={styles.emptyDesc}>Hiện không có voucher nào khác để nhận.</AppText>
          </View>
        ) : (
          <View style={styles.cardList}>
            {vouchers.map((v) => (
              <MemoHuntCard
                key={v.promotionId}
                item={v}
                highlighted={v.promotionId === highlightId}
                onClaimed={handleClaimed}
                onLayoutY={handleLayoutY}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 96, gap: 12 },
    pageTitle: { color: theme.text, fontSize: 22, fontWeight: "800" },
    pageDesc: { color: theme.muted, fontSize: 13, marginTop: -8 },

    warnBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(245,158,11,0.35)" : "#FDE68A",
      backgroundColor: theme.mode === "dark" ? "rgba(245,158,11,0.12)" : "#FFFBEB",
      padding: 14,
      gap: 8,
    },
    warnText: {
      color: theme.mode === "dark" ? "#FCD34D" : "#92400E",
      fontSize: 13,
      lineHeight: 18,
    },
    warnButton: { alignSelf: "flex-start", paddingVertical: 4 },
    warnButtonText: { color: theme.brand, fontSize: 13, fontWeight: "800" },

    centerBox: { paddingVertical: 64, alignItems: "center" },
    emptyBox: { alignItems: "center", paddingVertical: 40, gap: 6 },
    emptyTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginTop: 8, textAlign: "center" },
    emptyDesc: { color: theme.muted, fontSize: 13, textAlign: "center" },

    cardList: { gap: 14 },
    ticket: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? theme.border : "#E2E8F0",
      backgroundColor: theme.surface,
      overflow: "hidden",
      flexDirection: "row",
    },
    ticketHighlighted: {
      borderColor: theme.brand,
      borderWidth: 2,
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.12)" : "rgba(124,58,237,0.06)",
    },
    ticketDivider: {
      width: 0,
      borderLeftWidth: 2,
      borderStyle: "dashed",
      borderColor: theme.mode === "dark" ? "#3F3F46" : "#DDD6FE",
      marginVertical: 10,
    },
    ticketBody: { flex: 1, minWidth: 0, padding: 14, gap: 8 },
    nameRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
    ticketName: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
    daysBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexShrink: 0,
    },
    daysBadgeNormal: {
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F1F5F9",
    },
    daysBadgeUrgent: {
      backgroundColor: theme.mode === "dark" ? "rgba(244,63,94,0.15)" : "#FEE2E2",
    },
    daysBadgeText: { fontSize: 11, fontWeight: "700" },

    tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 2 },
    tag: {
      borderRadius: 8,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F1F5F9",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    tagText: { color: theme.muted, fontSize: 11, fontWeight: "600" },
    tagAmber: { color: theme.mode === "dark" ? "#FBBF24" : "#B45309" },
    codeTag: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.mode === "dark" ? "rgba(139,92,255,0.35)" : "#DDD6FE",
      backgroundColor: theme.mode === "dark" ? "rgba(139,92,255,0.12)" : "#F5F3FF",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    codeTagText: { color: theme.brand, fontSize: 11, fontWeight: "800", fontFamily: "monospace" },

    progressRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    progressTrack: {
      flex: 1,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.mode === "dark" ? theme.surfaceAlt : "#F3F4F6",
      overflow: "hidden",
    },
    progressFill: { height: "100%", borderRadius: 4 },
    remainingText: { color: theme.muted, fontSize: 11, fontWeight: "500", flexShrink: 0 },
    remainingUrgent: { color: theme.mode === "dark" ? "#FB7185" : "#DC2626", fontWeight: "700" },

    claimTouch: { borderRadius: 12, marginTop: 4 },
    claimDisabled: { opacity: 0.7 },
    claimBg: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      width: "100%",
      paddingVertical: 10,
      borderRadius: 12,
    },
    claimText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  });
