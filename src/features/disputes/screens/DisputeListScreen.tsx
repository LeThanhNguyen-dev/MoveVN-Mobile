import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { ArrowLeft, Scale } from "lucide-react-native";
import { useTheme } from "@/theme/useTheme";
import type { Theme } from "@/theme/tokens";
import { getMyDisputes } from "@/features/disputes/disputeService";
import type { DisputeListItem } from "@/features/disputes/types";
import {
  DISPUTE_STATUS_FILTERS,
  disputeStatusLabel,
  disputeTypeLabel,
} from "@/features/disputes/disputeLabels";
import { formatDateTime } from "@/features/booking/utils/format";
import { getApiErrorMessage } from "@/services/apiClient";
import DisputeDetailScreen from "./DisputeDetailScreen";

const PAGE_SIZE = 10;

export default function DisputeListScreen({ onBack }: { onBack: () => void }) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = useState<DisputeListItem[]>([]);
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const fetchPage = useCallback(async (targetPage: number, targetStatus: string, replace: boolean) => {
    if (replace) {
      setLoading(true);
      setError("");
    } else {
      setLoadingMore(true);
    }
    try {
      const res = await getMyDisputes({
        status: targetStatus || undefined,
        page: targetPage,
        pageSize: PAGE_SIZE,
      });
      setItems((prev) => (replace ? res.items : [...prev, ...res.items]));
      setTotalCount(res.totalCount);
      setPage(res.page);
    } catch (err) {
      if (replace) setError(getApiErrorMessage(err, "Không tải được danh sách tranh chấp."));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchPage(1, status, true);
  }, [fetchPage, status]);

  const hasMore = items.length < totalCount;

  if (selectedId != null) {
    return <DisputeDetailScreen disputeId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Tranh chấp</Text>
        <View style={styles.backButton} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filterContent}>
        {DISPUTE_STATUS_FILTERS.map((f) => (
          <Pressable
            key={f.key}
            onPress={() => setStatus(f.key)}
            style={[styles.chip, status === f.key && styles.chipActive]}
          >
            <Text style={[styles.chipText, status === f.key && styles.chipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.brand} />
          <Text style={styles.muted}>Đang tải tranh chấp...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.title}>Không tải được</Text>
          <Text style={styles.muted}>{error}</Text>
          <Pressable style={styles.retry} onPress={() => void fetchPage(1, status, true)}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void fetchPage(1, status, true);
              }}
              tintColor={theme.brand}
              colors={[theme.brand]}
            />
          }
          onEndReached={() => {
            if (hasMore && !loadingMore) void fetchPage(page + 1, status, false);
          }}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Scale color={theme.brand} size={36} />
              <Text style={styles.title}>Chưa có tranh chấp</Text>
              <Text style={styles.muted}>Các khiếu nại về chuyến đi sẽ hiện ở đây.</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator color={theme.brand} style={styles.footer} /> : null
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => setSelectedId(item.id)} style={styles.card}>
              <View style={styles.topRow}>
                <Text numberOfLines={1} style={styles.code}>
                  {(item.bookingCode ?? "").toUpperCase()} · {disputeTypeLabel(item.reportType)}
                </Text>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{disputeStatusLabel(item.status)}</Text>
                </View>
              </View>
              <Text numberOfLines={2} style={styles.desc}>
                {item.description}
              </Text>
              <Text style={styles.muted}>Mở lúc {formatDateTime(item.createdAt)}</Text>
            </Pressable>
          )}
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
    filters: { flexGrow: 0 },
    filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.border,
      paddingHorizontal: 12,
      paddingVertical: 7,
      marginRight: 8,
    },
    chipActive: { backgroundColor: theme.brand, borderColor: theme.brand },
    chipText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    chipTextActive: { color: theme.onBrand },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 20 },
    title: { color: theme.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
    muted: { color: theme.muted, fontSize: 13, textAlign: "center" },
    retry: {
      marginTop: 8,
      paddingHorizontal: 22,
      paddingVertical: 12,
      backgroundColor: theme.brandSoft,
      borderRadius: 12,
    },
    retryText: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    list: { padding: 16, gap: 12 },
    card: {
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 14,
      gap: 6,
    },
    topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    code: { color: theme.faint, fontSize: 11, fontWeight: "700", flex: 1 },
    badge: { borderRadius: 999, backgroundColor: theme.brandSoft, paddingHorizontal: 9, paddingVertical: 4 },
    badgeText: { color: theme.brand, fontSize: 11, fontWeight: "800" },
    desc: { color: theme.text, fontSize: 14, lineHeight: 20 },
    empty: { padding: 32, alignItems: "center", gap: 10 },
    footer: { paddingVertical: 16 },
  });
