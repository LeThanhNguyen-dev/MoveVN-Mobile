import CheckoutConfirmation from "../components/CheckoutConfirmation";
import CheckoutEditor from "../components/CheckoutEditor";
import { OutstandingSurcharge } from "../components/CheckoutSummary";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, BackHandler, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { CalendarDays, CircleCheck, ClipboardCheck, Clock3, CreditCard, KeyRound, MapPin, PackageCheck, ReceiptText, RefreshCw, RotateCcw, Send, ShieldCheck, TriangleAlert, Wallet, XCircle } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import { detailFont as font } from "@/features/vehicles/components/detail/detailTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import { checkPaymentStatus, createPaymentLink } from "@/features/payments/services/paymentService";
import { approveBooking, cancelBooking, confirmCheckIn, confirmCheckOut, getBookingById, getBookingCancellationQuote, getInspectionReports, rejectBooking, requestCheckInRevision } from "../bookingService";
import type { BookingResponse, InspectionReportResponse } from "../types";
import { BOOKING_STATUS_LABELS, isDepositExpired, formatMoney, formatVietnamDateTime, inspectionAvailability, inspectionLabel, type BookingRole, type InspectionType } from "../bookingDisplay";
import { BookingField } from "../components/BookingControls";
import InspectionReportCard from "../components/InspectionReportCard";
import InspectionFormScreen from "./InspectionFormScreen";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import {
  DetailButton,
  DetailCard,
  DetailDivider,
  DetailHeader,
  DetailNotice,
  DetailPill,
  DetailRow,
  DetailSectionHeader,
  DetailStat,
} from "../components/detail/BookingDetailUI";

