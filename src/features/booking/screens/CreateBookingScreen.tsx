import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, TicketPercent, X } from "lucide-react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  createPricingQuote,
  getDeliveryConfig,
  getPublicVehicleById,
  getVehicleAvailability,
} from "@/features/vehicles/services/publicVehicleService";
import type { BusyPeriod, PricingQuoteResponse, VehicleResponse } from "@/features/vehicles/types";
import { getMinPrice } from "@/features/vehicles/ownerDisplay";
import { calculateRentalDays, formatPeriodSummary } from "@/features/vehicles/utils/rentalPeriod";
import AddressAutocomplete, {
  type SelectedAddress,
} from "@/features/locations/components/AddressAutocomplete";
import { createBooking } from "@/features/booking/bookingService";
import { formatDateTime, formatMoney, parseDisplayDateTime } from "@/features/booking/utils/format";
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
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { vehicleId, startDate: initialStart, endDate: initialEnd } = route.params;
  // Cho phép sửa ngày giờ nhận/trả (PayHandmade) nhưng vẫn giữ giá trị chatbot điền sẵn.
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [startText, setStartText] = useState(() => formatDateTime(initialStart ?? ""));
  const [endText, setEndText] = useState(() => formatDateTime(initialEnd ?? ""));
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);

  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
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
  const scrollRef = useRef<ScrollView>(null);
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

  function voucherUsable(v: VoucherClaimResponse): boolean {
    const vt = vehicle?.vehicleType;
    return !vt || v.vehicleType === "All" || v.vehicleType === vt;
  }

  function describeVoucher(v: VoucherClaimResponse): string {
    const off = v.discountType === "Percentage" ? `${v.discountValue}%` : formatMoney(v.discountValue);
    const cap = v.maxDiscountAmount ? ` (tối đa ${formatMoney(v.maxDiscountAmount)})` : "";
    return `Giảm ${off}${cap}`;
  }

  function getNextAvailableFromError(err: unknown): string | null {
    const data = (err as { response?: { data?: { data?: { nextAvailable?: unknown } } } })?.response?.data?.data;
    return typeof data?.nextAvailable === "string" ? data.nextAvailable : null;
  }

  function handleStartText(v: string) {
    setStartText(v);
    const iso = parseDisplayDateTime(v);
    if (iso) {
      setStartDate(iso);
      setNextAvailableDate(null);
    }
  }

  function handleEndText(v: string) {
    setEndText(v);
    const iso = parseDisplayDateTime(v);
    if (iso) {
      setEndDate(iso);
      setNextAvailableDate(null);
    }
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
    setStartText(formatDateTime(newStart));
    setEndText(formatDateTime(newEnd));
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
  }, [vehicleId]);

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
        setPromoError(result?.message || "Mã không hợp lệ.");
      }
    } catch (err) {
      setPromoError(getApiErrorMessage(err, "Không thể kiểm tra mã."));
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
      setSubmitError("Vui lòng chọn ngày nhận và trả xe hợp lệ trước khi gửi.");
      return;
    }
    if (availabilityLoading || availabilityError || overlapped) {
      setSubmitError(
        overlapped
          ? "Khoảng thời gian này trùng lịch bận của xe (đã đệm 60 phút vệ sinh). Vui lòng chọn ngày khác."
          : "Chưa có lịch xe hợp lệ. Vui lòng thử lại.",
      );
      return;
    }
    if (!pickupAddress.trim()) {
      setSubmitError("Vui lòng chọn địa chỉ nhận xe từ danh sách gợi ý.");
      return;
    }
    if (pickupLat == null || pickupLng == null) {
      setSubmitError("Địa chỉ nhận xe chưa ghim được tọa độ. Hãy chọn lại từ danh sách gợi ý.");
      return;
    }
    if (deliveryPreview?.overMax) {
      setSubmitError(`Điểm nhận xe vượt quá phạm vi giao xe (${effectiveConfig.maxKm} km). Vui lòng chọn địa điểm gần hơn.`);
      return;
    }
    if (!sameReturn) {
      if (!returnAddress.trim() || returnLat == null || returnLng == null) {
        setSubmitError("Vui lòng chọn địa chỉ trả xe từ danh sách gợi ý.");
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
      Alert.alert("Đặt xe thành công", `Mã đơn ${created.bookingCode}. Chủ xe duyệt xong bạn sẽ thanh toán cọc.`, [
        { text: "Xem chuyến đi", onPress: () => onCreated?.(created.id) },
      ]);
    } catch (err) {
      const nextAvailable = getNextAvailableFromError(err);
      if (nextAvailable) {
        setNextAvailableDate(nextAvailable);
        setSubmitError(`Xe bận trong thời gian đã chọn. Xe có thể thuê từ ngày ${new Date(nextAvailable).toLocaleDateString("vi-VN")}.`);
      } else {
        setSubmitError(getApiErrorMessage(err, "Không tạo được đơn. Vui lòng thử lại sau."));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          Xác nhận đặt xe
        </Text>
        <View style={styles.backButton} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
        keyboardVerticalOffset={80}
      >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.body}
        keyboardShouldPersistTaps="handled"
      >
        {vehicle === undefined ? (
          <ActivityIndicator color={theme.brand} />
        ) : vehicle === null ? (
          <Text style={styles.muted}>Không tải được thông tin xe.</Text>
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {[vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ")}
              </Text>
              <Text style={styles.muted}>{formatPeriodSummary(startDate ?? "", endDate ?? "")}</Text>
              <Text style={styles.muted}>
                {days > 0 ? `${days} ngày` : "Thời gian chưa hợp lệ"}
                {pricePreview ? ` · tạm tính ${formatMoney(pricePreview.total)}` : ""}
              </Text>
              {availabilityLoading ? (
                <Text style={styles.muted}>Đang kiểm tra lịch trống của xe…</Text>
              ) : availabilityError ? (
                <Text style={styles.error}>Không tải được lịch xe. Vui lòng thử lại.</Text>
              ) : overlapped ? (
                <Text style={styles.error}>Khoảng thời gian này trùng lịch bận của xe. Vui lòng chọn ngày khác.</Text>
              ) : (
                <Text style={styles.ok}>Xe trống trong thời gian bạn chọn.</Text>
              )}
            </View>

            <Text style={styles.label}>Nhận xe lúc (DD/MM/YYYY HH:mm)</Text>
            <TextInput
              value={startText}
              onChangeText={handleStartText}
              placeholder="DD/MM/YYYY HH:mm"
              placeholderTextColor={theme.placeholder}
              style={styles.input}
            />
            {nextAvailableDate ? (
              <View style={styles.card}>
                <Text style={styles.muted}>Xe có thể thuê từ ngày {new Date(nextAvailableDate).toLocaleDateString("vi-VN")}.</Text>
                <Pressable onPress={() => applyNextAvailable(nextAvailableDate)} style={styles.submit}>
                  <Text style={styles.submitText}>Dùng ngày này</Text>
                </Pressable>
              </View>
            ) : null}
            <View onLayout={(e) => { fieldY.current.pickup = e.nativeEvent.layout.y; }}>
            <AddressAutocomplete
              label="Địa điểm nhận xe"
              value={pickupAddress}
              onChange={setPickupAddress}
              onSelect={handleSelectPickup}
              onFocusInput={() => scrollToField("pickup")}
              onManualChange={() => {
                setPickupLat(null);
                setPickupLng(null);
              }}
            />
            </View>
            {pickupAddress.trim() && (pickupLat == null || pickupLng == null) ? (
              <Text style={styles.warn}>Vui lòng chọn địa chỉ từ danh sách gợi ý để xác định khoảng cách giao xe.</Text>
            ) : null}
            {vehicle.latitude != null && vehicle.longitude != null && deliveryPreview ? (
              deliveryPreview.overMax ? (
                <Text style={styles.error}>
                  Điểm nhận xe cách vị trí xe {deliveryPreview.distanceKm} km, vượt quá {effectiveConfig.maxKm} km cho phép.
                </Text>
              ) : (
                <Text style={styles.muted}>
                  Cách vị trí xe {deliveryPreview.distanceKm} km
                  {deliveryPreview.fee > 0 ? ` · phí giao xe ${formatMoney(deliveryPreview.fee)}` : ` · miễn phí giao (trong ${effectiveConfig.freeKm} km)`}
                </Text>
              )
            ) : null}

            <View style={styles.switchRow}>
              <Text style={styles.label}>Trả xe tại điểm nhận</Text>
              <Switch value={sameReturn} onValueChange={setSameReturn} />
            </View>
            {!sameReturn && (
              <>
                <Text style={styles.label}>Trả xe lúc (DD/MM/YYYY HH:mm)</Text>
                <TextInput
                  value={endText}
                  onChangeText={handleEndText}
                  placeholder="DD/MM/YYYY HH:mm"
                  placeholderTextColor={theme.placeholder}
                  style={styles.input}
                />
                <View onLayout={(e) => { fieldY.current.ret = e.nativeEvent.layout.y; }}>
                <AddressAutocomplete
                  label="Địa điểm trả xe"
                  value={returnAddress}
                  onChange={setReturnAddress}
                  onSelect={handleSelectReturn}
                  onFocusInput={() => scrollToField("ret")}
                  onManualChange={() => {
                    setReturnLat(null);
                    setReturnLng(null);
                  }}
                />
                </View>
              </>
            )}

            <Text style={styles.label}>Ghi chú cho chủ xe</Text>
            <View onLayout={(e) => { fieldY.current.note = e.nativeEvent.layout.y; }}>
            <TextInput
              value={note}
              onChangeText={setNote}
              onFocus={() => scrollToField("note")}
              placeholder="Giờ giấc, nhu cầu đặc biệt..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />
            </View>
            <View onLayout={(e) => { fieldY.current.promo = e.nativeEvent.layout.y; }} />

            <Text style={styles.label}>Mã khuyến mãi (nếu có)</Text>
            <View style={styles.promoRow}>
              <TextInput
                value={promoCode}
                onChangeText={(text) => {
                  setPromoCode(text.toUpperCase());
                  setPromoResult(null);
                  setPromoError(null);
                }}
                placeholder="Nhập mã"
                placeholderTextColor={theme.placeholder}
                autoCapitalize="characters"
                style={[styles.input, styles.promoInput]}
              />
              <Pressable onPress={openVoucherPicker} style={styles.voucherButton}>
                <Text style={styles.voucherButtonText}>Ví</Text>
              </Pressable>
              <Pressable
                onPress={() => void validateCode(promoCode)}
                disabled={promoLoading || !promoCode.trim() || days <= 0}
                style={[styles.promoButton, (promoLoading || !promoCode.trim() || days <= 0) && styles.submitDisabled]}
              >
                {promoLoading ? <ActivityIndicator color={theme.onBrand} size="small" /> : <Text style={styles.submitText}>Áp dụng</Text>}
              </Pressable>
            </View>
            {promoError ? <Text style={styles.error}>{promoError}</Text> : null}
            {promoResult ? (
              <View style={styles.promoApplied}>
                <Text style={styles.promoAppliedText}>
                  {promoResult.code} · -{formatMoney(promoResult.discountAmount)}
                </Text>
                <Pressable
                  onPress={() => {
                    setPromoResult(null);
                    setPromoCode("");
                  }}
                >
                  <X color={theme.muted} size={16} />
                </Pressable>
              </View>
            ) : null}

            {pricePreview ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Dự kiến chi phí</Text>
                <View style={styles.row}>
                  <Text style={styles.muted}>
                    {[vehicle.brandName, vehicle.modelName].filter(Boolean).join(" ")} · {days} ngày
                  </Text>
                  <Text style={styles.value}>{formatMoney(pricePreview.base)}</Text>
                </View>
                {quote?.dailyPrices.map((day) => (
                  <View key={day.rentalDate} style={styles.row}>
                    <Text style={styles.small}>{new Date(`${day.rentalDate}T00:00:00`).toLocaleDateString("vi-VN")}</Text>
                    <Text style={styles.small}>{formatMoney(day.finalDailyPrice)}</Text>
                  </View>
                ))}
                {pricePreview.discPct > 0 ? (
                  <View style={styles.row}>
                    <Text style={styles.discount}>Giảm giá thuê dài ({pricePreview.discPct}%)</Text>
                    <Text style={styles.discount}>-{formatMoney(pricePreview.discAmt)}</Text>
                  </View>
                ) : null}
                {promoResult ? (
                  <View style={styles.row}>
                    <Text style={styles.discount}>Mã {promoResult.code}</Text>
                    <Text style={styles.discount}>-{formatMoney(promoResult.discountAmount)}</Text>
                  </View>
                ) : null}
                {pricePreview.deliveryFee > 0 ? (
                  <View style={styles.row}>
                    <Text style={styles.muted}>Phí giao xe ({deliveryPreview?.distanceKm ?? "-"} km)</Text>
                    <Text style={styles.value}>+{formatMoney(pricePreview.deliveryFee)}</Text>
                  </View>
                ) : null}
                <View style={styles.row}>
                  <Text style={styles.muted}>Phí nền tảng (đã gồm trong giá)</Text>
                  <Text style={styles.value}>{formatMoney(pricePreview.fee)}</Text>
                </View>
                <View style={[styles.row, styles.totalRow]}>
                  <Text style={styles.totalLabel}>Tổng cộng</Text>
                  <Text style={styles.totalValue}>{formatMoney(pricePreview.total)}</Text>
                </View>
                <View style={styles.scheduleBox}>
                  <Text style={styles.scheduleTitle}>Lịch thanh toán</Text>
                  <View style={styles.row}>
                    <Text style={styles.scheduleText}>Cọc ngay ({pricePreview.depositPercent}%)</Text>
                    <Text style={styles.scheduleValue}>{formatMoney(pricePreview.deposit)}</Text>
                  </View>
                  <View style={styles.row}>
                    <Text style={styles.scheduleText}>Còn lại khi nhận xe</Text>
                    <Text style={styles.scheduleValue}>{formatMoney(pricePreview.remaining)}</Text>
                  </View>
                </View>
                {vehicle?.securityRequiresDeposit ? (
                  <Text style={styles.muted}>Cần thế chấp {formatMoney(vehicle.securityDepositAmount)} khi nhận xe (hoàn lại khi trả xe).</Text>
                ) : null}
              </View>
            ) : null}

            {submitError ? <Text style={styles.error}>{submitError}</Text> : null}
            <Pressable
              onPress={handleSubmit}
              disabled={submitting}
              style={({ pressed }) => [styles.submit, (submitting || pressed) && styles.submitDisabled]}
            >
              {submitting ? (
                <ActivityIndicator color={theme.onBrand} />
              ) : (
                <Text style={styles.submitText}>Gửi yêu cầu thuê xe</Text>
              )}
            </Pressable>
          </>
        )}
      </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={voucherModal} transparent animationType="fade" onRequestClose={() => setVoucherModal(false)}>
        <View style={styles.backdrop}>
          <View style={[styles.modal, styles.tallModal]}>
            <Text style={styles.cardTitle}>Ví voucher của bạn</Text>
            {vouchersLoading ? (
              <ActivityIndicator color={theme.brand} />
            ) : vouchers.length === 0 ? (
              <Text style={styles.muted}>Chưa có voucher nào dùng được. Săn mã ở tab Ưu đãi.</Text>
            ) : (
              <ScrollView style={styles.voucherList}>
                {vouchers.map((v) => {
                  const ok = voucherUsable(v);
                  return (
                    <Pressable
                      key={v.id}
                      disabled={!ok}
                      onPress={() => {
                        setPromoCode(v.code);
                        setVoucherModal(false);
                        void validateCode(v.code);
                      }}
                      style={[styles.voucherItem, !ok && styles.voucherDisabled]}
                    >
                      <View style={styles.voucherInfo}>
                        <Text style={styles.voucherCode}>{v.code}</Text>
                        <Text style={styles.muted}>{v.name}</Text>
                        <Text style={styles.muted}>{describeVoucher(v)}</Text>
                        {!ok && <Text style={styles.warnText}>Không áp dụng cho loại xe này</Text>}
                      </View>
                      <Text style={styles.useText}>{ok ? "Dùng" : ""}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            <Pressable onPress={() => setVoucherModal(false)} style={styles.ghostButton}>
              <Text style={styles.ghostText}>Đóng</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
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
    body: { padding: 16, gap: 10, paddingBottom: 32 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 6,
    },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    sectionTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13 },
    small: { color: theme.muted, fontSize: 12 },
    ok: { color: theme.success, fontSize: 13, fontWeight: "700" },
    error: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    warn: { color: "#D97706", fontSize: 12, fontWeight: "600" },
    hint: { color: theme.placeholder, fontSize: 12, fontStyle: "italic" },
    label: { color: theme.text, fontSize: 13, fontWeight: "700", marginTop: 6 },
    link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 14,
    },
    multiline: { minHeight: 70, textAlignVertical: "top" },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
    },
    promoRow: { flexDirection: "row", gap: 8 },
    promoInput: { flex: 1 },
    promoButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 16,
      alignItems: "center",
      justifyContent: "center",
    },
    walletBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      padding: 8,
      gap: 6,
      maxHeight: 220,
    },
    voucherRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 8,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    voucherInfo: { flex: 1, gap: 2 },
    voucherCode: { color: theme.text, fontSize: 13, fontWeight: "800" },
    voucherDiscount: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    promoApplied: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.success,
      backgroundColor: theme.successSoft,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    promoAppliedText: { color: theme.success, fontSize: 13, fontWeight: "800" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    value: { color: theme.text, fontSize: 13, fontWeight: "700" },
    discount: { color: theme.success, fontSize: 13, fontWeight: "700" },
    totalRow: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border, paddingTop: 8, marginTop: 4 },
    totalLabel: { color: theme.text, fontSize: 14, fontWeight: "800" },
    totalValue: { color: theme.brand, fontSize: 18, fontWeight: "800" },
    scheduleBox: {
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      borderRadius: 10,
      padding: 10,
      gap: 6,
    },
    scheduleTitle: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    scheduleText: { color: theme.brand, fontSize: 13, fontWeight: "600" },
    scheduleValue: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    submit: {
      marginTop: 14,
      borderRadius: 12,
      backgroundColor: theme.brand,
      paddingVertical: 14,
      alignItems: "center",
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { color: theme.onBrand, fontSize: 16, fontWeight: "800" },
    flex: { flex: 1 },
    voucherButton: {
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    voucherButtonText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
    tallModal: { maxHeight: "80%" },
    voucherList: { maxHeight: 380 },
    voucherItem: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      padding: 12,
      marginBottom: 8,
    },
    voucherDisabled: { opacity: 0.5 },
    warnText: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    useText: { color: theme.brand, fontSize: 14, fontWeight: "800" },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" },
    ghostText: { color: theme.muted, fontWeight: "700" },
  });
