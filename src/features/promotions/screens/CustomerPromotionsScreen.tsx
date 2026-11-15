import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Sparkles } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { Promotion } from "@/features/promotions/types";
import { getActivePromotions } from "@/features/promotions/services/promotionService";
import DealsFilterBar from "@/features/vouchers/components/DealsFilterBar";
import DealsSegmentedNav from "@/features/vouchers/components/DealsSegmentedNav";
import PromotionDetailSheet, {
  type PromotionDetailSlide,
} from "@/features/vouchers/components/PromotionDetailSheet";
import VoucherTicketCard, {
  type VoucherCardData,
} from "@/features/vouchers/components/VoucherTicketCard";
import { isExpiringSoon } from "@/features/vouchers/voucherFormat";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type VehicleFilter = "All" | "Car" | "Motorbike";
type SortOrder = "latest" | "ending";

const SORT_OPTIONS: { value: SortOrder; labelKey: string }[] = [
  { value: "latest", labelKey: "promo:promotions.sortLatest" },
  { value: "ending", labelKey: "promo:promotions.sortEnding" },
];

function toDetailSlide(p: Promotion): PromotionDetailSlide {
  return {
    id: p.id,
    promotionId: p.id,
    title: p.name,
    caption: p.description,
    code: p.code,
    popupTitle: p.name,
    popupDescription: p.description ?? null,
    popupCtaLabel: i18n.t("promo:promotions.ctaClaim"),
    promotionName: p.name,
    discountType: p.discountType,
    discountValue: p.discountValue,
    vehicleType: p.vehicleType,
    startAt: p.startAt,
    endAt: p.endAt,
    minOrderAmount: p.minOrderAmount,
    maxDiscountAmount: p.maxDiscountAmount,
    usageCount: p.usageCount,
    maxUsageCount: p.maxUsageCount,
  };
}

function toCardData(p: Promotion): VoucherCardData {
  const startsLater = new Date(p.startAt).getTime() > Date.now();
  const ended = Boolean(p.endAt && new Date(p.endAt).getTime() < Date.now());
  return {
    key: String(p.id),
    code: p.code,
    name: p.name,
    description: p.description,
    discountType: p.discountType,
    discountValue: p.discountValue,
    maxDiscountAmount: p.maxDiscountAmount,
    minOrderAmount: p.minOrderAmount,
    vehicleType: p.vehicleType,
    endAt: p.endAt,
    usageCount: p.usageCount,
    maxUsageCount: p.maxUsageCount,
    status: ended ? "ended" : startsLater ? "upcoming" : "active",
  };
}

