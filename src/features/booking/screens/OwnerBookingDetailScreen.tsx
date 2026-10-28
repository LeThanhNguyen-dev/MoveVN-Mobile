import ReportBookingViolation from "../components/ReportBookingViolation";
import { bookingActions } from "../bookingActions";
import InspectionSummaryLink from "../components/InspectionSummaryLink";
import { goBackOrFallback } from "@/navigation/goBackOrFallback";
import { checkoutStartDate } from "../bookingDisplay";
import { getPendingTopUp, type BookingTopUpPendingResponse } from "@/features/payments/services/paymentService";
import InspectionFormScreen from "./InspectionFormScreen";
import { useBookingNotificationRefresh } from "../useBookingNotificationRefresh";
import BookingAssistance from "../components/BookingAssistance";
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
import { CalendarDays, CircleCheck, ClipboardCheck, Clock3, KeyRound, MapPin, MessageSquare, PackageCheck, ReceiptText, RotateCcw, Star, TriangleAlert, Wallet, XCircle } from "lucide-react-native";
import { detailFont as font, useDetailTheme } from "@/features/vehicles/components/detail/detailTheme";
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
import { escrowHoldInfo, formatDateTime, formatMoney, rentalProgress } from "@/features/booking/utils/format";
import RiskScoreBadge from "@/features/booking/components/RiskScoreBadge";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import ContractBlock from "@/features/contracts/components/ContractBlock";
import BookingTimeline from "@/features/booking/components/BookingTimeline";
import BookingPricingDetails from "@/features/booking/components/BookingPricingDetails";
import { createOwnerReview, getBookingReviews, hasReviewed, type ReviewResponse } from "@/features/review/reviewService";
import { getApiErrorMessage } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import { useFocusEffect } from "@react-navigation/native";
import { OutstandingSurcharge } from "../components/CheckoutSummary";
import { DetailButton, DetailCard, DetailHeader, DetailNotice, DetailPill, DetailRow, DetailSectionHeader } from "../components/detail/BookingDetailUI";
import BookingSummaryCard from "../components/detail/BookingSummaryCard";
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
  const { p } = useDetailTheme();
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
  const [reviewOpen, setReviewOpen] = useState(false);

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
        <DetailHeader
          kicker="Đơn cho thuê"
          title={handover ? (handover === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out") : "Chi tiết đơn thuê"}
          onBack={handleBack}
        />
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
  const progressPercent = progress ? Math.min(100, Math.max(0, Math.round((progress.elapsedDays / progress.totalDays) * 100))) : 0;
  const remainingAmount = Math.max(0, booking.totalAmount - booking.depositAmount);
  const activeHandoverReport = handover === "CheckIn" ? checkInReport : checkOutReport;

  const checkInActions = <>
        {actions.createCheckIn && (
          <DetailButton icon={ClipboardCheck} label={checkInReport?.requiresRevision ? "Lập lại và gửi biên bản nhận xe" : "Lập biên bản nhận xe"} onPress={() => setForm("CheckIn")} disabled={!dataReady || busy !== null} />
        )}
        {status === "DepositPaid" && !checkInReport && !pickupReached && booking.canCheckInNow === true ? (
          <Text style={styles.hint}>Xe trống: có thể nhận sớm tối đa 2 tiếng. Bạn có thể lập biên bản nhận xe ngay. Giờ trả và giá thuê giữ theo booking.</Text>
        ) : null}

        {status === "DepositPaid" && !checkInReport && booking.canCheckInNow !== true ? <Text style={styles.hint}>{booking.checkInUnavailableReason || "Tải lại để kiểm tra khả năng nhận xe."}{booking.checkInOpensAt ? ` Mở nhận sớm từ ${formatDateTime(booking.checkInOpensAt)}.` : ""}</Text> : null}
  </>;
  const checkOutActions = <>
    <ReturnProgress booking={booking} report={checkOutReport} role="Owner" />
    <OutstandingSurcharge booking={booking} report={checkOutReport} role="Owner" onUpdated={load} />
        {actions.createCheckOut && (
          <DetailButton icon={PackageCheck} label="Lập biên bản trả xe" onPress={() => setForm("CheckOut")} disabled={!dataReady || busy !== null} />
        )}

        {checkOutReport ? <CheckoutEditor booking={booking} report={checkOutReport} initialKm={checkInReport?.odometerKm} onSaved={load} /> : null}

        {actions.confirmReceipt && (
          <DetailButton icon={CircleCheck} label="Xác nhận đã nhận xe" onPress={() => runAction("receipt", () => confirmReceipt(bookingId, {}).then(() => undefined), "Đã xác nhận nhận xe.")} disabled={!dataReady || busy !== null} />
        )}


  </>;

  return (
    <View style={styles.screen}>
      <DetailHeader
        kicker="Đơn cho thuê"
        title={handover ? (handover === "CheckIn" ? "Nhận xe · Check-in" : "Trả xe · Check-out") : "Chi tiết đơn thuê"}
        onBack={handleBack}
        right={
          <Pressable accessibilityRole="button" accessibilityLabel="Nhắn tin với khách thuê" onPress={() => navigation.navigate("BookingChat", { bookingId })} style={styles.headerChat}>
            <MessageSquare color={theme.brand} size={18} strokeWidth={2.1} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {handover ? (
          <View style={styles.body}>
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
                  label={activeHandoverReport ? (activeHandoverReport.isCustomerConfirmed ? "Đã xác nhận" : activeHandoverReport.requiresRevision ? "Cần lập lại" : "Chờ khách xác nhận") : "Chưa có biên bản"}
                  tone={activeHandoverReport ? (activeHandoverReport.isCustomerConfirmed ? "mint" : activeHandoverReport.requiresRevision ? "danger" : "warn") : "neutral"}
                />
              </View>
              <DetailButton variant="ghost" icon={RotateCcw} label="Tải lại biên bản" disabled={busy !== null} onPress={() => void load()} />
            </DetailCard>

            {!dataReady ? <DetailNotice icon={TriangleAlert} title="Chưa tải được dữ liệu mới" tone="warn">Tải lại trước khi thao tác.</DetailNotice> : null}

            {activeHandoverReport ? (
              <InspectionReportCard booking={booking} report={activeHandoverReport} />
            ) : (
              <DetailCard>
                <DetailSectionHeader
                  icon={handover === "CheckIn" ? KeyRound : PackageCheck}
                  title="Chưa có biên bản"
                  subtitle="Biên bản sẽ xuất hiện khi bạn lập"
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
          </View>
        ) : <>

        <BookingSummaryCard
          booking={booking}
          imageUri={vehiclePhoto}
          onOpenVehicle={() => navigation.navigate("VehicleDetail", { vehicleId: booking.vehicleId })}
          onOpenUserProfile={(id) => (onOpenUserProfile ? onOpenUserProfile(id) : navigation.navigate("BookingUserProfile", { userId: id }))}
        />
        <View style={styles.body}>
        {!dataReady ? <DetailNotice icon={TriangleAlert} title="Chưa tải được dữ liệu mới" tone="warn">Quay lại màn hoặc tải lại trước khi thao tác.</DetailNotice> : null}

        <View style={styles.toolbarRow}>
          <DetailButton variant="ghost" icon={RotateCcw} label="Tải lại" disabled={busy !== null} onPress={() => void load()} style={styles.toolbarButton} />
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

        {progress && (
          <DetailCard style={styles.progressCard}>
            <View style={styles.progressHead}>
              <View style={styles.progressTitleWrap}>
                <View style={styles.progressIcon}>
                  <Clock3 color={p.brand} size={15} strokeWidth={2.1} />
                </View>
                <Text style={styles.progressTitle}>{progress.overdue ? "Khách đã quá hạn trả xe" : "Đang trong chuyến"}</Text>
              </View>
              <DetailPill label={progress.overdue ? "Quá hạn" : `Ngày ${progress.currentDay}/${progress.totalDays}`} tone={progress.overdue ? "danger" : "brand"} />
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progressPercent}%` }, progress.overdue && styles.progressFillOverdue]} />
            </View>
            <Text style={styles.progressText}>{progress.summary}</Text>
          </DetailCard>
        )}

        {(status === "InProgress" || status === "Returning") && (
          <DetailButton variant="secondary" icon={MapPin} label="Xem vị trí xe (GPS)" disabled={busy !== null} onPress={() => navigation.navigate("OwnerTracking", { bookingId, vehicleName: booking.vehicleName })} />
        )}
        {status === "Completed" && (
          <DetailButton variant="secondary" icon={CalendarDays} label="Xem hành trình chuyến đi" disabled={busy !== null} onPress={() => navigation.navigate("OwnerPlayback", { bookingId, vehicleName: booking.vehicleName })} />
        )}

        <ReturnProgress booking={booking} report={checkOutReport} role="Owner" />

        {status === "Pending" ? (
          <DetailCard>
            <DetailSectionHeader
              icon={CircleCheck}
              title="Yêu cầu thuê đang chờ duyệt"
              subtitle="Phản hồi sớm để khách kịp đặt cọc"
            />
            {autoCancelHours != null && booking.createdAt ? (
              <DetailNotice icon={Clock3} title="Hạn phản hồi" tone="warn">
                Vui lòng phản hồi trước {formatDateTime(new Date(new Date(booking.createdAt).getTime() + autoCancelHours * 3600000).toISOString())}. Quá {autoCancelHours} giờ hệ thống sẽ tự động từ chối đơn.
              </DetailNotice>
            ) : null}
            {(booking.riskFactors ?? []).length > 0 ? (
              <View style={styles.riskBlock}>
                <Text style={styles.riskTitle}>Yếu tố rủi ro khách thuê</Text>
                {(booking.riskFactors ?? []).map((f) => (
                  <Text key={f} style={styles.bullet}>
                    • {f}
                  </Text>
                ))}
              </View>
            ) : null}
            {actions.approve && userId === booking.ownerId ? (
              <View style={styles.actionRow}>
                <DetailButton
                  icon={CircleCheck}
                  label={busy === "approve" ? "Đang duyệt..." : "Duyệt đơn thuê"}
                  onPress={() => void runAction("approve", () => approveBooking(bookingId).then(() => undefined), "Đã duyệt. Hợp đồng tự tạo để 2 bên ký.")}
                  disabled={!dataReady || busy !== null}
                  style={styles.flexButton}
                />
                <DetailButton
                  variant="secondary"
                  icon={XCircle}
                  label="Từ chối"
                  onPress={() => { setReason(""); setReasonModal({ mode: "reject" }); }}
                  disabled={!dataReady || busy !== null}
                  style={styles.flexButton}
                />
              </View>
            ) : null}
          </DetailCard>
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
              <Text style={styles.noteLabel}>Ghi chú của khách</Text>
              <Text style={styles.noteText}>{booking.customerNote}</Text>
            </View>
          ) : null}
        </DetailCard>

        <DetailCard>
          <DetailSectionHeader icon={ReceiptText} title="Chi phí & thanh toán" subtitle="Đã gồm phí nền tảng" right={<DetailPill label={formatMoney(booking.totalAmount)} tone="brand" />} />
          <View style={styles.rows}>
            <DetailRow label={`Giá thuê (${booking.totalDays} ngày)`} value={formatMoney(booking.basePrice)} />
            {booking.discountPercent > 0 ? (
              <DetailRow label={`Giảm giá (${booking.discountPercent}%)`} value={`-${formatMoney(booking.discountAmount)}`} tone="success" />
            ) : null}
            {booking.promotionDiscount > 0 ? (
              <DetailRow label={`Mã ${booking.promotionCode ?? ""}`} value={`-${formatMoney(booking.promotionDiscount)}`} tone="success" />
            ) : null}
            {booking.deliveryFee > 0 ? (
              <DetailRow
                label={`Phí giao xe tận nơi${booking.deliveryDistanceKm != null ? ` (${booking.deliveryDistanceKm} km)` : ""}`}
                value={`+${formatMoney(booking.deliveryFee)}`}
              />
            ) : null}
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
            <Text style={styles.scheduleTitle}>Lịch thanh toán</Text>
            <View style={styles.scheduleRow}>
              <Text style={styles.scheduleLabel}>
                {["DepositPaid", "Confirmed", "InProgress", "Completed"].includes(status) ? "Đã chuyển tiền cọc" : "Cần chuyển tiền cọc"}
              </Text>
              <Text style={styles.scheduleValue}>{formatMoney(booking.depositAmount)}</Text>
            </View>
            {remainingAmount > 0 ? (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>Khách trả khi nhận xe</Text>
                <Text style={styles.scheduleValue}>{formatMoney(remainingAmount)}</Text>
              </View>
            ) : null}
            {booking.securityDepositAmount > 0 ? (
              <View style={styles.scheduleRow}>
                <Text style={styles.scheduleLabel}>Thế chấp (hoàn khi trả xe)</Text>
                <Text style={styles.scheduleValue}>{formatMoney(booking.securityDepositAmount)}</Text>
              </View>
            ) : null}
          </View>
          {booking.paymentDueAt && status === "Approved" ? <Text style={styles.hint}>Hạn thanh toán cọc: {formatDateTime(booking.paymentDueAt)}</Text> : null}
          <BookingPricingDetails booking={booking} />
        </DetailCard>

        <OutstandingSurcharge booking={booking} report={checkOutReport} role="Owner" onUpdated={load} />

        {actions.cancel && (
          <DetailButton
            variant="danger"
            icon={TriangleAlert}
            label="Hủy booking (hoàn 100% cọc)"
            onPress={() => { setReason(""); setReasonModal({ mode: "cancel" }); }}
            disabled={!dataReady || busy !== null}
          />
        )}

        <ContractBlock bookingStatus={booking.status} bookingId={booking.id} userId={userId} canManage onChanged={() => load()} />

        <DetailCard>
          <DetailSectionHeader icon={KeyRound} title="Bàn giao xe" subtitle="Biên bản nhận xe và trả xe" />
          <InspectionSummaryLink booking={booking} type="CheckIn" report={checkInReport} onPress={() => navigation.navigate("OwnerBookingHandover", { bookingId, inspectionType: "CheckIn" })} />
          <InspectionSummaryLink booking={booking} type="CheckOut" report={checkOutReport} onPress={() => navigation.navigate("OwnerBookingHandover", { bookingId, inspectionType: "CheckOut" })} />
        </DetailCard>

        {status === "Completed" && booking.escrowStatus === "Held" ? (
          hold.withinHoldWindow ? (
            <Text style={styles.hint}>Tiền cọc đang giữ để đối soát. Còn khoảng {hold.remainingHours} giờ nữa mới được giải ngân.</Text>
          ) : (
            <DetailButton
              icon={Wallet}
              label="Giải ngân tiền cọc"
              onPress={() => void runAction("settle", () => requestSettlement(bookingId).then(() => undefined), "Đã giải ngân escrow.")}
              disabled={!dataReady || busy !== null || !actions.settle}
            />
          )
        ) : null}

        {pendingTopUp && pendingTopUp.amount > 0 ? (
          <DetailCard>
            <DetailSectionHeader
              icon={Wallet}
              title="Chờ cọc bổ sung để gia hạn"
              subtitle="Yêu cầu gia hạn của khách"
              right={<DetailPill label={formatMoney(pendingTopUp.amount)} tone="warn" />}
            />
            <Text style={styles.hint}>Khách cần thanh toán {formatMoney(pendingTopUp.amount)}{pendingTopUp.dueAt ? ` trước ${formatDateTime(pendingTopUp.dueAt)}` : ""}. Nếu quá hạn, yêu cầu gia hạn bị hủy và hợp đồng cũ tiếp tục hiệu lực.</Text>
          </DetailCard>
        ) : null}

        {(status === "Cancelled" || status === "Rejected") && booking.cancelReason ? (
          <DetailCard>
            <DetailSectionHeader icon={TriangleAlert} title={`Lý do ${status === "Rejected" ? "từ chối" : "hủy"}`} subtitle="Ghi nhận từ hệ thống" />
            <Text style={styles.muted}>{booking.cancelReason}</Text>
          </DetailCard>
        ) : null}

        {status === "Completed" && (
          <DetailCard>
            <DetailSectionHeader
              icon={Star}
              title="Đánh giá khách thuê"
              subtitle={alreadyReviewed ? "Cảm ơn bạn đã chia sẻ trải nghiệm" : "Chia sẻ trải nghiệm của bạn"}
            />
            {!alreadyReviewed ? (
              <View style={styles.reviewPrompt}>
                <Text style={[styles.reviewPromptStars, { color: theme.brand }]}>★★★★★</Text>
                <Text style={styles.muted}>Bạn chưa đánh giá khách thuê cho đơn này.</Text>
                <DetailButton icon={Star} label="Viết đánh giá" onPress={() => setReviewOpen(true)} disabled={!dataReady || busy !== null} />
              </View>
            ) : null}
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
            {alreadyReviewed && bookingReviews.filter((review) => review.reviewType === "Owner").length === 0 ? <Text style={styles.muted}>Bạn đã gửi đánh giá cho booking này.</Text> : null}
          </DetailCard>
        )}

        <ReportBookingViolation key={`violation-${booking.id}`} bookingId={booking.id} bookingCode={booking.bookingCode} />
        <BookingAssistance key={booking.id} bookingId={booking.id} bookingCode={booking.bookingCode} />
        <BookingTimeline history={booking.statusHistory} />
        </View>
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

      <Modal visible={reviewOpen} transparent animationType="fade" onRequestClose={() => { if (busy === null) setReviewOpen(false); }}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <View style={styles.modalHead}>
              <View style={styles.modalIcon}><Star color={theme.brand} size={18} strokeWidth={2.1} /></View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.modalTitle}>Đánh giá khách thuê</Text>
                <Text style={styles.modalHint}>Chọn số sao tổng quan (bắt buộc)</Text>
              </View>
            </View>
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
            <View style={styles.modalActions}>
              <DetailButton variant="ghost" label="Đóng" disabled={busy !== null} onPress={() => setReviewOpen(false)} style={styles.flexButton} />
              <DetailButton
                icon={Star}
                label={busy === "review" ? "Đang gửi..." : "Gửi đánh giá"}
                disabled={!dataReady || busy !== null}
                onPress={() => {
                  if (rating < 1) {
                    Alert.alert("Thiếu đánh giá", "Vui lòng chọn từ 1 đến 5 sao.");
                    return;
                  }
                  void runAction("review", () => createOwnerReview({ bookingId, rating, comment: comment.trim() || undefined }).then(() => undefined), "Cảm ơn đánh giá của bạn.").then((ok) => { if (ok) setReviewOpen(false); });
                }}
                style={styles.flexButton}
              />
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


const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
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
    center: { flex: 1, alignItems: "center", justifyContent: "center" },
    scrollContent: { paddingBottom: 40 },
    body: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 40, gap: 12 },

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
    pressed: { opacity: 0.72 },

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
    progressTitle: { color: theme.text, fontFamily: font.display, fontSize: 16, letterSpacing: -0.2, flexShrink: 1 },
    progressTrack: { height: 7, borderRadius: 999, backgroundColor: theme.surfaceAlt, overflow: "hidden" },
    progressFill: { height: "100%", borderRadius: 999, backgroundColor: theme.brand },
    progressFillOverdue: { backgroundColor: theme.danger },
    progressText: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 16 },

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
    handoverCode: { color: theme.text, fontFamily: font.display, fontSize: 15.5, letterSpacing: -0.2 },
    handoverVehicle: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5 },

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
    hint: { color: theme.muted, fontFamily: font.regular, fontSize: 10.5, lineHeight: 15 },
    bullet: { color: theme.muted, fontFamily: font.regular, fontSize: 11.5, lineHeight: 17 },
    riskBlock: {
      borderRadius: 16,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.input,
      padding: 12,
      gap: 3,
    },
    riskTitle: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5, marginBottom: 2 },
    reviewItem: { borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 10, gap: 6 },
    reviewHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
    reviewAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.surfaceAlt },
    reviewAvatarFallback: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
    reviewAvatarText: { color: theme.brand, fontFamily: font.bold, fontSize: 12 },
    reviewName: { color: theme.text, fontFamily: font.semibold, fontSize: 12.5 },
    reviewStars: { color: theme.success, fontSize: 13 },
    reviewDate: { color: theme.faint, fontFamily: font.regular, fontSize: 10 },
    reviewComment: { color: theme.text, fontFamily: font.regular, fontSize: 11.5, lineHeight: 17, marginLeft: 42 },
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
    totalLabel: { color: theme.text, fontFamily: font.bold, fontSize: 13 },
    totalHint: { color: theme.faint, fontFamily: font.regular, fontSize: 9.5, marginTop: 1 },
    totalValue: {
      color: theme.text,
      fontFamily: font.display,
      fontSize: 20,
      letterSpacing: -0.5,
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
    cardTitle: { color: theme.text, fontFamily: font.display, fontSize: 15.5, lineHeight: 20, letterSpacing: -0.2, marginBottom: 6 },
    muted: { color: theme.muted, fontFamily: font.regular, fontSize: 11.5, lineHeight: 17 },
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
    actionRow: { flexDirection: "row", gap: 8 },
    flexButton: { flex: 1, borderRadius: 16, minHeight: 48, alignItems: "center", justifyContent: "center" },
    primaryButton: { borderRadius: 16, minHeight: 48, backgroundColor: theme.brand, paddingHorizontal: 18, paddingVertical: 10, minWidth: 110, alignItems: "center", justifyContent: "center" },
    primaryText: { color: theme.onBrand, fontFamily: font.bold, fontSize: 13 },
    stars: { flexDirection: "row", gap: 2, marginVertical: 4 },
    star: { padding: 2 },
    starText: { fontSize: 24, color: theme.border },
    starActive: { color: theme.success },
    input: {
      backgroundColor: theme.input,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 11,
      color: theme.text,
      fontFamily: font.regular,
      fontSize: 12.5,
    },
    multiline: { minHeight: 80, textAlignVertical: "top" },
    fieldLabel: { color: theme.text, fontFamily: font.semibold, fontSize: 11.5, marginTop: 8, marginBottom: 2 },
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
      backgroundColor: "rgba(11,7,20,0.55)",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    modal: { width: "100%", backgroundColor: theme.surface, borderRadius: 24, borderWidth: 1, borderColor: theme.border, padding: 18, gap: 12 },
    modalHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    modalIcon: { width: 34, height: 34, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: theme.brandSoft },
    modalTitle: { color: theme.text, fontFamily: font.display, fontSize: 17, letterSpacing: -0.2 },
    modalHint: { color: theme.muted, fontFamily: font.regular, fontSize: 10, marginTop: 1 },
    reviewPrompt: { gap: 8 },
    reviewPromptStars: { fontSize: 18, letterSpacing: 2 },
    tallModal: { maxHeight: "88%" },
    modalActions: { flexDirection: "row", gap: 8, marginTop: 2 },
    ghostButton: { paddingHorizontal: 14, paddingVertical: 10 },
    ghostText: { color: theme.muted, fontFamily: font.semibold, fontSize: 12 },
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
