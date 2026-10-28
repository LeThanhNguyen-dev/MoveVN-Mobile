import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";
import { getApiErrorMessage } from "@/services/apiClient";
import {
  disputeStatusLabels,
  formatDisputeDateTime,
  formatDisputeMoney,
  problemLabels,
} from "@/features/disputes/components/disputeLabels";
import {
  FINE_STATUS_FILTERS,
  STATUS_FILTERS,
  TYPE_FILTERS,
  fineStatusFilterLabel,
  statusFilterLabel,
  typeFilterLabel,
} from "@/features/disputes/components/disputeFilters";
import { getDisputeStatusStyle, getFineStatusStyle } from "@/features/disputes/components/disputeStatusStyles";
import { getMyDisputes } from "@/features/disputes/disputeService";
import type { DisputeListItem } from "@/features/disputes/types";

const PAGE_SIZE = 10;

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
  const { theme, mode } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [items, setItems] = useState<DisputeListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [fineStatusFilter, setFineStatusFilter] = useState("");
  const [keywordDraft, setKeywordDraft] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const activeFilterCount =
    (statusFilter ? 1 : 0) + (typeFilter ? 1 : 0) + (fineStatusFilter ? 1 : 0) + (keyword ? 1 : 0);

  const load = useCallback(
    async (nextPage: number) => {
      setLoading(true);
      setError("");
      try {
        const params: {
          page?: number;
          pageSize?: number;
          status?: string;
          reportType?: string;
          trafficFineStatus?: string;
          keyword?: string;
        } = {
          page: nextPage,
          pageSize: PAGE_SIZE,
        };
        if (statusFilter) params.status = statusFilter;
        if (typeFilter) params.reportType = typeFilter;
        if (typeFilter === "TrafficFine" && fineStatusFilter) params.trafficFineStatus = fineStatusFilter;
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
    },
    [statusFilter, typeFilter, fineStatusFilter, keyword],
  );

  useEffect(() => {
    void load(1);
  }, [load]);

  function resetFilters() {
    setStatusFilter("");
    setTypeFilter("");
    setFineStatusFilter("");
    setKeywordDraft("");
    setKeyword("");
    setPage(1);
  }

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.padded}>
        <View style={styles.searchRow}>
          <TextInput
            value={keywordDraft}
            onChangeText={setKeywordDraft}
            onSubmitEditing={() => {
              setKeyword(keywordDraft.trim());
              setPage(1);
            }}
            returnKeyType="search"
            placeholder="Tìm booking, khách, chủ xe"
            placeholderTextColor={theme.placeholder}
            style={[styles.input, styles.searchInput]}
          />
          {keywordDraft || keyword ? (
            <Pressable
              onPress={() => {
                setKeywordDraft("");
                setKeyword("");
                setPage(1);
              }}
              style={styles.clearButton}
            >
              <Text style={styles.clearText}>Xóa</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.filterHeadRow, styles.padded]}>
        <Text style={styles.sectionLabel}>Trạng thái</Text>
        {activeFilterCount > 0 ? (
          <Pressable onPress={resetFilters}>
            <Text style={styles.resetText}>Xóa lọc ({activeFilterCount})</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chips}
      >
        {STATUS_FILTERS.map((s) => {
          const active = statusFilter === s;
          return (
            <Pressable
              key={s || "all"}
              onPress={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{statusFilterLabel(s)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, styles.padded]}>Loại vấn đề</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chips}
      >
        {TYPE_FILTERS.map((t) => {
          const active = typeFilter === t;
          return (
            <Pressable
              key={t || "all"}
              onPress={() => {
                setTypeFilter(t);
                // Đổi loại khác phạt nguội thì xóa lọc trạng thái phạt nguội.
                if (t !== "TrafficFine") setFineStatusFilter("");
                setPage(1);
              }}
              style={[styles.chip, active && styles.chipActive]}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{typeFilterLabel(t)}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {typeFilter === "TrafficFine" ? (
        <>
          <Text style={[styles.sectionLabel, styles.padded]}>Trạng thái hồ sơ phạt nguội</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
            contentContainerStyle={styles.chips}
          >
            {FINE_STATUS_FILTERS.map((f) => {
              const active = fineStatusFilter === f;
              return (
                <Pressable
                  key={f || "all"}
                  onPress={() => {
                    setFineStatusFilter(f);
                    setPage(1);
                  }}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {fineStatusFilterLabel(f)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </>
      ) : null}

      <View style={[styles.countRow, styles.padded]}>
        <Text style={styles.countBadge}>{totalCount} tranh chấp</Text>
        {keyword ? <Text style={styles.muted}>Lọc: “{keyword}”</Text> : null}
      </View>
    </View>
  );

  return (
    <View style={styles.screen}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quay lại Tài khoản"
          onPress={onBack}
          hitSlop={8}
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>
        <Text style={styles.screenTitle}>Tranh chấp của tôi</Text>
        <View style={styles.backButtonPlaceholder} />
      </View>

      {loading ? (
        <ScrollView contentContainerStyle={styles.scrollGrow}>
          {header}
          <ActivityIndicator color={theme.brand} style={styles.loader} />
        </ScrollView>
      ) : error ? (
        <ScrollView contentContainerStyle={styles.scrollGrow}>
          {header}
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => void load(page)} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        </ScrollView>
      ) : items.length === 0 ? (
        <ScrollView contentContainerStyle={styles.scrollGrow}>
          {header}
          <View style={styles.center}>
            <Text style={styles.title}>Chưa có tranh chấp</Text>
            <Text style={styles.mutedCenter}>Các hồ sơ phù hợp bộ lọc sẽ xuất hiện tại đây.</Text>
            {activeFilterCount > 0 ? (
              <Pressable onPress={resetFilters} style={styles.retryButton}>
                <Text style={styles.retryText}>Xóa bộ lọc</Text>
              </Pressable>
            ) : null}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
          renderItem={({ item }) => {
            const st = getDisputeStatusStyle(item.status, mode);
            return (
              <Pressable onPress={() => onOpenDetail(item.id)} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text numberOfLines={1} style={styles.bookingCode}>
                    {item.bookingCode}
                  </Text>
                  <View style={[styles.badge, { backgroundColor: st.bg, borderColor: st.border }]}>
                    <View style={[styles.dot, { backgroundColor: st.dot }]} />
                    <Text style={[styles.badgeText, { color: st.text }]}>
                      {disputeStatusLabels[item.status] ?? item.status}
                    </Text>
                  </View>
                </View>
                <Text style={styles.muted}>
                  #{item.id} · {formatDisputeDateTime(item.createdAt)} · {item.openedByName}
                </Text>
                <View style={styles.tagRow}>
                  <View style={styles.typeChip}>
                    <Text style={styles.typeChipText}>{problemLabels[item.reportType] ?? item.reportType}</Text>
                  </View>
                  {item.adminManaged ? (
                    <View style={styles.adminChip}>
                      <Text style={styles.adminChipText}>Admin xử lý</Text>
                    </View>
                  ) : null}
                </View>
                <Text numberOfLines={2} style={styles.body}>
                  {item.description}
                </Text>
                {item.reportType === "TrafficFine" && item.trafficFineAmount != null ? (
                  <View style={styles.fineRow}>
                    <Text style={styles.fineMoney}>{formatDisputeMoney(item.trafficFineAmount)}</Text>
                    {item.trafficFineStatus ? (
                      <FineBadge status={item.trafficFineStatus} />
                    ) : null}
                    <Text style={styles.muted}>Hạn {formatDisputeDateTime(item.trafficFineDueAt)}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          }}
          ListFooterComponent={
            totalPages > 1 ? (
              <View style={styles.pager}>
                <Pressable disabled={page <= 1} onPress={() => void load(page - 1)} style={styles.pageButton}>
                  <Text style={styles.pageText}>‹</Text>
                </Pressable>
                <Text style={styles.muted}>
                  {page}/{totalPages}
                </Text>
                <Pressable
                  disabled={page >= totalPages}
                  onPress={() => void load(page + 1)}
                  style={styles.pageButton}
                >
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

function FineBadge({ status }: { status: string }) {
  const { theme, mode } = useTheme();
  const st = getFineStatusStyle(status, mode);
  const label =
    status === "Submitted"
      ? "Chờ xác minh"
      : status === "AwaitingCustomerResponse"
        ? "Chờ khách xác nhận"
        : status === "ResponsibilityDisputed"
          ? "Khách phản đối"
          : status === "AwaitingPayment"
            ? "Chờ chứng từ"
            : status === "PaymentProofSubmitted"
              ? "Chờ duyệt chứng từ"
              : status === "Resolved"
                ? "Hoàn tất"
                : status === "Rejected"
                  ? "Bị từ chối"
                  : status;
  return (
    <View style={[fineStyles(theme).badge, { backgroundColor: st.bg, borderColor: st.border }]}>
      <View style={[fineStyles(theme).dot, { backgroundColor: st.dot }]} />
      <Text style={[fineStyles(theme).text, { color: st.text }]}>{label}</Text>
    </View>
  );
}

const fineStyles = (theme: Theme) =>
  StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    dot: { width: 6, height: 6, borderRadius: 3 },
    text: { fontSize: 11, fontWeight: "800" },
  });

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: theme.background },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 16,
      paddingTop: 2,
      paddingBottom: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    backButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
    },
    backButtonPlaceholder: { width: 32, height: 32 },
    backText: { color: theme.text, fontSize: 22, fontWeight: "700", marginTop: -2 },
    screenTitle: { color: theme.text, fontSize: 16, fontWeight: "800" },
    scrollGrow: { flexGrow: 1, paddingBottom: 100 },
    headerBlock: { paddingTop: 8, gap: 10 },
    padded: { paddingHorizontal: 16 },
    searchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    input: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: theme.text,
      fontSize: 14,
    },
    searchInput: { flex: 1 },
    clearButton: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    clearText: { color: theme.muted, fontSize: 13, fontWeight: "700" },
    filterHeadRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
    sectionLabel: { color: theme.muted, fontSize: 12, fontWeight: "800", letterSpacing: 0.4, marginTop: 2 },
    resetText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    // Full-bleed: ScrollView tràn 2 mép màn hình, nội dung có padding 16.
    chipScroll: { flexGrow: 0, marginHorizontal: 0 },
    chips: { flexGrow: 0, flexDirection: "row", gap: 8, paddingVertical: 4, paddingHorizontal: 16 },
    chip: {
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 999,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    chipActive: { borderColor: theme.brand, backgroundColor: theme.brandSoft },
    chipText: { color: theme.text, fontSize: 12.5, fontWeight: "700" },
    chipTextActive: { color: theme.brand },
    countRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
    countBadge: {
      color: theme.text,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 4,
      fontSize: 12,
      fontWeight: "800",
      overflow: "hidden",
    },
    muted: { color: theme.muted, fontSize: 13 },
    mutedCenter: { color: theme.muted, fontSize: 13, textAlign: "center" },
    error: { color: theme.danger, fontSize: 13, fontWeight: "600", textAlign: "center" },
    loader: { marginTop: 32 },
    center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 32 },
    title: { color: theme.text, fontSize: 16, fontWeight: "800" },
    retryButton: {
      borderWidth: 1,
      borderColor: theme.brandBorder,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 10,
    },
    retryText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
    list: { gap: 4, paddingHorizontal: 16, paddingBottom: 100 },
    card: {
      gap: 7,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      borderRadius: 18,
      padding: 16,
      marginTop: 10,
    },
    cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    bookingCode: { color: theme.text, fontSize: 15, fontWeight: "800", flex: 1 },
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      borderWidth: 1,
      borderRadius: 999,
      paddingHorizontal: 9,
      paddingVertical: 4,
      flexShrink: 0,
    },
    dot: { width: 7, height: 7, borderRadius: 4 },
    badgeText: { fontSize: 11, fontWeight: "800" },
    tagRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    typeChip: { backgroundColor: theme.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    typeChipText: { color: theme.text, fontSize: 12, fontWeight: "700" },
    adminChip: { backgroundColor: theme.brandSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
    adminChipText: { color: theme.brand, fontSize: 12, fontWeight: "800" },
    body: { color: theme.muted, fontSize: 13.5, lineHeight: 20 },
    fineRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
    fineMoney: { color: theme.text, fontSize: 13, fontWeight: "800" },
    pager: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 12 },
    pageButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    pageText: { color: theme.text, fontSize: 18, fontWeight: "800" },
    createButton: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 16,
      borderRadius: 14,
      backgroundColor: theme.brand,
      paddingVertical: 14,
      alignItems: "center",
    },
    createText: { color: "#fff", fontSize: 15, fontWeight: "800" },
  });
