import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { Sparkles, TicketPercent } from "lucide-react-native";
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
import DealsFilterBar from "@/features/vouchers/components/DealsFilterBar";
import DealsSegmentedNav from "@/features/vouchers/components/DealsSegmentedNav";
import PromotionDetailSheet, {
  type PromotionDetailSlide,
} from "@/features/vouchers/components/PromotionDetailSheet";
import VoucherTicketCard, {
  type VoucherCardData,
} from "@/features/vouchers/components/VoucherTicketCard";
import { getDaysLeft, isExpiringSoon } from "@/features/vouchers/voucherFormat";
import { claimVoucher, getVoucherHunt } from "@/features/voucherClaims/services/voucherClaimService";
import type { VoucherHuntItem } from "@/features/voucherClaims/types";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type HuntRoute = RouteProp<DealsStackParamList, "VoucherHunt">;
type HuntFilter = "All" | "Car" | "Motorbike" | "expiring" | "deep";
type HuntSort = "value" | "ending" | "remaining";

const SORT_OPTIONS = [
  { value: "value", label: "Giảm nhiều nhất" },
  { value: "ending", label: "Hạn gần nhất" },
  { value: "remaining", label: "Còn nhiều lượt" },
];

function toDetailSlide(item: VoucherHuntItem): PromotionDetailSlide {
  return {
    id: item.promotionId,
    promotionId: item.promotionId,
    title: item.name,
    caption: item.description,
    code: item.code,
    popupTitle: item.name,
    popupDescription: item.description ?? null,
    popupCtaLabel: "Nhận voucher ngay",
    promotionName: item.name,
    discountType: item.discountType,
    discountValue: item.discountValue,
    vehicleType: item.vehicleType,
    endAt: item.endAt,
    minOrderAmount: item.minOrderAmount,
    maxDiscountAmount: item.maxDiscountAmount,
    usageCount: item.usageCount,
    maxUsageCount: item.maxUsageCount,
  };
}

function toCardData(item: VoucherHuntItem): VoucherCardData {
  return {
    key: String(item.promotionId),
    code: item.code,
    name: item.name,
    description: item.description,
    discountType: item.discountType,
    discountValue: item.discountValue,
    maxDiscountAmount: item.maxDiscountAmount,
    minOrderAmount: item.minOrderAmount,
    vehicleType: item.vehicleType,
    endAt: item.endAt,
    usageCount: item.usageCount,
    maxUsageCount: item.maxUsageCount,
    status: "active",
  };
}

type HuntCardProps = {
  item: VoucherHuntItem;
  highlighted: boolean;
  claiming: boolean;
  copied: boolean;
  onClaim: () => void;
  onCopy: () => void;
  onOpenDetail: () => void;
  onLayoutY: (promotionId: number, y: number) => void;
};

function HuntCard({
  item,
  highlighted,
  claiming,
  copied,
  onClaim,
  onCopy,
  onOpenDetail,
  onLayoutY,
}: HuntCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const daysLeft = getDaysLeft(item.endAt);

  return (
    <View onLayout={(e) => onLayoutY(item.promotionId, e.nativeEvent.layout.y)}>
      <VoucherTicketCard
        data={toCardData(item)}
        highlight={highlighted}
        showCode
        copied={copied}
        onCopyCode={onCopy}
        onOpenDetail={onOpenDetail}
        badge={
          highlighted ? (
            <View style={styles.highlightBadge}>
              <Sparkles color={theme.brand} size={11} />
              <AppText style={styles.highlightBadgeText}>Voucher bạn đang tìm</AppText>
            </View>
          ) : daysLeft !== null && daysLeft <= 3 ? (
            <View
              style={[
                styles.urgentBadge,
                {
                  backgroundColor: theme.mode === "dark" ? "rgba(244,63,94,0.15)" : "#FEE2E2",
                  borderColor: theme.mode === "dark" ? "rgba(244,63,94,0.35)" : "#FECACA",
                },
              ]}
            >
              <AppText style={[styles.urgentBadgeText, { color: theme.mode === "dark" ? "#FB7185" : "#B91C1C" }]}>
                Hết hạn sau {daysLeft} ngày
              </AppText>
            </View>
          ) : null
        }
        action={{
          label: "Nhận voucher",
          icon: claiming ? null : <Sparkles color="#FFFFFF" size={14} />,
          pending: claiming,
          onClick: onClaim,
        }}
      />
    </View>
  );
}

