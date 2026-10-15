import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, FileText, Search, X } from "lucide-react-native";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { filterPolicyItems } from "@/features/cms/utils/groups";
import type { PolicyGroup } from "@/features/cms/utils/groups";
import type { Theme } from "@/theme/tokens";
import { useTheme } from "@/theme/useTheme";

type PolicyDocsScreenProps = {
  group: PolicyGroup;
  initialQuery?: string;
  onBack: () => void;
  onOpenSlug: (slug: string) => void;
};

export default function PolicyDocsScreen({ group, initialQuery = "", onBack, onOpenSlug }: PolicyDocsScreenProps) {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [query, setQuery] = useState(initialQuery);
  const [searchFocused, setSearchFocused] = useState(false);

  const docs = useMemo(() => filterPolicyItems(group.items, query), [group.items, query]);
  const searching = query.trim().length > 0;

  return (
    <View style={styles.content}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={onBack} style={styles.backButton}>
          <ArrowLeft color={theme.text} size={22} strokeWidth={2.3} />
        </Pressable>
        <Text numberOfLines={1} style={styles.topBarTitle}>
          {group.title}
        </Text>
        <View style={styles.topBarSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Search color={theme.faint} size={19} strokeWidth={2.3} />
          <TextInput
            accessibilityLabel={`Tìm kiếm trong ${group.title}`}
            onBlur={() => setSearchFocused(false)}
            onChangeText={setQuery}
            onFocus={() => setSearchFocused(true)}
            placeholder="Tìm văn bản"
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

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Danh sách văn bản</Text>
          <Text style={styles.sectionCount}>
            {searching ? `${docs.length} kết quả` : `${group.items.length} văn bản`}
          </Text>
        </View>

        {docs.length === 0 ? (
          <View style={styles.stateCard}>
            <Text style={styles.stateTitle}>
              {searching ? "Không tìm thấy văn bản phù hợp" : "Chưa có văn bản"}
            </Text>
            <Text style={styles.muted}>
              {searching
                ? "Thử từ khóa khác."
                : "Nhóm tài liệu này đang được cập nhật. Vui lòng quay lại sau."}
            </Text>
          </View>
        ) : (
          <View style={styles.docCard}>
            {docs.map((doc, index) => (
              <Pressable
                key={doc.slug}
                accessibilityRole="button"
                onPress={() => onOpenSlug(doc.slug)}
                style={[styles.docRow, index < docs.length - 1 && styles.docDivider]}
              >
                <View style={styles.docIcon}>
                  <FileText color={theme.brand} size={20} strokeWidth={2.3} />
                </View>
                <View style={styles.docInfo}>
                  <Text numberOfLines={3} style={styles.docTitle}>
                    {doc.title}
                  </Text>
                  {doc.description ? (
                    <Text numberOfLines={2} style={styles.docDescription}>
                      {doc.description}
                    </Text>
                  ) : null}
                </View>
                <ChevronRight color={theme.faint} size={19} strokeWidth={2.4} />
              </Pressable>
            ))}
          </View>
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
    topBarTitle: { flex: 1, color: theme.text, fontSize: 17, fontWeight: "800", textAlign: "center" },
    topBarSpacer: { width: 40 },
    scroll: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28, gap: 14 },
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
    docCard: {
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      overflow: "hidden",
    },
    docRow: {
      minHeight: 62,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    docDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.divider,
    },
    docIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: theme.brandSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    docInfo: { flex: 1, minWidth: 0, gap: 3 },
    docTitle: { color: theme.text, fontSize: 14, lineHeight: 20, fontWeight: "700" },
    docDescription: { color: theme.muted, fontSize: 12, lineHeight: 18, fontWeight: "500" },
    stateCard: {
      borderRadius: 15,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      backgroundColor: theme.surface,
      padding: 16,
      gap: 8,
    },
    stateTitle: { color: theme.text, fontSize: 14, fontWeight: "800" },
    muted: { color: theme.muted, fontSize: 13, lineHeight: 20, fontWeight: "500" },
  });
