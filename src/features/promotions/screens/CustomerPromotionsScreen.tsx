import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CalendarDays, Car, Search, TicketPercent } from "lucide-react-native";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import type { DealsStackParamList } from "@/navigation/types";
import type { HomepageBanner } from "@/features/banners/types";
import { getHomepageBanners } from "@/features/banners/services/bannerService";
import type { Promotion } from "@/features/promotions/types";
import { getActivePromotions } from "@/features/promotions/services/promotionService";
import DealsSegmentedNav from "@/features/vouchers/components/DealsSegmentedNav";
import PromotionDetailSheet, {
  type PromotionDetailSlide,
} from "@/features/vouchers/components/PromotionDetailSheet";
import VoucherTicketStub from "@/features/vouchers/components/VoucherTicketStub";
import { formatEndDate, formatVehicleLabel, isExpiringSoon } from "@/features/vouchers/voucherFormat";

type DealsNav = NativeStackNavigationProp<DealsStackParamList>;
type VehicleFilter = "All" | "Car" | "Motorbike";

const VEHICLE_FILTERS: { value: VehicleFilter; label: string }[] = [
  { value: "All", label: "Tất cả" },
  { value: "Car", label: "Ô tô" },
  { value: "Motorbike", label: "Xe máy" },
];

function toDetailSlide(p: Promotion): PromotionDetailSlide {
  return {
    id: p.id,
    promotionId: p.id,
    title: p.name,
    code: p.code,
    popupTitle: p.name,
    popupDescription: p.description ?? null,
    popupCtaLabel: "Săn voucher ngay",
    promotionName: p.name,
    discountType: p.discountType,
    discountValue: p.discountValue,
    vehicleType: p.vehicleType,
    endAt: p.endAt,
  };
}

