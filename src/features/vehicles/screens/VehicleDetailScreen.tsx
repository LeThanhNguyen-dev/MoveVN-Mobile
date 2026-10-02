import { Image } from "expo-image";
import { useMemo, useEffect, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { ArrowLeft, CalendarDays, Check, ChevronRight, Heart, ImageOff, MapPin, ShieldCheck, Star, Truck, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { createPricingQuote, getDeliveryConfig, getPublicVehicleById, getVehicleAvailability } from "@/features/vehicles/services/publicVehicleService";
import type { BusyPeriod, PricingQuoteResponse, VehicleResponse } from "@/features/vehicles/types";
import { calculateRentalDays, firstBusyDateInRange, formatPeriodSummary, getBusyDateKeys } from "@/features/vehicles/utils/rentalPeriod";
import { formatVnd } from "@/features/vehicles/ownerDisplay";
import { getVehicleReviews, type ReviewResponse } from "@/features/review/reviewService";
import { addFavoriteVehicle, getFavoriteVehicleIds, removeFavoriteVehicle } from "@/features/vehicles/services/favoriteVehicleService";
import OwnerVehicleMap from "@/features/vehicles/components/OwnerVehicleMap";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import SurchargePolicySummary from "@/features/vehicles/components/SurchargePolicySummary";

type DetailRoute = RouteProp<ExploreStackParamList, "VehicleDetail">;
type DetailNav = NativeStackNavigationProp<ExploreStackParamList, "VehicleDetail">;

export default function VehicleDetailScreen({
  route,
  navigation,
}: {
  route: DetailRoute;
  navigation: DetailNav;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { vehicleId, startDate, endDate } = route.params;
  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [reviewState, setReviewState] = useState<"loading" | "ready" | "error">("loading");
  const [favorite, setFavorite] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [allReviews, setAllReviews] = useState(false);
  const [start, setStart] = useState(startDate ?? "");
  const [end, setEnd] = useState(endDate ?? "");
  const [periodOpen, setPeriodOpen] = useState(false);
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [deliveryConfig, setDeliveryConfig] = useState({ freeKm: 5, perKm: 10000, maxKm: 50 });
  const [quote, setQuote] = useState<PricingQuoteResponse | null>(null);
  const [quoteState, setQuoteState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [quoteRetry, setQuoteRetry] = useState(0);

  useEffect(() => {
    let active = true;
    getDeliveryConfig().then(config => { if (active) setDeliveryConfig(config); }).catch(() => undefined);
    return () => { active = false; };
  }, [retry]);

  useEffect(() => {
    let active = true;
    setQuote(null);
    if (calculateRentalDays(start, end) <= 0) { setQuoteState("idle"); return; }
    setQuoteState("loading");
    const timer = setTimeout(() => {
      createPricingQuote(vehicleId, start, end).then(data => { if (active) { setQuote(data); setQuoteState("ready"); } })
        .catch(() => { if (active) setQuoteState("error"); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [vehicleId, start, end, quoteRetry]);

  useEffect(() => {
    let cancelled = false;
    setVehicle(undefined);
    setImageIndex(0);
    setReviewState("loading");
    setReviews([]);
    setFavorite(false);
    setAvailabilityReady(false);
    setAvailabilityLoading(true);
    setAvailabilityError(false);
    setBusyPeriods([]);
    getVehicleAvailability(vehicleId).then(data => { if (!cancelled && data) { setBusyPeriods(data.busyPeriods ?? []); setAvailabilityReady(true); } else if (!cancelled) setAvailabilityError(true); })
      .catch(() => { if (!cancelled) setAvailabilityError(true); })
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    getVehicleReviews(vehicleId).then(data => { if (!cancelled) { setReviews(data); setReviewState("ready"); } }).catch(() => { if (!cancelled) setReviewState("error"); });
    getFavoriteVehicleIds().then(ids => { if (!cancelled) setFavorite(ids.includes(vehicleId)); }).catch(() => undefined);
    getPublicVehicleById(vehicleId)
      .then((data) => {
        if (!cancelled) setVehicle(data ?? null);
      })
      .catch(() => {
        if (!cancelled) setVehicle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, retry]);

  const photos = useMemo(() => vehicle ? [...new Set([vehicle.featuredImage, ...[...(vehicle.images ?? [])].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder).map(item => item.imageUrl)].filter((url): url is string => Boolean(url)))] : [], [vehicle]);
  const title = vehicle ? [vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ") : "Chi tiết xe";
  const days = calculateRentalDays(start, end);
  const price = days > 0 ? quote?.averageDailyPrice ?? null : vehicle?.currentPricePerDay ?? vehicle?.pricePerDay ?? null;
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
  const busyDates = useMemo(() => getBusyDateKeys(busyPeriods), [busyPeriods]);
  const overlapping = days > 0 && firstBusyDateInRange(start, end, busyDates) !== null;
  const periodMessage = days > 0 ? overlapping ? "Xe đã bận trong thời gian này. Vui lòng chọn ngày khác." : availabilityReady ? "Không trùng lịch bận hiện tại của xe." : "Chưa tải được lịch bận. Cần kiểm tra lại trước khi đặt xe." : "";
  async function refreshAvailability() {
    setAvailabilityLoading(true);
    setAvailabilityError(false);
    setAvailabilityReady(false);
    try {
      const data = await getVehicleAvailability(vehicleId);
      if (!data) throw new Error("Không tải được lịch xe.");
      setBusyPeriods(data.busyPeriods ?? []);
      setAvailabilityReady(true);
    } catch {
      setAvailabilityError(true);
    } finally {
      setAvailabilityLoading(false);
    }
  }
  function openPeriod() {
    setPeriodOpen(true);
    void refreshAvailability();
  }
  async function toggleFavorite() {
    if (savingFavorite) return;
    setSavingFavorite(true);
    try { if (favorite) await removeFavoriteVehicle(vehicleId); else await addFavoriteVehicle(vehicleId); setFavorite(value => !value); }
    catch { Alert.alert("Chưa lưu được", "Vui lòng đăng nhập tài khoản khách hàng và thử lại."); }
    finally { setSavingFavorite(false); }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Chi tiết xe
        </Text>
        <Pressable accessibilityLabel={favorite ? "Bỏ yêu thích" : "Lưu xe yêu thích"} disabled={!vehicle || savingFavorite} onPress={toggleFavorite} style={styles.backButton}>{savingFavorite ? <ActivityIndicator color={theme.brand} /> : <Heart size={20} color={favorite ? theme.danger : theme.text} fill={favorite ? theme.danger : "transparent"} />}</Pressable>
      </View>
      {vehicle === undefined ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
          <Text style={styles.muted}>Đang tải chi tiết xe...</Text>
        </View>
      ) : vehicle === null ? (
        <View style={styles.center}>
          <ImageOff size={40} color={theme.muted} />
          <Text style={styles.title}>Không tải được thông tin xe</Text>
          <Text style={styles.muted}>Vui lòng kiểm tra kết nối và thử lại.</Text>
          <Pressable style={styles.primaryButton} onPress={() => setRetry(value => value + 1)}><Text style={styles.primaryText}>Thử lại</Text></Pressable>
        </View>
      ) : (
        <>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            <View style={styles.gallery}>
              {photos.length ? <FlatList data={photos} horizontal pagingEnabled showsHorizontalScrollIndicator={false} keyExtractor={item => item} onMomentumScrollEnd={event => setImageIndex(Math.round(event.nativeEvent.contentOffset.x / width))} renderItem={({ item }) => <Pressable accessibilityLabel="Xem ảnh xe toàn màn hình" onPress={() => setViewer(true)}><Image source={{ uri: item }} style={{ width, height: width * 0.72 }} contentFit="cover" transition={150} /></Pressable>} /> : <View style={[styles.center, { height: width * 0.65 }]}><ImageOff size={40} color={theme.muted} /><Text style={styles.muted}>Xe chưa có ảnh</Text></View>}
              {photos.length > 0 && <View style={styles.photoCount}><Text style={styles.whiteText}>{imageIndex + 1} / {photos.length}</Text></View>}
            </View>
            <View style={styles.card}>
              <Text style={styles.eyebrow}>{vehicle.vehicleType === "Car" ? "Ô TÔ TỰ LÁI" : "XE MÁY"}</Text><Text style={styles.title}>{title}</Text>
              <View style={styles.row}><MapPin color={theme.muted} size={15} /><Text style={styles.muted}>{vehicle.areaName || "Chưa cập nhật khu vực"}</Text></View>
              <View style={styles.row}><Star color={theme.brand} fill={theme.brand} size={15} /><Text style={styles.text}>{average != null ? `${average.toFixed(1)} · ${reviews.length} đánh giá` : reviewState === "loading" ? "Đang tải đánh giá…" : reviewState === "error" ? "Chưa tải được đánh giá" : "Chưa có đánh giá"}</Text></View>
              <View style={styles.stats}>{[["Năm sản xuất", String(vehicle.year)], ["Phiên bản", vehicle.variantName || "Tiêu chuẩn"], ["Đã di chuyển", vehicle.odometerKm != null ? `${vehicle.odometerKm.toLocaleString("vi-VN")} km` : "Chưa cập nhật"]].map(([label, value]) => <View key={label} style={styles.flex}><Text style={styles.small}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}</View>
            </View>
            <View style={[styles.card, styles.row]}><View style={styles.avatar}><Text style={styles.avatarText}>{(vehicle.ownerName || "C").charAt(0).toUpperCase()}</Text></View><View style={styles.flex}><Text style={styles.small}>Chủ xe</Text><Text style={styles.sectionTitle}>{vehicle.ownerName || "Chưa cập nhật"}</Text></View></View>
            <View style={styles.card}><Text style={styles.sectionTitle}>Giới thiệu xe</Text><Text numberOfLines={expanded ? undefined : 4} style={styles.description}>{vehicle.description?.trim() || "Chủ xe chưa bổ sung mô tả cho xe này."}</Text>{Boolean(vehicle.description && vehicle.description.length > 180) && <Pressable onPress={() => setExpanded(value => !value)}><Text style={styles.link}>{expanded ? "Thu gọn" : "Xem thêm"}</Text></Pressable>}</View>
            <View style={styles.card}><Text style={styles.sectionTitle}>Tiện ích</Text>{vehicle.features?.length ? <View style={styles.features}>{vehicle.features.map(feature => <View key={feature.id} style={styles.feature}><Check size={15} color={theme.brand} /><Text style={styles.text}>{feature.name}</Text></View>)}</View> : <Text style={styles.muted}>Chưa cập nhật tiện ích.</Text>}</View>
            <View style={styles.card}><Text style={styles.sectionTitle}>Thời gian thuê</Text><Pressable style={styles.periodBox} onPress={openPeriod}><CalendarDays size={21} color={theme.brand} /><View style={styles.flex}><Text style={styles.text}>{formatPeriodSummary(start, end)}</Text><Text style={styles.small}>{days ? `${days} ngày thuê · Chạm để thay đổi` : "Chọn ngày nhận và trả xe"}</Text></View><ChevronRight size={18} color={theme.muted} /></Pressable><RentalQuote quote={quote} state={quoteState} onRetry={() => setQuoteRetry(value => value + 1)} styles={styles} theme={theme} />{periodMessage ? <Text style={[styles.small, { color: overlapping ? theme.danger : theme.muted }]}>{periodMessage}</Text> : null}<Text style={styles.small}>Giá cuối cùng phụ thuộc thời gian thuê và các khoản phí áp dụng.</Text></View>
            <View style={styles.card}><OwnerVehicleMap latitude={vehicle.latitude} longitude={vehicle.longitude} address={vehicle.address || vehicle.areaName || "Chưa cập nhật địa chỉ"} title={title} /></View>
            <View style={styles.card}><View style={styles.row}><Truck size={20} color={theme.brand} /><Text style={styles.sectionTitle}>Giao xe tận nơi</Text></View>{[["Miễn phí trong", (vehicle.deliveryFreeRadiusKm ?? deliveryConfig.freeKm) != null ? `${vehicle.deliveryFreeRadiusKm ?? deliveryConfig.freeKm} km` : "Theo cấu hình của sàn"], ["Phí mỗi km vượt", (vehicle.deliveryFeePerKm ?? deliveryConfig.perKm) != null ? `${(vehicle.deliveryFeePerKm ?? deliveryConfig.perKm).toLocaleString("vi-VN")}đ/km` : "Theo cấu hình của sàn"], ["Phạm vi giao xe", (vehicle.deliveryMaxRadiusKm ?? deliveryConfig.maxKm) != null ? `${vehicle.deliveryMaxRadiusKm ?? deliveryConfig.maxKm} km` : "Theo cấu hình của sàn"]].map(([label, value]) => <View key={label} style={styles.between}><Text style={styles.muted}>{label}</Text><Text style={styles.value}>{value}</Text></View>)}<Text style={styles.small}>Phí giao xe được xác định theo khoảng cách đến địa điểm nhận xe.</Text></View>
            <View style={styles.card}><View style={styles.row}><ShieldCheck size={20} color={theme.brand} /><Text style={styles.sectionTitle}>Cọc & thế chấp</Text></View><View style={styles.between}><Text style={styles.muted}>Cọc đặt xe</Text><Text style={styles.value}>{vehicle.depositPercent}% tiền thuê</Text></View><View style={styles.between}><Text style={styles.muted}>Tiền thế chấp</Text><Text style={styles.value}>{vehicle.securityRequiresDeposit ? formatVnd(vehicle.securityDepositAmount) : "Không yêu cầu"}</Text></View></View>
            <View style={styles.card}><Text style={styles.sectionTitle}>Phụ phí</Text><SurchargePolicySummary policies={vehicle.surchargePolicies ?? []} /></View>
            <View style={styles.card}><View style={styles.between}><Text style={styles.sectionTitle}>Đánh giá từ khách thuê</Text>{average != null && <Text style={styles.link}>★ {average.toFixed(1)} ({reviews.length})</Text>}</View>{reviewState === "loading" ? <ActivityIndicator color={theme.brand} /> : reviewState === "error" ? <><Text style={styles.muted}>Không tải được đánh giá.</Text><Pressable onPress={() => setRetry(value => value + 1)}><Text style={styles.link}>Thử lại</Text></Pressable></> : !reviews.length ? <Text style={styles.muted}>Xe chưa có đánh giá từ khách thuê.</Text> : (allReviews ? reviews : reviews.slice(0, 3)).map(review => <View key={review.id} style={styles.review}><View style={styles.between}><Text style={styles.value}>{review.reviewerName || "Khách thuê"}</Text><Text style={styles.small}>{new Date(review.createdAt).toLocaleDateString("vi-VN")}</Text></View><Text style={styles.link}>★ {review.rating}/5</Text><Text style={styles.description}>{review.comment || "Khách thuê không để lại nhận xét."}</Text></View>)}{reviews.length > 3 && <Pressable onPress={() => setAllReviews(value => !value)}><Text style={styles.link}>{allReviews ? "Thu gọn" : `Xem tất cả ${reviews.length} đánh giá`}</Text></Pressable>}</View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
            <View style={styles.flex}>
              <Text style={styles.small}>{days > 0 ? "Giá trung bình theo ngày thuê" : "Giá thuê hiện tại"}</Text>
              <Text style={styles.price}>{days > 0 && quoteState !== "ready" ? (quoteState === "error" ? "Chưa có báo giá" : "Đang tính giá…") : formatVnd(price)}{(days <= 0 || quoteState === "ready") && <Text style={styles.small}> / ngày</Text>}</Text>
            </View>
            <Pressable style={styles.primaryButton} onPress={openPeriod}><Text style={styles.primaryText}>{days ? "Đổi ngày thuê" : "Chọn ngày thuê"}</Text><ChevronRight color={theme.onBrand} size={18} /></Pressable>
          </View>
        </>
      )}
      <RentalPeriodSheet visible={periodOpen} startDate={start} endDate={end} onStartDateChange={setStart} onEndDateChange={setEnd} onClose={() => setPeriodOpen(false)} busyPeriods={busyPeriods} availabilityLoading={availabilityLoading} availabilityError={availabilityError} onRetryAvailability={() => { void refreshAvailability(); }} />
      <Modal visible={viewer} animationType="fade" onRequestClose={() => setViewer(false)}><View style={styles.viewer}><View style={[styles.viewerHeader, { paddingTop: insets.top + 12 }]}><Text numberOfLines={1} style={[styles.whiteText, styles.flex]}>{title}</Text><Pressable accessibilityLabel="Đóng ảnh" onPress={() => setViewer(false)} style={styles.backButton}><X color={theme.text} size={24} /></Pressable></View><FlatList key={`${width}-${imageIndex}`} data={photos} horizontal pagingEnabled initialScrollIndex={imageIndex} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} keyExtractor={item => item} showsHorizontalScrollIndicator={false} renderItem={({ item }) => <View style={{ width, flex: 1, justifyContent: "center" }}><Image source={{ uri: item }} style={{ width, height: "80%" }} contentFit="contain" /></View>} /></View></Modal>
    </View>
  );
}

function RentalQuote({ quote, state, onRetry, styles, theme }: {
  quote: PricingQuoteResponse | null;
  state: "idle" | "loading" | "ready" | "error";
  onRetry: () => void;
  styles: ReturnType<typeof createStyles>;
  theme: Theme;
}) {
  if (state === "idle") return null;
  if (state === "loading") return <View style={styles.row}><ActivityIndicator size="small" color={theme.brand} /><Text style={styles.small}>Đang tính giá theo từng ngày…</Text></View>;
  if (state === "error" || !quote) return <View><Text style={styles.muted}>Chưa lấy được báo giá cho thời gian này.</Text><Pressable onPress={onRetry}><Text style={styles.link}>Thử lại báo giá</Text></Pressable></View>;
  const days = quote.rentalDays;
  const discountPercent = days >= 30 ? 25 : days >= 7 ? 15 : days >= 5 ? 10 : days === 3 ? 5 : 0;
  const discount = Math.round(quote.totalDynamicPrice * discountPercent / 100);
  return <View style={{ gap: 10 }}>
    {quote.dailyPrices.map(day => <View key={day.rentalDate} style={styles.between}><Text style={styles.muted}>{new Date(day.rentalDate).toLocaleDateString("vi-VN")}</Text><Text style={styles.value}>{formatVnd(day.finalDailyPrice)}</Text></View>)}
    <View style={styles.between}><Text style={styles.text}>Tiền thuê ({days} ngày)</Text><Text style={styles.value}>{formatVnd(quote.totalDynamicPrice)}</Text></View>
    {discount > 0 && <View style={styles.between}><Text style={styles.muted}>Giảm giá thuê dài ngày ({discountPercent}%)</Text><Text style={[styles.value, { color: theme.success }]}>−{formatVnd(discount)}</Text></View>}
    <View style={styles.between}><Text style={styles.text}>Tiền thuê sau giảm giá</Text><Text style={styles.price}>{formatVnd(quote.totalDynamicPrice - discount)}</Text></View>
    <Text style={styles.small}>Chưa bao gồm phí giao xe và phụ phí phát sinh.</Text>
  </View>;
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    content: { paddingBottom: 20, gap: 12 },
    gallery: { backgroundColor: theme.surfaceAlt },
    photoCount: { position: "absolute", bottom: 16, right: 16, backgroundColor: "rgba(0,0,0,0.65)", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6 },
    whiteText: { color: "#fff", fontSize: 13, fontWeight: "600" },
    card: { marginHorizontal: 16, padding: 18, backgroundColor: theme.surface, borderRadius: 20, gap: 12 },
    eyebrow: { color: theme.brand, fontSize: 11, fontWeight: "800", letterSpacing: 1.5 },
    sectionTitle: { color: theme.text, fontSize: 17, fontWeight: "700", flexShrink: 1 },
    row: { flexDirection: "row", gap: 8, alignItems: "center" },
    between: { flexDirection: "row", gap: 12, alignItems: "center", justifyContent: "space-between" },
    flex: { flex: 1 },
    text: { color: theme.text, fontSize: 14, lineHeight: 21, flexShrink: 1 },
    small: { color: theme.muted, fontSize: 12, lineHeight: 18 },
    description: { color: theme.text, fontSize: 14, lineHeight: 23 },
    link: { color: theme.brand, fontSize: 13, fontWeight: "700", paddingVertical: 4 },
    stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 16, gap: 12 },
    value: { color: theme.text, fontSize: 13, fontWeight: "600", flexShrink: 1 },
    avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
    avatarText: { color: theme.brand, fontSize: 22, fontWeight: "800" },
    features: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    feature: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.surfaceAlt, borderRadius: 10, padding: 10, maxWidth: "100%" },
    periodBox: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 14, backgroundColor: theme.brandSoft },
    review: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 14, gap: 5 },
    footer: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, backgroundColor: theme.surface },
    price: { color: theme.brand, fontSize: 21, fontWeight: "800", marginVertical: 4 },
    primaryButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: theme.brand, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 15 },
    primaryText: { color: theme.onBrand, fontSize: 14, fontWeight: "700" },
    viewer: { flex: 1, backgroundColor: "#101014" },
    viewerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, gap: 12 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    body: { padding: 20, gap: 6 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
    title: { color: theme.text, fontSize: 24, fontWeight: "800", lineHeight: 32 },
    period: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    muted: { color: theme.muted, fontSize: 13 },
  });
