import ReportBookingViolation from "../components/ReportBookingViolation";
import { bookingActions } from "../bookingActions";
import InspectionSummaryLink from "../components/InspectionSummaryLink";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import { checkoutStartDate } from "../bookingDisplay";
import { getPendingTopUp, type BookingTopUpPendingResponse } from "@/features/payments/services/paymentService";
import InspectionFormScreen from "./InspectionFormScreen";
import { useBookingNotificationRefresh } from "../useBookingNotificationRefresh";
import BookingAssistance from "../components/BookingAssistance";
import ReportViolationButton from "@/features/violations/ReportViolationButton";
import ReturnProgress from "../components/ReturnProgress";
import InspectionReportCard from "../components/InspectionReportCard";
import CheckoutEditor from "../components/CheckoutEditor";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AppState,
  ActivityIndicator,
  Alert,
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
import type { OwnerBookingsStackParamList } from "@/navigation/OwnerBookingsNavigator";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  approveBooking,
  cancelBookingByOwner,
  confirmReceipt,
  rejectBooking,
  requestSettlement,
} from "@/features/booking/bookingOwnerService";
import {
  getBookingById,
  getInspectionReports,
} from "@/features/booking/bookingService";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";
import { bookingStatusLabel, escrowHoldInfo, formatDateTime, formatMoney, rentalProgress } from "@/features/booking/utils/format";
import RiskScoreBadge from "@/features/booking/components/RiskScoreBadge";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import ContractBlock from "@/features/contracts/components/ContractBlock";
import BookingTimeline from "@/features/booking/components/BookingTimeline";
import BookingPricingDetails from "@/features/booking/components/BookingPricingDetails";
import { createOwnerReview, getBookingReviews, hasReviewed, type ReviewResponse } from "@/features/review/reviewService";
import { getApiErrorMessage } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useFocusEffect } from "@react-navigation/native";
import { BookingButton } from "../components/BookingControls";
import { OutstandingSurcharge } from "../components/CheckoutSummary";
import { parseServerDate } from "../bookingDisplay";
import { getPendingAutoCancelHours } from "@/features/systemConfig/configService";
import { getPublicVehicleImages } from "@/features/vehicles/services/publicVehicleService";

type DetailRoute = RouteProp<OwnerBookingsStackParamList, "OwnerBookingDetail" | "OwnerBookingHandover">;
type DetailNav = NativeStackNavigationProp<OwnerBookingsStackParamList>;