function PromotionTicketCard({ item, onOpen }: { item: Promotion; onOpen: (p: Promotion) => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const endLabel = formatEndDate(item.endAt);
  const expiringSoon = isExpiringSoon(item.endAt);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.name}
      onPress={() => onOpen(item)}
      style={styles.ticket}
    >
      <VoucherTicketStub discountType={item.discountType} discountValue={item.discountValue} />
      <View style={styles.ticketDivider} />

      <View style={styles.ticketBody}>
        <View style={styles.badgeRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>🔴 Đang diễn ra</Text>
          </View>
          {expiringSoon ? (
            <View style={styles.soonBadge}>
              <Text style={styles.soonBadgeText}>⏰ Sắp hết hạn</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.ticketName} numberOfLines={1}>
          {item.name}
        </Text>
        {!!item.description && (
          <Text style={styles.ticketDesc} numberOfLines={2}>
            {item.description}
          </Text>
        )}

        <View style={styles.ticketMetaRow}>
          <View style={styles.metaItem}>
            <Car color={theme.mode === "dark" ? "#A1A1AA" : "#94A3B8"} size={13} />
            <Text style={styles.metaText}>{formatVehicleLabel(item.vehicleType)}</Text>
          </View>
          {!!endLabel && (
            <View style={styles.metaItem}>
              <CalendarDays color={theme.mode === "dark" ? "#A1A1AA" : "#94A3B8"} size={13} />
              <Text style={styles.metaText}>📅 HSD: {endLabel}</Text>
            </View>
          )}
        </View>

        <Text style={styles.ticketLink}>Xem ưu đãi →</Text>
      </View>
    </Pressable>
  );
}

const MemoTicketCard = memo(PromotionTicketCard);

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
            {!!s.image && (
              <Image
                source={{ uri: s.image }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={250}
              />
            )}
            <LinearGradient
              colors={["transparent", "rgba(0,0,0,0.6)"]}
              style={styles.heroShade}
            />
            <Text style={styles.heroTitle} numberOfLines={1}>
              {s.title}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {slides.length > 1 ? (
        <View style={styles.dotsRow}>
          {slides.map((s, i) => (
            <View key={String(s.id)} style={[styles.dot, i === page && styles.dotActive]} />
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
  const [selected, setSelected] = useState<PromotionDetailSlide | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      getActivePromotions().catch(() => [] as Promotion[]),
      getHomepageBanners().catch(() => [] as HomepageBanner[]),
    ])
      .then(([promos, bannerList]) => {
        if (cancelled) return;
        setItems(Array.isArray(promos) ? promos : []);
        setBanners(Array.isArray(bannerList) ? bannerList : []);
      })
      .catch(() => {
        if (!cancelled) setError("Không thể tải danh sách khuyến mãi. Vui lòng thử lại sau.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((p) => {
      if (vehicleFilter !== "All" && p.vehicleType !== "All" && p.vehicleType !== vehicleFilter)
        return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, vehicleFilter]);

  // Hero từ Banner API (ảnh campaign thật), join promotion để mở sheet (mirror web).
  const heroSlides = useMemo<PromotionDetailSlide[]>(() => {
    const byId = new Map(items.map((p) => [p.id, p]));
    return banners.map((b) => {
      const promo = b.promotionId != null ? byId.get(b.promotionId) : undefined;
      return {
        id: `banner-${b.id}`,
        image: b.imageUrl,
        title: b.title,
        promotionId: b.promotionId ?? promo?.id ?? null,
        code: b.promotionCode ?? promo?.code ?? undefined,
        popupTitle: b.popupTitle,
        popupDescription: b.popupDescription,
        popupCtaLabel: b.popupCtaLabel,
        promotionName: b.promotionName ?? promo?.name ?? null,
        discountType: b.discountType ?? promo?.discountType ?? null,
        discountValue: b.discountValue ?? promo?.discountValue ?? null,
        vehicleType: b.vehicleType ?? promo?.vehicleType ?? null,
        endAt: b.endAt ?? promo?.endAt ?? null,
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

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.pageTitle}>Khuyến mãi</Text>
        <Text style={styles.pageDesc}>
          Khám phá các ưu đãi mới nhất từ MoveVN.
          {!loading && !error && items.length > 0 ? ` Hiện có ${items.length} chương trình đang diễn ra.` : ""}
        </Text>

        <DealsSegmentedNav />

        <View style={styles.searchRow}>
          <Search color={theme.mode === "dark" ? "#71717A" : "#94A3B8"} size={16} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm tên, mã hoặc mô tả khuyến mãi..."
            placeholderTextColor={theme.placeholder}
            style={styles.searchInput}
          />
        </View>

        <View style={styles.filterRow}>
          {VEHICLE_FILTERS.map((f) => {
            const active = vehicleFilter === f.value;
            return (
              <Pressable
                key={f.value}
                onPress={() => setVehicleFilter(f.value)}
                style={[styles.filterPill, active && styles.filterPillActive]}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
              >
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {loading ? (
          <View style={styles.centerBox}>
            <ActivityIndicator color={theme.brand} size="large" />
          </View>
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.emptyBox}>
            <TicketPercent color={theme.faint} size={44} />
            <Text style={styles.emptyTitle}>Chưa có ưu đãi</Text>
            <Text style={styles.emptyDesc}>Hiện tại chưa có chương trình nào đang diễn ra.</Text>
            <Pressable
              onPress={() => navigation.navigate("VoucherHunt")}
              style={styles.emptyLinkTouch}
            >
              <Text style={styles.emptyLink}>Săn voucher ngay →</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {heroSlides.length > 0 ? (
              <HeroCarousel slides={heroSlides} onOpen={setSelected} />
            ) : null}

            {filtered.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>Không tìm thấy ưu đãi phù hợp</Text>
                <Text style={styles.emptyDesc}>Thử thay đổi từ khóa hoặc bộ lọc.</Text>
              </View>
            ) : (
              <>
                <Text style={styles.listTitle}>Các ưu đãi đang diễn ra</Text>
                <View style={styles.ticketList}>
                  {filtered.map((p) => (
                    <MemoTicketCard key={p.id} item={p} onOpen={(item) => setSelected(toDetailSlide(item))} />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      <PromotionDetailSheet slide={selected} onClose={() => setSelected(null)} onCta={handleSheetCta} />
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: theme.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 96, gap: 12 },
    pageTitle: { color: theme.text, fontSize: 22, fontWeight: "800" },
    pageDesc: { color: theme.muted, fontSize: 13, lineHeight: 18, marginTop: -8 },

    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      height: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, color: theme.text, fontSize: 14, height: "100%" },

    filterRow: { flexDirection: "row", gap: 8 },
    filterPill: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      height: 38,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: "#E2E8F0",
      backgroundColor: theme.mode === "dark" ? theme.surface : "#FFFFFF",
    },
    filterPillActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
    filterText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    filterTextActive: { color: "#FFFFFF" },

    heroCard: {
      aspectRatio: 16 / 9,
      borderRadius: 16,
      overflow: "hidden",
      backgroundColor: theme.surfaceAlt,
    },
    heroShade: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
    heroTitle: {
      position: "absolute",
      left: 14,
      right: 14,
      bottom: 12,
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "800",
    },
    dotsRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 10 },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: theme.mode === "dark" ? theme.border : "#DDD6FE",
    },
    dotActive: { width: 24, height: 6, borderRadius: 3, backgroundColor: "#7C3AED" },

    listTitle: { color: theme.text, fontSize: 16, fontWeight: "800", marginTop: 4 },
    ticketList: { gap: 14 },
    ticket: {
      flexDirection: "row",
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.mode === "dark" ? theme.border : "#EDE9FE",
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    ticketDivider: {
      width: 0,
      borderLeftWidth: 2,
      borderStyle: "dashed",
      borderColor: theme.mode === "dark" ? "#3F3F46" : "#DDD6FE",
      marginVertical: 10,
    },
    ticketBody: { flex: 1, minWidth: 0, padding: 14, gap: 6 },
    badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
    liveBadge: {
      borderRadius: 999,
      backgroundColor: theme.mode === "dark" ? "rgba(244,63,94,0.15)" : "#FFF1F2",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    liveBadgeText: {
      color: theme.mode === "dark" ? "#FB7185" : "#E11D48",
      fontSize: 11,
      fontWeight: "700",
    },
    soonBadge: {
      borderRadius: 999,
      backgroundColor: theme.mode === "dark" ? "rgba(245,158,11,0.15)" : "#FFFBEB",
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    soonBadgeText: {
      color: theme.mode === "dark" ? "#FBBF24" : "#D97706",
      fontSize: 11,
      fontWeight: "700",
    },
    ticketName: { color: theme.text, fontSize: 14, fontWeight: "800", marginTop: 2 },
    ticketDesc: { color: theme.muted, fontSize: 12, lineHeight: 17 },
    ticketMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
    metaText: { color: theme.muted, fontSize: 12 },
    ticketLink: { color: theme.brand, fontSize: 12, fontWeight: "700", marginTop: 2 },

    centerBox: { paddingVertical: 64, alignItems: "center" },
    errorBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
      backgroundColor: theme.dangerSoft,
      padding: 14,
    },
    errorText: { color: theme.danger, fontSize: 13 },
    emptyBox: { alignItems: "center", paddingVertical: 40, gap: 6 },
    emptyTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginTop: 8 },
    emptyDesc: { color: theme.muted, fontSize: 13, textAlign: "center" },
    emptyLinkTouch: { marginTop: 6, padding: 6 },
    emptyLink: { color: theme.brand, fontSize: 13, fontWeight: "800" },
  });
