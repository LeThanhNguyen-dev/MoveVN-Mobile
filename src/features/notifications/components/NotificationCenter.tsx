import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Modal, Platform, Pressable, RefreshControl, ScrollView, SectionList, StyleSheet, View } from "react-native"
import AppText from "@/components/AppText";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, BellOff, CarFront, CheckCheck, CircleAlert, Flag, Headphones, RefreshCw } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import { getApiErrorMessage } from "@/services/apiClient";
import { loadNotificationPage, readAllNotifications, readNotification } from "../notificationActions";
import { formatNotificationDate, notificationDayGroup, notificationReference } from "../notificationPresentation";
import { notificationVisuals } from "../notificationVisuals";
import NotificationRow from "./NotificationRow";
import { useNotificationStore } from "../useNotifications";
import type { NotificationItem } from "../types";
import { getAuthUser, getSessionGeneration } from "@/features/auth/hooks/useAuth";
import { openSupportTickets } from "@/features/supportTickets/ticketNavigation";
import { ticketFromNotification } from "@/features/supportTickets/ticketModel";
import { openViolations } from "@/features/violations/violationNavigation";
import { violationFromNotification } from "@/features/violations/violationModel";
import { availabilityTarget, openAvailabilityAlerts, type AlertVehicleTarget } from "@/features/availabilityAlerts/alertNavigation";

