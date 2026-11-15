import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import PromotionDetailSheet, {
  type PromotionDetailSlide,
} from "@/features/vouchers/components/PromotionDetailSheet";
import VoucherTicketCard, {
  type VoucherCardData,
} from "@/features/vouchers/components/VoucherTicketCard";
import { getVoucherWallet } from "@/features/voucherClaims/services/voucherClaimService";
import type { VoucherClaimResponse } from "@/features/voucherClaims/types";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type HistoryTab = "invalid" | "used";

const HISTORY_TABS: { value: HistoryTab; labelKey: string }[] = [
  { value: "invalid", labelKey: "promo:history.tabInvalid" },
  { value: "used", labelKey: "promo:history.tabUsed" },
];

function isUsedVoucher(v: VoucherClaimResponse) {
  return Boolean(v.usedAt);
}
function isExpiredVoucher(v: VoucherClaimResponse) {
  if (!v.endAt) return false;
  return new Date(v.endAt).getTime() < Date.now();
}
function isExhaustedVoucher(v: VoucherClaimResponse) {
  return v.maxUsageCount > 0 && v.usageCount >= v.maxUsageCount;
}
function isInvalidVoucher(v: VoucherClaimResponse) {
  return !isUsedVoucher(v) && (isExpiredVoucher(v) || isExhaustedVoucher(v));
}

function toCardData(voucher: VoucherClaimResponse): VoucherCardData {
  const usedVoucher = isUsedVoucher(voucher);
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
    status: usedVoucher ? "used" : "ended",
    usedAt: voucher.usedAt,
  };
}

function toDetailSlide(voucher: VoucherClaimResponse, warning: string | null): PromotionDetailSlide {
  return {
    id: voucher.promotionId,
    promotionId: voucher.promotionId,
    title: voucher.name,
    caption: voucher.description,
    code: voucher.code,
    popupTitle: voucher.name,
    popupDescription: voucher.description ?? null,
    popupCtaLabel: undefined,
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
    warning: warning ?? undefined,
    scopeNote: undefined,
  };
}

/** Màn hình Lịch sử voucher: 2 tab "Không hợp lệ" (hết hạn / hết lượt) và "Đã sử dụng". */
function VoucherHistoryScreen() {
  const navigation = useNavigation<DealsNav>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [vouchers, setVouchers] = useState<VoucherClaimResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<HistoryTab>("invalid");
  const [selected, setSelected] = useState<PromotionDetailSlide | null>(null);

  const fetchWallet = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getVoucherWallet();
      setVouchers(Array.isArray(data) ? data : []);
    } catch {
      showToast({
        type: "error",
        title: t("promo:errorTitle"),
        message: t("promo:history.loadError"),
      });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void fetchWallet();
  }, [fetchWallet]);

  const invalid = useMemo(() => vouchers.filter(isInvalidVoucher), [vouchers]);
  const used = useMemo(() => vouchers.filter(isUsedVoucher), [vouchers]);
  const counts: Record<HistoryTab, number> = { invalid: invalid.length, used: used.length };
  const displayed = tab === "used" ? used : invalid;

  const filterDesc = useMemo(() => {
    if (tab === "invalid") return t("promo:history.filterDescInvalid");
    return t("promo:history.filterDescUsed");
  }, [tab, t]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText display style={styles.pageTitle}>
          {t("promo:history.pageTitle")}
        </AppText>
        <AppText style={styles.sectionDesc}>{t("promo:history.description")}</AppText>

        <View style={styles.tabBar}>
          {HISTORY_TABS.map((item) => {
            const active = item.value === tab;
            return (
              <Pressable
                key={item.value}
                onPress={() => setTab(item.value)}
                style={[styles.tab, active && styles.tabActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <AppText style={[styles.tabText, active && styles.tabTextActive]}>
                  {t(item.labelKey)}
                  <AppText style={[styles.tabCount, active && styles.tabCountActive]}>
                    ({counts[item.value]})
                  </AppText>
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <AppText style={styles.sectionDesc}>{filterDesc}</AppText>

        {loading && (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={theme.brand} />
          </View>
        )}

        {!loading && displayed.length === 0 && (
          <View style={styles.emptyBox}>
            <AppText display style={styles.emptyTitle}>
              {tab === "used"
                ? t("promo:history.emptyUsedTitle")
                : t("promo:history.emptyInvalidTitle")}
            </AppText>
            <AppText style={styles.emptyDesc}>
              {tab === "used"
                ? t("promo:history.emptyUsedDescription")
                : t("promo:history.emptyInvalidDescription")}
            </AppText>
          </View>
        )}

        {!loading && displayed.length > 0 && (
          <View style={styles.ticketList}>
            {displayed.map((voucher) => {
              const usedVoucher = isUsedVoucher(voucher);
              const exhaustedVoucher = isExhaustedVoucher(voucher);
              const expiredVoucher = isExpiredVoucher(voucher);
              const statusLabel = usedVoucher
                ? t("promo:history.statusUsed")
                : exhaustedVoucher
                  ? t("promo:history.reasonOutOfUsage")
                  : t("promo:history.reasonExpired");
              const warning = usedVoucher
                ? null
                : exhaustedVoucher
                  ? t("promo:history.warningOutOfUsage")
                  : expiredVoucher
                    ? t("promo:history.warningExpired")
                    : null;

              return (
                <VoucherTicketCard
                  key={voucher.id}
                  data={toCardData(voucher)}
                  statusLabel={statusLabel}
                  onOpenDetail={() => setSelected(toDetailSlide(voucher, warning))}
                />
              );
            })}
          </View>
        )}

        <Pressable
          onPress={() => navigation.navigate("VoucherWallet")}
          style={styles.backTouch}
          accessibilityRole="button"
          accessibilityLabel={t("promo:history.backToWallet")}
        >
          <AppText style={styles.backText}>{t("promo:history.backToWallet")}</AppText>
        </Pressable>
      </ScrollView>

      <PromotionDetailSheet
        slide={selected}
        onClose={() => setSelected(null)}
        onCta={() => {}}
        hideCta
      />
    </View>
  );
}

const MemoVoucherHistoryScreen = memo(VoucherHistoryScreen);
export default MemoVoucherHistoryScreen;

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 96, gap: 12 },
    pageTitle: { color: theme.text, fontSize: 21, fontWeight: "900", letterSpacing: -0.4 },
    sectionDesc: { color: theme.muted, fontSize: 12 },
    tabBar: { flexDirection: "row", gap: 8, marginBottom: 8 },
    tab: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 10,
      paddingVertical: 7,
      flexShrink: 0,
    },
    tabActive: {
      borderColor: theme.brand,
      backgroundColor: theme.mode === "dark" ? "rgba(107,25,255,0.12)" : "rgba(107,25,255,0.06)",
    },
    tabText: { color: theme.text, fontSize: 12, fontWeight: "700" },
    tabTextActive: { color: theme.brand },
    tabCount: { color: theme.faint, fontSize: 11, fontWeight: "700" },
    tabCountActive: { color: theme.brand },
    ticketList: { gap: 12 },
    loading: { paddingVertical: 40, alignItems: "center" },
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
    emptyTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    emptyDesc: { color: theme.muted, fontSize: 12, textAlign: "center" },
    backTouch: {
      alignItems: "center",
      paddingVertical: 10,
    },
    backText: { color: theme.brand, fontSize: 13, fontWeight: "700" },
  });
