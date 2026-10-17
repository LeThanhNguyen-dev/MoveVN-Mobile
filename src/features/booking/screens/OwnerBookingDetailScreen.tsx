import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  PixelRatio,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft, MessageSquare } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { OwnerBookingsStackParamList } from "@/navigation/OwnerBookingsNavigator";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  amendCheckoutReport,
  approveBooking,
  cancelBookingByOwner,
  confirmReceipt,
  createOwnerCheckInReport,
  createOwnerCheckOutReport,
  rejectBooking,
  requestSettlement,
  type InspectionFormInput,
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
import { pickAndStampPhotosWeb } from "@/features/booking/utils/stampWebPhoto";
import { captureRef } from "react-native-view-shot";
import { inspectionWatermark } from "@/features/booking/bookingDisplay";
import { deleteInspectionPhoto, stampedInspectionPhoto } from "@/features/booking/inspectionPhoto";
import { getServerTimeISO } from "@/features/booking/utils/serverTime";
import { getPendingAutoCancelHours } from "@/features/systemConfig/configService";
import { getPublicVehicleImages } from "@/features/vehicles/services/publicVehicleService";

type DetailRoute = RouteProp<OwnerBookingsStackParamList, "OwnerBookingDetail">;
type DetailNav = NativeStackNavigationProp<OwnerBookingsStackParamList, "OwnerBookingDetail">;

const MAX_PHOTOS = 12;

type ReportPhoto = {
  id: string;
  name: string;
  mime: string;
  /** URI upload: native là ảnh đã đóng dấu, web là preview blob. */
  uri: string;
  /** Ảnh hiển thị (luôn là bản đã đóng dấu). */
  previewUri: string;
  /** ISO UTC. */
  capturedAt: string | null;
  /** File đã đóng dấu trên web. */
  uploadBlob?: Blob;
  /** File tạm do app tạo (native) — được xóa khi gỡ/loại. */
  ownedUri?: string;
};

type PendingStamp = { uri: string; width: number; height: number };