export default function CustomerPromotionsScreen() {
  const navigation = useNavigation<DealsNav>();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [items, setItems] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState<VehicleFilter>("All");
  const [expiringOnly, setExpiringOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>("latest");
  const [selected, setSelected] = useState<PromotionDetailSlide | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getActivePromotions()
      .then((promos) => {
        if (cancelled) return;
        setItems(Array.isArray(promos) ? promos : []);
      })
      .catch(() => {
        if (!cancelled) setError(i18n.t("promo:promotions.loadError"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const carCount = useMemo(
    () => items.filter((p) => p.vehicleType === "Car" || p.vehicleType === "All").length,
    [items],
  );
  const motorbikeCount = useMemo(
    () => items.filter((p) => p.vehicleType === "Motorbike" || p.vehicleType === "All").length,
    [items],
  );
  const expiringCount = useMemo(
    () => items.filter((p) => isExpiringSoon(p.endAt)).length,
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = items.filter((p) => {
      if (vehicleFilter !== "All" && p.vehicleType !== "All" && p.vehicleType !== vehicleFilter)
        return false;
      if (expiringOnly && !isExpiringSoon(p.endAt)) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });

    return result.sort((first, second) => {
      if (sortOrder === "ending") {
        const firstEnd = first.endAt ? new Date(first.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        const secondEnd = second.endAt ? new Date(second.endAt).getTime() : Number.MAX_SAFE_INTEGER;
        return firstEnd - secondEnd;
      }
      return new Date(second.startAt).getTime() - new Date(first.startAt).getTime();
    });
  }, [items, search, vehicleFilter, expiringOnly, sortOrder]);

  const handleSheetCta = useCallback(
    (promotionId: number) => {
      setSelected(null);
      navigation.navigate("VoucherHunt", { promotionId });
    },
    [navigation],
  );

  const filters = useMemo(
    () => [
      { value: "All", label: t("promo:promotions.filterAll"), count: items.length },
      { value: "Car", label: t("promo:promotions.filterCar"), count: carCount },
      { value: "Motorbike", label: t("promo:promotions.filterMotorbike"), count: motorbikeCount },
      {
        value: "expiring",
        label: t("promo:promotions.expiring"),
        count: expiringCount,
        tone: "amber" as const,
      },
    ],
    [items.length, carCount, motorbikeCount, expiringCount, t],
  );

  const sortOptions = useMemo(
    () => SORT_OPTIONS.map((option) => ({ value: option.value, label: t(option.labelKey) })),
    [t],
  );

  const activeFilter = expiringOnly ? "expiring" : vehicleFilter;

  const handleFilterChange = useCallback((value: string) => {
    if (value === "expiring") {
      setExpiringOnly(true);
      setVehicleFilter("All");
      return;
    }
    setVehicleFilter(value as VehicleFilter);
    setExpiringOnly(false);
  }, []);

  const sectionTitle = useMemo(() => {
    if (expiringOnly) return t("promo:promotions.filteringExpiring");
    return t("promo:promotions.activeTitle");
  }, [expiringOnly, t]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText display style={styles.pageTitle}>
          {t("mobile:voucher.nav.promotions")}
        </AppText>

        <DealsSegmentedNav />

        <DealsFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={t("promo:promotions.searchPlaceholder")}
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          sortValue={sortOrder}
          sortOptions={sortOptions}
          onSortChange={(value) => setSortOrder(value as SortOrder)}
        />

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <AppText style={styles.errorText}>{error}</AppText>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Sparkles color={theme.brand} size={26} />
            </View>
            <AppText display style={styles.emptyTitle}>
              {t("promo:promotions.emptyTitle")}
            </AppText>
            <AppText style={styles.emptyDesc}>
              {t("promo:promotions.emptyDescription")}
            </AppText>
            <Pressable
              onPress={() => navigation.navigate("VoucherHunt")}
              style={styles.emptyLinkTouch}
            >
              <AppText style={styles.emptyLink}>
                {t("promo:promotions.exploreVouchers")} →
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHead}>
              <View style={styles.sectionTitleRow}>
                <AppText display style={styles.sectionTitle}>
                  {sectionTitle}
                </AppText>
                <View style={styles.countBadge}>
                  <AppText style={styles.countBadgeText}>{filtered.length}</AppText>
                </View>
              </View>
              <AppText style={styles.sectionDesc}>
                {t("promo:promotions.selectHint")}
              </AppText>
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyBox}>
                <AppText display style={styles.emptyTitle}>
                  {t("promo:promotions.noMatchTitle")}
                </AppText>
                <AppText style={styles.emptyDesc}>
                  {t("promo:promotions.noMatchDescription")}
                </AppText>
              </View>
            ) : (
              <View style={styles.ticketList}>
                {filtered.map((p) => (
                  <MemoTicketCard
                    key={p.id}
                    item={p}
                    onOpen={() => setSelected(toDetailSlide(p))}
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

type TicketCardProps = {
  item: Promotion;
  onOpen: () => void;
};

function TicketCard({ item, onOpen }: TicketCardProps) {
  return (
    <VoucherTicketCard
      data={toCardData(item)}
      onOpenDetail={onOpen}
    />
  );
}

const MemoTicketCard = memo(TicketCard);

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
    ticketList: { gap: 12 },
    centerBox: { paddingVertical: 64, alignItems: "center" },
    errorBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
      backgroundColor: theme.dangerSoft,
      padding: 14,
    },
    errorText: { color: theme.danger, fontSize: 13 },
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
