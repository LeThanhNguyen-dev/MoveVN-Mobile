import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Clipboard from "expo-clipboard";
import { Clock, Wallet } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native"
import i18n from "@/i18n";
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

const SORT_OPTIONS: { value: WalletSort; labelKey: string }[] = [
  { value: "newest", labelKey: "promo:wallet.sortNewest" },
  { value: "ending", labelKey: "promo:wallet.sortEnding" },
  { value: "value", labelKey: "promo:wallet.sortValue" },
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
    popupCtaLabel: i18n.t("promo:wallet.useNow"),
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
  const { t } = useTranslation();
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
              {t("promo:wallet.daysLeft", { days })}
            </AppText>
          </View>
        ) : null
      }
      action={
        usedVoucher
          ? undefined
          : {
              label: t("promo:wallet.useNow"),
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
  const { t } = useTranslation();
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
      showToast({
        type: "error",
        title: i18n.t("promo:errorTitle"),
        message: i18n.t("promo:wallet.loadError"),
      });
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
      { value: "all", label: t("promo:wallet.filterAll"), count: vouchers.length },
      { value: "available", label: t("promo:wallet.filterAvailable"), count: available.length },
      { value: "used", label: t("promo:wallet.filterUsed"), count: used.length },
      {
        value: "expiring",
        label: t("promo:wallet.filterExpiring"),
        count: expiring.length,
        tone: "amber" as const,
      },
    ],
    [vouchers.length, available.length, used.length, expiring.length, t],
  );

  const sortOptions = useMemo(
    () => SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t],
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
    if (filter === "available") return t("promo:wallet.hintAvailable");
    if (filter === "used") return t("promo:wallet.hintUsed");
    if (filter === "expiring") return t("promo:wallet.hintExpiring");
    return t("promo:wallet.hintAll");
  }, [filter, t]);

  async function handleCopy(voucher: VoucherClaimResponse) {
    try {
      await Clipboard.setStringAsync(voucher.code);
      setCopiedId(voucher.id);
      showToast({ type: "success", title: t("promo:wallet.copiedTitle"), message: voucher.code });
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      showToast({
        type: "error",
        title: t("promo:errorTitle"),
        message: t("promo:wallet.copyError"),
      });
    }
  }

  function handleUseNow() {
    if (onUseNow) {
      onUseNow();
      return;
    }
    showToast({
      type: "info",
      title: t("mobile:voucher.wallet.bookNowTitle"),
      message: t("mobile:voucher.wallet.bookNowMessage"),
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
          {t("promo:wallet.pageTitle")}
        </AppText>

        <DealsSegmentedNav />

        <DealsFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("promo:wallet.searchPlaceholder")}
          filters={filters}
          activeFilter={filter}
          onFilterChange={(value) => setFilter(value as WalletFilter)}
          sortValue={sort}
          sortOptions={sortOptions}
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
              {t("promo:wallet.emptyTitle")}
            </AppText>
            <AppText style={styles.emptyDesc}>
              {t("promo:wallet.emptyDescription")}
            </AppText>
            <Pressable
              onPress={() => navigation.navigate("VoucherHunt")}
              style={styles.emptyLinkTouch}
            >
              <AppText style={styles.emptyLink}>
                {t("promo:wallet.emptyCta")} →
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <AppText display style={styles.sectionTitle}>
                  {t("promo:wallet.listTitle")}
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
                  {t("promo:wallet.noMatch")}
                </AppText>
                <AppText style={styles.emptyDesc}>
                  {t("promo:wallet.noMatchHint")}
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
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 96, gap: 14 },
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
    ticketList: { gap: 14 },
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
