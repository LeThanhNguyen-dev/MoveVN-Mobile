import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { ArrowLeft } from "lucide-react-native";
import type { RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { TripsStackParamList } from "@/navigation/types";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  cancelBooking,
  confirmCheckIn,
  confirmCheckOut,
  getBookingById,
  getBookingCancellationQuote,
  getInspectionReports,
  reportNoShow,
  reportReturn,
} from "@/features/booking/bookingService";
import type { BookingResponse, InspectionReportResponse } from "@/features/booking/types";
import { bookingStatusLabel, formatDateTime, formatMoney } from "@/features/booking/utils/format";
import {
  checkPaymentStatus,
  createBookingTopUpLink,
  createPaymentLink,
  getPendingTopUp,
  payDepositWithWallet,
  type BookingTopUpPendingResponse,
} from "@/features/payments/services/paymentService";
import { getMyWallet } from "@/features/wallets/services/walletService";
import ContractBlock from "@/features/contracts/components/ContractBlock";
import RiskScoreBadge from "@/features/booking/components/RiskScoreBadge";
import type { DisputeCreatePrefill } from "@/features/disputes/screens/DisputesScreen";
import { createCustomerReview, hasReviewed } from "@/features/review/reviewService";
import { getApiErrorMessage } from "@/services/apiClient";
import { useAuthStore } from "@/features/auth/hooks/useAuth";

type DetailRoute = RouteProp<TripsStackParamList, "TripDetail">;
type DetailNav = NativeStackNavigationProp<TripsStackParamList, "TripDetail">;

const POLL_MAX = 10;
const POLL_MS = 3000;

