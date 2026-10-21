import CheckoutConfirmation from "../components/CheckoutConfirmation";
import CheckoutEditor from "../components/CheckoutEditor";
import { OutstandingSurcharge } from "../components/CheckoutSummary";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, BackHandler, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { checkPaymentStatus, createPaymentLink } from "@/features/payments/services/paymentService";
import { approveBooking, cancelBooking, confirmCheckIn, confirmCheckOut, getBookingById, getBookingCancellationQuote, getInspectionReports, rejectBooking, requestCheckInRevision } from "../bookingService";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BOOKING_STATUS_LABELS, isDepositExpired, formatMoney, formatVietnamDateTime, inspectionAvailability, inspectionLabel, type BookingRole, type InspectionType } from "../bookingDisplay";
import { BookingButton, BookingCard, BookingField, BookingHeader } from "../components/BookingControls";
import InspectionReportCard from "../components/InspectionReportCard";
import InspectionFormScreen from "./InspectionFormScreen";

export default function BookingDetailScreen({ bookingId, role, onBack }: { bookingId: number; role: BookingRole; onBack: () => void }) {
  const { theme } = useTheme();
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [reports, setReports] = useState<InspectionReportResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const requestId = useRef(0);
  const [form, setForm] = useState<InspectionType | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [revisionReport, setRevisionReport] = useState<InspectionReportResponse | null>(null);
  const [revisionReason, setRevisionReason] = useState("");
  const [paymentOrder, setPaymentOrder] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [checkoutToConfirm, setCheckoutToConfirm] = useState<InspectionReportResponse | null>(null);

  const load = useCallback(async () => {
    const request = ++requestId.current;
    setLoading(true); setError("");
    try {
      const [data, inspectionReports] = await Promise.all([getBookingById(bookingId), getInspectionReports(bookingId)]);
      if (mounted.current && request === requestId.current) { setBooking(data); setReports(inspectionReports); setNow(Date.now()); }
    } catch (err) {
      if (mounted.current && request === requestId.current) setError(getApiErrorMessage(err, "Không tải được đơn thuê và biên bản. Vui lòng thử lại."));
    } finally {
      if (mounted.current && request === requestId.current) setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    mounted.current = true; void load();
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => { mounted.current = false; requestId.current++; clearInterval(timer); };
  }, [load]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => { if (state === "active" && !lock.current && !form) void load(); });
    return () => subscription.remove();
  }, [load, form]);
  useEffect(() => {
    if (form) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { if (!lock.current) onBack(); return true; });
    return () => subscription.remove();
  }, [form, onBack]);

  async function action(operation: () => Promise<BookingResponse>, success: string) {
    if (lock.current) return;
    lock.current = true; requestId.current++; setBusy(true); setError(""); setMessage("");
    try {
      const updated = await operation();
      if (mounted.current) { setBooking(updated); setMessage(success); setRejecting(false); await load(); }
    } catch (err) {
      if (mounted.current) { await load(); setError(getApiErrorMessage(err, "Không thể thực hiện thao tác. Vui lòng thử lại.")); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  function confirmReport(type: InspectionType) {
    if (type === "CheckOut") { setCheckoutToConfirm(reports.find(r => r.type === "CheckOut") ?? null); return; }
    const report = reports.find(r => r.type === "CheckIn");
    if (!report || report.requiresRevision) return;
    Alert.alert("Xác nhận nhận xe?",
      "Chỉ xác nhận khi bạn đã xem toàn bộ ảnh và đồng ý với số km, nhiên liệu, hư hại trong biên bản.", [
        { text: "Xem lại", style: "cancel" },
        { text: "Đồng ý và xác nhận", onPress: () => void action(() => confirmCheckIn(bookingId, report.version ?? 1), "Đã xác nhận nhận xe.") },
      ]);
  }

  async function requestRevision() {
    if (lock.current || !revisionReport || !revisionReason.trim()) return;
    lock.current = true; requestId.current++; setBusy(true); setError(""); setMessage("");
    try {
      await requestCheckInRevision(bookingId, revisionReport.version ?? 1, revisionReason.trim());
      if (mounted.current) { setRevisionReport(null); setMessage("Đã yêu cầu lập lại biên bản. Chờ chủ xe gửi bản mới."); await load(); }
    } catch (err) {
      if (mounted.current) { await load(); setError(getApiErrorMessage(err, "Không thể gửi yêu cầu lập lại biên bản.")); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function payDeposit() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const payment = await createPaymentLink(bookingId);
      if (!/^https:\/\//i.test(payment.checkoutUrl)) throw new Error("Invalid payment URL");
      if (mounted.current) setPaymentOrder(payment.orderCode);
      await Linking.openURL(payment.checkoutUrl);
      if (mounted.current) setMessage("Sau khi thanh toán, quay lại app và bấm kiểm tra thanh toán hoặc tải lại đơn thuê.");
    } catch (err) {
      if (mounted.current) setError(getApiErrorMessage(err, "Không thể mở trang thanh toán."));
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function verifyPayment() {
    if (!paymentOrder || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await checkPaymentStatus(paymentOrder);
      if (mounted.current) { setMessage(result.isConfirmed ? "Đã xác nhận thanh toán." : "Thanh toán chưa hoàn tất. Bạn có thể kiểm tra lại sau."); await load(); }
    } catch (err) {
      if (mounted.current) setError(getApiErrorMessage(err, "Không kiểm tra được thanh toán."));
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function requestCancel() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const quote = await getBookingCancellationQuote(bookingId);
      if (!mounted.current) return;
      if (!quote.canCancel) { setError(quote.policyMessage || "Đơn này không thể hủy."); return; }
      Alert.alert("Hủy đơn thuê?", `${quote.policyMessage}\nHoàn lại: ${formatMoney(quote.refundAmount)}\nKhông hoàn lại: ${formatMoney(quote.forfeitedAmount)}`, [
        { text: "Giữ đơn", style: "cancel" }, { text: "Xác nhận hủy", style: "destructive", onPress: () => void action(() => cancelBooking(bookingId), "Đã hủy đơn thuê.") },
      ]);
    } catch (err) { if (mounted.current) setError(getApiErrorMessage(err, "Không tải được chính sách hủy đơn.")); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  if (form && booking) return <InspectionFormScreen booking={booking} reports={reports} type={form} onBack={() => setForm(null)} onSaved={(report) => {
    setReports((items) => [...items.filter((item) => item.type !== report.type), report]); setForm(null);
    setMessage("Đã gửi biên bản. Đang chờ khách xác nhận."); void load();
  }} />;

  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <BookingHeader title={booking?.bookingCode || "Chi tiết đơn thuê"} onBack={() => { if (!lock.current) onBack(); }} />
    {!booking && loading ? <View style={styles.center}><ActivityIndicator color={theme.brand} /><Text style={{ color: theme.muted }}>Đang tải đơn thuê…</Text></View> :
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!lock.current) void load(); }} tintColor={theme.brand} />}>
        {error ? <BookingCard><Text accessibilityRole="alert" style={{ color: theme.danger }}>{error}</Text><BookingButton secondary title="Tải lại đơn thuê" disabled={busy} onPress={() => void load()} /></BookingCard> : null}
        {message ? <Text accessibilityRole="alert" style={{ color: theme.success, lineHeight: 22 }}>{message}</Text> : null}
        {booking ? <>
          <BookingCard>
            {booking.vehicleImage ? <Image source={{ uri: booking.vehicleImage }} style={styles.vehicleImage} /> : null}
            <Text style={{ color: theme.text, fontSize: 21, fontWeight: "800" }}>{booking.vehicleName || `Xe #${booking.vehicleId}`}</Text>
            <Text style={{ color: theme.brand, fontWeight: "700" }}>{BOOKING_STATUS_LABELS[booking.status] || booking.status}</Text>
            <Text style={{ color: theme.text }}>Nhận xe: {formatVietnamDateTime(booking.startDate)}</Text>
            <Text style={{ color: theme.text }}>Trả xe: {formatVietnamDateTime(booking.endDate)}</Text>
            <Text style={{ color: theme.muted }}>Thời gian hiển thị theo giờ Việt Nam (UTC+07:00).</Text>
            <Text style={{ color: theme.text }}>Nơi nhận: {booking.pickupAddress}</Text>
            <Text style={{ color: theme.text }}>Nơi trả: {booking.returnAddress || booking.pickupAddress}</Text>
            {booking.customerNote ? <Text style={{ color: theme.muted }}>Ghi chú: {booking.customerNote}</Text> : null}
          </BookingCard>
          <BookingCard>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>Chi phí đơn thuê</Text>
            <Text style={{ color: theme.text }}>Tổng tiền: {formatMoney(booking.totalAmount)}</Text>
            <Text style={{ color: theme.text }}>Đặt cọc thuê xe: {formatMoney(booking.depositAmount)}</Text>
            {booking.securityDepositAmount > 0 ? <Text style={{ color: theme.text }}>Cọc đảm bảo: {formatMoney(booking.securityDepositAmount)}</Text> : null}
            {booking.paymentDueAt && booking.status === "Approved" ? <Text style={{ color: theme.muted }}>Hạn đặt cọc: {formatVietnamDateTime(booking.paymentDueAt)}</Text> : null}
          </BookingCard>
          {role === "Owner" && booking.status === "Pending" ? <BookingCard>
            <Text style={{ color: theme.text, fontWeight: "700" }}>Yêu cầu thuê đang chờ duyệt</Text>
            <BookingButton title="Duyệt đơn thuê" disabled={loading || !!error} busy={busy} onPress={() => void action(() => approveBooking(bookingId), "Đã duyệt đơn. Chờ khách đặt cọc.")} />
            <BookingButton title="Từ chối yêu cầu" secondary disabled={busy || loading || !!error} onPress={() => setRejecting(!rejecting)} />
            {rejecting ? <><BookingField label="Lý do từ chối" value={rejectReason} onChangeText={setRejectReason} multiline editable={!busy} />
              <BookingButton title="Xác nhận từ chối" danger disabled={!rejectReason.trim() || loading || !!error} busy={busy} onPress={() => void action(() => rejectBooking(bookingId, { reason: rejectReason.trim() }), "Đã từ chối đơn thuê.")} /></> : null}
          </BookingCard> : null}
          {role === "Customer" && booking.status === "Approved" ? <BookingCard>
            <Text style={{ color: theme.text }}>Chủ xe đã duyệt. Vui lòng thanh toán đặt cọc trước khi nhận xe.</Text>
            <BookingButton title="Thanh toán đặt cọc" busy={busy} disabled={loading || !!error || isDepositExpired(booking, now)} onPress={() => void payDeposit()} />
            {paymentOrder ? <BookingButton secondary title="Kiểm tra thanh toán" busy={busy} onPress={() => void verifyPayment()} /> : null}
          </BookingCard> : null}
          <OutstandingSurcharge booking={booking} report={reports.find(r => r.type === "CheckOut")} role={role} onUpdated={load} />
          {(["CheckIn", "CheckOut"] as const).map((type) => {
            const state = inspectionAvailability(booking, role, type, reports, now);
            return <View key={type} style={styles.section}>
              <Text accessibilityRole="header" style={{ color: theme.text, fontSize: 19, fontWeight: "800" }}>{inspectionLabel(type)}</Text>
              {state.report ? <InspectionReportCard booking={booking} report={state.report} /> : <Text style={{ color: theme.muted }}>Chưa có biên bản {type === "CheckIn" ? "nhận xe" : "trả xe"}.</Text>}
              {role === "Owner" && type === "CheckOut" && state.report ? <CheckoutEditor booking={booking} report={state.report} initialKm={reports.find(r => r.type === "CheckIn")?.odometerKm} onSaved={load} /> : null}
              {state.canCreate ? <BookingButton title={`Lập biên bản ${type === "CheckIn" ? "check-in" : "check-out"}`} disabled={busy || loading || !!error} onPress={() => setForm(type)} /> : null}
              {state.canConfirm ? <>
                {type === "CheckIn" ? <Text style={{ color: theme.muted, lineHeight: 21 }}>Cả chủ xe và khách cần ký hợp đồng để hợp đồng có hiệu lực trước khi xác nhận nhận xe. Bạn có thể ký trên web nếu chưa hoàn tất.</Text> : null}
                <BookingButton title={type === "CheckIn" ? "Đồng ý biên bản và nhận xe" : "Đồng ý biên bản và trả xe"} busy={busy} disabled={loading || !!error} onPress={() => confirmReport(type)} />
                {type === "CheckOut" ? <Text style={{ color: theme.muted, lineHeight: 21 }}>Nếu không đồng ý, hãy trao đổi với chủ xe hoặc liên hệ hỗ trợ trước khi xác nhận.</Text> : null}
              </> : null}
              {type === "CheckIn" && role === "Customer" && booking.status === "DepositPaid" && state.report && !state.report.isCustomerConfirmed && !state.report.requiresRevision ? <>
                <BookingButton secondary title="Không đồng ý biên bản / Yêu cầu lập lại" disabled={busy || loading || !!error} onPress={() => { setRevisionReport(state.report!); setRevisionReason(""); }} />
                {revisionReport ? <>
                  <Text style={{ color: theme.muted }}>Ghi rõ nội dung cần sửa. Chuyến chỉ bắt đầu khi bạn đồng ý biên bản mới.</Text>
                  <BookingField label="Lý do không đồng ý" value={revisionReason} onChangeText={value => setRevisionReason(value.slice(0, 1000))} multiline editable={!busy} />
                  <BookingButton title="Gửi yêu cầu lập lại" busy={busy} disabled={!revisionReason.trim() || loading || !!error} onPress={() => void requestRevision()} />
                  <BookingButton secondary title="Đóng" disabled={busy} onPress={() => setRevisionReport(null)} />
                </> : null}
              </> : null}
              {type === "CheckIn" && !state.pickupReached && booking.status === "DepositPaid" ? <Text style={{ color: theme.muted }}>
                {booking.canCheckInNow ? "Xe trống: có thể check-in sớm tối đa 2 giờ. Giờ trả và giá thuê theo đơn đã đặt." : booking.checkInUnavailableReason || "Có thể check-in sớm tối đa 2 giờ nếu xe trống. Tải lại đơn để kiểm tra."}
              </Text> : null}
              {type === "CheckIn" && role === "Customer" && !state.report && booking.status === "DepositPaid" ? <Text style={{ color: theme.muted }}>Chờ chủ xe chụp ảnh và lập biên bản nhận xe.</Text> : null}
              {type === "CheckOut" && role === "Customer" && !state.report && booking.status === "InProgress" ? <Text style={{ color: theme.muted }}>Khi trả xe, chủ xe sẽ chụp ảnh và lập biên bản để bạn đối chiếu.</Text> : null}
            </View>;
          })}
          {role === "Customer" && ["Pending", "Approved", "DepositPaid"].includes(booking.status) ? <BookingButton title="Xem chính sách và hủy đơn" secondary disabled={busy || loading || !!error} onPress={() => void requestCancel()} /> : null}
          {booking.cancelReason ? <Text style={{ color: theme.muted }}>Lý do: {booking.cancelReason}</Text> : null}
          {booking.statusHistory.length ? <BookingCard>
            <Text style={{ color: theme.text, fontSize: 17, fontWeight: "700" }}>Lịch sử đơn thuê</Text>
            {booking.statusHistory.map((entry, index) => <View key={`${entry.createdAt}-${index}`} style={{ gap: 4 }}>
              <Text style={{ color: theme.text }}>{BOOKING_STATUS_LABELS[entry.toStatus] || entry.toStatus} · {formatVietnamDateTime(entry.createdAt)}</Text>
              {entry.note ? <Text style={{ color: theme.muted }}>{entry.note}</Text> : null}
            </View>)}
          </BookingCard> : null}
        </> : null}
      </ScrollView>}
    <CheckoutConfirmation booking={booking} report={checkoutToConfirm} busy={busy} onClose={() => setCheckoutToConfirm(null)} onConfirm={(report, paymentMethod) => {
      void action(() => confirmCheckOut(bookingId, report.version ?? 1, paymentMethod), "Đã xác nhận trả xe. Chờ chủ xe xác nhận nhận lại xe.").then(() => setCheckoutToConfirm(null));
    }} />
  </View>;
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 32, gap: 20 }, center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  vehicleImage: { width: "100%", height: 170, borderRadius: 10 }, section: { gap: 12 },
});
