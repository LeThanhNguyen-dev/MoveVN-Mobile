import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native"
import AppText from "@/components/AppText";
import { ArrowLeft, ChevronRight, MessageSquare } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { OwnerBookingsStackParamList } from "@/navigation/OwnerBookingsNavigator";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
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
import { bookingStatusLabel, formatDateTime, formatMoney, rentalProgress } from "@/features/booking/utils/format";
import ContractBlock from "@/features/contracts/components/ContractBlock";
import BookingTimeline from "@/features/booking/components/BookingTimeline";
import { createOwnerReview, hasReviewed } from "@/features/review/reviewService";
import type { UploadFile } from "@/types/upload";
import { getApiErrorMessage } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";

type DetailRoute = RouteProp<OwnerBookingsStackParamList, "OwnerBookingDetail">;
type DetailNav = NativeStackNavigationProp<OwnerBookingsStackParamList, "OwnerBookingDetail">;

const MAX_PHOTOS = 12;

export default function OwnerBookingDetailScreen({
  route,
  navigation,
  onOpenUserProfile,
}: {
  route: DetailRoute;
  navigation: DetailNav;
  onOpenUserProfile?: (userId: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { bookingId } = route.params;
  const userId = useAuthStore((s) => s.user?.userId ?? 0);

  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reports, setReports] = useState<InspectionReportResponse[]>([]);
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
  const [photos, setPhotos] = useState<UploadFile[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [receiptModal, setReceiptModal] = useState(false);
  const [receiptDamage, setReceiptDamage] = useState(false);
  const [receiptNote, setReceiptNote] = useState("");

  const load = useCallback(async () => {
    try {
      const data = await getBookingById(bookingId);
      setBooking(data);
      const [list, reviewed] = await Promise.all([
        getInspectionReports(bookingId).catch(() => [] as InspectionReportResponse[]),
        hasReviewed(bookingId).catch(() => true),
      ]);
      setReports(list);
      setAlreadyReviewed(reviewed);
    } catch (err) {
      Alert.alert("Lỗi", getApiErrorMessage(err, "Không tải được chi tiết đơn thuê."));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runAction(key: string, fn: () => Promise<void>, success?: string): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    try {
      await fn();
      await load();
      if (success) Alert.alert("Thành công", success);
      return true;
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Vui lòng thử lại sau."));
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

  async function pickPhotos() {
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
    const files: UploadFile[] = result.assets
      .filter((a) => a.uri)
      .slice(0, MAX_PHOTOS)
      .map((a) => ({ uri: a.uri!, name: a.fileName ?? "photo.jpg", type: a.mimeType ?? "image/jpeg" }));
    setPhotos(files);
  }

  async function submitReport() {
    if (!reportModal) return;
    if (photos.length === 0) {
      Alert.alert("Thiếu ảnh", "Cần ít nhất 1 ảnh biên bản (tối đa 12 ảnh).");
      return;
    }
    const input: InspectionFormInput = {
      odometerKm: odometer.trim() ? Number(odometer.trim()) : undefined,
      fuelLevel: fuel.trim() || undefined,
      damageNoted,
      damageDescription: damageNote.trim() || undefined,
      images: photos,
    };
    if (input.odometerKm != null && (!Number.isFinite(input.odometerKm) || input.odometerKm < 0)) {
      Alert.alert("Sai số km", "Vui lòng nhập số km hợp lệ.");
      return;
    }
    const type = reportModal.type;
    setReportModal(null);
    await runAction(
      "report",
      () =>
        (type === "CheckIn"
          ? createOwnerCheckInReport(bookingId, input)
          : createOwnerCheckOutReport(bookingId, input)
        ).then(() => undefined),
      "Đã lập biên bản, chờ khách xác nhận.",
    );
    setOdometer("");
    setFuel("");
    setDamageNoted(false);
    setDamageNote("");
    setPhotos([]);
  }

  async function submitReceipt() {
    setReceiptModal(false);
    await runAction(
      "receipt",
      () =>
        confirmReceipt(bookingId, {
          hasDamages: receiptDamage,
          damageNote: receiptNote.trim() || undefined,
        }).then(() => undefined),
      receiptDamage ? "Đã nhận xe và ghi nhận hư hỏng (tự tạo tranh chấp)." : "Đã xác nhận nhận xe.",
    );
    setReceiptDamage(false);
    setReceiptNote("");
  }

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
            <ArrowLeft color={theme.text} size={20} />
          </Pressable>
          <AppText display style={styles.headerTitle}>Chi tiết đơn thuê</AppText>
          <View style={styles.backButton} />
        </View>
        <View style={styles.center}>
          {loading ? <ActivityIndicator color={theme.brand} /> : <AppText style={styles.muted}>Không tải được.</AppText>}
        </View>
      </View>
    );
  }

  const status = booking.status;
  const checkInReport = reports.find((r) => r.type === "CheckIn");
  const checkOutReport = reports.find((r) => r.type === "CheckOut");
  const progress = status === "InProgress" || status === "Returning"
    ? rentalProgress(booking.startDate, booking.endDate)
    : null;

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <AppText display numberOfLines={1} style={styles.headerTitle}>
          {booking.bookingCode}
        </AppText>
        <Pressable accessibilityRole="button" accessibilityLabel="Nhắn tin với khách thuê" onPress={() => navigation.navigate("BookingChat", { bookingId })} style={styles.backButton}><MessageSquare color={theme.brand} size={22} /></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statusRow}>
          <AppText style={styles.status}>{bookingStatusLabel(status)}</AppText>
          {booking.escrowStatus === "Held" && <AppText style={styles.escrow}>Giữ cọc {formatMoney(booking.escrowAmount)}</AppText>}
        </View>
        {progress && (
          <View style={[styles.progressStrip, progress.overdue && styles.progressOverdue]}>
            <AppText style={styles.progressText}>{progress.summary}</AppText>
          </View>
        )}

        {status === "Pending" && booking.riskScore != null && (
          <View style={styles.card}>
            <AppText display style={styles.cardTitle}>Đánh giá rủi ro khách thuê</AppText>
            <AppText style={styles.riskScore}>
              {Math.round(booking.riskScore)}/100{booking.riskLevel ? ` · ${booking.riskLevel}` : ""}
            </AppText>
            {(booking.riskFactors ?? []).map((f) => (
              <AppText key={f} style={styles.muted}>
                • {f}
              </AppText>
            ))}
          </View>
        )}

        <View style={styles.card}>
          <AppText display style={styles.cardTitle}>Lịch trình & địa điểm</AppText>
          <Row label="Nhận xe" value={formatDateTime(booking.startDate)} />
          <AppText style={styles.address}>{booking.pickupAddress}</AppText>
          <Row label="Trả xe" value={formatDateTime(booking.endDate)} />
          <AppText style={styles.address}>{booking.returnAddress || booking.pickupAddress}</AppText>
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
          {booking.customerNote ? <AppText style={styles.note}>Ghi chú khách: {booking.customerNote}</AppText> : null}
        </View>

        <View style={styles.card}>
          <AppText display style={styles.cardTitle}>Chi tiết chi phí</AppText>
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

        {status === "Pending" && (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => runAction("approve", () => approveBooking(bookingId).then(() => undefined), "Đã duyệt. Hợp đồng tự tạo để 2 bên ký.")}
              disabled={busy !== null}
              style={[styles.flexButton, styles.primaryButton, busy !== null && styles.disabled]}
            >
              <AppText style={styles.primaryText}>{busy === "approve" ? "..." : "Duyệt"}</AppText>
            </Pressable>
            <Pressable
              onPress={() => { setReason(""); setReasonModal({ mode: "reject" }); }}
              disabled={busy !== null}
              style={[styles.flexButton, styles.dangerButton, busy !== null && styles.disabled]}
            >
              <AppText style={styles.primaryText}>Từ chối</AppText>
            </Pressable>
          </View>
        )}

        {(status === "Approved" || status === "DepositPaid") && (
          <ActionButton theme={theme} label="Hủy booking (hoàn 100% cọc)" onPress={() => { setReason(""); setReasonModal({ mode: "cancel" }); }} disabled={busy !== null} danger />
        )}

        {status === "DepositPaid" && !checkInReport && (
          <ActionButton theme={theme} label="Lập biên bản nhận xe" onPress={() => { resetReportForm(); setReportModal({ type: "CheckIn" }); }} disabled={busy !== null} />
        )}

        {(status === "InProgress" || status === "Returning") && !checkOutReport && (
          <ActionButton theme={theme} label="Lập biên bản trả xe" onPress={() => { resetReportForm(); setReportModal({ type: "CheckOut" }); }} disabled={busy !== null} />
        )}

        {status === "Returned" && (
          <ActionButton theme={theme} label="Xác nhận đã nhận xe" onPress={() => { setReceiptDamage(false); setReceiptNote(""); setReceiptModal(true); }} disabled={busy !== null} />
        )}

        {status === "Completed" && booking.escrowStatus === "Held" && (
          <ActionButton theme={theme} label="Giải ngân tiền cọc" onPress={() => runAction("settle", () => requestSettlement(bookingId).then(() => undefined), "Đã giải ngân escrow.")} disabled={busy !== null} />
        )}

        {reports.length > 0 && (
          <View style={styles.card}>
            <AppText display style={styles.cardTitle}>Biên bản ({reports.length})</AppText>
            {reports.map((r) => (
              <View key={r.id} style={styles.reportBlock}>
                <AppText display style={styles.reportTitle}>
                  {r.type === "CheckIn" ? "Nhận xe" : "Trả xe"} · {formatDateTime(r.createdAt)}
                  {r.isCustomerConfirmed ? " · khách đã xác nhận" : " · chờ khách xác nhận"}
                </AppText>
                {r.odometerKm != null && <AppText style={styles.muted}>Odo: {r.odometerKm} km</AppText>}
                {r.fuelLevel ? <AppText style={styles.muted}>Nhiên liệu: {r.fuelLevel}</AppText> : null}
                {r.damageNoted ? (
                  <AppText style={styles.damage}>Hư hỏng: {r.damageDescription || "có ghi nhận"}</AppText>
                ) : (
                  <AppText style={styles.muted}>Không ghi nhận hư hỏng</AppText>
                )}
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
            <AppText display style={styles.cardTitle}>Lý do {status === "Rejected" ? "từ chối" : "hủy"}</AppText>
            <AppText style={styles.muted}>{booking.cancelReason}</AppText>
          </View>
        ) : null}

        <BookingTimeline history={booking.statusHistory} />

        {status === "Completed" && !alreadyReviewed && (
          <View style={styles.card}>
            <AppText display style={styles.cardTitle}>Đánh giá khách thuê</AppText>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setRating(s)} style={styles.star}>
                  <AppText style={[styles.starText, s <= rating && styles.starActive]}>★</AppText>
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
              disabled={busy !== null}
            />
          </View>
        )}
      </ScrollView>

      <Modal visible={reasonModal !== null} transparent animationType="fade" onRequestClose={() => setReasonModal(null)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <AppText display style={styles.cardTitle}>{reasonModal?.mode === "reject" ? "Từ chối đơn thuê" : "Hủy booking"}</AppText>
            {reasonModal?.mode === "cancel" && (
              <AppText style={styles.muted}>Toàn bộ tiền cọc sẽ hoàn 100% vào ví khách.</AppText>
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
                <AppText style={styles.ghostText}>Đóng</AppText>
              </Pressable>
              <Pressable onPress={submitReason} style={styles.primaryButton}>
                <AppText style={styles.primaryText}>Xác nhận</AppText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reportModal !== null} transparent animationType="fade" onRequestClose={() => setReportModal(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.modal, styles.tallModal]}>
            <AppText display style={styles.cardTitle}>
              Biên bản {reportModal?.type === "CheckIn" ? "nhận xe" : "trả xe"}
            </AppText>
            <ScrollView>
              <AppText style={styles.fieldLabel}>Số km hiện tại</AppText>
              <TextInput
                value={odometer}
                onChangeText={setOdometer}
                placeholder="VD: 15000"
                placeholderTextColor={theme.placeholder}
                keyboardType="number-pad"
                style={styles.input}
              />
              <AppText style={styles.fieldLabel}>Mức nhiên liệu / pin</AppText>
              <TextInput
                value={fuel}
                onChangeText={setFuel}
                placeholder="VD: 80%, đầy bình..."
                placeholderTextColor={theme.placeholder}
                style={styles.input}
              />
              <View style={styles.switchRow}>
                <AppText style={styles.fieldLabel}>Có hư hỏng / mất mát</AppText>
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
              <Pressable onPress={pickPhotos} style={styles.photoButton}>
                <AppText style={styles.photoButtonText}>
                  {photos.length === 0 ? "Chọn ảnh (ít nhất 1, tối đa 12)" : `Đã chọn ${photos.length} ảnh — bấm để chọn lại`}
                </AppText>
              </Pressable>
              {photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbs}>
                  {photos.map((p, i) => (
                    <Image key={`${p.uri}-${i}`} source={{ uri: p.uri }} style={styles.thumb} />
                  ))}
                </ScrollView>
              )}
            </ScrollView>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setReportModal(null)} style={styles.ghostButton}>
                <AppText style={styles.ghostText}>Đóng</AppText>
              </Pressable>
              <Pressable onPress={submitReport} disabled={busy !== null} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                {busy === "report" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <AppText style={styles.primaryText}>Lập biên bản</AppText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={receiptModal} transparent animationType="fade" onRequestClose={() => setReceiptModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <AppText display style={styles.cardTitle}>Xác nhận đã nhận xe</AppText>
            <View style={styles.switchRow}>
              <AppText style={styles.fieldLabel}>Phát hiện hư hỏng / mất mát</AppText>
              <Switch value={receiptDamage} onValueChange={setReceiptDamage} />
            </View>
            {receiptDamage && (
              <>
                <AppText style={styles.muted}>Hệ thống sẽ tự tạo tranh chấp hư hỏng.</AppText>
                <TextInput
                  value={receiptNote}
                  onChangeText={setReceiptNote}
                  placeholder="Mô tả hư hỏng..."
                  placeholderTextColor={theme.placeholder}
                  multiline
                  style={[styles.input, styles.multiline]}
                />
              </>
            )}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setReceiptModal(false)} style={styles.ghostButton}>
                <AppText style={styles.ghostText}>Đóng</AppText>
              </Pressable>
              <Pressable onPress={submitReceipt} style={styles.primaryButton}>
                <AppText style={styles.primaryText}>Xác nhận</AppText>
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
          <AppText style={styles.fullHint}>Chạm để đóng</AppText>
        </Pressable>
      </Modal>
    </View>
  );

  function resetReportForm() {
    setOdometer("");
    setFuel("");
    setDamageNoted(false);
    setDamageNote("");
    setPhotos([]);
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
      <AppText style={[rowStyles.label, strong && rowStyles.strongLabel]}>{label}</AppText>
      <AppText style={[rowStyles.value, tone === "success" && rowStyles.success, strong && rowStyles.strong]}>
        {value}
      </AppText>
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
      <AppText style={{ fontWeight: "800", fontSize: 15, color: "#fff" }}>{label}</AppText>
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
    thumbs: { flexDirection: "row", marginTop: 8 },
    thumb: { width: 72, height: 72, borderRadius: 8, marginRight: 8, backgroundColor: theme.surfaceAlt },
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
