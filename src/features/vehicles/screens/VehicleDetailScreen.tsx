import AvailabilityAlertPanel from "@/features/availabilityAlerts/AvailabilityAlertPanel";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Image } from "expo-image";
import { StatusBar } from "expo-status-bar";
import { ImageOff, X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import type { RouteProp } from "@react-navigation/native";
import { CommonActions } from "@react-navigation/native";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ExploreStackParamList } from "@/navigation/types";
import { BookingButton } from "@/features/booking/components/BookingControls";
import { useRefreshFavoritesOnFocus } from "@/features/favorites/useFavoriteSession";
import { getVehicleReviews, type ReviewResponse } from "@/features/review/reviewService";
import ReportViolationButton from "@/features/violations/ReportViolationButton";
import {
  createPricingQuote,
  getDeliveryConfig,
  getPublicVehicleById,
  getVehicleAvailability,
} from "@/features/vehicles/services/publicVehicleService";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import {
  calculateRentalDays,
  firstBusyDateInRange,
  getBusyDateKeys,
} from "@/features/vehicles/utils/rentalPeriod";
import { getMinPrice } from "@/features/vehicles/ownerDisplay";
import type {
  BusyPeriod,
  PricingQuoteResponse,
  VehicleResponse,
} from "@/features/vehicles/types";
import VehicleAboutSection from "@/features/vehicles/components/detail/VehicleAboutSection";
import VehicleAvailabilityBanner from "@/features/vehicles/components/detail/VehicleAvailabilityBanner";
import VehicleBookingDock from "@/features/vehicles/components/detail/VehicleBookingDock";
import VehicleDetailHero from "@/features/vehicles/components/detail/VehicleDetailHero";
import VehicleDetailSkeleton from "@/features/vehicles/components/detail/VehicleDetailSkeleton";
import VehicleFeaturesSection from "@/features/vehicles/components/detail/VehicleFeaturesSection";
import VehicleMapCard from "@/features/vehicles/components/detail/VehicleMapCard";
import VehicleOwnerRow from "@/features/vehicles/components/detail/VehicleOwnerRow";
import VehiclePoliciesCard from "@/features/vehicles/components/detail/VehiclePoliciesCard";
import VehicleRentalCard from "@/features/vehicles/components/detail/VehicleRentalCard";
import VehicleReviewsSection from "@/features/vehicles/components/detail/VehicleReviewsSection";
import VehicleSummaryCard from "@/features/vehicles/components/detail/VehicleSummaryCard";
import { detailFont, useDetailTheme } from "@/features/vehicles/components/detail/detailTheme";
import { buildRentalPricing } from "@/features/vehicles/components/detail/rentalPricing";

type DetailRoute = RouteProp<ExploreStackParamList, "VehicleDetail">;
type DetailNav = Pick<
  NativeStackNavigationProp<ExploreStackParamList, "VehicleDetail">,
  "goBack" | "canGoBack" | "getState" | "dispatch"
>;

