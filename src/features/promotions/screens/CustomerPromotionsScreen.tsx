import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ArrowRight, Sparkles } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import AppText from "@/components/AppText";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "@/navigation/types";
import type { HomepageBanner } from "@/features/banners/types";
import { getHomepageBanners } from "@/features/banners/services/bannerService";
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

const VEHICLE_FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: "All", label: "Tất cả" },
  { value: "Car", label: "Ô tô" },
  { value: "Motorbike", label: "Xe máy" },
];

const SORT_OPTIONS = [
  { value: "latest", label: "Mới nhất" },
  { value: "ending", label: "Hạn gần nhất" },
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
    popupCtaLabel: "Săn voucher ngay",
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

function HeroCarousel({
  slides,
  onOpen,
}: {
  slides: PromotionDetailSlide[];
  onOpen: (s: PromotionDetailSlide) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { width } = useWindowDimensions();
  const cardWidth = width - 40;
  const step = cardWidth + 12;
  const [page, setPage] = useState(0);

  if (slides.length === 0) return null;

  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={step}
        snapToAlignment="start"
        disableIntervalMomentum
        contentContainerStyle={{ gap: 12 }}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(e.nativeEvent.contentOffset.x / step);
          setPage(Math.max(0, Math.min(slides.length - 1, index)));
        }}
      >
        {slides.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => onOpen(s)}
            style={[styles.heroCard, { width: cardWidth }]}
            accessibilityRole="button"
            accessibilityLabel={s.title}
          >
            {!!s.image ? (
              <Image
                source={{ uri: s.image }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
              />
            ) : null}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.65)"]}
              style={styles.heroShade}
            />
            <View style={styles.heroBadge}>
              <Sparkles color="#FCD34D" size={11} />
              <AppText style={styles.heroBadgeText}>ƯU ĐÃI NỔI BẬT</AppText>
            </View>
            <AppText display style={styles.heroTitle} numberOfLines={1}>
              {s.title}
            </AppText>
            <View style={styles.heroCta}>
              <AppText style={styles.heroCtaText}>Xem ưu đãi</AppText>
              <ArrowRight color="#6B21A8" size={14} />
            </View>
          </Pressable>
        ))}
      </ScrollView>
      {slides.length > 1 ? (
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <View
              key={String(s.id)}
              style={[styles.dot, i === page && styles.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function CustomerPromotionsScreen() {
  const navigation = useNavigation<DealsNav>();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [items, setItems] = useState<Promotion[]>([]);
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
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
    Promise.all([
      getActivePromotions(),
      getHomepageBanners().catch(() => [] as HomepageBanner[]),
    ])
      .then(([promos, bannerList]) => {
        if (cancelled) return;
        setItems(Array.isArray(promos) ? promos : []);
        setBanners(Array.isArray(bannerList) ? bannerList : []);
      })
      .catch(() => {
        if (!cancelled)
          setError("Không thể tải danh sách khuyến mãi. Vui lòng thử lại sau.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const carCount = useMemo(
    () =>
      items.filter((p) => p.vehicleType === "Car" || p.vehicleType === "All")
        .length,
    [items],
  );
  const motorbikeCount = useMemo(
    () =>
      items.filter(
        (p) => p.vehicleType === "Motorbike" || p.vehicleType === "All",
      ).length,
    [items],
  );
  const expiringCount = useMemo(
    () => items.filter((p) => isExpiringSoon(p.endAt)).length,
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = items.filter((p) => {
      if (
        vehicleFilter !== "All" &&
        p.vehicleType !== "All" &&
        p.vehicleType !== vehicleFilter
      )
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
        const firstEnd = first.endAt
          ? new Date(first.endAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        const secondEnd = second.endAt
          ? new Date(second.endAt).getTime()
          : Number.MAX_SAFE_INTEGER;
        return firstEnd - secondEnd;
      }
      return (
        new Date(second.startAt).getTime() - new Date(first.startAt).getTime()
      );
    });
  }, [items, search, vehicleFilter, expiringOnly, sortOrder]);

  // Hero từ Banner API (ảnh campaign thật), join promotion để mở sheet (mirror web).
  const heroSlides = useMemo<PromotionDetailSlide[]>(() => {
    const byId = new Map(items.map((p) => [p.id, p]));
    return banners.map((b) => {
      const promo = b.promotionId != null ? byId.get(b.promotionId) : undefined;
      return {
        id: `banner-${b.id}`,
        image: b.imageUrl,
        title: b.title,
        promotionId: promo?.id ?? null,
        code: b.promotionCode ?? promo?.code ?? undefined,
        popupTitle: b.popupTitle,
        popupDescription: b.popupDescription,
        popupCtaLabel: b.popupCtaLabel,
        promotionName: b.promotionName ?? promo?.name ?? null,
        discountType: b.discountType ?? promo?.discountType ?? null,
        discountValue: b.discountValue ?? promo?.discountValue ?? null,
        vehicleType: b.vehicleType ?? promo?.vehicleType ?? null,
        endAt: b.endAt ?? promo?.endAt ?? null,
        minOrderAmount: promo?.minOrderAmount,
        maxDiscountAmount: promo?.maxDiscountAmount,
        usageCount: promo?.usageCount,
        maxUsageCount: promo?.maxUsageCount,
      } as PromotionDetailSlide;
    });
  }, [banners, items]);

  const handleSheetCta = useCallback(
    (promotionId: number) => {
      setSelected(null);
      navigation.navigate("VoucherHunt", { promotionId });
    },
    [navigation],
  );

  const filters = useMemo(
    () => [
      { value: "All", label: "Tất cả", count: items.length },
      { value: "Car", label: "Ô tô", count: carCount },
      { value: "Motorbike", label: "Xe máy", count: motorbikeCount },
      {
        value: "expiring",
        label: "Sắp hết hạn",
        count: expiringCount,
        tone: "amber" as const,
      },
    ],
    [items.length, carCount, motorbikeCount, expiringCount],
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
    if (expiringOnly) return "Đang lọc ưu đãi sắp hết hạn";
    return "Các ưu đãi đang diễn ra";
  }, [expiringOnly]);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <AppText display style={styles.pageTitle}>
          Khuyến mãi
        </AppText>

        <DealsSegmentedNav />

        {!loading && !error && heroSlides.length > 0 ? (
          <HeroCarousel slides={heroSlides} onOpen={setSelected} />
        ) : null}

        <DealsFilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Tìm ưu đãi, mã voucher..."
          filters={filters}
          activeFilter={activeFilter}
          onFilterChange={handleFilterChange}
          sortValue={sortOrder}
          sortOptions={SORT_OPTIONS}
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
              Chưa có ưu đãi đang diễn ra
            </AppText>
            <AppText style={styles.emptyDesc}>
              Các chương trình mới sẽ xuất hiện tại đây. Bạn có thể xem những
              voucher hiện đang chờ nhận.
            </AppText>
            <Pressable
              onPress={() => navigation.navigate("VoucherHunt")}
              style={styles.emptyLinkTouch}
            >
              <AppText style={styles.emptyLink}>Khám phá voucher →</AppText>
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
                  <AppText style={styles.countBadgeText}>
                    {filtered.length}
                  </AppText>
                </View>
              </View>
            </View>

            {filtered.length === 0 ? (
              <View style={styles.emptyBox}>
                <AppText display style={styles.emptyTitle}>
                  Không tìm thấy ưu đãi phù hợp
                </AppText>
                <AppText style={styles.emptyDesc}>
                  Thử đổi từ khóa hoặc chọn bộ lọc khác.
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
  return <VoucherTicketCard data={toCardData(item)} onOpenDetail={onOpen} />;
}

const MemoTicketCard = memo(TicketCard);

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: {
      paddingHorizontal: 16,
      paddingTop: 12,
      paddingBottom: 28,
      gap: 12,
    },
    pageTitle: {
      color: theme.text,
      fontSize: 21,
      fontWeight: "900",
      letterSpacing: -0.4,
    },
    sectionHead: { gap: 4 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    sectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: "900",
      flexShrink: 1,
    },
    countBadge: {
      borderRadius: 999,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    countBadgeText: { color: theme.brand, fontSize: 11, fontWeight: "900" },
    heroCard: {
      aspectRatio: 16 / 8,
      borderRadius: 18,
      overflow: "hidden",
      backgroundColor: theme.surfaceAlt,
      justifyContent: "flex-end",
      padding: 12,
    },
    heroShade: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      height: "70%",
    },
    heroBadge: {
      position: "absolute",
      left: 12,
      top: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.25)",
      backgroundColor: "rgba(255,255,255,0.18)",
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    heroBadgeText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 1,
    },
    heroTitle: {
      color: "#FFFFFF",
      fontSize: 15,
      fontWeight: "900",
      paddingRight: 90,
    },
    heroCta: {
      position: "absolute",
      right: 12,
      bottom: 12,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 10,
      backgroundColor: "#FFFFFF",
      paddingHorizontal: 10,
      paddingVertical: 7,
    },
    heroCtaText: { color: "#6B21A8", fontSize: 11, fontWeight: "900" },
    dotsRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      marginTop: 10,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.mode === "dark" ? theme.border : "#DDD6FE",
    },
    dotActive: {
      width: 24,
      height: 6,
      borderRadius: 3,
      backgroundColor: "#7C3AED",
    },
    ticketList: { gap: 10 },
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
    emptyTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
      marginTop: 8,
      textAlign: "center",
    },
    emptyDesc: {
      color: theme.muted,
      fontSize: 13,
      textAlign: "center",
      lineHeight: 19,
    },
    emptyLinkTouch: { marginTop: 6, padding: 6 },
    emptyLink: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  });