export default function OwnerBookingDetailScreen({
  route,
  navigation,
  onOpenDisputes,
}: {
  route: DetailRoute;
  navigation: DetailNav;
  onOpenDisputes?: (prefill: DisputeCreatePrefill) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { bookingId } = route.params;
  const userId = useAuthStore((s) => s.user?.userId ?? 0);

  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [vehiclePhoto, setVehiclePhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<InspectionReportResponse[]>([]);
  const [bookingReviews, setBookingReviews] = useState<ReviewResponse[]>([]);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const [reasonModal, setReasonModal] = useState<null | { mode: "reject" | "cancel" }>(null);
  const [reason, setReason] = useState("");
  const [reportModal, setReportModal] = useState<null | { type: "CheckIn" | "CheckOut" }>(null);
  const [odometer, setOdometer] = useState("");
  const [fuel, setFuel] = useState("");
  const [damageNoted, setDamageNoted] = useState(false);
  const [damageNote, setDamageNote] = useState("");
  const [photos, setPhotos] = useState<ReportPhoto[]>([]);
  const [picking, setPicking] = useState(false);
  const [modalError, setModalError] = useState("");
  const [stampQueue, setStampQueue] = useState<PendingStamp[]>([]);
  const [stampingItem, setStampingItem] = useState<(PendingStamp & { capturedAt: string }) | null>(null);
  const [stampLoaded, setStampLoaded] = useState(false);
  const [stampLaidOut, setStampLaidOut] = useState(false);
  const stampView = useRef<View>(null);
  const stampCounter = useRef(0);
  const [actualReturnAt, setActualReturnAt] = useState("");
  const [isAmending, setIsAmending] = useState(false);
  const [amendReason, setAmendReason] = useState("");
  const [amendVersion, setAmendVersion] = useState(1);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [autoCancelHours, setAutoCancelHours] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBookingById(bookingId);
      setBooking(data);
      setVehiclePhoto(data.vehicleImage || null);
      if (!data.vehicleImage) {
        void getPublicVehicleImages(data.vehicleId).then((images) => {
          const photo = [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder)[0];
          if (photo?.imageUrl) setVehiclePhoto(photo.imageUrl);
        }).catch(() => undefined);
      }
      const [list, reviewed, reviewList] = await Promise.all([
        getInspectionReports(bookingId).catch(() => [] as InspectionReportResponse[]),
        hasReviewed(bookingId).catch(() => true),
        getBookingReviews(bookingId).catch(() => [] as ReviewResponse[]),
      ]);
      setReports(list);
      setAlreadyReviewed(reviewed);
      setBookingReviews(reviewList);
      if (data.status === "Pending") {
        getPendingAutoCancelHours()
          .then((h) => setAutoCancelHours(h))
          .catch(() => setAutoCancelHours(24));
      }
    } catch (err) {
      Alert.alert("Lỗi", getApiErrorMessage(err, "Không tải được chi tiết đơn thuê."));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(key: string, fn: () => Promise<void>, success?: string, onError?: (message: string) => void): Promise<boolean> {
    if (busy) return false;
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
      setBusy(null);
    }
  }

  function backToList(message: string) {
    Alert.alert("Thành công", message, [{ text: "Về danh sách", onPress: () => navigation.goBack() }]);
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

  function revokePreviews(list: ReportPhoto[]) {
    list.forEach((photo) => {
      if (photo.previewUri.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(photo.previewUri);
        } catch {
          // URL xem trước có thể đã được thu hồi.
        }
      }
      if (photo.ownedUri) deleteInspectionPhoto(photo.ownedUri);
    });
  }

  async function pickPhotos() {
    if (Platform.OS === "web") {
      await pickPhotosWeb();
      return;
    }
    if (photos.length >= MAX_PHOTOS) {
      setModalError(`Đã đủ ${MAX_PHOTOS} ảnh. Xóa bớt ảnh rồi thêm tiếp.`);
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Cần quyền", "Cho phép truy cập thư viện ảnh để chụp biên bản.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.7,
      selectionLimit: MAX_PHOTOS,
    });
    if (result.canceled) return;
    // Native cũng đóng dấu + giờ hệ thống như web: xếp hàng chờ composition ẩn xử lý.
    setModalError("");
    try {
      const capturedAt = await getServerTimeISO();
      batchCapturedAt.current = capturedAt;
      const pending: PendingStamp[] = result.assets
        .filter((a) => a.uri && (a.width ?? 0) > 0 && (a.height ?? 0) > 0)
        .slice(0, MAX_PHOTOS)
        .map((a) => ({ uri: a.uri ?? "", width: a.width ?? 0, height: a.height ?? 0 }));
      if (pending.length === 0) {
        setModalError("Không đọc được ảnh nào. Vui lòng thử lại.");
        return;
      }
      setStampQueue((prev) => [...prev, ...pending].slice(0, MAX_PHOTOS * 2));
    } catch {
      setModalError("Không chọn được ảnh. Vui lòng thử lại.");
    }
  }

  const batchCapturedAt = useRef("");
  const nativeStamping = stampingItem !== null || stampQueue.length > 0;
  const stampScale = stampingItem ? Math.min(1, 1600 / Math.max(stampingItem.width, stampingItem.height)) : 1;
  const stampExportWidth = stampingItem ? Math.max(1, Math.round(stampingItem.width * stampScale)) / Math.max(1, PixelRatio.get()) : 0;
  const stampExportHeight = stampingItem ? Math.max(1, Math.round(stampingItem.height * stampScale)) / Math.max(1, PixelRatio.get()) : 0;
  const stampFontSize = Math.max(10, Math.round(stampExportWidth * 0.024));

  // Xử lý tuần tự từng ảnh native: composition ẩn -> captureRef -> file đã đóng dấu.
  useEffect(() => {
    if (Platform.OS === "web") return;
    if (stampingItem || stampQueue.length === 0) return;
    const [next, ...rest] = stampQueue;
    if (!next) return;
    setStampQueue(rest);
    setStampLoaded(false);
    setStampLaidOut(false);
    setStampingItem({ ...next, capturedAt: batchCapturedAt.current });
  }, [stampQueue, stampingItem]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    if (!stampingItem || !stampLoaded || !stampLaidOut) return;
    let cancelled = false;
    const scale = Math.min(1, 1600 / Math.max(stampingItem.width, stampingItem.height));
    const outWidth = Math.max(1, Math.round(stampingItem.width * scale));
    const outHeight = Math.max(1, Math.round(stampingItem.height * scale));
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        if (cancelled) return;
        let uri: string | null = null;
        try {
          uri = await captureRef(stampView, {
            format: "jpg",
            quality: 0.9,
            result: "tmpfile",
            width: outWidth,
            height: outHeight,
            useRenderInContext: Platform.OS === "ios",
          });
          if (!uri) throw new Error("Không lưu được ảnh biên bản.");
          const photo = stampedInspectionPhoto(uri, stampingItem.capturedAt);
          uri = null;
          if (cancelled) {
            deleteInspectionPhoto(photo.uri);
            return;
          }
          stampCounter.current += 1;
          setPhotos((prev) =>
            [
              ...prev,
              {
                id: `${photo.id}-${stampCounter.current}`,
                name: `inspection-${photo.id}.jpg`,
                mime: "image/jpeg",
                uri: photo.uri,
                previewUri: photo.uri,
                capturedAt: photo.capturedAt,
                ownedUri: photo.uri,
              },
            ].slice(0, MAX_PHOTOS),
          );
          setModalError("");
        } catch {
          if (uri) deleteInspectionPhoto(uri);
          if (!cancelled) setModalError("Không đóng dấu được ảnh. Vui lòng thử lại.");
        } finally {
          if (!cancelled) setStampingItem(null);
        }
      });
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [stampingItem, stampLoaded, stampLaidOut]);

  function removeReportPhoto(id: string) {
    const target = photos.find((p) => p.id === id);
    if (target) revokePreviews([target]);
    setPhotos(photos.filter((p) => p.id !== id));
    setModalError("");
  }

  /** Web không có camera native: chọn gallery rồi đóng dấu ngay để xem trước. */
  async function pickPhotosWeb() {
    if (photos.length >= MAX_PHOTOS) {
      setModalError(`Đã đủ ${MAX_PHOTOS} ảnh. Xóa bớt ảnh rồi thêm tiếp.`);
      return;
    }
    setPicking(true);
    setModalError("");
    try {
      const { photos: picked, skipped, canceled } = await pickAndStampPhotosWeb({
        bookingCode: booking?.bookingCode ?? "",
        type: reportModal?.type ?? "CheckIn",
        maxCount: MAX_PHOTOS,
      });
      if (canceled) return;
      if (picked.length === 0) {
        setModalError("Không đóng dấu được ảnh. Vui lòng thử lại.");
        return;
      }
      const stamped: ReportPhoto[] = picked.map((item, index) => ({
        id: `${Date.now()}-${index}`,
        name: item.name,
        mime: "image/jpeg",
        uri: item.previewUrl,
        previewUri: item.previewUrl,
        capturedAt: item.capturedAt,
        uploadBlob: item.file,
      }));
      // Cộng dồn (picker web thường chỉ trả 1 ảnh mỗi lần mở).
      const next = [...photos, ...stamped].slice(0, MAX_PHOTOS);
      stamped
        .filter((photo) => !next.includes(photo))
        .forEach((photo) => {
          try {
            URL.revokeObjectURL(photo.previewUri);
          } catch {
            // URL xem trước có thể đã được thu hồi.
          }
        });
      setPhotos(next);
      if (skipped > 0) setModalError(`${skipped} ảnh lỗi đã được bỏ qua.`);
    } catch {
      setModalError("Không chọn được ảnh. Vui lòng thử lại.");
    } finally {
      setPicking(false);
    }
  }

  function parseReturnAtToIso(value: string): string | null {
    const m = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }

  async function submitReport() {
    if (!reportModal) return;
    if (isAmending) {
      if (!amendReason.trim()) {
        Alert.alert("Thiếu lý do", "Vui lòng nhập lý do sửa biên bản.");
        return;
      }
      const iso = parseReturnAtToIso(actualReturnAt);
      if (!iso) {
        Alert.alert("Thiếu giờ bàn giao", "Nhập giờ thực tế nhận lại xe (DD/MM/YYYY HH:mm).");
        return;
      }
      const odo = odometer.trim() ? Number(odometer.trim()) : undefined;
      if (odo != null && (!Number.isFinite(odo) || odo < 0)) {
        Alert.alert("Sai số km", "Vui lòng nhập số km hợp lệ.");
        return;
      }
      setReportModal(null);
      await runAction(
        "amend",
        () => amendCheckoutReport(bookingId, {
          expectedVersion: amendVersion,
          reason: amendReason.trim(),
          actualReturnAt: iso,
          odometerKm: odo,
          fuelLevel: fuel.trim() || undefined,
          damageNoted,
          damageDescription: damageNote.trim() || undefined,
        }).then(() => undefined),
        "Đã sửa biên bản, khách cần kiểm tra phiên bản mới.",
      );
      resetReportForm();
      return;
    }
    if (photos.length === 0) {
      Alert.alert("Thiếu ảnh", "Cần ít nhất 1 ảnh biên bản (tối đa 12 ảnh).");
      return;
    }
    const isCheckOut = reportModal.type === "CheckOut";
    let actualReturnAtIso: string | undefined;
    if (isCheckOut) {
      actualReturnAtIso = parseReturnAtToIso(actualReturnAt) ?? undefined;
      if (!actualReturnAtIso) {
        Alert.alert("Thiếu giờ bàn giao", "Nhập giờ thực tế nhận lại xe (DD/MM/YYYY HH:mm).");
        return;
      }
      if (new Date(actualReturnAtIso).getTime() > Date.now()) {
        Alert.alert("Giờ không hợp lệ", "Giờ bàn giao không được ở tương lai.");
        return;
      }
    }
    const input: InspectionFormInput = {
      actualReturnAt: actualReturnAtIso,
      odometerKm: odometer.trim() ? Number(odometer.trim()) : undefined,
      fuelLevel: fuel.trim() || undefined,
      damageNoted,
      damageDescription: damageNote.trim() || undefined,
      images: photos.map((p) => p.uploadBlob ?? { uri: p.uri, name: p.name, type: p.mime }),
      capturedAts: photos.map((p) => p.capturedAt),
    };
    if (input.odometerKm != null && (!Number.isFinite(input.odometerKm) || input.odometerKm < 0)) {
      Alert.alert("Sai số km", "Vui lòng nhập số km hợp lệ.");
      return;
    }
    const type = reportModal.type;
    setModalError("");
    const ok = await runAction(
      "report",
      () =>
        (type === "CheckIn"
          ? createOwnerCheckInReport(bookingId, input)
          : createOwnerCheckOutReport(bookingId, input)
        ).then(() => undefined),
      "Đã lập biên bản, chờ khách xác nhận.",
      (message) => setModalError(message),
    );
    if (!ok) return;
    setReportModal(null);
    revokePreviews(photos);
    setOdometer("");
    setFuel("");
    setDamageNoted(false);
    setDamageNote("");
    setPhotos([]);
    setActualReturnAt("");
  }

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
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
  const pickupReached = new Date(booking.startDate).getTime() <= Date.now();
  const checkInReport = reports.find((r) => r.type === "CheckIn");
  const checkOutReport = reports.find((r) => r.type === "CheckOut");
  const hold = escrowHoldInfo(checkOutReport?.createdAt, booking.completedAt);
  const progress = status === "InProgress" || status === "Returning"
    ? rentalProgress(booking.startDate, booking.endDate)
    : null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {booking.bookingCode}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Nhắn tin với khách thuê" onPress={() => navigation.navigate("BookingChat", { bookingId })} style={styles.backButton}><MessageSquare color={theme.brand} size={22} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.vehicleCard}>
          {vehiclePhoto ? <Image source={{ uri: vehiclePhoto }} style={styles.vehiclePhoto} resizeMode="cover" /> : <View style={styles.vehiclePhotoPlaceholder}><Text style={styles.vehiclePhotoPlaceholderText}>Xe MoveVN</Text></View>}
          <View style={styles.vehicleInfo}>
            <Text style={styles.vehicleName}>{booking.vehicleName || `Xe #${booking.vehicleId}`}</Text>
            <Text style={styles.muted}>Khách thuê: {booking.customerName || `#${booking.customerId}`}</Text>
            <Text style={styles.muted}>Ngày yêu cầu: {formatDateTime(booking.createdAt)}</Text>
          </View>
        </View>
        <View style={styles.statusRow}>
          <Text style={styles.status}>{bookingStatusLabel(status)}</Text>
          {booking.escrowStatus === "Held" && <Text style={styles.escrow}>Giữ cọc {formatMoney(booking.escrowAmount)}</Text>}
        </View>
        {progress && (
          <View style={[styles.progressStrip, progress.overdue && styles.progressOverdue]}>
            <Text style={styles.progressText}>{progress.summary}</Text>
          </View>
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
          <Row label="Khách thuê" value={booking.customerName || `#${booking.customerId}`} />
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

        {status === "Pending" && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => runAction("approve", () => approveBooking(bookingId).then(() => undefined), "Đã duyệt. Hợp đồng tự tạo để 2 bên ký.")}
              disabled={busy !== null}
              style={[styles.flexButton, styles.primaryButton, busy !== null && styles.disabled]}
            >
              <Text style={styles.primaryText}>{busy === "approve" ? "..." : "Duyệt"}</Text>
            </Pressable>
            <Pressable
              onPress={() => { setReason(""); setReasonModal({ mode: "reject" }); }}
              disabled={busy !== null}
              style={[styles.flexButton, styles.dangerButton, busy !== null && styles.disabled]}
            >
              <Text style={styles.primaryText}>Từ chối</Text>
            </Pressable>
          </View>
        )}

        {(status === "Approved" || status === "DepositPaid") && new Date(booking.startDate).getTime() > Date.now() && (
          <ActionButton theme={theme} label="Hủy booking (hoàn 100% cọc)" onPress={() => { setReason(""); setReasonModal({ mode: "cancel" }); }} disabled={busy !== null} danger />
        )}

        {(status === "DepositPaid" || status === "Confirmed") && !checkInReport && pickupReached && (
          <ActionButton theme={theme} label="Lập biên bản nhận xe" onPress={() => { resetReportForm(); setReportModal({ type: "CheckIn" }); }} disabled={busy !== null} />
        )}
        {(status === "DepositPaid" || status === "Confirmed") && !checkInReport && !pickupReached ? (
          <Text style={styles.muted}>Chưa đến ngày nhận xe. Nút lập biên bản sẽ mở sau thời điểm nhận xe.</Text>
        ) : null}

        {(status === "InProgress" || status === "Returning") && !checkOutReport && pickupReached && (
          <ActionButton theme={theme} label="Lập biên bản trả xe" onPress={() => { resetReportForm(); setActualReturnAt(formatDateTime(new Date().toISOString())); setReportModal({ type: "CheckOut" }); }} disabled={busy !== null} />
        )}

        {status === "Returning" && checkOutReport && !checkOutReport.isCustomerConfirmed && (
          <ActionButton
            theme={theme}
            label="Sửa biên bản trả xe"
            onPress={() => {
              resetReportForm();
              setOdometer(checkOutReport.odometerKm != null ? String(checkOutReport.odometerKm) : "");
              setFuel(checkOutReport.fuelLevel ?? "");
              setDamageNoted(checkOutReport.damageNoted);
              setDamageNote(checkOutReport.damageDescription ?? "");
              setActualReturnAt(checkOutReport.actualReturnAt ? formatDateTime(checkOutReport.actualReturnAt) : formatDateTime(new Date().toISOString()));
              setAmendReason("");
              setAmendVersion(checkOutReport.version ?? 1);
              setIsAmending(true);
              setReportModal({ type: "CheckOut" });
            }}
            disabled={busy !== null}
          />
        )}

        {status === "Returned" && (
          <ActionButton theme={theme} label="Xác nhận đã nhận xe" onPress={() => runAction("receipt", () => confirmReceipt(bookingId, {}).then(() => undefined), "Đã xác nhận nhận xe.")} disabled={busy !== null} />
        )}

        {status === "Completed" && booking.escrowStatus === "Held" && (
          hold.withinHoldWindow ? (
            <Text style={styles.muted}>Tiền cọc đang giữ để đối soát. Còn khoảng {hold.remainingHours} giờ nữa mới được giải ngân.</Text>
          ) : (
            <ActionButton theme={theme} label="Giải ngân tiền cọc" onPress={() => runAction("settle", () => requestSettlement(bookingId).then(() => undefined), "Đã giải ngân escrow.")} disabled={busy !== null} />
          )
        )}

        {reports.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Biên bản ({reports.length})</Text>
            {reports.map((r) => (
              <View key={r.id} style={styles.reportBlock}>
                <Text style={styles.reportTitle}>
                  {r.type === "CheckIn" ? "Nhận xe" : "Trả xe"} · {formatDateTime(r.createdAt)}
                  {r.isCustomerConfirmed ? " · khách đã xác nhận" : " · chờ khách xác nhận"}
                </Text>
                {r.odometerKm != null && <Text style={styles.muted}>Odo: {r.odometerKm} km</Text>}
                {r.fuelLevel ? <Text style={styles.muted}>Nhiên liệu: {r.fuelLevel}</Text> : null}
                {r.damageNoted ? (
                  <Text style={styles.damage}>Hư hỏng: {r.damageDescription || "có ghi nhận"}</Text>
                ) : (
                  <Text style={styles.muted}>Không ghi nhận hư hỏng</Text>
                )}
                {r.type === "CheckOut" && r.actualReturnAt ? (
                  <Text style={styles.muted}>Giờ bàn giao: {formatDateTime(r.actualReturnAt)}</Text>
                ) : null}
                {r.type === "CheckOut" && r.lateReturnFee != null && r.lateReturnFee > 0 ? (
                  <Text style={styles.damage}>Phụ phí trả trễ: {formatMoney(r.lateReturnFee)}</Text>
                ) : null}
                {r.type === "CheckOut" && r.revisions && r.revisions.length > 0 ? (
                  <View>
                    <Text style={styles.muted}>Lịch sử sửa ({r.revisions.length})</Text>
                    {r.revisions.map((rev) => {
                      let snap: { ActualReturnAt?: string; OdometerKm?: number; LateReturnFee?: number; actualReturnAt?: string; odometerKm?: number; lateReturnFee?: number } = {};
                      try {
                        snap = rev.snapshotJson ? (JSON.parse(rev.snapshotJson) as typeof snap) : {};
                      } catch {
                        snap = {};
                      }
                      const at = snap.ActualReturnAt ?? snap.actualReturnAt;
                      const odo = snap.OdometerKm ?? snap.odometerKm;
                      const fee = snap.LateReturnFee ?? snap.lateReturnFee;
                      return (
                        <Text key={rev.id} style={styles.muted}>
                          v{rev.version} · {rev.reason || "sửa biên bản"} · {formatDateTime(rev.createdAt)}
                          {at ? ` · bàn giao ${formatDateTime(at)}` : ""}
                          {odo != null ? ` · odo ${odo}` : ""}
                          {fee != null ? ` · phí ${formatMoney(fee)}` : ""}
                        </Text>
                      );
                    })}
                  </View>
                ) : null}
                {r.images.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
                    {r.images.map((img) => (
                      <Pressable key={img.id} onPress={() => setViewingImage(img.imageUrl)}>
                        <Image source={{ uri: img.imageUrl }} style={styles.thumb} />
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            ))}
          </View>
        )}

        <ContractBlock bookingId={booking.id} userId={userId} canManage onChanged={() => load()} />

        {(status === "Cancelled" || status === "Rejected") && booking.cancelReason ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lý do {status === "Rejected" ? "từ chối" : "hủy"}</Text>
            <Text style={styles.muted}>{booking.cancelReason}</Text>
          </View>
        ) : null}

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
              onPress={() => void runAction("review", () => createOwnerReview({ bookingId, rating, comment: comment.trim() || undefined }).then(() => undefined), "Cảm ơn đánh giá của bạn.")}
              disabled={busy !== null || rating === 0}
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

      <Modal visible={reportModal !== null} transparent animationType="fade" onRequestClose={() => { resetReportForm(); setReportModal(null); }}>
        <View style={styles.backdrop}>
          <View style={[styles.modal, styles.tallModal]}>
            <Text style={styles.cardTitle}>
              {isAmending ? "Sửa biên bản trả xe" : `Biên bản ${reportModal?.type === "CheckIn" ? "nhận xe" : "trả xe"}`}
            </Text>
            <ScrollView>
              <Text style={styles.fieldLabel}>Số km hiện tại</Text>
              <TextInput
                value={odometer}
                onChangeText={setOdometer}
                placeholder="VD: 15000"
                placeholderTextColor={theme.placeholder}
                keyboardType="number-pad"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Mức nhiên liệu / pin</Text>
              <TextInput
                value={fuel}
                onChangeText={setFuel}
                placeholder="VD: 80%, đầy bình..."
                placeholderTextColor={theme.placeholder}
                style={styles.input}
              />
              {reportModal?.type === "CheckOut" && (
                <>
                  <Text style={styles.fieldLabel}>Giờ thực tế nhận lại xe (khách sẽ kiểm tra)</Text>
                  <TextInput
                    value={actualReturnAt}
                    onChangeText={setActualReturnAt}
                    placeholder="DD/MM/YYYY HH:mm"
                    placeholderTextColor={theme.placeholder}
                    style={styles.input}
                  />
                </>
              )}
              {isAmending && (
                <>
                  <Text style={styles.fieldLabel}>Lý do sửa (khách sẽ thấy)</Text>
                  <TextInput
                    value={amendReason}
                    onChangeText={setAmendReason}
                    placeholder="VD: nhập nhầm giờ bàn giao..."
                    placeholderTextColor={theme.placeholder}
                    multiline
                    style={[styles.input, styles.multiline]}
                  />
                </>
              )}
              <View style={styles.switchRow}>
                <Text style={styles.fieldLabel}>Có hư hỏng / mất mát</Text>
                <Switch value={damageNoted} onValueChange={setDamageNoted} />
              </View>
              {damageNoted && (
                <TextInput
                  value={damageNote}
                  onChangeText={setDamageNote}
                  placeholder="Mô tả vết xước, phụ kiện..."
                  placeholderTextColor={theme.placeholder}
                  multiline
                  style={[styles.input, styles.multiline]}
                />
              )}
              {!isAmending && (
                <>
                  <Pressable onPress={() => void pickPhotos()} disabled={picking || nativeStamping} style={styles.photoButton}>
                    <Text style={styles.photoButtonText}>
                      {picking || nativeStamping
                        ? "Đang gắn ngày giờ lên ảnh…"
                        : photos.length === 0
                          ? "Chọn ảnh (ít nhất 1, tối đa 12)"
                          : `Đã chọn ${photos.length} ảnh — bấm để thêm`}
                    </Text>
                  </Pressable>
                  {modalError ? <Text style={styles.formError}>{modalError}</Text> : null}
                  {photos.length > 0 && (
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
                      {photos.map((p) => (
                        <View key={p.id} style={styles.thumbWrap}>
                          <View>
                            <Image source={{ uri: p.previewUri }} style={styles.thumb} />
                            <Pressable
                              accessibilityRole="button"
                              accessibilityLabel="Xóa ảnh này"
                              onPress={() => removeReportPhoto(p.id)}
                              style={styles.thumbRemove}
                            >
                              <Text style={styles.thumbRemoveText}>✕</Text>
                            </Pressable>
                          </View>
                          <Text style={styles.thumbTime}>
                            {p.capturedAt ? formatDateTime(p.capturedAt) : "Chưa có giờ chụp"}
                          </Text>
                        </View>
                      ))}
                    </ScrollView>
                  )}
                </>
              )}
              {/* Composition ẩn để đóng dấu ảnh gallery trên native (web dùng canvas). */}
              {stampingItem ? (
                <View pointerEvents="none" style={styles.exportContainer}>
                  <View
                    ref={stampView}
                    collapsable={false}
                    onLayout={() => setStampLaidOut(true)}
                    style={{ width: stampExportWidth, height: stampExportHeight, backgroundColor: "#000" }}
                  >
                    <Image
                      source={{ uri: stampingItem.uri }}
                      fadeDuration={0}
                      onLoad={() => setStampLoaded(true)}
                      onError={() => {
                        setModalError("Không đọc được ảnh. Vui lòng thử lại.");
                        setStampingItem(null);
                      }}
                      style={StyleSheet.absoluteFill}
                      resizeMode="stretch"
                    />
                    <View style={styles.stampPill}>
                      {inspectionWatermark(booking?.bookingCode ?? "", reportModal?.type ?? "CheckIn", stampingItem.capturedAt).map((line) => (
                        <Text
                          key={line}
                          allowFontScaling={false}
                          style={{ color: "#fff", fontSize: stampFontSize, lineHeight: stampFontSize * 1.45, fontWeight: "700" }}
                        >
                          {line}
                        </Text>
                      ))}
                    </View>
                  </View>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={() => { resetReportForm(); setReportModal(null); }} style={styles.ghostButton}>
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={submitReport} disabled={busy !== null} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                {busy === "report" || busy === "amend" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>{isAmending ? "Lưu sửa đổi" : "Lập biên bản"}</Text>
                )}
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

  function resetReportForm() {
    revokePreviews(photos);
    setOdometer("");
    setFuel("");
    setDamageNoted(false);
    setDamageNote("");
    setPhotos([]);
    setPicking(false);
    setModalError("");
    setStampQueue([]);
    setStampingItem(null);
    setActualReturnAt("");
    setIsAmending(false);
    setAmendReason("");
    setAmendVersion(1);
  }
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
