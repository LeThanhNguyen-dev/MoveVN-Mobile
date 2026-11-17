import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TicketPercent, Wallet } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
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
import { formatVoucherDateTime, isExpiringSoon, isUpcomingStart } from "@/features/vouchers/voucherFormat";
import { getVoucherWallet } from "@/features/voucherClaims/services/voucherClaimService";
import type {
  VoucherAvailabilityReasonCode,
  VoucherClaimResponse,
} from "@/features/voucherClaims/types";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type WalletFilter = "all" | "available" | "expiring";
type WalletSort = "newest" | "ending" | "value";

const SORT_OPTIONS: { value: WalletSort; labelKey: string }[] = [
  { value: "newest", labelKey: "promo:wallet.sortNewest" },
  { value: "ending", labelKey: "promo:wallet.sortEnding" },
  { value: "value", labelKey: "promo:wallet.sortValue" },
];

/** Mã lý do campaign-level -> khoá i18n (mirror web wallet). */
const REASON_MESSAGE_KEYS: Record<string, string> = {
  CampaignPaused: "promo:wallet.reasonCampaignPaused",
  CampaignNotApproved: "promo:wallet.reasonCampaignNotApproved",
  NoParticipatingOwner: "promo:wallet.reasonNoParticipatingOwner",
};

/** Lý do campaign-level đã localize; null khi voucher không có vấn đề toàn chiến dịch. */
function resolveReason(t: TFunction, voucher: VoucherClaimResponse): string | null {
  const code = (voucher.availabilityReasonCode ?? null) as VoucherAvailabilityReasonCode | null;
  if (!code) return null;
  const key = REASON_MESSAGE_KEYS[code];
  return key ? t(key) : voucher.availabilityReason ?? t("promo:wallet.reasonUnavailable");
}

function isUsed(voucher: VoucherClaimResponse) {
  return Boolean(voucher.usedAt);
}

function isEnded(voucher: VoucherClaimResponse) {
  if (!voucher.endAt) return false;
  return new Date(voucher.endAt).getTime() < Date.now();
}

function isExhausted(voucher: VoucherClaimResponse) {
  return voucher.maxUsageCount > 0 && voucher.usageCount >= voucher.maxUsageCount;
}

/** Voucher hết hạn hoặc hết lượt (chưa dùng) → đưa về Lịch sử, không nằm trong ví chính. */
function isInvalid(voucher: VoucherClaimResponse) {
  return !isUsed(voucher) && (isEnded(voucher) || isExhausted(voucher));
}

function toCardData(voucher: VoucherClaimResponse): VoucherCardData {
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
    startAt: voucher.startAt,
    endAt: voucher.endAt,
    usageCount: voucher.usageCount,
    maxUsageCount: voucher.maxUsageCount,
    status: isEnded(voucher)
      ? "ended"
      : isUpcomingStart(voucher.startAt)
        ? "upcoming"
        : "active",
    usedAt: voucher.usedAt,
  };
}

function toDetailSlide(
  voucher: VoucherClaimResponse,
  extra?: { scopeNote?: string | null; warning?: string | null },
): PromotionDetailSlide {
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
    startAt: voucher.startAt,
    endAt: voucher.endAt,
    minOrderAmount: voucher.minOrderAmount,
    maxDiscountAmount: voucher.maxDiscountAmount,
    usageCount: voucher.usageCount,
    maxUsageCount: voucher.maxUsageCount,
    ...extra,
  };
}

type WalletCardProps = {
  voucher: VoucherClaimResponse;
  onUseNow: () => void;
  onOpenDetail: () => void;
};

