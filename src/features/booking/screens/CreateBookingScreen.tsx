import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { formatDateTime, formatMoney } from "@/features/booking/utils/format";
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
  const { vehicleId, startDate, endDate } = route.params;

  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [quote, setQuote] = useState<PricingQuoteResponse | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>({ freeKm: 5, perKm: 10000, maxKm: 50 });

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [sameReturn, setSameReturn] = useState(true);
  const [returnAddress, setReturnAddress] = useState("");
  const [returnLat, setReturnLat] = useState<number | null>(null);
  const [returnLng, setReturnLng] = useState<number | null>(null);
  const [note, setNote] = useState("");

  const [promoCode, setPromoCode] = useState("");
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoResult, setPromoResult] = useState<{ discountAmount: number; code: string } | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [walletOpen, setWalletOpen] = useState(false);
  const [walletVouchers, setWalletVouchers] = useState<VoucherClaimResponse[]>([]);
  const [walletLoading, setWalletLoading] = useState(false);

  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicVehicleById(vehicleId)
      .then((data) => {
        if (cancelled) return;
        setVehicle(data ?? null);
        if (data) {
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

  function handleToggleWallet() {
    if (walletOpen) {
      setWalletOpen(false);
      return;
    }
    setWalletOpen(true);
    if (walletVouchers.length > 0) return;
    setWalletLoading(true);
    getVoucherWallet()
      .then((data) => setWalletVouchers((data ?? []).filter((v) => !v.usedAt)))
      .catch(() => setWalletVouchers([]))
      .finally(() => setWalletLoading(false));
  }

  function handleSelectVoucher(voucher: VoucherClaimResponse) {
    setPromoCode(voucher.code);
    setPromoError(null);
    setPromoResult(null);
    setWalletOpen(false);
    void validateCode(voucher.code);
  }

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
    if (availabilityLoading || availabilityError || overlapped || days <= 0) {
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
      setSubmitError(getApiErrorMessage(err, "Không tạo được đơn. Vui lòng thử lại sau."));
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
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
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

            <Text style={styles.label}>Nhận xe lúc: {formatDateTime(startDate ?? "")}</Text>
            <AddressAutocomplete
              label="Địa điểm nhận xe"
              value={pickupAddress}
              onChange={setPickupAddress}
              onSelect={handleSelectPickup}
              onManualChange={() => {
                setPickupLat(null);
                setPickupLng(null);
              }}
            />
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
                <Text style={styles.label}>Trả xe lúc: {formatDateTime(endDate ?? "")}</Text>
                <AddressAutocomplete
                  label="Địa điểm trả xe"
                  value={returnAddress}
                  onChange={setReturnAddress}
                  onSelect={handleSelectReturn}
                  onManualChange={() => {
                    setReturnLat(null);
                    setReturnLng(null);
                  }}
                />
              </>
            )}

            <Text style={styles.label}>Ghi chú cho chủ xe</Text>
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="Giờ giấc, nhu cầu đặc biệt..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />

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
              <Pressable
                onPress={() => void validateCode(promoCode)}
                disabled={promoLoading || !promoCode.trim() || days <= 0}
                style={[styles.promoButton, (promoLoading || !promoCode.trim() || days <= 0) && styles.submitDisabled]}
              >
                {promoLoading ? <ActivityIndicator color={theme.onBrand} size="small" /> : <Text style={styles.submitText}>Áp dụng</Text>}
              </Pressable>
            </View>
            {promoError ? <Text style={styles.error}>{promoError}</Text> : null}
            <Pressable onPress={handleToggleWallet}>
              <Text style={styles.link}>Chọn từ ví voucher</Text>
            </Pressable>
            {walletOpen ? (
              <View style={styles.walletBox}>
                {walletLoading ? (
                  <ActivityIndicator color={theme.brand} />
                ) : walletVouchers.length === 0 ? (
                  <Text style={styles.muted}>Ví voucher trống.</Text>
                ) : (
                  walletVouchers.map((voucher) => (
                    <Pressable key={voucher.id} onPress={() => handleSelectVoucher(voucher)} style={styles.voucherRow}>
                      <View style={styles.voucherInfo}>
                        <Text style={styles.voucherCode}>{voucher.code}</Text>
                        <Text style={styles.muted}>{voucher.name}</Text>
                      </View>
                      <Text style={styles.voucherDiscount}>
                        {voucher.discountType === "Fixed" ? formatMoney(voucher.discountValue) : `-${voucher.discountValue}%`}
                      </Text>
                    </Pressable>
                  ))
                )}
              </View>
            ) : null}
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
  });
