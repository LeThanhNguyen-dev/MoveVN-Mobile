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
import { OutstandingSurcharge } from "../components/CheckoutSummary";import CheckoutConfirmation from "../components/CheckoutConfirmation";
import { CHECKOUT_CONSENT } from "../checkoutRules";
import { isDepositExpired, parseServerDate } from "../bookingDisplay";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  Banknote,
  Camera,
  CircleCheck,
  CircleDollarSign,
  Clock3,
  CreditCard,
  Headphones,
  KeyRound,
  MapPin,
  MessageSquare,
  PackageCheck,
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
      Alert.alert("Lỗi", getApiErrorMessage(err, "Không tải được chi tiết chuyến đi."));
    } finally {
      if (request === loadId.current) setLoading(false);
    }
  }, [bookingId]);

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
  useEffect(() => {
    // Đăng ký GPS CHỈ khi booking đang thuê; khi rời màn KHÔNG gỡ — publisher
    // (mount ở CustomerNavigator) gửi tiếp chừng nào app còn mở, tránh "mất tín hiệu" oan.
    // Publisher tự ngừng khi server trả GPS_BOOKING_NOT_ACTIVE (chuyến đã kết thúc).
    if (!booking) return;
    if (booking.status === "InProgress" || booking.status === "Returning") {
      setActivePublishBooking(booking.id);
    } else if (useGpsStore.getState().activePublishBookingId === booking.id) {
      setActivePublishBooking(null);
    }
  }, [booking?.id, booking?.status, setActivePublishBooking]);

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
          Alert.alert("Thành công", res.message || "Đã xác nhận đặt cọc.");
          await load();
          return;
        }
        if (res.status === "Cancelled" || res.status === "Expired" || res.status === "Failed") {
          setPendingOrderCode(null);
          Alert.alert("Thông báo", res.message || "Giao dịch đã kết thúc.");
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
        Alert.alert("Hết thời gian chờ", "Chưa nhận được xác nhận. Mở lại màn này để kiểm tra sau.");
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
      if (successMessage) Alert.alert("Thành công", successMessage);
      return true;
    } catch (err) {
      const message = getApiErrorMessage(err, "Vui lòng thử lại sau.");
      setActionError(key === "checkout" ? `${message} Hãy kiểm tra lại biên bản và phụ phí trước khi xác nhận.` : message);
      Alert.alert("Thất bại", message);
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
    }, "Đã đặt cọc bằng ví thành công.");
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
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không tạo được link thanh toán."));
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
        Alert.alert("Không thể hủy", quote.policyMessage);
        return;
      }
      setCancelQuote(quote);
      setCancelReason("");
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không lấy được chính sách hủy."));
    }
  }

  async function submitCancel() {
    if (!cancelQuote) return;
    if (!cancelReason.trim()) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do hủy.");
      return;
    }
    const ok = await runAction("cancel", () => cancelBooking(bookingId, cancelReason.trim()).then(() => undefined));
    if (ok) {
      setCancelQuote(null);
      setCancelReason("");
      Alert.alert("Thành công", "Đã hủy chuyến đi.", [
        { text: "Về danh sách", onPress: handleBack },
      ]);
    }
  }

  async function handleNoShow() {
    Alert.alert(
      "Tố chủ xe không giao xe",
      "Chỉ dùng khi đã quá giờ nhận xe mà chưa có biên bản bàn giao. Tiền cọc sẽ được hoàn 100% vào ví.",
      [
        { text: "Hủy bỏ", style: "cancel" },
        {
          text: "Xác nhận",
          style: "destructive",
          onPress: () => {
            void runAction("noshow", () => reportNoShow(bookingId).then(() => undefined)).then((ok) => {
              if (ok) {
                Alert.alert("Thành công", "Đã ghi nhận. Tiền cọc hoàn vào ví.", [
                  { text: "Về danh sách", onPress: handleBack },
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
      Alert.alert("Thiếu đánh giá", "Vui lòng chọn số sao đánh giá tổng quan.");
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
      "Cảm ơn đánh giá của bạn.",
    );
    if (ok) setReviewOpen(false);
  }

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <DetailHeader
          kicker={handover ? "Bàn giao xe" : undefined}
          title={handover ? (handover === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out") : "Chuyến đi của tôi"}
          onBack={handleBack}
        />
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={theme.brand} /> : <Text style={styles.muted}>Không tải được.</Text>}
        </View>
      </View>
    );
  }


  if (disputeOpen) return createdDisputeId
    ? <DisputeDetailScreen disputeId={createdDisputeId} onBack={() => { setDisputeOpen(false); setCreatedDisputeId(null); void load(); }} />
    : <CreateDisputeScreen role="Customer" initial={{ bookingId, reportType: "Other", description: "Tôi không đồng ý với biên bản trả xe: " }} onBack={() => setDisputeOpen(false)} onCreated={id => { setCreatedDisputeId(id); void load(); }} />;

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
          <DetailNotice icon={Clock3} title="Có thể nhận xe sớm" tone="brand">
            Xe trống: có thể nhận sớm tối đa 2 tiếng. Chủ xe lập biên bản, khách kiểm tra rồi xác nhận nhận xe. Giờ trả và giá thuê giữ theo booking.
          </DetailNotice>
        ) : null}
        {actions.confirmCheckIn && checkInReport ? (
          <DetailButton
            icon={KeyRound}
            label="Đồng ý biên bản và nhận xe"
            onPress={() => runAction("checkin", () => confirmCheckIn(bookingId, checkInReport.version ?? 1).then(() => undefined), "Đã xác nhận nhận xe. Chúc bạn đi tốt!")}
            disabled={!dataReady || actionBusy !== null}
          />
        ) : (
          <Text style={styles.hint}>{booking.checkInUnavailableReason || "Chờ biên bản nhận xe và kiểm tra khả năng check-in."}</Text>
        )}
        {checkInReport && !checkInReport.isCustomerConfirmed ? checkInReport.requiresRevision ? (
          <DetailNotice icon={TriangleAlert} title="Đã yêu cầu lập lại" tone="warn">
            {checkInReport.revisionReason}. Chờ chủ xe gửi biên bản mới rồi kiểm tra lại.
          </DetailNotice>
        ) : (
          <DetailButton
            variant="secondary"
            icon={TriangleAlert}
            label="Không đồng ý / Yêu cầu lập lại"
            disabled={!dataReady || actionBusy !== null}
            onPress={() => { setRevisionReason(""); setRevisionOpen(true); }}
          />
        ) : null}
        {actions.reportNoShow ? (
          <DetailButton
            variant="ghost"
            icon={TriangleAlert}
            label="Chủ xe không giao xe"
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
        label="Báo xe đã được bàn giao lại"
        onPress={() => runAction("report", () => reportReturn(bookingId).then(() => undefined), "Đã báo trả xe. Chờ chủ xe lập biên bản.")}
        disabled={!dataReady || actionBusy !== null}
      />
    )}

    {actions.confirmCheckOut && checkOutReport && (
      <>
        <DetailNotice icon={ShieldCheck} title="Cam kết khi xác nhận" tone="brand">
          {CHECKOUT_CONSENT}
        </DetailNotice>
        <DetailButton
          label="Kiểm tra biên bản và xác nhận trả xe"
          onPress={() => setCheckoutToConfirm(checkOutReport)}
          disabled={!dataReady || actionBusy !== null}
        />
      </>
    )}
    {actions.disputeCheckOut && (
      <DetailButton
        variant="ghost"
        icon={TriangleAlert}
        label="Không đồng ý / Mở tranh chấp"
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
            kicker="Bàn giao xe"
            title={handover === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out"}
            onBack={handleBack}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nhắn tin với chủ xe"
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
                  <Text style={styles.handoverVehicle} numberOfLines={1}>{booking.vehicleName || `Xe #${booking.vehicleId}`}</Text>
                </View>
                <DetailPill
                  label={activeHandoverReport ? (activeHandoverReport.isCustomerConfirmed ? "Đã xác nhận" : activeHandoverReport.requiresRevision ? "Cần lập lại" : "Chờ xác nhận") : "Chưa có biên bản"}
                  tone={activeHandoverReport ? (activeHandoverReport.isCustomerConfirmed ? "mint" : activeHandoverReport.requiresRevision ? "danger" : "warn") : "neutral"}
                />
              </View>
              <DetailButton variant="ghost" icon={RotateCcw} label="Tải lại biên bản" disabled={actionBusy !== null} onPress={() => void load()} />
            </DetailCard>

            {!!actionError && <DetailNotice icon={TriangleAlert} title="Không thực hiện được" tone="danger">{actionError}</DetailNotice>}
            {!dataReady && <DetailNotice icon={TriangleAlert} title="Chưa tải được dữ liệu mới" tone="warn">Tải lại trước khi thao tác.</DetailNotice>}

            {activeHandoverReport ? <InspectionReportCard booking={booking} report={activeHandoverReport} /> : (
              <DetailCard>
                <DetailSectionHeader
                  icon={handover === "CheckIn" ? KeyRound : PackageCheck}
                  title="Chưa có biên bản"
                  subtitle="Biên bản sẽ xuất hiện khi chủ xe gửi"
                />
                <Text style={styles.hint}>Thao tác khả dụng sẽ xuất hiện theo trạng thái chuyến đi.</Text>
              </DetailCard>
            )}

            <DetailCard>
              <DetailSectionHeader
                icon={handover === "CheckIn" ? KeyRound : PackageCheck}
                tone={handover === "CheckIn" ? "brand" : "mint"}
                title={handover === "CheckIn" ? "Xác nhận nhận xe" : "Xác nhận trả xe"}
                subtitle="Kiểm tra biên bản, ảnh xe và các khoản thanh toán trước khi xác nhận"
              />
              {handover === "CheckIn" ? checkInActions : checkOutActions}
            </DetailCard>
          </ScrollView>
        </>
      ) : (
        <>
          <DetailHeader
            title="Chuyến đi của tôi"
            onBack={handleBack}
            right={
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Nhắn tin với chủ xe"
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
            {actionError ? <DetailNotice icon={TriangleAlert} title="Không thực hiện được" tone="danger">{actionError}</DetailNotice> : null}
            {!dataReady ? <DetailNotice icon={TriangleAlert} title="Chưa tải được dữ liệu mới" tone="warn">Quay lại màn hoặc tải lại trước khi thao tác.</DetailNotice> : null}

            <View style={styles.toolbarRow}>
              <DetailButton variant="ghost" icon={RotateCcw} label="Tải lại" disabled={actionBusy !== null} onPress={() => void load()} style={styles.toolbarButton} />
              {onOpenDisputes ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => onOpenDisputes({ bookingId: booking.id })}
                  style={({ pressed }) => [styles.disputeButton, pressed && styles.pressed]}
                >
                  <TriangleAlert color={p.danger} size={15} strokeWidth={2.1} />
                  <Text style={styles.disputeLink}>Tranh chấp</Text>
                </Pressable>
              ) : null}
            </View>

            <View style={styles.statusChips}>
              {booking.escrowStatus === "Held" ? <DetailPill label={`Giữ cọc ${formatMoney(booking.escrowAmount)}`} tone="mint" /> : null}
              <RiskScoreBadge score={booking.riskScore} />
            </View>

            {progress ? (
              <DetailCard style={styles.progressCard}>
                <View style={styles.progressHead}>
                  <View style={styles.progressTitleWrap}>
                    <View style={styles.progressIcon}>
                      <Clock3 color={p.brand} size={15} strokeWidth={2.1} />
                    </View>
                    <Text style={styles.progressTitle}>{progress.overdue ? "Đã quá hạn trả xe" : "Đang trong chuyến"}</Text>
                  </View>
                  <DetailPill label={progress.overdue ? "Quá hạn" : `Ngày ${progress.currentDay}/${progress.totalDays}`} tone={progress.overdue ? "danger" : "brand"} />
                </View>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${progressPercent}%` }, progress.overdue && styles.progressFillOverdue]} />
                </View>
                <Text style={styles.progressText}>{progress.summary}</Text>
              </DetailCard>
            ) : null}

            {(status === "InProgress" || status === "Returning") && gpsSharingHere && gpsPermissionStatus === "granted" && !gpsPublishError ? (
              <DetailNotice icon={CircleCheck} title="Đang chia sẻ vị trí" tone="mint">
                Chủ xe theo dõi được chuyến đi{gpsLastPublishedAt ? ` · cập nhật ${new Date(gpsLastPublishedAt).toLocaleTimeString("vi-VN")}` : ""}.
              </DetailNotice>
            ) : null}
            {(status === "InProgress" || status === "Returning") && (gpsPermissionStatus === "denied" || gpsPublishError) ? (
              <DetailNotice icon={TriangleAlert} title="Chưa chia sẻ vị trí" tone="warn">
                {gpsPublishError || "Bạn chưa cấp quyền vị trí cho MoveVN. Bật GPS để chủ xe theo dõi chuyến đi."}
              </DetailNotice>
            ) : null}

            {status === "Pending" && autoCancelHours != null && booking.createdAt ? (
              <DetailNotice icon={Clock3} title="Chờ chủ xe duyệt" tone="warn">
                Chủ xe có {autoCancelHours} giờ để duyệt. Nếu không phản hồi trước {formatDateTime(new Date(new Date(booking.createdAt).getTime() + autoCancelHours * 3600000).toISOString())}, hệ thống sẽ tự động từ chối booking.
              </DetailNotice>
            ) : null}

            <DetailCard>
              <DetailSectionHeader icon={MapPin} title="Nhận & trả xe" subtitle="Địa điểm bàn giao" />
              <View style={styles.placeBlock}>
                <View style={styles.placeRail}><View style={styles.placeDotBrand} /><View style={styles.placeLine} /></View>
                <View style={styles.placeBody}>
                  <Text style={styles.placeLabel}>Điểm nhận xe</Text>
                  <Text style={styles.placeAddress}>{booking.pickupAddress}</Text>
                  <Text style={styles.hint}>Dự kiến {formatDateTime(booking.startDate)}</Text>
                  {booking.deliveryDistanceKm != null ? (
                    <Text style={styles.hint}>
                      Cách vị trí xe {booking.deliveryDistanceKm} km{booking.deliveryFee > 0 ? ` · Phí giao xe ${formatMoney(booking.deliveryFee)}` : " · Miễn phí giao xe"}
                    </Text>
                  ) : null}
                </View>
              </View>
              <View style={styles.placeBlock}>
                <View style={styles.placeRail}><View style={styles.placeDotInk} /></View>
                <View style={styles.placeBody}>
                  <Text style={styles.placeLabel}>Điểm trả xe</Text>
                  <Text style={styles.placeAddress}>{booking.returnAddress || booking.pickupAddress}</Text>
                  <Text style={styles.hint}>Dự kiến {formatDateTime(booking.endDate)}</Text>
                </View>
              </View>
              {booking.customerNote ? (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>Ghi chú của bạn</Text>
                  <Text style={styles.noteText}>{booking.customerNote}</Text>
                </View>
              ) : null}
            </DetailCard>

            <DetailCard>
              <DetailSectionHeader icon={ReceiptText} title="Chi phí" subtitle="Đã gồm phí nền tảng" />
              <View style={styles.rows}>
                <DetailRow label={`Giá thuê (${booking.totalDays} ngày)`} value={formatMoney(booking.basePrice)} />
                {booking.discountPercent > 0 ? <DetailRow label={`Giảm giá (${booking.discountPercent}%)`} value={`-${formatMoney(booking.discountAmount)}`} tone="success" /> : null}
                {booking.promotionDiscount > 0 ? <DetailRow label={`Mã ${booking.promotionCode ?? ""}`} value={`-${formatMoney(booking.promotionDiscount)}`} tone="success" /> : null}
                {booking.deliveryFee > 0 ? <DetailRow label={`Phí giao xe tận nơi${booking.deliveryDistanceKm != null ? ` (${booking.deliveryDistanceKm} km)` : ""}`} value={`+${formatMoney(booking.deliveryFee)}`} /> : null}
                <DetailRow label="Phí nền tảng (đã gồm trong tổng)" value={formatMoney(booking.platformFee)} tone="muted" />
              </View>
              <View style={styles.totalRow}>
                <View style={styles.totalBody}>
                  <Text style={styles.totalLabel}>Tổng cộng</Text>
                  <Text style={styles.totalHint}>Đã trừ ưu đãi, chưa gồm thế chấp</Text>
                </View>
                <Text style={styles.totalValue}>{formatMoney(booking.totalAmount)}</Text>
              </View>
              <View style={styles.scheduleBox}>
                <Text style={styles.scheduleTitle}>Thanh toán dự kiến</Text>
                <View style={styles.scheduleRow}>
                  <Text style={styles.scheduleLabel}>Đặt cọc ngay</Text>
                  <Text style={styles.scheduleValue}>{formatMoney(booking.depositAmount)}</Text>
                </View>
                {remainingAmount > 0 ? (
                  <View style={styles.scheduleRow}>
                    <Text style={styles.scheduleLabel}>Trả khi nhận xe</Text>
                    <Text style={styles.scheduleValue}>{formatMoney(remainingAmount)}</Text>
                  </View>
                ) : null}
              </View>
              {booking.securityDepositAmount > 0 ? (
                <View style={[styles.securityBox, { borderColor: p.warningBorder, backgroundColor: p.warningSoft }]}>
                  <ShieldCheck color={p.warning} size={16} strokeWidth={2.1} />
                  <View style={styles.securityBody}>
                    <Text style={styles.securityLabel}>Tiền thế chấp</Text>
                    <Text style={styles.securityHint}>Hoàn lại khi trả xe đúng hiện trạng</Text>
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
                  title="Phụ phí còn nợ"
                  subtitle="Khoản phát sinh khi trả xe"
                  right={<DetailPill label={formatMoney(booking.outstandingSurchargeAmount ?? 0)} tone="danger" />}
                />
                <DetailNotice icon={TriangleAlert} title="Cần thanh toán để hoàn tất" tone="danger">
                  Còn nợ {formatMoney(booking.outstandingSurchargeAmount)} phụ phí. Vui lòng thanh toán để hoàn tất chuyến đi.
                </DetailNotice>
              </DetailCard>
            ) : null}

            {pendingTopUp != null && pendingTopUp.amount > 0 ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={Wallet}
                  title="Cọc bổ sung (gia hạn)"
                  subtitle={pendingTopUp.dueAt ? `Hạn thanh toán ${formatDateTime(pendingTopUp.dueAt)}` : "Thanh toán để giữ lịch gia hạn"}
                  right={<DetailPill label={formatMoney(pendingTopUp.amount)} tone="warn" />}
                />
                <Text style={styles.muted}>
                  Cần thêm {formatMoney(pendingTopUp.amount)}
                  {pendingTopUp.dueAt ? ` trước ${formatDateTime(pendingTopUp.dueAt)}` : ""} để giữ lịch gia hạn.
                </Text>
                <DetailButton
                  icon={Wallet}
                  label={actionBusy === "topup" ? "Đang tạo link..." : "Trả cọc bổ sung qua PayOS"}
                  onPress={handlePayTopUp}
                  disabled={!dataReady || actionBusy !== null}
                />
              </DetailCard>
            ) : null}

            {status === "Approved" ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={Banknote}
                  title="Đặt cọc giữ xe"
                  subtitle={booking.paymentDueAt ? `Hạn cọc ${formatDateTime(booking.paymentDueAt)}` : "Hoàn tất cọc để giữ chuyến"}
                  right={<DetailPill label={formatMoney(booking.depositAmount)} tone="brand" />}
                />
                {booking.paymentDueAt ? <Text style={styles.muted}>Hạn cọc: {formatDateTime(booking.paymentDueAt)}. Quá hạn booking sẽ tự hủy.</Text> : null}
                {depositExpired ? (
                  <DetailNotice icon={TriangleAlert} title="Đã hết hạn thanh toán" tone="danger">
                    Booking không còn hiệu lực nhận cọc vì đã hết hạn thanh toán. Hệ thống sẽ tự hủy booking này.
                  </DetailNotice>
                ) : (
                  <>
                    <DetailButton
                      icon={Wallet}
                      label={actionBusy === "wallet" ? "Đang trừ ví..." : `Trả bằng ví${walletBalance != null ? ` (${formatMoney(walletBalance)})` : ""}`}
                      onPress={handlePayWithWallet}
                      disabled={!dataReady || actionBusy !== null}
                    />
                    <DetailButton
                      variant="secondary"
                      icon={CreditCard}
                      label={actionBusy === "payos" ? "Đang tạo link..." : "Trả qua PayOS"}
                      onPress={handlePayWithPayOs}
                      disabled={!dataReady || actionBusy !== null}
                    />
                    {pendingOrderCode != null ? (
                      <Text style={styles.muted}>Đang chờ xác nhận giao dịch #{pendingOrderCode}...</Text>
                    ) : null}
                  </>
                )}
              </DetailCard>
            ) : null}

            {canCancel ? (
              <DetailButton
                variant="danger"
                icon={TriangleAlert}
                label="Hủy chuyến đi"
                onPress={handleCancel}
                disabled={!dataReady || actionBusy !== null}
              />
            ) : null}

            <OutstandingSurcharge booking={booking} report={checkOutReport} role="Customer" onUpdated={load} onOpenWallet={() => navigation.navigate("BookingWallet")} />

            <ContractBlock bookingStatus={booking.status} bookingId={booking.id} userId={userId} canManage={false} onChanged={() => load()} />

            <DetailCard>
              <DetailSectionHeader icon={Camera} title="Bàn giao xe" subtitle="Biên bản nhận xe và trả xe" />
              <InspectionSummaryLink booking={booking} type="CheckIn" report={checkInReport} onPress={() => navigation.navigate("TripHandover", { bookingId, inspectionType: "CheckIn" })} />
              <InspectionSummaryLink booking={booking} type="CheckOut" report={checkOutReport} divider onPress={() => navigation.navigate("TripHandover", { bookingId, inspectionType: "CheckOut" })} />
            </DetailCard>

            {(status === "Cancelled" || status === "Rejected") && booking.cancelReason ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={TriangleAlert}
                  title={`Lý do ${status === "Rejected" ? "từ chối" : "hủy"}`}
                  subtitle="Ghi nhận từ hệ thống"
                />
                <Text style={styles.muted}>{booking.cancelReason}</Text>
              </DetailCard>
            ) : null}

            {status === "Completed" ? (
              <DetailCard>
                <DetailSectionHeader
                  icon={Star}
                  title="Đánh giá chuyến đi"
                  subtitle={alreadyReviewed ? "Cảm ơn bạn đã chia sẻ trải nghiệm" : "Chia sẻ trải nghiệm của bạn"}
                />
                {!alreadyReviewed ? (
                  <View style={styles.reviewPrompt}>
                    <Text style={[styles.reviewPromptStars, { color: p.rating }]}>★★★★★</Text>
                    <Text style={styles.muted}>Bạn chưa đánh giá chuyến đi này.</Text>
                    <DetailButton
                      icon={Star}
                      label="Viết đánh giá"
                      onPress={() => setReviewOpen(true)}
                      disabled={!dataReady || actionBusy !== null}
                    />
                  </View>
                ) : null}
                {bookingReviews.filter((review) => review.reviewType === "Customer").map((review) => (
                  <View key={review.id} style={styles.reviewItem}>
                    <View style={styles.reviewHeader}>
                      {review.reviewerAvatar ? <Image source={{ uri: review.reviewerAvatar }} style={styles.reviewAvatar} /> : <View style={styles.reviewAvatarFallback}><Text style={styles.reviewAvatarText}>{(review.reviewerName || "K").slice(0, 1).toUpperCase()}</Text></View>}
                      <View style={{ flex: 1 }}><Text style={styles.reviewName}>{review.reviewerName || "Khách thuê"}</Text><Text style={styles.reviewStars}>{"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}</Text></View>
                      <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString("vi-VN")}</Text>
                    </View>
                    {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
                  </View>
                ))}
                {alreadyReviewed && bookingReviews.filter((review) => review.reviewType === "Customer").length === 0 ? <Text style={styles.muted}>Bạn đã gửi đánh giá cho chuyến đi này.</Text> : null}
              </DetailCard>
            ) : null}

            <DetailCard>
              <DetailSectionHeader icon={Headphones} title="Hỗ trợ & báo cáo" subtitle="Liên hệ MoveVN khi cần giúp đỡ" />
              <BookingAssistance key={booking.id} bookingId={booking.id} bookingCode={booking.bookingCode} />
              <ReportBookingViolation key={`violation-${booking.id}`} bookingId={booking.id} bookingCode={booking.bookingCode} />
            </DetailCard>

            <BookingTimeline history={booking.statusHistory} />

          </View>
        </ScrollView>
        </>
      )}

      <CheckoutConfirmation booking={booking} report={checkoutToConfirm} busy={actionBusy !== null} onClose={() => setCheckoutToConfirm(null)} onConfirm={(report, paymentMethod) => {
        void runAction("checkout", () => confirmCheckOut(bookingId, report.version ?? 1, paymentMethod).then(() => undefined), "Đã xác nhận trả xe và ghi nhận phương thức thanh toán. Chủ xe cần xác nhận nhận lại xe để hoàn tất chuyến.").then(ok => { if (ok) setCheckoutToConfirm(null); });
      }} />

      <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => { if (actionBusy === null) setReviewOpen(false); }}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <View style={styles.modalIcon}><Star color={p.brand} size={18} strokeWidth={2.1} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Đánh giá chuyến đi</Text>
                <Text style={styles.modalHint}>Chia sẻ trải nghiệm của bạn</Text>
              </View>
            </View>
            <RatingInput label="Đánh giá tổng quan (bắt buộc)" value={rating} onChange={setRating} styles={styles} />
            <RatingInput label="Vệ sinh (không bắt buộc)" value={cleanliness} onChange={setCleanliness} styles={styles} />
            <RatingInput label="Chính xác mô tả (không bắt buộc)" value={accuracy} onChange={setAccuracy} styles={styles} />
            <RatingInput label="Hỗ trợ (không bắt buộc)" value={support} onChange={setSupport} styles={styles} />
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Chia sẻ trải nghiệm của bạn..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={styles.commentInput}
            />
            <View style={styles.modalActions}>
              <DetailButton variant="ghost" label="Đóng" disabled={actionBusy !== null} onPress={() => setReviewOpen(false)} style={styles.modalButton} />
              <DetailButton icon={Star} label={actionBusy === "review" ? "Đang gửi..." : "Gửi đánh giá"} onPress={handleReview} disabled={!dataReady || actionBusy !== null || rating === 0} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={viewingImage !== null} transparent animationType="fade" onRequestClose={() => setViewingImage(null)}>
        <Pressable style={styles.fullBackdrop} onPress={() => setViewingImage(null)}>
          {viewingImage ? (
            <Image source={{ uri: viewingImage }} style={styles.fullImage} resizeMode="contain" />
          ) : null}
          <Text style={styles.fullHint}>Chạm để đóng</Text>
        </Pressable>
      </Modal>

      <Modal visible={cancelQuote !== null} transparent animationType="fade" onRequestClose={() => setCancelQuote(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <View style={[styles.modalIcon, { backgroundColor: p.dangerSoft }]}><TriangleAlert color={p.danger} size={18} strokeWidth={2.1} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Hủy chuyến đi</Text>
                <Text style={styles.modalHint}>Xem chính sách hoàn cọc trước khi hủy</Text>
              </View>
            </View>
            {cancelQuote ? (
              <>
                <Text style={styles.muted}>{cancelQuote.policyMessage}</Text>
                <Text style={styles.muted}>
                  {cancelQuote.hasPaidDeposit
                    ? `Hoàn ${formatMoney(cancelQuote.refundAmount)} (${cancelQuote.refundPercent}%), mất ${formatMoney(cancelQuote.forfeitedAmount)}.`
                    : "Chưa đặt cọc nên hủy miễn phí."}
                </Text>
              </>
            ) : null}
            <TextInput
              value={cancelReason}
              onChangeText={setCancelReason}
              placeholder="Lý do hủy..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />
            <View style={styles.modalActions}>
              <DetailButton variant="ghost" label="Đóng" onPress={() => setCancelQuote(null)} style={styles.modalButton} />
              <DetailButton variant="danger" label="Xác nhận hủy" busy={actionBusy === "cancel"} disabled={actionBusy !== null} onPress={submitCancel} style={styles.modalButton} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={revisionOpen} transparent animationType="fade" onRequestClose={() => { if (!actionBusy) setRevisionOpen(false); }}>
        <View style={styles.modalBackdrop}><View style={styles.modal}>
          <View style={styles.modalHead}>
            <View style={styles.modalIcon}><RotateCcw color={p.brand} size={18} strokeWidth={2.1} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.modalTitle}>Yêu cầu lập lại biên bản</Text>
              <Text style={styles.modalHint}>Biên bản nhận xe</Text>
            </View>
          </View>
          <Text style={styles.muted}>Ghi rõ số km, nhiên liệu, ảnh hoặc tình trạng xe cần sửa. Chuyến chưa bắt đầu cho đến khi bạn đồng ý biên bản mới.</Text>
          <TextInput accessibilityLabel="Lý do yêu cầu lập lại" value={revisionReason} onChangeText={setRevisionReason} maxLength={1000} editable={!actionBusy} placeholder="Nội dung cần điều chỉnh..." placeholderTextColor={theme.placeholder} multiline style={[styles.input, styles.multiline]} />
          <DetailButton label="Gửi yêu cầu lập lại" disabled={!revisionReason.trim() || !dataReady || actionBusy !== null} onPress={() => {
            if (!checkInReport) return;
            void runAction("revision", () => requestCheckInRevision(bookingId, checkInReport.version ?? 1, revisionReason.trim()).then(() => undefined), "Đã gửi yêu cầu cho chủ xe.").then(ok => { if (ok) setRevisionOpen(false); });
          }} />
          <DetailButton variant="secondary" label="Đóng" disabled={actionBusy !== null} onPress={() => setRevisionOpen(false)} />
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
