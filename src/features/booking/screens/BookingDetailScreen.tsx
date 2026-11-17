import CheckoutConfirmation from "../components/CheckoutConfirmation";
import CheckoutEditor from "../components/CheckoutEditor";
import { OutstandingSurcharge } from "../components/CheckoutSummary";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, AppState, BackHandler, Image, Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { showAppAlert } from "@/components/appDialog/dialogStore";
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
import LatePickupWaitCard from "../components/LatePickupWaitCard";
import ExtensionRequestPanel from "@/features/contracts/components/ExtensionRequestPanel";
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
  const { t } = useTranslation();
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
      if (mounted.current && request === requestId.current) setError(getApiErrorMessage(err, t("mobile:bookingDetail.errors.loadBooking")));
    } finally {
      if (mounted.current && request === requestId.current) setLoading(false);
    }
  }, [bookingId, t]);

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
      if (mounted.current) { await load(); setError(getApiErrorMessage(err, t("mobile:bookingDetail.errors.actionFailed"))); }
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  function confirmReport(type: InspectionType) {
    if (type === "CheckOut") { setCheckoutToConfirm(reports.find(r => r.type === "CheckOut") ?? null); return; }
    const report = reports.find(r => r.type === "CheckIn");
    if (!report || report.requiresRevision) return;
    showAppAlert(t("mobile:bookingDetail.alerts.confirmPickupTitle"),
      t("mobile:bookingDetail.alerts.confirmPickupBody"), [
        { text: t("mobile:bookingDetail.alerts.reviewAgain"), style: "cancel" },
        { text: t("mobile:bookingDetail.alerts.agreeAndConfirm"), onPress: () => void action(() => confirmCheckIn(bookingId, report.version ?? 1), t("mobile:bookingDetail.alerts.pickupConfirmed")) },
      ]);
  }

  async function requestRevision() {
    if (lock.current || !revisionReport || !revisionReason.trim()) return;
    lock.current = true; requestId.current++; setBusy(true); setError(""); setMessage("");
    try {
      await requestCheckInRevision(bookingId, revisionReport.version ?? 1, revisionReason.trim());
      if (mounted.current) { setRevisionReport(null); setMessage(t("mobile:bookingDetail.alerts.revisionRequested")); await load(); }
    } catch (err) {
      if (mounted.current) { await load(); setError(getApiErrorMessage(err, t("mobile:bookingDetail.errors.revisionFailed"))); }
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
      if (mounted.current) setMessage(t("mobile:bookingDetail.alerts.paymentReturn"));
    } catch (err) {
      if (mounted.current) setError(getApiErrorMessage(err, t("mobile:bookingDetail.errors.openPayment")));
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function verifyPayment() {
    if (!paymentOrder || lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const result = await checkPaymentStatus(paymentOrder);
      if (mounted.current) { setMessage(result.isConfirmed ? t("mobile:bookingDetail.alerts.paymentConfirmed") : t("mobile:bookingDetail.alerts.paymentIncomplete")); await load(); }
    } catch (err) {
      if (mounted.current) setError(getApiErrorMessage(err, t("mobile:bookingDetail.errors.checkPayment")));
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  async function requestCancel() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError("");
    try {
      const quote = await getBookingCancellationQuote(bookingId);
      if (!mounted.current) return;
      if (!quote.canCancel) { setError(quote.policyMessage || t("mobile:bookingDetail.errors.cancelUnavailable")); return; }
      showAppAlert(t("mobile:bookingDetail.alerts.cancelTitle"), t("mobile:bookingDetail.alerts.cancelBody", {
        policy: quote.policyMessage,
        refund: formatMoney(quote.refundAmount),
        forfeited: formatMoney(quote.forfeitedAmount),
      }), [
        { text: t("mobile:bookingDetail.alerts.keepBooking"), style: "cancel" },
        { text: t("mobile:bookingDetail.alerts.confirmCancel"), style: "destructive", onPress: () => void action(() => cancelBooking(bookingId), t("mobile:bookingDetail.alerts.cancelled")) },
      ]);
    } catch (err) { if (mounted.current) setError(getApiErrorMessage(err, t("mobile:bookingDetail.errors.cancelPolicy"))); }
    finally { lock.current = false; if (mounted.current) setBusy(false); }
  }

  if (form && booking) return <InspectionFormScreen booking={booking} reports={reports} type={form} onBack={() => setForm(null)} onSaved={(report) => {
    setReports((items) => [...items.filter((item) => item.type !== report.type), report]); setForm(null);
    setMessage(t("mobile:bookingDetail.alerts.reportSent")); void load();
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
      kicker={booking?.bookingCode || t("mobile:bookingDetail.header.kicker")}
      title={t("mobile:bookingDetail.header.title")}
      onBack={() => { if (!lock.current) onBack(); }}
    />
    {!booking && loading ? <View style={styles.center}><ActivityIndicator color={theme.brand} /><Text style={styles.muted}>{t("mobile:bookingDetail.header.loading")}</Text></View> :
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { if (!lock.current) void load(); }} tintColor={theme.brand} />}>
        {error ? <DetailNotice icon={TriangleAlert} title={t("mobile:bookingDetail.header.loadErrorTitle")} tone="danger">
          {error}
        </DetailNotice> : null}
        {error ? <DetailButton variant="ghost" icon={RotateCcw} label={t("mobile:bookingDetail.header.reload")} disabled={busy} onPress={() => void load()} /> : null}
        {message ? <DetailNotice icon={CircleCheck} title={t("mobile:bookingDetail.header.updated")} tone="mint">{message}</DetailNotice> : null}

        {booking ? <>
          <DetailCard>
            {booking.vehicleImage ? <Image source={{ uri: booking.vehicleImage }} style={styles.vehicleImage} resizeMode="cover" /> : null}
            <View style={styles.heroHead}>
              <View style={styles.heroBody}>
                <Text style={styles.kicker}>{t("mobile:bookingDetail.hero.kicker")}</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>{booking.vehicleName || t("mobile:bookingDetail.hero.vehicleFallback", { id: booking.vehicleId })}</Text>
                <Text style={styles.heroCode} numberOfLines={1}>{booking.bookingCode}</Text>
              </View>
              <DetailPill label={BOOKING_STATUS_LABELS[booking.status] || booking.status} tone={statusTone} />
            </View>
            <View style={styles.stats}>
              <DetailStat icon={CalendarDays} label={t("mobile:bookingDetail.hero.pickup")} value={formatVietnamDateTime(booking.startDate)} />
              <DetailStat icon={CalendarDays} label={t("mobile:bookingDetail.hero.return")} value={formatVietnamDateTime(booking.endDate)} />
              <DetailStat icon={Clock3} label={t("mobile:bookingDetail.hero.duration")} value={t("mobile:bookingDetail.hero.days", { days: booking.totalDays })} tone="brand" />
              <DetailStat icon={Wallet} label={t("mobile:bookingDetail.hero.deposit")} value={formatMoney(booking.depositAmount)} />
            </View>
            <DetailDivider />
            <DetailRow icon={MapPin} label={t("mobile:bookingDetail.hero.pickupPlace")} value={booking.pickupAddress} />
            <DetailRow icon={MapPin} label={t("mobile:bookingDetail.hero.returnPlace")} value={booking.returnAddress || booking.pickupAddress} />
            {booking.customerNote ? (
              <DetailNotice icon={ClipboardCheck} title={t("mobile:bookingDetail.hero.customerNote")} tone="brand">{booking.customerNote}</DetailNotice>
            ) : null}
            <Text style={styles.hint}>{t("mobile:bookingDetail.hero.timezoneHint")}</Text>
          </DetailCard>

          {viewerRole === "Customer" ? (
            <LatePickupWaitCard booking={booking} hasCheckIn={!!reports.find(r => r.type === "CheckIn")} onUpdated={setBooking} />
          ) : null}

          {viewerRole === "Owner" && booking.status === "Pending" ? <DetailCard>
            <DetailSectionHeader
              icon={ClipboardCheck}
              title={t("mobile:bookingDetail.approve.title")}
              subtitle={t("mobile:bookingDetail.approve.subtitle")}
              right={<DetailPill label={formatMoney(booking.totalAmount)} tone="brand" />}
            />
            <View style={styles.actionsRow}>
              <DetailButton icon={CircleCheck} label={t("mobile:bookingDetail.approve.approve")} disabled={loading || !!error} busy={busy} onPress={() => void action(() => approveBooking(bookingId), t("mobile:bookingDetail.approve.approved"))} style={styles.actionsCell} />
              <DetailButton variant="secondary" icon={XCircle} label={t("mobile:bookingDetail.approve.reject")} disabled={busy || loading || !!error} onPress={() => setRejecting(!rejecting)} style={styles.actionsCell} />
            </View>
            {rejecting ? <>
              <BookingField label={t("mobile:bookingDetail.approve.rejectReason")} value={rejectReason} onChangeText={setRejectReason} multiline editable={!busy} />
              <DetailButton variant="danger" icon={XCircle} label={t("mobile:bookingDetail.approve.rejectConfirm")} disabled={!rejectReason.trim() || loading || !!error} busy={busy} onPress={() => void action(() => rejectBooking(bookingId, { reason: rejectReason.trim() }), t("mobile:bookingDetail.approve.rejected"))} />
            </> : null}
          </DetailCard> : null}

          {viewerRole === "Customer" && booking.status === "Approved" ? <DetailCard>
            <DetailSectionHeader icon={Wallet} title={t("mobile:bookingDetail.deposit.title")} subtitle={t("mobile:bookingDetail.deposit.subtitle")} />
            <DetailNotice icon={ShieldCheck} title={t("mobile:bookingDetail.deposit.noticeTitle")} tone="warn">
              {t("mobile:bookingDetail.deposit.noticeBody")}
            </DetailNotice>
            <DetailButton icon={CreditCard} label={t("mobile:bookingDetail.deposit.pay")} busy={busy} disabled={loading || !!error || isDepositExpired(booking, now)} onPress={() => void payDeposit()} />
            {paymentOrder ? <DetailButton variant="secondary" icon={RefreshCw} label={t("mobile:bookingDetail.deposit.check")} busy={busy} onPress={() => void verifyPayment()} /> : null}
          </DetailCard> : null}

          <DetailCard>
            <DetailSectionHeader
              icon={ReceiptText}
              title={t("mobile:bookingDetail.cost.title")}
              subtitle={t("mobile:bookingDetail.cost.subtitle")}
              right={<DetailPill label={formatMoney(booking.totalAmount)} tone="brand" />}
            />
            <DetailRow label={t("mobile:bookingDetail.cost.total")} value={formatMoney(booking.totalAmount)} strong />
            <DetailRow label={t("mobile:bookingDetail.cost.rentalDeposit")} value={formatMoney(booking.depositAmount)} />
            {booking.securityDepositAmount > 0 ? <DetailRow label={t("mobile:bookingDetail.cost.securityDeposit")} value={formatMoney(booking.securityDepositAmount)} /> : null}
            {booking.paymentDueAt && booking.status === "Approved" ? <DetailRow label={t("mobile:bookingDetail.cost.dueAt")} value={formatVietnamDateTime(booking.paymentDueAt)} tone="muted" /> : null}
          </DetailCard>

          <ExtensionRequestPanel booking={booking} onBookingChanged={() => void load()} />
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
                  subtitle={type === "CheckIn" ? t("mobile:bookingDetail.inspection.checkInTitle") : t("mobile:bookingDetail.inspection.checkOutTitle")}
                />
                <Text style={styles.muted}>{type === "CheckIn" ? t("mobile:bookingDetail.inspection.emptyCheckIn") : t("mobile:bookingDetail.inspection.emptyCheckOut")}</Text>
                {state.canCreate ? <DetailButton icon={ClipboardCheck} label={type === "CheckIn" ? t("mobile:bookingDetail.inspection.createCheckIn") : t("mobile:bookingDetail.inspection.createCheckOut")} disabled={busy || loading || !!error} onPress={() => setForm(type)} /> : null}
              </DetailCard>}

              {hasActions ? <DetailCard>
                <DetailSectionHeader
                  icon={type === "CheckIn" ? KeyRound : PackageCheck}
                  title={state.canCreate || state.canConfirm ? (type === "CheckIn" ? t("mobile:bookingDetail.inspection.confirmCheckIn") : t("mobile:bookingDetail.inspection.confirmCheckOut")) : t("mobile:bookingDetail.inspection.actionsTitle")}
                  subtitle={t("mobile:bookingDetail.inspection.actionsSubtitle")}
                />
                {editorCase && state.report ? <CheckoutEditor booking={booking} report={state.report} initialKm={reports.find(r => r.type === "CheckIn")?.odometerKm} onSaved={load} /> : null}
                {state.canCreate && state.report ? <DetailButton icon={ClipboardCheck} label={type === "CheckIn" ? t("mobile:bookingDetail.inspection.createCheckIn") : t("mobile:bookingDetail.inspection.createCheckOut")} disabled={busy || loading || !!error} onPress={() => setForm(type)} /> : null}
                {state.canConfirm ? <>
                  {type === "CheckIn" ? <Text style={styles.muted}>{t("mobile:bookingDetail.inspection.contractNote")}</Text> : null}
                  <DetailButton icon={type === "CheckIn" ? KeyRound : PackageCheck} label={type === "CheckIn" ? t("mobile:bookingDetail.inspection.acceptCheckIn") : t("mobile:bookingDetail.inspection.acceptCheckOut")} busy={busy} disabled={loading || !!error} onPress={() => confirmReport(type)} />
                  {type === "CheckOut" ? <Text style={styles.muted}>{t("mobile:bookingDetail.inspection.checkoutDisagreeHint")}</Text> : null}
                </> : null}
                {revisionCase ? <>
                  <DetailButton variant="secondary" icon={RotateCcw} label={t("mobile:bookingDetail.inspection.revisionAction")} disabled={busy || loading || !!error} onPress={() => { setRevisionReport(state.report!); setRevisionReason(""); }} />
                  {revisionReport ? <>
                    <Text style={styles.muted}>{t("mobile:bookingDetail.inspection.revisionHint")}</Text>
                    <BookingField label={t("mobile:bookingDetail.inspection.revisionReason")} value={revisionReason} onChangeText={value => setRevisionReason(value.slice(0, 1000))} multiline editable={!busy} />
                    <DetailButton icon={Send} label={t("mobile:bookingDetail.inspection.revisionSend")} busy={busy} disabled={!revisionReason.trim() || loading || !!error} onPress={() => void requestRevision()} />
                    <DetailButton variant="ghost" label={t("mobile:bookingDetail.inspection.close")} disabled={busy} onPress={() => setRevisionReport(null)} />
                  </> : null}
                </> : null}
                {noteCase ? <Text style={styles.muted}>
                  {booking.canCheckInNow ? t("mobile:bookingDetail.inspection.earlyPickupAvailable") : booking.checkInUnavailableReason || t("mobile:bookingDetail.inspection.earlyPickupFallback")}
                </Text> : null}
                {type === "CheckIn" && viewerRole === "Customer" && !state.report && booking.status === "DepositPaid" ? <Text style={styles.muted}>{t("mobile:bookingDetail.inspection.waitingPickupReport")}</Text> : null}
                {type === "CheckOut" && viewerRole === "Customer" && !state.report && booking.status === "InProgress" ? <Text style={styles.muted}>{t("mobile:bookingDetail.inspection.waitingReturnReport")}</Text> : null}
              </DetailCard> : null}
            </View>;
          })}

          {viewerRole === "Customer" && ["Pending", "Approved", "DepositPaid"].includes(booking.status) ? <DetailCard>
            <DetailSectionHeader icon={TriangleAlert} title={t("mobile:bookingDetail.cancel.title")} subtitle={t("mobile:bookingDetail.cancel.subtitle")} />
            <DetailButton variant="danger" icon={TriangleAlert} label={t("mobile:bookingDetail.cancel.action")} disabled={busy || loading || !!error} onPress={() => void requestCancel()} />
          </DetailCard> : null}

          {booking.cancelReason ? <DetailCard>
            <DetailSectionHeader icon={TriangleAlert} title={t("mobile:bookingDetail.cancel.reasonTitle")} subtitle={t("mobile:bookingDetail.cancel.reasonSubtitle")} />
            <Text style={styles.muted}>{booking.cancelReason}</Text>
          </DetailCard> : null}

          {booking.statusHistory.length ? <DetailCard>
            <DetailSectionHeader icon={Clock3} title={t("mobile:bookingDetail.history.title")} subtitle={t("mobile:bookingDetail.history.count", { count: booking.statusHistory.length })} />
            {booking.statusHistory.map((entry, index) => <View key={`${entry.createdAt}-${index}`} style={styles.historyRow}>
              <Text style={styles.historyTitle}>{BOOKING_STATUS_LABELS[entry.toStatus] || entry.toStatus} · {formatVietnamDateTime(entry.createdAt)}</Text>
              {entry.note ? <Text style={styles.muted}>{entry.note}</Text> : null}
            </View>)}
          </DetailCard> : null}
        </> : null}
      </ScrollView>}
    <CheckoutConfirmation booking={booking} report={checkoutToConfirm} busy={busy} onClose={() => setCheckoutToConfirm(null)} onConfirm={(report, paymentMethod) => {
      void action(() => confirmCheckOut(bookingId, report.version ?? 1, paymentMethod), t("mobile:bookingDetail.alerts.checkoutConfirmed")).then(() => setCheckoutToConfirm(null));
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
