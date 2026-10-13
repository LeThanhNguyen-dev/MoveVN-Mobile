import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import type { ExploreStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { getPublicVehicleById } from "@/features/vehicles/services/publicVehicleService";
import type { VehicleResponse } from "@/features/vehicles/types";
import RentalPeriodSheet from "@/features/vehicles/components/RentalPeriodSheet";
import SurchargePolicySummary from "@/features/vehicles/components/SurchargePolicySummary";
import { calculateRentalDays, formatPeriodSummary, getDefaultRentalPeriod } from "@/features/vehicles/utils/rentalPeriod";
import { BookingButton, BookingCard, BookingField, BookingHeader } from "../components/BookingControls";
import { createBooking } from "../bookingService";
import { formatMoney } from "../bookingDisplay";

export default function CreateBookingScreen({ route, navigation }: {
  route: RouteProp<ExploreStackParamList, "CreateBooking">;
  navigation: NativeStackNavigationProp<ExploreStackParamList, "CreateBooking">;
}) {
  const { theme } = useTheme();
  const [vehicle, setVehicle] = useState<VehicleResponse | null>(null);
  const defaultPeriod = useRef(getDefaultRentalPeriod()).current;
  const [startDate, setStartDate] = useState(route.params.startDate || defaultPeriod.startDate);
  const [endDate, setEndDate] = useState(route.params.endDate || defaultPeriod.endDate);
  const [note, setNote] = useState("");
  const [promotion, setPromotion] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const lock = useRef(false);
  const mounted = useRef(true);
  const days = calculateRentalDays(startDate, endDate);

  useEffect(() => {
    let cancelled = false; mounted.current = true; setLoading(true); setError("");
    getPublicVehicleById(route.params.vehicleId).then((data) => {
      if (!cancelled) { if (!data) throw new Error("Vehicle unavailable"); setVehicle(data); }
    }).catch((err) => { if (!cancelled) setError(getApiErrorMessage(err, "Không tải được thông tin xe.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; mounted.current = false; };
  }, [route.params.vehicleId, retry]);
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !busy });
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => lock.current);
    return () => subscription.remove();
  }, [navigation, busy]);

  async function submit() {
    if (lock.current || !vehicle) return;
    const start = new Date(startDate); const end = new Date(endDate);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start.getTime() <= Date.now() || end <= start) {
      setError("Chọn giờ nhận xe trong tương lai và giờ trả xe sau giờ nhận."); return;
    }
    if (!vehicle.address.trim()) { setError("Xe chưa có địa chỉ nhận. Vui lòng liên hệ chủ xe."); return; }
    if (vehicle.latitude == null || vehicle.longitude == null) {
      setError("Xe chưa có tọa độ điểm nhận. Vui lòng liên hệ chủ xe cập nhật địa chỉ."); return;
    }
    if (!agreed) { setError("Vui lòng đồng ý điều kiện thuê xe trước khi gửi yêu cầu."); return; }
    lock.current = true; setBusy(true); setError("");
    try {
      const booking = await createBooking({ vehicleId: vehicle.id, startDate: start.toISOString(), endDate: end.toISOString(),
        pickupAddress: vehicle.address, returnAddress: vehicle.address,
        pickupLatitude: vehicle.latitude, pickupLongitude: vehicle.longitude,
        returnLatitude: vehicle.latitude, returnLongitude: vehicle.longitude,
        customerNote: note.trim() || undefined, promotionCode: promotion.trim() || undefined });
      if (mounted.current) navigation.replace("BookingDetail", { bookingId: booking.id });
    } catch (err) {
      if (mounted.current) setError(getApiErrorMessage(err, "Không thể tạo đơn thuê. Vui lòng kiểm tra lịch xe và thử lại."));
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: theme.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
    <BookingHeader title="Yêu cầu thuê xe" onBack={() => { if (!lock.current) navigation.goBack(); }} />
    {loading ? <View style={styles.center}><ActivityIndicator color={theme.brand} /></View> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {error ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text> : null}
      {!vehicle ? <BookingButton title="Tải lại xe" onPress={() => setRetry((value) => value + 1)} /> : <>
        <BookingCard>
          {vehicle.featuredImage ? <Image source={{ uri: vehicle.featuredImage }} style={styles.image} /> : null}
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: "800" }}>{[vehicle.brandName, vehicle.modelName, vehicle.year].filter(Boolean).join(" ")}</Text>
          <Text style={{ color: theme.text }}>Nhận và trả tại địa chỉ chủ xe: {vehicle.address}</Text>
          <BookingButton title={formatPeriodSummary(startDate, endDate)} secondary disabled={busy} onPress={() => setPeriodOpen(true)} />
          <Text style={{ color: theme.muted }}>Thời gian chọn theo múi giờ của thiết bị.</Text>
        </BookingCard>
        <BookingCard>
          <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>Giá tham khảo</Text>
          <Text style={{ color: theme.text }}>{days} ngày × {formatMoney(vehicle.currentPricePerDay ?? vehicle.pricePerDay)}/ngày</Text>
          <Text style={{ color: theme.text, fontWeight: "700" }}>Tiền thuê ước tính: {formatMoney(days * (vehicle.currentPricePerDay ?? vehicle.pricePerDay))}</Text>
          <Text style={{ color: theme.muted, lineHeight: 21 }}>Phí nền tảng, giảm giá và giá theo ngày được hệ thống tính khi tạo đơn. Kiểm tra tổng tiền trong chi tiết đơn trước khi đặt cọc.</Text>
          {vehicle.securityRequiresDeposit ? <Text style={{ color: theme.text }}>Cọc đảm bảo xe: {formatMoney(vehicle.securityDepositAmount)}</Text> : null}
          <BookingField label="Mã khuyến mãi (nếu có)" value={promotion} onChangeText={setPromotion} editable={!busy} />
          <BookingField label="Ghi chú cho chủ xe" value={note} onChangeText={setNote} editable={!busy} multiline />
        </BookingCard>
        <SurchargePolicySummary policies={vehicle.surchargePolicies} />
        <View style={styles.agreement}><Switch accessibilityLabel="Đồng ý điều kiện thuê xe" value={agreed} onValueChange={setAgreed} disabled={busy} trackColor={{ true: theme.brand }} />
          <Text style={{ color: theme.text, flex: 1, lineHeight: 22 }}>Tôi đã xem điều kiện thuê và phụ phí của xe, đồng ý gửi yêu cầu để chủ xe duyệt.</Text></View>
        <BookingButton title="Gửi yêu cầu thuê xe" busy={busy} disabled={!agreed || days < 1} onPress={() => void submit()} />
      </>}
    </ScrollView>}
    <RentalPeriodSheet visible={periodOpen} startDate={startDate} endDate={endDate} onStartDateChange={setStartDate} onEndDateChange={setEndDate} onClose={() => setPeriodOpen(false)} />
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ content: { padding: 16, paddingBottom: 32, gap: 16 }, center: { flex: 1, alignItems: "center", justifyContent: "center" }, image: { width: "100%", height: 160, borderRadius: 10 }, agreement: { flexDirection: "row", gap: 12, alignItems: "center" } });