const MemoHuntCard = memo(HuntCard);

export default function VoucherHuntScreen() {
  const navigation = useNavigation<DealsNav>();
  const route = useRoute<HuntRoute>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [vouchers, setVouchers] = useState<VoucherHuntItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [filter, setFilter] = useState<HuntFilter>("All");
  const [sort, setSort] = useState<HuntSort>("value");
  const [search, setSearch] = useState("");
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<PromotionDetailSlide | null>(null);

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

  const carCount = useMemo(
    () => vouchers.filter((v) => v.vehicleType === "Car" || v.vehicleType === "All").length,
    [vouchers],
  );
  const motorbikeCount = useMemo(
    () => vouchers.filter((v) => v.vehicleType === "Motorbike" || v.vehicleType === "All").length,
    [vouchers],
  );
  const expiringCount = useMemo(
    () => vouchers.filter((v) => isExpiringSoon(v.endAt)).length,
    [vouchers],
  );
  const deepCount = useMemo(
    () => vouchers.filter((v) => v.discountType === "Percentage" && v.discountValue > 30).length,
    [vouchers],
  );

  const filters = useMemo(
    () => [
      { value: "All", label: "Tất cả", count: vouchers.length },
      { value: "Car", label: "Ô tô", count: carCount },
      { value: "Motorbike", label: "Xe máy", count: motorbikeCount },
      { value: "expiring", label: "Sắp hết hạn", count: expiringCount, tone: "amber" as const },
      { value: "deep", label: "Giảm sâu >30%", count: deepCount },
    ],
    [vouchers.length, carCount, motorbikeCount, expiringCount, deepCount],
  );

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = vouchers.filter((voucher) => {
      if (filter === "Car" && voucher.vehicleType === "Motorbike") return false;
      if (filter === "Motorbike" && voucher.vehicleType === "Car") return false;
      if (filter === "expiring" && !isExpiringSoon(voucher.endAt)) return false;
      if (filter === "deep" && !(voucher.discountType === "Percentage" && voucher.discountValue > 30))
        return false;
      if (!query) return true;
      return (
        voucher.name.toLowerCase().includes(query) ||
        voucher.code.toLowerCase().includes(query) ||
        (voucher.description ?? "").toLowerCase().includes(query)
      );
    });

    return result.sort((first, second) => {
      if (sort === "ending") {
        const firstEnd = first.endAt ? new Date(first.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        const secondEnd = second.endAt ? new Date(second.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        return firstEnd - secondEnd;
      }
      if (sort === "remaining") {
        return (
          second.maxUsageCount - second.usageCount - (first.maxUsageCount - first.usageCount)
        );
      }
      return second.discountValue - first.discountValue;
    });
  }, [vouchers, filter, sort, search]);

  const handleClaimed = useCallback((promotionId: number) => {
    setVouchers((prev) => prev.filter((v) => v.promotionId !== promotionId));
  }, []);

  const handleLayoutY = useCallback((promotionId: number, y: number) => {
    yMap.current.set(promotionId, y);
  }, []);

  async function handleClaim(item: VoucherHuntItem) {
    setClaimingId(item.promotionId);
    try {
      await claimVoucher(item.promotionId);
      showToast({
        type: "success",
        title: "Nhận thành công!",
        message: `${item.name} đã thêm vào ví voucher.`,
      });
      handleClaimed(item.promotionId);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string; errors?: string[] } } })
        ?.response?.data;
      showToast({
        type: "error",
        title: "Lỗi",
        message: response?.message || response?.errors?.[0] || "Không thể nhận voucher.",
      });
    } finally {
      setClaimingId(null);
    }
  }

  async function handleCopy(item: VoucherHuntItem) {
    try {
      await Clipboard.setStringAsync(item.code);
      setCopiedId(item.promotionId);
      showToast({ type: "success", title: "Đã sao chép mã", message: item.code });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast({ type: "error", title: "Lỗi", message: "Không sao chép được mã voucher." });
    }
  }

  const handleSheetCta = useCallback(
    (promotionId: number) => {
      setSelected(null);
      navigation.navigate("VoucherHunt", { promotionId });
    },
    [navigation],
  );

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
        <AppText display style={styles.pageTitle}>
          Săn voucher
        </AppText>

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

        <DealsFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm tên ưu đãi, mã voucher..."
          filters={filters}
          activeFilter={filter}
          onFilterChange={(value) => setFilter(value as HuntFilter)}
          sortValue={sort}
          sortOptions={SORT_OPTIONS}
          onSortChange={(value) => setSort(value as HuntSort)}
        />

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        ) : vouchers.length === 0 && deepPromotionId === null ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <TicketPercent color={theme.brand} size={26} />
            </View>
            <AppText display style={styles.emptyTitle}>
              Tất cả voucher đã được nhận hết
            </AppText>
            <AppText style={styles.emptyDesc}>
              Quay lại sau nhé, các đợt săn mã mới sẽ xuất hiện ở đây.
            </AppText>
            <Pressable
              onPress={() => navigation.navigate("Promotions")}
              style={styles.emptyLinkTouch}
            >
              <AppText style={styles.emptyLink}>Xem trung tâm ưu đãi →</AppText>
            </Pressable>
          </View>
        ) : vouchers.length === 0 ? (
          <View style={styles.emptyBox}>
            <AppText style={styles.emptyDesc}>Hiện không có voucher nào khác để nhận.</AppText>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <AppText display style={styles.sectionTitle}>
                  Voucher khả dụng
                </AppText>
                <View style={styles.countBadge}>
                  <AppText style={styles.countBadgeText}>{displayed.length}</AppText>
                </View>
              </View>
              <AppText style={styles.sectionDesc}>
                Nhận voucher để lưu vào ví và dùng khi đặt xe.
              </AppText>
            </View>

            {displayed.length === 0 ? (
              <View style={styles.emptyBox}>
                <AppText display style={styles.emptyTitle}>
                  Không có voucher phù hợp
                </AppText>
                <AppText style={styles.emptyDesc}>
                  Thử đổi bộ lọc hoặc từ khoá tìm kiếm.
                </AppText>
              </View>
            ) : (
              <View style={styles.cardList}>
                {displayed.map((v) => (
                  <MemoHuntCard
                    key={v.promotionId}
                    item={v}
                    highlighted={v.promotionId === highlightId}
                    claiming={claimingId === v.promotionId}
                    copied={copiedId === v.promotionId}
                    onClaim={() => void handleClaim(v)}
                    onCopy={() => void handleCopy(v)}
                    onOpenDetail={() => setSelected(toDetailSlide(v))}
                    onLayoutY={handleLayoutY}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <PromotionDetailSheet
        slide={selected}
        onClose={() => setSelected(null)}
        onCta={handleSheetCta}
      />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 12 },
    pageTitle: { color: theme.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.4 },
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
    sectionHead: { gap: 4 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "900", flexShrink: 1 },
    countBadge: {
      borderRadius: 999,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    countBadgeText: { color: theme.brand, fontSize: 11, fontWeight: "900" },
    sectionDesc: { color: theme.muted, fontSize: 12 },
    highlightBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    highlightBadgeText: { color: theme.brand, fontSize: 10, fontWeight: "800" },
    urgentBadge: {
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    urgentBadgeText: { fontSize: 10, fontWeight: "800" },
    cardList: { gap: 10 },
    centerBox: { paddingVertical: 64, alignItems: "center" },
    emptyBox: {
      alignItems: "center",
      paddingVertical: 40,
      paddingHorizontal: 16,
      gap: 6,
      borderRadius: 18,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.border,
      backgroundColor: theme.surface,
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
    },
    emptyTitle: { color: theme.text, fontSize: 15, fontWeight: "900", marginTop: 8, textAlign: "center" },
    emptyDesc: { color: theme.muted, fontSize: 13, textAlign: "center", lineHeight: 19 },
    emptyLinkTouch: { marginTop: 6, padding: 6 },
    emptyLink: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  });