export default function BookingDetailScreen({ bookingId, role, onBack }: { bookingId: number; role: BookingRole; onBack: () => void }) {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const userId = useAuthStore((state) => state.user?.userId);
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

  // Phân quyền theo quyền sở hữu thực tế của đơn, không theo role đang chọn trên app:
  // tài khoản vừa là khách vừa là chủ xe không được thấy nút duyệt đơn của người khác.
  const viewerRole: BookingRole | null = booking
    ? booking.ownerId === userId ? "Owner" : booking.customerId === userId ? "Customer" : null
    : role;

  const statusTone = booking
    ? booking.status === "Completed" ? "mint" : booking.status === "Cancelled" || booking.status === "Rejected" ? "danger"
      : booking.status === "Pending" || booking.status === "Approved" ? "warn" : "brand"
    : "neutral";

  return <View style={{ flex: 1, backgroundColor: theme.background }}>
    <DetailHeader
      kicker={booking?.bookingCode || "Đơn thuê"}
      title="Chi tiết đơn thuê"
      onBack={() => { if (!lock.current) onBack(); }}
    />
    {!booking && loading ? <View style={styles.center}><ActivityIndicator color={theme.brand} /><Text style={styles.muted}>Đang tải đơn thuê…</Text></View> :
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!lock.current) void load(); }} tintColor={theme.brand} />}>
        {error ? <DetailNotice icon={TriangleAlert} title="Không tải được đơn thuê" tone="danger">
          {error}
        </DetailNotice> : null}
        {error ? <DetailButton variant="ghost" icon={RotateCcw} label="Tải lại đơn thuê" disabled={busy} onPress={() => void load()} /> : null}
        {message ? <DetailNotice icon={CircleCheck} title="Đã cập nhật" tone="mint">{message}</DetailNotice> : null}

        {booking ? <>
          <DetailCard>
            {booking.vehicleImage ? <Image source={{ uri: booking.vehicleImage }} style={styles.vehicleImage} resizeMode="cover" /> : null}
            <View style={styles.heroHead}>
              <View style={styles.heroBody}>
                <Text style={styles.kicker}>Đơn thuê xe</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>{booking.vehicleName || `Xe #${booking.vehicleId}`}</Text>
                <Text style={styles.heroCode} numberOfLines={1}>{booking.bookingCode}</Text>
              </View>
              <DetailPill label={BOOKING_STATUS_LABELS[booking.status] || booking.status} tone={statusTone} />
            </View>
            <View style={styles.stats}>
              <DetailStat icon={CalendarDays} label="Nhận xe" value={formatVietnamDateTime(booking.startDate)} />
              <DetailStat icon={CalendarDays} label="Trả xe" value={formatVietnamDateTime(booking.endDate)} />
              <DetailStat icon={Clock3} label="Thời lượng" value={`${booking.totalDays} ngày`} tone="brand" />
              <DetailStat icon={Wallet} label="Đặt cọc" value={formatMoney(booking.depositAmount)} />
            </View>
            <DetailDivider />
            <DetailRow icon={MapPin} label="Nơi nhận" value={booking.pickupAddress} />
            <DetailRow icon={MapPin} label="Nơi trả" value={booking.returnAddress || booking.pickupAddress} />
            {booking.customerNote ? (
              <DetailNotice icon={ClipboardCheck} title="Ghi chú của khách" tone="brand">{booking.customerNote}</DetailNotice>
            ) : null}
            <Text style={styles.hint}>Thời gian hiển thị theo giờ Việt Nam (UTC+07:00).</Text>
          </DetailCard>

          {viewerRole === "Owner" && booking.status === "Pending" ? <DetailCard>
            <DetailSectionHeader
              icon={ClipboardCheck}
              title="Yêu cầu thuê đang chờ duyệt"
              subtitle="Phản hồi sớm để khách kịp đặt cọc"
              right={<DetailPill label={formatMoney(booking.totalAmount)} tone="brand" />}
            />
            <View style={styles.actionsRow}>
              <DetailButton icon={CircleCheck} label="Duyệt đơn thuê" disabled={loading || !!error} busy={busy} onPress={() => void action(() => approveBooking(bookingId), "Đã duyệt đơn. Chờ khách đặt cọc.")} style={styles.actionsCell} />
              <DetailButton variant="secondary" icon={XCircle} label="Từ chối yêu cầu" disabled={busy || loading || !!error} onPress={() => setRejecting(!rejecting)} style={styles.actionsCell} />
            </View>
            {rejecting ? <>
              <BookingField label="Lý do từ chối" value={rejectReason} onChangeText={setRejectReason} multiline editable={!busy} />
              <DetailButton variant="danger" icon={XCircle} label="Xác nhận từ chối" disabled={!rejectReason.trim() || loading || !!error} busy={busy} onPress={() => void action(() => rejectBooking(bookingId, { reason: rejectReason.trim() }), "Đã từ chối đơn thuê.")} />
            </> : null}
          </DetailCard> : null}

          {viewerRole === "Customer" && booking.status === "Approved" ? <DetailCard>
            <DetailSectionHeader icon={Wallet} title="Thanh toán đặt cọc" subtitle="Chủ xe đã duyệt yêu cầu thuê" />
            <DetailNotice icon={ShieldCheck} title="Cần đặt cọc trước khi nhận xe" tone="warn">
              Chủ xe đã duyệt. Vui lòng thanh toán đặt cọc trước khi nhận xe.
            </DetailNotice>
            <DetailButton icon={CreditCard} label="Thanh toán đặt cọc" busy={busy} disabled={loading || !!error || isDepositExpired(booking, now)} onPress={() => void payDeposit()} />
            {paymentOrder ? <DetailButton variant="secondary" icon={RefreshCw} label="Kiểm tra thanh toán" busy={busy} onPress={() => void verifyPayment()} /> : null}
          </DetailCard> : null}

          <DetailCard>
            <DetailSectionHeader
              icon={ReceiptText}
              title="Chi phí đơn thuê"
              subtitle="Đã gồm phí nền tảng"
              right={<DetailPill label={formatMoney(booking.totalAmount)} tone="brand" />}
            />
            <DetailRow label="Tổng tiền" value={formatMoney(booking.totalAmount)} strong />
            <DetailRow label="Đặt cọc thuê xe" value={formatMoney(booking.depositAmount)} />
            {booking.securityDepositAmount > 0 ? <DetailRow label="Cọc đảm bảo" value={formatMoney(booking.securityDepositAmount)} /> : null}
            {booking.paymentDueAt && booking.status === "Approved" ? <DetailRow label="Hạn đặt cọc" value={formatVietnamDateTime(booking.paymentDueAt)} tone="muted" /> : null}
          </DetailCard>

          <OutstandingSurcharge booking={booking} report={reports.find(r => r.type === "CheckOut")} role={role} onUpdated={load} />

          {(["CheckIn", "CheckOut"] as const).map((type) => {
            const state = inspectionAvailability(booking, viewerRole ?? role, type, reports, now);
            const revisionCase = type === "CheckIn" && role === "Customer" && booking.status === "DepositPaid" && !!state.report && !state.report.isCustomerConfirmed && !state.report.requiresRevision;
            const editorCase = type === "CheckOut" && role === "Owner" && !!state.report;
            const noteCase = type === "CheckIn" && !state.pickupReached && booking.status === "DepositPaid";
            const waitingCase = (type === "CheckIn" && viewerRole === "Customer" && !state.report && booking.status === "DepositPaid")
              || (type === "CheckOut" && viewerRole === "Customer" && !state.report && booking.status === "InProgress");
            const hasActions = state.canCreate || state.canConfirm || revisionCase || editorCase || noteCase || waitingCase;

            return <View key={type} style={styles.sectionGroup}>
              {state.report ? <InspectionReportCard booking={booking} report={state.report} /> : <DetailCard>
                <DetailSectionHeader
                  icon={type === "CheckIn" ? KeyRound : PackageCheck}
                  title={inspectionLabel(type)}
                  subtitle={type === "CheckIn" ? "Biên bản nhận xe" : "Biên bản trả xe"}
                />
                <Text style={styles.muted}>Chưa có biên bản {type === "CheckIn" ? "nhận xe" : "trả xe"}.</Text>
                {state.canCreate ? <DetailButton icon={ClipboardCheck} label={`Lập biên bản ${type === "CheckIn" ? "check-in" : "check-out"}`} disabled={busy || loading || !!error} onPress={() => setForm(type)} /> : null}
              </DetailCard>}

              {hasActions ? <DetailCard>
                <DetailSectionHeader
                  icon={type === "CheckIn" ? KeyRound : PackageCheck}
                  title={state.canCreate || state.canConfirm ? (type === "CheckIn" ? "Xác nhận nhận xe" : "Xác nhận trả xe") : "Thao tác"}
                  subtitle="Kiểm tra biên bản, ảnh xe và thanh toán trước khi xác nhận"
                />
                {editorCase && state.report ? <CheckoutEditor booking={booking} report={state.report} initialKm={reports.find(r => r.type === "CheckIn")?.odometerKm} onSaved={load} /> : null}
                {state.canCreate && state.report ? <DetailButton icon={ClipboardCheck} label={`Lập biên bản ${type === "CheckIn" ? "check-in" : "check-out"}`} disabled={busy || loading || !!error} onPress={() => setForm(type)} /> : null}
                {state.canConfirm ? <>
                  {type === "CheckIn" ? <Text style={styles.muted}>Cả chủ xe và khách cần ký hợp đồng để hợp đồng có hiệu lực trước khi xác nhận nhận xe. Bạn có thể ký trên web nếu chưa hoàn tất.</Text> : null}
                  <DetailButton icon={type === "CheckIn" ? KeyRound : PackageCheck} label={type === "CheckIn" ? "Đồng ý biên bản và nhận xe" : "Đồng ý biên bản và trả xe"} busy={busy} disabled={loading || !!error} onPress={() => confirmReport(type)} />
                  {type === "CheckOut" ? <Text style={styles.muted}>Nếu không đồng ý, hãy trao đổi với chủ xe hoặc liên hệ hỗ trợ trước khi xác nhận.</Text> : null}
                </> : null}
                {revisionCase ? <>
                  <DetailButton variant="secondary" icon={RotateCcw} label="Không đồng ý biên bản / Yêu cầu lập lại" disabled={busy || loading || !!error} onPress={() => { setRevisionReport(state.report!); setRevisionReason(""); }} />
                  {revisionReport ? <>
                    <Text style={styles.muted}>Ghi rõ nội dung cần sửa. Chuyến chỉ bắt đầu khi bạn đồng ý biên bản mới.</Text>
                    <BookingField label="Lý do không đồng ý" value={revisionReason} onChangeText={value => setRevisionReason(value.slice(0, 1000))} multiline editable={!busy} />
                    <DetailButton icon={Send} label="Gửi yêu cầu lập lại" busy={busy} disabled={!revisionReason.trim() || loading || !!error} onPress={() => void requestRevision()} />
                    <DetailButton variant="ghost" label="Đóng" disabled={busy} onPress={() => setRevisionReport(null)} />
                  </> : null}
                </> : null}
                {noteCase ? <Text style={styles.muted}>
                  {booking.canCheckInNow ? "Xe trống: có thể check-in sớm tối đa 2 giờ. Giờ trả và giá thuê theo đơn đã đặt." : booking.checkInUnavailableReason || "Có thể check-in sớm tối đa 2 giờ nếu xe trống. Tải lại đơn để kiểm tra."}
                </Text> : null}
                {type === "CheckIn" && viewerRole === "Customer" && !state.report && booking.status === "DepositPaid" ? <Text style={styles.muted}>Chờ chủ xe chụp ảnh và lập biên bản nhận xe.</Text> : null}
                {type === "CheckOut" && viewerRole === "Customer" && !state.report && booking.status === "InProgress" ? <Text style={styles.muted}>Khi trả xe, chủ xe sẽ chụp ảnh và lập biên bản để bạn đối chiếu.</Text> : null}
              </DetailCard> : null}
            </View>;
          })}

          {viewerRole === "Customer" && ["Pending", "Approved", "DepositPaid"].includes(booking.status) ? <DetailCard>
            <DetailSectionHeader icon={TriangleAlert} title="Hủy đơn thuê" subtitle="Xem chính sách hoàn cọc trước khi hủy" />
            <DetailButton variant="danger" icon={TriangleAlert} label="Xem chính sách và hủy đơn" disabled={busy || loading || !!error} onPress={() => void requestCancel()} />
          </DetailCard> : null}

          {booking.cancelReason ? <DetailCard>
            <DetailSectionHeader icon={TriangleAlert} title="Lý do hủy đơn" subtitle="Ghi nhận từ hệ thống" />
            <Text style={styles.muted}>{booking.cancelReason}</Text>
          </DetailCard> : null}

          {booking.statusHistory.length ? <DetailCard>
            <DetailSectionHeader icon={Clock3} title="Lịch sử đơn thuê" subtitle={`${booking.statusHistory.length} cập nhật`} />
            {booking.statusHistory.map((entry, index) => <View key={`${entry.createdAt}-${index}`} style={styles.historyRow}>
              <Text style={styles.historyTitle}>{BOOKING_STATUS_LABELS[entry.toStatus] || entry.toStatus} · {formatVietnamDateTime(entry.createdAt)}</Text>
              {entry.note ? <Text style={styles.muted}>{entry.note}</Text> : null}
            </View>)}
          </DetailCard> : null}
        </> : null}
      </ScrollView>}
    <CheckoutConfirmation booking={booking} report={checkoutToConfirm} busy={busy} onClose={() => setCheckoutToConfirm(null)} onConfirm={(report, paymentMethod) => {
      void action(() => confirmCheckOut(bookingId, report.version ?? 1, paymentMethod), "Đã xác nhận trả xe. Chờ chủ xe xác nhận nhận lại xe.").then(() => setCheckoutToConfirm(null));
    }} />
  </View>;
}


const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { paddingHorizontal: 8, paddingTop: 16, paddingBottom: 40, gap: 10 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    sectionGroup: { gap: 12 },
    actionsRow: { flexDirection: "row", gap: 8 },
    actionsCell: { flex: 1 },
    vehicleImage: { width: "100%", height: 140, borderRadius: 20, backgroundColor: theme.surfaceAlt },
    heroHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
    heroBody: { flex: 1, minWidth: 0, gap: 3 },
    kicker: {
      color: theme.faint,
      fontFamily: font.bold,
      fontSize: 8.5,
      letterSpacing: 0.7,
      textTransform: "uppercase",
    },
    heroTitle: { color: theme.text, fontFamily: font.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.3 },
    heroCode: { color: theme.muted, fontFamily: font.semibold, fontSize: 10.5, letterSpacing: 0.2 },
    stats: { flexDirection: "row", gap: 8 },
    hint: { color: theme.faint, fontFamily: font.regular, fontSize: 9.5, lineHeight: 14 },
    muted: { color: theme.muted, fontFamily: font.regular, fontSize: 11.5, lineHeight: 17 },
    historyRow: {
      gap: 3,
      paddingTop: 9,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    historyTitle: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5, lineHeight: 16 },
  });
