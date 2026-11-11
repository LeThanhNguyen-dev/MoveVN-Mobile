import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AppText from "@/components/AppText";
import DisputeDetailScreen from "@/features/disputes/screens/DisputeDetailScreen";
import { usePushNavigation } from "@/features/notifications/pushNavigation";
import { useTheme } from "@/theme/useTheme";
import { money, type AnalyticsPage, type OwnerAnalytics } from "./types";

const date = (value: string) => new Date(value).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

export default function OwnerVehicleDetails({ data, userId, onBookingPage, onDisputePage }: {
  data: OwnerAnalytics; userId: number; onBookingPage: (page: number) => void; onDisputePage: (page: number) => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme(); const [caseId, setCaseId] = useState<number | null>(null);
  const statuses: Record<string, string> = { Pending: t("mobile:ownerAnalytics.details.bookingStatus.Pending"), Approved: t("mobile:ownerAnalytics.details.bookingStatus.Approved"), Confirmed: t("mobile:ownerAnalytics.details.bookingStatus.Confirmed"), DepositPaid: t("mobile:ownerAnalytics.details.bookingStatus.DepositPaid"), InProgress: t("mobile:ownerAnalytics.details.bookingStatus.InProgress"), Returning: t("mobile:ownerAnalytics.details.bookingStatus.Returning"), Returned: t("mobile:ownerAnalytics.details.bookingStatus.Returned"), Completed: t("mobile:ownerAnalytics.details.bookingStatus.Completed"), Cancelled: t("mobile:ownerAnalytics.details.bookingStatus.Cancelled"), Rejected: t("mobile:ownerAnalytics.details.bookingStatus.Rejected") };
  const styles = StyleSheet.create({ panel: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border, borderRadius: 18, padding: 16, gap: 12 },
    title: { fontSize: 16, fontWeight: "700", color: theme.text }, hint: { fontSize: 12, lineHeight: 20, color: theme.muted },
    row: { gap: 5, borderTopWidth: StyleSheet.hairlineWidth, borderColor: theme.border, paddingTop: 12 },
    body: { fontSize: 13, lineHeight: 21, color: theme.text }, link: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    pages: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }, button: { minHeight: 40, justifyContent: "center", paddingHorizontal: 8 }, disabled: { opacity: 0.4 } });
  const pages = <T,>(page: AnalyticsPage<T>, label: string, change: (value: number) => void) => <View style={styles.pages}>
    <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:ownerAnalytics.pagination.prevAria", { label })} disabled={page.page <= 1} onPress={() => change(page.page - 1)} style={[styles.button, page.page <= 1 && styles.disabled]}><AppText style={styles.link}>{t("common:previousPage")}</AppText></Pressable>
    <AppText style={styles.hint}>{t("mobile:ownerAnalytics.pagination.page", { page: page.page, total: Math.max(1, page.totalPages) })}</AppText>
    <Pressable accessibilityRole="button" accessibilityLabel={t("mobile:ownerAnalytics.pagination.nextAria", { label })} disabled={page.page >= page.totalPages} onPress={() => change(page.page + 1)} style={[styles.button, page.page >= page.totalPages && styles.disabled]}><AppText style={styles.link}>{t("common:nextPage")}</AppText></Pressable>
  </View>;
  const openBooking = (bookingId: number) => usePushNavigation.setState({ pending: { bookingId, userId, roleTarget: "Owner", requestId: `analytics-${bookingId}-${Date.now()}` } });
  if (!data.disputes || !data.bookingHistory) return <View style={styles.panel}><AppText style={styles.hint}>{t("owner:analytics.details.backendRequired")}</AppText></View>;
  return <>
    <View style={styles.panel}><AppText display style={styles.title}>{t("owner:analytics.details.disputes.title")}</AppText><AppText style={styles.hint}>{t("mobile:ownerAnalytics.details.disputes.description")}</AppText>
      {data.disputes.items.map(d => <View key={d.id} style={styles.row}><AppText style={styles.body}>#{d.id} · {d.bookingCode}</AppText><AppText style={styles.hint}>{date(d.createdAt)} · {d.isTrafficFine ? t("owner:analytics.details.disputes.trafficFine") : t("owner:analytics.details.disputes.bookingDispute")}</AppText><AppText style={styles.body}>{d.status === "Resolved" ? t("owner:analytics.details.disputes.statusResolved") : t("owner:analytics.details.disputes.statusOpen")}</AppText><Pressable accessibilityRole="button" accessibilityLabel={t("mobile:ownerAnalytics.details.disputes.viewAria", { id: d.id })} style={styles.button} onPress={() => setCaseId(d.id)}><AppText style={styles.link}>{t("owner:analytics.details.disputes.viewRecord")}</AppText></Pressable></View>)}
      {!data.disputes.items.length && <AppText style={styles.hint}>{t("owner:analytics.details.disputes.empty")}</AppText>}
      {pages(data.disputes, t("owner:analytics.table.disputes"), onDisputePage)}
    </View>
    <View style={styles.panel}><AppText display style={styles.title}>{t("owner:analytics.details.history.title")}</AppText><AppText style={styles.hint}>{t("mobile:ownerAnalytics.details.history.description")}</AppText>
      {data.bookingHistory.items.map(b => <View key={b.id} style={styles.row}><Pressable accessibilityRole="button" accessibilityLabel={t("mobile:ownerAnalytics.details.history.viewAria", { code: b.bookingCode })} onPress={() => openBooking(b.id)} style={styles.button}><AppText style={styles.link}>{b.bookingCode} →</AppText></Pressable><AppText style={styles.hint}>{t("mobile:ownerAnalytics.details.history.createdAt", { time: date(b.createdAt) })}</AppText><AppText style={styles.body}>{date(b.startDate)} → {date(b.endDate)}</AppText><AppText style={styles.body}>{statuses[b.status] ?? b.status} · {money(b.totalAmount)}</AppText></View>)}
      {!data.bookingHistory.items.length && <AppText style={styles.hint}>{t("owner:analytics.details.history.empty")}</AppText>}
      {pages(data.bookingHistory, t("owner:analytics.actions.bookings"), onBookingPage)}
    </View>
    <Modal visible={caseId !== null} animationType="slide" onRequestClose={() => setCaseId(null)}><SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>{caseId !== null && <DisputeDetailScreen disputeId={caseId} onBack={() => setCaseId(null)} />}</SafeAreaView></Modal>
  </>;
}
