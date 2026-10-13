import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft, BellRing } from "lucide-react-native";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/features/notifications/services/notificationService";
import { useNotificationStore } from "@/features/notifications/useNotifications";
import { useAuthStore } from "@/features/auth/hooks/useAuth";
import type { NotificationItem } from "@/features/notifications/types";
import { parseBookingTarget } from "@/features/notifications/utils/target";
import { getApiErrorMessage } from "@/services/apiClient";

const PAGE_SIZE = 15;

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function NotificationsScreen({
  onBack,
  onOpenBooking,
}: {
  onBack: () => void;
  onOpenBooking: (bookingId: number) => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const activeRole = useAuthStore((s) => s.activeRole);
  const storeItems = useNotificationStore((s) => s.items);
  const markReadLocal = useNotificationStore((s) => s.markRead);
  const markAllReadLocal = useNotificationStore((s) => s.markAllRead);
  const setUnreadCount = useNotificationStore((s) => s.setUnreadCount);

  const [items, setItems] = useState<NotificationItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const load = useCallback(
    async (targetPage: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError("");
      try {
        const res = await getNotifications({ page: targetPage, pageSize: PAGE_SIZE });
        setItems((prev) => (append ? [...prev, ...res.items.filter((n) => !prev.some((p) => p.id === n.id))] : res.items));
        setTotalCount(res.totalCount);
        setPage(res.page);
      } catch (err) {
        if (!append) setError(getApiErrorMessage(err, "Không tải được thông báo."));
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(1, false);
  }, [load]);

  // Realtime đẩy về thì store có trước, hợp nhất vào danh sách đang xem.
  useEffect(() => {
    setItems((prev) => {
      const fresh = storeItems.filter((n) => !prev.some((p) => p.id === n.id));
      return fresh.length > 0 ? [...fresh, ...prev] : prev;
    });
  }, [storeItems]);

  async function handleOpen(item: NotificationItem) {
    if (!item.isRead) {
      markReadLocal(item.id);
      try {
        await markNotificationAsRead(item.id);
      } catch {
        // Đánh dấu lỗi thì lần mở sau thử lại, không chặn xem.
      }
    }
    const target = parseBookingTarget(item.dataJson);
    if (!target) return;
    const expected = target.roleTarget.toLowerCase();
    const current = (activeRole || "").toLowerCase();
    if (expected && current && expected !== current) {
      Alert.alert(
        "Thông báo vai trò khác",
        `Thông báo này dành cho ${target.roleTarget}. Hãy chuyển vai trò trong app để mở chuyến xe.`,
      );
      return;
    }
    onOpenBooking(target.bookingId);
  }

  async function handleMarkAll() {
    try {
      await markAllNotificationsAsRead();
      markAllReadLocal();
      setUnreadCount(0);
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true, readAt: new Date().toISOString() })));
    } catch (err) {
      void err;
    }
  }

  function renderItem({ item }: { item: NotificationItem }) {
    return (
      <Pressable
        onPress={() => handleOpen(item)}
        style={[styles.card, !item.isRead && styles.cardUnread]}
      >
        <View style={styles.cardTop}>
          <Text numberOfLines={2} style={styles.title}>
            {item.title}
          </Text>
          {!item.isRead && <View style={styles.dot} />}
        </View>
        <Text numberOfLines={3} style={styles.body}>
          {item.body}
        </Text>
        <Text style={styles.time}>{formatTime(item.createdAt)}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Thông báo</Text>
        <Pressable onPress={handleMarkAll}>
          <Text style={styles.markAll}>Đọc hết</Text>
        </Pressable>
      </View>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{error}</Text>
          <Pressable onPress={() => load(1, false)} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <BellRing color={theme.placeholder} size={40} />
              <Text style={styles.muted}>Chưa có thông báo nào.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(1, false);
              }}
              tintColor={theme.brand}
            />
          }
          onEndReached={() => {
            if (!loadingMore && page < pages) void load(page + 1, true);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color={theme.brand} /> : null}
        />
      )}
    </View>
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
    markAll: { color: theme.brand, fontSize: 13, fontWeight: "800" },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 24 },
    muted: { color: theme.muted, fontSize: 13, textAlign: "center" },
    retryButton: {
      borderRadius: 10,
      backgroundColor: theme.brand,
      paddingHorizontal: 18,
      paddingVertical: 10,
    },
    retryText: { color: theme.onBrand, fontWeight: "800" },
    list: { gap: 10, padding: 16, paddingBottom: 32, flexGrow: 1 },
    card: {
      backgroundColor: theme.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: 12,
      padding: 14,
      gap: 4,
    },
    cardUnread: { borderColor: theme.brand, borderWidth: 1 },
    cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    title: { color: theme.text, fontSize: 14, fontWeight: "800", flex: 1 },
    dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: theme.brand, marginTop: 5 },
    body: { color: theme.text, fontSize: 13, lineHeight: 18 },
    time: { color: theme.placeholder, fontSize: 11 },
  });
