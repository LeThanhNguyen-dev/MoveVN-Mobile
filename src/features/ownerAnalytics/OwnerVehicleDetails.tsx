import { useState } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import DisputeDetailScreen from "@/features/disputes/screens/DisputeDetailScreen";
import { usePushNavigation } from "@/features/notifications/pushNavigation";
import { useTheme } from "@/theme/useTheme";
import { money, type AnalyticsPage, type OwnerAnalytics } from "./types";

const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });
const statuses: Record<string, string> = { Pending: "Chờ duyệt", Approved: "Đã duyệt", Confirmed: "Đã xác nhận", DepositPaid: "Đã đặt cọc", InProgress: "Đang thuê", Returning: "Đang trả xe", Returned: "Đã trả xe", Completed: "Hoàn tất", Cancelled: "Đã hủy", Rejected: "Đã từ chối" };

export default function OwnerVehicleDetails({ data, userId, onBookingPage, onDisputePage }: {
  data: OwnerAnalytics; userId: number; onBookingPage: (page: number) => void; onDisputePage: (page: number) => void;
}) {
  const { theme } = useTheme(); const [caseId, setCaseId] = useState<number | null>(null);
  const styles = StyleSheet.create({ panel: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 16, gap: 12 },
    title: { fontSize: 16, fontWeight: "700", color: theme.text }, hint: { fontSize: 12, lineHeight: 20, color: theme.muted },
    row: { gap: 5, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border, paddingTop: 12 },
    body: { fontSize: 13, lineHeight: 21, color: theme.text }, link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    pages: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, button: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }, disabled: { opacity: 0.4 } });
  const pages = <T,>(page: AnalyticsPage<T>, label: string, change: (value: number) => void) => <View style={styles.pages}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: trang trước`} disabled={page.page <= 1} onPress={() => change(page.page - 1)} style={[styles.button, page.page <= 1 && styles.disabled]}><AppText style={styles.link}>Trước</AppText></Pressable>
    <AppText style={styles.hint}>Trang {page.page}/{Math.max(1, page.totalPages)}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: trang sau`} disabled={page.page >= page.totalPages} onPress={() => change(page.page + 1)} style={[styles.button, page.page >= page.totalPages && styles.disabled]}><AppText style={styles.link}>Sau</AppText></Pressable>
  </View>;
  const openBooking = (bookingId: number) => usePushNavigation.setState({ pending: { bookingId, userId, roleTarget: "Owner", requestId: `analytics-${bookingId}-${Date.now()}` } });
  if (!data.disputes || !data.bookingHistory) return <View style={styles.panel}><AppText style={styles.hint}>Cần cập nhật backend để xem hồ sơ chi tiết theo xe.</AppText></View>;
  return <>
    <View style={styles.panel}><AppText display style={styles.title}>Tranh chấp của xe</AppText><AppText style={styles.hint}>Hồ sơ tạo trong kỳ. Trạng thái hiện tại của hồ sơ.</AppText>
      {data.disputes.items.map(d => <View key={d.id} style={styles.row}><AppText style={styles.body}>#{d.id} · {d.bookingCode}</AppText><AppText style={styles.hint}>{date(d.createdAt)} · {d.isTrafficFine ? "Phạt nguội" : "Tranh chấp chuyến thuê"}</AppText><AppText style={styles.body}>{d.status === "Resolved" ? "Đã xử lý" : "Đang xử lý"}</AppText><Pressable accessibilityRole="button" accessibilityLabel={`Xem tranh chấp ${d.id}`} style={styles.button} onPress={() => setCaseId(d.id)}><AppText style={styles.link}>Xem hồ sơ →</AppText></Pressable></View>)}
      {!data.disputes.items.length && <AppText style={styles.hint}>Không có hồ sơ tranh chấp tạo trong kỳ.</AppText>}
      {pages(data.disputes, "Tranh chấp", onDisputePage)}
    </View>
    <View style={styles.panel}><AppText display style={styles.title}>Lịch sử đặt xe</AppText><AppText style={styles.hint}>Yêu cầu tạo trong kỳ. Giá trị đơn chưa phải thu nhập chủ xe.</AppText>
      {data.bookingHistory.items.map(b => <View key={b.id} style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={`Xem đơn ${b.bookingCode}`} onPress={() => openBooking(b.id)} style={styles.button}><AppText style={styles.link}>{b.bookingCode} →</AppText></Pressable><AppText style={styles.hint}>Tạo lúc {date(b.createdAt)}</AppText><AppText style={styles.body}>{date(b.startDate)} → {date(b.endDate)}</AppText><AppText style={styles.body}>{statuses[b.status] ?? b.status} · {money(b.totalAmount)}</AppText></View>)}
      {!data.bookingHistory.items.length && <AppText style={styles.hint}>Không có yêu cầu đặt xe tạo trong kỳ.</AppText>}
      {pages(data.bookingHistory, "Đơn thuê", onBookingPage)}
    </View>
    <Modal visible={caseId !== null} animationType="slide" onRequestClose={() => setCaseId(null)}><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>{caseId !== null && <DisputeDetailScreen disputeId={caseId} onBack={() => setCaseId(null)} />}</SafeAreaView></Modal>
  </>;
}
