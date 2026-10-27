import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { Clock, Wallet } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { getVoucherWallet } from "@/features/voucherClaims/services/voucherClaimService";
import type { VoucherClaimResponse } from "@/features/voucherClaims/types";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type WalletFilter = "all" | "available" | "used" | "expiring";
type WalletSort = "newest" | "ending" | "value";

const WALLET_FILTERS: { value: WalletFilter; label: string }[] = [
  { value: "all", label: "Tất cả" },
  { value: "available", label: "Chưa dùng" },
  { value: "used", label: "Đã dùng" },
  { value: "expiring", label: "Sắp hết hạn" },
];

const SORT_OPTIONS = [
  { value: "newest", label: "Mới nhận nhất" },
  { value: "ending", label: "Hạn gần nhất" },
  { value: "value", label: "Giảm nhiều nhất" },
];

function isUsed(voucher: VoucherClaimResponse) {
  return Boolean(voucher.usedAt);
}

function isEnded(voucher: VoucherClaimResponse) {
  if (!voucher.endAt) return false;
  return new Date(voucher.endAt).getTime() < Date.now();
}

function toCardData(voucher: VoucherClaimResponse): VoucherCardData {
  const usedVoucher = isUsed(voucher);
  return {
    key: String(voucher.id),
    code: voucher.code,
    name: voucher.name,
    description: voucher.description,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    maxDiscountAmount: voucher.maxDiscountAmount,
    minOrderAmount: voucher.minOrderAmount,
    vehicleType: voucher.vehicleType,
    endAt: voucher.endAt,
    usageCount: voucher.usageCount,
    maxUsageCount: voucher.maxUsageCount,
    status: usedVoucher ? "used" : isEnded(voucher) ? "ended" : "active",
    usedAt: voucher.usedAt,
  };
}

function toDetailSlide(voucher: VoucherClaimResponse): PromotionDetailSlide {
  return {
    id: voucher.id,
    promotionId: voucher.promotionId,
    title: voucher.name,
    caption: voucher.description,
    code: voucher.code,
    popupTitle: voucher.name,
    popupDescription: voucher.description ?? null,
    popupCtaLabel: "Dùng ngay",
    promotionName: voucher.name,
    discountType: voucher.discountType,
    discountValue: voucher.discountValue,
    vehicleType: voucher.vehicleType,
    endAt: voucher.endAt,
    minOrderAmount: voucher.minOrderAmount,
    maxDiscountAmount: voucher.maxDiscountAmount,
    usageCount: voucher.usageCount,
    maxUsageCount: voucher.maxUsageCount,
  };
}

type WalletCardProps = {
  voucher: VoucherClaimResponse;
  copied: boolean;
  onCopy: () => void;
  onUseNow: () => void;
  onOpenDetail: () => void;
};

function WalletCard({ voucher, copied, onCopy, onUseNow, onOpenDetail }: WalletCardProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const days = getDaysLeft(voucher.endAt);
  const usedVoucher = isUsed(voucher);
  const showDaysBadge = !usedVoucher && days !== null && days <= 7;

  return (
    <VoucherTicketCard
      data={toCardData(voucher)}
      showCode
      copied={copied}
      onCopyCode={onCopy}
      onOpenDetail={onOpenDetail}
      badge={
        showDaysBadge ? (
          <View
            style={[
              styles.daysBadge,
              {
                backgroundColor: theme.mode === "dark" ? "rgba(245,158,11,0.15)" : "#FFFBEB",
                borderColor: theme.mode === "dark" ? "rgba(245,158,11,0.35)" : "#FDE68A",
              },
            ]}
          >
            <Clock color={theme.mode === "dark" ? "#FBBF24" : "#B45309"} size={11} />
            <AppText style={[styles.daysBadgeText, { color: theme.mode === "dark" ? "#FBBF24" : "#B45309" }]}>
              Còn {days} ngày
            </AppText>
          </View>
        ) : null
      }
      action={
        usedVoucher
          ? undefined
          : {
              label: "Dùng ngay",
              icon: <Wallet color="#FFFFFF" size={14} />,
              onClick: onUseNow,
            }
      }
    />
  );
}

const MemoWalletCard = memo(WalletCard);

