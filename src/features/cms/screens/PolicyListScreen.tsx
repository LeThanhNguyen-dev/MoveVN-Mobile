import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import { ArrowLeft, BookOpen, ChevronRight, Scale, Search, X } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import PolicyDetailScreen from "@/features/cms/screens/PolicyDetailScreen";
import PolicyDocsScreen from "@/features/cms/screens/PolicyDocsScreen";
import { getCmsPageNavigation } from "@/features/cms/services/cmsService";
import type { CmsPageNavigationItem } from "@/features/cms/types";
import {
  filterPolicyItems,
  findGroupForSlug,
  groupPolicyItems,
} from "@/features/cms/utils/groups";
import type { PolicyGroup, PolicyGroupKey } from "@/features/cms/utils/groups";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type TopicIcon = ComponentType<{ color?: string; size?: number; strokeWidth?: number }>;

const GROUP_ICONS: Record<PolicyGroupKey, TopicIcon> = {
  POLICY: Scale,
  GUIDE: BookOpen,
};

type PolicyListScreenProps = {
  onBack: () => void;
  initialSlug?: string;
};

export default function PolicyListScreen({ onBack, initialSlug }: PolicyListScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [items, setItems] = useState<CmsPageNavigationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const [activeGroup, setActiveGroup] = useState<PolicyGroup | null>(null);
  const [activeSlug, setActiveSlug] = useState<string | null>(initialSlug ?? null);

  const load = useCallback(async () => {
    setError("");
    setLoading(true);
    try {
      setItems(await getCmsPageNavigation());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Không tải được danh sách.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const groups = useMemo(
    () => groupPolicyItems(filterPolicyItems(items, query)),
    [items, query],
  );
  const searching = query.trim().length > 0;

  if (activeSlug) {
    const group = findGroupForSlug(groupPolicyItems(items), activeSlug);
    return (
      <PolicyDetailScreen
        groupLabel={group?.title}
        onBack={() => setActiveSlug(null)}
        slug={activeSlug}
      />
    );
  }

  if (activeGroup) {
    return (
      <PolicyDocsScreen
        group={activeGroup}
        initialQuery={query}
        onBack={() => setActiveGroup(null)}
        onOpenSlug={(slug) => setActiveSlug(slug)}
      />
    );
  }

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text style={styles.topBarTitle}>Điều khoản & Chính sách</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.heroDescription}>
          Tài liệu điều khoản, chính sách và hướng dẫn sử dụng MoveVN.
        </Text>

        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Search color={theme.faint} size={19} strokeWidth={2.3} />
          <TextInput
            accessibilityLabel="Tìm kiếm tài liệu"
            onBlur={() => setSearchFocused(false)}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            placeholder="Tìm tài liệu"
            placeholderTextColor={theme.placeholder}
            returnKeyType="search"
            style={styles.searchInput}
            value={query}
          />
          {query.length > 0 ? (
            <Pressable
              accessibilityLabel="Xóa tìm kiếm"
              accessibilityRole="button"
              onPress={() => setQuery("")}
              style={styles.clearButton}
            >
              <X color={theme.muted} size={17} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>

        {loading ? (
          <View style={styles.stateCard}>
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLine} />
            <View style={[styles.skeletonLine, styles.skeletonShort]} />
            <Text style={styles.muted}>Đang tải danh sách...</Text>
          </View>
        ) : error ? (
          <View style={styles.stateCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => { void load(); }} style={styles.retryButton}>
              <Text style={styles.retryText}>Thử lại</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Nhóm tài liệu</Text>
              {groups.length > 0 ? (
                <Text style={styles.sectionCount}>
                  {searching
                    ? `${groups.reduce((total, group) => total + group.items.length, 0)} kết quả`
                    : `${groups.length} nhóm`}
                </Text>
              ) : null}
            </View>

            {groups.length === 0 ? (
              <View style={styles.stateCard}>
                <Text style={styles.stateTitle}>
                  {searching ? "Không tìm thấy tài liệu phù hợp" : "Chưa có nội dung điều khoản"}
                </Text>
                <Text style={styles.muted}>
                  {searching
                    ? "Thử từ khóa khác."
                    : "Danh mục này đang được cập nhật. Vui lòng quay lại sau."}
                </Text>
              </View>
            ) : (
              <View style={styles.groupList}>
                {groups.map((group) => {
                  const Icon = GROUP_ICONS[group.key];
                  return (
                    <Pressable
                      key={group.key}
                      accessibilityRole="button"
                      onPress={() => setActiveGroup(group)}
                      style={styles.groupCard}
                    >
                      <View style={styles.groupIcon}>
                        <Icon color={theme.brand} size={22} strokeWidth={2.3} />
                      </View>
                      <View style={styles.groupInfo}>
                        <Text style={styles.groupTitle}>{group.title}</Text>
                        <Text style={styles.groupMeta}>{`${group.items.length} văn bản`}</Text>
                      </View>
                      <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    content: { flex: 1 },
    topBar: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      paddingVertical: 4,
      minHeight: 48,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    backButton: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 20 },
    topBarTitle: { color: theme.text, fontSize: 17, fontWeight: "800" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 14 },
    heroDescription: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 48,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 14,
    },
    searchBoxFocused: { borderColor: theme.brand },
    searchInput: { flex: 1, color: theme.text, fontSize: 14, fontWeight: "500", paddingVertical: 12 },
    clearButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center", borderRadius: 16 },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      gap: 8,
    },
    sectionTitle: { color: theme.text, fontSize: 15, fontWeight: "800" },
    sectionCount: { color: theme.muted, fontSize: 12, fontWeight: "700" },
    groupList: { gap: 12 },
    groupCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 13,
      borderRadius: 16,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      paddingHorizontal: 15,
      paddingVertical: 16,
    },
    groupIcon: {
      width: 44,
      height: 44,
      borderRadius: 13,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    groupInfo: { flex: 1, minWidth: 0, gap: 4 },
    groupTitle: { color: theme.text, fontSize: 15, lineHeight: 21, fontWeight: "800" },
    groupMeta: { color: theme.muted, fontSize: 12, fontWeight: "600" },
    stateCard: {
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 10,
    },
    skeletonLine: { height: 12, borderRadius: 6, backgroundColor: theme.surfaceAlt },
    skeletonShort: { width: "55%" },
    stateTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
    error: { color: theme.danger, fontSize: 13, lineHeight: 19, fontWeight: "600" },
    retryButton: {
      marginTop: 2,
      minHeight: 44,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.brandBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    retryText: { color: theme.brand, fontSize: 14, fontWeight: "700" },
  });
