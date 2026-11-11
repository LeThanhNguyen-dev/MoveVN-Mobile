import type { ComponentRef } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { ChevronLeft, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import type { ScrollViewInstance } from "react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import type { ExploreStackParamList } from "@/navigation/types";
import {
  createPricingQuote,
  getDeliveryConfig,
  getPublicVehicleById,
  getVehicleAvailability,
} from "@/features/vehicles/services/publicVehicleService";
import type { BusyPeriod, PricingQuoteResponse, VehicleResponse } from "@/features/vehicles/types";
import { getMinPrice } from "@/features/vehicles/ownerDisplay";
import { calculateRentalDays } from "@/features/vehicles/utils/rentalPeriod";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import type { SelectedAddress } from "@/features/locations/components/AddressAutocomplete";
import { createBooking } from "@/features/booking/bookingService";
import {
  fromRentalSheetValue,
  toRentalSheetValue,
} from "@/features/booking/utils/checkoutFormat";
import CheckoutHandoverCard from "@/features/booking/components/createBooking/CheckoutHandoverCard";
import CheckoutPaymentCard from "@/features/booking/components/createBooking/CheckoutPaymentCard";
import CheckoutSubmitDock from "@/features/booking/components/createBooking/CheckoutSubmitDock";
import CheckoutTripCard from "@/features/booking/components/createBooking/CheckoutTripCard";
import CheckoutVoucherSheet from "@/features/booking/components/createBooking/CheckoutVoucherSheet";
import { checkoutFont, useCheckoutTheme } from "@/features/booking/components/createBooking/checkoutTheme";
import {
  calcDeliveryPreview,
  calcPricePreview,
  effectiveDeliveryConfig,
  isPeriodOverlapping,
  type DeliveryConfig,
} from "@/features/booking/utils/bookingPricing";
import { validatePromotion } from "@/features/promotions/services/promotionService";
import { getVoucherWallet } from "@/features/voucherClaims/services/voucherClaimService";
import type { VoucherClaimResponse } from "@/features/voucherClaims/types";
import { getApiErrorMessage } from "@/services/apiClient";

type CreateRoute = RouteProp<ExploreStackParamList, "CreateBooking">;
type CreateNav = NativeStackNavigationProp<ExploreStackParamList, "CreateBooking">;

export default function CreateBookingScreen({
  route,
  navigation,
  onCreated,
}: {
  route: CreateRoute;
  navigation: CreateNav;
  onCreated?: (bookingId: number) => void;
}) {
  const { p } = useCheckoutTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(p), [p]);
  const { vehicleId, startDate: initialStart, endDate: initialEnd } = route.params;
  // Cho phép sửa ngày giờ nhận/trả (PayHandmade) nhưng vẫn giữ giá trị chatbot điền sẵn.
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);

  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [availabilityRetry, setAvailabilityRetry] = useState(0);
  const [quote, setQuote] = useState<PricingQuoteResponse | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({ freeKm: 5, perKm: 10000, maxKm: 50 });

  const [pickupAddress, setPickupAddress] = useState(route.params.pickupAddress ?? "");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [sameReturn, setSameReturn] = useState(true);
  const [returnAddress, setReturnAddress] = useState(route.params.returnAddress ?? "");
  const [returnLat, setReturnLat] = useState<number | null>(null);
  const [returnLng, setReturnLng] = useState<number | null>(null);
  const [note, setNote] = useState(route.params.customerNote ?? "");
  const [promoCode, setPromoCode] = useState(route.params.promoCode ?? "");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ discountAmount: number; code: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voucherModal, setVoucherModal] = useState(false);
  const [vouchers, setVouchers] = useState<VoucherClaimResponse[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const fieldY = useRef<Record<string, number>>({});

  function scrollToField(key: string) {
    setTimeout(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (fieldY.current[key] ?? 0) - 120), animated: true });
    }, 120);
  }

  async function openVoucherPicker() {
    setVoucherModal(true);
    setVouchersLoading(true);
    try {
      const wallet = await getVoucherWallet();
      setVouchers(wallet.filter((v) => !v.usedAt));
    } catch {
      setVouchers([]);
    } finally {
      setVouchersLoading(false);
    }
  }

  function getNextAvailableFromError(err: unknown): string | null {
    const data = (err as { response?: { data?: { data?: { nextAvailable?: unknown } } } })?.response?.data?.data;
    return typeof data?.nextAvailable === "string" ? data.nextAvailable : null;
  }

  function handleStartPeriod(value: string) {
    setStartDate(fromRentalSheetValue(value) || undefined);
    setNextAvailableDate(null);
  }

  function handleEndPeriod(value: string) {
    setEndDate(fromRentalSheetValue(value) || undefined);
    setNextAvailableDate(null);
  }

  function applyNextAvailable(dateStr: string) {
    const keepDays = Math.max(1, calculateRentalDays(startDate ?? "", endDate ?? ""));
    const base = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(base.getTime())) return;
    const cur = startDate ? new Date(startDate) : new Date();
    base.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
    const newStart = base.toISOString();
    const newEnd = new Date(base.getTime() + keepDays * 86400000).toISOString();
    setStartDate(newStart);
    setEndDate(newEnd);
    setNextAvailableDate(null);
  }

  useEffect(() => {
    let cancelled = false;
    getPublicVehicleById(vehicleId)
      .then((data) => {
        if (cancelled) return;
        setVehicle(data ?? null);
        // Giữ địa chỉ chatbot điền sẵn; chỉ mặc định theo xe khi không có.
        if (data && !route.params.pickupAddress) {
          setPickupAddress(data.address);
          setPickupLat(data.latitude);
          setPickupLng(data.longitude);
        }
      })
      .catch(() => {
        if (!cancelled) setVehicle(null);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId]);

  useEffect(() => {
    let cancelled = false;
    setAvailabilityLoading(true);
    setAvailabilityError(false);
    getVehicleAvailability(vehicleId)
      .then((data) => {
        if (!cancelled) setBusyPeriods(data?.busyPeriods ?? []);
      })
      .catch(() => {
        if (!cancelled) setAvailabilityError(true);
      })
      .finally(() => {
        if (!cancelled) setAvailabilityLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [vehicleId, availabilityRetry]);

  useEffect(() => {
    getDeliveryConfig().then(setDeliveryConfig).catch(() => undefined);
  }, []);

  const days = calculateRentalDays(startDate ?? "", endDate ?? "");
  const overlapped = useMemo(
    () => (startDate && endDate ? isPeriodOverlapping(startDate, endDate, busyPeriods) : false),
    [startDate, endDate, busyPeriods],
  );
  const scheduleBlocked = availabilityLoading || availabilityError || overlapped || days <= 0;

  useEffect(() => {
    if (!vehicleId || !startDate || !endDate || scheduleBlocked) {
      setQuote(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      createPricingQuote(vehicleId, startDate, endDate)
        .then((data) => {
          if (!cancelled) setQuote(data);
        })
        .catch(() => {
          if (!cancelled) setQuote(null);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [vehicleId, startDate, endDate, scheduleBlocked]);

  const effectiveConfig = useMemo(() => effectiveDeliveryConfig(vehicle, deliveryConfig), [vehicle, deliveryConfig]);
  const deliveryPreview = useMemo(
    () => calcDeliveryPreview(vehicle?.latitude, vehicle?.longitude, pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null, effectiveConfig),
    [vehicle, pickupLat, pickupLng, effectiveConfig],
  );

  const pricePerDay = vehicle ? getMinPrice(vehicle) : null;
  const pricePreview = useMemo(() => {
    if (!vehicle) return null;
    return calcPricePreview(
      {
        pricePerDay: quote?.totalDynamicPrice && quote.rentalDays > 0 ? quote.totalDynamicPrice / quote.rentalDays : (pricePerDay ?? vehicle.pricePerDay),
        platformFeeType: vehicle.platformFeeType,
        platformFeeValue: vehicle.platformFeeValue,
        platformFeeMinFee: vehicle.platformFeeMinFee,
        platformFeeMaxFee: vehicle.platformFeeMaxFee,
        depositPercent: vehicle.depositPercent,
      },
      days,
      quote,
      promoResult?.discountAmount ?? 0,
      deliveryPreview && !deliveryPreview.overMax ? deliveryPreview.fee : 0,
    );
  }, [vehicle, days, quote, promoResult, deliveryPreview, pricePerDay]);

  // Base chưa trừ promo để validate mã (giống web).
  const promoBase = useMemo(() => {
    if (!pricePreview) return 0;
    return pricePreview.base - pricePreview.discAmt;
  }, [pricePreview]);

  async function validateCode(code: string) {
    const normalized = code.trim().toUpperCase();
    if (!normalized || !vehicleId || days <= 0) return;
    setPromoLoading(true);
    setPromoError(null);
    setPromoResult(null);
    try {
      const result = await validatePromotion(normalized, vehicleId, promoBase);
      if (result?.success) {
        setPromoResult({ discountAmount: result.discountAmount, code: result.code });
      } else {
        setPromoError(result?.message || t("booking:create.invalidCode"));
      }
    } catch (err) {
      setPromoError(getApiErrorMessage(err, t("booking:create.checkCodeError")));
    } finally {
      setPromoLoading(false);
    }
  }

  // Mã do chatbot điền sẵn thì tự validate một lần khi đủ ngày thuê.
  const autoValidatedPromo = useRef(false);
  useEffect(() => {
    if (!autoValidatedPromo.current && route.params.promoCode && days > 0 && !availabilityLoading) {
      autoValidatedPromo.current = true;
      void validateCode(route.params.promoCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days, availabilityLoading]);

  function handleSelectPickup(selected: SelectedAddress) {
    setPickupAddress(selected.address);
    setPickupLat(selected.latitude);
    setPickupLng(selected.longitude);
  }

  function handleSelectReturn(selected: SelectedAddress) {
    setReturnAddress(selected.address);
    setReturnLat(selected.latitude);
    setReturnLng(selected.longitude);
  }

  async function handleSubmit() {
    if (days <= 0) {
      setSubmitError(t("mobile:checkout.create.invalidSchedule"));
      return;
    }
    if (availabilityLoading || availabilityError || overlapped) {
      setSubmitError(
        overlapped
          ? t("mobile:checkout.create.overlap")
          : t("mobile:checkout.create.scheduleUnavailable"),
      );
      return;
    }
    if (!pickupAddress.trim()) {
      setSubmitError(t("mobile:checkout.create.pickupSuggestion"));
      return;
    }
    if (pickupLat == null || pickupLng == null) {
      setSubmitError(t("mobile:checkout.create.pickupUnpinned"));
      return;
    }
    if (deliveryPreview?.overMax) {
      setSubmitError(t("mobile:checkout.create.deliveryTooFar", { max: effectiveConfig.maxKm }));
      return;
    }
    if (!sameReturn) {
      if (!returnAddress.trim() || returnLat == null || returnLng == null) {
        setSubmitError(t("mobile:checkout.create.returnSuggestion"));
        return;
      }
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await createBooking({
        quoteId: quote?.quoteId,
        vehicleId,
        startDate: startDate ?? "",
        endDate: endDate ?? "",
        pickupAddress: pickupAddress.trim(),
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        returnAddress: sameReturn ? undefined : returnAddress.trim(),
        returnLatitude: sameReturn ? undefined : returnLat ?? undefined,
        returnLongitude: sameReturn ? undefined : returnLng ?? undefined,
        customerNote: note.trim() || undefined,
        promotionCode: promoResult ? promoCode.trim().toUpperCase() : undefined,
      });
      Alert.alert(t("booking:create.submitSuccessTitle"), t("mobile:checkout.create.successMessage", { code: created.bookingCode }), [
        { text: t("mobile:checkout.create.viewTrip"), onPress: () => onCreated?.(created.id) },
      ]);
    } catch (err) {
      const nextAvailable = getNextAvailableFromError(err);
      if (nextAvailable) {
        setNextAvailableDate(nextAvailable);
        setSubmitError(t("mobile:checkout.create.busyNextAvailable", { date: new Date(nextAvailable).toLocaleDateString("vi-VN") }));
      } else {
        setSubmitError(getApiErrorMessage(err, t("mobile:checkout.create.createError")));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel={t("booking:create.back")}
          hitSlop={6}
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <ChevronLeft color={p.ink} size={21} strokeWidth={2.2} />
        </Pressable>
        <View style={styles.headerBody}>
          <AppText style={styles.headerKicker}>{t("mobile:checkout.create.kicker")}</AppText>
          <AppText numberOfLines={1} style={styles.headerTitle}>
            {t("mobile:checkout.create.title")}
          </AppText>
        </View>
        <View style={styles.payPill}>
          <ShieldCheck color={p.mint} size={12} strokeWidth={2.2} />
          <AppText style={styles.payPillText}>{t("mobile:checkout.create.unpaid")}</AppText>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={80}
        style={styles.flex}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          style={styles.flex}
        >
          {vehicle === undefined ? (
            <View style={styles.state}>
              <ActivityIndicator color={p.brand} />
              <AppText style={styles.stateText}>{t("mobile:checkout.create.preparing")}</AppText>
            </View>
          ) : vehicle === null ? (
            <View style={styles.state}>
              <AppText style={styles.stateTitle}>{t("mobile:checkout.create.vehicleLoadErrorTitle")}</AppText>
              <AppText style={styles.stateText}>{t("mobile:checkout.create.vehicleLoadErrorBody")}</AppText>
            </View>
          ) : (
            <>
              <CheckoutTripCard
                availabilityError={availabilityError}
                availabilityLoading={availabilityLoading}
                dailyPrice={pricePerDay}
                days={days}
                endDate={endDate ?? ""}
                nextAvailableDate={nextAvailableDate}
                onApplyNextAvailable={() => {
                  if (nextAvailableDate) applyNextAvailable(nextAvailableDate);
                }}
                onOpenPeriod={() => setPeriodOpen(true)}
                overlapped={overlapped}
                startDate={startDate ?? ""}
                vehicle={vehicle}
              />

              <View onLayout={(event) => { fieldY.current.handover = event.nativeEvent.layout.y; }}>
                <CheckoutHandoverCard
                  config={effectiveConfig}
                  deliveryPreview={deliveryPreview}
                  note={note}
                  onChangeNote={setNote}
                  onChangePickup={setPickupAddress}
                  onChangeReturn={setReturnAddress}
                  onFocusNote={() => scrollToField("handover")}
                  onFocusPickup={() => scrollToField("handover")}
                  onFocusReturn={() => scrollToField("handover")}
                  onManualPickup={() => {
                    setPickupLat(null);
                    setPickupLng(null);
                  }}
                  onManualReturn={() => {
                    setReturnLat(null);
                    setReturnLng(null);
                  }}
                  onSelectPickup={handleSelectPickup}
                  onSelectReturn={handleSelectReturn}
                  onToggleSameReturn={setSameReturn}
                  pickupAddress={pickupAddress}
                  pickupUnpinned={pickupLat == null || pickupLng == null}
                  returnAddress={returnAddress}
                  returnUnpinned={returnLat == null || returnLng == null}
                  sameReturn={sameReturn}
                />
              </View>

              <View onLayout={(event) => { fieldY.current.payment = event.nativeEvent.layout.y; }}>
                <CheckoutPaymentCard
                  appliedPromo={promoResult}
                  canApply={promoCode.trim().length > 0 && days > 0}
                  dailyPrices={quote?.dailyPrices ?? []}
                  days={days}
                  deliveryDistanceKm={deliveryPreview?.distanceKm ?? null}
                  onChangeCode={(text) => {
                    setPromoCode(text.toUpperCase());
                    setPromoResult(null);
                    setPromoError(null);
                  }}
                  onApply={() => void validateCode(promoCode)}
                  onClearPromo={() => {
                    setPromoResult(null);
                    setPromoCode("");
                  }}
                  onFocusPromo={() => scrollToField("payment")}
                  onOpenWallet={() => void openVoucherPicker()}
                  preview={pricePreview}
                  promoCode={promoCode}
                  promoError={promoError}
                  promoLoading={promoLoading}
                  security={{
                    required: Boolean(vehicle.securityRequiresDeposit),
                    amount: vehicle.securityDepositAmount ?? 0,
                  }}
                />
              </View>
            </>
          )}
        </ScrollView>

        {vehicle ? (
          <CheckoutSubmitDock
            bottomInset={insets.bottom}
            days={days}
            deposit={pricePreview?.deposit ?? null}
            error={submitError}
            onSubmit={() => void handleSubmit()}
            submitting={submitting}
            total={pricePreview?.total ?? null}
          />
        ) : null}
      </KeyboardAvoidingView>

      <RentalPeriodSheet
        availabilityError={availabilityError}
        availabilityLoading={availabilityLoading}
        busyPeriods={busyPeriods}
        endDate={toRentalSheetValue(endDate ?? "")}
        onClose={() => setPeriodOpen(false)}
        onEndDateChange={handleEndPeriod}
        onRetryAvailability={() => setAvailabilityRetry((value) => value + 1)}
        onStartDateChange={handleStartPeriod}
        startDate={toRentalSheetValue(startDate ?? "")}
        visible={periodOpen}
      />

      <CheckoutVoucherSheet
        bottomInset={insets.bottom}
        loading={vouchersLoading}
        onClose={() => setVoucherModal(false)}
        onSelect={(code) => {
          setPromoCode(code);
          setVoucherModal(false);
          void validateCode(code);
        }}
        vehicleType={vehicle?.vehicleType}
        visible={voucherModal}
        vouchers={vouchers}
      />
    </View>
  );
}

const createStyles = (p: ReturnType<typeof useCheckoutTheme>["p"]) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: p.canvas },
    flex: { flex: 1 },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 11,
      paddingHorizontal: 16,
      paddingTop: 4,
      paddingBottom: 10,
    },
    backButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: p.surface,
      borderWidth: 1,
      borderColor: p.line,
    },
    pressed: { opacity: 0.7 },
    headerBody: { flex: 1, minWidth: 0 },
    headerKicker: {
      color: p.brand,
      fontFamily: checkoutFont.extraBold,
      fontSize: 8.5,
      letterSpacing: 0.9,
      textTransform: "uppercase",
    },
    headerTitle: {
      color: p.ink,
      fontFamily: checkoutFont.display,
      fontSize: 19,
      letterSpacing: -0.3,
    },
    payPill: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 5,
      backgroundColor: p.mintSoft,
      borderWidth: 1,
      borderColor: p.mintBorder,
      flexShrink: 0,
    },
    payPillText: { color: p.mint, fontFamily: checkoutFont.bold, fontSize: 9 },
    body: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 20, gap: 13 },
    state: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 60,
      paddingHorizontal: 24,
      gap: 8,
    },
    stateTitle: {
      color: p.ink,
      fontFamily: checkoutFont.semibold,
      fontSize: 14,
      textAlign: "center",
    },
    stateText: {
      color: p.muted,
      fontFamily: checkoutFont.regular,
      fontSize: 11,
      lineHeight: 16,
      textAlign: "center",
    },
  });
