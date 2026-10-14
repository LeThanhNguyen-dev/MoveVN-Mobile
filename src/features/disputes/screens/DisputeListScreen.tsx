import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  disputeStatusLabels,
  formatDisputeDateTime,
  formatDisputeMoney,
  problemLabels,
} from "@/features/disputes/components/disputeLabels";
import { getMyDisputes } from "@/features/disputes/disputeService";
import type { DisputeListItem } from "@/features/disputes/types";

const PAGE_SIZE = 10;

const STATUS_FILTERS = ["", "Open", "Investigating", "NeedMoreEvidence", "DecisionIssued", "AwaitingExternalSettlement", "Escalated", "Resolved"];
const TYPE_FILTERS = ["", "Damage", "Payment", "LateReturn", "Accident", "TrafficFine", "Other"];

// Port RN của khối danh sách trong FrontEnd DisputePage (chỉ luồng Customer/Owner).
export default function DisputeListScreen({
  onBack,
  onOpenDetail,
  onCreate,
}: {
  onBack: () => void;
  onOpenDetail: (id: number) => void;
  onCreate: () => void;
}) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [items, setItems] = useState<DisputeListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError("");
    try {
      const params: { page?: number; pageSize?: number; status?: string; reportType?: string; keyword?: string } = {
        page: nextPage,
        pageSize: PAGE_SIZE,
      };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.reportType = typeFilter;
      if (keyword) params.keyword = keyword;
      const result = await getMyDisputes(params);
      setItems(result.items);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages ?? Math.ceil(result.totalCount / PAGE_SIZE));
      setPage(result.page);
    } catch (err) {
      setItems([]);
      setError(getApiErrorMessage(err, "Không thể tải danh sách tranh chấp."));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, keyword]);

  useEffect(() => {
    void load(1);
  }, [load]);

  return (
    <View style={styles.screen}>
      <Pressable onPress={onBack}>
        <Text style={styles.backLink}>‹ Tài khoản</Text>
      </Pressable>
      <Text style={styles.screenTitle}>Tranh chấp của tôi</Text>
      <View style={styles.filterRow}>
        <TextInput
          value={keywordDraft}
          onChangeText={setKeywordDraft}
          onSubmitEditing={() => {
            setKeyword(keywordDraft.trim());
            setPage(1);
          }}
          placeholder="Tìm booking, khách, chủ xe"
          placeholderTextColor={theme.placeholder}
          style={[styles.input, styles.searchInput]}
        />
      </View>
      <Text style={styles.sectionLabel}>Trạng thái</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={STATUS_FILTERS}
        keyExtractor={(s) => s || "all"}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setStatusFilter(item);
              setPage(1);
            }}
            style={[styles.chip, statusFilter === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, statusFilter === item && styles.chipTextActive]}>
              {item === "" ? "Tất cả" : (disputeStatusLabels[item] ?? item)}
            </Text>
          </Pressable>
        )}
      />
      <Text style={styles.sectionLabel}>Loại vấn đề</Text>
      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={TYPE_FILTERS}
        keyExtractor={(s) => s || "all"}
        contentContainerStyle={styles.chips}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => {
              setTypeFilter(item);
              setPage(1);
            }}
            style={[styles.chip, typeFilter === item && styles.chipActive]}
          >
            <Text style={[styles.chipText, typeFilter === item && styles.chipTextActive]}>
              {item === "" ? "Tất cả" : (problemLabels[item] ?? item)}
            </Text>
          </Pressable>
        )}
      />
      <Text style={styles.muted}>{totalCount} tranh chấp</Text>

      {loading ? (
        <ActivityIndicator color={theme.brand} style={styles.loader} />
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => void load(page)} style={styles.retryButton}>
            <Text style={styles.retryText}>Thử lại</Text>
          </Pressable>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.title}>Chưa có tranh chấp</Text>
          <Text style={styles.muted}>Các hồ sơ phù hợp bộ lọc sẽ xuất hiện tại đây.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable onPress={() => onOpenDetail(item.id)} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text numberOfLines={1} style={styles.bookingCode}>
                  {item.bookingCode}
                </Text>
                <Text style={styles.status}>{disputeStatusLabels[item.status] ?? item.status}</Text>
              </View>
              <Text style={styles.muted}>
                #{item.id} · {formatDisputeDateTime(item.createdAt)} · {item.openedByName}
              </Text>
              <Text style={styles.problem}>{problemLabels[item.reportType] ?? item.reportType}</Text>
              <Text numberOfLines={2} style={styles.body}>
                {item.description}
              </Text>
              {item.trafficFineAmount != null ? (
                <Text style={styles.muted}>
                  {formatDisputeMoney(item.trafficFineAmount)} · Hạn {formatDisputeDateTime(item.trafficFineDueAt)}
                </Text>
              ) : null}
            </Pressable>
          )}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pager}>
                <Pressable disabled={page <= 1} onPress={() => void load(page - 1)} style={styles.pageButton}>
                  <Text style={styles.pageText}>‹</Text>
                </Pressable>
                <Text style={styles.muted}>
                  {page}/{totalPages}
                </Text>
                <Pressable disabled={page >= totalPages} onPress={() => void load(page + 1)} style={styles.pageButton}>
                  <Text style={styles.pageText}>›</Text>
                </Pressable>
              </View>
            ) : null
          }
        />
      )}

      <Pressable onPress={onCreate} style={styles.createButton}>
        <Text style={styles.createText}>+ Tạo tranh chấp</Text>
      </Pressable>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background, padding: 16, gap: 8 },
    backLink: { color: theme.brand, fontSize: 13, fontWeight: "700" },
    screenTitle: { color: theme.text, fontSize: 18, fontWeight: "800" },
    filterRow: { flexDirection: "row", gap: 8 },
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
    searchInput: { flex: 1 },
    sectionLabel: { color: theme.muted, fontSize: 12, fontWeight: "800", marginTop: 4 },
    chips: { gap: 8, paddingVertical: 2 },
    chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
    chipActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    chipText: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    chipTextActive: { color: theme.brand },
    muted: { color: theme.muted, fontSize: 13 },
    error: { color: theme.danger, fontSize: 13, fontWeight: "600" },
    loader: { marginTop: 32 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    retryButton: { borderWidth: 1, borderColor: theme.brandBorder, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
    retryText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    list: { gap: 10, paddingBottom: 90 },
    card: { gap: 4, borderWidth: 1, borderColor: theme.border, backgroundColor: theme.surface, borderRadius: 14, padding: 14 },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    bookingCode: { color: theme.text, fontSize: 14, fontWeight: "800", flex: 1 },
    status: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    problem: { color: theme.text, fontSize: 13, fontWeight: "700" },
    body: { color: theme.muted, fontSize: 13, lineHeight: 19 },
    pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 8 },
    pageButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: theme.border, alignItems: "center", justifyContent: "center" },
    pageText: { color: theme.text, fontSize: 18, fontWeight: "800" },
    createButton: { position: "absolute", left: 16, right: 16, bottom: 16, borderRadius: 14, backgroundColor: theme.brand, paddingVertical: 14, alignItems: "center" },
    createText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
