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
import { ArrowLeft } from "lucide-react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { ExploreStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { createPricingQuote, getPublicVehicleById, getVehicleAvailability } from "@/features/vehicles/services/publicVehicleService";
import type { BusyPeriod, PricingQuoteResponse, VehicleResponse } from "@/features/vehicles/types";
import { getMinPrice } from "@/features/vehicles/ownerDisplay";
import { calculateRentalDays, firstBusyDateInRange, formatPeriodSummary, getBusyDateKeys } from "@/features/vehicles/utils/rentalPeriod";
import AddressAutocomplete, {
  type SelectedAddress,
} from "@/features/locations/components/AddressAutocomplete";
import { createBooking } from "@/features/booking/bookingService";
import { formatDateTime, formatMoney, getVolumeDiscountPercent, parseDisplayDateTime } from "@/features/booking/utils/format";
import {
  calcDeliveryPreview,
  effectiveDeliveryConfig,
  DEFAULT_DELIVERY_CONFIG,
  type DeliveryConfig,
} from "@/features/locations/utils/delivery";
import { getDeliveryConfig } from "@/features/systemConfig/configService";
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

  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState(initialEnd);
  const [startText, setStartText] = useState(() => formatDateTime(initialStart));
  const [endText, setEndText] = useState(() => formatDateTime(initialEnd));
  const [busyPeriods, setBusyPeriods] = useState<BusyPeriod[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(true);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<VehicleResponse | null | undefined>(undefined);
  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupLat, setPickupLat] = useState<number | null>(null);
  const [pickupLng, setPickupLng] = useState<number | null>(null);
  const [sameReturn, setSameReturn] = useState(true);
  const [returnAddress, setReturnAddress] = useState("");
  const [returnLat, setReturnLat] = useState<number | null>(null);
  const [returnLng, setReturnLng] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promoResult, setPromoResult] = useState<{ code: string; discountAmount: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [deliveryConfig, setDeliveryConfig] = useState<DeliveryConfig>(DEFAULT_DELIVERY_CONFIG);
  const [pricingQuote, setPricingQuote] = useState<PricingQuoteResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [voucherModal, setVoucherModal] = useState(false);
  const [vouchers, setVouchers] = useState<VoucherClaimResponse[]>([]);
  const [vouchersLoading, setVouchersLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const fieldY = useRef<Record<string, number>>({});

  function scrollToField(key: string) {
    // Đợi bàn phím bung xong rồi cuộn để không bị che (Android cần delay ngắn).
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

  async function validateCode(code: string) {
    const trimmed = code.trim();
    if (!trimmed || !vehicle || days <= 0) return;
    setPromoLoading(true);
    setPromoError(null);
    try {
      const baseAmount = Math.max(0, Math.round(pricePerDay != null ? pricePerDay * days : 0));
      const res = await validatePromotion(trimmed, vehicleId, baseAmount);
      if (res?.success) {
        setPromoResult({ code: res.code || trimmed, discountAmount: res.discountAmount });
      } else {
        setPromoResult(null);
        setPromoError(res?.message || "Mã không hợp lệ.");
      }
    } catch (err) {
      setPromoResult(null);
      setPromoError(getApiErrorMessage(err, "Không kiểm tra được mã."));
    } finally {
      setPromoLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    getDeliveryConfig()
      .then((cfg) => {
        if (active) setDeliveryConfig(cfg);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

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
      .then((data) => { if (!cancelled) setBusyPeriods(data?.busyPeriods ?? []); })
      .catch(() => { if (!cancelled) setAvailabilityError(true); })
      .finally(() => { if (!cancelled) setAvailabilityLoading(false); });
    return () => { cancelled = true; };
  }, [vehicleId]);

  useEffect(() => {
    let active = true;
    setPricingQuote(null);
    if (calculateRentalDays(start, end) <= 0) return;
    const timer = setTimeout(() => {
      createPricingQuote(vehicleId, start, end)
        .then((data) => { if (active) setPricingQuote(data); })
        .catch(() => { if (active) setPricingQuote(null); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [vehicleId, start, end]);

  function getNextAvailableFromError(err: unknown): string | null {
    const data = (err as { response?: { data?: { data?: { nextAvailable?: unknown } } } })?.response?.data?.data;
    return typeof data?.nextAvailable === "string" ? data.nextAvailable : null;
  }

  function handleStartText(v: string) {
    setStartText(v);
    const iso = parseDisplayDateTime(v);
    if (iso) {
      setStart(iso);
      setNextAvailableDate(null);
    }
  }

  function handleEndText(v: string) {
    setEndText(v);
    const iso = parseDisplayDateTime(v);
    if (iso) {
      setEnd(iso);
      setNextAvailableDate(null);
    }
  }

  function applyNextAvailable(dateStr: string) {
    const keepDays = Math.max(1, calculateRentalDays(start, end));
    const base = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(base.getTime())) return;
    const cur = new Date(start);
    base.setHours(cur.getHours(), cur.getMinutes(), 0, 0);
    const newStart = base.toISOString();
    const newEnd = new Date(base.getTime() + keepDays * 86400000).toISOString();
    setStart(newStart);
    setEnd(newEnd);
    setStartText(formatDateTime(newStart));
    setEndText(formatDateTime(newEnd));
    setNextAvailableDate(null);
  }

  const days = calculateRentalDays(start, end);
  const busyKeys = useMemo(() => getBusyDateKeys(busyPeriods), [busyPeriods]);
  const conflictDate = days > 0 ? firstBusyDateInRange(start, end, busyKeys) : null;
  const scheduleBlocked = availabilityLoading || availabilityError || conflictDate != null;
  const pricePerDay = vehicle ? getMinPrice(vehicle) : null;
  const estimate = pricePerDay != null && days > 0 ? pricePerDay * days : null;

  const effectiveConfig = useMemo(() => effectiveDeliveryConfig(vehicle, deliveryConfig), [vehicle, deliveryConfig]);
  const pickupCoords = pickupLat != null && pickupLng != null ? { lat: pickupLat, lng: pickupLng } : null;
  const deliveryPreview = useMemo(
    () => calcDeliveryPreview(vehicle?.latitude, vehicle?.longitude, pickupCoords, effectiveConfig),
    [vehicle, pickupCoords, effectiveConfig],
  );

  const pricePreview = useMemo(() => {
    if (!vehicle || pricePerDay == null || days <= 0) return null;
    const base = pricePerDay * days;
    const discPct = getVolumeDiscountPercent(days);
    const discAmt = Math.round((base * discPct) / 100);
    const afterDisc = base - discAmt;
    const promoAmt = promoResult?.discountAmount ?? 0;
    const deliveryFee = deliveryPreview && !deliveryPreview.overMax ? deliveryPreview.fee : 0;
    const total = Math.max(afterDisc - promoAmt, 0) + deliveryFee;
    const feeValue = vehicle.platformFeeValue ?? 10;
    const fee =
      vehicle.platformFeeType === "Fixed"
        ? Math.min(Math.max(feeValue, vehicle.platformFeeMinFee ?? 0), vehicle.platformFeeMaxFee ?? Infinity)
        : Math.round(
            Math.min(
              Math.max((total * feeValue) / 100, vehicle.platformFeeMinFee ?? 0),
              vehicle.platformFeeMaxFee ?? total,
            ),
          );
    const depositPercent = Math.max(20, vehicle.depositPercent || 0);
    const deposit = Math.round((total * depositPercent) / 100);
    const remaining = Math.max(total - deposit, 0);
    return { base, discPct, discAmt, promoAmt, fee, deposit, depositPercent, remaining, total, deliveryFee };
  }, [vehicle, pricePerDay, days, promoResult, deliveryPreview]);

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
    if (!pickupAddress.trim()) {
      Alert.alert("Thiếu địa điểm", "Vui lòng chọn địa chỉ nhận xe từ danh sách gợi ý.");
      return;
    }
    if (pickupLat == null || pickupLng == null) {
      Alert.alert("Thiếu tọa độ", "Địa chỉ nhận xe chưa ghim được tọa độ. Hãy chọn lại từ danh sách gợi ý.");
      return;
    }
    if (deliveryPreview?.overMax) {
      Alert.alert(
        "Ngoài phạm vi giao xe",
        `Điểm nhận xe cách vị trí xe ${deliveryPreview.distanceKm} km, vượt quá ${effectiveConfig.maxKm} km cho phép. Vui lòng chọn điểm nhận gần hơn.`,
      );
      return;
    }
    if (!sameReturn) {
      if (!returnAddress.trim()) {
        Alert.alert("Thiếu địa điểm", "Vui lòng chọn địa chỉ trả xe từ danh sách gợi ý.");
        return;
      }
      if (returnLat == null || returnLng == null) {
        Alert.alert("Thiếu tọa độ", "Địa chỉ trả xe chưa ghim được tọa độ. Hãy chọn lại từ danh sách gợi ý.");
        return;
      }
    }
    if (availabilityLoading) {
      Alert.alert("Đang tải lịch xe", "Vui lòng đợi tải lịch bận của xe.");
      return;
    }
    if (availabilityError) {
      Alert.alert("Chưa tải được lịch xe", "Vui lòng thử lại sau.");
      return;
    }
    if (days <= 0) {
      Alert.alert("Thời gian chưa hợp lệ", "Ngày trả phải sau ngày nhận.");
      return;
    }
    if (conflictDate) {
      Alert.alert("Xe đã bận", `Xe bận vào ${new Date(conflictDate).toLocaleDateString("vi-VN")}. Vui lòng chọn thời gian khác.`);
      return;
    }
    setSubmitting(true);
    try {
      const created = await createBooking({
        vehicleId,
        startDate: start,
        endDate: end,
        quoteId: pricingQuote?.quoteId,
        pickupAddress: pickupAddress.trim(),
        pickupLatitude: pickupLat,
        pickupLongitude: pickupLng,
        returnAddress: sameReturn ? undefined : returnAddress.trim(),
        returnLatitude: sameReturn ? undefined : returnLat ?? undefined,
        returnLongitude: sameReturn ? undefined : returnLng ?? undefined,
        customerNote: note.trim() || undefined,
        promotionCode: promoResult?.code ?? undefined,
      });
      Alert.alert(
        "Đặt xe thành công",
        `Mã đơn ${created.bookingCode}. Chủ xe duyệt xong bạn sẽ thanh toán cọc.`,
        [{ text: "Xem chuyến đi", onPress: () => onCreated?.(created.id) }],
      );
    } catch (err) {
      const nextAvailable = getNextAvailableFromError(err);
      if (nextAvailable) {
        setNextAvailableDate(nextAvailable);
      } else {
        Alert.alert("Không tạo được đơn", getApiErrorMessage(err, "Vui lòng thử lại sau."));
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
              <Text style={styles.muted}>{formatPeriodSummary(start, end)}</Text>
              <Text style={styles.muted}>
                {days > 0 ? `${days} ngày` : "Thời gian chưa hợp lệ"}
                {estimate != null ? ` · tạm tính ${formatMoney(estimate)}` : ""}
              </Text>
              <Text style={styles.hint}>Chi phí tạm tính bên dưới; con số cuối cùng chốt khi chủ xe duyệt.</Text>
            </View>

            {availabilityLoading ? <Text style={styles.muted}>Đang tải lịch xe...</Text> : null}
            {availabilityError ? <Text style={styles.warnText}>Không tải được lịch xe. Vui lòng thử lại.</Text> : null}
            {conflictDate ? (
              <Text style={styles.warnText}>Xe bận vào {new Date(conflictDate).toLocaleDateString("vi-VN")}. Vui lòng chọn thời gian khác.</Text>
            ) : null}
            {nextAvailableDate ? (
              <View style={styles.card}>
                <Text style={styles.muted}>Xe có thể thuê từ ngày {new Date(nextAvailableDate).toLocaleDateString("vi-VN")}.</Text>
                <Pressable onPress={() => applyNextAvailable(nextAvailableDate)} style={styles.submit}>
                  <Text style={styles.submitText}>Dùng ngày này</Text>
                </Pressable>
              </View>
            ) : null}

            <Text style={styles.label}>Nhận xe lúc (DD/MM/YYYY HH:mm)</Text>
            <TextInput
              value={startText}
              onChangeText={handleStartText}
              placeholder="DD/MM/YYYY HH:mm"
              placeholderTextColor={theme.placeholder}
              style={styles.input}
            />
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

            {deliveryPreview ? (
              deliveryPreview.overMax ? (
                <Text style={styles.warnText}>
                  Điểm nhận xe cách vị trí xe {deliveryPreview.distanceKm} km, vượt quá {effectiveConfig.maxKm} km cho phép.
                  Vui lòng chọn điểm nhận gần hơn.
                </Text>
              ) : (
                <Text style={styles.deliveryInfo}>
                  Cách vị trí xe {deliveryPreview.distanceKm} km ·{" "}
                  {deliveryPreview.fee > 0
                    ? `Phí giao xe tận nơi ${formatMoney(deliveryPreview.fee)}`
                    : "Miễn phí giao xe"}
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
                onChangeText={(t) => {
                  setPromoCode(t);
                  setPromoResult(null);
                  setPromoError(null);
                }}
                onFocus={() => scrollToField("promo")}
                placeholder="Nhập mã hoặc chọn từ ví"
                placeholderTextColor={theme.placeholder}
                autoCapitalize="characters"
                style={[styles.input, styles.promoInput]}
              />
              <Pressable onPress={openVoucherPicker} style={styles.voucherButton}>
                <Text style={styles.voucherButtonText}>Ví</Text>
              </Pressable>
              <Pressable
                onPress={() => validateCode(promoCode)}
                disabled={promoLoading || !promoCode.trim()}
                style={[styles.applyButton, (promoLoading || !promoCode.trim()) && styles.submitDisabled]}
              >
                {promoLoading ? (
                  <ActivityIndicator color={theme.onBrand} size="small" />
                ) : (
                  <Text style={styles.applyButtonText}>Áp dụng</Text>
                )}
              </Pressable>
            </View>
            {promoResult ? (
              <Text style={styles.promoOk}>
                Đã áp mã {promoResult.code}: giảm {formatMoney(promoResult.discountAmount)}
              </Text>
            ) : null}
            {promoError ? <Text style={styles.warnText}>{promoError}</Text> : null}

            {pricePreview ? (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Chi phí tạm tính</Text>
                <Row label={`Giá thuê (${days} ngày)`} value={formatMoney(pricePreview.base)} />
                {pricePreview.discPct > 0 ? (
                  <Row label={`Giảm giá (${pricePreview.discPct}%)`} value={`-${formatMoney(pricePreview.discAmt)}`} tone="success" />
                ) : null}
                {pricePreview.promoAmt > 0 ? (
                  <Row
                    label={`Mã ${promoResult?.code ?? ""}`}
                    value={`-${formatMoney(pricePreview.promoAmt)}`}
                    tone="success"
                  />
                ) : null}
                {pricePreview.deliveryFee > 0 ? (
                  <Row
                    label={`Phí giao xe tận nơi (${deliveryPreview?.distanceKm ?? "-"} km)`}
                    value={`+${formatMoney(pricePreview.deliveryFee)}`}
                  />
                ) : null}
                <Row label="Phí nền tảng (đã gồm trong tổng)" value={formatMoney(pricePreview.fee)} />
                <Row label="Tổng cộng" value={formatMoney(pricePreview.total)} strong />
                <Row label="Đặt cọc ngay" value={formatMoney(pricePreview.deposit)} />
                {pricePreview.remaining > 0 ? (
                  <Row label="Trả khi nhận xe" value={formatMoney(pricePreview.remaining)} />
                ) : null}
                {vehicle?.securityRequiresDeposit ? (
                  <Text style={styles.muted}>Cần thế chấp {formatMoney(vehicle.securityDepositAmount)} khi nhận xe (hoàn lại khi trả xe).</Text>
                ) : null}
              </View>
            ) : null}

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

function Row({
  label,
  value,
  tone,
  strong,
}: {
  label: string;
  value: string;
  tone?: "success";
  strong?: boolean;
}) {
  return (
    <View style={rowStyles.row}>
      <Text style={[rowStyles.label, strong && rowStyles.strongLabel]}>{label}</Text>
      <Text
        style={[
          rowStyles.value,
          tone === "success" && rowStyles.success,
          strong && rowStyles.strong,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
  label: { color: "#6b7280", fontSize: 13, flexShrink: 0 },
  value: { color: "#111827", fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1 },
  success: { color: "#059669" },
  strongLabel: { color: "#111827", fontWeight: "800" },
  strong: { color: "#6B19FF", fontSize: 15, fontWeight: "800" },
});

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
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
      gap: 4,
    },
    cardTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13 },
    hint: { color: theme.placeholder, fontSize: 12, fontStyle: "italic" },
    label: { color: theme.text, fontSize: 13, fontWeight: "700", marginTop: 6 },
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
    promoRow: { flexDirection: "row", gap: 8, alignItems: "center" },
    promoInput: { flex: 1 },
    voucherButton: {
      borderRadius: 10,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    voucherButtonText: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    applyButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 14,
      paddingVertical: 12,
      minWidth: 68,
      alignItems: "center",
    },
    applyButtonText: { color: theme.onBrand, fontSize: 13, fontWeight: "800" },
    promoOk: { color: theme.success, fontSize: 13, fontWeight: "700" },
    deliveryInfo: { color: theme.text, fontSize: 13, fontWeight: "600" },
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
    voucherInfo: { flex: 1, gap: 2 },
    voucherCode: { color: theme.text, fontSize: 15, fontWeight: "800" },
    warnText: { color: theme.danger, fontSize: 12, fontWeight: "600" },
    useText: { color: theme.brand, fontSize: 14, fontWeight: "800" },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10, alignItems: "center" },
    ghostText: { color: theme.muted, fontWeight: "700" },
    switchRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 6,
    },
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
