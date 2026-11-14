import ReportBookingViolation from "../components/ReportBookingViolation";
import { bookingActions } from "../bookingActions";
import InspectionSummaryLink from "../components/InspectionSummaryLink";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import { checkoutStartDate } from "../bookingDisplay";
import { useBookingNotificationRefresh } from "../useBookingNotificationRefresh";
import BookingAssistance from "../components/BookingAssistance";
import ReturnProgress from "../components/ReturnProgress";
import InspectionReportCard from "../components/InspectionReportCard";
import { useFocusEffect } from "@react-navigation/native";
import { useTranslation } from "react-i18next";
import { OutstandingSurcharge } from "../components/CheckoutSummary";import CheckoutConfirmation from "../components/CheckoutConfirmation";
import { isDepositExpired, parseServerDate } from "../bookingDisplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, AppState, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { showAppAlert } from "@/components/appDialog/dialogStore";
import {
  Banknote,
  Camera,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Headphones,
  KeyRound,
  MapPin,
  MessageSquare,
  PackageCheck,
  PauseCircle,
  PlayCircle,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Star,
  TriangleAlert,
  Wallet,
} from "lucide-react-native";
import { detailFont as font, useDetailTheme } from "@/features/vehicles/components/detail/detailTheme";
import {
  DetailButton,
  DetailCard,
  DetailHeader,
  DetailNotice,
  DetailPill,
  DetailRow,
  DetailSectionHeader,
} from "@/features/booking/components/detail/BookingDetailUI";
import BookingSummaryCard from "@/features/booking/components/detail/BookingSummaryCard";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  cancelBooking,
  confirmCheckIn,
  requestCheckInRevision,
  confirmCheckOut,
  getBookingById,
  getBookingCancellationQuote,
  getInspectionReports,
  reportNoShow,
  reportReturn,
} from "@/features/booking/bookingService";
import type { BookingCancellationQuote, BookingResponse, InspectionReportResponse } from "@/features/booking/types";
import { formatDateTime, formatMoney, rentalProgress } from "@/features/booking/utils/format";
import {
  checkPaymentStatus,
  createBookingTopUpLink,
  createPaymentLink,
  getPendingTopUp,
  payDepositWithWallet,
  type BookingTopUpPendingResponse,
} from "@/features/payments/services/paymentService";
import { getMyWallet } from "@/features/wallets/services/walletService";
import { getPendingAutoCancelHours } from "@/features/systemConfig/configService";
import ContractBlock from "@/features/contracts/components/ContractBlock";
import BookingTimeline from "@/features/booking/components/BookingTimeline";
import BookingPricingDetails from "@/features/booking/components/BookingPricingDetails";
import PaymentWebViewModal, { payOsReturnUrl } from "@/features/payments/components/PaymentWebViewModal";
import RiskScoreBadge from "@/features/booking/components/RiskScoreBadge";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import { createCustomerReview, getBookingReviews, hasReviewed, type ReviewResponse } from "@/features/review/reviewService";
import CreateDisputeScreen from "@/features/disputes/screens/CreateDisputeScreen";
import DisputeDetailScreen from "@/features/disputes/screens/DisputeDetailScreen";
import { getApiErrorMessage } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useGpsStore } from "@/features/gps/gpsStore";
import { setGpsSharingConsent } from "@/features/gps/gpsService";
import { clearStoredConsent, setStoredConsent } from "@/features/gps/gpsConsentStorage";
import { getPublicVehicleImages } from "@/features/vehicles/services/publicVehicleService";

type DetailRoute = RouteProp<TripsStackParamList, "TripDetail" | "TripHandover">;
type DetailNav = NativeStackNavigationProp<TripsStackParamList>;

const POLL_MAX = 10;
const POLL_MS = 3000;

