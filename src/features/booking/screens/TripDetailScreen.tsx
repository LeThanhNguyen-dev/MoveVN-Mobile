import ReportBookingViolation from "../components/ReportBookingViolation";
import { bookingActions } from "../bookingActions";
import InspectionSummaryLink from "../components/InspectionSummaryLink";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import { checkoutStartDate } from "../bookingDisplay";
import { useBookingNotificationRefresh } from "../useBookingNotificationRefresh";
import BookingAssistance from "../components/BookingAssistance";
import ReportViolationButton from "@/features/violations/ReportViolationButton";
import ReturnProgress from "../components/ReturnProgress";
import InspectionReportCard from "../components/InspectionReportCard";
import { useFocusEffect } from "@react-navigation/native";
import CheckoutSummary, { OutstandingSurcharge } from "../components/CheckoutSummary";
import CheckoutConfirmation from "../components/CheckoutConfirmation";
import { BookingButton } from "../components/BookingControls";
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
import AppText from "@/components/AppText";
import { ArrowLeft, ChevronRight, MessageSquare } from "lucide-react-native";
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
import { bookingStatusLabel, formatDate, formatDateTime, formatMoney, rentalProgress } from "@/features/booking/utils/format";
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
    await runAction(
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
  }

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft color={theme.text} size={20} />
          </Pressable>
          <Text style={styles.headerTitle}>Chi tiết chuyến đi</Text>
          <View style={styles.backButton} />
        </View>
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

  const checkInActions = <>
        {(status === "DepositPaid" || status === "Confirmed") && (
          <>
            {status === "DepositPaid" && booking.canCheckInNow === true && !pickupReached ? <Text style={styles.muted}>Xe trống: có thể nhận sớm tối đa 2 tiếng. Chủ xe lập biên bản, khách kiểm tra rồi xác nhận nhận xe. Giờ trả và giá thuê giữ theo booking.</Text> : null}
            {actions.confirmCheckIn && checkInReport ? <ActionButton
              theme={theme}
              label="Đồng ý biên bản và nhận xe"
              onPress={() => runAction("checkin", () => confirmCheckIn(bookingId, checkInReport.version ?? 1).then(() => undefined), "Đã xác nhận nhận xe. Chúc bạn đi tốt!")}
              disabled={!dataReady || actionBusy !== null}
            /> : <Text style={styles.muted}>{booking.checkInUnavailableReason || "Chờ biên bản nhận xe và kiểm tra khả năng check-in."}</Text>}
            {checkInReport && !checkInReport.isCustomerConfirmed ? checkInReport.requiresRevision
              ? <Text style={styles.muted}>Đã yêu cầu lập lại: {checkInReport.revisionReason}. Chờ chủ xe gửi biên bản mới rồi kiểm tra lại.</Text>
              : <ActionButton theme={theme} label="Không đồng ý / Yêu cầu lập lại" secondary disabled={!dataReady || actionBusy !== null} onPress={() => { setRevisionReason(""); setRevisionOpen(true); }} />
              : null}
            {actions.reportNoShow ? <ActionButton
              theme={theme}
              label="Chủ xe không giao xe"
              onPress={handleNoShow}
              disabled={!dataReady || actionBusy !== null}
              secondary
            /> : null}
          </>
        )}


  </>;
  const checkOutActions = <>
        {actions.reportReturn && (
          <ActionButton
            theme={theme}
            label="Báo xe đã được bàn giao lại"
            onPress={() => runAction("report", () => reportReturn(bookingId).then(() => undefined), "Đã báo trả xe. Chờ chủ xe lập biên bản.")}
            disabled={!dataReady || actionBusy !== null}
          />
        )}

        {actions.confirmCheckOut && checkOutReport && (
          <View><Text style={styles.muted}>{CHECKOUT_CONSENT}</Text><ActionButton
            theme={theme}
            label="Kiểm tra biên bản và xác nhận trả xe"
            onPress={() => setCheckoutToConfirm(checkOutReport)}
            disabled={!dataReady || actionBusy !== null}
          /></View>
        )}
        {actions.disputeCheckOut && (
          <ActionButton
            theme={theme}
            label="Không đồng ý / Mở tranh chấp"
            onPress={() => {
              setCreatedDisputeId(null);
              setDisputeOpen(true);
            }}
            disabled={actionBusy !== null}
            secondary
          />
        )}

        <ReturnProgress booking={booking} report={checkOutReport} role="Customer" />
        <OutstandingSurcharge booking={booking} report={checkOutReport} role="Customer" onUpdated={load} onOpenWallet={() => navigation.navigate("BookingWallet")} />


  </>;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {handover ? (handover === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out") : booking.bookingCode}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Nhắn tin với chủ xe" onPress={() => navigation.navigate("BookingChat", { bookingId })} style={styles.backButton}><MessageSquare color={theme.brand} size={22} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {handover ? <>
          <Text style={styles.cardTitle}>{booking.bookingCode}</Text>
          {!!actionError && <Text accessibilityRole="alert" style={{ color: theme.danger }}>{actionError}</Text>}
          <BookingButton secondary title="Tải lại biên bản" disabled={actionBusy !== null} onPress={() => void load()} />
          {!dataReady && <Text accessibilityRole="alert" style={styles.muted}>Chưa tải được dữ liệu mới. Tải lại trước khi thao tác.</Text>}
          <Text style={styles.muted}>Kiểm tra biên bản, ảnh xe và các khoản thanh toán trước khi xác nhận.</Text>
          {(handover === "CheckIn" ? checkInReport : checkOutReport) ? <InspectionReportCard booking={booking} report={(handover === "CheckIn" ? checkInReport : checkOutReport)!} /> : <Text style={styles.muted}>Chưa có biên bản. Thao tác khả dụng sẽ xuất hiện theo trạng thái chuyến đi.</Text>}
          {handover === "CheckIn" ? checkInActions : checkOutActions}
        </> : <>

        <View style={styles.vehicleCard}>
          {vehiclePhoto ? <Image source={{ uri: vehiclePhoto }} style={styles.bookingVehicleImage} resizeMode="cover" /> : <View style={[styles.bookingVehicleImage, styles.bookingVehiclePlaceholder]}><Text style={styles.bookingVehiclePlaceholderText}>MoveVN</Text></View>}
          <View style={styles.vehicleInfo}>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate("VehicleDetail", { vehicleId: booking.vehicleId })}><Text style={styles.vehicleName}>{booking.vehicleName || `Xe #${booking.vehicleId}`}</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate("BookingUserProfile", { userId: booking.ownerId })}><Text style={{ color: theme.brand, fontWeight: "600" }}>Chủ xe: {booking.ownerName || `#${booking.ownerId}`}</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate("BookingUserProfile", { userId: booking.customerId })}><Text style={{ color: theme.brand, fontWeight: "600" }}>Khách thuê: {booking.customerName || `#${booking.customerId}`}</Text></Pressable>
            <Text style={styles.muted}>Ngày yêu cầu: {formatDateTime(booking.createdAt)}</Text>
          </View>
        </View>
        {actionError ? <Text accessibilityRole="alert" style={{ color: theme.danger }}>{actionError}</Text> : null}
        {!dataReady ? <Text accessibilityRole="alert" style={styles.muted}>Không tải được dữ liệu mới. Quay lại màn hoặc tải lại trước khi thao tác.</Text> : null}
        <BookingButton secondary title="Tải lại đơn thuê" disabled={actionBusy !== null} onPress={() => void load()} />
        <View style={styles.statusRow}>
          <Text style={styles.status}>{bookingStatusLabel(status)}</Text>
          {booking.escrowStatus === "Held" && <Text style={styles.escrow}>Giữ cọc {formatMoney(booking.escrowAmount)}</Text>}
        </View>
        {progress && (
          <View style={[styles.progressStrip, progress.overdue && styles.progressOverdue]}>
            <Text style={styles.progressText}>{progress.summary}</Text>
          </View>
        )}
        {(status === "InProgress" || status === "Returning") && gpsSharingHere && gpsPermissionStatus === "granted" && !gpsPublishError ? (
          <Text style={[styles.muted, { color: theme.success }]}>
            Đang chia sẻ vị trí cho chủ xe theo dõi{gpsLastPublishedAt ? ` · cập nhật ${new Date(gpsLastPublishedAt).toLocaleTimeString("vi-VN")}` : ""}.
          </Text>
        ) : null}
        {(status === "InProgress" || status === "Returning") && (gpsPermissionStatus === "denied" || gpsPublishError) ? (
          <Text style={styles.muted}>Chia sẻ vị trí: {gpsPublishError || "Bạn chưa cấp quyền vị trí cho MoveVN. Bật GPS để chủ xe theo dõi chuyến đi."}</Text>
        ) : null}
        <View style={styles.statusRow}>
          <RiskScoreBadge score={booking.riskScore} />
          {onOpenDisputes ? (
            <Pressable onPress={() => onOpenDisputes({ bookingId: booking.id })}>
              <Text style={styles.disputeLink}>Tranh chấp / khiếu nại</Text>
            </Pressable>
          ) : null}
        </View>
        {status === "Pending" && autoCancelHours != null && booking.createdAt ? (
          <Text style={styles.muted}>
            Chủ xe có {autoCancelHours} giờ để duyệt. Nếu không phản hồi trước {formatDateTime(new Date(new Date(booking.createdAt).getTime() + autoCancelHours * 3600000).toISOString())}, hệ thống sẽ tự động từ chối booking.
          </Text>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chủ xe</Text>
          {onOpenUserProfile && booking.ownerId ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Xem hồ sơ chủ xe ${booking.ownerName || ""}`}
              onPress={() => onOpenUserProfile(booking.ownerId)}
              style={styles.personRow}
            >
              <View style={styles.personAvatar}>
                <AppText style={styles.personAvatarText}>
                  {(booking.ownerName || "C").charAt(0).toUpperCase()}
                </AppText>
              </View>
              <AppText style={styles.personName} numberOfLines={1}>
                {booking.ownerName?.trim() || `Chủ xe #${booking.ownerId}`}
              </AppText>
              <ChevronRight color={theme.muted} size={16} />
            </Pressable>
          ) : (
            <Text style={styles.muted}>
              {booking.ownerName?.trim() || `Chủ xe #${booking.ownerId}`}
            </Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch trình & địa điểm</Text>
          <Row label="Nhận xe" value={formatDateTime(booking.startDate)} />
          <Text style={styles.address}>{booking.pickupAddress}</Text>
          {booking.deliveryDistanceKm != null ? (
            <Text style={styles.muted}>
              Cách vị trí xe {booking.deliveryDistanceKm} km
              {booking.deliveryFee > 0 ? ` · Phí giao xe ${formatMoney(booking.deliveryFee)}` : " · Miễn phí giao xe"}
            </Text>
          ) : null}
          <Row label="Trả xe" value={formatDateTime(booking.endDate)} />
          <Text style={styles.address}>{booking.returnAddress || booking.pickupAddress}</Text>
          {booking.customerNote ? <Text style={styles.note}>Ghi chú: {booking.customerNote}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chi tiết chi phí</Text>
          <Row label={`Giá thuê (${booking.totalDays} ngày)`} value={formatMoney(booking.basePrice)} />
          {booking.discountPercent > 0 ? (
            <Row label={`Giảm giá (${booking.discountPercent}%)`} value={`-${formatMoney(booking.discountAmount)}`} tone="success" />
          ) : null}
          {booking.promotionDiscount > 0 ? (
            <Row
              label={`Mã ${booking.promotionCode ?? ""}`}
              value={`-${formatMoney(booking.promotionDiscount)}`}
              tone="success"
            />
          ) : null}
          {booking.deliveryFee > 0 ? (
            <Row
              label={`Phí giao xe tận nơi${booking.deliveryDistanceKm != null ? ` (${booking.deliveryDistanceKm} km)` : ""}`}
              value={`+${formatMoney(booking.deliveryFee)}`}
            />
          ) : null}
          <Row label="Phí nền tảng (đã gồm trong tổng)" value={formatMoney(booking.platformFee)} />
          <Row label="Tổng cộng" value={formatMoney(booking.totalAmount)} strong />
          {booking.securityDepositAmount > 0 ? <Row label="Tiền thế chấp (hoàn lại khi trả xe)" value={formatMoney(booking.securityDepositAmount)} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch thanh toán</Text>
          <Row label="Đặt cọc ngay" value={formatMoney(booking.depositAmount)} />
          {booking.totalAmount > booking.depositAmount ? (
            <Row label="Trả khi nhận xe" value={formatMoney(booking.totalAmount - booking.depositAmount)} />
          ) : null}
        </View>
        <BookingPricingDetails booking={booking} />

        {(booking.outstandingSurchargeAmount ?? 0) > 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Phụ phí còn nợ</Text>
            <Text style={styles.damage}>Còn nợ {formatMoney(booking.outstandingSurchargeAmount)} phụ phí. Vui lòng thanh toán để hoàn tất chuyến đi.</Text>
          </View>
        ) : null}

        {pendingTopUp != null && pendingTopUp.amount > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Cọc bổ sung (gia hạn)</Text>
            <Text style={styles.muted}>
              Cần thêm {formatMoney(pendingTopUp.amount)}
              {pendingTopUp.dueAt ? ` trước ${formatDateTime(pendingTopUp.dueAt)}` : ""} để giữ lịch gia hạn.
            </Text>
            <ActionButton
              theme={theme}
              label={actionBusy === "topup" ? "Đang tạo link..." : "Trả cọc bổ sung qua PayOS"}
              onPress={handlePayTopUp}
              disabled={!dataReady || actionBusy !== null}
            />
          </View>
        )}

        {status === "Approved" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đặt cọc giữ xe</Text>
            {booking.paymentDueAt ? <Text style={styles.muted}>Hạn cọc: {formatDateTime(booking.paymentDueAt)}. Quá hạn booking sẽ tự hủy.</Text> : null}
            {depositExpired ? (
              <Text style={styles.damage}>Booking không còn hiệu lực nhận cọc vì đã hết hạn thanh toán. Hệ thống sẽ tự hủy booking này.</Text>
            ) : (
              <>
                <ActionButton
                  theme={theme}
                  label={actionBusy === "wallet" ? "Đang trừ ví..." : `Trả bằng ví${walletBalance != null ? ` (${formatMoney(walletBalance)})` : ""}`}
                  onPress={handlePayWithWallet}
                  disabled={!dataReady || actionBusy !== null}
                />
                <ActionButton
                  theme={theme}
                  label={actionBusy === "payos" ? "Đang tạo link..." : "Trả qua PayOS"}
                  onPress={handlePayWithPayOs}
                  disabled={!dataReady || actionBusy !== null}
                  secondary
                />
                {pendingOrderCode != null && (
                  <Text style={styles.muted}>Đang chờ xác nhận giao dịch #{pendingOrderCode}...</Text>
                )}
              </>
            )}
          </View>
        )}

        {canCancel && (
          <ActionButton
            theme={theme}
            label="Hủy chuyến đi"
            onPress={handleCancel}
            disabled={!dataReady || actionBusy !== null}
            danger
          />
        )}

        <InspectionSummaryLink booking={booking} type="CheckIn" report={checkInReport} onPress={() => navigation.navigate("TripHandover", { bookingId, inspectionType: "CheckIn" })} />
        <InspectionSummaryLink booking={booking} type="CheckOut" report={checkOutReport} onPress={() => navigation.navigate("TripHandover", { bookingId, inspectionType: "CheckOut" })} />
        <OutstandingSurcharge booking={booking} report={checkOutReport} role="Customer" onUpdated={load} onOpenWallet={() => navigation.navigate("BookingWallet")} />
        <ContractBlock bookingStatus={booking.status} bookingId={booking.id} userId={userId} canManage={false} onChanged={() => load()} />

        {(status === "Cancelled" || status === "Rejected") && booking.cancelReason ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lý do {status === "Rejected" ? "từ chối" : "hủy"}</Text>
            <Text style={styles.muted}>{booking.cancelReason}</Text>
          </View>
        ) : null}

        <ReportBookingViolation key={`violation-${booking.id}`} bookingId={booking.id} bookingCode={booking.bookingCode} />
        <BookingAssistance key={booking.id} bookingId={booking.id} bookingCode={booking.bookingCode} />
        <ReportViolationButton target={{ targetType: "Booking", targetId: booking.id, label: booking.bookingCode }} />
        <BookingTimeline history={booking.statusHistory} />

        {status === "Completed" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đánh giá chuyến đi</Text>
            {!alreadyReviewed ? <>
              <Text style={styles.muted}>Đánh giá xe và chủ xe</Text>
              <RatingInput label="Đánh giá tổng quan (bắt buộc)" value={rating} onChange={setRating} styles={styles} />
              <RatingInput label="Vệ sinh (không bắt buộc)" value={cleanliness} onChange={setCleanliness} styles={styles} />
              <RatingInput label="Chính xác mô tả (không bắt buộc)" value={accuracy} onChange={setAccuracy} styles={styles} />
              <RatingInput label="Hỗ trợ (không bắt buộc)" value={support} onChange={setSupport} styles={styles} />
              <TextInput value={comment} onChangeText={setComment} placeholder="Chia sẻ trải nghiệm của bạn..." placeholderTextColor={theme.placeholder} multiline style={[styles.input, styles.multiline]} />
              <ActionButton theme={theme} label="Gửi đánh giá" onPress={handleReview} disabled={!dataReady || actionBusy !== null || rating === 0} />
            </> : null}
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
          </View>
        )}
        </>}
      </ScrollView>

      <CheckoutConfirmation booking={booking} report={checkoutToConfirm} busy={actionBusy !== null} onClose={() => setCheckoutToConfirm(null)} onConfirm={(report, paymentMethod) => {
        void runAction("checkout", () => confirmCheckOut(bookingId, report.version ?? 1, paymentMethod).then(() => undefined), "Đã xác nhận trả xe và ghi nhận phương thức thanh toán. Chủ xe cần xác nhận nhận lại xe để hoàn tất chuyến.").then(ok => { if (ok) setCheckoutToConfirm(null); });
      }} />
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
            <Text style={styles.cardTitle}>Hủy chuyến đi</Text>
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
              <Pressable onPress={() => setCancelQuote(null)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={submitCancel} disabled={actionBusy !== null} style={[styles.primaryButton, actionBusy !== null && styles.disabled]}>
                {actionBusy === "cancel" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>Xác nhận hủy</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={revisionOpen} transparent animationType="fade" onRequestClose={() => { if (!actionBusy) setRevisionOpen(false); }}>
        <View style={styles.modalBackdrop}><View style={styles.modal}>
          <Text style={styles.cardTitle}>Yêu cầu lập lại biên bản nhận xe</Text>
          <Text style={styles.muted}>Ghi rõ số km, nhiên liệu, ảnh hoặc tình trạng xe cần sửa. Chuyến chưa bắt đầu cho đến khi bạn đồng ý biên bản mới.</Text>
          <TextInput accessibilityLabel="Lý do yêu cầu lập lại" value={revisionReason} onChangeText={setRevisionReason} maxLength={1000} editable={!actionBusy} placeholder="Nội dung cần điều chỉnh..." placeholderTextColor={theme.placeholder} multiline style={[styles.input, styles.multiline]} />
          <ActionButton theme={theme} label="Gửi yêu cầu lập lại" disabled={!revisionReason.trim() || !dataReady || actionBusy !== null} onPress={() => {
            if (!checkInReport) return;
            void runAction("revision", () => requestCheckInRevision(bookingId, checkInReport.version ?? 1, revisionReason.trim()).then(() => undefined), "Đã gửi yêu cầu cho chủ xe.").then(ok => { if (ok) setRevisionOpen(false); });
          }} />
          <ActionButton theme={theme} label="Đóng" secondary disabled={actionBusy !== null} onPress={() => setRevisionOpen(false)} />
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
      <Text style={[rowStyles.value, tone === "success" && rowStyles.success, strong && rowStyles.strong]}>
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

function ActionButton({
  theme,
  label,
  onPress,
  disabled,
  secondary,
  danger,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[
        {
          borderRadius: 12,
          paddingVertical: 13,
          alignItems: "center",
          marginTop: 8,
          backgroundColor: danger ? theme.danger : secondary ? theme.surfaceAlt : theme.brand,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text
        style={{
          fontWeight: "800",
          fontSize: 15,
          color: danger ? "#fff" : secondary ? theme.text : theme.onBrand,
        }}
      >
        {label}
      </Text>
    </Pressable>
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
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    body: { padding: 16, gap: 12, paddingBottom: 32 },
    statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    disputeLink: { color: "#DC2626", fontSize: 13, fontWeight: "700" },
    status: { color: theme.brand, fontSize: 18, fontWeight: "800" },
    escrow: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    progressStrip: {
      borderRadius: 10,
      backgroundColor: theme.brandSoft,
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    progressOverdue: { backgroundColor: theme.dangerSoft },
    progressText: { color: theme.text, fontSize: 13, fontWeight: "700" },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 4 },
    bookingVehicleImage: { width: "100%", height: 210, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    vehicleCard: { backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 12, padding: 12, gap: 10 },
    bookingVehiclePlaceholder: { alignItems: "center", justifyContent: "center" },
    bookingVehiclePlaceholderText: { color: theme.brand, fontWeight: "800" },
    vehicleInfo: { gap: 3 },
    vehicleName: { color: theme.text, fontSize: 17, fontWeight: "800" },
    reviewItem: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingVertical: 8, gap: 6 },
    reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    reviewAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
    reviewAvatarText: { color: theme.brand, fontWeight: "800" },
    reviewName: { color: theme.text, fontSize: 13, fontWeight: "700" },
    reviewStars: { color: "#f59e0b", fontSize: 14 },
    reviewDate: { color: theme.muted, fontSize: 11 },
    reviewComment: { color: theme.text, fontSize: 13, marginLeft: 42 },
    muted: { color: theme.muted, fontSize: 13 },
    personRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 4,
    },
    personAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.brandSoft,
    },
    personAvatarText: { color: theme.brand, fontSize: 13, fontWeight: "900" },
    personName: { flex: 1, color: theme.brand, fontSize: 13, fontWeight: "700" },
    address: { color: theme.text, fontSize: 13, marginBottom: 4 },
    note: { color: theme.muted, fontSize: 13, fontStyle: "italic" },
    contractRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
    },
    contractInfo: { flex: 1, gap: 2 },
    contractVersion: { color: theme.text, fontSize: 14, fontWeight: "700" },
    contractActions: { flexDirection: "row", gap: 8 },
    smallButton: {
      borderRadius: 8,
      backgroundColor: theme.surfaceAlt,
      paddingHorizontal: 12,
      paddingVertical: 7,
    },
    smallButtonText: { color: theme.text, fontSize: 12, fontWeight: "800" },
    signButton: { backgroundColor: theme.brand },
    signButtonText: { color: theme.onBrand },
    stars: { flexDirection: "row", gap: 4, marginVertical: 6 },
    star: { padding: 4 },
    starText: { fontSize: 32, color: theme.border },
    starActive: { color: "#f59e0b" },
    input: {
      backgroundColor: theme.input,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: theme.text,
      fontSize: 15,
      letterSpacing: 4,
      textAlign: "center",
    },
    multiline: { minHeight: 70, textAlignVertical: "top", letterSpacing: 0, textAlign: "left" },
    modalBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: {
      width: "100%",
      backgroundColor: theme.surface,
      borderRadius: 14,
      padding: 18,
      gap: 10,
    },
    contentModal: { maxHeight: "85%" },
    contentScroll: { maxHeight: 420 },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    reportBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingVertical: 8,
      gap: 2,
    },
    reportTitle: { color: theme.text, fontSize: 14, fontWeight: "700" },
    damage: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    thumbs: { flexDirection: "row", marginTop: 6 },
    thumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8, backgroundColor: theme.surfaceAlt },
    fullBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    fullImage: { width: "100%", height: "80%" },
    fullHint: { color: "#fff", fontSize: 12, marginTop: 10 },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: theme.muted, fontWeight: "700" },
    primaryButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 18,
      paddingVertical: 10,
      minWidth: 110,
      alignItems: "center",
    },
    primaryText: { color: theme.onBrand, fontWeight: "800" },
    disabled: { opacity: 0.6 },
  });