export default function VehicleDetailScreen({
  route,
  navigation,
  onBookPress,
  onOpenUserProfile,
}: {
  route: DetailRoute;
  navigation: DetailNav;
  onBookPress?: (params: { vehicleId: number; startDate: string; endDate: string }) => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { p } = useDetailTheme();
  const styles = useMemo(() => createStyles(p), [p]);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { vehicleId, startDate, endDate } = route.params;
  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);
  const [retry, setRetry] = useState(0);
  const [reviews, setReviews] = useState<ReviewResponse[]>([]);
  const [reviewState, setReviewState] = useState<"loading" | "ready" | "error">("loading");
  useRefreshFavoritesOnFocus();
  const [imageIndex, setImageIndex] = useState(0);
  const [viewer, setViewer] = useState(false);
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
    setAvailabilityReady(false);
    setAvailabilityLoading(true);
    setAvailabilityError(false);
    setBusyPeriods([]);
    getVehicleAvailability(vehicleId).then(data => { if (!cancelled && data) { setBusyPeriods(data.busyPeriods ?? []); setAvailabilityReady(true); } else if (!cancelled) setAvailabilityError(true); })
      .catch(() => { if (!cancelled) setAvailabilityError(true); })
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    getVehicleReviews(vehicleId).then(data => { if (!cancelled) { setReviews(data); setReviewState("ready"); } }).catch(() => { if (!cancelled) setReviewState("error"); });
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
  const pricing = useMemo(() => buildRentalPricing(quote, days), [quote, days]);
  const basePrice = vehicle ? getMinPrice(vehicle) : null;
  const dailyPrice =
    days > 0 && quoteState === "ready" && pricing ? pricing.averagePerDay : basePrice;
  const average = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
  const busyDates = useMemo(() => getBusyDateKeys(busyPeriods), [busyPeriods]);
  const overlapping = days > 0 && firstBusyDateInRange(start, end, busyDates) !== null;
  const canBook =
    days > 0 &&
    !overlapping &&
    availabilityReady &&
    !availabilityLoading &&
    quoteState === "ready" &&
    !!onBookPress;

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
  const goBack = useCallback(() => {
    goBackOrFallback(navigation, () => {
      const state = navigation.getState();
      navigation.dispatch({
        ...CommonActions.reset({ index: 0, routes: [{ name: state.routeNames[0]! }] }),
        target: state.key,
      });
    });
  }, [navigation]);

  async function shareVehicle() {
    try {
      await Share.share({ message: `${title} trên MoveVN` });
    } catch {
      // Người dùng huỷ chia sẻ hoặc thiết bị không hỗ trợ — không cần báo lỗi.
    }
  }

  function bookVehicle() {
    if (!onBookPress) return;
    onBookPress({ vehicleId, startDate: start, endDate: end });
  }

  const area = vehicle ? vehicle.address || vehicle.areaName || "Chưa cập nhật địa chỉ" : "Chưa cập nhật địa chỉ";

  return (
    <View style={styles.screen}>
      {vehicle === undefined ? (
        <VehicleDetailSkeleton bottomInset={insets.bottom} onBack={goBack} />
      ) : vehicle === null ? (
        <View style={[styles.errorWrap, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24 }]}>
          <Pressable
            accessibilityLabel="Quay lại"
            accessibilityRole="button"
            hitSlop={6}
            onPress={goBack}
            style={({ pressed }) => [styles.errorBack, pressed && styles.pressed]}
          >
            <X color={p.ink} size={20} strokeWidth={2.2} />
          </Pressable>
          <View style={styles.errorBody}>
            <View style={styles.errorIcon}>
              <ImageOff color={p.brand} size={30} strokeWidth={1.9} />
            </View>
            <AppText style={styles.errorTitle}>Không tải được thông tin xe</AppText>
            <AppText style={styles.errorText}>Vui lòng kiểm tra kết nối và thử lại.</AppText>
            <View style={styles.errorButtonWrap}>
              <BookingButton title="Thử lại" onPress={() => setRetry(value => value + 1)} />
            </View>
          </View>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <VehicleDetailHero
              favoriteVehicleId={vehicleId}
              imageIndex={imageIndex}
              onBack={goBack}
              onIndexChange={setImageIndex}
              onOpenPhoto={(index) => {
                setImageIndex(index);
                setViewer(true);
              }}
              onShare={() => { void shareVehicle(); }}
              photos={photos}
              vehicleType={vehicle.vehicleType}
            />

            <VehicleSummaryCard
              averageRating={average}
              dailyPrice={dailyPrice}
              reviewCount={reviews.length}
              reviewState={reviewState}
              vehicle={vehicle}
            />

            <VehicleAvailabilityBanner
              availabilityError={availabilityError}
              availabilityLoading={availabilityLoading}
              availabilityReady={availabilityReady}
              days={days}
              endDate={end}
              onChangeDates={openPeriod}
              onRetry={() => { void refreshAvailability(); }}
              overlapping={overlapping}
              startDate={start}
            />

            <VehicleRentalCard
              days={days}
              endDate={end}
              onOpenPeriod={openPeriod}
              onRetryQuote={() => setQuoteRetry(value => value + 1)}
              pricing={pricing}
              quote={quote}
              quoteState={quoteState}
              startDate={start}
            />

            <View style={styles.alertWrap}>
              <AvailabilityAlertPanel
                key={vehicleId}
                endDate={end}
                ownerId={vehicle.ownerId}
                startDate={start}
                vehicleId={vehicleId}
              />
            </View>

            <VehicleOwnerRow
              onOpenProfile={vehicle.ownerId ? onOpenUserProfile : undefined}
              ownerId={vehicle.ownerId}
              ownerName={vehicle.ownerName}
            />

            <VehicleAboutSection description={vehicle.description} />
            <VehicleFeaturesSection features={vehicle.features ?? []} />

            <VehiclePoliciesCard
              delivery={{
                freeKm: vehicle.deliveryFreeRadiusKm ?? deliveryConfig.freeKm,
                perKm: vehicle.deliveryFeePerKm ?? deliveryConfig.perKm,
                maxKm: vehicle.deliveryMaxRadiusKm ?? deliveryConfig.maxKm,
              }}
              depositPercent={vehicle.depositPercent}
              securityDepositAmount={vehicle.securityDepositAmount}
              securityRequiresDeposit={vehicle.securityRequiresDeposit}
              surchargePolicies={vehicle.surchargePolicies ?? []}
            />

            <VehicleMapCard
              address={area}
              latitude={vehicle.latitude}
              longitude={vehicle.longitude}
              title={title}
            />

            <VehicleReviewsSection
              average={average}
              onOpenUserProfile={onOpenUserProfile}
              onRetry={() => setRetry(value => value + 1)}
              reviews={reviews}
              state={reviewState}
            />

            <View style={styles.reportWrap}>
              <ReportViolationButton
                target={{ targetType: "Vehicle", targetId: vehicleId, ownerId: vehicle.ownerId, label: title }}
                variant="link"
              />
            </View>

            <AppText style={styles.pageNote}>
              Thông tin do chủ xe cung cấp. Giá và phụ phí có thể thay đổi theo thời gian thuê.
            </AppText>
          </ScrollView>

          <VehicleBookingDock
            availabilityError={availabilityError}
            availabilityLoading={availabilityLoading}
            availabilityReady={availabilityReady}
            bottomInset={insets.bottom}
            canBook={canBook}
            dailyPrice={dailyPrice}
            days={days}
            hasBookingHandler={!!onBookPress}
            onBook={bookVehicle}
            onOpenPeriod={openPeriod}
            onRetryAvailability={() => { void refreshAvailability(); }}
            overlapping={overlapping}
            pricing={pricing}
            quoteState={quoteState}
          />
        </>
      )}

      <RentalPeriodSheet
        availabilityError={availabilityError}
        availabilityLoading={availabilityLoading}
        busyPeriods={busyPeriods}
        endDate={end}
        onClose={() => setPeriodOpen(false)}
        onEndDateChange={setEnd}
        onRetryAvailability={() => { void refreshAvailability(); }}
        onStartDateChange={setStart}
        startDate={start}
        visible={periodOpen}
      />

      <Modal animationType="fade" onRequestClose={() => setViewer(false)} visible={viewer}>
        <StatusBar style="light" />
        <View style={styles.viewer}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 10 }]}>
            <AppText style={styles.viewerTitle} numberOfLines={1}>
              {title}
            </AppText>
            <AppText style={styles.viewerCount}>
              {photos.length > 0 ? `${Math.min(imageIndex + 1, photos.length)} / ${photos.length}` : ""}
            </AppText>
            <Pressable
              accessibilityLabel="Đóng ảnh"
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => setViewer(false)}
              style={({ pressed }) => [styles.viewerClose, pressed && styles.pressed]}
            >
              <X color="#FFFFFF" size={20} strokeWidth={2.2} />
            </Pressable>
          </View>
          <FlatList
            key={`${width}-${imageIndex}`}
            data={photos}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            horizontal
            initialScrollIndex={imageIndex}
            keyExtractor={(item) => item}
            pagingEnabled
            renderItem={({ item }) => (
              <View style={[styles.viewerPage, { width }]}>
                <Image contentFit="contain" source={{ uri: item }} style={styles.viewerImage} />
              </View>
            )}
            showsHorizontalScrollIndicator={false}
          />
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useDetailTheme>["p"]) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.canvas },
    content: { paddingBottom: 24 },
    alertWrap: { marginHorizontal: 14 },
    reportWrap: { alignItems: "center", paddingHorizontal: 20, paddingTop: 4 },
    pageNote: {
      color: p.faint,
      fontFamily: detailFont.regular,
      fontSize: 9.5,
      lineHeight: 15,
      textAlign: "center",
      marginTop: 22,
      marginHorizontal: 30,
    },
    pressed: { opacity: 0.65 },
    errorWrap: { flex: 1, paddingHorizontal: 18 },
    errorBack: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
    },
    errorBody: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: 60 },
    errorIcon: {
      width: 64,
      height: 64,
      borderRadius: 22,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.brandSoft,
      marginBottom: 4,
    },
    errorTitle: {
      color: p.ink,
      fontFamily: detailFont.display,
      fontSize: 19,
      textAlign: "center",
    },
    errorText: {
      color: p.muted,
      fontFamily: detailFont.regular,
      fontSize: 12.5,
      lineHeight: 19,
      textAlign: "center",
    },
    errorButtonWrap: { marginTop: 10, minWidth: 150 },
    viewer: { flex: 1, backgroundColor: "#0B0812" },
    viewerHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    viewerTitle: {
      flex: 1,
      color: "#FFFFFF",
      fontFamily: detailFont.semibold,
      fontSize: 13,
    },
    viewerCount: {
      color: "rgba(255,255,255,0.72)",
      fontFamily: detailFont.medium,
      fontSize: 11,
      fontVariant: ["tabular-nums"],
    },
    viewerClose: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(255,255,255,0.12)",
      borderWidth: 1,
      borderColor: "rgba(255,255,255,0.2)",
    },
    viewerPage: { flex: 1, justifyContent: "center" },
    viewerImage: { width: "100%", height: "82%" },
  });