function WalletCard({ voucher, onUseNow, onOpenDetail }: WalletCardProps) {
  const { t } = useTranslation();
  const noticeMessage = resolveReason(t, voucher);
  const upcoming = isUpcomingStart(voucher.startAt);
  // Voucher đã nhận nhưng chưa tới ngày hiệu lực: khoá "Dùng ngay" và giải thích.
  const timingReason = upcoming
    ? t("promo:voucherCard.reasonNotStarted", {
        datetime: formatVoucherDateTime(voucher.startAt) ?? "",
      })
    : null;
  const lockReason = timingReason ?? noticeMessage;

  return (
    <VoucherTicketCard
      data={toCardData(voucher)}
      onOpenDetail={onOpenDetail}
      action={{
        label: t("promo:wallet.useNow"),
        icon: <TicketPercent color="#FFFFFF" size={13} />,
        onClick: onUseNow,
        disabled: lockReason !== null,
        disabledReason: lockReason ?? undefined,
      }}
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

  /** Ví chỉ chứa voucher còn dùng được: chưa dùng, chưa hết hạn, chưa hết lượt. */
  const usable = useMemo(
    () => vouchers.filter((v) => !isUsed(v) && !isInvalid(v)),
    [vouchers],
  );
  const available = useMemo(
    () => usable.filter((v) => !isUpcomingStart(v.startAt)),
    [usable],
  );
  const expiring = useMemo(() => available.filter((v) => isExpiringSoon(v.endAt)), [available]);

  const filters = useMemo(
    () => [
      { value: "all", label: t("promo:wallet.filterAll"), count: usable.length },
      { value: "available", label: t("promo:wallet.filterAvailable"), count: available.length },
      {
        value: "expiring",
        label: t("promo:wallet.filterExpiring"),
        count: expiring.length,
        tone: "amber" as const,
      },
    ],
    [usable.length, available.length, expiring.length, t],
  );

  const sortOptions = useMemo(
    () => SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t],
  );

  const displayed = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = usable.filter((voucher) => {
      if (filter === "available" && isUpcomingStart(voucher.startAt)) return false;
      if (filter === "expiring" && (!isExpiringSoon(voucher.endAt) || isUpcomingStart(voucher.startAt))) return false;
      if (!query) return true;
      return (
        voucher.name.toLowerCase().includes(query) ||
        voucher.code.toLowerCase().includes(query) ||
        (voucher.description ?? "").toLowerCase().includes(query)
      );
    });

    return result.sort((first, second) => {
      // Usable-now first, upcoming after; the chosen sort orders within each group.
      const firstUpcoming = isUpcomingStart(first.startAt);
      const secondUpcoming = isUpcomingStart(second.startAt);
      if (firstUpcoming !== secondUpcoming) return firstUpcoming ? 1 : -1;
      if (sort === "value") return second.discountValue - first.discountValue;
      if (sort === "ending") {
        const firstEnd = first.endAt ? new Date(first.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        const secondEnd = second.endAt ? new Date(second.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        return firstEnd - secondEnd;
      }
      return new Date(second.claimedAt).getTime() - new Date(first.claimedAt).getTime();
    });
  }, [usable, filter, sort, search]);

  const filterDesc = useMemo(() => {
    if (filter === "available") return t("promo:wallet.hintAvailable");
    if (filter === "expiring") return t("promo:wallet.hintExpiring");
    return t("promo:wallet.hintAll");
  }, [filter, t]);

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

        <View style={styles.actionRow}>
          <Pressable
            onPress={() => navigation.navigate("VoucherHistory")}
            style={[styles.actionTouch, styles.actionOutline]}
            accessibilityRole="button"
            accessibilityLabel={t("promo:wallet.historyAction")}
          >
            <AppText style={styles.actionText}>{t("promo:wallet.historyAction")}</AppText>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("VoucherHunt")}
            style={[styles.actionTouch, styles.actionPrimary]}
            accessibilityRole="button"
            accessibilityLabel={t("promo:wallet.huntMore")}
          >
            <AppText style={[styles.actionText, styles.actionPrimaryText]}>{t("promo:wallet.huntMore")}</AppText>
          </Pressable>
        </View>

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
        ) : usable.length === 0 ? (
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
                {displayed.map((voucher) => {
                  const timingWarning = isUpcomingStart(voucher.startAt)
                    ? t("promo:voucherCard.reasonNotStarted", {
                        datetime: formatVoucherDateTime(voucher.startAt) ?? "",
                      })
                    : null;
                  const warning = timingWarning ?? resolveReason(t, voucher);
                  const scopeLabel =
                    voucher.ownerId != null
                      ? t("promo:wallet.scopeOwner", {
                          owner: voucher.ownerName ?? `#${voucher.ownerId}`,
                        })
                      : t("promo:wallet.scopeGlobal");
                  const showOwnerCount =
                    Boolean(voucher.requiresOwnerOptIn) && (voucher.totalOwnerCount ?? 0) > 0;
                  const scopeNote = [
                    scopeLabel,
                    showOwnerCount
                      ? t("promo:wallet.ownerJoined", {
                          accepted: voucher.acceptedOwnerCount ?? 0,
                          total: voucher.totalOwnerCount,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ");

                  return (
                    <MemoWalletCard
                      key={voucher.id}
                      voucher={voucher}
                      onUseNow={handleUseNow}
                      onOpenDetail={() =>
                        setSelected(toDetailSlide(voucher, { scopeNote, warning }))
                      }
                    />
                  );
                })}
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
    actionRow: { flexDirection: "row", gap: 8, marginTop: 8 },
    actionTouch: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      flex: 1,
    },
    actionOutline: { borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface },
    actionPrimary: { backgroundColor: theme.brand },
    actionText: { color: theme.text, fontSize: 12, fontWeight: "800" },
    actionPrimaryText: { color: "#FFFFFF" },
    ticketList: { gap: 12 },
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
