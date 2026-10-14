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
import { bookingStatusLabel, formatDateTime, formatMoney } from "@/features/booking/utils/format";
import ContractBlock from "@/features/contracts/components/ContractBlock";
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
}: {
  route: DetailRoute;
  navigation: DetailNav;
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

  async function runAction(key: string, fn: () => Promise<void>, success?: string) {
    if (busy) return;
    setBusy(key);
    try {
      await fn();
      await load();
      if (success) Alert.alert("Thành công", success);
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Vui lòng thử lại sau."));
    } finally {
      setBusy(null);
    }
  }

  async function submitReason() {
    if (!reasonModal || !reason.trim()) {
      Alert.alert("Thiếu lý do", "Vui lòng nhập lý do.");
      return;
    }
    const mode = reasonModal.mode;
    setReasonModal(null);
    if (mode === "reject") {
      await runAction("reject", () => rejectBooking(bookingId, reason.trim()).then(() => undefined), "Đã từ chối đơn thuê.");
    } else {
      await runAction("cancel", () => cancelBookingByOwner(bookingId, reason.trim()).then(() => undefined), "Đã hủy. Toàn bộ cọc hoàn vào ví khách.");
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
  const checkInReport = reports.find((r) => r.type === "CheckIn");
  const checkOutReport = reports.find((r) => r.type === "CheckOut");

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
        <View style={styles.statusRow}>
          <Text style={styles.status}>{bookingStatusLabel(status)}</Text>
          {booking.escrowStatus === "Held" && <Text style={styles.escrow}>Giữ cọc {formatMoney(booking.escrowAmount)}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch trình & địa điểm</Text>
          <Row label="Nhận xe" value={formatDateTime(booking.startDate)} />
          <Text style={styles.address}>{booking.pickupAddress}</Text>
          <Row label="Trả xe" value={formatDateTime(booking.endDate)} />
          <Text style={styles.address}>{booking.returnAddress || booking.pickupAddress}</Text>
          <Row label="Khách thuê" value={`#${booking.customerId}`} />
          {booking.customerNote ? <Text style={styles.note}>Ghi chú khách: {booking.customerNote}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Tiền cọc & quyết toán</Text>
          <Row label="Tiền cọc" value={formatMoney(booking.depositAmount)} />
          <Row label="Tổng tiền" value={formatMoney(booking.totalAmount)} />
          <Row label="Phí nền tảng" value={formatMoney(booking.platformFee)} />
        </View>

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

        {status === "Completed" && !alreadyReviewed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đánh giá khách thuê</Text>
            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Pressable key={s} onPress={() => setRating(s)} style={styles.star}>
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
              disabled={busy !== null}
            />
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

      <Modal visible={reportModal !== null} transparent animationType="fade" onRequestClose={() => setReportModal(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.modal, styles.tallModal]}>
            <Text style={styles.cardTitle}>
              Biên bản {reportModal?.type === "CheckIn" ? "nhận xe" : "trả xe"}
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
              <Pressable onPress={pickPhotos} style={styles.photoButton}>
                <Text style={styles.photoButtonText}>
                  {photos.length === 0 ? "Chọn ảnh (ít nhất 1, tối đa 12)" : `Đã chọn ${photos.length} ảnh — bấm để chọn lại`}
                </Text>
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
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={submitReport} disabled={busy !== null} style={[styles.primaryButton, busy !== null && styles.disabled]}>
                {busy === "report" ? (
                  <ActivityIndicator color={theme.onBrand} />
                ) : (
                  <Text style={styles.primaryText}>Lập biên bản</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={receiptModal} transparent animationType="fade" onRequestClose={() => setReceiptModal(false)}>
        <View style={styles.backdrop}>
          <View style={styles.modal}>
            <Text style={styles.cardTitle}>Xác nhận đã nhận xe</Text>
            <View style={styles.switchRow}>
              <Text style={styles.fieldLabel}>Phát hiện hư hỏng / mất mát</Text>
              <Switch value={receiptDamage} onValueChange={setReceiptDamage} />
            </View>
            {receiptDamage && (
              <>
                <Text style={styles.muted}>Hệ thống sẽ tự tạo tranh chấp hư hỏng.</Text>
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
                <Text style={styles.ghostText}>Đóng</Text>
              </Pressable>
              <Pressable onPress={submitReceipt} style={styles.primaryButton}>
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

  function resetReportForm() {
    setOdometer("");
    setFuel("");
    setDamageNoted(false);
    setDamageNote("");
    setPhotos([]);
  }
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={rowStyles.row}>
      <Text style={rowStyles.label}>{label}</Text>
      <Text style={rowStyles.value}>{value}</Text>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 3 },
  label: { color: "#6b7280", fontSize: 13, flexShrink: 0 },
  value: { color: "#111827", fontSize: 13, fontWeight: "600", textAlign: "right", flex: 1 },
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
    statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    status: { color: theme.brand, fontSize: 18, fontWeight: "800" },
    escrow: { color: theme.muted, fontSize: 12, fontWeight: "700" },
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