export default function TripDetailScreen({
  route,
  navigation,
  onOpenDisputes,
  onOpenUserProfile,
}: {
  route: DetailRoute;
  navigation: DetailNav;
  onOpenDisputes?: (prefill: DisputeCreatePrefill) => void;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  const { p } = useDetailTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { bookingId } = route.params;
  const handover = "inspectionType" in route.params ? route.params.inspectionType : null;
  const handleBack = () => goBackOrFallback(navigation, () => navigation.replace("TripList"));

  const [now, setNow] = useState(Date.now());
  const [checkoutToConfirm, setCheckoutToConfirm] = useState<InspectionReportResponse | null>(null);
  const actionLock = useRef(false);
  const loadId = useRef(0);
  const [dataReady, setDataReady] = useState(false);
  const [actionError, setActionError] = useState("");
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [bookingReviews, setBookingReviews] = useState<ReviewResponse[]>([]);
  const [pendingTopUp, setPendingTopUp] = useState<BookingTopUpPendingResponse | null>(null);
  const [reports, setReports] = useState<InspectionReportResponse[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [cleanliness, setCleanliness] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [support, setSupport] = useState(0);
  const [comment, setComment] = useState("");
  const userId = useAuthStore((s) => s.user?.userId ?? 0);
  const [pendingOrderCode, setPendingOrderCode] = useState<number | null>(null);
  const [paySheet, setPaySheet] = useState<{ checkoutUrl: string; orderCode: number } | null>(null);
  const [cancelQuote, setCancelQuote] = useState<BookingCancellationQuote | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [autoCancelHours, setAutoCancelHours] = useState<number | null>(null);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [revisionReason, setRevisionReason] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [createdDisputeId, setCreatedDisputeId] = useState<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    const request = ++loadId.current;
    try {
      const data = await getBookingById(bookingId);
      // Không reset về null khi poll lại: nếu booking không có ảnh chính thì giữ
      // ảnh đang hiển thị, tránh màn hình nháy placeholder → ảnh mỗi 30 giây.
      setVehiclePhoto((prev) => data.vehicleImage ?? prev);
      if (!data.vehicleImage) {
        void getPublicVehicleImages(data.vehicleId).then((images) => {
          const photo = [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0];
          if (photo?.imageUrl) setVehiclePhoto((prevPhoto) => photo.imageUrl === prevPhoto ? prevPhoto : (prevPhoto ?? photo.imageUrl));
        }).catch(() => undefined);
      }
      const [reviewed, reviewList, topUp, inspectionList] = await Promise.all([
        hasReviewed(bookingId).catch(() => true),
        getBookingReviews(bookingId).catch(() => [] as ReviewResponse[]),
        getPendingTopUp(bookingId).catch(() => null),
        getInspectionReports(bookingId),
      ]);
      if (request !== loadId.current) return;
      setBooking(data); setDataReady(true);
      setAlreadyReviewed(reviewed);
      setBookingReviews(reviewList);
      setPendingTopUp(topUp);
      setReports(inspectionList);
      if (data.status === "Approved") {
        getMyWallet()
          .then((w) => setWalletBalance(w.balance))
          .catch(() => setWalletBalance(null));
      }
      if (data.status === "Pending") {
        getPendingAutoCancelHours()
          .then((h) => setAutoCancelHours(h))
          .catch(() => setAutoCancelHours(24));
      }
    } catch (err) {
      if (request !== loadId.current) return;
      setDataReady(false);
      showAppAlert(t("booking:detail.toast.errorTitle"), getApiErrorMessage(err, t("mobile:trip.detail.loadError")));
    } finally {
      if (request === loadId.current) setLoading(false);
    }
  }, [bookingId, t]);

  useBookingNotificationRefresh(bookingId, useCallback(() => { if (!actionLock.current) void load(); }, [load]));
  useFocusEffect(useCallback(() => { void load(); return () => { loadId.current++; }; }, [load]));

  // Chia sẻ GPS trong chuyến đang thuê: đăng ký booking vào gps store,
  // useGpsPublisher (mount ở CustomerNavigator) sẽ xin quyền và gửi vị trí định kỳ.
  // Hook phải đứng trước mọi return sớm của màn hình.
  const setActivePublishBooking = useGpsStore((state) => state.setActivePublishBooking);
  const gpsPermissionStatus = useGpsStore((state) => state.permissionStatus);
  const gpsPublishError = useGpsStore((state) => state.publishError);
  const gpsSharingHere = useGpsStore((state) => state.activePublishBookingId === bookingId);
  const gpsLastPublishedAt = useGpsStore((state) => state.lastPublishedAt);
  const gpsSharingState = useGpsStore((state) => state.publishSharingState);
  const gpsEnableRequestedAt = useGpsStore((state) => state.gpsEnableRequestedAt);
  const [gpsConsentBusy, setGpsConsentBusy] = useState(false);
  useEffect(() => {
    // Đăng ký GPS CHỈ khi booking đang thuê; khi rời màn KHÔNG gỡ — publisher
    // (mount ở CustomerNavigator) gửi tiếp chừng nào app còn mở, tránh "mất tín hiệu" oan.
    // Publisher tự ngừng khi server trả GPS_BOOKING_NOT_ACTIVE (chuyến đã kết thúc).
    if (!booking) return;
    if (booking.status === "InProgress" || booking.status === "Returning") {
      setActivePublishBooking(booking.id);
    } else {
      // Chuyến đã kết thúc: dọn lựa chọn đã lưu để lần thuê sau hỏi lại từ đầu.
      if (useGpsStore.getState().activePublishBookingId === booking.id) {
        setActivePublishBooking(null);
      }
      void clearStoredConsent(booking.id);
    }
  }, [booking?.id, booking?.status, setActivePublishBooking]);

  // Khách bật/tắt chia sẻ vị trí: ghi nhận phía máy chủ + lưu lựa chọn trên thiết bị.
  const updateGpsConsent = useCallback(async (granted: boolean) => {
    if (gpsConsentBusy) return;
    setGpsConsentBusy(true);
    const nextState = granted ? "sharing" : gpsSharingState === "idle" ? "declined" : "paused";
    try {
      await setGpsSharingConsent(bookingId, granted);
      await setStoredConsent(bookingId, granted ? "granted" : "declined");
      useGpsStore.getState().setPublishSharingState(nextState);
    } catch (error) {
      const code = (error as { response?: { data?: { code?: string } } })?.response?.data?.code;
      if (code === "GPS_13001" || code === "GPS_13003") {
        // Chuyến đã kết thúc: dọn lựa chọn, không hỏi lại.
        await clearStoredConsent(bookingId);
        useGpsStore.getState().setActivePublishBooking(null);
        useGpsStore.getState().setPublishSharingState("ended");
        return;
      }
      // Mất mạng: vẫn ghi nhận lựa chọn trên máy; publisher sẽ gửi lại khi có mạng.
      await setStoredConsent(bookingId, granted ? "granted" : "declined");
      useGpsStore.getState().setPublishSharingState(nextState);
      showAppAlert(t("mobile:trip.detail.gpsConsentErrorTitle"), t("mobile:trip.detail.gpsConsentErrorMessage"));
    } finally {
      setGpsConsentBusy(false);
    }
  }, [bookingId, gpsConsentBusy, gpsSharingState, t]);

  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); if (!actionLock.current) void load(); }, 30000);
    const sub = AppState.addEventListener("change", state => { if (state === "active" && !actionLock.current) void load(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [load]);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, []);

  function pollPayment(orderCode: number, attempt = 1) {
    if (pollTimer.current) clearTimeout(pollTimer.current);
    pollTimer.current = setTimeout(async () => {
      try {
        const res = await checkPaymentStatus(orderCode);
        if (res.isConfirmed) {
          setPendingOrderCode(null);
          showAppAlert(t("booking:detail.toast.successTitle"), res.message || t("mobile:trip.dialogs.depositConfirmed"));
          await load();
          return;
        }
        if (res.status === "Cancelled" || res.status === "Expired" || res.status === "Failed") {
          setPendingOrderCode(null);
          showAppAlert(t("payments:toast.noticeTitle"), res.message || t("mobile:trip.dialogs.transactionEnded"));
          await load();
          return;
        }
      } catch {
        // Mất mạng lúc poll thì thử lại, không báo lỗi vội.
      }
      if (attempt < POLL_MAX) {
        pollPayment(orderCode, attempt + 1);
      } else {
        setPendingOrderCode(null);
        showAppAlert(t("mobile:trip.dialogs.pollTimeoutTitle"), t("mobile:trip.dialogs.pollTimeoutBody"));
        await load();
      }
    }, POLL_MS);
  }

  // User thanh toán xong ở trình duyệt ngoài rồi quay lại app: tự poll trạng thái.
  useEffect(() => {
    if (pendingOrderCode == null) return;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") pollPayment(pendingOrderCode);
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOrderCode]);

  async function runAction(key: string, fn: () => Promise<void>, successMessage?: string): Promise<boolean> {
    if (actionLock.current || !dataReady) return false;
    actionLock.current = true;
    setActionBusy(key);
    setActionError("");
    try {
      await fn();
      await load();
      if (successMessage) showAppAlert(t("booking:detail.toast.successTitle"), successMessage);
      return true;
    } catch (err) {
      const message = getApiErrorMessage(err, t("mobile:trip.dialogs.tryAgain"));
      setActionError(key === "checkout" ? t("mobile:trip.dialogs.checkoutErrorSuffix", { message }) : message);
      showAppAlert(t("mobile:trip.dialogs.failedTitle"), message);
      if (key === "checkout") { setCheckoutToConfirm(null); await load(); }
      return false;
    } finally {
      actionLock.current = false;
      setActionBusy(null);
    }
  }

  async function handlePayWithWallet() {
    await runAction("wallet", async () => {
      await payDepositWithWallet(bookingId);
    }, t("mobile:trip.dialogs.walletDepositSuccess"));
  }

  async function openPayOsCheckout(
    actionKey: string,
    makeLink: (returnUrl: string) => Promise<{ checkoutUrl: string; orderCode: number }>,
  ) {
    if (actionLock.current || !dataReady) return;
    actionLock.current = true;
    setActionBusy(actionKey);
    try {
      // Mở thanh toán ngay trong app (WebView); PayOS redirect về scheme movevn://
      // thì sheet tự đóng, poll phía dưới lo xác nhận. Không nhảy trình duyệt ngoài.
      const link = await makeLink(payOsReturnUrl());
      setPaySheet({ checkoutUrl: link.checkoutUrl, orderCode: link.orderCode });
      setPendingOrderCode(link.orderCode);
      pollPayment(link.orderCode);
    } catch (err) {
      showAppAlert(t("mobile:trip.dialogs.failedTitle"), getApiErrorMessage(err, t("mobile:trip.dialogs.paymentLinkError")));
    } finally {
      actionLock.current = false;
      setActionBusy(null);
    }
  }

  async function handlePayWithPayOs() {
    await openPayOsCheckout("payos", (returnUrl) => createPaymentLink(bookingId, returnUrl));
  }

  async function handlePayTopUp() {
    await openPayOsCheckout("topup", (returnUrl) => createBookingTopUpLink(bookingId, returnUrl));
  }

  async function handleCancel() {
    try {
      const quote = await getBookingCancellationQuote(bookingId);
      if (!quote.canCancel) {
        showAppAlert(t("booking:cancel.loadPolicyErrorTitle"), quote.policyMessage);
        return;
      }
      setCancelQuote(quote);
      setCancelReason("");
    } catch (err) {
      showAppAlert(t("mobile:trip.dialogs.failedTitle"), getApiErrorMessage(err, t("mobile:trip.dialogs.cancelPolicyError")));
    }
  }

  async function submitCancel() {
    if (!cancelQuote) return;
    if (!cancelReason.trim()) {
      showAppAlert(t("mobile:trip.dialogs.cancelReasonRequiredTitle"), t("mobile:trip.dialogs.cancelReasonRequiredBody"));
      return;
    }
    const ok = await runAction("cancel", () => cancelBooking(bookingId, cancelReason.trim()).then(() => undefined));
    if (ok) {
      setCancelQuote(null);
      setCancelReason("");
      showAppAlert(t("booking:detail.toast.successTitle"), t("mobile:trip.dialogs.cancelledMessage"), [
        { text: t("mobile:trip.dialogs.backToList"), onPress: handleBack },
      ]);
    }
  }

  async function handleNoShow() {
    showAppAlert(
      t("mobile:trip.dialogs.noShowTitle"),
      t("mobile:trip.dialogs.noShowBody"),
      [
        { text: t("mobile:trip.dialogs.dismiss"), style: "cancel" },
        {
          text: t("common:confirm"),
          style: "destructive",
          onPress: () => {
            void runAction("noshow", () => reportNoShow(bookingId).then(() => undefined)).then((ok) => {
              if (ok) {
                showAppAlert(t("booking:detail.toast.successTitle"), t("mobile:trip.dialogs.noShowRecorded"), [
                  { text: t("mobile:trip.dialogs.backToList"), onPress: handleBack },
                ]);
              }
            });
          },
        },
      ],
    );
  }

  async function handleReview() {
    if (rating < 1 || rating > 5) {
      showAppAlert(t("mobile:trip.dialogs.ratingMissingTitle"), t("mobile:trip.dialogs.ratingMissingBody"));
      return;
    }
    const ok = await runAction(
      "review",
      () => createCustomerReview({
        bookingId,
        rating,
        cleanlinessScore: cleanliness || undefined,
        accuracyScore: accuracy || undefined,
        supportScore: support || undefined,
        comment: comment.trim() || undefined,
      }).then(() => undefined),
      t("mobile:trip.dialogs.reviewThanks"),
    );
    if (ok) setReviewOpen(false);
  }

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <DetailHeader
          kicker={handover ? t("mobile:trip.detail.handoverKicker") : undefined}
          title={handover ? (handover === "CheckIn" ? t("booking:detail.handoverCheckIn") : t("booking:detail.handoverCheckOut")) : t("mobile:trip.detail.title")}
          onBack={handleBack}
        />
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={theme.brand} /> : <Text style={styles.muted}>{t("mobile:trip.detail.loadFailed")}</Text>}
        </View>
      </View>
    );
  }


  if (disputeOpen) return createdDisputeId
    ? <DisputeDetailScreen disputeId={createdDisputeId} onBack={() => { setDisputeOpen(false); setCreatedDisputeId(null); void load(); }} />
    : <CreateDisputeScreen role="Customer" initial={{ bookingId, reportType: "Other", description: t("mobile:trip.detail.disputePrefill") }} onBack={() => setDisputeOpen(false)} onCreated={id => { setCreatedDisputeId(id); void load(); }} />;

  const status = booking.status;
  const actions = bookingActions(booking, reports, "Customer", now);
  const checkInReport = reports.find(r => r.type === "CheckIn");
  const checkOutReport = reports.find(r => r.type === "CheckOut");
  const pickupReached = parseServerDate(checkoutStartDate(booking)).getTime() <= now;
  const depositExpired = isDepositExpired(booking, now);
  const canCancel = actions.cancel;
  const progress = status === "InProgress" || status === "Returning"
    ? rentalProgress(booking.startDate, booking.endDate)
    : null;
  const remainingAmount = Math.max(0, booking.totalAmount - booking.depositAmount);
  const progressPercent = progress ? Math.min(100, Math.max(0, Math.round((progress.elapsedDays / progress.totalDays) * 100))) : 0;
  const activeHandoverReport = handover === "CheckIn" ? checkInReport : checkOutReport;

  const checkInActions = <>
    {(status === "DepositPaid" || status === "Confirmed") && (
      <>
        {status === "DepositPaid" && booking.canCheckInNow === true && !pickupReached ? (
          <DetailNotice icon={Clock3} title={t("mobile:trip.detail.earlyPickupTitle")} tone="brand">
            {t("mobile:trip.detail.earlyPickupBody")}
          </DetailNotice>
        ) : null}
        {actions.confirmCheckIn && checkInReport ? (
          <DetailButton
            icon={KeyRound}
            label={t("booking:inspection.agreeAndPickup")}
            onPress={() => runAction("checkin", () => confirmCheckIn(bookingId, checkInReport.version ?? 1).then(() => undefined), t("mobile:trip.detail.confirmPickupSuccess"))}
            disabled={!dataReady || actionBusy !== null}
          />
        ) : (
          <Text style={styles.hint}>{booking.checkInUnavailableReason || t("mobile:trip.detail.waitingPickupReport")}</Text>
        )}
        {checkInReport && !checkInReport.isCustomerConfirmed ? checkInReport.requiresRevision ? (
          <DetailNotice icon={TriangleAlert} title={t("mobile:trip.detail.revisionRequestedTitle")} tone="warn">
            {t("mobile:trip.detail.revisionRequestedBody", { reason: checkInReport.revisionReason })}
          </DetailNotice>
        ) : (
          <DetailButton
            variant="secondary"
            icon={TriangleAlert}
            label={t("mobile:trip.detail.disagreeRequestRevision")}
            disabled={!dataReady || actionBusy !== null}
            onPress={() => { setRevisionReason(""); setRevisionOpen(true); }}
          />
        ) : null}
        {actions.reportNoShow ? (
          <DetailButton
            variant="ghost"
            icon={TriangleAlert}
            label={t("mobile:trip.detail.ownerNoShow")}
            onPress={handleNoShow}
            disabled={!dataReady || actionBusy !== null}
          />
        ) : null}
      </>
    )}
  </>;
  const checkOutActions = <>
    {actions.reportReturn && (
      <DetailButton
        icon={PackageCheck}
        label={t("mobile:trip.detail.reportReturned")}
        onPress={() => runAction("report", () => reportReturn(bookingId).then(() => undefined), t("mobile:trip.detail.reportReturnedSuccess"))}
        disabled={!dataReady || actionBusy !== null}
      />
    )}

    {actions.confirmCheckOut && checkOutReport && (
      <>
        <DetailNotice icon={ShieldCheck} title={t("mobile:trip.detail.checkoutConsentTitle")} tone="brand">
          {t("mobile:trip.detail.checkoutConsent")}
        </DetailNotice>
        <DetailButton
          label={t("booking:inspection.reviewAndConfirmReturn")}
          onPress={() => setCheckoutToConfirm(checkOutReport)}
          disabled={!dataReady || actionBusy !== null}
        />
      </>
    )}
    {actions.disputeCheckOut && (
      <DetailButton
        variant="ghost"
        icon={TriangleAlert}
        label={t("mobile:trip.detail.disputeCheckout")}
        onPress={() => {
          setCreatedDisputeId(null);
          setDisputeOpen(true);
        }}
        disabled={actionBusy !== null}
      />
    )}

    <ReturnProgress booking={booking} report={checkOutReport} role="Customer" />
    <OutstandingSurcharge booking={booking} report={checkOutReport} role="Customer" onUpdated={load} onOpenWallet={() => navigation.navigate("BookingWallet")} />
  </>;

  return (
    <View style={styles.screen}>
      {handover ? (
        <>
          <DetailHeader
            kicker={t("mobile:trip.detail.handoverKicker")}
            title={handover === "CheckIn" ? t("booking:detail.handoverCheckIn") : t("booking:detail.handoverCheckOut")}
            onBack={handleBack}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("mobile:trip.detail.chatWithOwner")}
                onPress={() => navigation.navigate("BookingChat", { bookingId })}
                style={styles.headerChat}
              >
                <MessageSquare color={p.brand} size={18} strokeWidth={2.1} />
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <DetailCard>
              <View style={styles.handoverHead}>
                <View style={[styles.handoverIcon, { backgroundColor: handover === "CheckIn" ? p.brandSoft : p.mintSoft }]}>
                  {handover === "CheckIn"
                    ? <KeyRound color={p.brand} size={20} strokeWidth={2.1} />
                    : <PackageCheck color={p.mint} size={20} strokeWidth={2.1} />}
                </View>
                <View style={styles.handoverBody}>
                  <Text style={styles.handoverCode}>{booking.bookingCode}</Text>
                  <Text style={styles.handoverVehicle} numberOfLines={1}>{booking.vehicleName || t("booking:list.vehicleFallback", { id: booking.vehicleId })}</Text>
                </View>
                <DetailPill
                  label={activeHandoverReport ? (activeHandoverReport.isCustomerConfirmed ? t("booking:status.confirmed") : activeHandoverReport.requiresRevision ? t("mobile:trip.detail.reportStatusRevision") : t("mobile:trip.detail.reportStatusAwaiting")) : t("booking:detail.noReport")}
                  tone={activeHandoverReport ? (activeHandoverReport.isCustomerConfirmed ? "mint" : activeHandoverReport.requiresRevision ? "danger" : "warn") : "neutral"}
                />
              </View>
              <DetailButton variant="ghost" icon={RotateCcw} label={t("mobile:trip.detail.reloadReport")} disabled={actionBusy !== null} onPress={() => void load()} />
            </DetailCard>

            {!!actionError && <DetailNotice icon={TriangleAlert} title={t("mobile:trip.detail.actionErrorTitle")} tone="danger">{actionError}</DetailNotice>}
            {!dataReady && <DetailNotice icon={TriangleAlert} title={t("mobile:trip.detail.staleTitle")} tone="warn">{t("mobile:trip.detail.staleBodyHandover")}</DetailNotice>}

            {activeHandoverReport ? <InspectionReportCard booking={booking} report={activeHandoverReport} /> : (
              <DetailCard>
                <DetailSectionHeader
                  icon={handover === "CheckIn" ? KeyRound : PackageCheck}
                  title={t("booking:detail.noReport")}
                  subtitle={t("mobile:trip.detail.reportPlaceholderSubtitle")}
                />
                <Text style={styles.hint}>{t("mobile:trip.detail.reportPlaceholderHint")}</Text>
              </DetailCard>
            )}

            <DetailCard>
              <DetailSectionHeader
                icon={handover === "CheckIn" ? KeyRound : PackageCheck}
                tone={handover === "CheckIn" ? "brand" : "mint"}
                title={handover === "CheckIn" ? t("mobile:trip.detail.confirmPickupTitle") : t("mobile:trip.detail.confirmReturnTitle")}
                subtitle={t("mobile:trip.detail.confirmHandoverSubtitle")}
              />
              {handover === "CheckIn" ? checkInActions : checkOutActions}
            </DetailCard>
          </ScrollView>
        </>
      ) : (
        <>
          <DetailHeader
            title={t("mobile:trip.detail.title")}
            onBack={handleBack}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("mobile:trip.detail.chatWithOwner")}
                onPress={() => navigation.navigate("BookingChat", { bookingId })}
                style={styles.headerChat}
              >
                <MessageSquare color={p.brand} size={18} strokeWidth={2.1} />
              </Pressable>
            }
          />
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <BookingSummaryCard
            booking={booking}
            imageUri={vehiclePhoto}
            onOpenVehicle={() => navigation.navigate("VehicleDetail", { vehicleId: booking.vehicleId })}
            onOpenUserProfile={(userId) => navigation.navigate("BookingUserProfile", { userId })}
          />

          <View style={styles.body}>
            {actionError ? <DetailNotice icon={TriangleAlert} title={t("mobile:trip.detail.actionErrorTitle")} tone="danger">{actionError}</DetailNotice> : null}
            {!dataReady ? <DetailNotice icon={TriangleAlert} title={t("mobile:trip.detail.staleTitle")} tone="warn">{t("mobile:trip.detail.staleBody")}</DetailNotice> : null}

            <View style={styles.toolbarRow}>
              <DetailButton variant="ghost" icon={RotateCcw} label={t("mobile:trip.detail.reload")} disabled={actionBusy !== null} onPress={() => void load()} style={styles.toolbarButton} />
              {onOpenDisputes ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenDisputes({ bookingId: booking.id })}
                  style={({ pressed }) => [styles.disputeButton, pressed && styles.pressed]}
                >
                  <TriangleAlert color={p.danger} size={15} strokeWidth={2.1} />
                  <Text style={styles.disputeLink}>{t("mobile:trip.detail.dispute")}</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.statusChips}>
              {booking.escrowStatus === "Held" ? <DetailPill label={t("mobile:trip.detail.escrowHold", { amount: formatMoney(booking.escrowAmount) })} tone="mint" /> : null}
              <RiskScoreBadge score={booking.riskScore} />
            </View>

            {progress ? (
              <DetailCard style={styles.progressCard}>
                <View style={styles.progressHead}>
                  <View style={styles.progressTitleWrap}>
                    <View style={styles.progressIcon}>
                      <Clock3 color={p.brand} size={15} strokeWidth={2.1} />
                    </View>
                    <Text style={styles.progressTitle}>{progress.overdue ? t("mobile:trip.progress.titleOverdue") : t("mobile:trip.progress.titleActive")}</Text>
                  </View>
                  <DetailPill label={progress.overdue ? t("mobile:trip.progress.overduePill") : t("mobile:trip.progress.dayPill", { day: progress.currentDay, total: progress.totalDays })} tone={progress.overdue ? "danger" : "brand"} />
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }, progress.overdue && styles.progressFillOverdue]} />
                </View>
                <Text style={styles.progressText}>{progress.summary}</Text>
              </DetailCard>
            ) : null}

            {(status === "InProgress" || status === "Returning") && gpsSharingHere && gpsSharingState !== "idle" && gpsSharingState !== "ended" ? (
              gpsSharingState === "sharing" ? (
                gpsPermissionStatus === "denied" || gpsPublishError ? (
                  <DetailCard>
                    <DetailSectionHeader
                      icon={TriangleAlert}
                      tone="amber"
                      title={t("mobile:trip.detail.gpsOffTitle")}
                      subtitle={gpsPublishError || t("mobile:trip.detail.gpsOffBody")}
                    />
                    <DetailButton
                      label={t("mobile:trip.detail.gpsStop")}
                      icon={PauseCircle}
                      variant="secondary"
                      onPress={() => void updateGpsConsent(false)}
                      busy={gpsConsentBusy}
                    />
                  </DetailCard>
                ) : (
                  <DetailCard>
                    <DetailSectionHeader
                      icon={MapPin}
                      tone="mint"
                      title={t("mobile:trip.detail.gpsSharingTitle")}
                      subtitle={`${t("mobile:trip.detail.gpsSharingBody")}${gpsLastPublishedAt ? t("mobile:trip.detail.gpsUpdatedAt", { time: new Date(gpsLastPublishedAt).toLocaleTimeString("vi-VN") }) : ""}.`}
                    />
                    <DetailButton
                      label={t("mobile:trip.detail.gpsStop")}
                      icon={PauseCircle}
                      variant="secondary"
                      onPress={() => void updateGpsConsent(false)}
                      busy={gpsConsentBusy}
                    />
                  </DetailCard>
                )
              ) : (
                <DetailCard>
                  <DetailSectionHeader
                    icon={MapPin}
                    tone="amber"
                    title={gpsSharingState === "paused"
                      ? t("mobile:trip.detail.gpsPausedTitle")
                      : gpsSharingState === "declined"
                        ? t("mobile:trip.detail.gpsDeclinedTitle")
                        : t("mobile:trip.detail.gpsNotSharedTitle")}
                    subtitle={gpsSharingState === "paused"
                      ? t("mobile:trip.detail.gpsPausedBody")
                      : gpsSharingState === "declined"
                        ? t("mobile:trip.detail.gpsDeclinedBody")
                        : t("mobile:trip.detail.gpsNotSharedBody")}
                  />
                  <DetailButton
                    label={gpsSharingState === "paused" ? t("mobile:trip.detail.gpsResume") : t("mobile:trip.detail.gpsEnable")}
                    icon={PlayCircle}
                    onPress={() => void updateGpsConsent(true)}
                    busy={gpsConsentBusy}
                  />
                </DetailCard>
              )
            ) : null}
            {(status === "InProgress" || status === "Returning") && gpsSharingHere && gpsEnableRequestedAt && gpsSharingState !== "sharing" ? (
              <DetailNotice icon={MapPin} title={t("mobile:trip.detail.gpsRequestedTitle")} tone="brand">
                {t("mobile:trip.detail.gpsRequestedBody")}
              </DetailNotice>
            ) : null}

            {status === "Pending" && autoCancelHours != null && booking.createdAt ? (
              <DetailNotice icon={Clock3} title={t("mobile:trip.detail.pendingTitle")} tone="warn">
                {t("mobile:trip.detail.pendingBody", {
                  hours: autoCancelHours,
                  time: formatDateTime(new Date(new Date(booking.createdAt).getTime() + autoCancelHours * 3600000).toISOString()),
                })}
              </DetailNotice>
            ) : null}

            <DetailCard>
              <DetailSectionHeader icon={MapPin} title={t("mobile:trip.detail.placesTitle")} subtitle={t("mobile:trip.detail.placesSubtitle")} />
              <View style={styles.placeBlock}>
                <View style={styles.placeRail}><View style={styles.placeDotBrand} /><View style={styles.placeLine} /></View>
                <View style={styles.placeBody}>
                  <Text style={styles.placeLabel}>{t("mobile:trip.detail.pickupPoint")}</Text>
                  <Text style={styles.placeAddress}>{booking.pickupAddress}</Text>
                  <Text style={styles.hint}>{t("mobile:trip.detail.expectedAt", { time: formatDateTime(booking.startDate) })}</Text>
                  {booking.deliveryDistanceKm != null ? (
                    <Text style={styles.hint}>
                      {t("mobile:trip.detail.vehicleDistance", { km: booking.deliveryDistanceKm })}
                      {booking.deliveryFee > 0
                        ? t("mobile:trip.detail.deliveryFeeSuffix", { amount: formatMoney(booking.deliveryFee) })
                        : t("mobile:trip.detail.deliveryFreeSuffix")}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.placeBlock}>
                <View style={styles.placeRail}><View style={styles.placeDotInk} /></View>
                <View style={styles.placeBody}>
                  <Text style={styles.placeLabel}>{t("mobile:trip.detail.returnPoint")}</Text>
                  <Text style={styles.placeAddress}>{booking.returnAddress || booking.pickupAddress}</Text>
                  <Text style={styles.hint}>{t("mobile:trip.detail.expectedAt", { time: formatDateTime(booking.endDate) })}</Text>
                </View>
              </View>
              {booking.customerNote ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>{t("mobile:trip.detail.yourNote")}</Text>
                  <Text style={styles.noteText}>{booking.customerNote}</Text>
                </View>
              ) : null}
            </DetailCard>

            <DetailCard>
              <DetailSectionHeader icon={ReceiptText} title={t("mobile:trip.detail.costTitle")} subtitle={t("mobile:trip.detail.costSubtitle")} />
              <View style={styles.rows}>
                <DetailRow label={t("mobile:trip.detail.rentalPriceDays", { days: booking.totalDays })} value={formatMoney(booking.basePrice)} />
                {booking.discountPercent > 0 ? <DetailRow label={t("booking:detail.discount", { percent: booking.discountPercent })} value={`-${formatMoney(booking.discountAmount)}`} tone="success" /> : null}
                {booking.promotionDiscount > 0 ? <DetailRow label={t("booking:detail.promoCode", { code: booking.promotionCode ?? "" })} value={`-${formatMoney(booking.promotionDiscount)}`} tone="success" /> : null}
                {booking.deliveryFee > 0 ? <DetailRow label={booking.deliveryDistanceKm != null ? t("booking:detail.deliveryFeeWithKm", { km: booking.deliveryDistanceKm }) : t("booking:detail.deliveryFee")} value={`+${formatMoney(booking.deliveryFee)}`} /> : null}
                <DetailRow label={t("mobile:trip.detail.platformFeeIncluded")} value={formatMoney(booking.platformFee)} tone="muted" />
              </View>
              <View style={styles.totalRow}>
                <View style={styles.totalBody}>
                  <Text style={styles.totalLabel}>{t("booking:create.total")}</Text>
                  <Text style={styles.totalHint}>{t("mobile:trip.detail.totalHint")}</Text>
                </View>
                <Text style={styles.totalValue}>{formatMoney(booking.totalAmount)}</Text>
              </View>
              <View style={styles.scheduleBox}>
                <Text style={styles.scheduleTitle}>{t("mobile:trip.detail.paymentScheduleTitle")}</Text>
                <View style={styles.scheduleRow}>
                  <Text style={styles.scheduleLabel}>{t("mobile:trip.detail.depositNow")}</Text>
                  <Text style={styles.scheduleValue}>{formatMoney(booking.depositAmount)}</Text>
                </View>
                {remainingAmount > 0 ? (
                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleLabel}>{t("booking:create.payOnPickup")}</Text>
                    <Text style={styles.scheduleValue}>{formatMoney(remainingAmount)}</Text>
                  </View>
                ) : null}
              </View>
              {booking.securityDepositAmount > 0 ? (
                <View style={[styles.securityBox, { borderColor: p.warningBorder, backgroundColor: p.warningSoft }]}>
                  <ShieldCheck color={p.warning} size={16} strokeWidth={2.1} />
                  <View style={styles.securityBody}>
                    <Text style={styles.securityLabel}>{t("mobile:trip.detail.securityLabel")}</Text>
                    <Text style={styles.securityHint}>{t("mobile:trip.detail.securityHint")}</Text>
                  </View>
                  <Text style={[styles.securityValue, { color: p.warning }]}>{formatMoney(booking.securityDepositAmount)}</Text>
                </View>
              ) : null}
              <BookingPricingDetails booking={booking} />
            </DetailCard>

            {(booking.outstandingSurchargeAmount ?? 0) > 0 ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={CircleDollarSign}
                  title={t("mobile:trip.detail.outstandingTitle")}
                  subtitle={t("mobile:trip.detail.outstandingSubtitle")}
                  right={<DetailPill label={formatMoney(booking.outstandingSurchargeAmount ?? 0)} tone="danger" />}
                />
                <DetailNotice icon={TriangleAlert} title={t("mobile:trip.detail.outstandingNoticeTitle")} tone="danger">
                  {t("mobile:trip.detail.outstandingNoticeBody", { amount: formatMoney(booking.outstandingSurchargeAmount) })}
                </DetailNotice>
              </DetailCard>
            ) : null}

            {pendingTopUp != null && pendingTopUp.amount > 0 ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={Wallet}
                  title={t("mobile:trip.detail.topUpTitle")}
                  subtitle={pendingTopUp.dueAt ? t("mobile:trip.detail.topUpDue", { time: formatDateTime(pendingTopUp.dueAt) }) : t("mobile:trip.detail.topUpKeepSchedule")}
                  right={<DetailPill label={formatMoney(pendingTopUp.amount)} tone="warn" />}
                />
                <Text style={styles.muted}>
                  {t("mobile:trip.detail.topUpBody", {
                    amount: formatMoney(pendingTopUp.amount),
                    due: pendingTopUp.dueAt ? t("mobile:trip.detail.topUpBeforeDue", { time: formatDateTime(pendingTopUp.dueAt) }) : "",
                  })}
                </Text>
                <DetailButton
                  icon={Wallet}
                  label={actionBusy === "topup" ? t("mobile:trip.detail.creatingLink") : t("mobile:trip.detail.topUpPay")}
                  onPress={handlePayTopUp}
                  disabled={!dataReady || actionBusy !== null}
                />
              </DetailCard>
            ) : null}

            {status === "Approved" ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={Banknote}
                  title={t("mobile:trip.detail.depositTitle")}
                  subtitle={booking.paymentDueAt ? t("mobile:trip.detail.depositDueSubtitle", { time: formatDateTime(booking.paymentDueAt) }) : t("mobile:trip.detail.depositKeepTrip")}
                  right={<DetailPill label={formatMoney(booking.depositAmount)} tone="brand" />}
                />
                {booking.paymentDueAt ? <Text style={styles.muted}>{t("mobile:trip.detail.depositDueLine", { time: formatDateTime(booking.paymentDueAt) })}</Text> : null}
                {depositExpired ? (
                  <DetailNotice icon={TriangleAlert} title={t("mobile:trip.detail.depositExpiredTitle")} tone="danger">
                    {t("mobile:trip.detail.depositExpiredBody")}
                  </DetailNotice>
                ) : (
                  <>
                    <DetailButton
                      icon={Wallet}
                      label={actionBusy === "wallet"
                        ? t("mobile:trip.detail.payingWallet")
                        : walletBalance != null
                          ? t("mobile:trip.detail.payWithWalletAmount", { amount: formatMoney(walletBalance) })
                          : t("booking:detail.payRemainingWallet")}
                      onPress={handlePayWithWallet}
                      disabled={!dataReady || actionBusy !== null}
                    />
                    <DetailButton
                      variant="secondary"
                      icon={CreditCard}
                      label={actionBusy === "payos" ? t("mobile:trip.detail.creatingLink") : t("mobile:trip.detail.payWithPayOS")}
                      onPress={handlePayWithPayOs}
                      disabled={!dataReady || actionBusy !== null}
                    />
                    {pendingOrderCode != null ? (
                      <Text style={styles.muted}>{t("mobile:trip.detail.awaitingTransfer", { code: pendingOrderCode })}</Text>
                    ) : null}
                  </>
                )}
              </DetailCard>
            ) : null}

            {canCancel ? (
              <DetailButton
                variant="danger"
                icon={TriangleAlert}
                label={t("mobile:trip.detail.cancelTrip")}
                onPress={handleCancel}
                disabled={!dataReady || actionBusy !== null}
              />
            ) : null}

            <OutstandingSurcharge booking={booking} report={checkOutReport} role="Customer" onUpdated={load} onOpenWallet={() => navigation.navigate("BookingWallet")} />

            <ContractBlock bookingStatus={booking.status} bookingId={booking.id} userId={userId} canManage={false} onChanged={() => load()} />

            <DetailCard>
              <DetailSectionHeader icon={Camera} title={t("mobile:trip.detail.handoverKicker")} subtitle={t("mobile:trip.detail.handoverSectionSubtitle")} />
              <InspectionSummaryLink booking={booking} type="CheckIn" report={checkInReport} onPress={() => navigation.navigate("TripHandover", { bookingId, inspectionType: "CheckIn" })} />
              <InspectionSummaryLink booking={booking} type="CheckOut" report={checkOutReport} divider onPress={() => navigation.navigate("TripHandover", { bookingId, inspectionType: "CheckOut" })} />
            </DetailCard>

            {(status === "Cancelled" || status === "Rejected") && booking.cancelReason ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={TriangleAlert}
                  title={status === "Rejected" ? t("mobile:trip.detail.cancelReasonRejected") : t("booking:cancel.reasonLabel")}
                  subtitle={t("mobile:trip.detail.cancelReasonSubtitle")}
                />
                <Text style={styles.muted}>{booking.cancelReason}</Text>
              </DetailCard>
            ) : null}

            {status === "Completed" ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={Star}
                  title={t("booking:detail.reviewTripTitle")}
                  subtitle={alreadyReviewed ? t("mobile:trip.detail.reviewThanksSubtitle") : t("mobile:trip.detail.reviewShareSubtitle")}
                />
                {!alreadyReviewed ? (
                  <View style={styles.reviewPrompt}>
                    <Text style={[styles.reviewPromptStars, { color: p.rating }]}>★★★★★</Text>
                    <Text style={styles.muted}>{t("mobile:trip.detail.notReviewed")}</Text>
                    <DetailButton
                      icon={Star}
                      label={t("booking:detail.writeReview")}
                      onPress={() => setReviewOpen(true)}
                      disabled={!dataReady || actionBusy !== null}
                    />
                  </View>
                ) : null}
                {bookingReviews.filter((review) => review.reviewType === "Customer").map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      {review.reviewerAvatar ? <Image source={{ uri: review.reviewerAvatar }} style={styles.reviewAvatar} /> : <View style={styles.reviewAvatarFallback}><Text style={styles.reviewAvatarText}>{(review.reviewerName || t("booking:detail.roleCustomer")).slice(0, 1).toUpperCase()}</Text></View>}
                      <View style={{ flex: 1 }}><Text style={styles.reviewName}>{review.reviewerName || t("booking:detail.roleCustomer")}</Text><Text style={styles.reviewStars}>{"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}</Text></View>
                      <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString("vi-VN")}</Text>
                    </View>
                    {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                  </View>
                ))}
                {alreadyReviewed && bookingReviews.filter((review) => review.reviewType === "Customer").length === 0 ? <Text style={styles.muted}>{t("booking:detail.reviewSubmitted")}</Text> : null}
              </DetailCard>
            ) : null}

            <DetailCard>
              <DetailSectionHeader icon={Headphones} title={t("mobile:trip.detail.supportTitle")} subtitle={t("mobile:trip.detail.supportSubtitle")} />
              <BookingAssistance key={booking.id} bookingId={booking.id} bookingCode={booking.bookingCode} />
              <ReportBookingViolation key={`violation-${booking.id}`} bookingId={booking.id} bookingCode={booking.bookingCode} />
            </DetailCard>

            <BookingTimeline history={booking.statusHistory} />

          </View>
        </ScrollView>
        </>
      )}

      <CheckoutConfirmation booking={booking} report={checkoutToConfirm} busy={actionBusy !== null} onClose={() => setCheckoutToConfirm(null)} onConfirm={(report, paymentMethod) => {
        void runAction("checkout", () => confirmCheckOut(bookingId, report.version ?? 1, paymentMethod).then(() => undefined), t("mobile:trip.dialogs.checkoutConfirmed")).then(ok => { if (ok) setCheckoutToConfirm(null); });
      }} />

      <Modal
        visible={gpsSharingHere && gpsSharingState === "idle" && (status === "InProgress" || status === "Returning")}
        transparent
        animationType="fade"
        onRequestClose={() => useGpsStore.getState().setPublishSharingState("notShared")}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <View style={styles.modalIcon}><MapPin color={p.brand} size={18} strokeWidth={2.1} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("mobile:trip.detail.gpsConsentTitle")}</Text>
                <Text style={styles.modalHint}>{t("mobile:trip.detail.gpsConsentPrivacy")}</Text>
              </View>
            </View>
            <Text style={styles.progressText}>{t("mobile:trip.detail.gpsConsentBody")}</Text>
            <View style={styles.modalActions}>
              <DetailButton
                style={styles.modalButton}
                variant="ghost"
                label={t("mobile:trip.detail.gpsConsentDecline")}
                onPress={() => void updateGpsConsent(false)}
                disabled={gpsConsentBusy}
              />
              <DetailButton
                style={styles.modalButton}
                label={t("mobile:trip.detail.gpsConsentAgree")}
                onPress={() => void updateGpsConsent(true)}
                busy={gpsConsentBusy}
              />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => { if (actionBusy === null) setReviewOpen(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <View style={styles.modalIcon}><Star color={p.brand} size={18} strokeWidth={2.1} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("booking:detail.reviewTripTitle")}</Text>
                <Text style={styles.modalHint}>{t("mobile:trip.detail.reviewShareSubtitle")}</Text>
              </View>
            </View>
            <RatingInput label={t("mobile:trip.review.overallRequired")} value={rating} onChange={setRating} styles={styles} />
            <RatingInput label={t("mobile:trip.review.cleanlinessOptional")} value={cleanliness} onChange={setCleanliness} styles={styles} />
            <RatingInput label={t("mobile:trip.review.accuracyOptional")} value={accuracy} onChange={setAccuracy} styles={styles} />
            <RatingInput label={t("mobile:trip.review.supportOptional")} value={support} onChange={setSupport} styles={styles} />
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={t("booking:detail.reviewCommentPlaceholderCustomer")}
              placeholderTextColor={theme.placeholder}
              multiline
              style={styles.commentInput}
            />
            <View style={styles.modalActions}>
              <DetailButton variant="ghost" label={t("common:closeAction")} disabled={actionBusy !== null} onPress={() => setReviewOpen(false)} style={styles.modalButton} />
              <DetailButton icon={Star} label={actionBusy === "review" ? t("mobile:trip.review.submitting") : t("booking:detail.submitReview")} onPress={handleReview} disabled={!dataReady || actionBusy !== null || rating === 0} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={viewingImage !== null} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <Pressable style={styles.fullBackdrop} onPress={() => setViewingImage(null)}>
          {viewingImage ? (
            <Image source={{ uri: viewingImage }} style={styles.fullImage} resizeMode="contain" />
          ) : null}
          <Text style={styles.fullHint}>{t("mobile:trip.dialogs.tapToClose")}</Text>
        </Pressable>
      </Modal>

      <Modal visible={cancelQuote !== null} transparent animationType="fade" onRequestClose={() => setCancelQuote(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <View style={[styles.modalIcon, { backgroundColor: p.dangerSoft }]}><TriangleAlert color={p.danger} size={18} strokeWidth={2.1} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>{t("mobile:trip.detail.cancelTrip")}</Text>
                <Text style={styles.modalHint}>{t("mobile:trip.dialogs.cancelModalHint")}</Text>
              </View>
            </View>
            {cancelQuote ? (
              <>
                <Text style={styles.muted}>{cancelQuote.policyMessage}</Text>
                <Text style={styles.muted}>
                  {cancelQuote.hasPaidDeposit
                    ? t("mobile:trip.dialogs.cancelRefundLine", {
                      refund: formatMoney(cancelQuote.refundAmount),
                      percent: cancelQuote.refundPercent,
                      forfeited: formatMoney(cancelQuote.forfeitedAmount),
                    })
                    : t("mobile:trip.dialogs.cancelFree")}
                </Text>
              </>
            ) : null}
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder={t("mobile:trip.dialogs.cancelReasonPlaceholder")}
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />
            <View style={styles.modalActions}>
              <DetailButton variant="ghost" label={t("common:closeAction")} onPress={() => setCancelQuote(null)} style={styles.modalButton} />
              <DetailButton variant="danger" label={t("booking:cancel.confirm")} busy={actionBusy === "cancel"} disabled={actionBusy !== null} onPress={submitCancel} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={revisionOpen} transparent animationType="fade" onRequestClose={() => { if (!actionBusy) setRevisionOpen(false); }}>
        <View style={styles.modalBackdrop}><View style={styles.modal}>
          <View style={styles.modalHead}>
            <View style={styles.modalIcon}><RotateCcw color={p.brand} size={18} strokeWidth={2.1} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.modalTitle}>{t("mobile:trip.dialogs.revisionTitle")}</Text>
              <Text style={styles.modalHint}>{t("mobile:trip.dialogs.revisionSubtitle")}</Text>
            </View>
          </View>
          <Text style={styles.muted}>{t("mobile:trip.dialogs.revisionBody")}</Text>
          <TextInput accessibilityLabel={t("mobile:trip.dialogs.revisionReasonAria")} value={revisionReason} onChangeText={setRevisionReason} maxLength={1000} editable={!actionBusy} placeholder={t("booking:inspection.revisionReasonPlaceholder")} placeholderTextColor={theme.placeholder} multiline style={[styles.input, styles.multiline]} />
          <DetailButton label={t("booking:inspection.revisionSubmit")} disabled={!revisionReason.trim() || !dataReady || actionBusy !== null} onPress={() => {
            if (!checkInReport) return;
            void runAction("revision", () => requestCheckInRevision(bookingId, checkInReport.version ?? 1, revisionReason.trim()).then(() => undefined), t("mobile:trip.dialogs.revisionSent")).then(ok => { if (ok) setRevisionOpen(false); });
          }} />
          <DetailButton variant="secondary" label={t("common:closeAction")} disabled={actionBusy !== null} onPress={() => setRevisionOpen(false)} />
        </View></View>
      </Modal>
      <PaymentWebViewModal
        checkoutUrl={paySheet?.checkoutUrl ?? null}
        onClose={() => {
          setPaySheet(null);
          void load();
        }}
      />
    </View>
  );
}