export default function TripDetailScreen({
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

  const [booking, setBooking] = useState<BookingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);
  const [pendingTopUp, setPendingTopUp] = useState<BookingTopUpPendingResponse | null>(null);
  const [reports, setReports] = useState<InspectionReportResponse[]>([]);
  const [viewingImage, setViewingImage] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const userId = useAuthStore((s) => s.user?.userId ?? 0);
  const [pendingOrderCode, setPendingOrderCode] = useState<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await getBookingById(bookingId);
      setBooking(data);
      const [reviewed, topUp, inspectionList] = await Promise.all([
        hasReviewed(bookingId).catch(() => true),
        getPendingTopUp(bookingId).catch(() => null),
        getInspectionReports(bookingId).catch(() => [] as InspectionReportResponse[]),
      ]);
      setAlreadyReviewed(reviewed);
      setPendingTopUp(topUp);
      setReports(inspectionList);
      if (data.status === "Approved") {
        getMyWallet()
          .then((w) => setWalletBalance(w.balance))
          .catch(() => setWalletBalance(null));
      }
    } catch (err) {
      Alert.alert("Lỗi", getApiErrorMessage(err, "Không tải được chi tiết chuyến đi."));
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
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

  async function runAction(key: string, fn: () => Promise<void>, successMessage?: string) {
    if (actionBusy) return;
    setActionBusy(key);
    try {
      await fn();
      await load();
      if (successMessage) Alert.alert("Thành công", successMessage);
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Vui lòng thử lại sau."));
    } finally {
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
    title: string,
    makeLink: () => Promise<{ checkoutUrl: string; orderCode: number }>,
  ) {
    if (actionBusy) return;
    setActionBusy(actionKey);
    try {
      const link = await makeLink();
      setPendingOrderCode(link.orderCode);
      Alert.alert(
        title,
        "Trình duyệt sẽ mở link PayOS. Thanh toán xong hãy quay lại app để tự xác nhận.",
        [
          { text: "Để sau", style: "cancel" },
          {
            text: "Mở ngay",
            onPress: () => {
              Linking.openURL(link.checkoutUrl).catch(() =>
                Alert.alert("Lỗi", "Không mở được link thanh toán."),
              );
              pollPayment(link.orderCode);
            },
          },
        ],
      );
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không tạo được link thanh toán."));
    } finally {
      setActionBusy(null);
    }
  }

  async function handlePayWithPayOs() {
    await openPayOsCheckout("payos", "Mở thanh toán", () => createPaymentLink(bookingId));
  }

  async function handlePayTopUp() {
    await openPayOsCheckout("topup", "Thanh toán cọc bổ sung", () => createBookingTopUpLink(bookingId));
  }

  async function handleCancel() {
    try {
      const quote = await getBookingCancellationQuote(bookingId);
      if (!quote.canCancel) {
        Alert.alert("Không thể hủy", quote.policyMessage);
        return;
      }
      const detail = quote.hasPaidDeposit
        ? `Hoàn ${formatMoney(quote.refundAmount)} (${quote.refundPercent}%), mất ${formatMoney(quote.forfeitedAmount)}.`
        : "Chưa đặt cọc nên hủy miễn phí.";
      Alert.alert("Xác nhận hủy", `${quote.policyMessage}\n${detail}`, [
        { text: "Giữ lại", style: "cancel" },
        {
          text: "Xác nhận hủy",
          style: "destructive",
          onPress: () => {
            void runAction("cancel", () => cancelBooking(bookingId).then(() => undefined), "Đã hủy chuyến đi.");
          },
        },
      ]);
    } catch (err) {
      Alert.alert("Thất bại", getApiErrorMessage(err, "Không lấy được chính sách hủy."));
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
            void runAction("noshow", () => reportNoShow(bookingId).then(() => undefined), "Đã ghi nhận. Tiền cọc hoàn vào ví.");
          },
        },
      ],
    );
  }

  async function handleReview() {
    if (rating < 1 || rating > 5) {
      Alert.alert("Thiếu đánh giá", "Vui lòng chọn từ 1 đến 5 sao.");
      return;
    }
    await runAction(
      "review",
      () => createCustomerReview({ bookingId, rating, comment: comment.trim() || undefined }).then(() => undefined),
      "Cảm ơn đánh giá của bạn.",
    );
  }

  if (loading || !booking) {
    return (
      <View style={styles.screen}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
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

  const status = booking.status;
  const canCancel = ["Pending", "Approved", "DepositPaid"].includes(status);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {booking.bookingCode}
        </Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.statusRow}>
          <Text style={styles.status}>{bookingStatusLabel(status)}</Text>
          {booking.escrowStatus === "Held" && <Text style={styles.escrow}>Đang giữ cọc {formatMoney(booking.escrowAmount)}</Text>}
        </View>
        <View style={styles.statusRow}>
          <RiskScoreBadge score={booking.riskScore} />
          {onOpenDisputes ? (
            <Pressable onPress={() => onOpenDisputes({ bookingId: booking.id })}>
              <Text style={styles.disputeLink}>Tranh chấp / khiếu nại</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Lịch trình & địa điểm</Text>
          <Row label="Nhận xe" value={formatDateTime(booking.startDate)} />
          <Text style={styles.address}>{booking.pickupAddress}</Text>
          <Row label="Trả xe" value={formatDateTime(booking.endDate)} />
          <Text style={styles.address}>{booking.returnAddress || booking.pickupAddress}</Text>
          {booking.customerNote ? <Text style={styles.note}>Ghi chú: {booking.customerNote}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Thanh toán</Text>
          <Row label="Tiền cọc" value={formatMoney(booking.depositAmount)} />
          <Row label="Tổng tiền" value={formatMoney(booking.totalAmount)} />
          {booking.promotionCode ? <Row label="Khuyến mãi" value={`${booking.promotionCode} (-${formatMoney(booking.promotionDiscount)})`} /> : null}
        </View>

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
              disabled={actionBusy !== null}
            />
          </View>
        )}

        {status === "Approved" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đặt cọc giữ xe</Text>
            {booking.paymentDueAt ? <Text style={styles.muted}>Hạn cọc: {formatDateTime(booking.paymentDueAt)}</Text> : null}
            <ActionButton
              theme={theme}
              label={actionBusy === "wallet" ? "Đang trừ ví..." : `Trả bằng ví${walletBalance != null ? ` (${formatMoney(walletBalance)})` : ""}`}
              onPress={handlePayWithWallet}
              disabled={actionBusy !== null}
            />
            <ActionButton
              theme={theme}
              label={actionBusy === "payos" ? "Đang tạo link..." : "Trả qua PayOS"}
              onPress={handlePayWithPayOs}
              disabled={actionBusy !== null}
              secondary
            />
            {pendingOrderCode != null && (
              <Text style={styles.muted}>Đang chờ xác nhận giao dịch #{pendingOrderCode}...</Text>
            )}
          </View>
        )}

        {canCancel && (
          <ActionButton
            theme={theme}
            label="Hủy chuyến đi"
            onPress={handleCancel}
            disabled={actionBusy !== null}
            danger
          />
        )}

        {status === "DepositPaid" && (
          <>
            <ActionButton
              theme={theme}
              label="Xác nhận đã nhận xe"
              onPress={() => runAction("checkin", () => confirmCheckIn(bookingId).then(() => undefined), "Đã xác nhận nhận xe. Chúc bạn đi tốt!")}
              disabled={actionBusy !== null}
            />
            <ActionButton
              theme={theme}
              label="Chủ xe không giao xe"
              onPress={handleNoShow}
              disabled={actionBusy !== null}
              secondary
            />
          </>
        )}

        {status === "InProgress" && (
          <ActionButton
            theme={theme}
            label="Báo đã trả xe"
            onPress={() => runAction("report", () => reportReturn(bookingId).then(() => undefined), "Đã báo trả xe. Chờ chủ xe lập biên bản.")}
            disabled={actionBusy !== null}
          />
        )}

        {status === "Returning" && (
          <ActionButton
            theme={theme}
            label="Xác nhận biên bản trả xe"
            onPress={() => runAction("checkout", () => confirmCheckOut(bookingId).then(() => undefined), "Đã xác nhận hoàn tất.")}
            disabled={actionBusy !== null}
          />
        )}

        {reports.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Biên bản bàn giao ({reports.length})</Text>
            {reports.map((r) => (
              <View key={r.id} style={styles.reportBlock}>
                <Text style={styles.reportTitle}>
                  {r.type === "CheckIn" ? "Nhận xe" : "Trả xe"} · {formatDateTime(r.createdAt)}
                  {r.isCustomerConfirmed ? " · bạn đã xác nhận" : " · chờ bạn xác nhận"}
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

        <ContractBlock bookingId={booking.id} userId={userId} canManage={false} onChanged={() => load()} />

        {status === "Completed" && !alreadyReviewed && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Đánh giá chuyến đi</Text>
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
              placeholder="Nhận xét về xe và chủ xe..."
              placeholderTextColor={theme.placeholder}
              multiline
              style={[styles.input, styles.multiline]}
            />
            <ActionButton
              theme={theme}
              label="Gửi đánh giá"
              onPress={handleReview}
              disabled={actionBusy !== null}
            />
          </View>
        )}
      </ScrollView>

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