export default function OwnerBookingDetailScreen({
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
  const handleBack = () => goBackOrFallback(navigation, () => navigation.replace("OwnerBookingList"));
  const userId = useAuthStore((s) => s.user?.userId ?? 0);

  const loadId = useRef(0);
  const [dataReady, setDataReady] = useState(false);
  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<InspectionReportResponse[]>([]);
  const [bookingReviews, setBookingReviews] = useState<ReviewResponse[]>([]);
  const [pendingTopUp, setPendingTopUp] = useState<BookingTopUpPendingResponse | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [reasonModal, setReasonModal] = useState<null | { mode: "reject" | "cancel" }>(null);
  const [reason, setReason] = useState("");
  const [form, setForm] = useState<"CheckIn" | "CheckOut" | null>(null);
  const [now, setNow] = useState(Date.now());
  const actionLock = useRef(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [autoCancelHours, setAutoCancelHours] = useState<number | null>(null);

  const load = useCallback(async () => {
    const request = ++loadId.current;
    try {
      const data = await getBookingById(bookingId);
      setVehiclePhoto(data.vehicleImage || null);
      if (!data.vehicleImage) {
        void getPublicVehicleImages(data.vehicleId).then((images) => {
          const photo = [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0];
          if (photo?.imageUrl) setVehiclePhoto(photo.imageUrl);
        }).catch(() => undefined);
      }
      const [list, reviewed, topUp, reviewList] = await Promise.all([
        getInspectionReports(bookingId),
        hasReviewed(bookingId).catch(() => true),
        getPendingTopUp(bookingId).catch(() => null),
        getBookingReviews(bookingId).catch(() => [] as ReviewResponse[]),
      ]);
      if (request !== loadId.current) return;
      setBooking(data); setDataReady(true);
      setReports(list); setPendingTopUp(topUp);
      setAlreadyReviewed(reviewed);
      setBookingReviews(reviewList);
      if (data.status === "Pending") {
        getPendingAutoCancelHours()
          .then((h) => setAutoCancelHours(h))
          .catch(() => setAutoCancelHours(24));
      }
    } catch (err) {
      if (request !== loadId.current) return;
      setDataReady(false);
      Alert.alert("Lỗi", getApiErrorMessage(err, "Không tải được chi tiết đơn thuê."));
    } finally {
      if (request === loadId.current) setLoading(false);
    }
  }, [bookingId]);

  useBookingNotificationRefresh(bookingId, useCallback(() => { if (!actionLock.current && !form) void load(); }, [load, form]));
  useFocusEffect(useCallback(() => { void load(); return () => { loadId.current++; }; }, [load]));
  useEffect(() => {
    const timer = setInterval(() => { setNow(Date.now()); if (!actionLock.current && !form) void load(); }, 30000);
    const sub = AppState.addEventListener("change", state => { if (state === "active" && !actionLock.current && !form) void load(); });
    return () => { clearInterval(timer); sub.remove(); };
  }, [load, form]);

  async function runAction(key: string, fn: () => Promise<void>, success?: string, onError?: (message: string) => void): Promise<boolean> {
    if (actionLock.current || !dataReady) return false;
    actionLock.current = true;
    setBusy(key);
    try {
      await fn();
      await load();
      if (success) Alert.alert("Thành công", success);
      return true;
    } catch (err) {
      const message = getApiErrorMessage(err, "Vui lòng thử lại sau.");
      onError?.(message);
      Alert.alert("Thất bại", message);
      return false;
    } finally {
      actionLock.current = false;
      setBusy(null);
    }
  }

  function backToList(message: string) {
    Alert.alert("Thành công", message, [{ text: "Về danh sách", onPress: handleBack }]);
  }

  async function submitReason() {
    if (!reasonModal || !reason.trim()) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do.");
      return;
    }
    const mode = reasonModal.mode;
    setReasonModal(null);
    if (mode === "reject") {
      const ok = await runAction("reject", () => rejectBooking(bookingId, reason.trim()).then(() => undefined));
      if (ok) backToList("Đã từ chối đơn thuê.");
    } else {
      const ok = await runAction("cancel", () => cancelBookingByOwner(bookingId, reason.trim()).then(() => undefined));
      if (ok) backToList("Đã hủy. Toàn bộ cọc hoàn vào ví khách.");
    }
    setReason("");
  }

  if (form && booking) return <InspectionFormScreen booking={booking} reports={reports} type={form}
    onBack={() => setForm(null)} onSaved={() => { setForm(null); void load(); }} />;

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <ArrowLeft color={theme.text} size={20} />
          </Pressable>
          <Text style={styles.headerTitle}>Chi tiết đơn thuê</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={theme.brand} /> : <Text style={styles.muted}>Không tải được.</Text>}
        </View>
      </View>
    );
  }

  const status = booking.status;
  const actions = bookingActions(booking, reports, "Owner", now);
  const pickupReached = parseServerDate(checkoutStartDate(booking)).getTime() <= now;
  const checkInReport = reports.find((r) => r.type === "CheckIn");
  const checkOutReport = reports.find((r) => r.type === "CheckOut");
  const hold = escrowHoldInfo(checkOutReport?.createdAt, booking.completedAt);
  const progress = status === "InProgress" || status === "Returning"
    ? rentalProgress(booking.startDate, booking.endDate)
    : null;

  const checkInActions = <>
        {actions.createCheckIn && (
          <ActionButton theme={theme} label={checkInReport?.requiresRevision ? "Lập lại và gửi biên bản nhận xe" : "Lập biên bản nhận xe"} onPress={() => setForm("CheckIn")} disabled={!dataReady || busy !== null} />
        )}
        {status === "DepositPaid" && !checkInReport && !pickupReached && booking.canCheckInNow === true ? (
          <Text style={styles.muted}>Xe trống: có thể nhận sớm tối đa 2 tiếng. Bạn có thể lập biên bản nhận xe ngay. Giờ trả và giá thuê giữ theo booking.</Text>
        ) : null}

        {status === "DepositPaid" && !checkInReport && booking.canCheckInNow !== true ? <Text style={styles.muted}>{booking.checkInUnavailableReason || "Tải lại để kiểm tra khả năng nhận xe."}{booking.checkInOpensAt ? ` Mở nhận sớm từ ${formatDateTime(booking.checkInOpensAt)}.` : ""}</Text> : null}
  </>;
  const checkOutActions = <>
    <ReturnProgress booking={booking} report={checkOutReport} role="Owner" />
    <OutstandingSurcharge booking={booking} report={checkOutReport} role="Owner" onUpdated={load} />
        {actions.createCheckOut && (
          <ActionButton theme={theme} label="Lập biên bản trả xe" onPress={() => setForm("CheckOut")} disabled={!dataReady || busy !== null} />
        )}

        {checkOutReport ? <CheckoutEditor booking={booking} report={checkOutReport} initialKm={checkInReport?.odometerKm} onSaved={load} /> : null}

        {actions.confirmReceipt && (
          <ActionButton theme={theme} label="Xác nhận đã nhận xe" onPress={() => runAction("receipt", () => confirmReceipt(bookingId, {}).then(() => undefined), "Đã xác nhận nhận xe.")} disabled={!dataReady || busy !== null} />
        )}


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
        <Pressable accessibilityRole="button" accessibilityLabel="Nhắn tin với khách thuê" onPress={() => navigation.navigate("BookingChat", { bookingId })} style={styles.backButton}><MessageSquare color={theme.brand} size={22} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {handover ? <>
          <Text style={styles.cardTitle}>{booking.bookingCode}</Text>
          <BookingButton secondary title="Tải lại biên bản" disabled={busy !== null} onPress={() => void load()} />
          {!dataReady && <Text accessibilityRole="alert" style={styles.muted}>Chưa tải được dữ liệu mới. Tải lại trước khi thao tác.</Text>}
          <Text style={styles.muted}>Kiểm tra biên bản, ảnh xe và các khoản thanh toán trước khi xác nhận.</Text>
          {(handover === "CheckIn" ? checkInReport : checkOutReport) ? <InspectionReportCard booking={booking} report={(handover === "CheckIn" ? checkInReport : checkOutReport)!} /> : <Text style={styles.muted}>Chưa có biên bản. Thao tác khả dụng sẽ xuất hiện theo trạng thái chuyến đi.</Text>}
          {handover === "CheckIn" ? checkInActions : checkOutActions}
        </> : <>

        <View style={styles.vehicleCard}>
          {vehiclePhoto ? <Image source={{ uri: vehiclePhoto }} style={styles.vehiclePhoto} resizeMode="cover" /> : <View style={styles.vehiclePhotoPlaceholder}><Text style={styles.vehiclePhotoPlaceholderText}>Xe MoveVN</Text></View>}
          <View style={styles.vehicleInfo}>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate("VehicleDetail", { vehicleId: booking.vehicleId })}><Text style={styles.vehicleName}>{booking.vehicleName || `Xe #${booking.vehicleId}`}</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate("BookingUserProfile", { userId: booking.ownerId })}><Text style={{ color: theme.brand, fontWeight: "600" }}>Chủ xe: {booking.ownerName || `#${booking.ownerId}`}</Text></Pressable>
            <Pressable accessibilityRole="link" onPress={() => navigation.navigate("BookingUserProfile", { userId: booking.customerId })}><Text style={{ color: theme.brand, fontWeight: "600" }}>Khách thuê: {booking.customerName || `#${booking.customerId}`}</Text></Pressable>
            <Text style={styles.muted}>Ngày yêu cầu: {formatDateTime(booking.createdAt)}</Text>
          </View>
        </View>
        <BookingButton secondary title="Tải lại đơn thuê" disabled={busy !== null} onPress={() => void load()} />
        {!dataReady ? <Text accessibilityRole="alert" style={styles.muted}>Không tải được dữ liệu mới. Quay lại màn hoặc tải lại trước khi thao tác.</Text> : null}
        <View style={styles.statusRow}>
          <Text style={styles.status}>{bookingStatusLabel(status)}</Text>
          {booking.escrowStatus === "Held" && <Text style={styles.escrow}>Giữ cọc {formatMoney(booking.escrowAmount)}</Text>}
        </View>
        <ReturnProgress booking={booking} report={checkOutReport} role="Owner" />
        <OutstandingSurcharge booking={booking} report={checkOutReport} role="Owner" onUpdated={load} />
        {progress && (
          <View style={[styles.progressStrip, progress.overdue && styles.progressOverdue]}>
            <Text style={styles.progressText}>{progress.summary}</Text>
          </View>
        )}
        {(status === "InProgress" || status === "Returning") && (
          <BookingButton secondary title="Xem vị trí xe (GPS)" disabled={busy !== null} onPress={() => navigation.navigate("OwnerTracking", { bookingId, vehicleName: booking.vehicleName })} />
        )}

        <View style={styles.statusRow}>
          <RiskScoreBadge score={booking.riskScore} />
          {onOpenDisputes ? (
            <Pressable onPress={() => onOpenDisputes({ bookingId: booking.id })}>
              <Text style={styles.disputeLink}>Tranh chấp / khiếu nại</Text>
            </Pressable>
          ) : null}
        </View>

        {status === "Pending" && (booking.riskFactors ?? []).length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Yếu tố rủi ro khách thuê</Text>
            {(booking.riskFactors ?? []).map((f) => (
              <Text key={f} style={styles.muted}>
                • {f}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch trình & địa điểm</Text>
          <Row label="Nhận xe" value={formatDateTime(booking.startDate)} />
          <Text style={styles.address}>{booking.pickupAddress}</Text>
          {booking.deliveryDistanceKm != null ? (
            <Text style={styles.muted}>
              Cách vị trí xe {booking.deliveryDistanceKm} km{booking.deliveryFee > 0 ? ` · Phí giao xe ${formatMoney(booking.deliveryFee)}` : " · Miễn phí giao xe"}
            </Text>
          ) : null}
          <Row label="Trả xe" value={formatDateTime(booking.endDate)} />
          <Text style={styles.address}>{booking.returnAddress || booking.pickupAddress}</Text>
          {onOpenUserProfile && booking.customerId ? (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Xem hồ sơ khách thuê ${booking.customerName || ""}`}
              onPress={() => onOpenUserProfile(booking.customerId)}
              style={styles.personRow}
            >
              <View style={styles.personAvatar}>
                <AppText style={styles.personAvatarText}>
                  {(booking.customerName || "K").charAt(0).toUpperCase()}
                </AppText>
              </View>
              <View style={styles.personText}>
                <AppText style={styles.personLabel}>Khách thuê</AppText>
                <AppText style={styles.personName} numberOfLines={1}>
                  {booking.customerName?.trim() || `Khách hàng #${booking.customerId}`}
                </AppText>
              </View>
              <ChevronRight color={theme.muted} size={16} />
            </Pressable>
          ) : (
            <Row label="Khách thuê" value={booking.customerName?.trim() || `#${booking.customerId}`} />
          )}
          {booking.customerNote ? <Text style={styles.note}>Ghi chú khách: {booking.customerNote}</Text> : null}
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
          <Row label="Phí nền tảng" value={formatMoney(booking.platformFee)} />
          <Row label="Tổng cộng" value={formatMoney(booking.totalAmount)} strong />
          <Row label="Tiền cọc giữ" value={formatMoney(booking.depositAmount)} />
        </View>
        <BookingPricingDetails booking={booking} />

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch thanh toán</Text>
          <Row
            label={(["DepositPaid", "Confirmed", "InProgress", "Completed"].includes(status)) ? "Đã chuyển tiền cọc" : "Cần chuyển tiền cọc"}
            value={formatMoney(booking.depositAmount)}
          />
          {booking.totalAmount > booking.depositAmount ? (
            <Row label="Khách trả khi nhận xe" value={formatMoney(booking.totalAmount - booking.depositAmount)} />
          ) : null}
          {booking.paymentDueAt && status === "Approved" ? <Text style={styles.muted}>Hạn thanh toán cọc: {formatDateTime(booking.paymentDueAt)}</Text> : null}
          {booking.securityDepositAmount > 0 ? (
            <Row label="Tiền thế chấp hoàn lại khi trả xe" value={formatMoney(booking.securityDepositAmount)} />
          ) : null}
        </View>

        {status === "Pending" && autoCancelHours != null && booking.createdAt ? (
          <Text style={styles.muted}>
            Vui lòng phản hồi trước {formatDateTime(new Date(new Date(booking.createdAt).getTime() + autoCancelHours * 3600000).toISOString())}. Quá {autoCancelHours} giờ hệ thống sẽ tự động từ chối.
          </Text>
        ) : null}

        {actions.approve && userId === booking.ownerId && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => runAction("approve", () => approveBooking(bookingId).then(() => undefined), "Đã duyệt. Hợp đồng tự tạo để 2 bên ký.")}
              disabled={!dataReady || busy !== null}
              style={[styles.flexButton, styles.primaryButton, busy !== null && styles.disabled]}
            >
              <Text style={styles.primaryText}>{busy === "approve" ? "..." : "Duyệt"}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setReason(""); setReasonModal({ mode: "reject" }); }}
              disabled={!dataReady || busy !== null}
              style={[styles.flexButton, styles.dangerButton, busy !== null && styles.disabled]}
            >
              <Text style={styles.primaryText}>Từ chối</Text>
            </Pressable>
          </View>
        )}

        {actions.cancel && (
          <ActionButton theme={theme} label="Hủy booking (hoàn 100% cọc)" onPress={() => { setReason(""); setReasonModal({ mode: "cancel" }); }} disabled={!dataReady || busy !== null} danger />
        )}

        <InspectionSummaryLink type="CheckIn" report={checkInReport} onPress={() => navigation.navigate("OwnerBookingHandover", { bookingId, inspectionType: "CheckIn" })} />
        <InspectionSummaryLink type="CheckOut" report={checkOutReport} onPress={() => navigation.navigate("OwnerBookingHandover", { bookingId, inspectionType: "CheckOut" })} />
        {status === "Completed" && booking.escrowStatus === "Held" && (
          hold.withinHoldWindow ? (
            <Text style={styles.muted}>Tiền cọc đang giữ để đối soát. Còn khoảng {hold.remainingHours} giờ nữa mới được giải ngân.</Text>
          ) : (
            <ActionButton theme={theme} label="Giải ngân tiền cọc" onPress={() => runAction("settle", () => requestSettlement(bookingId).then(() => undefined), "Đã giải ngân escrow.")} disabled={!dataReady || busy !== null || !actions.settle} />
          )
        )}



        {pendingTopUp && pendingTopUp.amount > 0 ? <View style={styles.card}><Text style={styles.cardTitle}>Chờ cọc bổ sung để gia hạn</Text><Text style={styles.muted}>Khách cần thanh toán {formatMoney(pendingTopUp.amount)}{pendingTopUp.dueAt ? ` trước ${formatDateTime(pendingTopUp.dueAt)}` : ""}. Nếu quá hạn, yêu cầu gia hạn bị hủy và hợp đồng cũ tiếp tục hiệu lực.</Text></View> : null}
        <ContractBlock bookingStatus={booking.status} bookingId={booking.id} userId={userId} canManage onChanged={() => load()} />

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

        {status === "Completed" && !alreadyReviewed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đánh giá khách thuê</Text>
            <Text style={styles.muted}>Chọn số sao tổng quan (bắt buộc)</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} accessibilityRole="button" accessibilityLabel={`${s} sao`} onPress={() => setRating(s)} style={styles.star}>
                  <Text style={[styles.starText, s <= rating && styles.starActive]}>★</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder="Nhận xét về khách..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />
            <ActionButton
              theme={theme}
              label="Gửi đánh giá"
              onPress={() =>
                rating < 1
                  ? Alert.alert("Thiếu đánh giá", "Vui lòng chọn từ 1 đến 5 sao.")
                  : runAction("review", () => createOwnerReview({ bookingId, rating, comment: comment.trim() || undefined }).then(() => undefined), "Cảm ơn đánh giá của bạn.")
              }
              disabled={!dataReady || busy !== null}
            />
          </View>
        )}
        {status === "Completed" && alreadyReviewed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đánh giá khách thuê</Text>
            {bookingReviews.filter((review) => review.reviewType === "Owner").map((review) => (
              <View key={review.id} style={styles.reviewItem}>
                <View style={styles.reviewHeader}>
                  {review.reviewerAvatar ? <Image source={{ uri: review.reviewerAvatar }} style={styles.reviewAvatar} /> : <View style={styles.reviewAvatarFallback}><Text style={styles.reviewAvatarText}>{(review.reviewerName || "C").slice(0, 1).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewName}>{review.reviewerName || "Chủ xe"}</Text>
                    <Text style={styles.reviewStars}>{"★".repeat(review.rating)}{"☆".repeat(Math.max(0, 5 - review.rating))}</Text>
                  </View>
                  <Text style={styles.reviewDate}>{new Date(review.createdAt).toLocaleDateString("vi-VN")}</Text>
                </View>
                {review.comment ? <Text style={styles.reviewComment}>{review.comment}</Text> : null}
              </View>
            ))}
            {bookingReviews.filter((review) => review.reviewType === "Owner").length === 0 ? <Text style={styles.muted}>Bạn đã gửi đánh giá cho booking này.</Text> : null}
          </View>
        )}
        </>}
      </ScrollView>

      <Modal visible={reasonModal !== null} transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.cardTitle}>{reasonModal?.mode === "reject" ? "Từ chối đơn thuê" : "Hủy booking"}</Text>
            {reasonModal?.mode === "cancel" && (
              <Text style={styles.muted}>Toàn bộ tiền cọc sẽ hoàn 100% vào ví khách.</Text>
            )}
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder="Nhập lý do..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />
            <View style={styles.modalActions}>
              <Pressable onPress={() => setReasonModal(null)} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={submitReason} style={styles.primaryButton}>
                <Text style={styles.primaryText}>Xác nhận</Text>
              </Pressable>
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
  danger,
}: {
  theme: Theme;
  label: string;
  onPress: () => void;
  disabled?: boolean;
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
          backgroundColor: danger ? theme.danger : theme.brand,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
    >
      <Text style={{ fontWeight: "800", fontSize: 15, color: "#fff" }}>{label}</Text>
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
    vehicleCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: theme.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border, borderRadius: 12, padding: 12 },
    vehiclePhoto: { width: 120, height: 92, borderRadius: 9, backgroundColor: theme.surfaceAlt },
    vehiclePhotoPlaceholder: { width: 120, height: 92, borderRadius: 9, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
    vehiclePhotoPlaceholderText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    vehicleInfo: { flex: 1, gap: 4 },
    vehicleName: { color: theme.text, fontSize: 16, fontWeight: "800" },
    reviewItem: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border, paddingVertical: 8, gap: 6 },
    reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    reviewAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
    reviewAvatarText: { color: theme.brand, fontWeight: "800" },
    reviewName: { color: theme.text, fontSize: 13, fontWeight: "700" },
    reviewStars: { color: "#f59e0b", fontSize: 14 },
    reviewDate: { color: theme.muted, fontSize: 11 },
    reviewComment: { color: theme.text, fontSize: 13, marginLeft: 42 },
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
    riskScore: { color: theme.text, fontSize: 16, fontWeight: "800", marginBottom: 4 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    cardTitle: { color: theme.text, fontSize: 15, fontWeight: "800", marginBottom: 4 },
    muted: { color: theme.muted, fontSize: 13 },
    personRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingVertical: 6,
      marginTop: 4,
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
    personText: { flex: 1, minWidth: 0, gap: 1 },
    personLabel: { color: theme.muted, fontSize: 11 },
    personName: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    address: { color: theme.text, fontSize: 13, marginBottom: 4 },
    note: { color: theme.muted, fontSize: 13, fontStyle: "italic" },
    actionRow: { flexDirection: "row", gap: 10 },
    flexButton: { flex: 1, borderRadius: 12, paddingVertical: 13, alignItems: "center" },
    primaryButton: { borderRadius: 10, backgroundColor: theme.brand, paddingHorizontal: 18, paddingVertical: 10, minWidth: 110, alignItems: "center" },
    dangerButton: { backgroundColor: theme.danger },
    primaryText: { color: "#fff", fontWeight: "800" },
    disabled: { opacity: 0.5 },
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
      fontSize: 14,
    },
    multiline: { minHeight: 70, textAlignVertical: "top" },
    fieldLabel: { color: theme.text, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 2 },
    switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
    photoButton: {
      marginTop: 10,
      borderRadius: 10,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: theme.brand,
      paddingVertical: 12,
      alignItems: "center",
    },
    photoButtonText: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    formError: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    thumbs: { flexDirection: "row", marginTop: 8 },
    thumb: { width: 92, height: 92, borderRadius: 8, backgroundColor: theme.surfaceAlt },
    thumbRemove: {
      position: "absolute",
      right: 2,
      top: 2,
      width: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: "rgba(0,0,0,0.6)",
      alignItems: "center",
      justifyContent: "center",
    },
    thumbRemoveText: { color: "#fff", fontSize: 12, fontWeight: "800" },
    exportContainer: { position: "absolute", left: -10000, top: 0 },
    stampPill: {
      position: "absolute",
      right: 12,
      bottom: 12,
      backgroundColor: "rgba(0,0,0,0.62)",
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 10,
      maxWidth: "86%",
    },
    thumbWrap: { marginRight: 8, gap: 2, maxWidth: 80 },
    thumbTime: { color: theme.muted, fontSize: 10 },
    reportBlock: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.border,
      paddingVertical: 8,
      gap: 2,
    },
    reportTitle: { color: theme.text, fontSize: 14, fontWeight: "700" },
    damage: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.5)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 14, padding: 18, gap: 10 },
    tallModal: { maxHeight: "88%" },
    modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: theme.muted, fontWeight: "700" },
    fullBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.92)",
      alignItems: "center",
      justifyContent: "center",
      padding: 16,
    },
    fullImage: { width: "100%", height: "80%" },
    fullHint: { color: "#fff", fontSize: 12, marginTop: 10 },
  });