export default function NotificationCenter({ userId }: { userId: number }) {
  const state = useNotificationStore();
  const visible = state.userId === userId && state.centerOpen;
  const [selected, setSelected] = useState<NotificationItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now);
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const detail = selected ? state.items.find((item) => item.id === selected.id) ?? state.updates[selected.id]?.item ?? selected : null;
  const detailVisual = detail ? notificationVisuals(detail, theme) : null;
  const sections = useMemo(() => {
    const groups = new Map<string, NotificationItem[]>();
    for (const item of state.items) {
      const title = notificationDayGroup(item.createdAt, now);
      const group = groups.get(title) ?? [];
      group.push(item);
      groups.set(title, group);
    }
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [state.items, now]);
  const busy = state.markingAll || state.pendingIds.length > 0;
  const pendingTicket = useRef<{ id: number; generation: number } | null>(null);
  const pendingReport = useRef<{ id: string; generation: number } | null>(null);
  const pendingVehicle = useRef<{ target: AlertVehicleTarget; generation: number } | null>(null);
  const vehicleTarget = availabilityTarget(detail?.dataJson);
  const ticketId = ticketFromNotification(detail?.dataJson);
  const reportId = violationFromNotification(detail?.dataJson);
  function launchPendingTicket() {
    const pending = pendingTicket.current; pendingTicket.current = null;
    if (pending && getAuthUser()?.userId === userId && pending.generation === getSessionGeneration()) openSupportTickets({ ticketId: pending.id });
    const report = pendingReport.current; pendingReport.current = null;
    if (report && getAuthUser()?.userId === userId && report.generation === getSessionGeneration()) openViolations({ reportId: report.id });
    const vehicle = pendingVehicle.current; pendingVehicle.current = null;
    if (vehicle && getAuthUser()?.userId === userId && vehicle.generation === getSessionGeneration()) openAvailabilityAlerts(vehicle.target);
  }

  useEffect(() => {
    if (visible) {
      setSelected(null);
      setActionError(null);
      void loadNotificationPage();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, [visible]);

  function goBack() {
    setActionError(null);
    if (selected) setSelected(null);
    else useNotificationStore.setState({ centerOpen: false });
  }

  async function openItem(item: NotificationItem) {
    setSelected(item);
    setActionError(null);
    if (item.isRead) return;
    try { await readNotification(item.id); }
    catch (error) { setActionError(getApiErrorMessage(error, "Chưa thể đánh dấu đã đọc. Bạn có thể thử lại.")); }
  }

  async function markAll() {
    setActionError(null);
    try { await readAllNotifications(); }
    catch (error) { setActionError(getApiErrorMessage(error, "Không thể đánh dấu tất cả đã đọc. Vui lòng thử lại.")); }
  }

  const ErrorNotice = ({ message }: { message: string }) => <View accessibilityRole="alert" style={styles.error}>
    <CircleAlert size={18} color={theme.danger} />
    <AppText style={styles.errorText}>{message}</AppText>
  </View>;

  return <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={goBack} onDismiss={launchPendingTicket}>
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" accessibilityLabel={detail ? "Quay lại danh sách thông báo" : "Đóng thông báo"} onPress={goBack} style={styles.iconButton}>
            <ArrowLeft size={23} color={theme.text} />
          </Pressable>
          <View style={styles.heading}>
            <AppText display style={styles.title}>{detail ? "Chi tiết thông báo" : "Thông báo"}</AppText>
            {!detail ? <AppText style={styles.subtitle}>{state.countError ? "Chưa thể cập nhật số chưa đọc" : state.countRevision === 0 ? "Đang cập nhật thông báo…" : state.unreadCount > 0 ? `${state.unreadCount} thông báo chưa đọc` : "Bạn đã đọc hết thông báo"}</AppText> : null}
          </View>
          {!detail ? <Pressable accessibilityRole="button" accessibilityLabel="Làm mới thông báo" disabled={state.loading || state.refreshing} onPress={() => { void loadNotificationPage(); }} style={styles.iconButton}>
            {state.refreshing ? <ActivityIndicator color={theme.brand} /> : <RefreshCw size={20} color={theme.brand} />}
          </Pressable> : null}
        </View>
        {detail ? <ScrollView contentContainerStyle={styles.detailContent}>
          <View style={styles.detailCard}>
            <View style={styles.row}>
              <View style={[styles.category, { backgroundColor: detailVisual!.background }]}>
                <AppText style={[styles.categoryText, { color: detailVisual!.color }]}>{detailVisual!.label}</AppText>
              </View>
              <AppText style={[styles.status, { color: detail.isRead ? theme.success : theme.brand }]}>{detail.isRead ? "Đã đọc" : "Chưa đọc"}</AppText>
            </View>
            {detailVisual?.urgent ? <View style={[styles.detailWarning, { backgroundColor: detailVisual.background }]}>
              <CircleAlert size={15} color={detailVisual.color} />
              <AppText style={{ color: detailVisual.color, fontSize: 12, fontWeight: "600" }}>Cảnh báo quá hạn</AppText>
            </View> : null}
            <AppText display selectable style={styles.detailTitle}>{detail.title}</AppText>
            <AppText style={styles.date}>{formatNotificationDate(detail.createdAt)}</AppText>
            <View style={styles.rule} />
            <AppText selectable style={styles.body}>{detail.body}</AppText>
            {notificationReference(detail.dataJson) ? <AppText selectable style={styles.reference}>{notificationReference(detail.dataJson)}</AppText> : null}
            {vehicleTarget && <Pressable accessibilityRole="button" onPress={() => {
              pendingVehicle.current = { target: vehicleTarget, generation: getSessionGeneration() };
              useNotificationStore.setState({ centerOpen: false });
              if (Platform.OS !== "ios") launchPendingTicket();
            }} style={styles.primaryButton}><CarFront color={theme.onBrand} size={19} /><AppText style={styles.primaryText}>Xem xe và lịch thuê</AppText></Pressable>}
            {reportId && <Pressable accessibilityRole="button" onPress={() => {
              pendingReport.current = { id: reportId, generation: getSessionGeneration() };
              useNotificationStore.setState({ centerOpen: false });
              if (Platform.OS !== "ios") launchPendingTicket();
            }} style={styles.primaryButton}><Flag color={theme.onBrand} size={19} /><AppText style={styles.primaryText}>Xem kết quả báo cáo</AppText></Pressable>}
            {ticketId && <Pressable accessibilityRole="button" onPress={() => {
              pendingTicket.current = { id: ticketId, generation: getSessionGeneration() };
              useNotificationStore.setState({ centerOpen: false });
              if (Platform.OS !== "ios") launchPendingTicket();
            }} style={styles.primaryButton}><Headphones color={theme.onBrand} size={19} /><AppText style={styles.primaryText}>Xem yêu cầu hỗ trợ</AppText></Pressable>}
          </View>
          {actionError ? <ErrorNotice message={actionError} /> : null}
          {!detail.isRead ? <Pressable accessibilityRole="button" accessibilityLabel="Đánh dấu thông báo đã đọc" disabled={busy} onPress={() => { void openItem(detail); }} style={[styles.primaryButton, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color={theme.onBrand} /> : <CheckCheck size={20} color={theme.onBrand} />}
            <AppText style={styles.primaryText}>Đánh dấu đã đọc</AppText>
          </Pressable> : null}
        </ScrollView> : <>
          <View style={styles.toolbar}>
            <View style={styles.tabs}>
              {(["all", "unread"] as const).map((filter) => <Pressable key={filter} accessibilityRole="tab" accessibilityState={{ selected: state.filter === filter }} onPress={() => { setActionError(null); void loadNotificationPage({ filter }); }} style={[styles.tab, state.filter === filter && styles.activeTab]}>
                <AppText style={[styles.tabText, state.filter === filter && styles.activeTabText]}>{filter === "all" ? "Tất cả" : "Chưa đọc"}</AppText>
                {filter === "unread" && state.unreadCount > 0 && !state.countError ? (
                  <View style={[styles.tabCount, state.filter === filter && styles.activeTabCount]}>
                    <AppText style={{ color: state.filter === filter ? theme.onBrand : theme.brand, fontSize: 10, fontWeight: "700" }}>
                      {state.unreadCount > 99 ? "99+" : state.unreadCount}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>)}
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Đánh dấu tất cả thông báo đã đọc" disabled={busy || state.unreadCount === 0} onPress={() => { void markAll(); }} style={[styles.markAll, (busy || state.unreadCount === 0) && styles.disabled]}>
              {state.markingAll ? <ActivityIndicator color={theme.brand} size="small" /> : <CheckCheck size={19} color={theme.brand} />}
              <AppText style={styles.markAllText}>Đọc tất cả</AppText>
            </Pressable>
          </View>
          {state.connectionStatus !== "connected" ? <AppText style={styles.connectionHint}>{state.connectionStatus === "connecting" ? "Đang kết nối cập nhật trực tiếp…" : "Cập nhật trực tiếp gián đoạn. Kéo xuống để làm mới."}</AppText> : null}
          {actionError ? <View style={styles.notice}><ErrorNotice message={actionError} /></View> : null}
          {state.error && state.items.length > 0 ? <View style={styles.notice}><ErrorNotice message={state.error} /></View> : null}
          <SectionList
            sections={sections}
            stickySectionHeadersEnabled={false}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={[styles.list, state.items.length === 0 && styles.emptyList]}
            refreshControl={<RefreshControl refreshing={state.refreshing} onRefresh={() => { setActionError(null); void loadNotificationPage(); }} tintColor={theme.brand} colors={[theme.brand]} />}
            renderSectionHeader={({ section }) => <View style={styles.sectionHeader}>
              <AppText style={styles.sectionTitle}>{section.title}</AppText>
              <View style={styles.sectionRule} />
            </View>}
            renderItem={({ item }) => <NotificationRow item={item} now={now} onOpen={(value) => { void openItem(value); }} />}
            ListEmptyComponent={state.loading ? <View style={styles.empty}><ActivityIndicator size="large" color={theme.brand} /><AppText style={styles.emptyText}>Đang tải thông báo…</AppText></View>
              : state.error ? <View style={styles.empty}><CircleAlert size={38} color={theme.danger} /><AppText display style={styles.emptyTitle}>Chưa tải được thông báo</AppText><AppText style={styles.emptyText}>{state.error}</AppText><Pressable accessibilityRole="button" onPress={() => { void loadNotificationPage(); }} style={styles.retry}><AppText style={styles.retryText}>Thử lại</AppText></Pressable></View>
                : <View style={styles.empty}><View style={styles.emptyIcon}><BellOff size={36} color={theme.brand} /></View><AppText display style={styles.emptyTitle}>{state.filter === "unread" ? "Không có thông báo chưa đọc" : "Chưa có thông báo"}</AppText><AppText style={styles.emptyText}>{state.filter === "unread" ? "Bạn đã xem hết các cập nhật." : "Các cập nhật về chuyến đi, thanh toán và hỗ trợ sẽ xuất hiện tại đây."}</AppText></View>}
            ListFooterComponent={state.items.length > 0 ? <View style={styles.footer}>
              {state.page < state.totalPages || state.error ? <Pressable accessibilityRole="button" disabled={state.loadingMore || state.refreshing || state.loading} onPress={() => { void loadNotificationPage({ more: state.page < state.totalPages }); }} style={styles.retry}>
                {state.loadingMore ? <ActivityIndicator color={theme.brand} /> : <AppText style={styles.retryText}>{state.error ? "Thử tải lại" : "Xem thêm thông báo"}</AppText>}
              </Pressable> : <AppText style={styles.footerText}>Bạn đã xem hết thông báo</AppText>}
            </View> : null}
          />
        </>}
      </SafeAreaView>
    </SafeAreaProvider>
  </Modal>;
}

const createStyles = (theme: Theme) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  header: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: theme.surface, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
  heading: { flex: 1 }, title: { fontSize: 22, fontWeight: "800", color: theme.text }, subtitle: { fontSize: 12, color: theme.muted, marginTop: 4 },
  iconButton: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.surfaceAlt, alignItems: "center", justifyContent: "center" },
  toolbar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4, flexDirection: "row", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 },
  tabs: { flexDirection: "row", gap: 3, padding: 3, borderRadius: 12, backgroundColor: theme.surfaceAlt },
  tab: { minHeight: 36, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 5, justifyContent: "center", borderRadius: 9 }, activeTab: { backgroundColor: theme.surface },
  tabText: { fontSize: 13, fontWeight: "700", color: theme.muted }, activeTabText: { color: theme.brand },
  tabCount: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: theme.brandSoft, alignItems: "center", justifyContent: "center" },
  activeTabCount: { backgroundColor: theme.brand },
  markAll: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 4 }, markAllText: { fontSize: 11, color: theme.brand, fontWeight: "600" },
  connectionHint: { paddingHorizontal: 20, paddingBottom: 12, fontSize: 12, lineHeight: 18, color: theme.muted },
  list: { paddingHorizontal: 16, paddingBottom: 24 }, emptyList: { flexGrow: 1 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, paddingBottom: 10 },
  sectionTitle: { color: theme.muted, fontSize: 12, fontWeight: "700" },
  sectionRule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.border },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  date: { color: theme.muted, fontSize: 11, lineHeight: 17, marginTop: 8 },
  empty: { flex: 1, padding: 28, alignItems: "center", justifyContent: "center", gap: 12 }, emptyIcon: { padding: 24, borderRadius: 50, backgroundColor: theme.brandSoft },
  emptyTitle: { fontSize: 18, color: theme.text, fontWeight: "800", textAlign: "center" }, emptyText: { color: theme.muted, fontSize: 14, lineHeight: 22, textAlign: "center" },
  retry: { minHeight: 44, paddingHorizontal: 22, paddingVertical: 12, backgroundColor: theme.brandSoft, borderRadius: 12, alignItems: "center" }, retryText: { color: theme.brand, fontSize: 13, fontWeight: "700" },
  footer: { paddingVertical: 18, alignItems: "center" }, footerText: { color: theme.faint, fontSize: 12 },
  notice: { paddingHorizontal: 16, paddingBottom: 12 }, error: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, borderRadius: 12, backgroundColor: theme.dangerSoft }, errorText: { flex: 1, fontSize: 13, lineHeight: 19, color: theme.danger },
  detailContent: { padding: 16, gap: 12 }, detailCard: { padding: 18, borderRadius: 16, backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  category: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.brandSoft }, categoryText: { color: theme.brand, fontSize: 12, fontWeight: "700" }, status: { fontSize: 12, fontWeight: "700" },
  detailWarning: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 6, marginTop: 14, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  detailTitle: { marginTop: 14, color: theme.text, fontSize: 21, lineHeight: 29, fontWeight: "800" }, rule: { height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: 16 },
  body: { color: theme.text, fontSize: 15, lineHeight: 24 }, reference: { color: theme.brand, fontSize: 12, marginTop: 16, padding: 10, borderRadius: 9, backgroundColor: theme.brandSoft },
  primaryButton: { minHeight: 48, marginTop: 8, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 14, backgroundColor: theme.brand }, primaryText: { fontSize: 14, color: theme.onBrand, fontWeight: "700" }, disabled: { opacity: 0.5 },
});