export default function VoucherWalletScreen({ onUseNow }: { onUseNow?: () => void }) {
  const navigation = useNavigation<DealsNav>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [vouchers, setVouchers] = useState<VoucherClaimResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<WalletFilter>("all");
  const [sort, setSort] = useState<WalletSort>("newest");
  const [search, setSearch] = useState("");
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [selected, setSelected] = useState<PromotionDetailSlide | null>(null);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVoucherWallet();
      setVouchers(Array.isArray(data) ? data : []);
    } catch {
      showToast({ type: "error", title: "Lỗi", message: "Không thể tải ví voucher." });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const available = useMemo(
    () => vouchers.filter((v) => !isUsed(v) && !isEnded(v)),
    [vouchers],
  );
  const used = useMemo(() => vouchers.filter(isUsed), [vouchers]);
  const expiring = useMemo(() => available.filter((v) => isExpiringSoon(v.endAt)), [available]);

  const filters = useMemo(
    () => [
      { value: "all", label: "Tất cả", count: vouchers.length },
      { value: "available", label: "Chưa dùng", count: available.length },
      { value: "used", label: "Đã dùng", count: used.length },
      { value: "expiring", label: "Sắp hết hạn", count: expiring.length, tone: "amber" as const },
    ],
    [vouchers.length, available.length, used.length, expiring.length],
  );

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = vouchers.filter((voucher) => {
      if (filter === "available" && (isUsed(voucher) || isEnded(voucher))) return false;
      if (filter === "used" && !isUsed(voucher)) return false;
      if (filter === "expiring" && !isExpiringSoon(voucher.endAt)) return false;
      if (!query) return true;
      return (
        voucher.name.toLowerCase().includes(query) ||
        voucher.code.toLowerCase().includes(query) ||
        (voucher.description ?? "").toLowerCase().includes(query)
      );
    });

    return result.sort((first, second) => {
      if (sort === "value") return second.discountValue - first.discountValue;
      if (sort === "ending") {
        const firstEnd = first.endAt ? new Date(first.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        const secondEnd = second.endAt ? new Date(second.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        return firstEnd - secondEnd;
      }
      return new Date(second.claimedAt).getTime() - new Date(first.claimedAt).getTime();
    });
  }, [vouchers, filter, sort, search]);

  const filterDesc = useMemo(() => {
    if (filter === "available") return "Các voucher bạn có thể dùng ngay.";
    if (filter === "used") return "Lịch sử các voucher đã áp dụng.";
    if (filter === "expiring") return "Những voucher sắp hết hạn, dùng sớm thôi!";
    return "Chọn một voucher để sao chép mã hoặc dùng ngay.";
  }, [filter]);

  async function handleCopy(voucher: VoucherClaimResponse) {
    try {
      await Clipboard.setStringAsync(voucher.code);
      setCopiedId(voucher.id);
      showToast({ type: "success", title: "Đã sao chép mã", message: voucher.code });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast({ type: "error", title: "Lỗi", message: "Không sao chép được mã voucher." });
    }
  }

  function handleUseNow() {
    if (onUseNow) {
      onUseNow();
      return;
    }
    showToast({
      type: "info",
      title: "Đặt xe ngay",
      message: "Mở tab Khám phá để chọn xe và dùng voucher khi đặt.",
    });
  }

  function handleSheetCta() {
    setSelected(null);
    handleUseNow();
  }

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText display style={styles.pageTitle}>
          Ví voucher
        </AppText>

        <DealsSegmentedNav />

        <DealsFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm voucher, mã ưu đãi..."
          filters={filters}
          activeFilter={filter}
          onFilterChange={(value) => setFilter(value as WalletFilter)}
          sortValue={sort}
          sortOptions={SORT_OPTIONS}
          onSortChange={(value) => setSort(value as WalletSort)}
        />

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        ) : vouchers.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Wallet color={theme.brand} size={26} />
            </View>
            <AppText display style={styles.emptyTitle}>
              Ví voucher còn trống
            </AppText>
            <AppText style={styles.emptyDesc}>
              Hãy săn thêm voucher từ trung tâm ưu đãi, voucher đã nhận sẽ xuất hiện ở đây để dùng khi đặt xe.
            </AppText>
            <Pressable
              onPress={() => navigation.navigate("VoucherHunt")}
              style={styles.emptyLinkTouch}
            >
              <AppText style={styles.emptyLink}>Săn voucher ngay →</AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <AppText display style={styles.sectionTitle}>
                  Voucher trong ví
                </AppText>
                <View style={styles.countBadge}>
                  <AppText style={styles.countBadgeText}>{displayed.length}</AppText>
                </View>
              </View>
              <AppText style={styles.sectionDesc}>{filterDesc}</AppText>
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
              <View style={styles.ticketList}>
                {displayed.map((voucher) => (
                  <MemoWalletCard
                    key={voucher.id}
                    voucher={voucher}
                    copied={copiedId === voucher.id}
                    onCopy={() => void handleCopy(voucher)}
                    onUseNow={handleUseNow}
                    onOpenDetail={() => setSelected(toDetailSlide(voucher))}
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
    daysBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      borderWidth: 1,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    daysBadgeText: { fontSize: 10, fontWeight: "800" },
    ticketList: { gap: 10 },
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