function RatingInput({
  label,
  value,
  onChange,
  styles,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View>
      <Text style={styles.muted}>{label}</Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map((s) => (
          <Pressable key={s} onPress={() => onChange(s)} style={styles.star}>
            <Text style={[styles.starText, s <= value && styles.starActive]}>★</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
    scrollContent: { paddingBottom: 40 },
    body: { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 40, gap: 10 },

    pressed: { opacity: 0.72 },
    headerChat: {
      width: 38,
      height: 38,
      borderRadius: 19,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
      borderWidth: 1,
      borderColor: theme.brandBorder,
    },

    // Toolbar
    toolbarRow: { flexDirection: "row", alignItems: "stretch", gap: 8 },
    toolbarButton: { flex: 1 },
    disputeButton: {
      flex: 1,
      minHeight: 46,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.dangerBorder,
      backgroundColor: theme.dangerSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 12,
    },
    disputeLink: { color: theme.danger, fontFamily: font.bold, fontSize: 12 },
    statusChips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },

    // Progress
    progressCard: { gap: 11 },
    progressHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    progressTitleWrap: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
    progressIcon: {
      width: 30,
      height: 30,
      borderRadius: 10,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
    },
    progressTitle: { color: theme.text, fontFamily: font.display, fontSize: 14.5, lineHeight: 19, letterSpacing: -0.2, flexShrink: 1 },
    progressTrack: { height: 7, borderRadius: 999, backgroundColor: theme.surfaceAlt, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 999, backgroundColor: theme.brand },
    progressFillOverdue: { backgroundColor: theme.danger },
    progressText: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 },

    // Schedule
    placeBlock: { flexDirection: "row", gap: 10 },
    placeRail: { width: 12, alignItems: "center", paddingTop: 5 },
    placeDotBrand: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.brand },
    placeLine: { flex: 1, width: 1.5, backgroundColor: theme.border, marginTop: 4 },
    placeDotInk: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.faint },
    placeBody: { flex: 1, minWidth: 0, gap: 2, paddingBottom: 10 },
    placeLabel: {
      color: theme.faint,
      fontFamily: font.bold,
      fontSize: 8.5,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    placeAddress: { color: theme.text, fontFamily: font.medium, fontSize: 11.5, lineHeight: 17 },
    noteBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.input,
      padding: 12,
      gap: 3,
    },
    noteLabel: {
      color: theme.faint,
      fontFamily: font.bold,
      fontSize: 8.5,
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    noteText: { color: theme.text, fontFamily: font.regular, fontSize: 11, lineHeight: 17 },

    // Cost
    rows: { gap: 9 },
    totalRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      paddingTop: 12,
    },
    totalBody: { flex: 1, minWidth: 0 },
    totalLabel: { color: theme.text, fontFamily: font.bold, fontSize: 12.5 },
    totalHint: { color: theme.faint, fontFamily: font.regular, fontSize: 9.5, marginTop: 1 },
    totalValue: {
      color: theme.text,
      fontFamily: font.display,
      fontSize: 18,
      lineHeight: 22,
      letterSpacing: -0.3,
      fontVariant: ["tabular-nums"],
    },
    scheduleBox: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      backgroundColor: theme.brandSoft,
      padding: 12,
      gap: 7,
    },
    scheduleTitle: {
      color: theme.brand,
      fontFamily: font.bold,
      fontSize: 10,
      letterSpacing: 0.3,
      textTransform: "uppercase",
    },
    scheduleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    scheduleLabel: { color: theme.muted, fontFamily: font.regular, fontSize: 11, flexShrink: 1 },
    scheduleValue: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5, fontVariant: ["tabular-nums"] },
    securityBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      borderRadius: 16,
      borderWidth: 1,
      padding: 11,
    },
    securityBody: { flex: 1, minWidth: 0 },
    securityLabel: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5 },
    securityHint: { color: theme.muted, fontFamily: font.regular, fontSize: 9.5, lineHeight: 13, marginTop: 1 },
    securityValue: {
      fontFamily: font.bold,
      fontSize: 12,
      maxWidth: 116,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
    },
    hint: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 15 },
    muted: { color: theme.muted, fontFamily: font.regular, fontSize: 11.5, lineHeight: 17 },

    // Handover header
    handoverHead: { flexDirection: "row", alignItems: "center", gap: 12 },
    handoverIcon: {
      width: 40,
      height: 40,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
    },
    handoverBody: { flex: 1, minWidth: 0, gap: 2 },
    handoverCode: { color: theme.text, fontFamily: font.display, fontSize: 14.5, lineHeight: 19, letterSpacing: -0.2 },
    handoverVehicle: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5 },

    // Reviews
    reviewPrompt: { gap: 8 },
    reviewPromptStars: { fontSize: 18, letterSpacing: 2 },
    reviewItem: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, gap: 6 },
    reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    reviewAvatarFallback: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    reviewAvatarText: { color: theme.brand, fontFamily: font.bold, fontSize: 12 },
    reviewName: { color: theme.text, fontFamily: font.semibold, fontSize: 12.5 },
    reviewStars: { color: theme.success, fontSize: 12 },
    reviewDate: { color: theme.faint, fontFamily: font.regular, fontSize: 10 },
    reviewComment: {
      color: theme.text,
      fontFamily: font.regular,
      fontSize: 11.5,
      lineHeight: 17,
      marginLeft: 42,
    },
    commentInput: {
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 11,
      minHeight: 84,
      color: theme.text,
      fontFamily: font.regular,
      fontSize: 12.5,
      textAlignVertical: "top",
    },
    stars: { flexDirection: "row", gap: 2, marginVertical: 2 },
    star: { padding: 2 },
    starText: { fontSize: 24, color: theme.border },
    starActive: { color: theme.success },

    // Inputs & modals
    input: {
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: theme.text,
      fontFamily: font.regular,
      fontSize: 12.5,
    },
    multiline: { minHeight: 80, textAlignVertical: "top" },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(11,7,20,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: {
      width: "100%",
      backgroundColor: theme.surface,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.border,
      padding: 18,
      gap: 12,
    },
    modalHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    modalIcon: {
      width: 34,
      height: 34,
      borderRadius: 11,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
    },
    modalTitle: { color: theme.text, fontFamily: font.display, fontSize: 17, letterSpacing: -0.2 },
    modalHint: { color: theme.muted, fontFamily: font.regular, fontSize: 10, marginTop: 1 },
    modalActions: { flexDirection: "row", gap: 8, marginTop: 2 },
    modalButton: { flex: 1 },
    fullBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    fullImage: { width: "100%", height: "80%" },
    fullHint: { color: "#fff", fontFamily: font.regular, fontSize: 12, marginTop: 10 },
  });
